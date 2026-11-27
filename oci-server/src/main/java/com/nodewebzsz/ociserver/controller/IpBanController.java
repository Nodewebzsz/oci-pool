package com.nodewebzsz.ociserver.controller;

import cn.dev33.satoken.stp.StpUtil;
import com.nodewebzsz.dao.entity.BanRecord;
import com.nodewebzsz.dao.repository.BanRecordRepository;
import com.nodewebzsz.ociserver.config.exception.IpBannedException;
import com.nodewebzsz.ociserver.service.BanService;
import com.nodewebzsz.ociserver.service.security.LoginIpTransactions;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.annotation.Resource;
import javax.persistence.criteria.Predicate;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/system/ip-bans")
@Slf4j
public class IpBanController extends BaseController {

    @Resource
    private BanRecordRepository repository;

    @Resource
    private BanService banService;

    @GetMapping
    public ResponseEntity<?> list(@RequestParam(defaultValue = "1") int page,
                                  @RequestParam(defaultValue = "20") int size,
                                  @RequestParam(required = false) Integer status,
                                  @RequestParam(required = false) String ip,
                                  HttpServletResponse response) {
        StpUtil.checkLogin();
        response.setHeader("Cache-Control", "no-store");
        if (page < 1 || size < 1 || size > 100
                || (status != null && status != 0 && status != 1)
                || (ip != null && ip.length() > 64)) {
            return failure(400, "分页、状态或 IP 查询条件无效");
        }
        String query = ip == null ? "" : ip.trim();
        if (!query.isEmpty()) {
            try {
                query = LoginIpTransactions.normalizeIp(query);
            } catch (IpBannedException ignored) {
            }
        }
        final String ipQuery = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        Specification<BanRecord> spec = (root, criteria, builder) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (status != null) {
                predicates.add(builder.equal(root.get("status"), status));
            }
            if (!ipQuery.isEmpty()) {
                predicates.add(builder.like(root.get("ipAddress"), "%" + ipQuery + "%", '\\'));
            }
            return builder.and(predicates.toArray(new Predicate[0]));
        };
        try {
            Page<BanRecord> records = repository.findAll(spec,
                    PageRequest.of(page - 1, size, Sort.by(Sort.Direction.DESC, "createTime", "id")));
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("items", records.getContent().stream().map(IpBanController::record).collect(Collectors.toList()));
            data.put("total", records.getTotalElements());
            data.put("page", page);
            data.put("size", size);
            return ResponseEntity.ok(success(data));
        } catch (Exception e) {
            log.error("读取IP封禁记录失败，异常类型：{}", e.getClass().getSimpleName());
            return failure(503, "读取封禁记录失败，请稍后重试");
        }
    }

    @PostMapping("/ban")
    public ResponseEntity<?> ban(@RequestBody Map<String, Object> body,
                                 HttpServletRequest request,
                                 HttpServletResponse response) {
        StpUtil.checkLogin();
        if (!isSameOriginBrowserWrite(request)) {
            return failure(403, "只允许同源页面执行封禁操作");
        }
        response.setHeader("Cache-Control", "no-store");
        String rawIp = body == null || body.get("ip") == null ? "" : String.valueOf(body.get("ip")).trim();
        String reason = body == null || body.get("reason") == null ? "" : String.valueOf(body.get("reason")).trim();
        if (rawIp.isEmpty() || rawIp.length() > 64) {
            return failure(400, "请输入有效的 IP 地址");
        }
        if (reason.length() > 255) {
            return failure(400, "封禁原因过长");
        }
        try {
            String normalized = LoginIpTransactions.normalizeIp(rawIp);
            String operator = StpUtil.getLoginIdAsString();
            if (operator.length() > 64) {
                operator = operator.substring(0, 64);
            }
            boolean ok = banService.banIp(normalized, reason.isEmpty() ? "后台手动封禁" : reason, operator);
            if (!ok) {
                return failure(503, "封禁 IP 失败，请稍后重试");
            }
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("ipAddress", normalized);
            data.put("message", "已封禁 IP：" + normalized);
            return ResponseEntity.ok(success(data));
        } catch (IpBannedException invalid) {
            return failure(400, "请输入有效的 IPv4 或 IPv6 地址");
        } catch (Exception e) {
            log.error("后台封禁IP失败，异常类型：{}", e.getClass().getSimpleName());
            return failure(503, "封禁 IP 失败，请稍后重试");
        }
    }

    @PostMapping("/{id}/unban")
    public ResponseEntity<?> unban(@PathVariable Long id,
                                   HttpServletRequest request,
                                   HttpServletResponse response) {
        StpUtil.checkLogin();
        if (!isSameOriginBrowserWrite(request)) {
            return failure(403, "只允许同源页面执行解封操作");
        }
        response.setHeader("Cache-Control", "no-store");
        try {
            String operator = StpUtil.getLoginIdAsString();
            if (operator.length() > 64) {
                operator = operator.substring(0, 64);
            }
            BanService.UnbanRecordResult result = banService.unbanRecord(id, "后台管理解封", operator);
            if (result == BanService.UnbanRecordResult.NOT_FOUND) {
                return failure(404, "封禁记录不存在，请刷新列表");
            }
            boolean changed = result == BanService.UnbanRecordResult.RELEASED;
            return unbanResult(changed, changed ? "已解除封禁" : "该封禁记录已解封，请刷新列表");
        } catch (Exception e) {
            log.error("后台解除IP封禁失败，记录ID={}，异常类型：{}", id, e.getClass().getSimpleName());
            return failure(503, "解封结果未确认，请刷新记录后重试");
        }
    }

    static boolean isSameOriginBrowserWrite(HttpServletRequest request) {
        if (request == null) {
            return true;
        }
        String site = request.getHeader("Sec-Fetch-Site");
        if ("same-origin".equals(site)) {
            return true;
        }
        if (site != null && !"none".equals(site)) {
            return false;
        }
        String origin = request.getHeader("Origin");
        if (origin == null) {
            return true;
        }
        try {
            URI uri = new URI(origin);
            if (uri.getHost() == null || uri.getScheme() == null || uri.getRawUserInfo() != null
                    || uri.getRawQuery() != null || uri.getRawFragment() != null || !"".equals(uri.getRawPath())) {
                return false;
            }
            int port = uri.getPort() < 0 ? ("https".equalsIgnoreCase(uri.getScheme()) ? 443 : 80) : uri.getPort();
            return uri.getScheme().equalsIgnoreCase(request.getScheme())
                    && port == request.getServerPort()
                    && unbracket(uri.getHost()).equalsIgnoreCase(unbracket(request.getServerName()));
        } catch (URISyntaxException e) {
            return false;
        }
    }

    private static String unbracket(String host) {
        return host.startsWith("[") && host.endsWith("]") ? host.substring(1, host.length() - 1) : host;
    }

    private static Map<String, Object> record(BanRecord record) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", String.valueOf(record.getId()));
        item.put("ipAddress", record.getIpAddress());
        item.put("source", record.getSource());
        item.put("operatorName", record.getOperatorName());
        item.put("reason", record.getReason());
        item.put("status", record.getStatus());
        item.put("createTime", record.getCreateTime());
        item.put("unbanTime", record.getUnbanTime());
        item.put("unbanReason", record.getUnbanReason());
        item.put("unbanOperatorName", record.getUnbanOperatorName());
        return item;
    }

    private static ResponseEntity<?> unbanResult(boolean changed, String message) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("changed", changed);
        data.put("message", message);
        return ResponseEntity.ok(success(data));
    }

    private static Map<String, Object> success(Object data) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("data", data);
        return body;
    }

    private static ResponseEntity<?> failure(int status, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", false);
        body.put("message", message);
        return ResponseEntity.status(status).body(body);
    }
}
