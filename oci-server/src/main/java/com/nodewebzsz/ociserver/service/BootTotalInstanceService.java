package com.nodewebzsz.ociserver.service;

import com.nodewebzsz.dao.entity.BootInstance;
import com.nodewebzsz.ociserver.pojo.domain.dto.User;
import com.nodewebzsz.ociserver.pojo.response.DashboardStats;

public interface BootTotalInstanceService {


    //统计抢机次数
    long inc(User user);

    void updatePublicIp(Long bootId, int i, String publicIp);

    DashboardStats count();

    Long queryAddCountByBootId(Long bootId);

    /**
    * @Description: 查询实例抢机次数
    * @Param: [java.lang.Long]
    * @return: long
    * @Author nodewebzsz
    * @Date: 2/16/25 10:19 AM
    */

    /**
    * 根据boot查询开机中的记录
    */
    BootInstance queryBootInstanceById(String bootId);
}
