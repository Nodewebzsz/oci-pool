package com.nodewebzsz.ociserver.config;

import org.quartz.Scheduler;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.quartz.SchedulerFactoryBean;
import org.springframework.scheduling.quartz.SpringBeanJobFactory;
import org.springframework.transaction.PlatformTransactionManager;

import javax.annotation.Resource;
import javax.sql.DataSource;
import java.util.Properties;

import lombok.extern.slf4j.Slf4j;

/**
 * Quartz调度器配置
 * 统一管理所有定时任务
 */
@Slf4j
@Configuration
public class QuartzConfig {

    @Resource
    private ApplicationContext applicationContext;

    @Resource
    private DataSource dataSource;

    @Resource
    private ObjectProvider<PlatformTransactionManager> transactionManagerProvider;

    @Bean
    public SpringBeanJobFactory springBeanJobFactory() {
        SpringBeanJobFactory jobFactory = new SpringBeanJobFactory();
        jobFactory.setApplicationContext(applicationContext);
        return jobFactory;
    }

    /**
     * 配置Quartz调度器
     */
    @Bean
    public SchedulerFactoryBean schedulerFactoryBean() {
        // 自动向前兼容迁移：如果历史数据库 QRTZ_JOB_DETAILS 中存留 com.doubledimple 历史包名，无缝更新为 com.nodewebzsz
        try (java.sql.Connection conn = dataSource.getConnection();
             java.sql.Statement stmt = conn.createStatement()) {
            stmt.executeUpdate("UPDATE QRTZ_JOB_DETAILS SET JOB_CLASS_NAME = REPLACE(JOB_CLASS_NAME, 'com.doubledimple.', 'com.nodewebzsz.') WHERE JOB_CLASS_NAME LIKE 'com.doubledimple.%'");
        } catch (Exception e) {
            log.debug("Quartz migration note: {}", e.getMessage());
        }

        SchedulerFactoryBean schedulerFactoryBean = new SchedulerFactoryBean();
        schedulerFactoryBean.setJobFactory(springBeanJobFactory());

        schedulerFactoryBean.setDataSource(dataSource);
        if (transactionManagerProvider != null) {
            transactionManagerProvider.ifAvailable(schedulerFactoryBean::setTransactionManager);
        }
        schedulerFactoryBean.setOverwriteExistingJobs(true);
        schedulerFactoryBean.setAutoStartup(true);
        schedulerFactoryBean.setWaitForJobsToCompleteOnShutdown(true);
        schedulerFactoryBean.setStartupDelay(5);
        schedulerFactoryBean.setApplicationContextSchedulerContextKey("applicationContext");

        Properties quartzProperties = new Properties();
        quartzProperties.put("org.quartz.scheduler.instanceName", "OciServerScheduler");
        quartzProperties.put("org.quartz.scheduler.instanceId", "AUTO");

        // 线程池配置
        quartzProperties.put("org.quartz.threadPool.class", "org.quartz.simpl.SimpleThreadPool");
        quartzProperties.put("org.quartz.threadPool.threadCount", "20");
        quartzProperties.put("org.quartz.threadPool.threadPriority", "5");

        // 持久化配置
        quartzProperties.put("org.quartz.jobStore.driverDelegateClass", "org.quartz.impl.jdbcjobstore.StdJDBCDelegate");
        quartzProperties.put("org.quartz.jobStore.tablePrefix", "QRTZ_");
        quartzProperties.put("org.quartz.jobStore.useProperties", "true");
        quartzProperties.put("org.quartz.jobStore.isClustered", "false");
        quartzProperties.put("org.quartz.jobStore.misfireThreshold", "60000");

        schedulerFactoryBean.setQuartzProperties(quartzProperties);

        return schedulerFactoryBean;
    }

    /**
     * 显式创建Scheduler Bean
     */
    @Bean
    public Scheduler scheduler(SchedulerFactoryBean schedulerFactoryBean) {
        schedulerFactoryBean.setAutoStartup(false);
        return schedulerFactoryBean.getScheduler();
    }
}
