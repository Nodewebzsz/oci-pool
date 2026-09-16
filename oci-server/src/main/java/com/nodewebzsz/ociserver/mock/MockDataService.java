package com.nodewebzsz.ociserver.mock;

import com.nodewebzsz.ociserver.pojo.response.ModelSummaryDef;
import com.nodewebzsz.ociserver.pojo.response.UserRes;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;

/**
 * 模拟数据提供器：当数据库无真实数据且 modern-ui.mock-data 开启时，
 * 各列表接口返回这里构造的、符合后端真实字段结构的模拟数据。
 * 仅用于开发/演示，生产应保持开关关闭。
 */
@Service
public class MockDataService {

    @Value("${modern-ui.mock-data:false}")
    private boolean mockEnabled;

    public boolean isMockEnabled() {
        return mockEnabled;
    }

    // ── OCI 实例列表 ────────────────────────────────────────────
    private static final String[][] INSTANCE_SEED = {
        // {displayName, shape, state, ocpus, memGB, diskGB, arch, regionName, regionCode, publicIp, privateIp, tenancyName}
        {"web-server-01", "VM.Standard.A1.Flex", "running", "4", "24", "200", "ARM", "美西(凤凰城)", "us-phoenix-1", "129.146.12.34", "10.0.1.10", "phoenix"},
        {"db-master-01", "VM.Standard.E4.Flex", "running", "8", "64", "400", "AMD", "美东(阿什本)", "us-ashburn-1", "140.91.55.20", "10.0.2.11", "phoenix"},
        {"redis-cache", "VM.Standard.E2.1.Micro", "stopped", "1", "1", "50", "AMD", "亚太-日本东京", "ap-tokyo-1", "152.70.88.7", "10.0.3.22", "sanjose1"},
        {"app-server-02", "VM.Standard.A1.Flex", "running", "2", "12", "100", "ARM", "亚太-新加坡", "ap-singapore-1", "203.0.113.14", "10.1.1.5", "sanjose1"},
        {"ml-train-node", "VM.Standard.A1.Flex", "running", "16", "96", "800", "ARM", "欧洲-德国法兰克福", "eu-frankfurt-1", "198.51.100.9", "10.2.1.31", "saopaulo"},
        {"nginx-gateway", "VM.Standard.E4.Flex", "stopped", "2", "8", "80", "AMD", "亚太-韩国首尔", "ap-seoul-1", "192.0.2.18", "10.3.1.7", "saopaulo"},
        {"backup-vol", "VM.Standard.E2.1.Micro", "stopped", "1", "1", "50", "AMD", "亚太-澳大利亚悉尼", "ap-sydney-1", "198.51.100.40", "10.4.1.2", "sgw"},
        {"game-server-01", "VM.Standard.A1.Flex", "running", "4", "24", "150", "ARM", "美西(圣何塞)", "us-sanjose-1", "129.146.200.5", "10.5.1.9", "sgw"},
    };

    // 实例列表（Map 结构，对齐客户端 InstanceJSON 解析）
    public List<Map<String, Object>> instanceListPage(int page, int size) {
        List<Map<String, Object>> all = new ArrayList<>();
        long seq = 1000;
        for (String[] s : INSTANCE_SEED) {
            Map<String, Object> m = new java.util.HashMap<>();
            m.put("id", String.valueOf(seq));
            m.put("tenantId", 100L + (seq % 5));
            m.put("tenantIdStr", String.valueOf(100L + (seq % 5)));
            m.put("instanceId", "ocid1.instance.oc1." + seq);
            m.put("displayName", s[0]);
            m.put("shape", s[1]);
            m.put("state", s[2]);
            m.put("ocpus", Integer.parseInt(s[3]));
            m.put("memoryInGBs", Integer.parseInt(s[4]));
            m.put("bootVolumeSizeInGBs", Long.parseLong(s[5]));
            m.put("architecture", s[6]);
            m.put("processorDescription", s[6].equals("ARM") ? "Ampere A1" : "AMD EPYC");
            m.put("cpuAndMem", s[3] + "C" + s[4] + "G");
            m.put("regionName", s[7]);
            m.put("regionCode", s[8]);
            m.put("publicIps", s[9]);
            m.put("privateIps", s[10]);
            m.put("tenancyName", s[11]);
            m.put("userName", "ocid1.user.oc1.." + s[11]);
            m.put("availabilityDomain", s[1].contains("A1") ? "AD-1" : "AD-2");
            m.put("compartmentId", "ocid1.compartment.oc1..demo");
            m.put("bootVolumeName", "bv-" + s[0]);
            m.put("bootVolumeId", "ocid1.volume.oc1..bv" + seq);
            m.put("vpusPerGB", "10");
            m.put("ipv6Addresses", "");
            m.put("cloudType", 1);
            m.put("onLineEnable", 1);
            m.put("monitorInstalled", true);
            m.put("lastHeartbeat", System.currentTimeMillis());
            m.put("createTime", System.currentTimeMillis());
            m.put("timeCreated", "2026-0" + (1 + seq % 8) + "-1" + (seq % 9) + " 1" + (seq % 2) + ":2" + (seq % 8) + ":0" + (seq % 6));
            m.put("remark", s[0]);
            seq++;
            all.add(m);
        }
        int from = Math.min(page >= 0 ? page * size : 0, all.size());
        int to = Math.min(from + size, all.size());
        return new ArrayList<>(all.subList(from, to));
    }

