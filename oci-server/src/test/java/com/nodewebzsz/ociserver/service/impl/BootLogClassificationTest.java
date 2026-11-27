package com.nodewebzsz.ociserver.service.impl;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BootLogClassificationTest {

    private static String line(String logger, String message) {
        return "2026-11-26 21:50:00 [oci-api-1] [NONE] INFO  " + logger + " - " + message;
    }

    @Test
    void acceptsOciLogAndErrorBuilders() {
        assertTrue(LogServiceImpl.isBootLogLine(
                line("c.n.ociserver.config.OciLogBuilder", "[TaskId=12] 未完成开机，将在60秒后重试")));
        assertTrue(LogServiceImpl.isBootLogLine(
                line("c.n.ociserver.config.OciErrorBuilder", "异常告警")));
    }

    @Test
    void acceptsTaskTaggedExecutionLogs() {
        assertTrue(LogServiceImpl.isBootLogLine(
                line("c.n.o.s.oracle.OracleCloudService",
                        "[TaskId=353] 用户:[demo]的区域:[ap-singapore-1]的架构:[ARM]未完成开机,已执行抢机次数为:[5],原因为:Out of capacity,将在:[60]秒后重试...")));
        assertTrue(LogServiceImpl.isBootLogLine(
                line("c.n.o.c.task.CreateInstanceTaskV2",
                        "抢机失败 - TaskId: 1792840135189a6e214ab-1111-2222-3333-44b1c9aacdef")));
        assertTrue(LogServiceImpl.isBootLogLine(
                line("c.n.o.c.task.StartBootInstanceTask",
                        "[TaskId=88] 启动开机任务")));
    }

    @Test
    void rejectsUntaggedOrUnrelatedLoggers() {
        assertFalse(LogServiceImpl.isBootLogLine(
                line("c.n.o.s.oracle.OracleCloudService", "当前区域不存在可用镜像")));
        assertFalse(LogServiceImpl.isBootLogLine(
                line("c.n.o.c.task.CreateInstanceTaskV2", "当前没有到期任务")));
        assertFalse(LogServiceImpl.isBootLogLine(
                line("c.n.o.s.impl.TenantServiceImpl", "OciLogBuilder [TaskId=353] 仅正文提及")));
        assertFalse(LogServiceImpl.isBootLogLine(null));
        assertFalse(LogServiceImpl.isBootLogLine("malformed line without separator"));
    }
}
