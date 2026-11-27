package com.nodewebzsz.ociserver.service.oracle;

import com.nodewebzsz.ociserver.pojo.domain.dto.User;
import com.nodewebzsz.ociserver.pojo.dto.OciComputerDto;
import com.oracle.bmc.core.model.LaunchInstanceDetails;
import com.oracle.bmc.core.model.LaunchInstanceShapeConfigDetails;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class OracleCloudServiceCapacityParamsTest {

    @Test
    void prefersRootCompartmentAndShapeConfigWhenPresent() {
        OciComputerDto dto = new OciComputerDto();
        dto.setCompartmentIdRoot("ocid1.tenancy.oc1..root");

        LaunchInstanceDetails details = LaunchInstanceDetails.builder()
                .compartmentId("ocid1.compartment.oc1..child")
                .shapeConfig(LaunchInstanceShapeConfigDetails.builder()
                        .ocpus(4F)
                        .memoryInGBs(24F)
                        .build())
                .build();

        User user = new User();
        user.setOcpus(2F);
        user.setMemory(12F);

        assertEquals("ocid1.tenancy.oc1..root",
                OracleCloudService.resolveCapacityCompartmentId(dto, details));
        assertEquals(4F, OracleCloudService.resolveCapacityOcpus(details, user));
        assertEquals(24F, OracleCloudService.resolveCapacityMemory(details, user));
    }

    @Test
    void fallsBackToDetailsCompartmentAndUserSizingWhenMissing() {
        OciComputerDto dto = new OciComputerDto();
        dto.setCompartmentIdRoot("   ");

        LaunchInstanceDetails details = LaunchInstanceDetails.builder()
                .compartmentId("ocid1.compartment.oc1..fallback")
                .build();

        User user = new User();
        user.setOcpus(1F);
        user.setMemory(6F);

        assertEquals("ocid1.compartment.oc1..fallback",
                OracleCloudService.resolveCapacityCompartmentId(dto, details));
        assertEquals(1F, OracleCloudService.resolveCapacityOcpus(details, user));
        assertEquals(6F, OracleCloudService.resolveCapacityMemory(details, user));
    }
}