    // ── 开机任务列表 ────────────────────────────────────────────
    private static final String[][] BOOT_SEED = {
        // {tenancyName, defName, regionName, arch, status, ocpu, mem, disk, loopTime, recordCount, executingCount, totalCount}
        {"phoenix", "phoenix111", "春川", "ARM", "1", "1", "6", "50", "60", "12", "3", "120"},
        {"sanjose1", "sanjose1", "圣何塞", "ARM", "0", "1", "6", "50", "60", "8", "2", "80"},
        {"saopaulo", "saopaulo", "圣保罗", "AMD", "1", "2", "12", "100", "120", "5", "1", "56"},
        {"sgw", "sgw", "新加坡", "ARM", "0", "1", "6", "50", "60", "20", "4", "210"},
        {"phoenix", "phoenix111", "阿什本", "AMD", "1", "4", "24", "200", "300", "3", "0", "34"},
    };

    public List<Map<String, Object>> bootListPage(int page, int size) {
        List<Map<String, Object>> all = new ArrayList<>();
        long seq = 5001;
        for (String[] s : BOOT_SEED) {
            Map<String, Object> m = new java.util.HashMap<>();
            m.put("id", seq);
            m.put("bootId", "BOOT-" + seq);
            m.put("tenantId", 100L + (seq % 5));
            m.put("tenancyName", s[0]);
            m.put("defName", s[1]);
            m.put("userName", "ocid1.user.oc1.." + s[0]);
            m.put("regionName", s[2]);
            m.put("architecture", s[3]);
            m.put("openBootFlag", s[4].equals("1"));
            m.put("status", Integer.parseInt(s[4]));
            m.put("ocpu", Integer.parseInt(s[5]));
            m.put("memory", Integer.parseInt(s[6]));
            m.put("disk", Integer.parseInt(s[7]));
            m.put("loopTime", Integer.parseInt(s[8]));
            m.put("recordCount", Long.parseLong(s[9]));
            m.put("executingCount", Long.parseLong(s[10]));
            m.put("totalCount", Long.parseLong(s[11]));
            m.put("yesterdayAttemptCount", (int) (seq % 7));
            m.put("currentAttemptCount", (int) (seq % 5));
            m.put("failCount", (int) (seq % 3));
            m.put("successCount", (int) (seq % 9));
            m.put("createAtStr", "2026-08-1" + (seq % 9) + " 1" + (seq % 2) + ":2" + (seq % 8) + ":0" + (seq % 6));
            m.put("dayGap", "");
            m.put("rootPassword", "Demo#Pwd" + seq);
            all.add(m);
            seq++;
        }
        int from = Math.min(page >= 0 ? page * size : 0, all.size());
        int to = Math.min(from + size, all.size());
        return new ArrayList<>(all.subList(from, to));
    }

