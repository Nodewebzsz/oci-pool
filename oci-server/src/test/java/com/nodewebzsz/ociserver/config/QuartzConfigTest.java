package com.nodewebzsz.ociserver.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.ApplicationContext;
import org.springframework.scheduling.quartz.SchedulerFactoryBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;
import java.util.Properties;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.*;

class QuartzConfigTest {

    @Test
    void schedulerFactorySharesPrimaryDataSourceWithoutDuplicateMyDsPool() throws Exception {
        DataSource ds = mock(DataSource.class);
        Connection conn = mock(Connection.class);
        Statement stmt = mock(Statement.class);
        when(ds.getConnection()).thenReturn(conn);
        when(conn.createStatement()).thenReturn(stmt);

        PlatformTransactionManager tx = mock(PlatformTransactionManager.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<PlatformTransactionManager> txProvider = mock(ObjectProvider.class);
        doAnswer(inv -> {
            java.util.function.Consumer<PlatformTransactionManager> c = inv.getArgument(0);
            c.accept(tx);
            return null;
        }).when(txProvider).ifAvailable(any());

        QuartzConfig config = new QuartzConfig();
        ReflectionTestUtils.setField(config, "applicationContext", mock(ApplicationContext.class));
        ReflectionTestUtils.setField(config, "dataSource", ds);
        ReflectionTestUtils.setField(config, "transactionManagerProvider", txProvider);

        SchedulerFactoryBean factory = config.schedulerFactoryBean();
        verify(stmt).executeUpdate(contains("REPLACE(JOB_CLASS_NAME, 'com.doubledimple.', 'com.nodewebzsz.')"));

        Properties props = (Properties) ReflectionTestUtils.getField(factory, "quartzProperties");
        assertNotNull(props);
        assertNull(props.getProperty("org.quartz.jobStore.dataSource"));
        assertNull(props.getProperty("org.quartz.dataSource.myDS.provider"));
        assertNull(props.getProperty("org.quartz.jobStore.class"));
        assertSame(tx, ReflectionTestUtils.getField(factory, "transactionManager"));
    }
}
