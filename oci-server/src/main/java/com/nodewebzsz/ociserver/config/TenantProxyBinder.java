package com.nodewebzsz.ociserver.config;

import com.nodewebzsz.dao.entity.Tenant;
import com.nodewebzsz.dao.entity.VpnProxyRecord;
import com.nodewebzsz.dao.repository.TenantRepository;
import com.nodewebzsz.dao.repository.VpnProxyRecordRepository;
import com.oracle.bmc.http.ClientConfigurator;
import com.oracle.bmc.http.client.jersey.ApacheClientProperties;
import com.oracle.bmc.http.client.jersey.JerseyClientProperty;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.client.ClientProperties;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;

import javax.annotation.Resource;
import java.net.URI;
import java.net.URISyntaxException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

/**
 * 按「账号树」绑定 SOCKS/HTTP 代理到当前线程 {@link ProxyContext}。
 * <p>
 * <b>绑定策略（只绑父租户即可）</b>：
 * <ul>
 *   <li>配置时：{@code vpn_proxy_record.tenant_id} 只存父租户主键</li>
 *   <li>运行时：无论传入父/子租户 id，都沿 {@code parenId} 向上解析，再查父租户代理</li>
 *   <li>子租户自动继承父账号代理，无需给每个区域复制一条绑定</li>
 * </ul>
 * <b>出口选择顺序</b>：专属节点 → 全局强制节点 → 全局代理池 → 直连（仅当未配置任何可用代理）。
 * <ul>
 *   <li>强制节点异常：拒绝请求，不更换出口</li>
 *   <li>非强制专属节点异常：回退到全局代理池，不直连</li>
 *   <li>代理池：同一账号优先沿用上次节点；检测结果在内存缓存，失败节点冷却后再试；全部不可用时拒绝请求</li>
 * </ul>
 */
@Slf4j
@Component
public class TenantProxyBinder {

    private static final int STATUS_AVAILABLE = 1;
    private static final String KEY_GLOBAL = "GLOBAL";
    /** 防止异常数据形成环 */
    private static final int MAX_PARENT_WALK = 8;

    /**
     * 当前线程已 apply 过的 key，避免同一次请求内重复探测。
     */
    private static final ThreadLocal<AppliedMark> APPLIED_KEY = new ThreadLocal<>();
    /** 线程内复用绑定结果的时长 */
    private static final long APPLIED_REUSE_MS = 60_000L;
    /** 账号与代理池节点的粘性时长，到期或节点异常后重新选择 */
    private static final long STICKY_TTL_MS = 10 * 60_000L;
    /** 单次选路最多实时检测的代理池节点数，控制最坏耗时 */
    private static final int MAX_POOL_PROBES = 3;
    /** 落库检测结果的有效期：超过该时长视为过期，需要重新检测 */
    static final long CHECK_FRESH_HOURS = 24;
    private static final Map<String, StickyChoice> STICKY = new ConcurrentHashMap<>();

    @Resource
    private VpnProxyRecordRepository vpnProxyRecordRepository;

    @Resource
    private TenantRepository tenantRepository;

    private static TenantProxyBinder resolve() {
        ApplicationContext ctx = SpringAppContext.get();
        if (ctx == null) {
            return null;
        }
        try {
            return ctx.getBean(TenantProxyBinder.class);
        } catch (Exception e) {
            log.warn("获取 TenantProxyBinder Bean 失败: {}", e.getMessage());
            return null;
        }
    }

    /**
     * 按租户实体绑定。子租户会沿 parenId 继承父租户代理。
     */
    public static void applyForTenant(Tenant tenant) {
        TenantProxyBinder binder = resolve();
        if (binder == null) {
            log.warn("TenantProxyBinder 未就绪，跳过代理绑定（SpringAppContext 未 set 或 Bean 不存在）");
            return;
        }
        if (tenant == null) {
            binder.doApply(null);
            return;
        }
        // 实体上已有 parenId 时，可少一次「是否为子」的误判（仍会再走完整向上解析）
        binder.doApply(tenant.getId());
    }

