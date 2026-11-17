package com.nodewebzsz.ociserver.config;

import com.nodewebzsz.dao.entity.VpnProxyRecord;
import com.nodewebzsz.dao.repository.TenantRepository;
import com.nodewebzsz.dao.repository.VpnProxyRecordRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.lang.reflect.Field;
import java.util.Arrays;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TenantProxyBinderTest {

    private static final AtomicLong IDS = new AtomicLong(9_000_000L);

    @Mock
    private VpnProxyRecordRepository vpnProxyRecordRepository;

    @Mock
    private TenantRepository tenantRepository;

    @InjectMocks
    private TenantProxyBinder binder;

    private long tenantPk;

    @BeforeEach
    void setUp() {
        tenantPk = IDS.incrementAndGet();
        TenantProxyBinder.clear();
    }

    @AfterEach
    void tearDown() {
        TenantProxyBinder.clear();
    }

    @Test
    void connectsDirectlyWhenNoProxyIsConfigured() {
        binder.doApply(tenantPk);

        assertNull(ProxyContext.get());
    }

    @Test
    void skipsCoolingDownPoolNodeAndKeepsAccountOnSameNode() throws Exception {
        VpnProxyRecord failing = proxy(false);
        VpnProxyRecord healthyA = proxy(true);
        VpnProxyRecord healthyB = proxy(true);
        when(vpnProxyRecordRepository.findAllAvailableGlobal(anyInt()))
                .thenReturn(Arrays.asList(failing, healthyA, healthyB));

        binder.doApply(tenantPk);
        assertNotNull(ProxyContext.get());
        Long first = stickyProxyId();
        assertTrue(first.equals(healthyA.getId()) || first.equals(healthyB.getId()));

        for (int i = 0; i < 5; i++) {
            TenantProxyBinder.clear();
            binder.doApply(tenantPk);
            assertEquals(first, stickyProxyId());
        }
    }

    @Test
    void blocksDirectConnectionWhenEveryPoolNodeIsUnavailable() {
        when(vpnProxyRecordRepository.findAllAvailableGlobal(anyInt()))
                .thenReturn(Arrays.asList(proxy(false), proxy(false)));

        IllegalStateException error = assertThrows(IllegalStateException.class, () -> binder.doApply(tenantPk));
        assertTrue(error.getMessage().contains("已阻止直连"));
        assertNull(ProxyContext.get());
    }

    @Test
    void fallsBackToPoolWhenDedicatedProxyIsUnavailable() throws Exception {
        VpnProxyRecord dedicated = proxy(false);
        VpnProxyRecord pooled = proxy(true);
        when(vpnProxyRecordRepository.findTopByTenantId(tenantPk)).thenReturn(dedicated);
        when(vpnProxyRecordRepository.findAllAvailableGlobal(anyInt())).thenReturn(Collections.singletonList(pooled));

        binder.doApply(tenantPk);

        assertNotNull(ProxyContext.get());
        assertEquals(pooled.getId(), stickyProxyId());
    }

    @Test
    void blocksWhenDedicatedProxyFailsAndPoolIsEmpty() {
        when(vpnProxyRecordRepository.findTopByTenantId(tenantPk)).thenReturn(proxy(false));

        IllegalStateException error = assertThrows(IllegalStateException.class, () -> binder.doApply(tenantPk));
        assertTrue(error.getMessage().contains("专属代理"));
        assertNull(ProxyContext.get());
    }

    @Test
    void classifiesPersistedCheckResultsByFreshness() {
        VpnProxyRecord record = new VpnProxyRecord();
        assertEquals(TenantProxyBinder.PersistedState.UNKNOWN, TenantProxyBinder.persistedState(record));

        record.setLastCheckedAt(java.time.LocalDateTime.now().minusHours(1));
        assertEquals(TenantProxyBinder.PersistedState.FRESH_OK, TenantProxyBinder.persistedState(record));

        record.setLastCheckError("connect timed out");
        assertEquals(TenantProxyBinder.PersistedState.FRESH_FAILED, TenantProxyBinder.persistedState(record));

        record.setLastCheckedAt(java.time.LocalDateTime.now().minusHours(TenantProxyBinder.CHECK_FRESH_HOURS + 1));
        assertEquals(TenantProxyBinder.PersistedState.UNKNOWN, TenantProxyBinder.persistedState(record));
    }

    @Test
    void persistsFailureWhenForceProxyIsUnreachable() {
        VpnProxyRecord force = new VpnProxyRecord();
        force.setId(IDS.incrementAndGet());
        force.setProxyType("HTTP");
        force.setProxyHost("127.0.0.1");
        force.setProxyPort(1);
        force.setAvailableStatus(1);
        force.setForceProxy(1);
        when(vpnProxyRecordRepository.findTopByTenantId(tenantPk)).thenReturn(force);

        assertThrows(IllegalStateException.class, () -> binder.doApply(tenantPk));

        org.mockito.Mockito.verify(vpnProxyRecordRepository).updateCheckResult(
                org.mockito.ArgumentMatchers.eq(force.getId()), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.notNull());
        org.mockito.Mockito.verify(vpnProxyRecordRepository).updateAvailability(
                org.mockito.ArgumentMatchers.eq(force.getId()), org.mockito.ArgumentMatchers.eq(0),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.notNull());
        org.mockito.Mockito.verify(vpnProxyRecordRepository, org.mockito.Mockito.never())
                .save(org.mockito.ArgumentMatchers.any());
    }

    private static VpnProxyRecord proxy(boolean healthy) {
        VpnProxyRecord record = new VpnProxyRecord();
        record.setId(IDS.incrementAndGet());
        record.setProxyType("HTTP");
        record.setProxyHost("proxy-" + record.getId() + ".test");
        record.setProxyPort(8080);
        record.setAvailableStatus(1);
        record.setForceProxy(0);
        ProxyHealthCache.record(record, healthy, healthy ? "ok" : "down");
        return record;
    }

    @SuppressWarnings("unchecked")
    private Long stickyProxyId() throws Exception {
        Field stickyField = TenantProxyBinder.class.getDeclaredField("STICKY");
        stickyField.setAccessible(true);
        Map<String, Object> sticky = (Map<String, Object>) stickyField.get(null);
        Object choice = sticky.get(String.valueOf(tenantPk));
        assertNotNull(choice);
        Field idField = choice.getClass().getDeclaredField("proxyId");
        idField.setAccessible(true);
        return (Long) idField.get(choice);
    }
}
