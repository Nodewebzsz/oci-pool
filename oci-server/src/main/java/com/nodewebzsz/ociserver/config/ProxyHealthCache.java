package com.nodewebzsz.ociserver.config;

import com.nodewebzsz.dao.entity.VpnProxyRecord;
import com.nodewebzsz.ociserver.utils.SocksProxyUtils;

import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 代理节点运行时健康缓存（仅内存，不落库）。
 * <p>
 * 请求链路选路时复用最近一次检测结果，避免每次 OCI 调用都重新探测；检测失败的节点进入冷却期，
 * 冷却结束前不会被自动选中，但不会改写数据库里的可用状态，节点恢复后可自动回到池中。
 * 缓存 key 含代理地址、类型和凭据摘要，修改代理配置后旧结果自动失效。
 */
public final class ProxyHealthCache {

    /** 检测通过的结果复用时长 */
    static final long HEALTHY_TTL_MS = 3 * 60_000L;
    /** 检测失败后的冷却时长 */
    static final long FAILURE_COOLDOWN_MS = 60_000L;

    private static final Map<String, Entry> CACHE = new ConcurrentHashMap<>();

    private ProxyHealthCache() {
    }

    public static final class Entry {
        private final boolean healthy;
        private final String message;
        private final long checkedAt;

        Entry(boolean healthy, String message, long checkedAt) {
            this.healthy = healthy;
            this.message = message;
            this.checkedAt = checkedAt;
        }

        public boolean isHealthy() {
            return healthy;
        }

        public String getMessage() {
            return message;
        }
    }

    /**
     * 返回仍在有效期内的检测结果；没有或已过期返回 null。
     */
    public static Entry peek(VpnProxyRecord proxy) {
        Entry entry = CACHE.get(key(proxy));
        if (entry == null) {
            return null;
        }
        long ttl = entry.healthy ? HEALTHY_TTL_MS : FAILURE_COOLDOWN_MS;
        return System.currentTimeMillis() - entry.checkedAt < ttl ? entry : null;
    }

    /**
     * 优先使用缓存结果，缓存失效时实时做一次轻量隧道检测并写入缓存。
     */
    public static Entry check(VpnProxyRecord proxy) {
        Entry cached = peek(proxy);
        return cached != null ? cached : probe(proxy);
    }

    /**
     * 忽略缓存，实时检测并写入缓存。
     */
    public static Entry probe(VpnProxyRecord proxy) {
        SocksProxyUtils.ProxyCheckResult result;
        try {
            result = SocksProxyUtils.checkTunnel(proxy);
        } catch (Exception e) {
            result = new SocksProxyUtils.ProxyCheckResult(false, "检测异常: " + e.getMessage());
        }
        return record(proxy, result.isConnected(), result.getMessage());
    }

    /**
     * 记录一次外部检测结果（例如用户在代理管理页手动测试）。
     */
    public static Entry record(VpnProxyRecord proxy, boolean healthy, String message) {
        Entry entry = new Entry(healthy, SocksProxyUtils.redact(message, proxy), System.currentTimeMillis());
        CACHE.put(key(proxy), entry);
        return entry;
    }

    private static String key(VpnProxyRecord proxy) {
        return proxy.getId() + "|" + proxy.getProxyType() + "|" + proxy.getProxyHost() + ":" + proxy.getProxyPort()
                + "|" + proxy.getProxyUsername() + "|" + Objects.hashCode(proxy.getProxyPassword());
    }
}
