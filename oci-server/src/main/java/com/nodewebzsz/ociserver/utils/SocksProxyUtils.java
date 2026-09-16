package com.nodewebzsz.ociserver.utils;

import com.nodewebzsz.dao.entity.VpnProxyRecord;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.ConnectException;
import java.net.InetSocketAddress;
import java.net.NoRouteToHostException;
import java.net.Socket;
import java.net.SocketAddress;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * @version 1.2.0
 * @ClassName SocksProxyUtils
 * @Description 通用代理工具类：
 *  1. 支持完整的 SOCKS5 (RFC 1928 / RFC 1929 密码认证) 与 HTTP CONNECT 隧道探测；
 *  2. 支持通过代理隧道请求出口反射服务，实时获取代理真实公网出口 IP（Exit IP）及毫秒延时。
 * @Author nodewebzsz
 * @Date 2026-09-16
 */
@Slf4j
public class SocksProxyUtils {

    /**
     * 单次连接握手超时（毫秒）
     */
    private static final int TIMEOUT_MS = 6000;

    /**
     * TCP 连通性探测备选目标（优先 Oracle，备选全球高可用节点）
     */
    private static final String[][] TEST_TARGETS = {
            {"www.oracle.com", "443"},
            {"1.1.1.1", "443"}
    };

    /**
     * 出口 IP 反射服务清单（通过代理隧道直接 GET 纯文本 IP，避免 TLS 额外开销，轻量迅速）
     */
    private static final String[][] REFLECT_ENDPOINTS = {
            {"api.ipify.org", "80", "/"},
            {"checkip.amazonaws.com", "80", "/"},
            {"icanhazip.com", "80", "/"}
    };

    @Data
    public static class ProxyCheckResult {
        private boolean connected;
        private String message;
        private Long latencyMs;
        private String exitIp;
        private String exitLocation;

        public ProxyCheckResult(boolean connected, String message) {
            this.connected = connected;
            this.message = message;
        }

        public ProxyCheckResult(boolean connected, String message, Long latencyMs, String exitIp, String exitLocation) {
            this.connected = connected;
            this.message = message;
            this.latencyMs = latencyMs;
            this.exitIp = exitIp;
            this.exitLocation = exitLocation;
        }
    }

    /**
     * 检测代理是否可用
     */
    public static boolean isProxyAvailable(VpnProxyRecord proxyConfig) {
        ProxyCheckResult result = checkProxyWithDetail(proxyConfig);
        return result.isConnected();
    }

