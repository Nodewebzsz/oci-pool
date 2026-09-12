package com.nodewebzsz.ociserver.pojo.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class UploadPartVO {

    private Integer partNum;
    private String etag;
}
