<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <meta name="_csrf" content="">
    <meta name="_csrf_header" content="X-CSRF-TOKEN">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${msg.get('nginx.page.title')}</title>
    <script>(function(){var t=localStorage.getItem('oci_theme')||'dark';if(t==='system')t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.dataset.theme=t;})();</script>
    <link rel="stylesheet" href="/css/all.min.css">
    <link rel="stylesheet" href="/css/common/fa-fix.css">
    <link href="/css/sweetalert2.min.css" rel="stylesheet">
    <link href="/css/common/sweetalert-overrides.css" rel="stylesheet">
    <script src="/js/sweetalert2.min.js"></script>
    <link rel="stylesheet" href="/css/common/loading.css">
    <link rel="stylesheet" href="/css/app/nginx_config.css?v=${.now?string('yyyyMMddHHmm')}">
</head>
<body>
<div class="layout">
<main class="main-content">
<div class="page-card">

    <div class="page-header">
        <div>
            <h1 class="page-title">
                <span class="title-icon"><i class="fas fa-network-wired"></i></span>
                <span>${msg.get('nginx.page.title')}</span>
            </h1>
            <p class="page-sub">反向代理 · SSL 证书 · 配置发布 · OpenResty 一键接入</p>
        </div>
        <div class="view-actions">
            <button type="button" class="btn btn-secondary" id="btnRecheck" onclick="checkOpenRestyStatus(true)">
                <i class="fas fa-sync-alt"></i> 刷新状态
            </button>
            <button type="button" class="btn btn-secondary" id="btnInstallGuide" onclick="showInstallPanel()">
                <i class="fas fa-download"></i> 安装引导
            </button>
        </div>
    </div>

    <div class="page-body">
        <!-- Hero 状态 -->
        <section class="nx-hero" id="nxHero">
            <div class="nx-hero-main">
                <div class="nx-hero-badge missing" id="heroBadge"><i class="fas fa-circle-notch fa-spin"></i> 检测中</div>
                <h2 id="heroTitle">正在检测 OpenResty…</h2>
                <p id="heroDesc">检查管理 API 与本机服务状态</p>
                <div class="nx-hero-meta" id="heroMeta"></div>
            </div>
            <div class="nx-hero-actions" id="heroActions"></div>
        </section>

        <!-- 就绪后统计条 -->
        <div class="nx-stats" id="nxStats" style="display:none;">
            <div class="nx-stat"><div class="k">管理 API</div><div class="v ok" id="statApi">—</div></div>
            <div class="nx-stat"><div class="k">代理规则</div><div class="v" id="statProxy">—</div></div>
            <div class="nx-stat"><div class="k">SSL 证书</div><div class="v" id="statCert">—</div></div>
            <div class="nx-stat"><div class="k">配置版本</div><div class="v" id="statCfg">—</div></div>
        </div>

        <!-- 安装向导 -->
        <section class="install-panel" id="installPanel">
            <div class="install-panel-hd">
                <h3><i class="fas fa-rocket" style="color:var(--accent-green)"></i> 一键安装 OpenResty</h3>
                <button type="button" class="btn btn-ghost btn-sm" onclick="hideInstallPanel()"><i class="fas fa-times"></i></button>
            </div>
            <div class="install-panel-bd">
                <div class="mode-pills" role="tablist">
                    <button type="button" class="mode-pill active" data-mode="local" onclick="switchInstallMode('local', this)">同机 / host 网络</button>
                    <button type="button" class="mode-pill" data-mode="docker" onclick="switchInstallMode('docker', this)">Docker 桥接网络</button>
                </div>
                <p id="installModeHint" style="margin:0 0 12px;font-size:13px;color:var(--text-secondary);">
                    裸机安装，或 oci-pool 使用 <code>network_mode: host</code> 时选此项
                </p>
                <div class="cmd-box" id="installCmdBox"><span class="cmd-placeholder">正在生成安装命令…</span></div>
                <div class="cmd-actions">
                    <button type="button" class="btn btn-success btn-lg" id="btnCopyInstall" onclick="copyInstallCommand()">
                        <i class="fas fa-copy"></i> 复制安装命令
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="loadInstallCommand()">
                        <i class="fas fa-redo"></i> 重新生成
                    </button>
                    <span id="pollHint" style="font-size:12px;color:var(--text-muted);display:none;">
                        <span class="polling-dot"></span>等待服务上线，自动检测中…
                    </span>
                </div>
                <!-- Docker 补充配置（仅 docker 模式显示） -->
                <div id="dockerExtra" style="display:none;margin-top:18px;">
                    <div class="install-step" style="margin-bottom:12px;border-color:color-mix(in srgb, var(--accent-blue) 35%, var(--card-border));">
                        <h4 style="margin:0 0 8px;display:flex;align-items:center;gap:8px;">
                            <i class="fab fa-docker" style="color:var(--accent-blue)"></i> 容器侧还要配这一步
                        </h4>
                        <p style="margin:0 0 10px;font-size:12px;color:var(--text-secondary);line-height:1.5;">
                            OpenResty 装在<strong>宿主机</strong>；Java 在容器里，需要能访问宿主的 <code>:8080</code> 管理 API。
                            重启 oci-pool 容器时注入环境变量（或写入 compose）：
                        </p>
                        <div class="cmd-box" id="dockerEnvBox" style="color:#79c0ff;margin-bottom:10px;"><span class="cmd-placeholder">—</span></div>
                        <div class="cmd-actions" style="margin-top:0;">
                            <button type="button" class="btn btn-secondary btn-sm" onclick="copyDockerEnv()"><i class="fas fa-copy"></i> 复制环境变量</button>
                            <button type="button" class="btn btn-secondary btn-sm" onclick="copyComposeSnippet()"><i class="fas fa-copy"></i> 复制 compose 片段</button>
                        </div>
                        <p id="dockerAltHint" style="margin:12px 0 0;font-size:12px;color:var(--text-muted);line-height:1.5;"></p>
                    </div>
                </div>
                <div class="install-steps" id="installSteps">
                    <div class="install-step">
                        <div class="step-n">1</div>
                        <h4>SSH 登录服务器</h4>
                        <p>使用 root 或具备 sudo 的账号登录目标机器</p>
                    </div>
                    <div class="install-step">
                        <div class="step-n">2</div>
                        <h4>粘贴并执行命令</h4>
                        <p>自动安装 OpenResty、写入管理 API 与 systemd</p>
                    </div>
                    <div class="install-step">
                        <div class="step-n">3</div>
                        <h4>回到本页</h4>
                        <p>状态变为「已就绪」后即可管理代理与证书</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- 业务工作区 -->
        <div id="workspace">
            <div class="nginx-tabs">
                <button type="button" class="nginx-tab-btn active" data-tab="proxy" onclick="switchTab(this)">
                    <i class="fas fa-exchange-alt"></i> 反向代理
                </button>
                <button type="button" class="nginx-tab-btn" data-tab="certificates" onclick="switchTab(this)">
                    <i class="fas fa-certificate"></i> SSL 证书
                </button>
                <button type="button" class="nginx-tab-btn" data-tab="nginx" onclick="switchTab(this)">
                    <i class="fas fa-code"></i> 配置发布
                </button>
            </div>

            <!-- 反向代理 -->
            <div id="proxy" class="nginx-tab-content active">
                <div class="tab-actions">
                    <div class="tab-actions-left">
                        <button type="button" class="btn btn-success" onclick="showAddProxyModal()">
                            <i class="fas fa-plus"></i> 添加代理
                        </button>
                        <button type="button" class="btn btn-secondary" onclick="refreshProxyList()">
                            <i class="fas fa-sync-alt"></i> 刷新
                        </button>
                    </div>
                    <div class="tab-actions-right">
                        <button type="button" class="btn btn-secondary" onclick="switchTab(document.querySelector('[data-tab=nginx]'))">
                            <i class="fas fa-file-code"></i> 查看 / 发布配置
                        </button>
                    </div>
                </div>
                <div class="table-wrap">
                    <table class="nginx-table">
                        <thead>
                        <tr>
                            <th>域名</th>
                            <th>目标</th>
                            <th>SSL</th>
                            <th>配置状态</th>
                            <th>创建时间</th>
                            <th>操作</th>
                        </tr>
                        </thead>
                        <tbody id="proxyTableBody">
                        <tr><td colspan="6"><div class="empty-state"><div class="empty-illu"><i class="fas fa-spinner fa-spin"></i></div><p>加载中…</p></div></td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- 证书 -->
            <div id="certificates" class="nginx-tab-content">
                <div class="tab-actions">
                    <div class="tab-actions-left">
                        <button type="button" class="btn btn-success" onclick="showRequestCertModal()">
                            <i class="fas fa-plus"></i> 申请证书
                        </button>
                        <button type="button" class="btn btn-secondary" onclick="refreshCertList()">
                            <i class="fas fa-sync-alt"></i> 刷新
                        </button>
                    </div>
                </div>
                <div class="table-wrap">
                    <table class="nginx-table">
                        <thead>
                        <tr>
                            <th>域名</th>
                            <th>类型</th>
                            <th>状态</th>
                            <th>签发</th>
                            <th>过期</th>
                            <th>自动续期</th>
                            <th>操作</th>
                        </tr>
                        </thead>
                        <tbody id="certTableBody">
                        <tr><td colspan="7"><div class="empty-state"><div class="empty-illu"><i class="fas fa-spinner fa-spin"></i></div><p>加载中…</p></div></td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- 配置发布 -->
            <div id="nginx" class="nginx-tab-content">
                <div class="config-status-bar pending" id="configStatus">
                    <i class="fas fa-info-circle"></i>
                    <span>加载配置状态…</span>
                </div>
                <div class="tab-actions">
                    <div class="tab-actions-left">
                        <button type="button" class="btn btn-secondary" onclick="testNginxConfig()">
                            <i class="fas fa-vial"></i> 测试语法
                        </button>
                        <button type="button" class="btn btn-success" id="applyBtn" onclick="applyNginxConfig()">
                            <i class="fas fa-check"></i> 应用并重载
                        </button>
                        <button type="button" class="btn btn-secondary" onclick="reloadNginxConfig()">
                            <i class="fas fa-redo"></i> 仅重载
                        </button>
                    </div>
                    <div class="tab-actions-right">
                        <button type="button" class="btn btn-secondary" onclick="refreshConfigDiff()">
                            <i class="fas fa-sync-alt"></i> 刷新对比
                        </button>
                    </div>
                </div>
                <div class="diff-container" id="diffContainer">
                    <div class="diff-panel">
                        <div class="diff-panel-header">
                            <span><i class="fas fa-server"></i> 当前已应用</span>
                            <button type="button" class="copy-btn" onclick="copyDiffContent('currentConfigContent', this)"><i class="fas fa-copy"></i> 复制</button>
                        </div>
                        <pre class="diff-content" id="currentConfigContent">加载中…</pre>
                    </div>
                    <div class="diff-panel">
                        <div class="diff-panel-header">
                            <span><i class="fas fa-file-alt"></i> 最新生成</span>
                            <button type="button" class="copy-btn" onclick="copyDiffContent('latestConfigContent', this)"><i class="fas fa-copy"></i> 复制</button>
                        </div>
                        <pre class="diff-content" id="latestConfigContent">加载中…</pre>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
