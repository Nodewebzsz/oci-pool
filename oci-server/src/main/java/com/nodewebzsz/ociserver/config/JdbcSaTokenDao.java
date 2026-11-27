package com.nodewebzsz.ociserver.config;

import cn.dev33.satoken.dao.SaSessionForJacksonCustomized;
import cn.dev33.satoken.dao.SaTokenDao;
import cn.dev33.satoken.session.SaSession;
import cn.dev33.satoken.strategy.SaStrategy;
import cn.dev33.satoken.util.SaFoxUtil;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.jsontype.BasicPolymorphicTypeValidator;
import com.fasterxml.jackson.databind.jsontype.PolymorphicTypeValidator;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 基于关系型数据库（H2 / MySQL）的 Sa-Token 会话持久化实现。
 * 当未配置 Redis 或 Redis 不可用时作为回退存储，保证本机桌面端或单机部署重启后 30 天免登会话仍然有效。
 */
@Slf4j
public class JdbcSaTokenDao implements SaTokenDao {

    private static final String TABLE_NAME = "sa_token_store";
    private static final String TYPE_STRING = "S";
    private static final String TYPE_OBJECT = "O";
    private static final long CLEANUP_INTERVAL_MS = 5 * 60 * 1000L;

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final AtomicLong lastCleanupAt = new AtomicLong(0L);

    @JsonIgnoreProperties({"timeout"})
    private abstract static class SaSessionMixin {
    }

    public JdbcSaTokenDao(DataSource dataSource) {
        this.jdbcTemplate = new JdbcTemplate(dataSource);
        this.objectMapper = buildObjectMapper();
        initSchema();
    }

