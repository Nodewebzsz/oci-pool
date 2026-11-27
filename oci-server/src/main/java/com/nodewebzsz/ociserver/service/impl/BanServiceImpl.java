package com.nodewebzsz.ociserver.service.impl;

import com.nodewebzsz.dao.entity.BanRecord;
import com.nodewebzsz.dao.repository.BanRecordRepository;
import com.nodewebzsz.dao.repository.LoginFailureStateRepository;
import com.nodewebzsz.ociserver.config.exception.IpBannedException;
import com.nodewebzsz.ociserver.service.BanService;
import com.nodewebzsz.ociserver.service.login.AuthSecurityService;
import com.nodewebzsz.ociserver.service.security.LoginIpTransactions;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.annotation.Resource;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

/**
 * @version 1.0.0
 * @ClassName BanServiceImpl
 * @Description TODO
 * @Author nodewebzsz
 * @Date 2025-11-01 08:55
 */
@Slf4j
@Service
public class BanServiceImpl implements BanService {

    @Resource
    private BanRecordRepository banRecordRepository;

    @Resource
    private LoginFailureStateRepository loginFailureStateRepository;

    @Resource
    private LoginIpTransactions loginIpTransactions;

    @Autowired(required = false)
    private AuthSecurityService authSecurityService;

    @Override
    public boolean banIp(String ip, String reason) {
        return banIp(ip, reason, "system");
    }

    @Override
    public boolean banIp(String ip, String reason, String operatorName) {
        try {
            String address = LoginIpTransactions.normalizeIp(ip);
            loginIpTransactions.execute(address, normalizedIp -> {
                BanRecord record = banRecordRepository.findTopByIpAddressAndStatusOrderByIdDesc(normalizedIp, 1);
                if (record == null) {
                    record = new BanRecord();
                    record.setIpAddress(normalizedIp);
                }
                record.setSource("系统封禁");
                record.setOperatorName(StringUtils.hasText(operatorName) ? operatorName : "system");
                record.setReason(StringUtils.hasText(reason) ? reason : "手动封禁");
                record.setStatus(1);
                record.setCreateTime(LocalDateTime.now());
                record.setUnbanTime(null);
                record.setUnbanReason(null);
                record.setUnbanOperatorName(null);
                banRecordRepository.save(record);
                return null;
            });
            log.info("封禁 IP 成功：{}", address);
            return true;
        } catch (Exception e) {
            log.error("封禁 IP 失败: {}", e.getMessage(), e);
            return false;
        }
    }

    @Override
    public boolean unbanIp(String ip,String reason) {
        return unbanIp(ip, reason, "system");
    }

    @Override
    public boolean unbanIp(String ip, String reason, String operatorName) {
        try {
            String address = LoginIpTransactions.normalizeIp(ip);
            boolean unbanned = Boolean.TRUE.equals(loginIpTransactions.execute(address,
                    normalizedIp -> releaseAddress(normalizedIp, reason, operatorName)));
            if (authSecurityService != null) {
                authSecurityService.clearIpFailure(address);
            }
            if (unbanned) {
                log.info("解封成功：{}", address);
            } else {
                log.warn("解封失败，IP [{}] 未找到或未被封禁", address);
            }
            return unbanned;
        } catch (Exception e) {
            log.error("解封 IP 失败: {}", e.getMessage(), e);
            return false;
        }
    }

    @Override
    public UnbanRecordResult unbanRecord(Long id, String reason, String operatorName) {
        if (id == null) {
            return UnbanRecordResult.NOT_FOUND;
        }
        BanRecord snapshot = banRecordRepository.findById(id).orElse(null);
        if (snapshot == null) {
            return UnbanRecordResult.NOT_FOUND;
        }
        String address = normalizeIfValid(snapshot.getIpAddress());
        UnbanRecordResult result;
        if (address == null) {
            result = loginIpTransactions.executeRecord(id, () -> {
                BanRecord current = banRecordRepository.findById(id).orElse(null);
                UnbanRecordResult inactiveResult = inactiveResult(current);
                if (inactiveResult != null) {
                    return inactiveResult;
                }
                if (normalizeIfValid(current.getIpAddress()) != null) {
                    throw new IllegalStateException("封禁记录的IP已变化，请重试");
                }
                releaseRecords(Collections.singletonList(current), reason, operatorName);
                return UnbanRecordResult.RELEASED;
            });
        } else {
            result = loginIpTransactions.execute(address, normalizedIp -> {
                BanRecord current = banRecordRepository.findById(id).orElse(null);
                UnbanRecordResult inactiveResult = inactiveResult(current);
                if (inactiveResult != null) {
                    return inactiveResult;
                }
                if (!normalizedIp.equals(normalizeIfValid(current.getIpAddress()))) {
                    throw new IllegalStateException("封禁记录的IP已变化，请重试");
                }
                if (!releaseAddress(normalizedIp, reason, operatorName)) {
                    throw new IllegalStateException("封禁记录状态已变化，请重试");
                }
                return UnbanRecordResult.RELEASED;
            });
            if (result == UnbanRecordResult.RELEASED && authSecurityService != null) {
                authSecurityService.clearIpFailure(address);
            }
        }
        if (result == UnbanRecordResult.RELEASED) {
            log.info("按记录解封成功，记录ID={}", id);
        }
        return result;
    }

    private UnbanRecordResult inactiveResult(BanRecord record) {
        if (record == null) {
            return UnbanRecordResult.NOT_FOUND;
        }
        if (!Integer.valueOf(1).equals(record.getStatus())) {
            return UnbanRecordResult.ALREADY_RELEASED;
        }
        return null;
    }

    private String normalizeIfValid(String ip) {
        try {
            return LoginIpTransactions.normalizeIp(ip);
        } catch (IpBannedException invalidAddress) {
            return null;
        }
    }

    private boolean releaseAddress(String ip, String reason, String operatorName) {
        List<BanRecord> records = banRecordRepository.findAllByIpAddressAndStatusOrderByIdDesc(ip, 1);
        releaseRecords(records, reason, operatorName);
        loginFailureStateRepository.findById(ip).ifPresent(loginFailureStateRepository::delete);
        return !records.isEmpty();
    }

    private void releaseRecords(List<BanRecord> records, String reason, String operatorName) {
        LocalDateTime now = LocalDateTime.now();
        for (BanRecord record : records) {
            record.setStatus(0);
            record.setUnbanTime(now);
            record.setUnbanOperatorName(StringUtils.hasText(operatorName) ? operatorName : "system");
            record.setUnbanReason(StringUtils.hasText(reason) ? reason : "手动解封");
        }
        banRecordRepository.saveAll(records);
    }
}