    /**
     * 检测代理并返回详细诊断信息（错误原因、耗时、真实出口 IP 及真实归属地）
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
                String u = (proxyUsername != null && !proxyUsername.trim().isEmpty()) ? proxyUsername.trim() : null;
                String p = (proxyPassword != null && !proxyPassword.isEmpty()) ? proxyPassword : null;
                return testHttpProxy(cleanHost, port, u, p, start);
            } else { // 默认 SOCKS5
                String u = (proxyUsername != null && !proxyUsername.trim().isEmpty()) ? proxyUsername.trim() : null;
                String p = (proxyPassword != null && !proxyPassword.isEmpty()) ? proxyPassword : null;
                return testSocks5Proxy(cleanHost, port, u, p, start);
            }
        } catch (Exception e) {
            log.warn("代理检测未捕获异常: {}:{} [{}] -> {}", cleanHost, port, type, e.getMessage());
            return new ProxyCheckResult(false, "检测异常: " + friendlyErrorMessage(e));
        }
    }

    /**
     * RFC 1928 / RFC 1929 规范标准 SOCKS5 握手（支持无认证与用户名密码认证）
     */
    private static ProxyCheckResult testSocks5Proxy(String host, int port, String username, String password, long startTime) {
        String lastError = null;

        for (String[] target : TEST_TARGETS) {
            String targetHost = target[0];
            int targetPort = Integer.parseInt(target[1]);

            try (Socket socket = new Socket()) {
                socket.connect(new InetSocketAddress(host, port), TIMEOUT_MS);
                socket.setSoTimeout(TIMEOUT_MS);
                OutputStream out = socket.getOutputStream();
                InputStream in = socket.getInputStream();

                boolean hasAuth = (username != null && !username.isEmpty());
                // 1. 发送版本与认证方法协商 (VER=0x05)
                if (hasAuth) {
                    // NMETHODS=2, 0x00(无认证), 0x02(账号密码认证)
                    out.write(new byte[]{0x05, 0x02, 0x00, 0x02});
                } else {
                    // NMETHODS=1, 0x00(无认证)
                    out.write(new byte[]{0x05, 0x01, 0x00});
                }
                out.flush();

                int ver = in.read();
                int method = in.read();
                if (ver != 0x05 || method == -1) {
                    lastError = "非合法 SOCKS5 服务端响应 (ver=" + ver + ")";
                    continue;
                }
                if (method == 0xFF) {
                    lastError = "SOCKS5 服务端拒绝认证方法（需要账号密码认证）";
                    continue;
                }

                // 2. 如果服务端选择 0x02 (RFC 1929 用户名密码子协商)
                if (method == 0x02) {
                    if (!hasAuth) {
                        lastError = "SOCKS5 服务端要求账号密码认证，但未配置账号密码";
                        break;
                    }
                    byte[] uBytes = username.getBytes(StandardCharsets.UTF_8);
                    byte[] pBytes = (password != null ? password : "").getBytes(StandardCharsets.UTF_8);

                    ByteArrayOutputStream authBuf = new ByteArrayOutputStream();
                    authBuf.write(0x01); // Subnegotiation version 1
                    authBuf.write(uBytes.length);
                    authBuf.write(uBytes);
                    authBuf.write(pBytes.length);
                    authBuf.write(pBytes);

                    out.write(authBuf.toByteArray());
                    out.flush();

                    int authVer = in.read();
                    int authStatus = in.read();
                    if (authStatus != 0x00) {
                        log.warn("SOCKS5 账号密码认证失败: {}:{} user={}", host, port, username);
                        return new ProxyCheckResult(false, "SOCKS5 账号或密码鉴权失败 (authStatus=" + authStatus + ")");
                    }
                }

                // 3. 发起 CONNECT 命令连接测试目标 (CMD=0x01, RSV=0x00, ATYP=0x03 域名)
                byte[] hostBytes = targetHost.getBytes(StandardCharsets.UTF_8);
                ByteArrayOutputStream reqBuf = new ByteArrayOutputStream();
                reqBuf.write(new byte[]{0x05, 0x01, 0x00, 0x03});
                reqBuf.write(hostBytes.length);
                reqBuf.write(hostBytes);
                reqBuf.write((targetPort >> 8) & 0xFF);
                reqBuf.write(targetPort & 0xFF);

                out.write(reqBuf.toByteArray());
                out.flush();

                int repVer = in.read();
                int repStatus = in.read();
                in.read(); // RSV
                int atyp = in.read();
                skipBndAddress(in, atyp);

                if (repVer == 0x05 && repStatus == 0x00) {
                    long latency = System.currentTimeMillis() - startTime;
                    log.info("SOCKS5 代理连通成功: {}:{} -> {}:{} ({}ms)", host, port, targetHost, targetPort, latency);

                    // 4. 连通成功后，通过代理探测真实公网出口 IP（方案 A）
                    String exitIp = resolveSocks5ExitIp(host, port, username, password);
                    String location = null;
                    if (exitIp != null) {
                        location = PingUtil.getFormattedGeoInfo(exitIp);
                    }

                    String msg = "连接成功 (" + latency + "ms)";
                    if (location != null) {
                        msg += " · 出口: " + location;
                    }
                    return new ProxyCheckResult(true, msg, latency, exitIp, location);
                } else {
                    lastError = socksErrorRepStatus(repStatus);
                }
            } catch (Exception e) {
                lastError = friendlyErrorMessage(e);
                log.debug("SOCKS5 探测目标 {}:{} 异常: {}", targetHost, targetPort, e.getMessage());
            }
        }

        log.warn("SOCKS5 代理不可用: {}:{} -> {}", host, port, lastError);
        return new ProxyCheckResult(false, "SOCKS5 代理不可用: " + (lastError != null ? lastError : "握手失败"));
    }

