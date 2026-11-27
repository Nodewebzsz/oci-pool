package com.nodewebzsz.ocimonitor.service.quality;

public class NetworkQualityException extends RuntimeException {

    private final int status;
    private final String code;

    public NetworkQualityException(int status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public int getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }
}
