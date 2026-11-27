package com.nodewebzsz.ociserver.service;

public interface BanService {

    enum UnbanRecordResult {
        RELEASED,
        ALREADY_RELEASED,
        NOT_FOUND
    }

    public boolean banIp(String ip,String reason);

    default boolean banIp(String ip, String reason, String operatorName) {
        return banIp(ip, reason);
    }

    boolean unbanIp(String ip,String reason);

    boolean unbanIp(String ip, String reason, String operatorName);

    UnbanRecordResult unbanRecord(Long id, String reason, String operatorName);
}
