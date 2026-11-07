package com.nodewebzsz.ociserver.controller;

import com.nodewebzsz.ocicommon.param.ApiResponse;
import com.nodewebzsz.ociserver.service.permissions.ManagedTenantImportService;
import com.nodewebzsz.ociserver.service.permissions.OciPermissionCatalog;
import com.nodewebzsz.dao.entity.InstanceDetails;
import com.nodewebzsz.dao.entity.Tenant;
import com.nodewebzsz.dao.repository.OracleInstanceDetailRepository;
import com.nodewebzsz.dao.repository.TenantRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.annotation.Resource;
import javax.servlet.http.HttpServletResponse;

@RestController
@RequestMapping("/tenants")
@Slf4j
public class ManagedTenantController {
    @Resource
    private ManagedTenantImportService managedTenantImportService;
    @Resource private OracleInstanceDetailRepository instanceRepository;
    @Resource private TenantRepository tenantRepository;

    @GetMapping("/permissions/catalog")
    public ApiResponse catalog() {
        return ApiResponse.success(OciPermissionCatalog.describe());
    }

    @GetMapping("/permissions/instance-context")
    public ApiResponse instanceContext(@RequestParam String instanceId) {
        InstanceDetails instance;
        try {
            instance = instanceId.startsWith("ocid1.instance.") ? instanceRepository.findByInstanceId(instanceId)
                    : instanceRepository.findById(Long.valueOf(instanceId)).orElse(null);
        } catch (NumberFormatException e) {
            return ApiResponse.error("实例 ID 无效");
        }
        if (instance == null) return ApiResponse.error("实例不存在");
        if (instance.getCloudType() != 1) {
            java.util.Map<String, Object> data = new java.util.LinkedHashMap<>();
            data.put("id", String.valueOf(instance.getTenantId()));
            data.put("tenantId", String.valueOf(instance.getTenantId()));
            data.put("nonOci", true);
            data.put("permissionMode", "");
            data.put("permissionsJson", null);
            return ApiResponse.success(data);
        }
        Tenant tenant = tenantRepository.findById(instance.getTenantId()).orElse(null);
        if (tenant == null) return ApiResponse.error("租户不存在");
        java.util.Map<String, Object> data = new java.util.LinkedHashMap<>();
        data.put("id", String.valueOf(tenant.getId()));
        data.put("tenantId", String.valueOf(tenant.getId()));
        data.put("permissionMode", tenant.getPermissionMode());
        data.put("permissionsJson", tenant.getPermissionsJson());
        data.put("managedUserName", tenant.getManagedUserName());
        return ApiResponse.success(data);
    }

    @PostMapping(path = "/restricted/save", consumes = "multipart/form-data")
    public ApiResponse save(
            @RequestParam String tenantId,
            @RequestParam String tenancy,
            @RequestParam String fingerprint,
            @RequestParam String region,
            @RequestParam(required = false) String userName,
            @RequestParam String managedUserName,
            @RequestParam String permissions,
            @RequestParam(required = false) String accountScope,
            @RequestParam("keyFileStr") MultipartFile keyFile) {
        try {
            return ApiResponse.success(managedTenantImportService.save(tenantId, tenancy, fingerprint,
                    region, userName, managedUserName, permissions, accountScope, keyFile));
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(e.getMessage());
        } catch (Exception e) {
            // 不输出 SDK 请求、上传凭证或异常中的敏感内容。
            log.warn("配置 OCI 专用用户失败，异常类型:{}", e.getClass().getSimpleName());
            return ApiResponse.error("配置专用用户失败。请检查原 API 的用户、组及策略管理权限；原 API 不会作为租户凭证保存。");
        }
    }

    @PostMapping(path = "/restricted/downgrade", consumes = "application/json")
    public ApiResponse downgrade(@RequestBody DowngradeRequest request, HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store");
        if (request == null) return ApiResponse.error("降权请求无效");
        try {
            return ApiResponse.success(managedTenantImportService.downgrade(request.getTenantId(),
                    request.getManagedUserName(), request.getPermissions(), request.getAccountScope(),
                    Boolean.TRUE.equals(request.getBackupConfirmed())));
        } catch (IllegalArgumentException e) {
            return ApiResponse.error(e.getMessage());
        } catch (Exception e) {
            log.warn("OCI API 降权失败，异常类型:{}", e.getClass().getSimpleName());
            return ApiResponse.error("专用身份配置未完成，原本地 API 未替换。请检查原凭证权限、网络后以相同专用用户名重试。");
        }
    }

    @lombok.Data
    public static class DowngradeRequest {
        private Long tenantId;
        private String managedUserName;
        private String permissions;
        private String accountScope;
        private Boolean backupConfirmed;
    }
}
