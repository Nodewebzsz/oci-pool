package com.nodewebzsz.ociserver.service.login;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import com.nodewebzsz.ociserver.config.exception.RateLimitException;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 认证安全服务：统一管理登录失败锁定、验证码熔断作废、接口频控与告警收敛
 */
@Service
@Slf4j
public class AuthSecurityService {

    public static final int MAX_LOGIN_FAIL_COUNT = 5;
    public static final int LOGIN_LOCK_MINUTES = 15;

    public static final int MAX_VERIFY_FAIL_COUNT = 5;

    public static final int SEND_RATE_LIMIT_SECONDS = 60;
    public static final int ALERT_THROTTLE_MINUTES = 10;

    // 登录失败计数缓存 (15分钟)
    private Cache<String, AtomicInteger> loginFailCountCache;
    // 登录锁定标记缓存 (15分钟)
    private Cache<String, Long> loginLockCache;

    // 验证码输错计数缓存 (5分钟)
    private Cache<String, AtomicInteger> verifyFailCountCache;

    // 发送验证码 IP 限流缓存 (60秒)
    private Cache<String, Long> sendRateLimitCache;

    // 安全告警节流冷却缓存 (10分钟)
    private Cache<String, Long> alertThrottleCache;
    // 冷却期间被抑制的告警计数 (10分钟)
    private Cache<String, AtomicInteger> alertSuppressedCountCache;

    @PostConstruct
    public void init() {
        loginFailCountCache = CacheBuilder.newBuilder()
                .expireAfterWrite(LOGIN_LOCK_MINUTES, TimeUnit.MINUTES)
                .build();

        loginLockCache = CacheBuilder.newBuilder()
                .expireAfterWrite(LOGIN_LOCK_MINUTES, TimeUnit.MINUTES)
                .build();

        verifyFailCountCache = CacheBuilder.newBuilder()
                .expireAfterWrite(5, TimeUnit.MINUTES)
                .build();

        sendRateLimitCache = CacheBuilder.newBuilder()
                .expireAfterWrite(SEND_RATE_LIMIT_SECONDS, TimeUnit.SECONDS)
                .build();

        alertThrottleCache = CacheBuilder.newBuilder()
                .expireAfterWrite(ALERT_THROTTLE_MINUTES, TimeUnit.MINUTES)
                .build();

        alertSuppressedCountCache = CacheBuilder.newBuilder()
                .expireAfterWrite(ALERT_THROTTLE_MINUTES, TimeUnit.MINUTES)
                .build();
    }

    // ==================== 1. 登录密码防爆破 ====================

    /**
     * 检查当前 IP 或账号是否被锁定
     */
    public void checkLoginLock(String ip, String username) {
        if (isWhitelistedIp(ip)) {
            return;
        }

        if (StringUtils.isNotBlank(ip)) {
            Long ipLockUntil = loginLockCache.getIfPresent("ip:" + ip);
            if (ipLockUntil != null) {
                long remainingMinutes = Math.max(1, (ipLockUntil - System.currentTimeMillis()) / (60 * 1000));
                throw new IllegalStateException("当前网络地址尝试登录失败次数过多，已被临时锁定，请 " + remainingMinutes + " 分钟后再试");
            }
        }

        if (StringUtils.isNotBlank(username)) {
            Long userLockUntil = loginLockCache.getIfPresent("user:" + username);
            if (userLockUntil != null) {
                long remainingMinutes = Math.max(1, (userLockUntil - System.currentTimeMillis()) / (60 * 1000));
                throw new IllegalStateException("该账号尝试登录失败次数过多，已被系统临时保护，请 " + remainingMinutes + " 分钟后再试");
            }
        }
    }

    /**
     * 记录一次登录密码错误，返回提示信息。如果达到上限则执行锁定。
     */
    public String recordLoginFailure(String ip, String username) {
        long lockUntil = System.currentTimeMillis() + TimeUnit.MINUTES.toMillis(LOGIN_LOCK_MINUTES);
        boolean whitelisted = isWhitelistedIp(ip);

        int ipFails = 0;
        if (!whitelisted && StringUtils.isNotBlank(ip)) {
            ipFails = incrementCache(loginFailCountCache, "ip:" + ip);
            if (ipFails >= MAX_LOGIN_FAIL_COUNT) {
                loginLockCache.put("ip:" + ip, lockUntil);
                log.warn("【安全防御】IP [{}] 连续登录失败达 {} 次，已被锁定 {} 分钟", ip, ipFails, LOGIN_LOCK_MINUTES);
            }
        }

        int userFails = 0;
        if (StringUtils.isNotBlank(username)) {
            userFails = incrementCache(loginFailCountCache, "user:" + username);
            if (userFails >= MAX_LOGIN_FAIL_COUNT) {
                loginLockCache.put("user:" + username, lockUntil);
                log.warn("【安全防御】用户 [{}] 连续登录失败达 {} 次，已被锁定 {} 分钟", username, userFails, LOGIN_LOCK_MINUTES);
            }
        }

        int maxFails = Math.max(ipFails, userFails);
        if (maxFails >= MAX_LOGIN_FAIL_COUNT) {
            return "登录失败次数已达上限，系统已临时锁定该账号及访问来源 " + LOGIN_LOCK_MINUTES + " 分钟";
        } else {
            int remaining = MAX_LOGIN_FAIL_COUNT - maxFails;
            return "用户名或密码错误，还可尝试 " + remaining + " 次";
        }
    }

