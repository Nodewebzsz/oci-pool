package com.nodewebzsz.ociserver.service.impl;

import com.nodewebzsz.dao.entity.VpnProxyRecord;
import com.nodewebzsz.dao.entity.VpnProxyTenantBind;
import com.nodewebzsz.dao.repository.TenantRepository;
import com.nodewebzsz.dao.repository.VpnProxyRecordRepository;
import com.nodewebzsz.dao.repository.VpnProxyTenantBindRepository;
import com.nodewebzsz.ociserver.pojo.request.VpnProxyRecordRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class VpnProxyRecordServiceImplTest {

    @Mock
    private VpnProxyRecordRepository vpnProxyRecordRepository;

    @Mock
    private VpnProxyTenantBindRepository vpnProxyTenantBindRepository;

    @Mock
    private TenantRepository tenantRepository;

    @InjectMocks
    private VpnProxyRecordServiceImpl service;

    @Test
    void rejectsSaveWhenBindingRevisionIsOutdated() {
        List<VpnProxyTenantBind> binds = new ArrayList<>();
        when(vpnProxyTenantBindRepository.findAll()).thenReturn(binds);
        when(vpnProxyRecordRepository.findAllBoundRecords()).thenReturn(Collections.emptyList());
        String revision = service.currentBindingRevision();

        VpnProxyTenantBind added = new VpnProxyTenantBind();
        added.setProxyId(1L);
        added.setTenantId(2L);
        binds.add(added);
        assertNotEquals(revision, service.currentBindingRevision());

        VpnProxyRecordRequest request = request();
        request.setExpectedBindingRevision(revision);
        IllegalStateException error = assertThrows(IllegalStateException.class, () -> service.saveOrUpdate(request));
        assertTrue(error.getMessage().contains("已被其他操作修改"));
        verify(vpnProxyRecordRepository, never()).save(any());
    }

    @Test
    void rejectsCarryingOldPasswordToNewEndpoint() {
        VpnProxyRecord existing = existing();
        when(vpnProxyRecordRepository.findById(existing.getId())).thenReturn(Optional.of(existing));

        VpnProxyRecordRequest request = request();
        request.setId(existing.getId());
        request.setProxyHost("new-host.test");
        request.setProxyUsername("user1");
        request.setProxyPassword(null);

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class, () -> service.saveOrUpdate(request));
        assertTrue(error.getMessage().contains("重新填写密码"));
        verify(vpnProxyRecordRepository, never()).save(any());
    }

    @Test
    void keepsPasswordAndCheckResultWhenEndpointIsUnchanged() {
        VpnProxyRecord existing = existing();
        when(vpnProxyRecordRepository.findById(existing.getId())).thenReturn(Optional.of(existing));
        when(vpnProxyRecordRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        VpnProxyRecordRequest request = request();
        request.setId(existing.getId());
        request.setProxyUsername("user1");
        request.setProxyPassword(null);
        request.setCustomName("renamed");
        service.saveOrUpdate(request);

        assertEquals("secret-pass", existing.getProxyPassword());
        assertEquals("1.2.3.4", existing.getLastExitIp());
    }

    @Test
    void resetsCheckResultWhenEndpointChangesWithNewPassword() {
        VpnProxyRecord existing = existing();
        when(vpnProxyRecordRepository.findById(existing.getId())).thenReturn(Optional.of(existing));
        when(vpnProxyRecordRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        VpnProxyRecordRequest request = request();
        request.setId(existing.getId());
        request.setProxyHost("new-host.test");
        request.setProxyUsername("user1");
        request.setProxyPassword("new-pass");
        service.saveOrUpdate(request);

        assertEquals("new-pass", existing.getProxyPassword());
        assertNull(existing.getLastCheckedAt());
        assertNull(existing.getLastExitIp());
    }

    private static VpnProxyRecord existing() {
        VpnProxyRecord record = new VpnProxyRecord();
        record.setId(10L);
        record.setProxyType("SOCKS5");
        record.setProxyHost("old-host.test");
        record.setProxyPort(1080);
        record.setProxyUsername("user1");
        record.setProxyPassword("secret-pass");
        record.setLocation("德国");
        record.setLastCheckedAt(LocalDateTime.now());
        record.setLastExitIp("1.2.3.4");
        return record;
    }

    private static VpnProxyRecordRequest request() {
        VpnProxyRecordRequest request = new VpnProxyRecordRequest();
        request.setProxyType("SOCKS5");
        request.setProxyHost("old-host.test");
        request.setProxyPort(1080);
        request.setLocation("德国");
        return request;
    }
}
