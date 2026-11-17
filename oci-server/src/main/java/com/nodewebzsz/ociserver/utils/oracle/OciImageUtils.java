package com.nodewebzsz.ociserver.utils.oracle;

import com.alibaba.fastjson2.JSON;
import com.nodewebzsz.dao.entity.Tenant;
import com.nodewebzsz.ocicommon.enums.CloudTypeEnum;
import com.nodewebzsz.ociserver.pojo.enums.ArchitectureEnum;
import com.nodewebzsz.ociserver.pojo.response.ImageInfoRes;
import com.oracle.bmc.ClientConfiguration;
import com.oracle.bmc.auth.SimpleAuthenticationDetailsProvider;
import com.oracle.bmc.core.ComputeClient;
import com.oracle.bmc.core.model.Image;
import com.oracle.bmc.core.requests.ListImagesRequest;
import com.oracle.bmc.core.responses.ListImagesResponse;
import com.oracle.bmc.model.BmcException;
import com.oracle.bmc.retrier.RetryConfiguration;
import com.oracle.bmc.waiter.FixedTimeDelayStrategy;
import com.oracle.bmc.waiter.MaxAttemptsTerminationStrategy;
import lombok.extern.slf4j.Slf4j;

import javax.net.ssl.SSLException;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import com.nodewebzsz.ociserver.config.ProxyContext;

/**
 * @version 1.0.0
 * @ClassName OciImageUtils
 * @Description TODO
 * @Author nodewebzsz
 * @Date 2025-10-29 03:46
 */
@Slf4j
public class OciImageUtils {

    /**
     * 镜像列表用于表单联动，需要快速返回：限制单次超时与重试次数，避免 SDK 默认重试拖到数分钟。
     */
    private static final ClientConfiguration IMAGE_CLIENT_CONFIG = ClientConfiguration.builder()
            .connectionTimeoutMillis(10_000)
            .readTimeoutMillis(25_000)
            .retryConfiguration(RetryConfiguration.builder()
                    .terminationStrategy(new MaxAttemptsTerminationStrategy(2))
                    .delayStrategy(new FixedTimeDelayStrategy(1_000))
                    .build())
            .build();

    /**
     * 获取镜像系统列表（仅 Oracle Linux / Ubuntu / CentOS）
     *
     * @throws IllegalStateException 查询失败时抛出，消息可直接展示给用户
     */
    public static List<ImageInfoRes> listSupportedLinuxImages(Tenant tenant) {
        SimpleAuthenticationDetailsProvider provider = OciUtils.getProvider(tenant);
        List<ImageInfoRes> result = new ArrayList<>();

        try (ComputeClient computeClient = ComputeClient.builder()
                .configuration(IMAGE_CLIENT_CONFIG)
                .clientConfigurator(ProxyContext.get())
                .build(provider)) {
            ListImagesResponse response = computeClient.listImages(
                    ListImagesRequest.builder()
                            .compartmentId(provider.getTenantId())
                            .sortBy(ListImagesRequest.SortBy.Displayname)
                            .sortOrder(ListImagesRequest.SortOrder.Asc)
                            .build()
            );

            Map<String, ImageInfoRes> map = new HashMap<>();

            for (Image img : response.getItems()) {
                if (img.getOperatingSystem() == null || img.getOperatingSystemVersion() == null) continue;
                log.debug("Image: {}", JSON.toJSONString( img));

                String os = img.getOperatingSystem().trim();
                String version = img.getOperatingSystemVersion();
                String display = Optional.ofNullable(img.getDisplayName()).orElse("").toLowerCase();

                // 只保留 Oracle Linux / Ubuntu / CentOS
                if (!isAllowedOs(os)) {
                    continue;
                }

                // 判断架构
                String arch;
                if (display.contains("aarch64") || display.contains("ampere")) {
                    arch = "ARM";
                } else {
                    arch = "AMD";
                }


                boolean free = isAlwaysFreeImage(os, version, arch);
                String key = os + "_" + version + "_" + arch;

                if (!map.containsKey(key)) {
                    ImageInfoRes info = new ImageInfoRes();
                    info.setImageId(img.getId());
                    info.setOperatingSystem(os);
                    info.setOperatingSystemVersion(version);
                    info.setArchitecture(arch);
                    info.setAlwaysFreeEligible(free);
                    info.setCloudType(CloudTypeEnum.ORACLE_CLOUD.getType());
                    map.put(key, info);
                }
            }

            result.addAll(map.values().stream()
                    .sorted(Comparator.comparing(ImageInfoRes::getOperatingSystem)
                            .thenComparing(ImageInfoRes::getOperatingSystemVersion))
                    .collect(Collectors.toList()));

        } catch (Exception e) {
            log.error("获取镜像系统列表失败: {}", e.getMessage(), e);
            throw new IllegalStateException(describeFailure(e), e);
        }

        return result;
    }

