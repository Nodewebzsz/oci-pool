package com.nodewebzsz.ociserver.service;

import com.nodewebzsz.dao.entity.InstanceCloudNetWork;
import com.nodewebzsz.dao.entity.Tenant;
import com.nodewebzsz.ocicommon.param.OpenRegionNotify;
import com.nodewebzsz.ociserver.pojo.dto.TenantTransferRequest;
import com.nodewebzsz.ociserver.pojo.request.AuditLogRequest;
import com.nodewebzsz.ociserver.pojo.request.BootVolumeUpdateRequest;
import com.nodewebzsz.ociserver.pojo.request.DeleteOciUserRequest;
import com.nodewebzsz.ociserver.pojo.request.ResetOciPassRequest;
import com.nodewebzsz.ociserver.pojo.request.TenantDTO;
import com.nodewebzsz.ociserver.pojo.response.AccountCheckRes;
import com.nodewebzsz.ociserver.pojo.response.PasswordPolicyDetail;
import com.nodewebzsz.ocicommon.param.ApiResponse;
import com.nodewebzsz.ociserver.pojo.response.BootVolumeRes;
import com.nodewebzsz.ociserver.pojo.response.OciGroupResp;
import com.oracle.bmc.core.responses.UpdateBootVolumeResponse;
import com.oracle.bmc.identity.model.RegionSubscription;
import com.oracle.bmc.identity.model.User;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;

public interface TenantService {

    public Page<Tenant> getAllTenants(Integer cloudType, int page, int size);

    public Page<Tenant> getAllTenantsByParentId(Long parentId,Integer cloudType, int page, int size);

    public void saveTenant(Tenant tenant, MultipartFile file) throws IOException;

    public List<Tenant> saveTenantInner(Tenant tenant) throws IOException;

    void deleteApi(Long tenantId,Boolean deleteFile);

    /**
    * @Description: 单个实例同步信息
    * @Param: [java.lang.Long]
    * @return: void
    * @Author nodewebzsz
    * @Date: 2/16/25 11:26 AM
    */
    void syncOci(Long tenantId);


    /**
     * @Description: 多个实例同步
     * @Param: [java.lang.Long]
     * @return: void
     * @Author nodewebzsz
     * @Date: 2/16/25 11:26 AM
     */
    void globalSyncOci();

    List<User> listUsers(String tenantId);

    String createUser(String tenantId, String username,String email,String groupId);

    List<Map<String, Object>> fetchTenantAndBootInstanceData();

    void importData(List<Map<String, Object>> request);

    /** 校验导入弹窗中的自定义名称是否已被其他租户占用。 */
    boolean existsCustomName(String name, Integer cloudType, Long excludeTenantId, String excludeTenancy);

    AccountCheckRes checkBatchAccounts();

    List<BootVolumeRes> getAllBootVolumes(String tenantId);

    UpdateBootVolumeResponse updateBootVolumeVpus(String bootVolumeId, BootVolumeUpdateRequest request);

    List<TenantDTO> getAllTenantsForDropdown();

    List<OciGroupResp> findGroups(String tenantId);

    /**
    * 根据tenantId查询所有的区域
    */
    List<Tenant> regionList(long tenantId);

    Page<Tenant> searchTenants(String keyword,Integer cloudType, int page, int size);

    Page<Tenant> getTenantsByEmailEnable(Integer cloudType, int emailEnable, String keyword, int page, int size);

    List<Tenant> getParentTenants();


    /**
    * 重置账号的验证因子
    */
    ApiResponse resetAccountFactor(Long tenantId);

    Map<String, Object> deleteBootVolume(Long tenantId, String volumeId);

    List<OpenRegionNotify> listDisTenants();

    void updateAccountDetail(Long tenantId);

    Tenant getById(Long tenantId);

    List<User> getPageUsers(String tenantId);

    List<InstanceCloudNetWork> doCreateCloudNetWork(Tenant tenant);

    List<Tenant> updateTenancyDetail(String tenantId);

    List<RegionSubscription> regionSub(long tenantId);

    /**
    * 修改自定义名称
    */
    boolean updateCustomName(Tenant tenant, String defName);
    boolean updateAccountCost(Tenant tenant, String newCost);

    Page<Tenant> findParentTenant(int i, int page, int size);

    Boolean updateUserPasswordPolicy(String tenantId, boolean enablePasswordExpiry, Integer expiryDays);

    List<PasswordPolicyDetail> getPasspolicy(String tenantId);

    List<Tenant> querySupportAiRecords(int cloudType);

    /**
     * @Description: 重置控制台密码
     * @Param: [com.nodewebzsz.ociserver.pojo.request.ResetOciPassRequest]
     * @return: com.nodewebzsz.ociserver.pojo.response.base.ApiResponse
     * @Author: nodewebzsz
     * @Date: 9/7/25 9:11 AM
     */
    ApiResponse resetPassword(ResetOciPassRequest request);

    ApiResponse enableEmailService(Map<String, Object> request);

    ApiResponse getEmailServiceStatus(Long tenantId);

    ApiResponse disableEmailService(Map<String, Object> request);

    ApiResponse testEmailService(Map<String, Object> request);
    ApiResponse deleteUser(DeleteOciUserRequest request);

    SseEmitter streamAccountCheckProgress();

    ApiResponse queryAuditLogs(AuditLogRequest auditLogRequest);


    //导出所有数据
    public ResponseEntity<?> exportData();


    //导出某条租户数据
    public ResponseEntity<?> exportData(Long parentId);

    ApiResponse assetAnalysis(Integer cloudType);

    ApiResponse transferTenant(TenantTransferRequest request);

    void analyzeAllTenantsStream(SseEmitter emitter);

    void updateTenantWithSSE(String tenantId, SseEmitter emitter);

    void batchUpdateStatusToInactive(List<Long> inactiveTenantIds);

    Map<String, Object> getBackupKeyInfo(Long tenantId);

    void switchRestrictedApiWithSSE(Long tenantId, SseEmitter emitter);
}
