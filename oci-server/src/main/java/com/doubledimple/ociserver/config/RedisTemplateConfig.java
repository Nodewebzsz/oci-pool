package com.doubledimple.ociserver.config;

import cn.dev33.satoken.SaManager;
import cn.dev33.satoken.dao.SaTokenDao;
import cn.dev33.satoken.dao.SaTokenDaoRedisJackson;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationListener;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

/**
 * RedisTemplate + sa-token 的 Redis 会话持久化配置。
 * <p>本项目只扫 {@code com.doubledimple.*},故 sa-token-redis-jackson 的
 * {@link SaTokenDaoRedisJackson}(@Component 位于 {@code cn.dev33.satoken.dao})不会自动注册,
 * sa-token 默认用内存态 {@code SaTokenDaoDefaultImpl},重启即丢会话。
 * 这里显式声明 Redis SaTokenDao,并在所有 bean 创建完成后(ContextRefreshedEvent)
 * 强制 {@code SaManager.setSaTokenDao(...)},让 token/会话写入 Redis,跨重启保持。
 */
@Slf4j
@Configuration
public class RedisTemplateConfig {

    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory factory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);

        StringRedisSerializer stringSerializer = new StringRedisSerializer();
        GenericJackson2JsonRedisSerializer jsonSerializer = new GenericJackson2JsonRedisSerializer();

        template.setKeySerializer(stringSerializer);
        template.setHashKeySerializer(stringSerializer);
        template.setValueSerializer(jsonSerializer);
        template.setHashValueSerializer(jsonSerializer);
        template.afterPropertiesSet();
        return template;
    }

    @Bean
    public SaTokenDao saTokenDaoRedis(RedisConnectionFactory factory) {
        log.info("[sa-token] 创建 Redis SaTokenDao bean...");
        SaTokenDaoRedisJackson dao = new SaTokenDaoRedisJackson();
        dao.init(factory);
        return dao;
    }

    // 全部 bean 创建完成后,强制 sa-token 用 Redis dao(此时不再有其它 setSaTokenDao 覆盖)
    @Bean
    public ApplicationListener<ContextRefreshedEvent> saTokenDaoProbe(SaTokenDao saTokenDaoRedis) {
        return ev -> {
            SaManager.setSaTokenDao(saTokenDaoRedis);
            log.info("[sa-token] 生效 SaTokenDao = {}", SaManager.getSaTokenDao().getClass().getName());
        };
    }
}
