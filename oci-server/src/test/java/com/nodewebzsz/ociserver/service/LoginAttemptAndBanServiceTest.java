package com.nodewebzsz.ociserver.service;

import com.nodewebzsz.dao.entity.BanRecord;
import com.nodewebzsz.dao.entity.LoginFailureState;
import com.nodewebzsz.dao.repository.BanRecordRepository;
import com.nodewebzsz.dao.repository.LoginFailureStateRepository;
import com.nodewebzsz.ociserver.config.exception.IpBannedException;
import com.nodewebzsz.ociserver.service.impl.BanServiceImpl;
import com.nodewebzsz.ociserver.service.login.AuthSecurityService;
import com.nodewebzsz.ociserver.service.security.LoginIpTransactions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.util.*;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class LoginAttemptAndBanServiceTest {

    private final Map<String, LoginFailureState> failureStore = new HashMap<>();
    private final Map<Long, BanRecord> banStore = new LinkedHashMap<>();
    private final AtomicLong idGen = new AtomicLong(1);

    private LoginFailureStateRepository failureRepository;
    private BanRecordRepository banRepository;
    private LoginAttemptService loginAttemptService;
    private BanServiceImpl banService;
    private AuthSecurityService authSecurityService;

    @BeforeEach
    void setUp() {
        failureStore.clear();
        banStore.clear();
        idGen.set(1);

        PlatformTransactionManager txManager = new PlatformTransactionManager() {
            @Override
            public TransactionStatus getTransaction(TransactionDefinition definition) {
                return new SimpleTransactionStatus();
            }

            @Override
            public void commit(TransactionStatus status) {
            }

            @Override
            public void rollback(TransactionStatus status) {
            }
        };

        failureRepository = mock(LoginFailureStateRepository.class);
        when(failureRepository.findById(anyString())).thenAnswer(inv -> Optional.ofNullable(failureStore.get(inv.getArgument(0))));
        when(failureRepository.save(any(LoginFailureState.class))).thenAnswer(inv -> {
            LoginFailureState state = inv.getArgument(0);
            failureStore.put(state.getIpAddress(), state);
            return state;
        });
        doAnswer(inv -> {
            LoginFailureState state = inv.getArgument(0);
            failureStore.remove(state.getIpAddress());
            return null;
        }).when(failureRepository).delete(any(LoginFailureState.class));

        banRepository = mock(BanRecordRepository.class);
        when(banRepository.save(any(BanRecord.class))).thenAnswer(inv -> {
            BanRecord record = inv.getArgument(0);
            if (record.getId() == null) {
                record.setId(idGen.getAndIncrement());
            }
            banStore.put(record.getId(), record);
            return record;
        });
        when(banRepository.saveAll(any())).thenAnswer(inv -> {
            Iterable<BanRecord> records = inv.getArgument(0);
            List<BanRecord> saved = new ArrayList<>();
            for (BanRecord record : records) {
                banStore.put(record.getId(), record);
                saved.add(record);
            }
            return saved;
        });
        when(banRepository.findById(anyLong())).thenAnswer(inv -> Optional.ofNullable(banStore.get(inv.getArgument(0))));
        when(banRepository.findTopByIpAddressAndStatusOrderByIdDesc(anyString(), anyInt())).thenAnswer(inv -> {
            String ip = inv.getArgument(0);
            Integer status = inv.getArgument(1);
            return banStore.values().stream()
                    .filter(r -> ip.equals(r.getIpAddress()) && status.equals(r.getStatus()))
                    .max(Comparator.comparing(BanRecord::getId))
                    .orElse(null);
        });
        when(banRepository.findAllByIpAddressAndStatusOrderByIdDesc(anyString(), anyInt())).thenAnswer(inv -> {
            String ip = inv.getArgument(0);
            Integer status = inv.getArgument(1);
            List<BanRecord> list = new ArrayList<>();
            for (BanRecord r : banStore.values()) {
                if (ip.equals(r.getIpAddress()) && status.equals(r.getStatus())) {
                    list.add(r);
                }
            }
            list.sort(Comparator.comparing(BanRecord::getId).reversed());
            return list;
        });

        LoginIpTransactions transactions = new LoginIpTransactions(txManager);
        loginAttemptService = new LoginAttemptService(failureRepository, banRepository, transactions);

        authSecurityService = mock(AuthSecurityService.class);
        banService = new BanServiceImpl();
        ReflectionTestUtils.setField(banService, "banRecordRepository", banRepository);
        ReflectionTestUtils.setField(banService, "loginFailureStateRepository", failureRepository);
        ReflectionTestUtils.setField(banService, "loginIpTransactions", transactions);
        ReflectionTestUtils.setField(banService, "authSecurityService", authSecurityService);
    }

    @Test
    void bansIpAfterTwoUnknownUsernames() {
        String ip = "203.0.113.10";
        LoginAttemptService.FailureResult first = loginAttemptService.recordFailure(ip, true);
        assertFalse(first.isBanned());
        assertEquals(1, first.getFailureCount());
        assertEquals(2, first.getThreshold());

        LoginAttemptService.FailureResult second = loginAttemptService.recordFailure(ip, true);
        assertTrue(second.isBanned());
        assertTrue(second.isNewlyBanned());
        assertThrows(IpBannedException.class, () -> loginAttemptService.assertAllowed(ip));
    }

    @Test
    void bansIpAfterThreeWrongPasswordsAndUnbanClearsFailureState() {
        String ip = "203.0.113.20";
        assertFalse(loginAttemptService.recordFailure(ip, false).isBanned());
        assertFalse(loginAttemptService.recordFailure(ip, false).isBanned());
        LoginAttemptService.FailureResult third = loginAttemptService.recordFailure(ip, false);
        assertTrue(third.isBanned());
        assertTrue(third.isNewlyBanned());

        assertNotNull(banRepository.findTopByIpAddressAndStatusOrderByIdDesc(ip, 1));
        assertThrows(IpBannedException.class, () -> loginAttemptService.assertAllowed(ip));
        assertTrue(banService.unbanIp(ip, "manual release", "admin"));
        assertNull(banRepository.findTopByIpAddressAndStatusOrderByIdDesc(ip, 1));
        assertNull(failureStore.get(ip));
        verify(authSecurityService).clearIpFailure(ip);
        assertDoesNotThrow(() -> loginAttemptService.assertAllowed(ip));
    }

    @Test
    void loginSucceededClearsPreviousFailures() {
        String ip = "203.0.113.30";
        loginAttemptService.recordFailure(ip, false);
        assertNotNull(failureStore.get(ip));

        loginAttemptService.loginSucceeded(ip);
        assertNull(failureStore.get(ip));
    }
}
