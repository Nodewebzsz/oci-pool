package com.nodewebzsz.ociserver.controller;

import cn.dev33.satoken.stp.StpUtil;
import com.fasterxml.jackson.databind.JsonNode;
import com.nodewebzsz.ocimonitor.service.quality.NetworkQualityException;
import com.nodewebzsz.ocimonitor.service.quality.NetworkQualityService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.annotation.Resource;
import javax.servlet.http.HttpServletResponse;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Supplier;

@RestController
@RequestMapping("/api/network-quality")
@Slf4j
public class NetworkQualityController extends BaseController {

    @Resource
    private NetworkQualityService networkQualityService;

    @GetMapping("/overview")
    public ResponseEntity<?> overview(HttpServletResponse response) {
        StpUtil.checkLogin();
        response.setHeader("Cache-Control", "no-store");
        return execute(() -> networkQualityService.overview());
    }

    @GetMapping("/history")
    public ResponseEntity<?> history(@RequestParam String instanceId,
                                     @RequestParam String taskId,
                                     @RequestParam String revision,
                                     @RequestParam(defaultValue = "24") int hours,
                                     HttpServletResponse response) {
        StpUtil.checkLogin();
        response.setHeader("Cache-Control", "no-store");
        return execute(() -> networkQualityService.history(instanceId, taskId, revision, hours));
    }

    @PostMapping("/tasks")
    public ResponseEntity<?> createTask(@RequestBody JsonNode body, HttpServletResponse response) {
        StpUtil.checkLogin();
        response.setHeader("Cache-Control", "no-store");
        return execute(() -> networkQualityService.createTask(body));
    }

    @PutMapping("/tasks/{id}")
    public ResponseEntity<?> updateTask(@PathVariable String id,
                                        @RequestBody JsonNode body,
                                        HttpServletResponse response) {
        StpUtil.checkLogin();
        response.setHeader("Cache-Control", "no-store");
        return execute(() -> networkQualityService.updateTask(id, body));
    }

    @DeleteMapping("/tasks/{id}")
    public ResponseEntity<?> deleteTask(@PathVariable String id,
                                        @RequestParam String version,
                                        HttpServletResponse response) {
        StpUtil.checkLogin();
        response.setHeader("Cache-Control", "no-store");
        return execute(() -> networkQualityService.deleteTask(id, version));
    }

    @PostMapping("/tasks/{id}/run")
    public ResponseEntity<?> runTask(@PathVariable String id,
                                     @RequestBody JsonNode body,
                                     HttpServletResponse response) {
        StpUtil.checkLogin();
        response.setHeader("Cache-Control", "no-store");
        return execute(() -> networkQualityService.runTask(id, body));
    }

    @PostMapping("/agent/poll")
    public ResponseEntity<?> agentPoll(@RequestHeader(value = "Authorization", required = false) String authorization,
                                       @RequestBody JsonNode body,
                                       HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store");
        return execute(() -> networkQualityService.poll(authorization, body));
    }

    @PostMapping("/agent/report")
    public ResponseEntity<?> agentReport(@RequestHeader(value = "Authorization", required = false) String authorization,
                                         @RequestBody JsonNode body,
                                         HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store");
        return execute(() -> networkQualityService.report(authorization, body));
    }

    private ResponseEntity<?> execute(Supplier<Map<String, Object>> action) {
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("success", true);
            body.put("data", action.get());
            return ResponseEntity.ok(body);
        } catch (NetworkQualityException e) {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("success", false);
            body.put("code", e.getCode());
            body.put("message", e.getMessage());
            return ResponseEntity.status(e.getStatus()).body(body);
        } catch (Exception e) {
            log.error("网络质量接口处理失败: {}", e.getClass().getSimpleName(), e);
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("success", false);
            body.put("code", "internalError");
            body.put("message", "网络质量服务处理失败，请稍后重试");
            return ResponseEntity.status(500).body(body);
        }
    }
}
