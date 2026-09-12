package com.nodewebzsz.ociserver.service;

public interface BanService {


    public boolean banIp(String ip,String reason);

    boolean unbanIp(String ip,String reason);
}
