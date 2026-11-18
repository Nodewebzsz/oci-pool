package com.nodewebzsz.ociserver.third.openApi.request;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

/**
 * @version 1.0.0
 * @ClassName AiChatRequest
 * @Description TODO
 * @Author nodewebzsz
 * @Date 2025-09-12 10:10
 */
@Data
public class AiChatRequest {

    private String userId;

    private String message;
}