    // ── 对象存储：存储桶 ────────────────────────────────────────
    public List<Map<String, Object>> storageBuckets() {
        List<Map<String, Object>> list = new ArrayList<>();
        String[][] seeds = {
            {"logs-bucket", "demoNamespace", "2026-08-01T12:00:00Z", "ObjectRead"},
            {"backup-ark", "demoNamespace", "2026-07-15T09:30:00Z", "NoPublicAccess"},
            {"website-static", "demoNamespace", "2026-06-20T18:45:00Z", "ObjectRead"},
            {"images-cdn", "demoNamespace", "2026-05-10T22:10:00Z", "NoPublicAccess"},
            {"data-warehouse", "demoNamespace", "2026-04-05T08:20:00Z", "NoPublicAccess"},
        };
        for (String[] s : seeds) {
            Map<String, Object> m = new java.util.HashMap<>();
            m.put("name", s[0]);
            m.put("namespace", s[1]);
            m.put("timeCreated", s[2]);
            m.put("publicAccess", s[3]);
            list.add(m);
        }
        return list;
    }

    // ── 对象存储：对象 ────────────────────────────────────────
    public List<Map<String, Object>> storageObjects(String bucket) {
        List<Map<String, Object>> list = new ArrayList<>();
        long size = 1024;
        String[][] seeds = {
            {"app.log", "server-access.log", "2026_08_config.json", "README.md", "backup.tar.gz"},
            {"data.csv", "report.pdf", "image-01.png", "image-02.png", "archive.zip"},
        };
        int bucketIdx = Math.abs(bucket == null ? 0 : bucket.hashCode()) % seeds.length;
        long seq = 1;
        for (String name : seeds[bucketIdx]) {
            Map<String, Object> m = new java.util.HashMap<>();
            m.put("name", name);
            m.put("size", size * seq);
            m.put("timeModified", "2026-08-1" + (seq % 3) + " 1" + (seq % 2) + ":2" + (seq % 8) + ":0" + (seq % 6));
            m.put("bucket", bucket);
            list.add(m);
            seq++;
        }
        return list;
    }

    // ── 审计日志 ────────────────────────────────────────────────
    // ⚠️ userType(authType) 一律填 "natv"：OCI 对 authType 无公开枚举，控制台与 API 调用
    //    都可能落到同一值，因此**不能**用它区分调用来源。环境列的判据是 consoleSessionId
    //    （非空 = 控制台会话，为空 = API/SDK 调用）。这组数据刻意让两类调用 authType 相同，
    //    正是为了让「用 authType 判来源」这个错误假设在演示时立刻暴露。
    public List<Map<String, Object>> auditEvents() {
        List<Map<String, Object>> list = new ArrayList<>();
        String UA_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
        String UA_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
        String[][] seeds = {
            // {eventName, eventFullType, consoleSessionId, userName, ipAddress(含地理位置), userAgent, eventTime, responseStatus}
            {"LaunchInstance",    "com.oraclecloud.ComputeApi.LaunchInstance",    "ocid1.console.oc1..sess001", "nodewebzsz@gmail.com",   "10.0.2.9(内网地址)，252.49.125.199(中国广东省深圳市)", UA_MAC, "2026-09-11 12:04:11", "200"},
            {"GetInstance",       "com.oraclecloud.ComputeApi.GetInstance",       "ocid1.console.oc1..sess001", "nodewebzsz@gmail.com",   "10.0.2.9(内网地址)",                                   UA_MAC, "2026-09-11 12:04:09", "200"},
            {"CreateVcn",         "com.oraclecloud.NetworkingApi.CreateVcn",      "",                           "terraform-svc@example.com", "203.0.113.47(中国广东省深圳市)",                    "Terraform/1.9.5 (+https://www.terraform.io) terraform-provider-oci/6.14.0", "2026-09-11 11:58:02", "200"},
            {"UpdateBootVolume",  "com.oraclecloud.ComputeApi.UpdateBootVolume",  "",                           "ci-runner@example.com",  "198.51.100.9(中国香港)",                               "oci-java-sdk/3.92.0", "2026-09-11 11:47:33", "201"},
            {"StopInstance",      "com.oraclecloud.ComputeApi.StopInstance",      "ocid1.console.oc1..sess002", "ops@example.com",        "172.16.0.5(内网地址)",                                 UA_WIN, "2026-09-11 11:32:18", "204"},
            {"TerminateInstance", "com.oraclecloud.ComputeApi.TerminateInstance", "",                           "ci-runner@example.com",  "198.51.100.9(中国香港)",                               "oci-cli/3.47.0", "2026-09-11 11:20:56", "404"},
            {"DeleteVolume",      "com.oraclecloud.BlockstorageApi.DeleteVolume", "ocid1.console.oc1..sess002", "admin@example.com",      "203.0.113.88(日本东京都)",                             UA_MAC, "2026-09-11 10:59:04", "500"},
            {"ListInstances",     "com.oraclecloud.ComputeApi.ListInstances",     "ocid1.console.oc1..sess001", "nodewebzsz@gmail.com",   "10.0.2.9(内网地址)",                                   UA_MAC, "2026-09-11 10:41:27", "-"},
        };
        for (String[] s : seeds) {
            Map<String, Object> m = new java.util.HashMap<>();
            m.put("eventType", s[0]);
            m.put("eventFullType", s[1]);
            m.put("consoleSessionId", s[2]);
            m.put("userName", s[3]);
            m.put("userType", "natv");
            m.put("ipAddress", s[4]);
            m.put("clientEnv", s[5]);
            m.put("eventTime", s[6]);
            m.put("responseStatus", s[7]);
            list.add(m);
        }
        return list;
    }

