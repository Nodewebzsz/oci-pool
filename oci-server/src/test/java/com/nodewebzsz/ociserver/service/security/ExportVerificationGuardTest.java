package com.nodewebzsz.ociserver.service.security;

import com.nodewebzsz.dao.entity.LoginUser;
import com.nodewebzsz.dao.repository.LoginUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ExportVerificationGuardTest {

    private LoginUserRepository userRepository;
    private LoginUser admin;
    private PlatformTransactionManager txManager;

    @BeforeEach
    void setUp() {
        admin = new LoginUser();
        admin.setId(42L);
        admin.setUsername("admin");

        userRepository = mock(LoginUserRepository.class);
        when(userRepository.findByUsernameForUpdate("admin")).thenReturn(Optional.of(admin));
        when(userRepository.save(any(LoginUser.class))).thenAnswer(inv -> inv.getArgument(0));

        txManager = new PlatformTransactionManager() {
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
    }

    @Test
    void blocksAfterTwoWrongAttemptsAndResetsNextDay() {
        Clock day1 = Clock.fixed(Instant.parse("2026-11-26T10:00:00Z"), ZoneOffset.UTC);
        ExportVerificationGuard guardDay1 = new ExportVerificationGuard(userRepository, txManager, day1);
        Map<Long, String> codes = new HashMap<>();

        String issued = guardDay1.issueCode("admin", userId -> {
            codes.put(userId, "AB12CD34");
            return "AB12CD34";
        });
        assertEquals("AB12CD34", issued);

        assertThrows(ExportVerificationGuard.ExportVerificationException.class,
                () -> guardDay1.verify("admin", "WRONG123", codes::get, (id, c) -> codes.remove(id, c)));
        assertEquals(1, admin.getExportVerificationWrongCount());

        guardDay1.recordPasswordFailure("admin");
        assertEquals(2, admin.getExportVerificationWrongCount());

        assertThrows(ExportVerificationGuard.ExportVerificationException.class,
                () -> guardDay1.issueCode("admin", userId -> "NEWCODE1"));

        Clock day2 = Clock.fixed(Instant.parse("2026-11-27T00:01:00Z"), ZoneOffset.UTC);
        ExportVerificationGuard guardDay2 = new ExportVerificationGuard(userRepository, txManager, day2);
        String nextDayCode = guardDay2.issueCode("admin", userId -> {
            codes.put(userId, "ZX98CV76");
            return "ZX98CV76";
        });
        assertEquals("ZX98CV76", nextDayCode);

        assertDoesNotThrow(() -> guardDay2.verify("admin", "zx98cv76", codes::get, (id, c) -> codes.remove(id, c)));
        assertFalse(codes.containsKey(42L));
    }

    @Test
    void expiredCodeDoesNotConsumeDailyFailureQuota() {
        Clock clock = Clock.fixed(Instant.parse("2026-11-26T10:00:00Z"), ZoneOffset.UTC);
        ExportVerificationGuard guard = new ExportVerificationGuard(userRepository, txManager, clock);
        Map<Long, String> codes = new HashMap<>();

        assertThrows(ExportVerificationGuard.ExportVerificationException.class,
                () -> guard.verify("admin", "AB12CD34", codes::get, (id, c) -> codes.remove(id, c)));
        assertEquals(0, admin.getExportVerificationWrongCount());
    }
}
