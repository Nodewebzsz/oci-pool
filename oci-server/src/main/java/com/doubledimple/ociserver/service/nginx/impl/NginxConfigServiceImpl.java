package com.doubledimple.ociserver.service.nginx.impl;

import com.doubledimple.dao.entity.NginxConfig;
import com.doubledimple.dao.entity.ProxyConfig;
import com.doubledimple.dao.entity.SslCertificate;
import com.doubledimple.dao.entity.SystemConfig;
import com.doubledimple.dao.repository.NginxConfigRepository;
import com.doubledimple.dao.repository.SslCertificateRepository;
import com.doubledimple.dao.repository.SystemConfigRepository;
import com.doubledimple.ocicommon.param.ApiResponse;
import com.doubledimple.ociserver.service.nginx.NginxConfigService;
import com.doubledimple.ociserver.service.nginx.ProxyConfigService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestTemplate;

import javax.annotation.Resource;
import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

/**
 * @version 1.0.0
 * @ClassName NginxConfigServiceImpl
 * @Description
 * @Author nodewebzsz
 * @Date 2025-09-23 14:31
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NginxConfigServiceImpl implements NginxConfigService {

    @Resource
    private RestTemplate restTemplate;

    private final NginxConfigRepository nginxConfigRepository;

    private final SslCertificateRepository sslCertificateRepository;

    private final ProxyConfigService proxyConfigService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Resource
    private SystemConfigRepository systemConfigRepository;

    private static final String CFG_TOKEN = "openresty.api.token";
    private static final String CFG_BASE_URL = "openresty.api.base-url";

    /** OpenResty 管理 API 基础地址，可通过配置覆盖。默认 http://127.0.0.1:8080/api */
    @Value("${openresty.api.base-url:http://127.0.0.1:8080/api}")
    private String openrestyApiBaseUrl;

    /** OpenResty 管理 API 鉴权 token（yml 默认；运行时优先 system_config） */
    @Value("${openresty.api.token:}")
    private String openrestyApiToken;

    private String resolveApiBaseUrl() {
        try {
            return systemConfigRepository.findByKey(CFG_BASE_URL)
                    .map(SystemConfig::getValue)
                    .filter(StringUtils::hasText)
                    .orElse(openrestyApiBaseUrl);
        } catch (Exception e) {
            return openrestyApiBaseUrl;
        }
    }

    private String resolveApiToken() {
        try {
            String db = systemConfigRepository.findByKey(CFG_TOKEN)
                    .map(SystemConfig::getValue)
                    .orElse(null);
            if (StringUtils.hasText(db)) {
                return db.trim();
            }
        } catch (Exception ignore) { }
        return openrestyApiToken == null ? "" : openrestyApiToken;
    }

    private String sslCertApiUrl() { return resolveApiBaseUrl() + "/ssl/certs"; }
    private String configApiUrl()  { return resolveApiBaseUrl() + "/config"; }

    /** 给 HttpHeaders 套上 token(如果配置了) */
    private HttpHeaders apiHeaders() {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        String token = resolveApiToken();
        if (StringUtils.hasText(token)) {
            h.add("X-API-Token", token);
        }
        return h;
    }

    @Override
    public String ensureApiToken() {
        String existing = resolveApiToken();
        if (StringUtils.hasText(existing)) {
            return existing;
        }
        String token = UUID.randomUUID().toString().replace("-", "");
        SystemConfig cfg = systemConfigRepository.findByKey(CFG_TOKEN).orElse(new SystemConfig());
        cfg.setKey(CFG_TOKEN);
        cfg.setValue(token);
        cfg.setEnabled(true);
        systemConfigRepository.save(cfg);
        log.info("已生成 OpenResty API Token 并写入 system_config");
        return token;
    }

    @Override
    public Map<String, Object> buildInstallCommand(String mode, String publicBaseUrl) {
        String m = "docker".equalsIgnoreCase(mode) ? "docker" : "local";
        String token = ensureApiToken();
        String origin = publicBaseUrl;
        if (!StringUtils.hasText(origin)) {
            origin = "http://127.0.0.1:9856";
        }
        while (origin.endsWith("/")) {
            origin = origin.substring(0, origin.length() - 1);
        }
        // 宿主 curl 下载脚本：用浏览器访问的 origin（已映射 9856 时可用）
        String scriptUrl = origin + "/script/nginx/install.sh";
        // 白名单：loopback + 常见 Docker bridge + 常见自定义网段
        String dockerAllow = "127.0.0.1,::1,172.16.0.0/12,192.168.0.0/16,10.0.0.0/8";

        StringBuilder cmd = new StringBuilder();
        cmd.append("curl -fsSL '").append(scriptUrl).append("' | sudo bash -s -- ");
        cmd.append("--token '").append(token).append("' ");
        cmd.append("--mode ").append(m);
        if ("docker".equals(m)) {
            // 管理 API 必须对容器网段可达；业务 80/443 也在宿主机监听
            cmd.append(" --listen 0.0.0.0:8080 --allow '").append(dockerAllow).append("'");
        }

        /*
         * Docker 场景下 Java 容器访问宿主 OpenResty 的 base-url 选择：
         * 1) host.docker.internal — Docker Desktop / 加了 extra_hosts 的 Linux
         * 2) 172.17.0.1 — 默认 docker0 网关（多数 Linux bridge 网络）
         * 3) --network host 部署的 oci-pool 应改用 local 模式（127.0.0.1）
         */
        String suggestedBase = "http://127.0.0.1:8080/api";
        String suggestedBaseAlt = suggestedBase;
        if ("docker".equals(m)) {
            suggestedBase = "http://172.17.0.1:8080/api";
            suggestedBaseAlt = "http://host.docker.internal:8080/api";
        }

        // docker 模式强制把建议 base-url 写进 DB，保证 Java 侧探测用对地址
        if ("docker".equals(m)) {
            SystemConfig baseCfg = systemConfigRepository.findByKey(CFG_BASE_URL).orElse(new SystemConfig());
            baseCfg.setKey(CFG_BASE_URL);
            // 若用户已手改过非默认地址则保留；空或旧的 host.docker.internal 可被建议值覆盖
            String cur = baseCfg.getValue();
            if (!StringUtils.hasText(cur)
                    || "http://127.0.0.1:8080/api".equals(cur)
                    || "http://host.docker.internal:8080/api".equals(cur)) {
                baseCfg.setValue(suggestedBase);
            }
            baseCfg.setEnabled(true);
            systemConfigRepository.save(baseCfg);
        } else {
            SystemConfig baseCfg = systemConfigRepository.findByKey(CFG_BASE_URL).orElse(new SystemConfig());
            if (!StringUtils.hasText(baseCfg.getValue())) {
                baseCfg.setKey(CFG_BASE_URL);
                baseCfg.setValue(suggestedBase);
                baseCfg.setEnabled(true);
                systemConfigRepository.save(baseCfg);
            }
        }

        // 容器侧环境变量示例（重启 oci-pool 容器时注入，比改 yml 更稳）
        String envSnippet = "docker".equals(m)
                ? ("-e OPENRESTY_API_BASE_URL=" + suggestedBase + " \\\n"
                + "  -e OPENRESTY_API_TOKEN=" + token)
                : ("# 同机无需额外环境变量，默认 http://127.0.0.1:8080/api");

        String extraHosts = "docker".equals(m)
                ? "--add-host=host.docker.internal:host-gateway"
                : "";

        String composeSnippet = "docker".equals(m)
                ? ("# docker-compose 示例片段\n"
                + "services:\n"
                + "  oci-pool:\n"
                + "    image: your-oci-pool-image\n"
                + "    ports:\n"
                + "      - \"9856:9856\"\n"
                + "    environment:\n"
                + "      OPENRESTY_API_BASE_URL: \"" + suggestedBase + "\"\n"
                + "      OPENRESTY_API_TOKEN: \"" + token + "\"\n"
                + "    extra_hosts:\n"
                + "      - \"host.docker.internal:host-gateway\"\n"
                + "    # 若使用 network_mode: host，请改用页面「同机部署」模式")
                : "";

        Map<String, Object> result = new HashMap<String, Object>();
        result.put("mode", m);
        result.put("token", token);
        result.put("scriptUrl", scriptUrl);
        result.put("command", cmd.toString());
        result.put("apiBaseUrl", resolveApiBaseUrl());
        result.put("suggestedApiBaseUrl", suggestedBase);
        result.put("suggestedApiBaseUrlAlt", suggestedBaseAlt);
        result.put("dockerAllow", "docker".equals(m) ? dockerAllow : null);
        result.put("envSnippet", envSnippet);
        result.put("extraHosts", extraHosts);
        result.put("composeSnippet", composeSnippet);
        result.put("hint", "local".equals(m)
                ? "在与 oci-pool 同一台服务器上执行（需 root）。若 oci-pool 使用 --network host，也选本模式。"
                : "在【宿主机】执行安装命令（不是容器内）。OpenResty 跑在宿主机；Java 容器通过 172.17.0.1 或 host.docker.internal 访问管理 API。");
        result.put("steps", "docker".equals(m)
                ? new String[]{
                "在宿主机执行下方安装命令（装 OpenResty + 管理 API :8080）",
                "给 oci-pool 容器注入 OPENRESTY_API_BASE_URL 与 OPENRESTY_API_TOKEN 并重启",
                "回到本页点「刷新状态」，应显示已就绪",
                "若仍不通：检查防火墙 8080、docker0 网关 IP、是否用了 host 网络"
        }
                : new String[]{
                "SSH 登录本机，粘贴执行安装命令",
                "等待 systemd 拉起 openresty-oci",
                "本页自动检测就绪后即可使用"
        });
        return result;
    }

    /** 防止 applyConfig 并发同时改动 OpenResty + DB 的全局锁 */
    private final ReentrantLock applyLock = new ReentrantLock();

    @Override
    @Transactional
    public NginxConfig generateNginxConfig() {
        List<ProxyConfig> configs = proxyConfigService.getAllActiveConfigs();

        StringBuilder httpSnippets = new StringBuilder();
        StringBuilder servers = new StringBuilder();

        // 限流 zone 必须在 http 上下文；仅当有代理真正启用限流时才输出
        for (ProxyConfig config : configs) {
            if (Boolean.TRUE.equals(config.getEnableRateLimit()) && config.getRateLimit() != null
                    && config.getRateLimit() > 0) {
                String zone = safeZoneName(config.getDomain());
                httpSnippets.append("# rate limit for ").append(config.getDomain()).append("\n");
                httpSnippets.append("limit_req_zone $binary_remote_addr zone=").append(zone)
                        .append(":10m rate=").append(config.getRateLimit()).append("r/s;\n");
            }
        }
        // 缓存 path：所有启用缓存的代理共用一个默认 zone（Phase 1 再拆独立 cache zone 表）
        boolean anyCache = false;
        for (ProxyConfig config : configs) {
            if (Boolean.TRUE.equals(config.getEnableCache())) {
                anyCache = true;
                break;
            }
        }
        if (anyCache) {
            httpSnippets.append("proxy_cache_path /tmp/nginx_cache levels=1:2 keys_zone=oci_proxy_cache:10m ")
                    .append("max_size=1g inactive=60m use_temp_path=off;\n");
        }

        for (ProxyConfig config : configs) {
            // 引用了已被删除的证书时跳过该 server block，保证整张配置仍能生成
            if (Boolean.TRUE.equals(config.getEnableSsl()) && config.getSslCertificateId() != null
                    && !sslCertificateRepository.existsById(config.getSslCertificateId())) {
                log.warn("跳过 domain={}，引用的证书 id={} 已不存在", config.getDomain(), config.getSslCertificateId());
                continue;
            }
            try {
                servers.append(generateServerBlock(config)).append("\n\n");
            } catch (Exception e) {
                log.warn("生成 server block 失败 domain={}, reason:{}", config.getDomain(), e.getMessage());
            }
        }

        StringBuilder sb = new StringBuilder();
        if (httpSnippets.length() > 0) {
            // 写入 sites 文件时 OpenResty 通常 include 在 http{} 内；
            // 若运行环境把本文件 include 在 http 内，limit_req_zone/proxy_cache_path 合法。
            sb.append("# ---- auto http-level snippets (zones) ----\n");
            sb.append(httpSnippets).append("\n");
        }
        sb.append(servers);
        String content = sb.toString();

        NginxConfig latestConfig = nginxConfigRepository.findFirstByOrderByConfigVersionDesc().orElse(null);
        // 关键：内容相同就不再产生新版本，避免每次 ProxyConfig CRUD 都让 nginx_config 表无限膨胀
        if (latestConfig != null && Objects.equals(content, latestConfig.getConfigContent())) {
            log.debug("Nginx 配置内容未变化，复用 v{}", latestConfig.getConfigVersion());
            return latestConfig;
        }

        NginxConfig nginxConfig = new NginxConfig();
        nginxConfig.setConfigName("auto-generated-" + System.currentTimeMillis());
        nginxConfig.setConfigContent(content);
        nginxConfig.setConfigStatus(NginxConfig.ConfigStatus.DRAFT);
        int newVersion = latestConfig != null ? latestConfig.getConfigVersion() + 1 : 1;
        nginxConfig.setConfigVersion(newVersion);

        return nginxConfigRepository.save(nginxConfig);
    }

    private String safeZoneName(String domain) {
        return "rl_" + domain.replaceAll("[^a-zA-Z0-9_]", "_");
    }

    /**
     * 从 customConfig JSON 解析扩展字段（targets / listen / httpToHttps）。
     * 解析失败时返回空 map，不影响基础字段生成。
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> parseCustomMap(ProxyConfig config) {
        if (config.getCustomConfig() == null || config.getCustomConfig().trim().isEmpty()) {
            return new HashMap<String, Object>();
        }
        String raw = config.getCustomConfig().trim();
        if (!raw.startsWith("{")) {
            return new HashMap<String, Object>();
        }
        try {
            return objectMapper.readValue(raw, Map.class);
        } catch (Exception e) {
            log.debug("customConfig 非 JSON，按普通文本处理: domain={}", config.getDomain());
            return new HashMap<String, Object>();
        }
    }

    private String generateServerBlock(ProxyConfig config) {
        Map<String, Object> custom = parseCustomMap(config);
        int listenPort = intFrom(custom.get("listenPort"), Boolean.TRUE.equals(config.getEnableSsl()) ? 443 : 80);
        int redirectPort = intFrom(custom.get("redirectPort"), 80);
        boolean httpToHttps = custom.containsKey("httpToHttps")
                ? Boolean.TRUE.equals(custom.get("httpToHttps")) || "true".equalsIgnoreCase(String.valueOf(custom.get("httpToHttps")))
                : true;
        String listenIp = custom.get("listenIp") != null ? String.valueOf(custom.get("listenIp")).trim() : "";
        // 0.0.0.0 不写进 listen，避免多余前缀
        String listenPrefix = (listenIp.isEmpty() || "0.0.0.0".equals(listenIp)) ? "" : listenIp + ":";

        StringBuilder sb = new StringBuilder();
        if (Boolean.TRUE.equals(config.getEnableSsl())) {
            if (config.getSslCertificateId() == null) {
                throw new RuntimeException("域名 " + config.getDomain() + " 已启用SSL但未关联证书");
            }
            SslCertificate sslCertificate = sslCertificateRepository.findById(config.getSslCertificateId())
                    .orElseThrow(() -> new RuntimeException("未找到对应的SSL证书，id=" + config.getSslCertificateId()));
            String certDomain = sslCertificate.getDomain();

            if (httpToHttps) {
                sb.append("server {\n");
                sb.append("    listen ").append(listenPrefix).append(redirectPort).append(";\n");
                sb.append("    server_name ").append(config.getDomain()).append(";\n");
                sb.append("    return 301 https://$server_name$request_uri;\n");
                sb.append("}\n\n");
            }

            sb.append("server {\n");
            sb.append("    listen ").append(listenPrefix).append(listenPort).append(" ssl http2;\n");
            sb.append("    server_name ").append(config.getDomain()).append(";\n\n");
            sb.append("    ssl_certificate /usr/local/openresty/nginx/ssl/").append(certDomain).append("/fullchain.pem;\n");
            sb.append("    ssl_certificate_key /usr/local/openresty/nginx/ssl/").append(certDomain).append("/privkey.pem;\n\n");
            sb.append("    ssl_protocols TLSv1.2 TLSv1.3;\n");
            sb.append("    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384;\n");
            sb.append("    ssl_prefer_server_ciphers off;\n");
            sb.append("    ssl_session_cache shared:SSL:10m;\n");
            sb.append("    ssl_session_timeout 10m;\n\n");
        } else {
            sb.append("server {\n");
            sb.append("    listen ").append(listenPrefix).append(listenPort).append(";\n");
            sb.append("    server_name ").append(config.getDomain()).append(";\n\n");
        }

        if (Boolean.TRUE.equals(config.getEnableRateLimit()) && config.getRateLimit() != null && config.getRateLimit() > 0) {
            sb.append("    limit_req zone=").append(safeZoneName(config.getDomain()))
                    .append(" burst=").append(config.getRateLimit() * 2).append(" nodelay;\n\n");
        }

        // location：优先 customConfig.targets，否则单 location /
        List<Map<String, Object>> targets = extractTargets(custom, config);
        for (Map<String, Object> target : targets) {
            boolean enabled = target.get("enabled") == null || Boolean.TRUE.equals(target.get("enabled"))
                    || "true".equalsIgnoreCase(String.valueOf(target.get("enabled")));
            if (!enabled) {
                continue;
            }
            String path = target.get("path") != null ? String.valueOf(target.get("path")) : "/";
            if (path.isEmpty()) {
                path = "/";
            }
            String proxyPass = resolveProxyPass(target, config);
            boolean ws = target.get("websocket") != null
                    ? Boolean.TRUE.equals(target.get("websocket")) || "true".equalsIgnoreCase(String.valueOf(target.get("websocket")))
                    : Boolean.TRUE.equals(config.getEnableWebSocket());
            String hostHeader = target.get("host") != null ? String.valueOf(target.get("host")).trim() : "";

            sb.append("    location ").append(path).append(" {\n");
            if (Boolean.TRUE.equals(config.getEnableCache()) && config.getCacheTime() != null) {
                sb.append("        proxy_cache oci_proxy_cache;\n");
                sb.append("        proxy_cache_valid 200 ").append(config.getCacheTime()).append("s;\n");
                sb.append("        proxy_cache_key $scheme$proxy_host$request_uri;\n");
            }
            sb.append("        proxy_pass ").append(proxyPass).append(";\n");
            if (!hostHeader.isEmpty()) {
                sb.append("        proxy_set_header Host ").append(hostHeader).append(";\n");
            } else {
                sb.append("        proxy_set_header Host $host;\n");
            }
            sb.append("        proxy_set_header X-Real-IP $remote_addr;\n");
            sb.append("        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n");
            sb.append("        proxy_set_header X-Forwarded-Proto $scheme;\n");
            if (ws) {
                sb.append("        proxy_http_version 1.1;\n");
                sb.append("        proxy_set_header Upgrade $http_upgrade;\n");
                sb.append("        proxy_set_header Connection \"upgrade\";\n");
            }
            if (Boolean.TRUE.equals(config.getEnableHealthCheck()) && config.getHealthCheckPath() != null) {
                sb.append("        # Health check endpoint: ").append(config.getHealthCheckPath()).append("\n");
            }
            sb.append("    }\n");
        }

        // 非 JSON 的自定义片段仍追加（JSON 已解析为 targets 则不再原样 dump，避免非法 conf）
        if (config.getCustomConfig() != null && !config.getCustomConfig().trim().isEmpty()
                && !config.getCustomConfig().trim().startsWith("{")) {
            sb.append("\n    # Custom configuration\n");
            sb.append("    ").append(config.getCustomConfig().replaceAll("\n", "\n    ")).append("\n");
        }

        sb.append("}");
        return sb.toString();
    }

    private int intFrom(Object v, int def) {
        if (v == null) return def;
        try {
            return Integer.parseInt(String.valueOf(v));
        } catch (Exception e) {
            return def;
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> extractTargets(Map<String, Object> custom, ProxyConfig config) {
        List<Map<String, Object>> result = new java.util.ArrayList<Map<String, Object>>();
        Object raw = custom.get("targets");
        if (raw instanceof List) {
            for (Object item : (List<?>) raw) {
                if (item instanceof Map) {
                    result.add((Map<String, Object>) item);
                }
            }
        }
        if (result.isEmpty()) {
            Map<String, Object> one = new HashMap<String, Object>();
            one.put("enabled", true);
            one.put("path", "/");
            one.put("url", config.getProtocol() + "://" + config.getTargetHost() + ":" + config.getTargetPort());
            one.put("websocket", config.getEnableWebSocket());
            one.put("host", "");
            result.add(one);
        }
        return result;
    }

    private String resolveProxyPass(Map<String, Object> target, ProxyConfig config) {
        Object url = target.get("url");
        if (url != null && String.valueOf(url).trim().length() > 0) {
            String u = String.valueOf(url).trim();
            // proxy_pass 允许带或不带尾斜杠；保持用户输入
            return u;
        }
        return config.getProtocol() + "://" + config.getTargetHost() + ":" + config.getTargetPort();
    }

    @Override
    public NginxConfig getCurrentConfig() {
        return nginxConfigRepository.findByIsCurrentTrue().orElse(null);
    }

    @Override
    public NginxConfig getLatestConfig() {
        return nginxConfigRepository.findFirstByOrderByConfigVersionDesc().orElse(null);
    }

    @Override
    public void applyConfig(Long configId) {
        // 拿全局锁，避免两人同时点 apply 把 OpenResty 状态搞乱。最长等 30s
        boolean locked;
        try {
            locked = applyLock.tryLock(30, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("等待应用锁被中断");
        }
        if (!locked) {
            throw new RuntimeException("有其他配置正在应用，请稍后再试");
        }

        // 注意：这里整个流程不再放在 @Transactional 里。
        // 因为 OpenResty 的 PUT/REPLACE 是真实外部副作用，事务回滚拯救不了它，
        // 必须在失败时主动调用回滚 API 把 OpenResty 上的配置还原回上一版 current。
        NginxConfig config = nginxConfigRepository.findById(configId)
                .orElseThrow(() -> new RuntimeException("配置不存在: " + configId));
        NginxConfig previousCurrent = nginxConfigRepository.findByIsCurrentTrue().orElse(null);

        boolean openrestyPushed = false;
        try {
            // 第1步：测试配置文件语法
            if (!testConfig(configId)) {
                throw new RuntimeException("配置测试失败，请检查配置文件");
            }

            // 第2步：把新配置 PUT 到 OpenResty
            updateNginxConfigViaApi(config.getConfigContent());
            openrestyPushed = true;

            // 第3步：让 OpenResty reload 真正生效
            reloadNginxNoTx();

            // 第4步：DB 状态切换（独立事务，单独成功/失败不会污染上面已经成功的副作用）
            self().markConfigApplied(configId, previousCurrent != null ? previousCurrent.getId() : null);
            // 第5步：活动代理标记为已应用，避免 UI 一直显示「待应用」
            try {
                proxyConfigService.markActiveProxiesApplied();
            } catch (Exception markEx) {
                log.warn("标记代理 APPLIED 失败(配置已应用): {}", markEx.getMessage());
            }

            log.info("应用Nginx配置成功: {}", config.getConfigName());
        } catch (Exception e) {
            log.error("应用Nginx配置失败,reason:{}", e.getMessage(), e);
            // 已经把新配置推到 OpenResty 但 reload 失败：把 OpenResty 还原成上一版 current,
            // 避免下一次 reload(包括 cron / 运维手动)误把没确认过的配置激活
            if (openrestyPushed && previousCurrent != null) {
                try {
                    updateNginxConfigViaApi(previousCurrent.getConfigContent());
                    reloadNginxNoTx();
                    log.warn("已把 OpenResty 配置回滚到 v{}", previousCurrent.getConfigVersion());
                } catch (Exception rollbackEx) {
                    log.error("OpenResty 配置回滚失败,人工介入: {}", rollbackEx.getMessage(), rollbackEx);
                }
            }
            throw new RuntimeException("应用配置失败: " + e.getMessage());
        } finally {
            applyLock.unlock();
        }
    }

    @Transactional
    public void markConfigApplied(Long appliedId, Long previousCurrentId) {
        if (previousCurrentId != null) {
            nginxConfigRepository.findById(previousCurrentId).ifPresent(prev -> {
                prev.setIsCurrent(false);
                nginxConfigRepository.save(prev);
            });
        }
        nginxConfigRepository.findById(appliedId).ifPresent(applied -> {
            applied.setIsCurrent(true);
            applied.setConfigStatus(NginxConfig.ConfigStatus.APPLIED);
            nginxConfigRepository.save(applied);
        });
    }

    // 取自身代理对象，用来调用 @Transactional 方法时穿过 Spring 代理
    @Resource
    private org.springframework.context.ApplicationContext applicationContext;
    private NginxConfigServiceImpl self() { return applicationContext.getBean(NginxConfigServiceImpl.class); }

    /** reload 内部版本，不再触发上游事务回滚 */
    private void reloadNginxNoTx() {
        String apiUrl = configApiUrl() + "/reload";
        HttpHeaders headers = apiHeaders();
        ResponseEntity<String> response = restTemplate.exchange(
                apiUrl, HttpMethod.POST, new HttpEntity<>("{}", headers), String.class);
        if (!response.getStatusCode().is2xxSuccessful()) {
            throw new RuntimeException("重载Nginx失败: " + response.getBody());
        }
    }

    @Override
    public boolean testConfig(Long configId) {
        // 改为 read-only 操作，不再写入 status=TESTING；
        // 否则用户测试通过但没点 apply 时状态会卡住
        try {
            NginxConfig config = nginxConfigRepository.findById(configId).orElse(null);
            if (config == null) return false;

            String apiUrl = configApiUrl() + "/test";
            Map<String, String> requestBody = new HashMap<>();
            requestBody.put("content", config.getConfigContent());

            HttpHeaders headers = apiHeaders();

            ResponseEntity<String> response = restTemplate.exchange(
                    apiUrl, HttpMethod.POST, new HttpEntity<>(requestBody, headers), String.class);
            return response.getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            log.error("测试Nginx配置失败,reason:{}", e.getMessage());
            return false;
        }
    }

    @Override
    public void reloadNginx() {
        try {
            reloadNginxNoTx();
            log.info("通过API重载Nginx成功");
        } catch (Exception e) {
            log.error("通过API重载Nginx失败,reason:{}", e.getMessage());
            throw new RuntimeException("重载Nginx失败: " + e.getMessage());
        }
    }

    @Override
    public String getConfigDiff() {
        NginxConfig current = getCurrentConfig();
        NginxConfig latest = getLatestConfig();

        if (latest == null) return "暂无生成的配置";
        if (current == null) return "首次配置，尚未应用任何版本";
        if (current.getId().equals(latest.getId())) return "配置已是最新版本";

        // 给前端一份简单的行级 diff(类似 git 风格的 +/-)，便于左右栏渲染
        return buildLineDiff(current.getConfigContent(), latest.getConfigContent());
    }

    /** 行级 diff: "  ctx" / "- removed" / "+ added"。这里按行做最长公共子序列对比 */
    private String buildLineDiff(String oldText, String newText) {
        String[] a = oldText == null ? new String[0] : oldText.split("\n", -1);
        String[] b = newText == null ? new String[0] : newText.split("\n", -1);
        int n = a.length, m = b.length;
        int[][] dp = new int[n + 1][m + 1];
        for (int i = n - 1; i >= 0; i--) {
            for (int j = m - 1; j >= 0; j--) {
                if (a[i].equals(b[j])) dp[i][j] = dp[i + 1][j + 1] + 1;
                else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
            }
        }
        StringBuilder sb = new StringBuilder();
        int i = 0, j = 0;
        while (i < n && j < m) {
            if (a[i].equals(b[j])) { sb.append("  ").append(a[i]).append("\n"); i++; j++; }
            else if (dp[i + 1][j] >= dp[i][j + 1]) { sb.append("- ").append(a[i]).append("\n"); i++; }
            else { sb.append("+ ").append(b[j]).append("\n"); j++; }
        }
        while (i < n) sb.append("- ").append(a[i++]).append("\n");
        while (j < m) sb.append("+ ").append(b[j++]).append("\n");
        return sb.toString();
    }

    @Override
    public Map<String, Object> checkOpenRestyStatus() {
        Map<String, Object> status = new HashMap<String, Object>();
        // 本机 binary（Docker 中心访问宿主 OpenResty 时可能为 false，不代表不可用）
        boolean localBinary = false;
        boolean localProcess = false;
        boolean systemdActive = false;
        try {
            localBinary = runProcessQuiet(5, "/usr/local/openresty/bin/openresty", "-v") == 0
                    || runProcessQuiet(5, "openresty", "-v") == 0;
            if (localBinary) {
                localProcess = runProcessQuiet(5, "pgrep", "-f", "openresty") == 0;
            }
            systemdActive = runProcessQuiet(5, "systemctl", "is-active", "--quiet", "openresty-oci") == 0;
        } catch (Exception e) {
            log.debug("本机 OpenResty 探测失败: {}", e.getMessage());
        }
        status.put("localBinary", localBinary);
        status.put("localProcess", localProcess);
        status.put("systemdActive", systemdActive);

        // 管理 API 可达性：真正决定能否推配置（含远程/宿主 OpenResty）
        boolean apiAvailable = checkApiAvailable();
        status.put("apiAvailable", apiAvailable);
        boolean installed = apiAvailable || localBinary;
        boolean running = apiAvailable || localProcess || systemdActive;
        status.put("installed", installed);
        status.put("running", running);
        status.put("apiBaseUrl", resolveApiBaseUrl());
        status.put("hasToken", StringUtils.hasText(resolveApiToken()));
        // 就绪等级：ready | partial | missing
        String level = apiAvailable ? "ready" : (localBinary ? "partial" : "missing");
        status.put("level", level);
        return status;
    }

    @Override
    public void startOpenRestyService() {
        try {
            // 优先 systemd
            int sys = runProcessQuiet(15, "systemctl", "start", "openresty-oci");
            if (sys == 0) {
                for (int i = 0; i < 10; i++) {
                    if (checkApiAvailable()) {
                        log.info("OpenResty(systemd) 启动成功");
                        return;
                    }
                    Thread.sleep(1000);
                }
            }
            int exit = runProcessQuiet(15, "/usr/local/openresty/bin/openresty");
            if (exit != 0) {
                throw new RuntimeException("OpenResty启动失败,exit=" + exit);
            }
            for (int i = 0; i < 10; i++) {
                if (checkApiAvailable()) {
                    log.info("OpenResty服务启动成功");
                    return;
                }
                Thread.sleep(1000);
            }
            throw new RuntimeException("OpenResty启动后API不可用");
        } catch (Exception e) {
            log.error("启动OpenResty失败,reason:{}", e.getMessage());
            throw new RuntimeException("启动OpenResty失败: " + e.getMessage());
        }
    }

    /**
     * 跑一个外部命令并返回 exitCode。带超时 + 强制 destroy + 同时消费 stdout/stderr,
     * 避免子进程缓冲区写满后 hang 死、Process 句柄泄漏。
     */
    private int runProcessQuiet(int timeoutSeconds, String... cmd) throws Exception {
        ProcessBuilder pb = new ProcessBuilder(cmd).redirectErrorStream(true);
        Process p = pb.start();
        // 单独线程异步消费 stdout,防止 64KB 缓冲区写满 hang 死
        Thread drain = new Thread(() -> {
            try (InputStream is = p.getInputStream()) {
                byte[] buf = new byte[1024];
                while (is.read(buf) >= 0) { /* 丢弃 */ }
            } catch (IOException ignore) { }
        });
        drain.setDaemon(true);
        drain.start();
        try {
            if (!p.waitFor(timeoutSeconds, TimeUnit.SECONDS)) {
                p.destroyForcibly();
                throw new RuntimeException("命令超时: " + String.join(" ", cmd));
            }
            return p.exitValue();
        } finally {
            try { drain.join(500); } catch (InterruptedException ignore) { Thread.currentThread().interrupt(); }
            if (p.isAlive()) p.destroyForcibly();
        }
    }

    @Override
    public void updateNginxConfigViaApi(String configContent) {
        try {
            String apiUrl = configApiUrl();

            Map<String, String> requestBody = new HashMap<>();
            requestBody.put("content", configContent);

            HttpHeaders headers = apiHeaders();

            HttpEntity<Map<String, String>> entity = new HttpEntity<>(requestBody, headers);
            ResponseEntity<String> response = restTemplate.exchange(
                    apiUrl, HttpMethod.PUT, entity, String.class
            );

            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new RuntimeException("API更新配置失败: " + response.getBody());
            }

            log.info("通过API更新nginx配置成功");

        } catch (Exception e) {
            log.error("通过API更新nginx配置失败", e);
            throw new RuntimeException("API更新配置失败: " + e.getMessage());
        }
    }

    // ============ SSL证书上传方法 ============

    /**
     * 上传SSL证书到OpenResty
     *
     * @param sslCertificate SSL证书实体（包含domain、certificatePath、privateKeyPath）
     * @return 上传结果
     */
    @Override
    public ApiResponse uploadSslCertificateToOpenResty(SslCertificate sslCertificate) {
        return uploadSslCertificateToOpenResty(sslCertificate, true);
    }

    /**
     * 上传 SSL 证书后是否立即 reload。批量续期时建议传 false,所有证书上传完只 reload 一次,
     * 避免短时间多次 reload 造成 502 / worker 风暴。
     */
    public ApiResponse uploadSslCertificateToOpenResty(SslCertificate sslCertificate, boolean reloadAfter) {
        try {
            if (sslCertificate == null || sslCertificate.getDomain() == null) {
                log.warn("证书信息不完整");
                return ApiResponse.error("证书信息不完整");
            }

            String domain = sslCertificate.getDomain();
            String certificatePath = sslCertificate.getCertificatePath();
            String privateKeyPath = sslCertificate.getPrivateKeyPath();

            // 读取证书文件内容
            String certContent = readFileContent(certificatePath);
            if (certContent == null || certContent.trim().isEmpty()) {
                log.warn("证书文件内容为空: {}", certificatePath);
                return ApiResponse.error("证书文件内容为空");
            }

            // 读取私钥文件内容
            String keyContent = readFileContent(privateKeyPath);
            if (keyContent == null || keyContent.trim().isEmpty()) {
                log.warn("读取私钥文件失败: {}", privateKeyPath);
                return ApiResponse.error("读取私钥文件失败");
            }

            // 构建上传请求体
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("domain", domain);
            requestBody.put("cert", certContent);
            requestBody.put("key", keyContent);
            requestBody.put("force_replace", true);  // 覆盖已存在的证书

            // 设置请求头
            HttpHeaders headers = apiHeaders();

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            // 调用OpenResty API上传证书
            ResponseEntity<String> response = restTemplate.exchange(
                    sslCertApiUrl(), HttpMethod.POST, entity, String.class
            );

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("SSL证书上传成功: domain={}, type={}", domain, sslCertificate.getCertificateType());
                if (reloadAfter) {
                    try { reloadNginxNoTx(); } catch (Exception ignore) { log.warn("证书上传后 reload 失败,可手动重载"); }
                }
                return ApiResponse.success();
            } else {
                log.warn("SSL证书上传失败: domain={}, response={}", domain, response.getBody());
                return ApiResponse.error("SSL证书上传失败: " + response.getBody());
            }
        } catch (Exception e) {
            log.error("SSL证书上传异常", e);
            return ApiResponse.error("SSL证书上传异常: " + e.getMessage());
        }
    }

    /**
     * 获取OpenResty中的所有证书列表
     *
     * @return 证书列表
     */
    public Map<String, Object> listAllSslCertificates() {
        Map<String, Object> result = new HashMap<>();

        try {
            HttpHeaders headers = apiHeaders();

            HttpEntity<String> entity = new HttpEntity<>("{}", headers);

            // 调用OpenResty API获取证书列表
            ResponseEntity<String> response = restTemplate.exchange(
                    sslCertApiUrl(), HttpMethod.GET, entity, String.class
            );

            if (response.getStatusCode().is2xxSuccessful()) {
                Map<String, Object> apiResponse = objectMapper.readValue(response.getBody(), Map.class);
                result.put("success", true);
                result.put("data", apiResponse);
                log.info("获取SSL证书列表成功");
            } else {
                result.put("success", false);
                result.put("message", "获取证书列表失败: " + response.getBody());
                log.error("获取SSL证书列表失败: response={}", response.getBody());
            }

        } catch (Exception e) {
            result.put("success", false);
            result.put("message", "获取证书列表异常: " + e.getMessage());
            log.error("获取SSL证书列表异常", e);
        }

        return result;
    }

    /**
     * 获取特定域名的SSL证书信息
     *
     * @param domain 域名
     * @return 证书信息
     */
    public Map<String, Object> getSslCertificateByDomain(String domain) {
        Map<String, Object> result = new HashMap<>();

        try {
            if (domain == null || domain.trim().isEmpty()) {
                result.put("success", false);
                result.put("message", "域名不能为空");
                return result;
            }

            HttpHeaders headers = apiHeaders();

            HttpEntity<String> entity = new HttpEntity<>("{}", headers);

            // 调用OpenResty API获取特定域名证书
            String apiUrl = sslCertApiUrl() + "/" + domain;
            ResponseEntity<String> response = restTemplate.exchange(
                    apiUrl, HttpMethod.GET, entity, String.class
            );

            if (response.getStatusCode().is2xxSuccessful()) {
                Map<String, Object> apiResponse = objectMapper.readValue(response.getBody(), Map.class);
                result.put("success", true);
                result.put("data", apiResponse);
                log.info("获取域名证书成功: domain={}", domain);
            } else {
                result.put("success", false);
                result.put("message", "获取证书失败: " + response.getBody());
                log.error("获取域名证书失败: domain={}, response={}", domain, response.getBody());
            }

        } catch (Exception e) {
            result.put("success", false);
            result.put("message", "获取证书异常: " + e.getMessage());
            log.error("获取域名证书异常: domain={}", domain, e);
        }

        return result;
    }

    /**
     * 删除OpenResty中的证书
     *
     * @param domain 域名
     * @return 删除结果
     */
    public Map<String, Object> deleteSslCertificate(String domain) {
        Map<String, Object> result = new HashMap<>();

        try {
            if (domain == null || domain.trim().isEmpty()) {
                result.put("success", false);
                result.put("message", "域名不能为空");
                return result;
            }

            HttpHeaders headers = apiHeaders();

            HttpEntity<String> entity = new HttpEntity<>("{}", headers);

            // 调用OpenResty API删除证书
            String apiUrl = sslCertApiUrl() + "/" + domain;
            ResponseEntity<String> response = restTemplate.exchange(
                    apiUrl, HttpMethod.DELETE, entity, String.class
            );

            if (response.getStatusCode().is2xxSuccessful()) {
                result.put("success", true);
                result.put("message", "证书删除成功");
                result.put("domain", domain);
                log.info("删除SSL证书成功: domain={}", domain);
            } else {
                result.put("success", false);
                result.put("message", "证书删除失败: " + response.getBody());
                log.error("删除SSL证书失败: domain={}, response={}", domain, response.getBody());
            }

        } catch (Exception e) {
            result.put("success", false);
            result.put("message", "证书删除异常: " + e.getMessage());
            log.error("删除SSL证书异常: domain={}", domain, e);
        }

        return result;
    }

    /**
     * 从文件路径读取内容
     *
     * @param filePath 文件路径
     * @return 文件内容
     */
    private String readFileContent(String filePath) {
        StringBuilder content = new StringBuilder();

        if (filePath == null || filePath.trim().isEmpty()) {
            return null;
        }

        try (BufferedReader reader = new BufferedReader(new FileReader(filePath))) {
            String line;
            while ((line = reader.readLine()) != null) {
                content.append(line).append("\n");
            }
            return content.toString();
        } catch (IOException e) {
            log.error("读取文件失败: {}", filePath, e);
            return null;
        }
    }

    private boolean checkApiAvailable() {
        try {
            String apiUrl = resolveApiBaseUrl() + "/test";
            HttpHeaders headers = apiHeaders();
            // GET /api/test 可能需要 token
            ResponseEntity<String> response = restTemplate.exchange(
                    apiUrl, HttpMethod.GET, new HttpEntity<String>(headers), String.class);
            return response.getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            return false;
        }
    }
}
