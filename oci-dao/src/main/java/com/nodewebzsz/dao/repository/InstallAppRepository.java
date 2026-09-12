package com.nodewebzsz.dao.repository;

import com.nodewebzsz.dao.entity.AppVersion;
import com.nodewebzsz.dao.entity.InstallApp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

/**
 * @version 1.0.0
 * @ClassName InstallAppRepository
 * @Description 应用安装记录 Repository
 * @Author nodewebzsz
 * @Date 2025-08-23
 */
@Repository
public interface InstallAppRepository extends JpaRepository<InstallApp, Long>, JpaSpecificationExecutor<InstallApp> {




}