    /**
     * 按租户主键绑定。子区域 id 会解析到父账号再取代理。
     */
    public static void applyForTenantId(Long tenantPk) {
        TenantProxyBinder binder = resolve();
        if (binder == null) {
            log.warn("TenantProxyBinder 未就绪，跳过代理绑定 tenantPk={}", tenantPk);
            return;
        }
        binder.doApply(tenantPk);
    }

    public static void clear() {
        ProxyContext.clear();
        APPLIED_KEY.remove();
    }

    public static void runWithTenant(Tenant tenant, Runnable action) {
        try {
            applyForTenant(tenant);
            action.run();
        } finally {
            clear();
        }
    }

    public static <T> T callWithTenant(Tenant tenant, Supplier<T> action) {
        try {
            applyForTenant(tenant);
            return action.get();
        } finally {
            clear();
        }
    }

    void doApply(Long tenantPk) {
        // 绑定查找用：沿树向上找「专属代理」；去重 key 用根父租户
        Long rootParentId = resolveRootParentId(tenantPk);
        String key = rootParentId == null ? KEY_GLOBAL : String.valueOf(rootParentId);

        AppliedMark applied = APPLIED_KEY.get();
        if (applied != null && applied.matches(key)) {
            log.debug("代理已绑定过 rootParentId={}，跳过重复 apply", rootParentId);
            return;
        }

        ProxyContext.clear();
        APPLIED_KEY.remove();

        VpnProxyRecord dedicated = findDedicatedAlongHierarchy(tenantPk);
        String fallbackReason = null;

        // ① 专属节点：强制代理必须实时检测，失败即拒绝，不更换出口
        if (dedicated != null && isForceProxy(dedicated)) {
            bindForceProxy(dedicated, key, tenantPk, rootParentId);
            return;
        }
        // ② 专属节点（非强制）：健康则使用，异常则回退到全局节点 / 代理池，但不直连
        if (dedicated != null) {
            ProxyHealthCache.Entry health = check(dedicated);
            if (health.isHealthy() && bindQuietly(dedicated, key)) {
                logBound(dedicated, "专属", tenantPk, rootParentId);
                return;
            }
            fallbackReason = "专属代理 " + describe(dedicated) + " 不可用（" + health.getMessage() + "）";
            log.warn("{}，尝试回退到全局代理池 tenantPk={}", fallbackReason, tenantPk);
        }

        // ③ 全局强制代理：所有未绑定专属节点的账户统一走它，失败即拒绝
        VpnProxyRecord forceGlobal = vpnProxyRecordRepository.findForceGlobal();
        if (forceGlobal != null) {
            bindForceProxy(forceGlobal, key, tenantPk, rootParentId);
            return;
        }

        // ④ 全局代理池：粘性优先 + 健康缓存 + 有限次数实时检测
        List<VpnProxyRecord> pool = new ArrayList<>(vpnProxyRecordRepository.findAllAvailableGlobal(STATUS_AVAILABLE));
        if (dedicated != null) {
            pool.removeIf(p -> Objects.equals(p.getId(), dedicated.getId()));
        }
        if (pool.isEmpty()) {
            if (fallbackReason != null) {
                throw new IllegalStateException(fallbackReason + "，且全局代理池没有可用节点，已阻止直连 OCI");
            }
            log.debug("未配置任何可用代理，直连 tenantPk={} rootParentId={}", tenantPk, rootParentId);
            APPLIED_KEY.set(new AppliedMark(key));
            return;
        }
        VpnProxyRecord picked = pickFromPool(key, pool);
        if (picked == null) {
            String reason = (fallbackReason != null ? fallbackReason + "；" : "")
                    + "全局代理池 " + pool.size() + " 个节点当前均不可用，已阻止直连 OCI，请在代理管理中检测或更换节点";
            log.error("{} tenantPk={}", reason, tenantPk);
            throw new IllegalStateException(reason);
        }
        logBound(picked, "代理池", tenantPk, rootParentId);
    }

