package com.nodewebzsz.ociserver.utils;

import com.nodewebzsz.dao.entity.VpnProxyRecord;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;
import java.io.OutputStream;
import java.net.ConnectException;
import java.net.InetSocketAddress;
import java.net.NoRouteToHostException;
import java.net.Proxy;
import java.net.Socket;
import java.net.SocketAddress;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * @version 1.1.0
 * @ClassName SocksProxyUtils
 * @Description 通用代理工具类，支持检测 SOCKS5 / HTTP 代理连通性，提供多目标fallback与详细诊断
 * @Author nodewebzsz
 * @Date 2026-09-16
 */
@Slf4j
public class SocksProxyUtils {

    /**
     * 单目标连接超时（毫秒），原为 3000ms，放宽至 5000ms 提高跨国代理容错
     */
    private static final int TIMEOUT_MS = 5000;

    /**
     * 探测目标：优先 Oracle 官方网关，若失败则回退 Cloudflare 稳定公网网关 (1.1.1.1)
     */
    private static final String[][] TEST_TARGETS = {
            {"www.oracle.com", "443"},
            {"1.1.1.1", "443"}
    };

    @Data
    public static class ProxyCheckResult {
        private boolean connected;
        private String message;
        private Long latencyMs;

        public ProxyCheckResult(boolean connected, String message) {
            this.connected = connected;
            this.message = message;
        }

        public ProxyCheckResult(boolean connected, String message, Long latencyMs) {
            this.connected = connected;
            this.message = message;
            this.latencyMs = latencyMs;
        }
    }

    /**
     * 检测代理是否可用
     * 自动识别 SOCKS5 / HTTP
     *
     * @return 是否可用
     */
    public static boolean isProxyAvailable(VpnProxyRecord proxyConfig) {
        ProxyCheckResult result = checkProxyWithDetail(proxyConfig);
        return result.isConnected();
    }

    /**
     * 检测代理并返回详细诊断信息（错误原因/耗时）
     */
    public static ProxyCheckResult checkProxyWithDetail(VpnProxyRecord proxyConfig) {
        if (proxyConfig == null) {
            return new ProxyCheckResult(false, "代理配置为空");
        }
        final String host = proxyConfig.getProxyHost();
        final Integer port = proxyConfig.getProxyPort();
        final String type = proxyConfig.getProxyType();
        final String proxyUsername = proxyConfig.getProxyUsername();
        final String proxyPassword = proxyConfig.getProxyPassword();

        if (host == null || host.trim().isEmpty() || port == null || port <= 0 || port > 65535) {
            log.warn("代理参数无效: host={}, port={}", host, port);
            return new ProxyCheckResult(false, "代理主机或端口无效 (" + host + ":" + port + ")");
        }

        final String cleanHost = host.trim();
        long start = System.currentTimeMillis();

        try {
            if ("HTTP".equalsIgnoreCase(type) || "HTTPS".equalsIgnoreCase(type)) {
                if (proxyUsername != null && !proxyUsername.trim().isEmpty() && proxyPassword != null && !proxyPassword.isEmpty()) {
                    return testHttpProxy(cleanHost, port, proxyUsername.trim(), proxyPassword, start);
                } else {
                    return testHttpProxy(cleanHost, port, null, null, start);
                }
            } else { // 默认 SOCKS5
                return testSocksProxy(cleanHost, port, start);
            }
        } catch (Exception e) {
            log.warn("代理检测未捕获异常: {}:{} [{}] -> {}", cleanHost, port, type, e.getMessage());
            return new ProxyCheckResult(false, "检测异常: " + friendlyErrorMessage(e));
        }
    }

    /**
     * 检测 SOCKS5 代理是否可用（支持双目标 fallback）
     */
    private static ProxyCheckResult testSocksProxy(String host, int port, long startTime) {
        String lastError = null;

        for (String[] target : TEST_TARGETS) {
            String targetHost = target[0];
            int targetPort = Integer.parseInt(target[1]);
            Proxy proxy = new Proxy(Proxy.Type.SOCKS, new InetSocketAddress(host, port));

            try (Socket socket = new Socket(proxy)) {
                socket.connect(new InetSocketAddress(targetHost, targetPort), TIMEOUT_MS);
                long latency = System.currentTimeMillis() - startTime;
                log.info("SOCKS5 代理可用: {}:{} -> {}:{} (耗时: {}ms)", host, port, targetHost, targetPort, latency);
                return new ProxyCheckResult(true, "连接成功 (" + latency + "ms)", latency);
            } catch (Exception e) {
                lastError = friendlyErrorMessage(e);
                log.debug("SOCKS5 代理探测目标 {}:{} 失败: {}:{} -> {}", targetHost, targetPort, host, port, e.getMessage());
            }
        }

        log.warn("SOCKS5 代理不可用: {}:{} -> {}", host, port, lastError);
        return new ProxyCheckResult(false, "SOCKS5 代理不可用: " + (lastError != null ? lastError : "握手失败"));
    }

