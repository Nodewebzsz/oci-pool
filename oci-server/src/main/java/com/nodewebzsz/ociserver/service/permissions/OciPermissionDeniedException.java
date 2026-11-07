package com.nodewebzsz.ociserver.service.permissions;

public class OciPermissionDeniedException extends RuntimeException {
    public OciPermissionDeniedException(String message) { super(message); }
}