    /**
     * 登录成功后清除失败计数和锁定
     */
    public void clearLoginFailure(String ip, String username) {
        if (StringUtils.isNotBlank(ip)) {
            loginFailCountCache.invalidate("ip:" + ip);
            loginLockCache.invalidate("ip:" + ip);
        }
        if (StringUtils.isNotBlank(username)) {
            loginFailCountCache.invalidate("user:" + username);
            loginLockCache.invalidate("user:" + username);
        }
    }

    // ==================== 2. 验证码输错熔断作废 ====================

    /**
     * 记录一次验证码错误，若连续输错达到5次则返回 true 表示需作废验证码
     */
    public boolean recordVerifyCodeFailure(String type, String username) {
        String key = type + ":" + username;
        int fails = incrementCache(verifyFailCountCache, key);
        return fails >= MAX_VERIFY_FAIL_COUNT;
    }

    /**
     * 获取验证码剩余尝试机会
     */
    public int getVerifyCodeRemainingAttempts(String type, String username) {
        String key = type + ":" + username;
        AtomicInteger counter = verifyFailCountCache.getIfPresent(key);
        int current = (counter != null) ? counter.get() : 0;
        return Math.max(0, MAX_VERIFY_FAIL_COUNT - current);
    }

    /**
     * 验证码校验成功或已作废后清除错误计数
     */
    public void clearVerifyCodeFailure(String type, String username) {
        verifyFailCountCache.invalidate(type + ":" + username);
    }

    // ==================== 3. 发送验证码 IP 限流 ====================

    /**
     * 检查客户端发送验证码频率（1分钟最多1次），超过抛出 RateLimitException
     */
    public void checkAndRecordSendRateLimit(String ip) {
        if (isWhitelistedIp(ip)) {
            return;
        }
        if (StringUtils.isBlank(ip)) {
            return;
        }

        Long lastSendTime = sendRateLimitCache.getIfPresent(ip);
        long now = System.currentTimeMillis();
        if (lastSendTime != null) {
            long elapsedSeconds = (now - lastSendTime) / 1000;
            long waitSeconds = SEND_RATE_LIMIT_SECONDS - elapsedSeconds;
            if (waitSeconds > 0) {
                throw new RateLimitException("请求验证码过于频繁，请等待 " + waitSeconds + " 秒后再试");
            }
        }
        sendRateLimitCache.put(ip, now);
    }

    // ==================== 4. 安全告警收敛节流 ====================

    /**
     * 判断指定类型的安全告警是否允许推送（10分钟内只推1次）
     * @return true 允许推送并开启10分钟冷却；false 处于冷却期，静默抑制
     */
    public boolean shouldSendAlert(String alertType) {
        Long lastAlertTime = alertThrottleCache.getIfPresent(alertType);
        long now = System.currentTimeMillis();
        if (lastAlertTime == null) {
            alertThrottleCache.put(alertType, now);
            alertSuppressedCountCache.invalidate(alertType);
            return true;
        } else {
            incrementCache(alertSuppressedCountCache, alertType);
            return false;
        }
    }

    /**
     * 获取处于冷却期内被抑制的告警次数
     */
    public int getSuppressedAlertCount(String alertType) {
        AtomicInteger count = alertSuppressedCountCache.getIfPresent(alertType);
        return (count != null) ? count.get() : 0;
    }

    // ==================== 内部工具 ====================

    private int incrementCache(Cache<String, AtomicInteger> cache, String key) {
        try {
            AtomicInteger counter = cache.get(key, () -> new AtomicInteger(0));
            return counter.incrementAndGet();
        } catch (Exception e) {
            log.error("自增缓存计数异常: key={}", key, e);
            return 1;
        }
    }

    private boolean isWhitelistedIp(String ip) {
        return "127.0.0.1".equals(ip) || "0:0:0:0:0:0:0:1".equals(ip) || "localhost".equalsIgnoreCase(ip);
    }
}