    /**
     * 检测 HTTP 代理是否可用（发送 CONNECT 请求，支持 Basic Auth 与双目标 fallback）
     */
    private static ProxyCheckResult testHttpProxy(String host, int port, String username, String password, long startTime) {
        String lastError = null;

        for (String[] target : TEST_TARGETS) {
            String targetHost = target[0];
            int targetPort = Integer.parseInt(target[1]);
            SocketAddress addr = new InetSocketAddress(host, port);

            try (Socket socket = new Socket()) {
                socket.connect(addr, TIMEOUT_MS);
                socket.setSoTimeout(TIMEOUT_MS);

                StringBuilder connectCmd = new StringBuilder();
                connectCmd.append("CONNECT ").append(targetHost).append(":").append(targetPort).append(" HTTP/1.1\r\n")
                        .append("Host: ").append(targetHost).append(":").append(targetPort).append("\r\n")
                        .append("User-Agent: Mozilla/5.0 (OCI-Pool-ProxyChecker/1.1)\r\n")
                        .append("Proxy-Connection: Keep-Alive\r\n");

                if (username != null && !username.isEmpty() && password != null && !password.isEmpty()) {
                    String auth = username + ":" + password;
                    String encodedAuth = Base64.getEncoder().encodeToString(auth.getBytes(StandardCharsets.UTF_8));
                    connectCmd.append("Proxy-Authorization: Basic ").append(encodedAuth).append("\r\n");
                }
                connectCmd.append("\r\n");

                OutputStream out = socket.getOutputStream();
                out.write(connectCmd.toString().getBytes(StandardCharsets.UTF_8));
                out.flush();

                byte[] buffer = new byte[512];
                int read = socket.getInputStream().read(buffer);

                if (read > 0) {
                    String response = new String(buffer, 0, read, StandardCharsets.UTF_8);
                    if (response.startsWith("HTTP/1.1 200") || response.startsWith("HTTP/1.0 200") || response.contains("200 Connection established") || response.contains("200 OK")) {
                        long latency = System.currentTimeMillis() - startTime;
                        log.info("HTTP 代理可用: {}:{} -> {}:{} (耗时: {}ms)", host, port, targetHost, targetPort, latency);
                        return new ProxyCheckResult(true, "连接成功 (" + latency + "ms)", latency);
                    } else if (response.contains("407")) {
                        log.warn("HTTP 代理鉴权失败(407 Proxy Authentication Required): {}:{}", host, port);
                        return new ProxyCheckResult(false, "代理账号或密码鉴权失败 (HTTP 407)");
                    } else if (response.contains("403")) {
                        lastError = "代理拒绝访问目标 (HTTP 403)";
                    } else if (response.contains("502") || response.contains("504")) {
                        lastError = "代理网关错误/远端超时 (HTTP " + (response.contains("502") ? "502" : "504") + ")";
                    } else {
                        String firstLine = response.split("\r\n")[0];
                        lastError = "响应异常: " + (firstLine.length() > 30 ? firstLine.substring(0, 30) + "..." : firstLine);
                    }
                } else {
                    lastError = "代理端关闭了连接，未返回响应";
                }
            } catch (Exception e) {
                lastError = friendlyErrorMessage(e);
                log.debug("HTTP 代理探测目标 {}:{} 失败: {}:{} -> {}", targetHost, targetPort, host, port, e.getMessage());
            }
        }

        log.warn("HTTP 代理不可用: {}:{} -> {}", host, port, lastError);
        return new ProxyCheckResult(false, "HTTP 代理不可用: " + (lastError != null ? lastError : "无法连通"));
    }

    private static String friendlyErrorMessage(Exception e) {
        if (e instanceof ConnectException) {
            String msg = e.getMessage() != null ? e.getMessage().toLowerCase() : "";
            if (msg.contains("refused")) {
                return "连接被拒绝（请确认代理工具已启动且端口正确）";
            }
            return "无法连接代理服务器: " + e.getMessage();
        }
        if (e instanceof SocketTimeoutException) {
            return "连接或握手超时 (5s)";
        }
        if (e instanceof UnknownHostException) {
            return "代理主机域名无法解析: " + e.getMessage();
        }
        if (e instanceof NoRouteToHostException) {
            return "网络不可达 (No route to host)";
        }
        if (e instanceof IOException) {
            String msg = e.getMessage();
            if (msg != null && msg.contains("SOCKS server general failure")) {
                return "SOCKS5 代理服务端内部错误";
            }
            if (msg != null && msg.contains("Connection not allowed by ruleset")) {
                return "SOCKS5 规则拒绝连接目标";
            }
            if (msg != null && (msg.contains("Network unreachable") || msg.contains("Host unreachable"))) {
                return "目标地址不可达";
            }
            return e.getMessage() != null ? e.getMessage() : "IO 错误";
        }
        return e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
    }
}
