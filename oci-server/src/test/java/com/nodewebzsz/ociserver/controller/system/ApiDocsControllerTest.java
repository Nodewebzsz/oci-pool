package com.nodewebzsz.ociserver.controller.system;

import com.nodewebzsz.ocicommon.param.ApiResponse;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ApiDocsControllerTest {

    @Test
    void openApiSpecContainsAllV1EndpointsAndBearerSecurity() {
        ApiDocsController controller = new ApiDocsController();
        ApiResponse response = controller.getOpenApiSpec();
        assertTrue(response.isSuccess());

        @SuppressWarnings("unchecked")
        Map<String, Object> payload = (Map<String, Object>) response.getData();
        assertEquals("3.0.3", payload.get("openapi"));

        @SuppressWarnings("unchecked")
        Map<String, Object> paths = (Map<String, Object>) payload.get("paths");
        assertTrue(paths.containsKey("/oci-pool/open-api/v1/chat"));
        assertTrue(paths.containsKey("/oci-pool/open-api/v1/chat/completions"));
        assertTrue(paths.containsKey("/oci-pool/open-api/v1/models"));
        assertTrue(paths.containsKey("/oci-pool/open-api/v1/storage/buckets"));
        assertTrue(paths.containsKey("/oci-pool/open-api/v1/storage/objects"));
        assertTrue(paths.containsKey("/oci-pool/open-api/v1/storage/object/presigned"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> endpoints = (List<Map<String, Object>>) payload.get("endpoints");
        assertEquals(6, endpoints.size());
    }
}
