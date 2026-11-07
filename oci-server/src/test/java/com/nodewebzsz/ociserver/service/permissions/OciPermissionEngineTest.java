package com.nodewebzsz.ociserver.service.permissions;

import com.nodewebzsz.dao.entity.Tenant;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class OciPermissionEngineTest {

    @Test
    void catalogNormalizesDependenciesAndBuildsScopedPolicyStatements() {
        Set<String> normalized = OciPermissionCatalog.normalize(Collections.singletonList("INSTANCE_REINSTALL"));
        assertTrue(normalized.contains("BASIC_READ"));
        assertTrue(normalized.contains("INSTANCE_POWER"));
        assertTrue(normalized.contains("INSTANCE_REINSTALL"));

        Set<String> resetSelection = OciPermissionCatalog.normalize(Collections.singletonList("USER_PASSWORD_RESET"));
        AccountPermissionScope scope = AccountPermissionScope.forSelection(
                "{\"allUsers\":false,\"passwordResetUserIds\":[\"ocid1.user.oc1..aaaaaaaademo\"]}",
                resetSelection
        );
        List<String> stmts = OciPermissionCatalog.statements(
                "ocid1.group.oc1..aaaaaaaagroup",
                resetSelection,
                scope
        );
        assertTrue(stmts.stream().anyMatch(s -> s.contains("target.user.id = 'ocid1.user.oc1..aaaaaaaademo'")));
    }

    @Test
    void permissionsEnforceFailClosedOnManagedTenantsAndPreserveLegacyTenants() {
        Tenant legacy = new Tenant();
        assertFalse(OciPermissions.isManaged(legacy));
        assertDoesNotThrow(() -> OciPermissions.require(legacy, "INSTANCE_DELETE"));

        Tenant managed = new Tenant();
        managed.setPermissionMode(OciPermissions.MODE);
        managed.setPermissionsJson(OciPermissionCatalog.serialize(Arrays.asList("INSTANCE_POWER", "DOMAIN_SECURITY_MANAGE")));
        assertTrue(OciPermissions.allows(managed, "BASIC_READ"));
        assertTrue(OciPermissions.allows(managed, "INSTANCE_POWER"));
        assertTrue(OciPermissions.allows(managed, "MFA_MANAGE"));
        assertTrue(OciPermissions.allows(managed, "PASSWORD_POLICY"));
        assertFalse(OciPermissions.allows(managed, "INSTANCE_DELETE"));
        assertThrows(OciPermissionDeniedException.class, () -> OciPermissions.require(managed, "INSTANCE_DELETE"));

        managed.setPermissionsJson("{\"corrupted\":true}");
        assertFalse(OciPermissions.allows(managed, "BASIC_READ"));
    }
}
