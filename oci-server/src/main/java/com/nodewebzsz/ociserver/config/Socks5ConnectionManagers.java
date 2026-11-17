package com.nodewebzsz.ociserver.config;

import org.apache.http.HttpHost;
import org.apache.http.config.Registry;
import org.apache.http.config.RegistryBuilder;
import org.apache.http.conn.DnsResolver;
import org.apache.http.conn.HttpClientConnectionManager;
import org.apache.http.conn.socket.ConnectionSocketFactory;
import org.apache.http.conn.ssl.SSLConnectionSocketFactory;
import org.apache.http.impl.conn.PoolingHttpClientConnectionManager;
import org.apache.http.protocol.HttpContext;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * 为 OCI SDK（Jersey ApacheConnector）提供 SOCKS5 出口。
 * <p>
 * ApacheConnector 的 {@code PROXY_URI} 只支持 HTTP CONNECT，因此 SOCKS5 通过自定义连接管理器实现：
 * 先与代理完成 RFC 1928 / RFC 1929 握手，目标域名交给代理端解析（等同 socks5h，避免本地 DNS 泄漏），
 * 隧道建立后再在其上叠加 TLS。连接管理器按代理配置缓存复用，并标记为共享，避免客户端关闭时被销毁。
 */
public final class Socks5ConnectionManagers {

    private static final int HANDSHAKE_TIMEOUT_MS = 10_000;
    private static final Map<String, PoolingHttpClientConnectionManager> MANAGERS = new ConcurrentHashMap<>();

    private Socks5ConnectionManagers() {
    }

    public static HttpClientConnectionManager get(String host, int port, String username, String password) {
        String key = host + ":" + port + "|" + (username == null ? "" : username) + "|"
                + Objects.hashCode(password);
        return MANAGERS.computeIfAbsent(key, k -> create(host, port, username, password));
    }

    private static PoolingHttpClientConnectionManager create(String host, int port, String username, String password) {
        Socks5Tunnel tunnel = new Socks5Tunnel(host, port, username, password);
        SSLConnectionSocketFactory ssl = SSLConnectionSocketFactory.getSocketFactory();
        Registry<ConnectionSocketFactory> registry = RegistryBuilder.<ConnectionSocketFactory>create()
                .register("http", new PlainSocksFactory(tunnel))
                .register("https", new SslSocksFactory(tunnel, ssl))
                .build();
        PoolingHttpClientConnectionManager manager = new PoolingHttpClientConnectionManager(
                registry, null, null, new RemoteDnsResolver(), 60, TimeUnit.SECONDS);
        manager.setMaxTotal(50);
        manager.setDefaultMaxPerRoute(20);
        return manager;
    }

    /** 目标域名由代理端解析，本地只返回占位地址。 */
    private static final class RemoteDnsResolver implements DnsResolver {
        @Override
        public InetAddress[] resolve(String host) throws java.net.UnknownHostException {
            return new InetAddress[]{InetAddress.getByAddress(host, new byte[]{0, 0, 0, 0})};
        }
    }

    private static final class PlainSocksFactory implements ConnectionSocketFactory {
        private final Socks5Tunnel tunnel;

        PlainSocksFactory(Socks5Tunnel tunnel) {
            this.tunnel = tunnel;
        }

        @Override
        public Socket createSocket(HttpContext context) {
            return new Socket();
        }

        @Override
        public Socket connectSocket(int connectTimeout, Socket socket, HttpHost host, InetSocketAddress remoteAddress,
                                    InetSocketAddress localAddress, HttpContext context) throws IOException {
            Socket sock = socket != null ? socket : new Socket();
            tunnel.open(sock, connectTimeout, host.getHostName(), remoteAddress.getPort());
            return sock;
        }
    }

    private static final class SslSocksFactory implements ConnectionSocketFactory {
        private final Socks5Tunnel tunnel;
        private final SSLConnectionSocketFactory ssl;

        SslSocksFactory(Socks5Tunnel tunnel, SSLConnectionSocketFactory ssl) {
            this.tunnel = tunnel;
            this.ssl = ssl;
        }

        @Override
        public Socket createSocket(HttpContext context) {
            return new Socket();
        }

