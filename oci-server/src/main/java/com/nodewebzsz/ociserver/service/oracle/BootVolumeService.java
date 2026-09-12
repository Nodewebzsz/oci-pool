package com.nodewebzsz.ociserver.service.oracle;

import com.nodewebzsz.ocicommon.param.ApiResponse;

public interface BootVolumeService {


    ApiResponse handleShrink(String instanceDetailId, Long diskNum);
}