    private static ObjectMapper buildObjectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        mapper.addMixIn(SaSession.class, SaSessionMixin.class);
        PolymorphicTypeValidator ptv = BasicPolymorphicTypeValidator.builder()
                .allowIfSubType("cn.dev33.satoken.")
                .allowIfSubType("java.util.")
                .allowIfSubType("java.lang.")
                .allowIfSubType("java.time.")
                .build();
        mapper.activateDefaultTyping(ptv, ObjectMapper.DefaultTyping.NON_FINAL, JsonTypeInfo.As.PROPERTY);
        return mapper;
    }

    private void initSchema() {
        SaStrategy.instance.createSession = SaSessionForJacksonCustomized::new;
        jdbcTemplate.execute(
                "CREATE TABLE IF NOT EXISTS " + TABLE_NAME + " (" +
                        "store_key VARCHAR(255) NOT NULL PRIMARY KEY, " +
                        "store_type VARCHAR(16) NOT NULL, " +
                        "store_value TEXT, " +
                        "expire_at BIGINT NOT NULL" +
                        ")"
        );
        cleanupExpired(true);
    }

    @Override
    public String get(String key) {
        RowEntry entry = loadRow(key);
        if (entry == null) {
            return null;
        }
        return entry.value;
    }

    @Override
    public void set(String key, String value, long timeout) {
        if (timeout == 0 || timeout <= SaTokenDao.NOT_VALUE_EXPIRE) {
            return;
        }
        upsertRow(key, TYPE_STRING, value, computeExpireAt(timeout));
        cleanupExpired(false);
    }

    @Override
    public void update(String key, String value) {
        if (getTimeout(key) == SaTokenDao.NOT_VALUE_EXPIRE) {
            return;
        }
        jdbcTemplate.update(
                "UPDATE " + TABLE_NAME + " SET store_type = ?, store_value = ? WHERE store_key = ?",
                TYPE_STRING, value, key
        );
    }

    @Override
    public void delete(String key) {
        jdbcTemplate.update("DELETE FROM " + TABLE_NAME + " WHERE store_key = ?", key);
    }

    @Override
    public long getTimeout(String key) {
        RowEntry entry = loadRow(key);
        if (entry == null) {
            return SaTokenDao.NOT_VALUE_EXPIRE;
        }
        if (entry.expireAt == SaTokenDao.NEVER_EXPIRE) {
            return SaTokenDao.NEVER_EXPIRE;
        }
        long remainingMs = entry.expireAt - System.currentTimeMillis();
        if (remainingMs <= 0) {
            delete(key);
            return SaTokenDao.NOT_VALUE_EXPIRE;
        }
        return Math.max(1L, remainingMs / 1000L);
    }

    @Override
    public void updateTimeout(String key, long timeout) {
        if (timeout == SaTokenDao.NEVER_EXPIRE) {
            if (getTimeout(key) == SaTokenDao.NOT_VALUE_EXPIRE) {
                return;
            }
            jdbcTemplate.update(
                    "UPDATE " + TABLE_NAME + " SET expire_at = ? WHERE store_key = ?",
                    SaTokenDao.NEVER_EXPIRE, key
            );
            return;
        }
        if (timeout <= 0) {
            delete(key);
            return;
        }
        if (getTimeout(key) == SaTokenDao.NOT_VALUE_EXPIRE) {
            return;
        }
        jdbcTemplate.update(
                "UPDATE " + TABLE_NAME + " SET expire_at = ? WHERE store_key = ?",
                computeExpireAt(timeout), key
        );
    }

    @Override
    public Object getObject(String key) {
        RowEntry entry = loadRow(key);
        if (entry == null || entry.value == null) {
            return null;
        }
        if (TYPE_STRING.equals(entry.type)) {
            return entry.value;
        }
        try {
            return objectMapper.readValue(entry.value, Object.class);
        } catch (Exception e) {
            log.warn("[sa-token] 反序列化数据库会话失败，已清理损坏记录 key={}: {}", key, e.getMessage());
            delete(key);
            return null;
        }
    }

    @Override
    public void setObject(String key, Object object, long timeout) {
        if (timeout == 0 || timeout <= SaTokenDao.NOT_VALUE_EXPIRE) {
            return;
        }
        String serialized = serializeObject(object);
        if (serialized == null) {
            return;
        }
        upsertRow(key, TYPE_OBJECT, serialized, computeExpireAt(timeout));
        cleanupExpired(false);
    }

    @Override
    public void updateObject(String key, Object object) {
        if (getObjectTimeout(key) == SaTokenDao.NOT_VALUE_EXPIRE) {
            return;
        }
        String serialized = serializeObject(object);
        if (serialized == null) {
            return;
        }
        jdbcTemplate.update(
                "UPDATE " + TABLE_NAME + " SET store_type = ?, store_value = ? WHERE store_key = ?",
                TYPE_OBJECT, serialized, key
        );
    }

    @Override
    public void deleteObject(String key) {
        delete(key);
    }

    @Override
    public long getObjectTimeout(String key) {
        return getTimeout(key);
    }

    @Override
    public void updateObjectTimeout(String key, long timeout) {
        updateTimeout(key, timeout);
    }

    @Override
    public List<String> searchData(String prefix, String keyword, int start, int size, boolean sortType) {
        cleanupExpired(true);
        String safePrefix = prefix == null ? "" : prefix;
        String safeKeyword = keyword == null ? "" : keyword;
        String likePattern = safePrefix + "%" + safeKeyword + "%";
        List<String> keys = jdbcTemplate.queryForList(
                "SELECT store_key FROM " + TABLE_NAME + " WHERE store_key LIKE ?",
                String.class,
                likePattern
        );
        return SaFoxUtil.searchList(keys, prefix, keyword, start, size, sortType);
    }

    private RowEntry loadRow(String key) {
        List<RowEntry> rows = jdbcTemplate.query(
                "SELECT store_type, store_value, expire_at FROM " + TABLE_NAME + " WHERE store_key = ?",
                (rs, rowNum) -> new RowEntry(
                        rs.getString("store_type"),
                        rs.getString("store_value"),
                        rs.getLong("expire_at")
                ),
                key
        );
        if (rows.isEmpty()) {
            return null;
        }
        RowEntry entry = rows.get(0);
        if (entry.expireAt != SaTokenDao.NEVER_EXPIRE && entry.expireAt <= System.currentTimeMillis()) {
            delete(key);
            return null;
        }
        return entry;
    }

    private void upsertRow(String key, String type, String value, long expireAt) {
        int updated = jdbcTemplate.update(
                "UPDATE " + TABLE_NAME + " SET store_type = ?, store_value = ?, expire_at = ? WHERE store_key = ?",
                type, value, expireAt, key
        );
        if (updated > 0) {
            return;
        }
        try {
            jdbcTemplate.update(
                    "INSERT INTO " + TABLE_NAME + " (store_key, store_type, store_value, expire_at) VALUES (?, ?, ?, ?)",
                    key, type, value, expireAt
            );
        } catch (DataIntegrityViolationException race) {
            jdbcTemplate.update(
                    "UPDATE " + TABLE_NAME + " SET store_type = ?, store_value = ?, expire_at = ? WHERE store_key = ?",
                    type, value, expireAt, key
            );
        }
    }

    private long computeExpireAt(long timeoutSeconds) {
        if (timeoutSeconds == SaTokenDao.NEVER_EXPIRE) {
            return SaTokenDao.NEVER_EXPIRE;
        }
        return System.currentTimeMillis() + timeoutSeconds * 1000L;
    }

    private String serializeObject(Object object) {
        if (object == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(object);
        } catch (Exception e) {
            log.error("[sa-token] 序列化数据库会话对象失败: {}", e.getMessage());
            return null;
        }
    }

    private void cleanupExpired(boolean force) {
        long now = System.currentTimeMillis();
        long prev = lastCleanupAt.get();
        if (!force && now - prev < CLEANUP_INTERVAL_MS) {
            return;
        }
        if (!force && !lastCleanupAt.compareAndSet(prev, now)) {
            return;
        }
        if (force) {
            lastCleanupAt.set(now);
        }
        try {
            jdbcTemplate.update(
                    "DELETE FROM " + TABLE_NAME + " WHERE expire_at > 0 AND expire_at <= ?",
                    now
            );
        } catch (Exception e) {
            log.debug("[sa-token] 清理过期会话记录失败: {}", e.getMessage());
        }
    }

    private static final class RowEntry {
        final String type;
        final String value;
        final long expireAt;

        RowEntry(String type, String value, long expireAt) {
            this.type = type;
            this.value = value;
            this.expireAt = expireAt;
        }
    }
}
