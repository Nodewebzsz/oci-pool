package com.nodewebzsz.ociserver.service;

import com.nodewebzsz.ociserver.pojo.request.DDRequest;
import com.nodewebzsz.ocicommon.param.ApiResponse;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

public interface QuickDdService {

    public ApiResponse quickDd(DDRequest request);

    SseEmitter quickDdSse(DDRequest request);
}
