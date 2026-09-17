package com.nodewebzsz.ociserver.controller;

import com.nodewebzsz.dao.entity.Tenant;
import com.nodewebzsz.ociserver.pojo.request.CostQueryRequest;
import com.nodewebzsz.ocicommon.param.ApiResponse;
import com.nodewebzsz.ociserver.service.CloudBusinessService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import javax.annotation.Resource;
import javax.servlet.http.HttpServletRequest;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

import static com.nodewebzsz.ociserver.utils.DesktopUtils.isMobileRequest;

/**
 * @version 1.0.0
 * @ClassName OciCostController
 * @Description TODO
 * @Author renyx
 * @Date 2025-11-30 10:33
 */
@Controller
@RequestMapping("/cost")
@Slf4j
public class OciCostController extends BaseController{

    @Resource
    CloudBusinessService cloudBusinessService;

    /**
     * 租户列表
     */
    @GetMapping("/costPage")
    public String listUsers(@RequestParam(required = false) String tenantId,
                            HttpServletRequest request,
                            Model model) {
        model.addAttribute("tenantId", tenantId);
        model.addAttribute("activePage", "api-management");
        return "redirect:/tenants";

    }


    //查询账号的花费
    @PostMapping("/query")
    @ResponseBody
    public ApiResponse queryCost(@RequestBody CostQueryRequest costQueryRequest){
        return cloudBusinessService.queryDailyCost(costQueryRequest);
    }
}
