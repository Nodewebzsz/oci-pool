package com.nodewebzsz.ociserver.controller.system;

import com.nodewebzsz.ocicommon.param.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/system")
public class ApiDocsController {

    @GetMapping("/openApiSpec")
    public ApiResponse getOpenApiSpec() {
        Map<String, Object> spec = new LinkedHashMap<>();
        spec.put("openapi", "3.0.3");
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("title", "OCI Pool Manager Open API");
        info.put("version", "1.0.0");
        info.put("description", "受平台 API Token (Bearer) 保护的开放接口规范");
        spec.put("info", info);
        spec.put("servers", Collections.singletonList(Collections.singletonMap("url", "/")));

        Map<String, Object> bearer = new LinkedHashMap<>();
        bearer.put("type", "http");
        bearer.put("scheme", "bearer");
        Map<String, Object> schemes = new LinkedHashMap<>();
        schemes.put("BearerAuth", bearer);
        Map<String, Object> components = new LinkedHashMap<>();
        components.put("securitySchemes", schemes);
        spec.put("components", components);

        List<Map<String, Object>> endpoints = Arrays.asList(
            endpoint("POST", "/oci-pool/open-api/v1/chat", "AI 聊天接口", "AI", "{\"userId\":\"admin\",\"message\":\"Hello\"}"),
            endpoint("POST", "/oci-pool/open-api/v1/chat/completions", "OpenAI 兼容对话补全（支持 stream）", "AI", "{\"model\":\"gpt-4o-mini\",\"messages\":[{\"role\":\"user\",\"content\":\"Ping\"}],\"stream\":false}"),
            endpoint("GET", "/oci-pool/open-api/v1/models", "获取兼容 OpenAI 标准模型列表", "AI", null),
            endpoint("GET", "/oci-pool/open-api/v1/storage/buckets?tenantId=1", "获取指定租户下所有 OCI 对象存储桶", "Storage", null),
            endpoint("GET", "/oci-pool/open-api/v1/storage/objects?tenantId=1&bucketName=demo", "获取指定存储桶内的对象列表", "Storage", null),
            endpoint("POST", "/oci-pool/open-api/v1/storage/object/presigned", "生成 OCI 对象存储预签名访问 URL", "Storage", "{\"tenantId\":1,\"bucketName\":\"demo\",\"objectName\":\"file.txt\",\"expireMinutes\":60}")
        );
        spec.put("endpoints", endpoints);

        Map<String, Object> paths = new LinkedHashMap<>();
        for (Map<String, Object> ep : endpoints) {
            String rawPath = String.valueOf(ep.get("path")).split("\\?")[0];
            Map<String, Object> methodOp = new LinkedHashMap<>();
            methodOp.put("summary", ep.get("summary"));
            methodOp.put("tags", Collections.singletonList(ep.get("group")));
            methodOp.put("security", Collections.singletonList(Collections.singletonMap("BearerAuth", Collections.emptyList())));
            Map<String, Object> pathItem = new LinkedHashMap<>();
            pathItem.put(String.valueOf(ep.get("method")).toLowerCase(), methodOp);
            paths.put(rawPath, pathItem);
        }
        spec.put("paths", paths);
        return ApiResponse.success(spec);
    }

    private Map<String, Object> endpoint(String method, String path, String summary, String group, String sampleBody) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("method", method);
        item.put("path", path);
        item.put("summary", summary);
        item.put("group", group);
        item.put("sampleBody", sampleBody);
        return item;
    }
}
