package com.nodewebzsz.ocimonitor.service.quality;

public final class AgentCredentialReceipt {

    private final String instanceId;
    private final String credential;

    public AgentCredentialReceipt(String instanceId, String credential) {
        this.instanceId = instanceId;
        this.credential = credential;
    }

    public String getInstanceId() {
        return instanceId;
    }

    public String getCredential() {
        return credential;
    }

    @Override
    public String toString() {
        return "AgentCredentialReceipt{instanceId='" + instanceId + "'}";
    }
}
