package com.doubledimple.ociserver.controller.dashboard;

import com.doubledimple.ociserver.controller.BaseController;
import com.doubledimple.ociserver.config.task.CreateInstanceTaskV2;
import com.doubledimple.ociserver.pojo.response.DashboardStats;
import com.doubledimple.ociserver.pojo.response.SystemMetrics;
import com.doubledimple.ocicommon.param.ApiResponse;
import com.doubledimple.ociserver.service.BootTotalInstanceService;
import com.doubledimple.ociserver.service.monitor.SystemMonitorService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;

import javax.annotation.Resource;

/**
 * @version 1.0.0
 * @ClassName DashBoardController
 * @Description TODO
 * @Author nodewebzsz
 * @Date 2025-10-25 22:34
 */
@Controller
@CrossOrigin
@Slf4j
public class DashBoardController extends BaseController {



    @Resource
    private SystemMonitorService monitorService;

    @Resource
    private BootTotalInstanceService bootTotalInstanceService;

    @Resource
    private CreateInstanceTaskV2 createInstanceTaskV2;

    @RequestMapping("/boot/dashboard")
    public String dashboard(Model model){
        model.addAttribute("activePage", "api-dashboard");
        return "dashboard";
    }

    @GetMapping("/boot/dashboard-stats")
    @ResponseBody
    public ApiResponse getDashboardStats() {
        try {
            DashboardStats dashboardStats = bootTotalInstanceService.count();
            return ApiResponse.success(dashboardStats);
        } catch (Exception e) {
            return ApiResponse.error("获取仪表盘数据失败: " + e.getMessage());
        }
    }

    @GetMapping("/boot/stats")
    @ResponseBody
    public ApiResponse getSystemStats() {
        try {
            SystemMetrics metrics = monitorService.collectMetrics();
            return ApiResponse.success(metrics);
        } catch (Exception e) {
            log.error("Failed to get system stats", e);
            return ApiResponse.error("数据获取异常,请稍后再试");
        }
    }

    @GetMapping("/boot/engine/status")
    @ResponseBody
    public ApiResponse getEngineStatus() {
        try {
            return ApiResponse.success(createInstanceTaskV2.getSystemStatus());
        } catch (Exception e) {
            log.error("Failed to get grab engine status", e);
            return ApiResponse.error("获取抢机引擎状态失败: " + e.getMessage());
        }
    }

    @PostMapping("/boot/engine/pause")
    @ResponseBody
    public ApiResponse pauseEngine() {
        try {
            createInstanceTaskV2.pause();
            return ApiResponse.success("抢机引擎已暂停");
        } catch (Exception e) {
            log.error("Failed to pause grab engine", e);
            return ApiResponse.error("暂停抢机引擎失败: " + e.getMessage());
        }
    }

    @PostMapping("/boot/engine/resume")
    @ResponseBody
    public ApiResponse resumeEngine() {
        try {
            createInstanceTaskV2.resume();
            return ApiResponse.success("抢机引擎已恢复");
        } catch (Exception e) {
            log.error("Failed to resume grab engine", e);
            return ApiResponse.error("恢复抢机引擎失败: " + e.getMessage());
        }
    }
}