        @Override
        public Socket connectSocket(int connectTimeout, Socket socket, HttpHost host, InetSocketAddress remoteAddress,
                                    InetSocketAddress localAddress, HttpContext context) throws IOException {
            Socket sock = socket != null ? socket : new Socket();
            tunnel.open(sock, connectTimeout, host.getHostName(), remoteAddress.getPort());
            return ssl.createLayeredSocket(sock, host.getHostName(), remoteAddress.getPort(), context);
        }
    }

    private static final class Socks5Tunnel {
        private final String proxyHost;
        private final int proxyPort;
        private final String username;
        private final String password;

        Socks5Tunnel(String proxyHost, int proxyPort, String username, String password) {
            this.proxyHost = proxyHost;
            this.proxyPort = proxyPort;
            this.username = username;
            this.password = password;
        }

        void open(Socket sock, int connectTimeout, String targetHost, int targetPort) throws IOException {
            int timeout = connectTimeout > 0 ? connectTimeout : HANDSHAKE_TIMEOUT_MS;
            int originalSoTimeout = sock.getSoTimeout();
            sock.connect(new InetSocketAddress(proxyHost, proxyPort), timeout);
            sock.setSoTimeout(HANDSHAKE_TIMEOUT_MS);
            try {
                handshake(sock.getInputStream(), sock.getOutputStream(), targetHost, targetPort);
            } catch (IOException e) {
                sock.close();
                throw e;
            }
            sock.setSoTimeout(originalSoTimeout);
        }

        private void handshake(InputStream in, OutputStream out, String targetHost, int targetPort) throws IOException {
            boolean hasAuth = username != null && !username.isEmpty();
            out.write(hasAuth ? new byte[]{0x05, 0x02, 0x00, 0x02} : new byte[]{0x05, 0x01, 0x00});
            out.flush();

            int ver = readByte(in);
            int method = readByte(in);
            if (ver != 0x05) {
                throw new IOException("SOCKS5 代理返回了非法响应 (ver=" + ver + ")");
            }
            if (method == 0xFF) {
                throw new IOException("SOCKS5 代理拒绝了认证方式，请检查账号密码配置");
            }
            if (method == 0x02) {
                if (!hasAuth) {
                    throw new IOException("SOCKS5 代理要求账号密码认证，但未配置账号密码");
                }
                byte[] user = username.getBytes(StandardCharsets.UTF_8);
                byte[] pass = (password == null ? "" : password).getBytes(StandardCharsets.UTF_8);
                ByteArrayOutputStream auth = new ByteArrayOutputStream();
                auth.write(0x01);
                auth.write(user.length);
                auth.write(user);
                auth.write(pass.length);
                auth.write(pass);
                out.write(auth.toByteArray());
                out.flush();
                readByte(in);
                if (readByte(in) != 0x00) {
                    throw new IOException("SOCKS5 代理认证失败：用户名或密码不正确");
                }
            } else if (method != 0x00) {
                throw new IOException("SOCKS5 代理选择了不支持的认证方式 (method=" + method + ")");
            }

            byte[] hostBytes = targetHost.getBytes(StandardCharsets.UTF_8);
            ByteArrayOutputStream req = new ByteArrayOutputStream();
            req.write(new byte[]{0x05, 0x01, 0x00, 0x03});
            req.write(hostBytes.length);
            req.write(hostBytes);
            req.write((targetPort >> 8) & 0xFF);
            req.write(targetPort & 0xFF);
            out.write(req.toByteArray());
            out.flush();

            readByte(in);
            int rep = readByte(in);
            readByte(in);
            int atyp = readByte(in);
            skipBoundAddress(in, atyp);
            if (rep != 0x00) {
                throw new IOException("SOCKS5 代理无法连接目标 " + targetHost + ":" + targetPort + " (rep=" + rep + ")");
            }
        }

        private static void skipBoundAddress(InputStream in, int atyp) throws IOException {
            int len;
            if (atyp == 0x01) {
                len = 4;
            } else if (atyp == 0x04) {
                len = 16;
            } else if (atyp == 0x03) {
                len = readByte(in);
            } else {
                throw new IOException("SOCKS5 代理返回了未知地址类型 (atyp=" + atyp + ")");
            }
            for (int i = 0; i < len + 2; i++) {
                readByte(in);
            }
        }

        private static int readByte(InputStream in) throws IOException {
            int value = in.read();
            if (value < 0) {
                throw new IOException("SOCKS5 代理提前关闭了连接");
            }
            return value;
        }
    }
}