    /**
     * HTTP / HTTPS 代理检测（发送 CONNECT 请求，支持 Basic Auth 与真实出口 IP 反射）
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
                        .append("User-Agent: Mozilla/5.0 (OCI-Pool-ProxyChecker/1.2)\r\n")
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
                    if (response.startsWith("HTTP/1.1 200") || response.startsWith("HTTP/1.0 200")
                            || response.contains("200 Connection established") || response.contains("200 OK")) {
                        long latency = System.currentTimeMillis() - startTime;
                        log.info("HTTP 代理连通成功: {}:{} -> {}:{} ({}ms)", host, port, targetHost, targetPort, latency);

                        // 通过 HTTP 代理隧道探测真实公网出口 IP（方案 A）
                        String exitIp = resolveHttpExitIp(host, port, username, password);
                        String location = null;
                        if (exitIp != null) {
                            location = PingUtil.getFormattedGeoInfo(exitIp);
                        }

                        String msg = "连接成功 (" + latency + "ms)";
                        if (location != null) {
                            msg += " · 出口: " + location;
                        }
                        return new ProxyCheckResult(true, msg, latency, exitIp, location);
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

    /**
     * 通过 SOCKS5 代理隧道请求反射服务获取真实出口 IP
     */
    private static String resolveSocks5ExitIp(String host, int port, String username, String password) {
        for (String[] ep : REFLECT_ENDPOINTS) {
            String reflectHost = ep[0];
            int reflectPort = Integer.parseInt(ep[1]);
            String reflectPath = ep[2];

            try (Socket socket = new Socket()) {
                socket.connect(new InetSocketAddress(host, port), TIMEOUT_MS);
                socket.setSoTimeout(TIMEOUT_MS);
                OutputStream out = socket.getOutputStream();
                InputStream in = socket.getInputStream();

                // SOCKS5 握手
                boolean hasAuth = (username != null && !username.isEmpty());
                if (hasAuth) {
                    out.write(new byte[]{0x05, 0x02, 0x00, 0x02});
                } else {
                    out.write(new byte[]{0x05, 0x01, 0x00});
                }
                out.flush();

                int ver = in.read();
                int method = in.read();
                if (method == 0x02 && hasAuth) {
                    byte[] uBytes = username.getBytes(StandardCharsets.UTF_8);
                    byte[] pBytes = (password != null ? password : "").getBytes(StandardCharsets.UTF_8);
                    ByteArrayOutputStream authBuf = new ByteArrayOutputStream();
                    authBuf.write(0x01);
                    authBuf.write(uBytes.length);
                    authBuf.write(uBytes);
                    authBuf.write(pBytes.length);
                    authBuf.write(pBytes);
                    out.write(authBuf.toByteArray());
                    out.flush();
                    in.read(); // authVer
                    if (in.read() != 0x00) return null;
                }

                // CONNECT 到反射服务 80 端口
                byte[] hostBytes = reflectHost.getBytes(StandardCharsets.UTF_8);
                ByteArrayOutputStream reqBuf = new ByteArrayOutputStream();
                reqBuf.write(new byte[]{0x05, 0x01, 0x00, 0x03});
                reqBuf.write(hostBytes.length);
                reqBuf.write(hostBytes);
                reqBuf.write((reflectPort >> 8) & 0xFF);
                reqBuf.write(reflectPort & 0xFF);
                out.write(reqBuf.toByteArray());
                out.flush();

                int repVer = in.read();
                int repStatus = in.read();
                in.read(); // rsv
                int atyp = in.read();
                skipBndAddress(in, atyp);

                if (repVer == 0x05 && repStatus == 0x00) {
                    // 发送轻量 HTTP GET 请求获取出口 IP
                    String getReq = "GET " + reflectPath + " HTTP/1.1\r\n"
                            + "Host: " + reflectHost + "\r\n"
                            + "User-Agent: curl/7.88.1\r\n"
                            + "Accept: */*\r\n"
                            + "Connection: close\r\n\r\n";
                    out.write(getReq.getBytes(StandardCharsets.UTF_8));
                    out.flush();

                    String ip = parseIpFromHttpResponse(in);
                    if (ip != null) {
                        log.info("SOCKS5 代理真实出口 IP 识别成功: {}:{} -> exitIp={}", host, port, ip);
                        return ip;
                    }
                }
            } catch (Exception e) {
                log.debug("SOCKS5 获取出口 IP 尝试失败 endpoint={}: {}", reflectHost, e.getMessage());
            }
        }
        return null;
    }

