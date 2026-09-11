package com.doubledimple.ociserver.utils.oracle;

import com.doubledimple.dao.entity.Tenant;
import com.doubledimple.ocicommon.utils.DateTimeUtils;
import com.doubledimple.ociserver.config.ProxyContext;
import com.doubledimple.ociserver.pojo.dto.OciAuditEventDto;
import com.doubledimple.ociserver.pojo.dto.OciPageResult;
import com.oracle.bmc.audit.AuditClient;
import com.oracle.bmc.audit.model.AuditEvent;
import com.oracle.bmc.audit.requests.ListEventsRequest;
import com.oracle.bmc.audit.responses.ListEventsResponse;
import com.oracle.bmc.auth.SimpleAuthenticationDetailsProvider;
import com.oracle.bmc.model.BmcException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import static com.doubledimple.ociserver.utils.PingUtil.getGeoInfoByIP;
import static com.doubledimple.ociserver.utils.PingUtil.isPrivateIP;

/**
 * @author nodewebzsz
 * @description 查询租户的审计日志（Audit Events）
 * @date 2025/10/31
 */
@Slf4j
@Service
public class AuditLogUtils {


    /**
     * 查询租户在指定时间范围内的审计日志（单页，不循环）
     *
     * @param tenant 租户信息
     * @param startTime ISO8601 格式，如 "2025-10-01T00:00:00Z"
     * @param endTime ISO8601 格式，如 "2025-10-31T23:59:59Z"
     * @param pageToken 分页页码，可为空（从第一页开始）
     * @return 审计事件简化列表 + 下一页 Token
     */
    public OciPageResult<OciAuditEventDto> listAuditEvents(
            Tenant tenant, String startTime, String endTime, String pageToken) {

        SimpleAuthenticationDetailsProvider provider = OciUtils.getProvider(tenant);
        List<OciAuditEventDto> results = new ArrayList<>();
        String nextPage = null;

        try (AuditClient auditClient = AuditClient.builder()
                .clientConfigurator(ProxyContext.get()).build(provider)) {
            String compartmentId = provider.getTenantId();
            ListEventsRequest.Builder builder = ListEventsRequest.builder()
                    .compartmentId(compartmentId)
                    .startTime(Date.from(Instant.parse(startTime)))
                    .endTime(Date.from(Instant.parse(endTime)));

            if (pageToken != null && !pageToken.isEmpty()) {
                builder.page(pageToken);
            }

            ListEventsResponse response = auditClient.listEvents(builder.build());
            nextPage = response.getOpcNextPage();

            for (AuditEvent event : response.getItems()) {
                if (event.getData() != null && event.getData().getIdentity() != null) {
                    String userName = event.getData().getIdentity().getPrincipalName();
                    if (userName != null && userName.length() > 35) {
                        userName = userName.substring(0, 35) + "...";
                    }

                    String userType = event.getData().getIdentity().getAuthType();
                    // 控制台会话 ID：非空 = 控制台登录，为空 = API/SDK 调用。
                    // 注意 authType 无公开枚举，不能用作判据，见 OciAuditEventDto#consoleSessionId。
                    String consoleSessionId = event.getData().getIdentity().getConsoleSessionId();
                    String ipAddress = event.getData().getIdentity().getIpAddress();

                    // 拼接 IP + 地址信息
                    String resolvedIpInfo = resolveMultiIpLocation(ipAddress);

                    String clientEnv = event.getData().getIdentity().getUserAgent();
                    // 列主值取短名（eventName，如 LaunchInstance）；完整类型（eventType，
                    // 如 com.oraclecloud.ComputeApi.LaunchInstance）留给 hover 排查。
                    String eventName = event.getData().getEventName();
                    String eventFullType = event.getEventType();
                    String eventType = (eventName != null && !eventName.isEmpty())
                            ? eventName
                            : eventFullType;
                    String eventTime = event.getEventTime() != null
                            ? DateTimeUtils.formatDate(event.getEventTime())
                            : "-";
                    String responseStatus = (event.getData().getResponse() != null)
                            ? event.getData().getResponse().getStatus()
                            : "-";

                    results.add(OciAuditEventDto.builder()
                            .eventType(eventType)
                            .eventFullType(eventFullType)
                            .userName(userName)
                            .userType(userType)
                            .consoleSessionId(consoleSessionId)
                            .ipAddress(resolvedIpInfo)
                            .clientEnv(clientEnv)
                            .eventTime(eventTime)
                            .responseStatus(responseStatus)
                            .build());
                }
            }

            log.debug("租户 [{}] 审计日志获取成功，共 {} 条，下一页：{}",
                    tenant.getUserName(), results.size(), nextPage);

        } catch (BmcException e) {
            // 不再吞没失败：否则「真的没有日志」与「OCI 查询失败」在接口层不可区分
            log.warn("查询审计日志失败: 状态码={}, 错误={}", e.getStatusCode(), e.getMessage());
            throw new IllegalStateException(
                    String.format("查询审计日志失败（OCI 返回 %d）：%s", e.getStatusCode(), e.getMessage()), e);
        } catch (Exception e) {
            log.error("查询审计日志异常: {}", e.getMessage(), e);
            throw new IllegalStateException("查询审计日志异常：" + e.getMessage(), e);
        }

        return OciPageResult.<OciAuditEventDto>builder()
                .data(results)
                .nextPageToken(nextPage)
                .build();
    }