    /**
     * 从代理池选出一个健康节点并绑定：上次为该账号选中的节点优先（同一账号出口保持稳定），
     * 其次是内存缓存健康的节点、24 小时内检测通过的节点、未检测或已过期的节点，最近检测失败的节点排最后；
     * 冷却中的节点跳过，实时检测次数有上限。
     */
    private VpnProxyRecord pickFromPool(String key, List<VpnProxyRecord> pool) {
        Collections.shuffle(pool);
        StickyChoice sticky = STICKY.get(key);
        Long stickyId = sticky != null && sticky.isValid() ? sticky.proxyId : null;

        List<VpnProxyRecord> ordered = new ArrayList<>(pool.size());
        List<VpnProxyRecord> freshOk = new ArrayList<>();
        List<VpnProxyRecord> unknown = new ArrayList<>();
        List<VpnProxyRecord> recentlyFailed = new ArrayList<>();
        for (VpnProxyRecord p : pool) {
            ProxyHealthCache.Entry cached = ProxyHealthCache.peek(p);
            if (cached != null) {
                if (cached.isHealthy()) {
                    ordered.add(p);
                }
                continue;
            }
            switch (persistedState(p)) {
                case FRESH_OK:
                    freshOk.add(p);
                    break;
                case FRESH_FAILED:
                    recentlyFailed.add(p);
                    break;
                default:
                    unknown.add(p);
            }
        }
        ordered.addAll(freshOk);
        ordered.addAll(unknown);
        ordered.addAll(recentlyFailed);
        if (stickyId != null) {
            for (int i = 0; i < ordered.size(); i++) {
                if (Objects.equals(ordered.get(i).getId(), stickyId)) {
                    ordered.add(0, ordered.remove(i));
                    break;
                }
            }
        }

        int probes = 0;
        for (VpnProxyRecord candidate : ordered) {
            boolean cachedHealthy = ProxyHealthCache.peek(candidate) != null;
            if (!cachedHealthy) {
                if (probes >= MAX_POOL_PROBES) {
                    break;
                }
                probes++;
                if (!probe(candidate).isHealthy()) {
                    log.warn("代理池节点检测失败，冷却后再试 {}", describe(candidate));
                    continue;
                }
            }
            if (bindQuietly(candidate, key)) {
                STICKY.put(key, new StickyChoice(candidate.getId()));
                return candidate;
            }
        }
        STICKY.remove(key);
        return null;
    }

    private void bindForceProxy(VpnProxyRecord proxy, String key, Long tenantPk, Long rootParentId) {
        ProxyHealthCache.Entry health = probe(proxy);
        if (!health.isHealthy()) {
            markUnavailableQuietly(proxy, health.getMessage());
            throw forceProxyDenied(proxy, "连通探测失败（" + health.getMessage() + "），已阻止向 OCI 发起请求");
        }
        try {
            applyProxy(proxy);
        } catch (Exception e) {
            ProxyContext.clear();
            throw forceProxyDenied(proxy, "代理绑定失败: " + e.getMessage());
        }
        APPLIED_KEY.set(new AppliedMark(key));
        logBound(proxy, "强制", tenantPk, rootParentId);
    }

    private boolean bindQuietly(VpnProxyRecord proxy, String key) {
        try {
            applyProxy(proxy);
            APPLIED_KEY.set(new AppliedMark(key));
            return true;
        } catch (Exception e) {
            log.warn("绑定代理失败 {}: {}", describe(proxy), e.getMessage());
            ProxyContext.clear();
            return false;
        }
    }

    private static void logBound(VpnProxyRecord proxy, String source, Long tenantPk, Long rootParentId) {
        log.info("已绑定{}代理 {} [{}] tenantPk={} rootParentId={}",
                source, describe(proxy), proxy.getProxyType(), tenantPk, rootParentId);
    }

    private static String describe(VpnProxyRecord proxy) {
        String name = proxy.getCustomName();
        String addr = proxy.getProxyHost() + ":" + proxy.getProxyPort();
        return name == null || name.trim().isEmpty() ? addr : name.trim() + "(" + addr + ")";
    }

    /**
     * 优先复用内存缓存，缓存失效时实时检测并落库。
     */
    private ProxyHealthCache.Entry check(VpnProxyRecord proxy) {
        ProxyHealthCache.Entry cached = ProxyHealthCache.peek(proxy);
        return cached != null ? cached : probe(proxy);
    }