    // ── 子区域：已订阅区域 ────────────────────────────────────────
    public List<Map<String, Object>> subscribedRegions() {
        List<Map<String, Object>> list = new ArrayList<>();
        String[][] seeds = {
            {"us-phoenix-1", "美西(凤凰城)", "1", "true"},
            {"us-sanjose-1", "美西(圣何塞)", "1", "false"},
            {"ap-tokyo-1", "亚太-日本东京", "0", "false"},
            {"ap-seoul-1", "亚太-韩国首尔", "0", "false"},
            {"eu-frankfurt-1", "欧洲-德国法兰克福", "0", "false"},
        };
        for (String[] s : seeds) {
            Map<String, Object> m = new java.util.HashMap<>();
            m.put("regionKey", s[0]);
            m.put("regionName", s[1]);
            Map<String, Object> status = new java.util.HashMap<>();
            status.put("value", Integer.parseInt(s[2]));
            m.put("status", status);
            m.put("isHomeRegion", Boolean.parseBoolean(s[3]));
            list.add(m);
        }
        return list;
    }

    // ── 子区域：未订阅区域 ────────────────────────────────────────
    public List<Map<String, Object>> unsubscribedRegions() {
        List<Map<String, Object>> list = new ArrayList<>();
        String[][] seeds = {
            {"ap-singapore-1", "新加坡", "新加坡"},
            {"ap-sydney-1", "悉尼", "悉尼"},
            {"ca-toronto-1", "多伦多", "多伦多"},
            {"eu-amsterdam-1", "阿姆斯特丹", "阿姆斯特丹"},
            {"uk-london-1", "伦敦", "伦敦"},
        };
        for (String[] s : seeds) {
            Map<String, Object> m = new java.util.HashMap<>();
            m.put("key", s[0]);
            m.put("name", s[1]);
            m.put("cnName", s[2]);
            list.add(m);
        }
        return list;
    }

    // ── 用户管理：Oracle 用户 ────────────────────────────────────
    public List<UserRes> userList() {
        List<UserRes> list = new ArrayList<>();
        String[][] seeds = {
            {"ocid1.user..demo1", "admin", "ACTIVE", "ocid1.user..demo1", "admin@demo.com", "Default"},
            {"ocid1.user..demo2", "ops", "ACTIVE", "ocid1.user..demo2", "ops@demo.com", "Default"},
            {"ocid1.user..demo3", "dev", "INACTIVE", "ocid1.user..demo3", "dev@demo.com", "Default"},
            {"ocid1.user..demo4", "analyst", "ACTIVE", "ocid1.user..demo4", "analyst@demo.com", "Default"},
            {"ocid1.user..demo5", "qa", "ACTIVE", "ocid1.user..demo5", "qa@demo.com", "Default"},
        };
        long t = System.currentTimeMillis();
        for (String[] s : seeds) {
            Date login = new Date(t - 24L * 3600 * 1000);
            Date created = new Date(t - 30L * 24 * 3600 * 1000);
            list.add(new UserRes(s[0], s[1], s[2], s[3], s[4], login, created, s[5]));
        }
        return list;
    }

