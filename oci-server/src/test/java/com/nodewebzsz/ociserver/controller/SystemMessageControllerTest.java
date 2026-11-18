package com.nodewebzsz.ociserver.controller;

import com.nodewebzsz.ocicommon.param.ApiResponse;
import com.nodewebzsz.ociserver.pojo.request.SystemMessageRequest;
import com.nodewebzsz.ociserver.service.SystemMessageService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SystemMessageControllerTest {

    @Test
    void delBatchAndClearDelegateToSystemMessageService() {
        SystemMessageService service = Mockito.mock(SystemMessageService.class);
        SystemMessageController controller = new SystemMessageController();
        ReflectionTestUtils.setField(controller, "systemMessageService", service);

        SystemMessageRequest req = new SystemMessageRequest();
        req.setIds(Arrays.asList(10L, 11L));
        when(service.deleteMessages(req)).thenReturn(ApiResponse.success("已批量删除 2 条消息"));
        when(service.clearAllMessages()).thenReturn(ApiResponse.success("已清空全部消息"));

        assertTrue(controller.deleteBatchMessage(req).isSuccess());
        assertTrue(controller.clearAllMessages().isSuccess());
        verify(service).deleteMessages(req);
        verify(service).clearAllMessages();
    }

    @Test
    void serviceRejectsEmptyBatchIds() {
        com.nodewebzsz.ociserver.service.impl.system.SystemMessageServiceImpl impl =
                new com.nodewebzsz.ociserver.service.impl.system.SystemMessageServiceImpl();
        assertFalse(impl.deleteMessages(new SystemMessageRequest()).isSuccess());
    }
}