</main>
</div>

<script src="/js/common/request.js"></script>
<script src="/js/common/loading.js"></script>
<script>
window.I18N = {
    common_confirm: "${msg.get('common.confirm')?js_string}",
    common_cancel:  "${msg.get('common.cancel')?js_string}",
    nginx_toast_success: "${msg.get('nginx.toast.success')?js_string}",
    nginx_toast_error:   "${msg.get('nginx.toast.error')?js_string}",
    nginx_modal_create:  "${msg.get('nginx.modal.create')?js_string}",
    nginx_modal_save:    "${msg.get('nginx.modal.save')?js_string}",
    nginx_modal_cancel:  "${msg.get('nginx.modal.cancel')?js_string}",
    nginx_modal_delete:  "${msg.get('nginx.modal.delete')?js_string}",
    nginx_modal_confirmDelete: "${msg.get('nginx.modal.confirmDelete')?js_string}",
    nginx_modal_proxy_add:  "${msg.get('nginx.modal.proxy.add')?js_string}",
    nginx_modal_proxy_edit: "${msg.get('nginx.modal.proxy.edit')?js_string}",
    nginx_modal_proxy_deleteConfirm: "${msg.get('nginx.modal.proxy.deleteConfirm')?js_string}",
    nginx_modal_cert_requestSuccess: "${msg.get('nginx.modal.cert.requestSuccess')?js_string}",
    nginx_modal_cert_requestSuccessDesc: "${msg.get('nginx.modal.cert.requestSuccessDesc')?js_string}",
    nginx_modal_cert_requestFail: "${msg.get('nginx.modal.cert.requestFail')?js_string}",
    nginx_modal_ssl_title: "${msg.get('nginx.modal.ssl.title')?js_string}",
    nginx_modal_ssl_start: "${msg.get('nginx.modal.ssl.start')?js_string}",
    nginx_modal_ssl_success: "${msg.get('nginx.modal.ssl.success')?js_string}",
    nginx_modal_ssl_fail: "${msg.get('nginx.modal.ssl.fail')?js_string}",
    nginx_toast_createSuccess: "${msg.get('nginx.toast.createSuccess')?js_string}",
    nginx_toast_createSuccessDesc: "${msg.get('nginx.toast.createSuccessDesc')?js_string}",
    nginx_toast_createFail: "${msg.get('nginx.toast.createFail')?js_string}",
    nginx_toast_updateSuccess: "${msg.get('nginx.toast.updateSuccess')?js_string}",
    nginx_toast_updateFail: "${msg.get('nginx.toast.updateFail')?js_string}",
    nginx_toast_deleteSuccess: "${msg.get('nginx.toast.deleteSuccess')?js_string}",
    nginx_toast_deleteFail: "${msg.get('nginx.toast.deleteFail')?js_string}",
    nginx_toast_applySuccess: "${msg.get('nginx.toast.applySuccess')?js_string}",
    nginx_toast_applyFail: "${msg.get('nginx.toast.applyFail')?js_string}",
    nginx_toast_reloadSuccess: "${msg.get('nginx.toast.reloadSuccess')?js_string}",
    nginx_toast_reloadFail: "${msg.get('nginx.toast.reloadFail')?js_string}",
    nginx_modal_creating: "${msg.get('nginx.modal.creating')?js_string}",
    nginx_modal_updating: "${msg.get('nginx.modal.updating')?js_string}"
};
</script>
<script src="/js/system/nginx_config.js?v=${.now?string('yyyyMMddHHmm')}"></script>
</body>
</html>