    // ── AI 模型（/ai/models）─────────────────────────────────────
    public List<Map<String, Object>> aiModels() {
        List<Map<String, Object>> list = new ArrayList<>();
        String[][] seeds = {
            {"ocid1.model..llama", "Llama 3.1 70B", "v1", "Meta", "ACTIVE"},
            {"ocid1.model..cohere", "Cohere Command R+", "v1", "Cohere", "ACTIVE"},
            {"ocid1.model..opencode", "Code Llama 34B", "v1", "Meta", "ACTIVE"},
            {"ocid1.model..mistral", "Mistral 7B", "v1", "Mistral", "ACTIVE"},
        };
        for (String[] s : seeds) {
            Map<String, Object> m = new java.util.HashMap<>();
            m.put("id", s[0]);
            m.put("displayName", s[1]);
            m.put("version", s[2]);
            m.put("vendor", s[3]);
            m.put("lifecycleState", s[4]);
            list.add(m);
        }
        return list;
    }

    // ── AI 模型（/system/ai/modelsByTenant）──────────────────────
    public List<ModelSummaryDef> aiModelsDef(String tenantId) {
        List<ModelSummaryDef> list = new ArrayList<>();
        String[][] seeds = {
            {"ocid1.model..llama", "Llama 3.1 70B"},
            {"ocid1.model..cohere", "Cohere Command R+"},
            {"ocid1.model..opencode", "Code Llama 34B"},
            {"ocid1.model..mistral", "Mistral 7B"},
        };
        for (String[] s : seeds) {
            ModelSummaryDef def = new ModelSummaryDef();
            def.setId(s[0]);
            def.setName(s[1]);
            def.setDisplayName(s[1]);
            def.setDescription(s[1]);
            def.setProvider("OCI");
            def.setModelName(s[1]);
            def.setEnabled(true);
            def.setTenantId(tenantId == null ? "" : tenantId);
            list.add(def);
        }
        return list;
    }

    // ── Cloudflare 域名列表 ──────────────────────────────────────
    public List<Map<String, Object>> cfZones() {
        List<Map<String, Object>> list = new ArrayList<>();
        String[][] seeds = {
            {"zone-101", "example.com", "active"},
            {"zone-102", "demo-site.net", "active"},
            {"zone-103", "blog.example.org", "pending"},
            {"zone-104", "shop.example.com", "active"},
        };
        for (String[] s : seeds) {
            Map<String, Object> m = new java.util.HashMap<>();
            m.put("id", s[0]);
            m.put("name", s[1]);
            m.put("status", s[2]);
            list.add(m);
        }
        return list;
    }

    // ── 代理配置列表 ────────────────────────────────────────────
    public List<Map<String, Object>> proxyList() {
        List<Map<String, Object>> list = new ArrayList<>();
        String[][] seeds = {
            {"HTTP", "203.0.113.10", "8080", "proxy-01", "1", "0", "日本·东京"},
            {"SOCKS5", "198.51.100.20", "1080", "proxy-02", "1", "1", "美国·圣何塞"},
            {"HTTPS", "192.0.2.30", "8443", "proxy-03", "1", "0", "中国·香港"},
            {"HTTP", "203.0.113.40", "3128", "proxy-04", "0", "1", "新加坡"},
        };
        long seq = 101;
        for (String[] s : seeds) {
            Map<String, Object> m = new java.util.HashMap<>();
            m.put("id", seq++);
            m.put("proxyType", s[0]);
            m.put("proxyHost", s[1]);
            m.put("proxyPort", Integer.parseInt(s[2]));
            m.put("customName", s[3]);
            m.put("availableStatus", Integer.parseInt(s[4]));
            m.put("forceProxy", Integer.parseInt(s[5]));
            m.put("location", s[6]);
            m.put("tenantName", "phoenix");
            m.put("tenantId", 100L);
            list.add(m);
        }
        return list;
    }

    // ── EdgeOne 域名列表 ────────────────────────────────────────
    public List<Map<String, Object>> edgeOneZones() {
        List<Map<String, Object>> list = new ArrayList<>();
        String[][] seeds = {
            {"zone-201", "edge-demo.com", "active"},
            {"zone-202", "cdn.example.net", "active"},
            {"zone-203", "static.example.org", "pending"},
        };
        for (String[] s : seeds) {
            Map<String, Object> m = new java.util.HashMap<>();
            m.put("id", s[0]);
            m.put("name", s[1]);
            m.put("status", s[2]);
            list.add(m);
        }
        return list;
    }

