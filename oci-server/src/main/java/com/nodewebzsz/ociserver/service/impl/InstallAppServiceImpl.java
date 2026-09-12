package com.nodewebzsz.ociserver.service.impl;

import cn.hutool.core.collection.CollectionUtil;
import cn.hutool.core.util.IdUtil;
import com.alibaba.fastjson2.JSON;
import com.nodewebzsz.dao.entity.InstallApp;
import com.nodewebzsz.dao.repository.InstallAppRepository;
import com.nodewebzsz.ocicommon.cache.CacheConstants;
import com.nodewebzsz.ocicommon.param.InstallAppNotify;
import com.nodewebzsz.ocicommon.utils.IpUtils;
import com.nodewebzsz.ociserver.service.InstallAppService;
import com.nodewebzsz.ociserver.service.OpenApiService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.annotation.Resource;
import java.time.LocalDateTime;
import java.util.List;

/**
 * @version 1.0.0
 * @ClassName InstallAppServiceImpl
 * @Description TODO
 * @Author nodewebzsz
 * @Date 2025-08-23 08:16
 */
@Service
@Slf4j
public class InstallAppServiceImpl implements InstallAppService {

    @Resource
    private InstallAppRepository installAppRepository;

    @Resource
    OpenApiService openApiService;

    @Override
    @Transactional
    public InstallAppNotify addOrUpdateInstallApp() {
        //先从缓存里面获取当前的活跃安装数量
        InstallAppNotify installAppNotify = new InstallAppNotify();
        try {
            InstallApp result = getInstallApp();
            String publicIp =  null;
            if (result == null){
                InstallApp add = new InstallApp();
                String snowflakeNextIdStr = IdUtil.getSnowflakeNextIdStr();
                publicIp = IpUtils.getPublicIp();
                LocalDateTime now = LocalDateTime.now();
                String uniqueId = snowflakeNextIdStr + "_" + publicIp;
                add.setUniqueId(uniqueId);
                add.setIpAddress(publicIp);
                add.setInstallTime(now);
                add.setCreateTime(now);
                add.setUpdateTime(now);
                installAppRepository.save(add);
            }else{
                publicIp = result.getIpAddress();
                if (!result.getIpAddress().equals(publicIp)){
                    result.setIpAddress(IpUtils.getPublicIp());
                    result.setUpdateTime(LocalDateTime.now());
                    installAppRepository.save(result);
                }
            }
            installAppNotify = appInstallApp(result);
        } catch (Exception e) {
            log.warn("install app error:{}",e.getMessage());
        }
        return installAppNotify;
    }

    private InstallAppNotify appInstallApp(InstallApp installApp) {
        return openApiService.installApp(installApp);
    }


    @Override
    public InstallApp getInstallApp() {
        final List<InstallApp> all = installAppRepository.findAll();
        if (CollectionUtil.isNotEmpty(all)){
            return all.get(0);
        }else {
            return null;
        }
    }
}
