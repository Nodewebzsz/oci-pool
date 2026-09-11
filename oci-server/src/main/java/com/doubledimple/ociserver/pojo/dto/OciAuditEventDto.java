package com.doubledimple.ociserver.pojo.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * @version 1.0.0
 * @ClassName AuditEventDto
 * @Description TODO
 * @Author nodewebzsz
 * @Date 2025-10-31 11:24
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OciAuditEventDto {
    /** 事件短名（AuditEvent.Data.eventName，如 LaunchInstance） */
    private String eventType;
    /** 事件完整类型（AuditEvent.eventType，如 com.oraclecloud.ComputeApi.LaunchInstance），供 hover 排查 */
    private String eventFullType;
    /** 操作者名称（principalName，超 35 字符截断） */
    private String userName;
    /** 认证类型原始码（identity.authType）。注意：无公开枚举，不能用来区分控制台/API */
    private String userType;
    /**
     * 控制台会话 ID（identity.consoleSessionId）。
     * 非空 = 控制台登录会话；为空 = API / SDK 调用。这是区分调用来源的唯一可靠判据。
     */
    private String consoleSessionId;
    /** 来源 IP + 地理位置拼接串 */
    private String ipAddress;
    /** 客户端原始 UserAgent（降级为 hover 详情，不再作列主值） */
    private String clientEnv;
    /** 事件时间 yyyy-MM-dd HH:mm:ss */
    private String eventTime;
    /** 响应状态码；response 为空时后端填 "-"（前端须按「未知」处理，不得判失败） */
    private String responseStatus;
}