    /**
     * 实时检测并把检测时间与失败原因写回数据库（不改可用状态，避免瞬时故障把节点永久移出代理池）。
     */
    private ProxyHealthCache.Entry probe(VpnProxyRecord proxy) {
        ProxyHealthCache.Entry entry = ProxyHealthCache.probe(proxy);
        if (proxy != null && proxy.getId() != null) {
            String error = entry.isHealthy() ? null : entry.getMessage();
            try {
                vpnProxyRecordRepository.updateCheckResult(proxy.getId(), LocalDateTime.now(), error);
            } catch (Exception e) {
                log.debug("回写代理检测结果失败 id={}: {}", proxy.getId(), e.getMessage());
            }
        }
        return entry;
    }

    enum PersistedState { FRESH_OK, FRESH_FAILED, UNKNOWN }

    /**
     * 根据落库的检测结果判断节点状态：24 小时内的结果有效，更早或从未检测视为未知。
     */
    static PersistedState persistedState(VpnProxyRecord proxy) {
        LocalDateTime checkedAt = proxy.getLastCheckedAt();
        if (checkedAt == null || checkedAt.isBefore(LocalDateTime.now().minusHours(CHECK_FRESH_HOURS))) {
            return PersistedState.UNKNOWN;
        }
        String error = proxy.getLastCheckError();
        return error == null || error.trim().isEmpty() ? PersistedState.FRESH_OK : PersistedState.FRESH_FAILED;
    }

    /**
     * 强制探测失败时，尽量把 availableStatus 落库为 0（失败不影响主流程抛错）。
     */
    private void markUnavailableQuietly(VpnProxyRecord proxyConfig, String error) {
        if (proxyConfig == null || proxyConfig.getId() == null) {
            return;
        }
        try {
            proxyConfig.setAvailableStatus(0);
            vpnProxyRecordRepository.updateAvailability(proxyConfig.getId(), 0, LocalDateTime.now(), error);
        } catch (Exception e) {
            log.debug("回写代理不可用状态失败 id={}: {}", proxyConfig.getId(), e.getMessage());
        }
    }

    /**
     * 从当前租户 id 开始，沿 parenId 向上查找专属代理：只配置父租户绑定，所有子区域自动继承。
     * <p>
     * 强制代理即使当前不可用也返回，以便上层拒绝请求；非强制且已禁用的绑定继续向上查找。
     */
    private VpnProxyRecord findDedicatedAlongHierarchy(Long tenantPk) {
        Long current = tenantPk;
        int guard = 0;
        while (current != null && guard < MAX_PARENT_WALK) {
            guard++;
            VpnProxyRecord bound = vpnProxyRecordRepository.findTopByTenantId(current);
            if (bound != null && (isForceProxy(bound) || isAvailable(bound))) {
                if (guard > 1) {
                    log.debug("子租户 {} 继承祖先 {} 的专属代理 force={}", tenantPk, current, isForceProxy(bound));
                }
                return bound;
            }
            Tenant t = tenantRepository.findById(current).orElse(null);
            if (t == null) {
                break;
            }
            Long parenId = t.getParenId();
            if (parenId == null || parenId == 0L || parenId.equals(current)) {
                break;
            }
            current = parenId;
        }
        return null;
    }

    /** 同一线程内的绑定结果短时复用；过期后重新选路，避免后台任务线程长期沿用旧出口。 */
    private static final class AppliedMark {
        private final String key;
        private final long appliedAt = System.currentTimeMillis();

        AppliedMark(String key) {
            this.key = key;
        }

        boolean matches(String other) {
            return key.equals(other) && System.currentTimeMillis() - appliedAt < APPLIED_REUSE_MS;
        }
    }

    /** 账号与代理池节点的粘性绑定，节点健康时同一账号持续使用同一出口。 */
    private static final class StickyChoice {
        private final Long proxyId;
        private final long expiresAt = System.currentTimeMillis() + STICKY_TTL_MS;

