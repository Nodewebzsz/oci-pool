package com.nodewebzsz.ociserver.pojo.response;

import lombok.Data;

/**
 * @version 1.0.0
 * @ClassName PasswordPolicyDetail
 * @Description TODO
 * @Author nodewebzsz
 * @Date 2025-08-24 20:43
 */
@Data
public class PasswordPolicyDetail {

    private String name;
    private boolean enablePasswordExpiry;
    private Integer expiryDays;
    /** 策略强度：Simple / Standard / Custom */
    private String passwordStrength;
    /** 策略优先级，数值越小优先级越高 */
    private Integer priority;
    /** 是否可被本项目修改（仅可替换的 Custom 策略为 true） */
    private boolean editable;
    /** 是否为本项目自动创建/托管的策略 */
    private boolean managed;
}
