/**
 * Nginx 管理页 — 安装引导 + 代理 / 证书 / 配置发布
 */
(function () {
    'use strict';

    var I = function (k, d) { return (window.I18N && window.I18N[k]) || d || k; };
    var installMode = 'local';
    var installCmd = '';
    var installMeta = null;
    var pollTimer = null;
    var ready = false;

    function csrfHeader() {
        var m = document.querySelector('meta[name="_csrf_header"]');
        return m ? m.getAttribute('content') : 'X-CSRF-TOKEN';
    }
    function csrfToken() {
        var m = document.querySelector('meta[name="_csrf"]');
        return m ? m.getAttribute('content') : '';
    }
    function headers(json) {
        var h = {};
        h[csrfHeader()] = csrfToken();
        if (json) h['Content-Type'] = 'application/json';
        return h;
    }
    function api(url, opt) {
        opt = opt || {};
        return fetch(url, {
            method: opt.method || 'GET',
            headers: headers(!!opt.body),
            body: opt.body ? JSON.stringify(opt.body) : undefined
        }).then(function (r) { return r.json(); });
    }
    function toast(icon, title, text) {
        return Swal.fire({ icon: icon, title: title, text: text || '', timer: icon === 'success' ? 2200 : undefined, showConfirmButton: icon !== 'success' });
    }
    function showLoading(msg) {
        if (typeof window.showLoading === 'function') window.showLoading(msg);
        else Swal.fire({ title: msg || '处理中…', allowOutsideClick: false, didOpen: function () { Swal.showLoading(); } });
    }
    function hideLoading() {
        if (typeof window.hideLoading === 'function') window.hideLoading();
        else Swal.close();
    }
    function formatDate(s) {
        if (!s) return '—';
        var d = new Date(s);
        if (isNaN(d.getTime())) return String(s).replace('T', ' ').substring(0, 16);
        function p(n) { return n < 10 ? '0' + n : '' + n; }
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    }

    /* ========== OpenResty 状态 / 安装 ========== */
    window.checkOpenRestyStatus = function (manual) {
        return api('/ssl/openresty/status').then(function (data) {
            if (!data.success || !data.data) {
                renderStatus({ level: 'missing', apiAvailable: false });
                return;
            }
            renderStatus(data.data);
            if (manual && data.data.apiAvailable) toast('success', '服务已就绪');
        }).catch(function () {
            renderStatus({ level: 'missing', apiAvailable: false });
        });
    };

    function renderStatus(st) {
        var level = st.level || (st.apiAvailable ? 'ready' : (st.localBinary ? 'partial' : 'missing'));
        ready = level === 'ready';
        var badge = document.getElementById('heroBadge');
        var title = document.getElementById('heroTitle');
        var desc = document.getElementById('heroDesc');
        var meta = document.getElementById('heroMeta');
        var actions = document.getElementById('heroActions');
        var stats = document.getElementById('nxStats');
        var ws = document.getElementById('workspace');

        badge.className = 'nx-hero-badge ' + level;
        if (level === 'ready') {
            badge.innerHTML = '<i class="fas fa-check-circle"></i> 已就绪';
            title.textContent = 'OpenResty 管理通道正常';
            desc.textContent = '可以管理反向代理、申请证书并一键发布配置。';
            actions.innerHTML =
                '<button type="button" class="btn btn-secondary" onclick="showInstallPanel()"><i class="fas fa-terminal"></i> 查看安装命令</button>';
            document.getElementById('installPanel').classList.remove('visible');
            stopPoll();
            if (stats) stats.style.display = 'grid';
            if (ws) ws.classList.remove('workspace-locked');
            document.getElementById('statApi').textContent = '在线';
            document.getElementById('statApi').className = 'v ok';
        } else if (level === 'partial') {
            badge.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 部分可用';
            title.textContent = '本机已安装，管理 API 未连通';
            desc.textContent = '请检查 openresty.api.base-url / token，或重新执行安装命令（systemd + 环境变量）。';
            actions.innerHTML =
                '<button type="button" class="btn btn-success btn-lg" onclick="showInstallPanel()"><i class="fas fa-magic"></i> 修复安装</button>' +
                '<button type="button" class="btn btn-warning" onclick="startOpenResty()"><i class="fas fa-play"></i> 尝试启动</button>';
            if (stats) stats.style.display = 'none';
            if (ws) ws.classList.add('workspace-locked');
            showInstallPanel(true);
        } else {
            badge.innerHTML = '<i class="fas fa-cloud-download-alt"></i> 未安装';
            title.textContent = '先安装 OpenResty，30 秒接入';
            desc.textContent = '复制下方一键命令，在服务器执行后回到本页。将自动安装 OpenResty、管理 API 与开机自启。';
            actions.innerHTML =
                '<button type="button" class="btn btn-success btn-lg" onclick="showInstallPanel()"><i class="fas fa-rocket"></i> 开始安装</button>';
            if (stats) stats.style.display = 'none';
            if (ws) ws.classList.add('workspace-locked');
            showInstallPanel(true);
        }

        var bits = [];
        if (st.apiBaseUrl) bits.push('<span>API <strong>' + escapeHtml(st.apiBaseUrl) + '</strong></span>');
        if (st.hasToken) bits.push('<span>Token <strong>已配置</strong></span>');
        if (st.systemdActive) bits.push('<span>systemd <strong>active</strong></span>');
        if (st.localBinary) bits.push('<span>本机二进制 <strong>有</strong></span>');
        meta.innerHTML = bits.join('');
    }

    window.showInstallPanel = function (silent) {
        var el = document.getElementById('installPanel');
        el.classList.add('visible');
        loadInstallCommand();
        if (!silent) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    window.hideInstallPanel = function () {
        if (!ready) return;
        document.getElementById('installPanel').classList.remove('visible');
        stopPoll();
    };
    window.switchInstallMode = function (mode, btn) {
        installMode = mode;
        document.querySelectorAll('.mode-pill').forEach(function (b) { b.classList.remove('active'); });
        if (btn) btn.classList.add('active');
        var hint = document.getElementById('installModeHint');
        var dockerExtra = document.getElementById('dockerExtra');
        if (mode === 'docker') {
            hint.innerHTML = 'oci-pool 跑在 <strong>Docker 桥接网络</strong> 时选此项。' +
                'OpenResty 装在<strong>宿主机</strong>，不要装进 Java 容器。' +
                '若容器已用 <code>network_mode: host</code>，请改选「同机 / host 网络」。';
            if (dockerExtra) dockerExtra.style.display = 'block';
        } else {
            hint.innerHTML = '裸机安装，或 oci-pool 使用 <code>network_mode: host</code> 时选此项（容器内 127.0.0.1 即宿主）。';
            if (dockerExtra) dockerExtra.style.display = 'none';
        }
        loadInstallCommand();
    };
    window.loadInstallCommand = function () {
        var box = document.getElementById('installCmdBox');
        box.innerHTML = '<span class="cmd-placeholder">正在生成安装命令…</span>';
        installCmd = '';
        installMeta = null;
        return api('/ssl/openresty/install-command?mode=' + encodeURIComponent(installMode)).then(function (data) {
            if (!data.success || !data.data) {
                box.innerHTML = '<span class="cmd-placeholder">生成失败：' + escapeHtml((data && data.message) || 'unknown') + '</span>';
                return;
            }
            installMeta = data.data;
            installCmd = data.data.command || '';
            box.textContent = installCmd;
            renderDockerExtra(data.data);
            renderInstallSteps(data.data.steps);
        }).catch(function () {
            box.innerHTML = '<span class="cmd-placeholder">网络错误</span>';
        });
    };
    function renderDockerExtra(meta) {
        var dockerExtra = document.getElementById('dockerExtra');
        var envBox = document.getElementById('dockerEnvBox');
        var alt = document.getElementById('dockerAltHint');
        if (!dockerExtra || installMode !== 'docker') {
            if (dockerExtra) dockerExtra.style.display = 'none';
            return;
        }
        dockerExtra.style.display = 'block';
        if (envBox) {
            envBox.textContent = meta.envSnippet ||
                ('-e OPENRESTY_API_BASE_URL=' + (meta.suggestedApiBaseUrl || 'http://172.17.0.1:8080/api') +
                    ' -e OPENRESTY_API_TOKEN=' + (meta.token || ''));
        }
        if (alt) {
            alt.innerHTML =
                '默认建议 <code>' + escapeHtml(meta.suggestedApiBaseUrl || 'http://172.17.0.1:8080/api') + '</code>（Linux docker0 网关）。' +
                ' Docker Desktop 或已配置 host-gateway 时可用 <code>' +
                escapeHtml(meta.suggestedApiBaseUrlAlt || 'http://host.docker.internal:8080/api') + '</code>。' +
                ' 启动参数可加 <code>' + escapeHtml(meta.extraHosts || '--add-host=host.docker.internal:host-gateway') + '</code>。' +
                ' 宿主机防火墙需放行 <strong>8080</strong>（仅内网/docker 网段，勿对公网裸奔）。';
        }
    }
    function renderInstallSteps(steps) {
        var wrap = document.getElementById('installSteps');
        if (!wrap || !steps || !steps.length) return;
        wrap.innerHTML = steps.map(function (s, i) {
            return '<div class="install-step"><div class="step-n">' + (i + 1) + '</div><h4>步骤 ' + (i + 1) + '</h4><p>' + escapeHtml(s) + '</p></div>';
        }).join('');
    }
    window.copyDockerEnv = function () {
        var t = (installMeta && installMeta.envSnippet) || (document.getElementById('dockerEnvBox') && document.getElementById('dockerEnvBox').textContent) || '';
        if (!t || t.indexOf('—') === 0) return;
        navigator.clipboard.writeText(t).then(function () { toast('success', '已复制环境变量'); });
    };
    window.copyComposeSnippet = function () {
        var t = (installMeta && installMeta.composeSnippet) || '';
        if (!t) { toast('error', '暂无 compose 片段'); return; }
        navigator.clipboard.writeText(t).then(function () { toast('success', '已复制 compose 片段'); });
    };
    window.copyInstallCommand = function () {
        if (!installCmd) {
            loadInstallCommand().then(function () { doCopy(); });
            return;
        }
        doCopy();
    };
    function doCopy() {
        if (!installCmd) return;
        navigator.clipboard.writeText(installCmd).then(function () {
            toast('success', '已复制', '请在服务器终端粘贴执行');
            startPoll();
        }).catch(function () {
            Swal.fire({ title: '请手动复制', html: '<pre style="text-align:left;white-space:pre-wrap;font-size:12px;">' + escapeHtml(installCmd) + '</pre>' });
            startPoll();
        });
    }
    function startPoll() {
        document.getElementById('pollHint').style.display = 'inline';
        stopPoll();
        pollTimer = setInterval(function () {
            checkOpenRestyStatus(false).then(function () {
                if (ready) {
                    stopPoll();
                    toast('success', '检测到服务已就绪');
                    loadInitialData();
                }
            });
        }, 4000);
    }
    function stopPoll() {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
        var h = document.getElementById('pollHint');
        if (h) h.style.display = 'none';
    }
    window.startOpenResty = function () {
        showLoading('正在启动…');
        api('/ssl/openresty/start', { method: 'POST' }).then(function (data) {
            hideLoading();
            if (data.success) {
                toast('success', '启动成功');
                checkOpenRestyStatus(false);
            } else toast('error', '启动失败', data.message);
        }).catch(function (e) {
            hideLoading();
            toast('error', '启动失败', e.message);
        });
    };

    /* ========== Tabs ========== */
    window.switchTab = function (btnEl) {
        var tab = btnEl.getAttribute('data-tab');
        document.querySelectorAll('.nginx-tab-content').forEach(function (t) { t.classList.remove('active'); });
        document.querySelectorAll('.nginx-tab-btn').forEach(function (b) { b.classList.remove('active'); });
        document.getElementById(tab).classList.add('active');
        btnEl.classList.add('active');
        if (tab === 'proxy') loadProxyList();
        if (tab === 'certificates') loadCertList();
        if (tab === 'nginx') loadConfigDiff();
    };

    function loadInitialData() {
        loadProxyList();
        loadCertList();
        loadConfigDiff();
    }

    /* ========== Proxy ========== */
    window.showAddProxyModal = function () { showProxyConfigModal({ mode: 'create' }); };
    window.editProxy = function (id) {
        api('/ssl/proxy/' + id).then(function (data) {
            if (!data.success) throw new Error(data.message);
            showProxyConfigModal({ mode: 'edit', proxyId: id, config: data.data });
        }).catch(function (e) { toast('error', I('nginx_toast_error', '错误'), e.message); });
    };
    window.deleteProxy = function (id) {
        Swal.fire({
            title: I('nginx_modal_confirmDelete', '确认删除'),
            text: I('nginx_modal_proxy_deleteConfirm', '将删除该反向代理并重新生成配置'),
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: I('nginx_modal_delete', '删除'),
            cancelButtonText: I('nginx_modal_cancel', '取消'),
            confirmButtonColor: '#f85149'
        }).then(function (r) {
            if (!r.isConfirmed) return;
            api('/ssl/proxy/' + id, { method: 'DELETE' }).then(function (data) {
                if (data.success) {
                    toast('success', I('nginx_toast_deleteSuccess', '已删除'));
                    loadProxyList();
                    updateConfigStatus('pending');
                } else toast('error', I('nginx_toast_deleteFail', '删除失败'), data.message);
            });
        });
    };
    window.testProxyConnection = function (id) {
        showLoading('测试连接…');
        api('/ssl/proxy/' + id + '/test-connection', { method: 'POST' }).then(function (data) {
            hideLoading();
            if (data.success) toast('success', '连接成功', data.message);
            else toast('error', '连接失败', data.message);
        }).catch(function (e) { hideLoading(); toast('error', '错误', e.message); });
    };
    window.applySslConfig = function (id) {
        Swal.fire({
            title: I('nginx_modal_ssl_title', '配置 SSL'),
            html: '<div style="text-align:left"><p style="color:var(--text-secondary);font-size:13px;margin-bottom:12px">通过 Cloudflare DNS-01 申请 Let\'s Encrypt 证书</p>' +
                '<label class="ssl-form-label">邮箱（可选）</label><input id="sslEmail" class="ssl-form-input" placeholder="admin@example.com"></div>',
            showCancelButton: true,
            confirmButtonText: I('nginx_modal_ssl_start', '开始'),
            cancelButtonText: I('nginx_modal_cancel', '取消'),
            confirmButtonColor: '#3fb950',
            preConfirm: function () {
                return document.getElementById('sslEmail').value || '';
            }
        }).then(function (r) {
            if (!r.isConfirmed) return;
            showLoading('提交中…');
            fetch('/ssl/proxy/' + id + '/ssl?email=' + encodeURIComponent(r.value || ''), {
                method: 'POST', headers: headers(false)
            }).then(function (res) { return res.json(); }).then(function (data) {
                hideLoading();
                if (data.success) {
                    toast('success', I('nginx_modal_ssl_success', '已提交'));
                    loadProxyList();
                    loadCertList();
                } else toast('error', I('nginx_modal_ssl_fail', '失败'), data.message);
            }).catch(function (e) { hideLoading(); toast('error', '错误', e.message); });
        });
    };
    window.refreshProxyList = function () {
        loadProxyList();
        toast('success', '已刷新');
    };
    function loadProxyList() {
        api('/ssl/proxy/list').then(function (data) {
            if (data.success) {
                var list = (data.data && data.data.content) || [];
                updateProxyTable(list);
                var el = document.getElementById('statProxy');
                if (el) el.textContent = String(list.length);
            } else showEmptyProxyTable();
        }).catch(showEmptyProxyTable);
    }
    function updateProxyTable(proxies) {
        var tbody = document.getElementById('proxyTableBody');
        if (!proxies.length) { showEmptyProxyTable(); return; }
        tbody.innerHTML = proxies.map(function (p) {
            var sslCls = p.sslStatus === 'CONFIGURED' ? 'active' : (p.sslStatus === 'PENDING' ? 'pending' : 'inactive');
            var cfgCls = p.configStatus === 'APPLIED' ? 'active' : (p.configStatus === 'PENDING' ? 'pending' : 'warning');
            return '<tr>' +
                '<td><span class="domain-text">' + escapeHtml(p.domain) + '</span></td>' +
                '<td><span class="target-text">' + escapeHtml(p.protocol + '://' + p.targetHost + ':' + p.targetPort) + '</span></td>' +
                '<td><span class="status-badge ' + sslCls + '">' + sslText(p.sslStatus) + '</span></td>' +
                '<td><span class="status-badge ' + cfgCls + '">' + cfgText(p.configStatus) + '</span></td>' +
                '<td>' + formatDate(p.createTime) + '</td>' +
                '<td><div class="btn-group">' +
                '<button class="btn btn-secondary btn-sm" onclick="editProxy(' + p.id + ')" title="编辑"><i class="fas fa-edit"></i></button>' +
                '<button class="btn btn-secondary btn-sm" onclick="testProxyConnection(' + p.id + ')" title="测试"><i class="fas fa-plug"></i></button>' +
                (p.sslStatus !== 'CONFIGURED' ? '<button class="btn btn-secondary btn-sm" onclick="applySslConfig(' + p.id + ')" title="SSL"><i class="fas fa-lock"></i></button>' : '') +
                '<button class="btn btn-danger btn-sm" onclick="deleteProxy(' + p.id + ')" title="删除"><i class="fas fa-trash"></i></button>' +
                '</div></td></tr>';
        }).join('');
    }
    function showEmptyProxyTable() {
        document.getElementById('proxyTableBody').innerHTML =
            '<tr><td colspan="6"><div class="empty-state">' +
            '<div class="empty-illu"><i class="fas fa-exchange-alt"></i></div>' +
            '<h3>还没有反向代理</h3><p>添加域名与上游，一键生成 Nginx 配置</p>' +
            '<button type="button" class="btn btn-success" onclick="showAddProxyModal()"><i class="fas fa-plus"></i> 添加代理</button>' +
            '</div></td></tr>';
        var el = document.getElementById('statProxy');
        if (el) el.textContent = '0';
    }
    function sslText(s) {
        return ({ CONFIGURED: '已配置', PENDING: '配置中', NOT_CONFIGURED: '未配置', ERROR: '失败' })[s] || '未配置';
    }
    function cfgText(s) {
        return ({ APPLIED: '已应用', PENDING: '待发布', ERROR: '错误', DISABLED: '已禁用' })[s] || s || '—';
    }

    window.showProxyConfigModal = function (options) {
        var mode = options.mode || 'create';
        var proxyId = options.proxyId;
        var config = options.config || {};
        var current = {
            domain: config.domain || '',
            protocol: config.protocol || 'http',
            targetHost: config.targetHost || '',
            targetPort: config.targetPort || '',
            enableSsl: !!config.enableSsl,
            enableWebSocket: config.enableWebSocket !== false,
            sslCertificateId: config.sslCertificateId || null,
            listenIp: '0.0.0.0',
            listenPort: config.enableSsl ? 443 : 80,
            httpToHttps: true,
            redirectPort: 80
        };
        var targets = [];
        try {
            if (config.customConfig) {
                var custom = JSON.parse(config.customConfig);
                if (custom.targets) targets = custom.targets;
                if (custom.listenIp) current.listenIp = custom.listenIp;
                if (custom.listenPort) current.listenPort = custom.listenPort;
                if (custom.httpToHttps !== undefined) current.httpToHttps = custom.httpToHttps;
                if (custom.redirectPort) current.redirectPort = custom.redirectPort;
            }
        } catch (e) { /* ignore */ }
        if (!targets.length) {
            targets = [{
                enabled: true,
                path: '/',
                url: current.targetHost ? (current.protocol + '://' + current.targetHost + ':' + current.targetPort) : '',
                websocket: current.enableWebSocket,
                host: ''
            }];
        }
        var targetsHtml = targets.map(function (t, idx) {
            return '<div class="proxy-target-item">' +
                '<div style="display:grid;grid-template-columns:auto 1fr 1.4fr 1fr auto;gap:10px;align-items:end">' +
                '<div><label class="ssl-form-label">启用</label><label class="toggle-switch"><input type="checkbox" class="target-enabled"' + (t.enabled !== false ? ' checked' : '') + '><span class="toggle-slider"></span></label></div>' +
                '<div><label class="ssl-form-label">路径</label><input class="target-path ssl-form-input" value="' + escapeAttr(t.path || '/') + '"></div>' +
                '<div><label class="ssl-form-label">目标 URL</label><input class="target-url ssl-form-input" placeholder="http://127.0.0.1:8080" value="' + escapeAttr(t.url || '') + '"></div>' +
                '<div><label class="ssl-form-label">Host</label><select class="target-host ssl-form-select">' +
                opt('', '默认', t.host) + opt('$host', '$host', t.host) + opt('$http_host', '$http_host', t.host) +
                '</select></div>' +
                '<button type="button" class="ssl-btn ssl-btn-danger" onclick="removeProxyTarget(this)" ' + (idx === 0 ? 'style="visibility:hidden"' : '') + '><i class="fas fa-trash"></i></button>' +
                '</div></div>';
        }).join('');

        var html = '<div style="text-align:left;max-height:62vh;overflow:auto;padding-right:4px">' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:12px">' +
            '<div>' +
            '<div class="ssl-form-group"><label class="ssl-form-label">监听域名 *</label>' +
            '<input id="serverName" class="ssl-form-input" value="' + escapeAttr(current.domain) + '" placeholder="api.example.com" onchange="updateSslPaths()"></div>' +
            '<div class="ssl-form-group"><label class="ssl-form-label">开启 SSL</label>' +
            '<select id="enableSsl" class="ssl-form-select" onchange="toggleSslConfig()">' +
            '<option value="no"' + (!current.enableSsl ? ' selected' : '') + '>否</option>' +
            '<option value="yes"' + (current.enableSsl ? ' selected' : '') + '>是</option></select></div>' +
            '<div class="ssl-form-group"><label class="ssl-form-label">监听端口</label>' +
            '<input id="listenPort" type="number" class="ssl-form-input" value="' + current.listenPort + '"></div>' +
            '<div class="ssl-form-group"><label class="ssl-form-label">监听 IP</label>' +
            '<input id="listenIp" class="ssl-form-input" value="' + escapeAttr(current.listenIp) + '"></div>' +
            '</div><div id="sslConfigSection">' +
            '<div class="ssl-form-group"><label class="ssl-form-label">选择证书</label>' +
            '<select id="sslKeyFile" class="ssl-form-select" onchange="handleCertificateChange()"><option value="">— 请选择 —</option><option value="upload">手动路径</option></select>' +
            '<div id="certificateLoading" style="display:none;font-size:12px;color:var(--text-muted);margin-top:6px"><i class="fas fa-spinner fa-spin"></i> 匹配证书…</div></div>' +
            '<div class="ssl-form-group"><label class="ssl-form-label">证书路径</label><input id="sslCertPath" class="ssl-form-input" placeholder="/path/fullchain.pem"></div>' +
            '<div class="ssl-form-group"><label class="ssl-form-label">私钥路径</label><input id="sslKeyPath" class="ssl-form-input" placeholder="/path/privkey.pem"></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
            '<div class="ssl-form-group"><label class="ssl-form-label">HTTP→HTTPS</label><select id="httpToHttps" class="ssl-form-select"><option value="yes"' + (current.httpToHttps ? ' selected' : '') + '>是</option><option value="no"' + (!current.httpToHttps ? ' selected' : '') + '>否</option></select></div>' +
            '<div class="ssl-form-group"><label class="ssl-form-label">跳转端口</label><input id="redirectPort" type="number" class="ssl-form-input" value="' + current.redirectPort + '"></div>' +
            '</div></div></div>' +
            '<div style="border-top:1px solid var(--card-border);padding-top:12px">' +
            '<h4 style="margin:0 0 10px;font-size:13px;color:var(--text-secondary)">代理目标</h4>' +
            '<div id="proxyTargets">' + targetsHtml + '</div>' +
            '<p style="margin:8px 0 0;font-size:12px;color:var(--text-muted)"><i class="fas fa-info-circle"></i> WebSocket 默认开启；修改后需到「配置发布」应用</p>' +
            '</div></div>';

        Swal.fire({
            title: mode === 'create' ? I('nginx_modal_proxy_add', '添加反向代理') : I('nginx_modal_proxy_edit', '编辑反向代理'),
            html: html,
            width: 920,
            showCancelButton: true,
            confirmButtonText: mode === 'create' ? I('nginx_modal_create', '创建') : I('nginx_modal_save', '保存'),
            cancelButtonText: I('nginx_modal_cancel', '取消'),
            confirmButtonColor: '#3fb950',
            didOpen: function () {
                if (current.enableSsl && current.domain) loadCertificatesForDomain(current.domain, current.sslCertificateId);
                else toggleSslConfig();
            },
            preConfirm: function () { return collectProxyConfig(mode, proxyId); }
        }).then(function (result) {
            if (!result.isConfirmed) return;
            if (mode === 'create') createProxyConfig(result.value);
            else updateProxyConfig(result.value);
        });
    };

    window.toggleSslConfig = function () {
        var on = document.getElementById('enableSsl').value === 'yes';
        var sec = document.getElementById('sslConfigSection');
        if (sec) sec.style.opacity = on ? '1' : '0.45';
        if (on) updateSslPaths();
    };
    window.updateSslPaths = function () {
        var d = document.getElementById('serverName');
        var en = document.getElementById('enableSsl');
        if (d && en && en.value === 'yes' && d.value) loadCertificatesForDomain(d.value);
    };
    window.loadCertificatesForDomain = function (domain, selectedId) {
        var loading = document.getElementById('certificateLoading');
        if (loading) loading.style.display = 'block';
        api('/ssl/certificates/match?domain=' + encodeURIComponent(domain)).then(function (data) {
            if (loading) loading.style.display = 'none';
            if (data.success && data.data && data.data.length) populateCertificateOptions(data.data, selectedId);
            else resetCertificateOptions();
        }).catch(function () {
            if (loading) loading.style.display = 'none';
            resetCertificateOptions();
        });
    };
    function resetCertificateOptions() {
        var sel = document.getElementById('sslKeyFile');
        if (!sel) return;
        sel.innerHTML = '<option value="">— 请选择 —</option><option value="upload">手动路径</option>';
    }
    function populateCertificateOptions(certs, selectedId) {
        var sel = document.getElementById('sslKeyFile');
        if (!sel) return;
        sel.innerHTML = '<option value="">— 请选择 —</option>';
        certs.forEach(function (c) {
            var o = document.createElement('option');
            o.value = c.id;
            o.textContent = c.domain || c.name;
            o.setAttribute('data-cert-path', c.certPath || '');
            o.setAttribute('data-key-path', c.keyPath || '');
            if (selectedId && String(c.id) === String(selectedId)) o.selected = true;
            sel.appendChild(o);
        });
        var up = document.createElement('option');
        up.value = 'upload';
        up.textContent = '手动路径';
        sel.appendChild(up);
        handleCertificateChange();
    }
    window.handleCertificateChange = function () {
        var sel = document.getElementById('sslKeyFile');
        if (!sel) return;
        var opt = sel.options[sel.selectedIndex];
        var cert = document.getElementById('sslCertPath');
        var key = document.getElementById('sslKeyPath');
        if (sel.value && sel.value !== 'upload') {
            cert.value = opt.getAttribute('data-cert-path') || '';
            key.value = opt.getAttribute('data-key-path') || '';
            cert.readOnly = true;
            key.readOnly = true;
        } else {
            cert.readOnly = false;
            key.readOnly = false;
            if (sel.value !== 'upload') { cert.value = ''; key.value = ''; }
        }
    };
    window.removeProxyTarget = function (btn) {
        var items = document.querySelectorAll('.proxy-target-item');
        if (items.length <= 1) {
            Swal.showValidationMessage('至少保留一个目标');
            return;
        }
        btn.closest('.proxy-target-item').remove();
    };
    window.collectProxyConfig = function (mode, proxyId) {
        var serverName = document.getElementById('serverName').value.trim();
        var enableSsl = document.getElementById('enableSsl').value === 'yes';
        var targets = [];
        document.querySelectorAll('.proxy-target-item').forEach(function (item) {
            targets.push({
                enabled: item.querySelector('.target-enabled').checked,
                path: item.querySelector('.target-path').value,
                url: item.querySelector('.target-url').value,
                websocket: true,
                host: item.querySelector('.target-host').value
            });
        });
        if (!serverName) { Swal.showValidationMessage('请填写监听域名'); return false; }
        var valid = targets.filter(function (t) { return t.enabled && t.url; });
        if (!valid.length) { Swal.showValidationMessage('请至少配置一个有效目标'); return false; }
        var first = valid[0], targetHost = '', targetPort = 80, protocol = 'http';
        try {
            var u = new URL(first.url);
            protocol = u.protocol.replace(':', '');
            targetHost = u.hostname;
            targetPort = u.port ? parseInt(u.port, 10) : (protocol === 'https' ? 443 : 80);
        } catch (e) {
            Swal.showValidationMessage('目标地址请使用完整 URL，如 http://127.0.0.1:8080');
            return false;
        }
        var config = {
            domain: serverName,
            targetHost: targetHost,
            targetPort: targetPort,
            protocol: protocol,
            enableSsl: enableSsl,
            enableWebSocket: true
        };
        if (mode === 'edit' && proxyId) config.id = proxyId;
        if (enableSsl) {
            var sslKeyFile = document.getElementById('sslKeyFile').value;
            if (!sslKeyFile) { Swal.showValidationMessage('开启 SSL 时请选择证书（或先申请）'); return false; }
            if (sslKeyFile !== 'upload') config.sslCertificateId = parseInt(sslKeyFile, 10);
        }
        config.customConfig = JSON.stringify({
            targets: valid,
            listenIp: document.getElementById('listenIp').value || '0.0.0.0',
            listenPort: parseInt(document.getElementById('listenPort').value || (enableSsl ? 443 : 80), 10),
            httpToHttps: document.getElementById('httpToHttps').value === 'yes',
            redirectPort: parseInt(document.getElementById('redirectPort').value || 80, 10)
        });
        return config;
    };
    function createProxyConfig(config) {
        showLoading(I('nginx_modal_creating', '创建中…'));
        api('/ssl/proxy/create', { method: 'POST', body: config }).then(function (data) {
            hideLoading();
            if (data.success) {
                toast('success', I('nginx_toast_createSuccess', '已创建'), I('nginx_toast_createSuccessDesc', '请到配置发布页应用'));
                loadProxyList();
                updateConfigStatus('pending');
            } else toast('error', I('nginx_toast_createFail', '创建失败'), data.message);
        }).catch(function (e) { hideLoading(); toast('error', '失败', e.message); });
    }
    function updateProxyConfig(config) {
        showLoading(I('nginx_modal_updating', '更新中…'));
        api('/ssl/proxy/' + config.id, { method: 'PUT', body: config }).then(function (data) {
            hideLoading();
            if (data.success) {
                toast('success', I('nginx_toast_updateSuccess', '已更新'));
                loadProxyList();
                updateConfigStatus('pending');
            } else toast('error', I('nginx_toast_updateFail', '更新失败'), data.message);
        }).catch(function (e) { hideLoading(); toast('error', '失败', e.message); });
    }

    /* ========== Certificates ========== */
    window.showRequestCertModal = function () {
        Swal.fire({
            title: '申请 SSL 证书',
            html: '<div style="text-align:left">' +
                '<div class="ssl-form-group"><label class="ssl-form-label">域名 *</label>' +
                '<input id="certDomain" class="ssl-form-input" placeholder="example.com 或 *.example.com"></div>' +
                '<div class="ssl-form-group"><label class="ssl-form-label">邮箱（可选）</label>' +
                '<input id="certEmail" type="email" class="ssl-form-input" placeholder="admin@example.com"></div>' +
                '<div class="ssl-form-group"><label class="ssl-form-label">DNS 服务商</label>' +
                '<select id="dnsProvider" class="ssl-form-select"><option value="CLOUDFLARE">Cloudflare</option></select></div>' +
                '<p style="font-size:12px;color:var(--text-muted);margin:0">使用已配置的 Cloudflare API 自动完成 DNS-01 验证，后台异步申请</p></div>',
            showCancelButton: true,
            confirmButtonText: '提交申请',
            cancelButtonText: I('nginx_modal_cancel', '取消'),
            confirmButtonColor: '#3fb950',
            preConfirm: function () {
                var domain = document.getElementById('certDomain').value.trim();
                if (!domain) { Swal.showValidationMessage('请填写域名'); return false; }
                return {
                    domain: domain,
                    email: document.getElementById('certEmail').value.trim(),
                    certificateType: 'LETS_ENCRYPT',
                    dnsProvider: document.getElementById('dnsProvider').value,
                    autoRenew: true
                };
            }
        }).then(function (r) {
            if (!r.isConfirmed) return;
            showLoading('提交中…');
            api('/ssl/certificates/request', { method: 'POST', body: r.value }).then(function (data) {
                hideLoading();
                if (data.success) {
                    toast('success', I('nginx_modal_cert_requestSuccess', '已提交'),
                        I('nginx_modal_cert_requestSuccessDesc', '后台申请中，稍后刷新查看状态'));
                    loadCertList();
                } else toast('error', I('nginx_modal_cert_requestFail', '失败'), data.message);
            }).catch(function (e) { hideLoading(); toast('error', '失败', e.message); });
        });
    };
    window.renewCert = function (id) {
        Swal.fire({ title: '确认续期？', icon: 'question', showCancelButton: true, confirmButtonText: '续期', cancelButtonText: I('nginx_modal_cancel', '取消'), confirmButtonColor: '#3fb950' })
            .then(function (r) {
                if (!r.isConfirmed) return;
                api('/ssl/certificates/' + id + '/renew', { method: 'POST' }).then(function (data) {
                    if (data.success) { toast('success', '已提交续期'); loadCertList(); }
                    else toast('error', '失败', data.message);
                });
            });
    };
    window.deleteCert = function (id) {
        Swal.fire({
            title: '删除证书？',
            text: '不可恢复；若被代理引用需先解除',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: I('nginx_modal_delete', '删除'),
            cancelButtonText: I('nginx_modal_cancel', '取消'),
            confirmButtonColor: '#f85149'
        }).then(function (r) {
            if (!r.isConfirmed) return;
            api('/ssl/certificates/' + id, { method: 'DELETE' }).then(function (data) {
                if (data.success) { toast('success', '已删除'); loadCertList(); }
                else toast('error', '失败', data.message);
            });
        });
    };
    window.toggleAutoRenew = function (id, checkbox) {
        var en = checkbox.checked;
        api('/ssl/certificates/' + id + '/auto-renew', { method: 'PUT', body: { enabled: en } }).then(function (data) {
            if (data.success) {
                checkbox.nextElementSibling.textContent = en ? '已启用' : '已禁用';
            } else {
                checkbox.checked = !en;
                toast('error', '失败', data.message);
            }
        }).catch(function () { checkbox.checked = !en; });
    };
    window.downloadCertificate = function (id, domain) {
        var a = document.createElement('a');
        a.href = '/ssl/certificates/' + id + '/download';
        a.download = (domain || 'cert').replace(/\./g, '_') + '_ssl.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };
    window.refreshCertList = function () { loadCertList(); toast('success', '已刷新'); };
    function loadCertList() {
        api('/ssl/certificates/list').then(function (data) {
            if (data.success) {
                var list = (data.data && data.data.content) || [];
                updateCertTable(list);
                var el = document.getElementById('statCert');
                if (el) el.textContent = String(list.length);
            } else showEmptyCertTable();
        }).catch(showEmptyCertTable);
    }
    function updateCertTable(list) {
        var tbody = document.getElementById('certTableBody');
        if (!list.length) { showEmptyCertTable(); return; }
        tbody.innerHTML = list.map(function (c) {
            var st = c.status === 'VALID' ? 'active' : (c.status === 'PENDING' ? 'pending' : 'warning');
            return '<tr>' +
                '<td><span class="domain-text">' + escapeHtml(c.domain) + '</span></td>' +
                '<td>' + (c.certificateType === 'CLOUDFLARE' ? 'Cloudflare' : "Let's Encrypt") + '</td>' +
                '<td><span class="status-badge ' + st + '">' + certText(c.status) + '</span></td>' +
                '<td>' + formatDate(c.issueDate) + '</td>' +
                '<td>' + formatDate(c.expireDate) + '</td>' +
                '<td><label class="auto-renew-label"><input type="checkbox" ' + (c.autoRenew ? 'checked' : '') +
                ' onclick="toggleAutoRenew(' + c.id + ', this)"><span>' + (c.autoRenew ? '已启用' : '已禁用') + '</span></label></td>' +
                '<td><div class="btn-group">' +
                '<button class="btn btn-secondary btn-sm" onclick="renewCert(' + c.id + ')" title="续期"><i class="fas fa-sync"></i></button>' +
                '<button class="btn btn-secondary btn-sm" onclick="downloadCertificate(' + c.id + ',\'' + escapeAttr(c.domain) + '\')" title="下载"><i class="fas fa-download"></i></button>' +
                '<button class="btn btn-danger btn-sm" onclick="deleteCert(' + c.id + ')" title="删除"><i class="fas fa-trash"></i></button>' +
                '</div></td></tr>';
        }).join('');
    }
    function showEmptyCertTable() {
        document.getElementById('certTableBody').innerHTML =
            '<tr><td colspan="7"><div class="empty-state">' +
            '<div class="empty-illu"><i class="fas fa-certificate"></i></div>' +
            '<h3>还没有证书</h3><p>通过 Cloudflare DNS 一键申请 Let\'s Encrypt</p>' +
            '<button type="button" class="btn btn-success" onclick="showRequestCertModal()"><i class="fas fa-plus"></i> 申请证书</button>' +
            '</div></td></tr>';
        var el = document.getElementById('statCert');
        if (el) el.textContent = '0';
    }
    function certText(s) {
        return ({ VALID: '有效', PENDING: '申请中', EXPIRED: '已过期', EXPIRING_SOON: '即将过期', ERROR: '失败' })[s] || s || '—';
    }

    /* ========== Config publish ========== */
    window.applyNginxConfig = function () {
        Swal.fire({
            title: '应用新配置？',
            text: '将测试语法、写入并重载 OpenResty',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: '确认应用',
            cancelButtonText: I('nginx_modal_cancel', '取消'),
            confirmButtonColor: '#3fb950'
        }).then(function (r) {
            if (!r.isConfirmed) return;
            showLoading('应用中…');
            api('/ssl/nginx/latest').then(function (data) {
                if (!data.success || !data.data) throw new Error('无法获取最新配置');
                return api('/ssl/nginx/' + data.data.id + '/apply', { method: 'POST' });
            }).then(function (applyData) {
                hideLoading();
                if (!applyData.success) throw new Error(applyData.message || '应用失败');
                toast('success', I('nginx_toast_applySuccess', '已应用'));
                updateConfigStatus('success');
                loadConfigDiff();
                loadProxyList();
            }).catch(function (e) {
                hideLoading();
                toast('error', I('nginx_toast_applyFail', '应用失败'), e.message);
            });
        });
    };
    window.testNginxConfig = function () {
        showLoading('测试中…');
        api('/ssl/nginx/latest').then(function (data) {
            if (!data.success || !data.data) throw new Error('无配置');
            return api('/ssl/nginx/' + data.data.id + '/test', { method: 'POST' });
        }).then(function (data) {
            hideLoading();
            if (data.success) toast('success', '语法通过');
            else toast('error', '测试失败', data.message);
        }).catch(function (e) { hideLoading(); toast('error', '测试失败', e.message); });
    };
    window.reloadNginxConfig = function () {
        Swal.fire({ title: '重载 Nginx？', icon: 'question', showCancelButton: true, confirmButtonText: '重载', cancelButtonText: I('nginx_modal_cancel', '取消') })
            .then(function (r) {
                if (!r.isConfirmed) return;
                api('/ssl/nginx/reload', { method: 'POST' }).then(function (data) {
                    if (data.success) toast('success', I('nginx_toast_reloadSuccess', '已重载'));
                    else toast('error', I('nginx_toast_reloadFail', '失败'), data.message);
                });
            });
    };
    window.refreshConfigDiff = function () { loadConfigDiff(); toast('success', '已刷新'); };
    function loadConfigDiff() {
        var cur = document.getElementById('currentConfigContent');
        var lat = document.getElementById('latestConfigContent');
        if (cur) cur.textContent = '加载中…';
        if (lat) lat.textContent = '加载中…';
        api('/ssl/nginx/diff').then(function (data) {
            if (!data.success) {
                if (cur) cur.textContent = data.message || '加载失败';
                if (lat) lat.textContent = data.message || '加载失败';
                return;
            }
            var d = data.data || {};
            if (cur) cur.textContent = (d.current && d.current.configContent) || '（尚无已应用配置）';
            if (lat) lat.textContent = (d.latest && d.latest.configContent) || '（尚无生成配置）';
            var hasChanges = d.latest && (!d.current || d.current.id !== d.latest.id);
            updateConfigStatus(hasChanges ? 'pending' : (d.current ? 'success' : 'error'));
            var ver = document.getElementById('statCfg');
            if (ver) {
                var cv = d.current && d.current.configVersion;
                var lv = d.latest && d.latest.configVersion;
                ver.textContent = cv != null ? ('v' + cv + (lv != null && lv !== cv ? ' → v' + lv : '')) : (lv != null ? 'v' + lv : '—');
            }
        }).catch(function (e) {
            if (cur) cur.textContent = e.message;
            if (lat) lat.textContent = e.message;
        });
    }
    function updateConfigStatus(status) {
        var el = document.getElementById('configStatus');
        var applyBtn = document.getElementById('applyBtn');
        if (!el) return;
        el.className = 'config-status-bar ' + status;
        if (status === 'pending') {
            el.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>有未发布的配置变更，请核对右侧「最新生成」后点击应用</span>';
            if (applyBtn) applyBtn.disabled = false;
        } else if (status === 'success') {
            el.innerHTML = '<i class="fas fa-check-circle"></i><span>配置已与线上一致</span>';
            if (applyBtn) applyBtn.disabled = true;
        } else {
            el.innerHTML = '<i class="fas fa-times-circle"></i><span>暂无可用配置</span>';
            if (applyBtn) applyBtn.disabled = true;
        }
    }
    window.copyDiffContent = function (id, btn) {
        var t = document.getElementById(id).textContent;
        navigator.clipboard.writeText(t).then(function () {
            btn.innerHTML = '<i class="fas fa-check"></i> 已复制';
            btn.classList.add('copied');
            setTimeout(function () {
                btn.innerHTML = '<i class="fas fa-copy"></i> 复制';
                btn.classList.remove('copied');
            }, 1600);
        });
    };

    /* ========== utils ========== */
    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function escapeAttr(s) {
        return escapeHtml(s).replace(/'/g, '&#39;');
    }
    function opt(v, label, cur) {
        return '<option value="' + escapeAttr(v) + '"' + (cur === v ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
    }

    document.addEventListener('DOMContentLoaded', function () {
        checkOpenRestyStatus(false).then(function () {
            loadInitialData();
        });
    });
})();
