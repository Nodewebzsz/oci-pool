package com.nodewebzsz.ociserver.service;

import com.nodewebzsz.dao.entity.Tenant;
import com.nodewebzsz.ociserver.pojo.request.CostQueryRequest;
import com.nodewebzsz.ociserver.pojo.response.CloudCostItem;
import com.nodewebzsz.ocicommon.param.ApiResponse;

import java.util.List;

public interface CloudBusinessService {


    ApiResponse queryDailyCost(CostQueryRequest costQueryRequest);


}
