package com.nodewebzsz.ociserver.controller.index;

import com.nodewebzsz.ocicommon.cache.CacheConstants;
import com.nodewebzsz.ocicommon.cache.CacheService;
import com.nodewebzsz.ocicommon.enums.CloudTypeEnum;
import com.nodewebzsz.ocicommon.param.ApiResponse;
import com.nodewebzsz.ocicommon.param.InstallAppNotify;
import com.nodewebzsz.ocicommon.param.OpenRegionNotify;
import com.nodewebzsz.ociserver.config.task.VersionCheckTask;
import com.nodewebzsz.ociserver.controller.BaseController;
import com.nodewebzsz.ociserver.pojo.response.OciIpRange;
import com.nodewebzsz.ociserver.service.InstallAppService;
import com.nodewebzsz.ociserver.service.OpenApiService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import javax.annotation.Resource;
import javax.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.nodewebzsz.ocicommon.cache.CacheConstants.ALL_IP_RANGES_KEY;
import static com.nodewebzsz.ocicommon.cache.CacheConstants.BOOT_COUNT_KEY;
import static com.nodewebzsz.ocicommon.cache.CacheConstants.GITHUB_STARS_KEY;


/**
 * @version 1.0.0
 * @ClassName IndexController
 * @Description TODO
 * @Author nodewebzsz
 * @Date 2025-08-23 10:26
 */
@Controller
@Slf4j
public class IndexController  extends BaseController {

    @Resource
    VersionCheckTask versionCheckTask;

    @Resource
    InstallAppService installAppService;

    @Resource
    OpenApiService openApiService;

    @Resource
    private CacheManager cacheManager;

    @Resource
    @Lazy
    CacheService cacheService;


    @GetMapping("/main")
    public String mainLayout() {
        return "redirect:/";
    }


    //异步获取面板开机统计
    @GetMapping("/bootOpenCount")
    @ResponseBody
    public ApiResponse getBootStats() {
        Integer totalOpenCount = cacheService.getFromCache(
                BOOT_COUNT_KEY,
                Integer.class,
                () -> {
                    List<OpenRegionNotify> list = openApiService.armRecordsLocal(new OpenRegionNotify());
                    if (list == null || list.isEmpty()) return 0;
                    return list.stream()
                            .filter(item -> item.getOpenCount() != null)
                            .mapToInt(OpenRegionNotify::getOpenCount)
                            .sum();
                }
        );
        return ApiResponse.success(totalOpenCount != null ? totalOpenCount : 0);
    }

    /**
     * 跳转到关于作者页面
     */
    @GetMapping("/about/author")
    public String aboutAuthor(Model model) {
        model.addAttribute("activePage", "about-author");
        return "redirect:/monitor";
    }



    @GetMapping("/api/dashboard/stats")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getDashboardStats() {
        try {
            Map<String, Object> stats = new HashMap<>();

            stats.put("installCount", getInstallCount());

            // GitHub Stars - 可以通过GitHub API获取
            stats.put("githubStars", getGithubStars());

            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            log.error("获取仪表板统计数据失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(null);
        }
    }

    private Long getInstallCount() {
        InstallAppNotify installAppNotify = installAppService.addOrUpdateInstallApp();

        return installAppNotify.getAppInstallCount();
    }

    private Long getGithubStars() {
        return cacheService.getFromCache(
                GITHUB_STARS_KEY,
                Long.class,
                () -> versionCheckTask.getGitHubStars());
    }
}
