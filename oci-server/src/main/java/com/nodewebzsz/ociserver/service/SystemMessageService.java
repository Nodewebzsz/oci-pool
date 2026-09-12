package com.nodewebzsz.ociserver.service;

import com.nodewebzsz.dao.entity.Message;
import com.nodewebzsz.ociserver.pojo.request.SystemMessageRequest;
import com.nodewebzsz.ocicommon.param.ApiResponse;
import org.springframework.data.domain.Page;

public interface SystemMessageService {

    //分页查询
    Page<Message> getSystemMessagePage(SystemMessageRequest systemMessageRequest);


    //全部设置为已读
    ApiResponse updateAllRead();

    ApiResponse getMessage(SystemMessageRequest messageRequest);

    //保存消息
    ApiResponse saveMessage(SystemMessageRequest messageRequest);

    ApiResponse countUnreadMessage();

    ApiResponse deleteMessage(SystemMessageRequest messageRequest);
}
