package com.doubledimple.ociserver.pojo.request;

import lombok.Data;

/**
 * @version 1.0.0
 * @ClassName PasswordUpdateRequest
 * @Description TODO
 * @Author nodewebzsz
 * @Date 2024-11-21 13:00
 */
@Data
public class PasswordUpdateRequest {
    private String currentPassword;
    private String newUsername;
    private String newPassword;
}
