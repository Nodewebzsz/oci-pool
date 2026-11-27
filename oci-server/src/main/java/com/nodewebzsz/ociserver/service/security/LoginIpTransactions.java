package com.nodewebzsz.ociserver.service.security;

import com.google.common.net.InetAddresses;
import com.nodewebzsz.ociserver.config.exception.IpBannedException;
import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.net.InetAddress;
import java.util.function.Function;
import java.util.function.Supplier;

@Component
@DependsOn("banRecordAddressMigration")
public class LoginIpTransactions {

    private static final int LOCK_COUNT = 256;

    private final Object[] locks = new Object[LOCK_COUNT];
    private final Object[] recordLocks = new Object[LOCK_COUNT];
    private final TransactionTemplate transaction;

    public LoginIpTransactions(PlatformTransactionManager transactionManager) {
        this.transaction = new TransactionTemplate(transactionManager);
        this.transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        for (int index = 0; index < locks.length; index++) {
            locks[index] = new Object();
            recordLocks[index] = new Object();
        }
    }

    public <T> T executeRecord(long recordId, Supplier<T> operation) {
        int hash = Long.hashCode(recordId);
        Object lock = recordLocks[(hash & Integer.MAX_VALUE) % recordLocks.length];
        synchronized (lock) {
            return transaction.execute(status -> operation.get());
        }
    }

    public <T> T execute(String ip, Function<String, T> operation) {
        String address = normalizeIp(ip);
        Object lock = locks[(address.hashCode() & Integer.MAX_VALUE) % locks.length];
        synchronized (lock) {
            return transaction.execute(status -> operation.apply(address));
        }
    }

    public <T> T withLock(String ip, Function<String, T> operation) {
        String address = normalizeIp(ip);
        Object lock = locks[(address.hashCode() & Integer.MAX_VALUE) % locks.length];
        synchronized (lock) {
            return operation.apply(address);
        }
    }

    public <T> T executeInCurrentTransaction(String ip, Function<String, T> operation) {
        String address = normalizeIp(ip);
        Object lock = locks[(address.hashCode() & Integer.MAX_VALUE) % locks.length];
        if (!Thread.holdsLock(lock) || !TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException("Login completion requires the IP lock and an active transaction");
        }
        return operation.apply(address);
    }

    public static String normalizeIp(String ip) {
        if (ip == null) {
            throw new IpBannedException("无法识别IP来源，拒绝访问。");
        }
        try {
            InetAddress address = InetAddresses.forString(ip.trim());
            if (address.isLoopbackAddress()) {
                return "127.0.0.1";
            }
            return InetAddresses.toAddrString(address);
        } catch (IllegalArgumentException e) {
            throw new IpBannedException("无法识别IP来源，拒绝访问。");
        }
    }
}
