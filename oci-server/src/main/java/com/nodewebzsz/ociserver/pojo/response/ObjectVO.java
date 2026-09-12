package com.nodewebzsz.ociserver.pojo.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ObjectVO {

    private String name;
    private Long size;
    private String timeModified;
}
