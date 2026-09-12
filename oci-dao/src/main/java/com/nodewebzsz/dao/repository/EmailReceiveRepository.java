package com.nodewebzsz.dao.repository;


import com.nodewebzsz.dao.entity.AppVersion;
import com.nodewebzsz.dao.entity.EmailReceive;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface EmailReceiveRepository extends JpaRepository<EmailReceive, Long>, JpaSpecificationExecutor<EmailReceive> {


    /**
     * 检查邮箱是否已存在
     */
    boolean existsByEmail(String email);

}