    // ── 邮件配置列表 ────────────────────────────────────────────
    public List<Map<String, Object>> emailConfigs() {
        List<Map<String, Object>> list = new ArrayList<>();
        String[][] seeds = {
            {"phoenix", "phoenix.com", "noreply@phoenix.com", "200", "12"},
            {"sanjose1", "sanjose1.com", "noreply@sanjose1.com", "200", "5"},
            {"saopaulo", "saopaulo.com", "noreply@saopaulo.com", "500", "38"},
        };
        long seq = 301;
        for (String[] s : seeds) {
            Map<String, Object> m = new java.util.HashMap<>();
            m.put("id", seq);
            m.put("tenantId", 100L + (seq % 5));
            m.put("tenantName", s[0]);
            m.put("domainName", s[1]);
            m.put("senderEmail", s[2]);
            m.put("active", true);
            m.put("dailyEmailLimit", Integer.parseInt(s[3]));
            m.put("todaySentCount", Integer.parseInt(s[4]));
            m.put("createdTime", "2026-08-0" + (seq % 9));
            list.add(m);
            seq++;
        }
        return list;
    }

    // ── 费用明细 ────────────────────────────────────────────────
    public List<Map<String, Object>> costList() {
        List<Map<String, Object>> list = new ArrayList<>();
        String[][] seeds = {
            {"Block Storage", "ocid1.volume..c1", "Storage", "2026-09-07", "12.50"},
            {"Compute", "ocid1.instance..i1", "VM.Standard.A1", "2026-09-07", "86.40"},
            {"Object Storage", "ocid1.bucket..b1", "Standard", "2026-09-07", "3.20"},
            {"Networking", "ocid1.vcn..v1", "Egress", "2026-09-07", "15.75"},
            {"Database", "ocid1.db..d1", "ADB", "2026-09-06", "128.00"},
        };
        for (String[] s : seeds) {
            Map<String, Object> m = new java.util.HashMap<>();
            m.put("cloudType", 1);
            m.put("resourceType", s[0]);
            m.put("resourceId", s[1]);
            m.put("skuName", s[2]);
            m.put("day", s[3]);
            m.put("cost", Double.parseDouble(s[4]));
            list.add(m);
        }
        return list;
    }

    // ── MySQL 数据库实例 ────────────────────────────────────────
    // 字段对齐 DbConfig 实体（camelCase），供租户详情「数据库」弹窗 mock 演示。
    public List<Map<String, Object>> mysqlInstances(Long tenantId) {
        List<Map<String, Object>> list = new ArrayList<>();
        String[][] seeds = {
            // {displayName, dbName, dbVersion, dbStatus, dbPublicUrl, dbPort, dbPassword, shapeName, storageGB, highlyAvailable, dbId}
            {"web-server-01", "oci_db_user", "8.0.21", "ACTIVE", "132.145.10.11", "3306", "Demo#Pwd1", "MySQL.2.16GB", "256", "1", "ocid1.mysqldbsystem..m1"},
            {"report-db",     "report_user", "8.0.21", "ACTIVE", "140.91.52.8",  "3307", "Demo#Pwd2", "MySQL.2.16GB", "128", "0", "ocid1.mysqldbsystem..m2"},
            {"archival",      "archive",     "8.0.21", "INACTIVE", "152.70.90.3", "3306", "",          "MySQL.2.16GB", "64",  "0", "ocid1.mysqldbsystem..m3"},
        };
        long seq = 9001;
        for (String[] s : seeds) {
            Map<String, Object> m = new java.util.HashMap<>();
            m.put("id", seq);
            m.put("tenantId", tenantId);
            m.put("displayName", s[0]);
            m.put("dbName", s[1]);
            m.put("dbVersion", s[2]);
            m.put("dbStatus", s[3]);
            m.put("dbPublicUrl", s[4]);
            m.put("dbPrivateUrl", "10.0." + (seq % 5) + "." + (seq % 200));
            m.put("dbPort", Integer.parseInt(s[5]));
            m.put("dbPassword", s[6]);
            m.put("shapeName", s[7]);
            m.put("dataStorageSizeInGBs", Integer.parseInt(s[8]));
            m.put("highlyAvailable", Integer.parseInt(s[9]));
            m.put("dbId", s[10]);
            m.put("cloudType", 1);
            m.put("dbType", 1);
            list.add(m);
            seq++;
        }
        return list;
    }
}
