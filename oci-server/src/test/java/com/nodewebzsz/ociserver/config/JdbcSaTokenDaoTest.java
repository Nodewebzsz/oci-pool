package com.nodewebzsz.ociserver.config;

import cn.dev33.satoken.dao.SaSessionForJacksonCustomized;
import cn.dev33.satoken.dao.SaTokenDao;
import cn.dev33.satoken.session.SaSession;
import cn.dev33.satoken.stp.SaLoginModel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import javax.sql.DataSource;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class JdbcSaTokenDaoTest {

    private DataSource dataSource;
    private JdbcSaTokenDao dao;

    @BeforeEach
    void setUp() {
        String dbName = "satoken_test_" + UUID.randomUUID().toString().replace("-", "");
        DriverManagerDataSource ds = new DriverManagerDataSource();
        ds.setDriverClassName("org.h2.Driver");
        ds.setUrl("jdbc:h2:mem:" + dbName + ";MODE=MySQL;DB_CLOSE_DELAY=-1");
        ds.setUsername("sa");
        ds.setPassword("");
        this.dataSource = ds;
        this.dao = new JdbcSaTokenDao(dataSource);
    }

    @Test
    void persistsStringsAndSaSessionAcrossDaoRestart() {
        String tokenKey = "satoken:login:token:test-uuid-123";
        dao.set(tokenKey, "zszweb", 2592000L);
        assertEquals("zszweb", dao.get(tokenKey));
        assertTrue(dao.getTimeout(tokenKey) > 2590000L);

        SaSessionForJacksonCustomized session = new SaSessionForJacksonCustomized("satoken:login:session:zszweb");
        session.setLoginId("zszweb");
        session.addTokenSign("test-uuid-123", "DEF");
        session.set("role", "admin");
        dao.setObject(session.getId(), session, 2592000L);

        // Simulate JVM/backend restart by instantiating a brand-new JdbcSaTokenDao against the same DB
        JdbcSaTokenDao restartedDao = new JdbcSaTokenDao(dataSource);
        assertEquals("zszweb", restartedDao.get(tokenKey));

        Object restoredObj = restartedDao.getObject(session.getId());
        assertNotNull(restoredObj);
        assertInstanceOf(SaSession.class, restoredObj);
        SaSession restoredSession = (SaSession) restoredObj;
        assertEquals("zszweb", restoredSession.getLoginId());
        assertEquals("admin", restoredSession.get("role"));
        assertNotNull(restoredSession.getTokenSign("test-uuid-123"));

        restartedDao.delete(tokenKey);
        assertNull(restartedDao.get(tokenKey));
        assertEquals(SaTokenDao.NOT_VALUE_EXPIRE, restartedDao.getTimeout(tokenKey));
    }

    @Test
    void supportsUpdateTimeoutNeverExpireAndSearch() {
        dao.set("satoken:login:token:a", "userA", 60L);
        dao.set("satoken:login:token:b", "userB", SaTokenDao.NEVER_EXPIRE);

        assertEquals(SaTokenDao.NEVER_EXPIRE, dao.getTimeout("satoken:login:token:b"));
        dao.update("satoken:login:token:a", "userA2");
        assertEquals("userA2", dao.get("satoken:login:token:a"));

        dao.updateTimeout("satoken:login:token:a", SaTokenDao.NEVER_EXPIRE);
        assertEquals(SaTokenDao.NEVER_EXPIRE, dao.getTimeout("satoken:login:token:a"));

        List<String> keys = dao.searchData("satoken:login:token:", "", 0, -1, true);
        assertEquals(2, keys.size());
        assertTrue(keys.contains("satoken:login:token:a"));
        assertTrue(keys.contains("satoken:login:token:b"));
    }

    @Test
    void authSessionHelperBuildsDistinctModelsForRememberMe() {
        SaLoginModel remembered = AuthSessionHelper.buildLoginModel(true);
        assertEquals(Boolean.TRUE, remembered.getIsLastingCookie());
        assertEquals(AuthSessionHelper.REMEMBER_ME_TIMEOUT_SECONDS, remembered.getTimeout());
        assertEquals(SaTokenDao.NEVER_EXPIRE, remembered.getActiveTimeout());

        SaLoginModel sessionOnly = AuthSessionHelper.buildLoginModel(false);
        assertEquals(Boolean.FALSE, sessionOnly.getIsLastingCookie());
        assertNull(sessionOnly.getActiveTimeout());
    }
}
