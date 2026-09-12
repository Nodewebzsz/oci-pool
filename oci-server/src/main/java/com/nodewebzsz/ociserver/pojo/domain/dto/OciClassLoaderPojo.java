package com.nodewebzsz.ociserver.pojo.domain.dto;

import com.nodewebzsz.dao.entity.Tenant;
import com.oracle.bmc.auth.SimpleAuthenticationDetailsProvider;
import lombok.*;

/**
 * @author nodewebzsz
 * @date 2024:11:03日 13:16
 */
@Data
@Builder
@ToString
@AllArgsConstructor
@NoArgsConstructor
public class OciClassLoaderPojo {

    private SimpleAuthenticationDetailsProvider authenticationDetailsProvider;
    private Tenant tenant;

}
