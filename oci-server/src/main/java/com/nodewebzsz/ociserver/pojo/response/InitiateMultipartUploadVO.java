package com.nodewebzsz.ociserver.pojo.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class InitiateMultipartUploadVO {

    private String uploadId;
    private String objectName;
    private String namespace;
    private String bucketName;
}