    /**
     * 通过 HTTP 代理隧道请求反射服务获取真实出口 IP
     */
    private static String resolveHttpExitIp(String host, int port, String username, String password) {
        for (String[] ep : REFLECT_ENDPOINTS) {
            String reflectHost = ep[0];
            int reflectPort = Integer.parseInt(ep[1]);
            String reflectPath = ep[2];

            try (Socket socket = new Socket()) {
                socket.connect(new InetSocketAddress(host, port), TIMEOUT_MS);
                socket.setSoTimeout(TIMEOUT_MS);
                OutputStream out = socket.getOutputStream();

                // 发送 HTTP 代理请求 (GET http://host:port/path)
                StringBuilder httpReq = new StringBuilder();
                httpReq.append("GET http://").append(reflectHost).append(":").append(reflectPort).append(reflectPath).append(" HTTP/1.1\r\n")
                        .append("Host: ").append(reflectHost).append("\r\n")
                        .append("User-Agent: curl/7.88.1\r\n")
                        .append("Accept: */*\r\n");

                if (username != null && !username.isEmpty() && password != null && !password.isEmpty()) {
                    String auth = username + ":" + password;
                    String encoded = Base64.getEncoder().encodeToString(auth.getBytes(StandardCharsets.UTF_8));
                    httpReq.append("Proxy-Authorization: Basic ").append(encoded).append("\r\n");
                }
                httpReq.append("Connection: close\r\n\r\n");

                out.write(httpReq.toString().getBytes(StandardCharsets.UTF_8));
                out.flush();

                String ip = parseIpFromHttpResponse(socket.getInputStream());
                if (ip != null) {
                    log.info("HTTP 代理真实出口 IP 识别成功: {}:{} -> exitIp={}", host, port, ip);
                    return ip;
                }
            } catch (Exception e) {
                log.debug("HTTP 获取出口 IP 尝试失败 endpoint={}: {}", reflectHost, e.getMessage());
            }
        }
        return null;
    }

    private static String parseIpFromHttpResponse(InputStream in) throws IOException {
        BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8));
        String line;
        boolean inBody = false;
        while ((line = reader.readLine()) != null) {
            if (!inBody) {
                if (line.trim().isEmpty()) {
                    inBody = true;
                }
                continue;
            }
            String candidate = line.trim();
            // 匹配 IPv4 格式
            if (candidate.matches("^([0-9]{1,3}\\.){3}[0-9]{1,3}$")) {
                return candidate;
            }
            // 匹配 JSON {"ip":"..."}
            if (candidate.contains("\"ip\"")) {
                int start = candidate.indexOf("\"ip\":") + 5;
                String sub = candidate.substring(start).replaceAll("[\"}\\s]", "");
                if (sub.matches("^([0-9]{1,3}\\.){3}[0-9]{1,3}$")) {
                    return sub;
                }
            }
        }
        return null;
    }

    private static void skipBndAddress(InputStream in, int atyp) throws IOException {
        if (atyp == 0x01) { // IPv4 (4 bytes) + port (2 bytes)
            in.skip(6);
        } else if (atyp == 0x03) { // Domain name (1 length byte + N bytes) + port (2 bytes)
            int len = in.read();
            if (len > 0) in.skip(len);
            in.skip(2);
        } else if (atyp == 0x04) { // IPv6 (16 bytes) + port (2 bytes)
            in.skip(18);
        }
    }

    private static String socksErrorRepStatus(int status) {
        switch (status) {
            case 0x01: return "SOCKS5 服务端常规错误 (General failure)";
            case 0x02: return "连接被规则集拒绝 (Connection not allowed)";
            case 0x03: return "网络不可达 (Network unreachable)";
            case 0x04: return "主机不可达 (Host unreachable)";
            case 0x05: return "连接被目标主机拒绝 (Connection refused)";
            case 0x06: return "TTL 超时 (TTL expired)";
            case 0x07: return "不支持的命令 (Command not supported)";
            case 0x08: return "不支持的地址类型 (Address type not supported)";
            default: return "SOCKS5 握手拒绝 (status=" + status + ")";
        }
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
            return "连接或握手超时 (" + (TIMEOUT_MS / 1000) + "s)";
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