    private static String describeFailure(Throwable error) {
        boolean viaProxy = ProxyContext.get() != null;
        String subject = viaProxy ? "代理服务器" : "OCI 服务端";
        for (Throwable t = error; t != null; t = t.getCause()) {
            String message = t.getMessage() == null ? "" : t.getMessage();
            if (t instanceof SSLException && message.contains("Unsupported or unrecognized SSL message")) {
                return "获取镜像失败：与代理的 TLS 握手异常，请确认代理类型（HTTP / SOCKS5）配置正确";
            }
            if (message.contains("407") || message.toLowerCase().contains("proxy authentication")
                    || message.contains("认证失败")) {
                return "获取镜像失败：代理认证失败，请检查代理用户名和密码";
            }
            if (message.contains("SOCKS5")) {
                return "获取镜像失败：" + message;
            }
            if (t instanceof SocketTimeoutException) {
                return "获取镜像失败：连接" + subject + "超时，请检查" + (viaProxy ? "代理可用性或更换代理" : "网络连接") + "后重试";
            }
            if (t instanceof ConnectException) {
                return "获取镜像失败：无法连接" + subject + "，请检查" + (viaProxy ? "代理地址与端口" : "网络连接");
            }
            if (t instanceof UnknownHostException) {
                return "获取镜像失败：" + subject + "地址无法解析，请检查" + (viaProxy ? "代理主机名" : "网络 DNS");
            }
            if (t instanceof BmcException && !((BmcException) t).isClientSide()) {
                BmcException bmc = (BmcException) t;
                return "获取镜像失败：OCI 返回 " + bmc.getStatusCode() + " " + bmc.getServiceCode();
            }
        }
        String message = error.getMessage();
        return "获取镜像失败：" + (message == null || message.isEmpty() ? error.getClass().getSimpleName() : message);
    }

    /**
     *  白名单
     */
    private static boolean isAllowedOs(String os) {
        String lower = os.toLowerCase();
        return lower.contains("oracle linux") ||
                lower.contains("ubuntu") ||
                lower.contains("centos");
    }

    /**
     *  判断是否 Always Free
     */
    private static boolean isAlwaysFreeImage(String os, String version, String arch) {
        //todo 为了以后扩展,暂时都是免费
        return true;
    }

    /**
     * 根据 Shape 自动筛选对应的镜像（ARM / AMD）
     * @param tenant 当前租户
     * @param shapeType 当前 Shape，例如 VM.Standard.A1.Flex
     * @return 对应的镜像列表（已自动匹配架构）
     */
    public static List<ImageInfoRes> listImagesByShape(Tenant tenant, String shapeType) {
        // 根据 shape 获取枚举
        ArchitectureEnum archEnum = ArchitectureEnum.getType(shapeType);
        if (archEnum == null) {
            log.warn("未找到对应的架构类型: {}", shapeType);
            return Collections.emptyList();
        }

        String archType = archEnum.getBackUpName(); // ARM 或 AMD

        // 拿到所有镜像
        List<ImageInfoRes> allImages = listSupportedLinuxImages(tenant);

        // 根据 Shape 的架构过滤
        return allImages.stream()
                .filter(img -> archType.equalsIgnoreCase(img.getArchitecture()))
                .sorted(Comparator.comparing(ImageInfoRes::getOperatingSystem)
                        .thenComparing(ImageInfoRes::getOperatingSystemVersion))
                .collect(Collectors.toList());
    }

}