        StickyChoice(Long proxyId) {
            this.proxyId = proxyId;
        }

        boolean isValid() {
            return System.currentTimeMillis() < expiresAt;
        }
    }

    private static boolean isForceProxy(VpnProxyRecord proxy) {
        return proxy != null && proxy.getForceProxy() != null && proxy.getForceProxy() == 1;
    }

    private static boolean isAvailable(VpnProxyRecord proxy) {
        return proxy != null && proxy.getAvailableStatus() != null
                && proxy.getAvailableStatus() == STATUS_AVAILABLE;
    }

    private static IllegalStateException forceProxyDenied(VpnProxyRecord proxy, String reason) {
        String host = proxy != null ? proxy.getProxyHost() : "?";
        Integer port = proxy != null ? proxy.getProxyPort() : null;
        String msg = "强制代理模式下拒绝请求: " + host + ":" + port + " — " + reason;
        log.error(msg);
        return new IllegalStateException(msg);
    }

    /**
     * 解析账号树根（parenId 为空或 0 的节点），用于去重 key。
     */
    private Long resolveRootParentId(Long tenantPk) {
        if (tenantPk == null) {
            return null;
        }
        Long current = tenantPk;
        int guard = 0;
        try {
            while (current != null && guard < MAX_PARENT_WALK) {
                guard++;
                Tenant t = tenantRepository.findById(current).orElse(null);
                if (t == null) {
                    return current;
                }
                Long parenId = t.getParenId();
                if (parenId == null || parenId == 0L || parenId.equals(current)) {
                    return t.getId();
                }
                current = parenId;
            }
            return current;
        } catch (Exception e) {
            log.debug("解析根父租户失败 tenantPk={}: {}", tenantPk, e.getMessage());
            return tenantPk;
        }
    }

    private void applyProxy(VpnProxyRecord proxyConfig) throws URISyntaxException {
        String host = proxyConfig.getProxyHost();
        int port = proxyConfig.getProxyPort();
        String proxyUsername = proxyConfig.getProxyUsername();
        String proxyPassword = proxyConfig.getProxyPassword();
        String proxyType = proxyConfig.getProxyType() == null
                ? "http"
                : proxyConfig.getProxyType().trim().toLowerCase(Locale.ROOT);
        if (proxyType.startsWith("socks")) {
            applySocksProxy(host, port, proxyUsername, proxyPassword);
            return;
        }
        // HTTP 与 HTTPS 代理都通过明文 HTTP CONNECT 建立隧道，TLS 只发生在隧道内的 OCI 端点之间。
        // 若以 https:// 作为 PROXY_URI，客户端会先与代理本身做 TLS 握手，普通代理网关会直接失败。
        URI proxyUri = new URI("http", null, host, port, null, null, null);
        String url = proxyUri.toString();
        ClientConfigurator proxyConfigurator = clientBuilder -> {
            clientBuilder.property(JerseyClientProperty.create(ClientProperties.PROXY_URI), url);
            if (proxyUsername != null && proxyPassword != null
                    && !proxyUsername.isEmpty() && !proxyPassword.isEmpty()) {
                clientBuilder.property(JerseyClientProperty.create(ClientProperties.PROXY_USERNAME), proxyUsername);
                clientBuilder.property(JerseyClientProperty.create(ClientProperties.PROXY_PASSWORD), proxyPassword);
            }
        };
        ProxyContext.set(proxyConfigurator);
    }

    private void applySocksProxy(String host, int port, String proxyUsername, String proxyPassword) {
        String username = proxyUsername == null || proxyUsername.trim().isEmpty() ? null : proxyUsername.trim();
        String password = proxyPassword == null || proxyPassword.isEmpty() ? null : proxyPassword;
        ClientConfigurator proxyConfigurator = clientBuilder -> {
            clientBuilder.property(ApacheClientProperties.CONNECTION_MANAGER,
                    Socks5ConnectionManagers.get(host.trim(), port, username, password));
            clientBuilder.property(ApacheClientProperties.CONNECTION_MANAGER_SHARED, true);
        };
        ProxyContext.set(proxyConfigurator);
    }
}