    /**
     * 查询过去 N 天（最大 90 天）到当前时间的审计日志（单页分页模式）
     */
    public OciPageResult<OciAuditEventDto> listRecentAuditEvents(
            Tenant tenant, int days, String pageToken) {
        if (days <= 0) days = 1;
        else if (days > 90) days = 90;

        ZonedDateTime nowUtc = ZonedDateTime.now(ZoneOffset.UTC);
        ZonedDateTime startUtc = nowUtc.minusDays(days);

        String startTime = startUtc.toInstant().toString();
        String endTime = nowUtc.toInstant().toString();

        log.info("查询过去 {} 天的日志范围: {} → {}", days, startTime, endTime);
        return listAuditEvents(tenant, startTime, endTime, pageToken);
    }

    /**
     * 查询指定日期范围内的审计日志（最多90天）
     * @param tenant 租户信息
     * @param startDate yyyy-MM-dd
     * @param endDate yyyy-MM-dd，可为空（为空时=开始日期当天）
     */
    public OciPageResult<OciAuditEventDto> listAuditEventsByDateRange(
            Tenant tenant, String startDate, String endDate, String pageToken) {

        LocalDate start;
        LocalDate end;
        try {
            start = LocalDate.parse(startDate);
            end = (endDate != null && !endDate.isEmpty())
                    ? LocalDate.parse(endDate)
                    : start;
        } catch (DateTimeParseException e) {
            // 参数错误必须上抛：吞成空列表会让前端把「参数错」误当「没有日志」
            log.warn("日期格式非法: startDate={}, endDate={}", startDate, endDate);
            throw new IllegalArgumentException("日期格式不正确，应为 yyyy-MM-dd");
        }

        // 统一按「闭区间天数」计数（选 1 月 1 日到 1 月 1 日 = 1 天，不是 0 天），与两端前端
        // （Web validateRange / 客户端 searchAudit 的 days = 日期差 + 1）口径一致。
        // 曾用 `diffDays > 90`，等于允许闭区间 91 天，比前端宽 1 天——前端总是先拦下，
        // 用户看不到，但绕过前端直连接口时口径不一致。
        long diffDays = ChronoUnit.DAYS.between(start, end);
        if (diffDays < 0) {
            throw new IllegalArgumentException("结束日期不能早于开始日期");
        }
        if (diffDays + 1 > 90) {
            throw new IllegalArgumentException("日期范围不能超过 90 天（当前 " + (diffDays + 1) + " 天）");
        }

        ZonedDateTime startUtc = start.atStartOfDay(ZoneOffset.UTC);
        ZonedDateTime endUtc = end.plusDays(1).atStartOfDay(ZoneOffset.UTC).minusSeconds(1);

        String startTime = startUtc.toInstant().toString();
        String endTime = endUtc.toInstant().toString();

        log.debug("查询租户 [{}] 日期范围 {} → {} 的审计日志", tenant.getUserName(), startTime, endTime);
        return listAuditEvents(tenant, startTime, endTime, pageToken);
    }

    /**
     * 根据多个 IP 获取拼接的地理位置字符串
     * 示例输入: "10.0.2.9,252.49.125.199"
     * 示例输出: "10.0.2.9(内网地址)，252.49.125.199(中国广东省深圳市)"
     */
    private String resolveMultiIpLocation(String ipAddress) {
        if (ipAddress == null || ipAddress.trim().isEmpty()) {
            return "-";
        }

        String[] ipList = ipAddress.split(",");
        List<String> resolvedList = new ArrayList<>();

        for (String ip : ipList) {
            ip = ip.trim();
            if (ip.isEmpty()) continue;

            String location;
            if (isPrivateIP(ip)) {
                location = "内网地址";
            } else {
                try {
                    location = getGeoInfoByIP(ip);
                } catch (Exception e) {
                    location = "未知";
                }
            }
            resolvedList.add(ip + "(" + location + ")");
        }

        return String.join("，", resolvedList); // 中文逗号分隔
    }

}
