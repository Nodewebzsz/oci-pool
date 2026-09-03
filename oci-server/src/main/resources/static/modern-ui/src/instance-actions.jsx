// Instance action hooks — for the "..." menu and top toolbar on the Instances page.

function useInstanceDetailDrawer() {
  const shell = useShell();
  const { lang } = useT();
  return React.useCallback((inst) => {
    const runAction = makeInstanceActionRunner(shell, inst);
    const copyText = async (text, label) => {
      try { await navigator.clipboard.writeText(String(text)); shell.showToast(tr('inst.f5a3a8').replace('{0}',label), { kind: 'success' }); }
      catch { shell.showToast(tr('inst.41da1c'), { kind: 'warn' }); }
    };
    shell.openDrawer({
      title: inst.name,
      subtitle: <span><span className="mono">{inst.tenantName}</span> · <RegionBadge code={inst.region} lang={lang} style={{ display: 'inline-flex' }} /></span>,
      icon: 'server',
      iconColor: 'var(--cyan)',
      statusDot: inst.status,
      width: 700,
      body: (
        <div>
          <SectionLabel>{tr('inst.9c0f66')}</SectionLabel>
          <KVList columns={2} items={[
            { label: 'Shape', value: <span className="mono">{inst.shape || '—'}</span> },
            { label: tr('inst.0eaa6a'), value: <span className="mono">{getInstanceArch(inst)}</span> },
            { label: 'OCPU', value: <span className="mono">{getInstanceCpu(inst)}</span> },
            { label: tr('inst.993255'), value: <span className="mono">{getInstanceMem(inst)} GB</span> },
            { label: tr('inst.4f5537'), value: <span className="mono">{inst.disk} GB</span> },
            { label: 'VPU', value: <span className="mono">{inst.vpu}</span> },
          ]} />

          <SectionLabel style={{ marginTop: 18 }}>{tr('inst.7ddbe1')}</SectionLabel>
          <KVList columns={2} items={[
            { label: tr('inst.883217'), value: <span className="mono" style={{ color: 'var(--cyan)' }}>{getInstanceIp(inst)}</span> },
            { label: 'IPv6', value: inst.ipv6 === 'enabled' ? <span style={{ color: 'var(--accent)' }}>{inst.ipv6Addresses || tr('inst.53ace4')}</span> : <span style={{ color: 'var(--fg-3)' }}>{tr('inst.463776')}</span> },
            { label: 'VCN', value: <span className="mono">{inst.vcnId || '—'}</span> },
            { label: tr('inst.7d45d5'), value: <span className="mono">{inst.subnetId || '—'}</span> },
          ]} />

          <SectionLabel style={{ marginTop: 18 }}>OCID</SectionLabel>
          <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
            <div className="mono" style={{
              flex: 1,
              padding: '8px 10px',
              background: 'var(--bg-2)', border: '1px solid var(--border)',
              borderRadius: 6, fontSize: 10.5, color: 'var(--fg-2)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{inst.instanceId ?? '—'}</div>
            <Button size="sm" variant="outline" icon="copy" disabled={!inst.instanceId} onClick={() => copyText(inst.instanceId, tr('inst.a99501'))}>{tr('inst.79d3ab')}</Button>
          </div>

          <SectionLabel style={{ marginTop: 18 }}>{tr('inst.af67e7')}</SectionLabel>
          <div style={{ padding: 16, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--fg-3)', fontSize: 12 }}>
            {tr('inst.243f22')}
          </div>
        </div>
      ),
      actions: (
        <>
          {inst.status === 'running' ? (
            <>
              <Button
                size="sm"
                variant="outline"
                icon="rotate-cw"
                disabled
                title={tr('inst.870ef0')}
              >{tr('inst.78d9be')}</Button>
              <Button size="sm" variant="outline" icon="square" onClick={() => runAction('stop')}>{tr('inst.095e93')}</Button>
            </>
          ) : (
            <Button size="sm" variant="primary" icon="play" onClick={() => runAction('start')}>{tr('inst.8e54dd')}</Button>
          )}
          <Button size="sm" variant="outline" icon="terminal" onClick={() => { shell.closeDrawer(); openSshConfigModal(shell, inst); }}>SSH</Button>
          <Button size="sm" variant="outline" icon="monitor" onClick={() => { shell.closeDrawer(); window.dispatchEvent(new CustomEvent('oci:open-vnc', { detail: inst })); }}>VNC</Button>
        </>
      ),
    });
  }, [shell, lang]);
}

// ── Real VNC console ─────────────────────────────────────────────────────
// Binds the frontend VNC button to the backend /ws/console WebSocket protocol:
//   client → {"type":"create_connection","data":{instanceId, tenantId, displayName}}
//   server → streamed text lines + {"type":"vnc_ready", vncUrl, websockifyPort, ...}
//          or {"type":"error", message}
// The backend creates the OCI console connection + SSH tunnel + starts websockify,
// then hands back vncUrl for the client to render (noVNC). This deployment has no
// live instances, so the tunnel/画面 can't be visually verified, but the protocol
// handshake + error path are real and are exercised here.
function VncConsoleModal({ inst, onClose }) {
  const [lines, setLines] = React.useState([]);          // streamed server text
  const [state, setState] = React.useState('connecting'); // connecting | running | error | closed
  const [errMsg, setErrMsg] = React.useState('');
  const [vncUrl, setVncUrl] = React.useState('');
  const [wsPort, setWsPort] = React.useState('');
  const [rfbReady, setRfbReady] = React.useState(!!(window.OCiVnc && window.OCiVnc.RFB)); // noVNC 模块装载
  const boxRef = React.useRef(null);                     // 文本日志区
  const vncHostRef = React.useRef(null);                 // noVNC 渲染挂载点
  const sockRef = React.useRef(null);
  const rfbRef = React.useRef(null);
  const heartbeatRef = React.useRef(null);

  const push = React.useCallback((txt) => {
    setLines(prev => {
      const next = [...prev, txt];
      return next.length > 300 ? next.slice(next.length - 300) : next;
    });
  }, []);

  // 等待 noVNC ES module 装载完成(set window.OCiVnc)
  React.useEffect(() => {
    if (rfbReady) return;
    const t = setInterval(() => {
      if (window.OCiVnc && window.OCiVnc.RFB) { setRfbReady(true); clearInterval(t); }
    }, 200);
    return () => clearInterval(t);
  }, [rfbReady]);

  React.useEffect(() => {
    const base = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host;
    let ws;
    try {
      ws = new WebSocket(`${base}/ws/console`);
    } catch (e) {
      setState('error'); setErrMsg(tr('inst.faf08a') + e.message);
      return;
    }
    sockRef.current = ws;

    ws.onopen = () => {
      push(tr('inst.578a8e'));
      // /ws/console 的 instanceId 实际是 InstanceDetails 数据库主键，
      // 后端会用 getInstanceById(Long) 查询；不能回退到 OCI instanceId。
      const instanceDetailsId = inst.dbId ?? inst.id;
      const tenantDbId = inst.tenantId;
      if (instanceDetailsId === undefined || instanceDetailsId === null || String(instanceDetailsId).trim() === '') {
        setState('error'); setErrMsg(tr('inst.0aab91'));
        ws.close(); return;
      }
      if (tenantDbId === undefined || tenantDbId === null || String(tenantDbId).trim() === '') {
        setState('error'); setErrMsg(tr('inst.cc84e4'));
        ws.close(); return;
      }
      const msg = {
        type: 'create_connection',
        data: {
          instanceId: String(instanceDetailsId),
          tenantId: String(tenantDbId),
          displayName: inst.name || 'vnc-console',
          connectionType: 'vnc',
        },
      };
      ws.send(JSON.stringify(msg));
      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
        }
      }, 30000);
    };

    ws.onmessage = (ev) => {
      const txt = ev.data;
      if (typeof txt === 'string' && txt.startsWith('{')) {
        try {
          const j = JSON.parse(txt);
          if (j.type === 'heartbeat') {
            if (sockRef.current && sockRef.current.readyState === WebSocket.OPEN) {
              sockRef.current.send(JSON.stringify({ type: 'heartbeat_response', timestamp: Date.now() }));
            }
            return;
          }
          if (j.type === 'heartbeat_response' || j.type === 'pong') return;
          if (j.type === 'vnc_ready') {
            const readyUrl = j.vncUrl || '';
            const readyPort = j.websockifyPort || '';
            // 后端在 websockify 启动失败时仍会发送 vnc_ready，但不会提供
            // vncUrl/websockifyPort；此时不能把界面标记为“已就绪”。
            if (!readyUrl && !readyPort) {
              const message = j.message || tr('inst.3ea4de');
              setState('error'); setErrMsg(message); push('✗ ' + message);
              return;
            }
            setVncUrl(readyUrl);
            setWsPort(readyPort);
            setState('running');
            push(tr('inst.a9645a').replace('{0}',readyPort || '-'));
            return;
          }
          if (j.type === 'output') {
            // ConsoleWebSocketHandler wraps progress text as {type:"output",data:"..."}.
            // Render only the backend payload instead of leaking the JSON envelope.
            push(j.data == null ? '' : String(j.data));
            return;
          }
          if (j.type === 'error') {
            setState('error'); setErrMsg(j.message || tr('inst.73d320'));
            push('✗ ' + (j.message || tr('inst.73d320')));
            return;
          }
        } catch { /* 非 JSON 文本,视为控制台输出 */ }
      }
      push(txt);
    };

    ws.onerror = () => {
      setState('error'); setErrMsg(tr('inst.78e6ea'));
      push(tr('inst.6a796a'));
    };

    ws.onclose = () => {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
      setState(s => (s === 'running' ? 'closed' : s));
      push(tr('inst.4a0067'));
    };

    return () => {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
      try {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'disconnect' }));
      } catch {}
      try { ws.close(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inst]);

  React.useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  // 当 vnc_ready + noVNC 就绪 + 挂载点存在 → 用 RFB 渲染真实画面
  React.useEffect(() => {
    if (state !== 'running' || !rfbReady || !vncHostRef.current) return;
    const RFB = window.OCiVnc && window.OCiVnc.RFB;
    if (!RFB) return;
    const url = window.OCiVnc.buildVncUrl({ websockifyPort: wsPort, vncUrl });
    if (!url) return;

    if (rfbRef.current) { try { rfbRef.current.disconnect(); } catch {} rfbRef.current = null; }

    // 清空挂载点旧节点(RFB 会在 target 里创建 canvas)
    vncHostRef.current.innerHTML = '';

    let rfb;
    try {
      rfb = new RFB(vncHostRef.current, url, {
        credentials: { username: 'ubuntu', password: '' },
        shared: true,
        repeaterID: '',
        wsProtocols: ['binary'],
        qualityLevel: 9,
        compressionLevel: 0,
      });
      rfb.scaleViewport = true;
      rfb.resizeSession = false;
    } catch (e) {
      setErrMsg(tr('inst.f98c3b') + (e && e.message || e));
      return;
    }
    rfbRef.current = rfb;

    rfb.addEventListener('connect', () => push(tr('inst.dffa67') + url));
    rfb.addEventListener('disconnect', (e) => {
      push(tr('inst.996924') + (e && e.detail && e.detail.clean ? '' : tr('inst.ecfc64')));
    });
    rfb.addEventListener('credentialsrequired', () => {
      // 会话来自 Cloud-Init,通常无需手动凭据;若服务端要求则提示
      push(tr('inst.857ade'));
    });

    return () => { if (rfbRef.current) { try { rfbRef.current.disconnect(); } catch {} rfbRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, rfbReady, wsPort, vncUrl]);

  const sendInput = (val) => {
    if (rfbRef.current) {
      // 通过 noVNC 发送键盘输入更贴合真实桌面;此处仅作演示,走 input 通道已废弃
      try { rfbRef.current._canvas && rfbRef.current._canvas.focus(); } catch {}
      setLines(prev => [...prev, tr('inst.4f25ea')]);
      return;
    }
    if (sockRef.current && sockRef.current.readyState === WebSocket.OPEN) {
      sockRef.current.send(JSON.stringify({ type: 'input', data: val }));
    } else {
      setLines(prev => [...prev, tr('inst.b438e4')]);
    }
  };

  return (
    <div style={{ padding: 22 }}>
      <div style={{ padding: 10, background: 'var(--info-soft)', borderRadius: 6, marginBottom: 14, fontSize: 11.5, color: 'var(--fg-1)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <Icon name="info" size={13} style={{ color: 'var(--info)', marginTop: 2, flexShrink: 0 }} />
        <div>
          {tr('inst.897385')} <span className="mono" style={{ color: 'var(--fg-0)' }}>/ws/console</span>{tr('inst.922cbc')} <span className="mono" style={{ color: 'var(--fg-0)' }}>/websockify/{'{port}'}</span>。
        </div>
      </div>

      {state === 'error' && (
        <div style={{ padding: '10px 12px', marginBottom: 12, background: 'color-mix(in oklab, var(--danger) 12%, transparent)', border: '1px solid var(--danger)', borderRadius: 6, fontSize: 12, color: 'var(--danger)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Icon name="alert-circle" size={14} />
          {errMsg}
        </div>
      )}
      {state === 'running' && (
        <div style={{ padding: '8px 12px', marginBottom: 12, background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 6, fontSize: 12, color: 'var(--accent)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Icon name="check-circle-2" size={14} />
          <span>{tr('inst.c30ecc')} {wsPort ? tr('inst.4b8fe2').replace('{0}',wsPort) : ''}{rfbReady ? '' : tr('inst.9f8260')}</span>
        </div>
      )}

      {/* noVNC 画面挂载区(运行时才有) */}
      {(state === 'running') && (
        <div style={{
          position: 'relative', background: 'oklch(0.08 0.01 250)', border: '1px solid var(--border-strong)',
          borderRadius: 6, overflow: 'hidden', minHeight: 320, maxHeight: 460, marginBottom: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div ref={vncHostRef} style={{ width: '100%', height: '100%', minHeight: 320 }} />
          {(!rfbReady) && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-3)', fontSize: 12.5 }}>
              {tr('inst.777c5f')}
            </div>
          )}
        </div>
      )}

      <div ref={boxRef} style={{
        background: 'oklch(0.06 0.005 240)', border: '1px solid var(--border-strong)',
        borderRadius: 6, padding: 16, fontFamily: 'var(--font-mono)', fontSize: 11.5,
        color: 'oklch(0.85 0.05 155)', minHeight: state === 'running' ? 120 : 300, maxHeight: 260, overflow: 'auto', lineHeight: 1.7,
      }}>
        {lines.length === 0 && <div style={{ color: 'oklch(0.55 0.05 240)' }}>{tr('inst.4eb3c3')}</div>}
        {lines.map((l, i) => <div key={i} style={{ whiteSpace: 'pre-wrap' }}>{l}</div>)}
      </div>

      {/* 断开按钮(桌面交互在 VNC 画面内直接进行) */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
        <Button variant="outline" size="md" icon="send" onClick={onClose}>{tr('inst.3fe7b5')}</Button>
      </div>
    </div>
  );
}

function useVncModal() {
  const shell = useShell();
  return React.useCallback((inst) => {
    shell.openModal({
      title: `VNC · ${inst.name}`,
      subtitle: <span className="mono" style={{ color: 'var(--cyan)' }}>{getInstanceIp(inst)}:5900</span>,
      icon: 'monitor',
      iconColor: 'var(--cyan)',
      size: 'lg',
      body: <VncConsoleModal inst={inst} onClose={shell.closeModal} />,
      onClose: shell.closeModal,
      footer: (
        <>
          <div style={{ flex: 1 }} />
          <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('inst.3fe7b5')}</Button>
        </>
      ),
    });
  }, [shell]);
}

// ── Real SSH terminal + SFTP ─────────────────────────────────────────────
// SshWebSocketHandler 的协议是 connect/input/resize，输出为原始文本帧。
// 这里不使用本地终端假数据；连接、输入、上传、下载全部直达后端。
function SshTerminalModal({ inst, config, onClose }) {
  const [lines, setLines] = React.useState([]);
  const [status, setStatus] = React.useState('connecting');
  const [error, setError] = React.useState('');
  const [input, setInput] = React.useState('');
  const [remotePath, setRemotePath] = React.useState('/tmp/');
  const [file, setFile] = React.useState(null);
  const [transfer, setTransfer] = React.useState('');
  const socketRef = React.useRef(null);
  const outputRef = React.useRef(null);

  const append = React.useCallback((text) => {
    if (text == null || text === '') return;
    setLines(prev => [...prev, String(text)].slice(-500));
  }, []);

  React.useEffect(() => {
    const base = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host;
    let ws;
    try { ws = new WebSocket(`${base}/ws/ssh`); }
    catch (e) { setStatus('error'); setError(tr('inst.288089').replace('{0}',e.message || e)); return; }
    socketRef.current = ws;
    ws.onopen = () => {
      const host = config?.host || getInstanceIp(inst);
      const port = Number(config?.port || 22);
      if (!host || !config?.username) {
        setStatus('error'); setError(tr('inst.0d11d4'));
        ws.close(); return;
      }
      ws.send(JSON.stringify({ type: 'connect', data: {
        host, port, username: config.username, password: config.password || '',
      } }));
      ws.send(JSON.stringify({ type: 'resize', data: { cols: 120, rows: 32 } }));
      append(tr('inst.397a7a').replace('{0}',config.username).replace('{1}',host).replace('{2}',port));
    };
    ws.onmessage = (event) => {
      const text = String(event.data == null ? '' : event.data);
      if (/SSH conn error|IO 初始化失败|SSH WebSocket 连接失败/i.test(text)) {
        setStatus('error'); setError(text.replace(/[\r\n]+/g, ' ').trim());
      } else setStatus(current => current === 'error' ? current : 'connected');
      append(text);
    };
    ws.onerror = () => { setStatus('error'); setError(tr('inst.377227')); append(tr('inst.a785a6')); };
    ws.onclose = () => { setStatus(s => s === 'error' ? s : 'closed'); append(tr('inst.98204f')); };
    return () => { try { ws.close(); } catch {} };
  }, [append, config, inst]);

  React.useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [lines]);

  const sendInput = (value) => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError(tr('inst.edfb58'));
      setStatus('error');
      return;
    }
    ws.send(JSON.stringify({ type: 'input', data: value }));
  };

  const upload = async () => {
    if (!file) { setError(tr('inst.68ea13')); return; }
    setTransfer('uploading'); setError('');
    try {
      const result = await window.ociServices.instance.sftpUpload({
        host: config.host || getInstanceIp(inst), port: Number(config.port || 22),
        username: config.username, password: config.password || '', remotePath, file,
      });
      if (!result?.success) throw new Error(result?.message || tr('inst.54e5de'));
      append(`✓ ${result.message || tr('inst.uploadOk')}`);
    } catch (e) { setError(tr('inst.f183d4').replace('{0}',e.message || e)); }
    finally { setTransfer(''); }
  };

  const download = async () => {
    if (!remotePath.trim()) { setError(tr('inst.2f318b')); return; }
    setTransfer('downloading'); setError('');
    try {
      const response = await window.ociServices.instance.sftpDownloadResponse({
        host: config.host || getInstanceIp(inst), port: Number(config.port || 22),
        username: config.username, password: config.password || '', remotePath: remotePath.trim(),
      });
      const disposition = response?.headers?.get?.('Content-Disposition') || '';
      const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\r\n]+)/i);
      const serverName = match ? decodeURIComponent(match[1]) : '';
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = serverName || remotePath.trim().split('/').pop() || 'download';
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      append(tr('inst.85c304').replace('{0}',remotePath.trim()));
    } catch (e) { setError(tr('inst.2459fd').replace('{0}',e.message || e)); }
    finally { setTransfer(''); }
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontSize: 12 }}>
        <span className="mono">{config.username}@{config.host || getInstanceIp(inst)}:{config.port || 22}</span>
        <span style={{ color: status === 'connected' ? 'var(--accent)' : status === 'error' ? 'var(--danger)' : 'var(--fg-2)' }}>
          {status === 'connected' ? tr('inst.c5ea9c') : status === 'error' ? tr('inst.d52359') : status === 'closed' ? tr('inst.3842ba') : tr('inst.5e8eb2')}
        </span>
      </div>
      {error && <div style={{ padding: '8px 10px', marginBottom: 10, color: 'var(--danger)', background: 'var(--danger-soft)', border: '1px solid var(--danger)', borderRadius: 5, fontSize: 11.5 }}>{error}</div>}
      <div ref={outputRef} style={{ height: 300, overflow: 'auto', padding: 12, background: 'oklch(0.06 0.005 240)', border: '1px solid var(--border-strong)', borderRadius: 6, color: 'oklch(0.85 0.05 155)', fontFamily: 'var(--font-mono)', fontSize: 11.5, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
        {lines.length ? lines.join('') : tr('inst.d32d7a')}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <input value={input} disabled={status !== 'connected'} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { sendInput(`${input}\n`); setInput(''); } }} placeholder={tr('inst.d863c8')} style={{ flex: 1, padding: '8px 10px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--fg-0)', fontFamily: 'var(--font-mono)' }} />
        <Button size="sm" variant="primary" disabled={status !== 'connected' || !input} onClick={() => { sendInput(input); setInput(''); }}>{tr('inst.1535fc')}</Button>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 12 }}>
        <TextInput value={remotePath} onChange={setRemotePath} mono placeholder={tr('inst.d8ed13')} />
        <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} style={{ maxWidth: 180, color: 'var(--fg-2)', fontSize: 11 }} />
        <Button size="sm" variant="outline" loading={transfer === 'uploading'} disabled={status !== 'connected' || transfer === 'uploading'} onClick={upload}>{tr('inst.d5a73b')}</Button>
        <Button size="sm" variant="outline" loading={transfer === 'downloading'} disabled={status !== 'connected' || transfer === 'downloading'} onClick={download}>{tr('inst.f26ef9')}</Button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}><Button variant="ghost" size="md" onClick={onClose}>{tr('inst.3fe7b5')}</Button></div>
    </div>
  );
}

function openSshTerminalModal(shell, inst, config) {
  shell.openModal({
    title: tr('inst.22cceb').replace('{0}',inst.name),
    subtitle: <span className="mono">{config.username}@{config.host || getInstanceIp(inst)}:{config.port || 22}</span>,
    icon: 'terminal', iconColor: 'var(--accent)', size: 'lg',
    body: <SshTerminalModal inst={inst} config={config} onClose={shell.closeModal} />,
    onClose: shell.closeModal,
  });
}

function openSshConfigModal(shell, inst) {
  const ConfigBody = () => {
    const [cfg, setCfg] = React.useState({ username: 'ubuntu', port: '22', password: '' });
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState('');
    React.useEffect(() => {
      window.ociServices.instance.getSshConfig({ instanceId: String(inst.dbId ?? inst.id) })
        .then(j => {
          if (!j?.success) throw new Error(j?.message || tr('inst.a8f036'));
          if (!j.data) {
            // 首次连接时后端没有 CloudSshConn；保留诊断信息但仍展示
            // 可编辑表单，让用户能够录入并保存真实 SSH 凭据。
            setError(j.message || tr('inst.590fdf'));
            return;
          }
          setCfg({ username: j.data.username || 'ubuntu', port: String(j.data.port || 22), password: j.data.sshPassword || '', host: j.data.host || getInstanceIp(inst) });
        })
        .catch(e => setError(tr('inst.6e8dad').replace('{0}',e.message || e)))
        .finally(() => setLoading(false));
    }, []);
    if (loading) return <div style={{ padding: 24, color: 'var(--fg-2)' }}>{tr('inst.21b06c')}</div>;
    return <div style={{ padding: 20 }}>
      {error && <div style={{ color: 'var(--danger)', background: 'var(--danger-soft)', border: '1px solid var(--danger)', borderRadius: 6, padding: 10, marginBottom: 12, fontSize: 12 }}>{error}</div>}
      <FormRow label={tr('inst.652273')}><span className="mono">{cfg.host || getInstanceIp(inst) || tr('inst.0e3de5')}</span></FormRow>
      <FormRow label={tr('inst.819767')} required><TextInput value={cfg.username} onChange={v => setCfg({ ...cfg, username: v })} mono /></FormRow>
      <FormRow label={tr('inst.c76cfe')} required><NumberInput value={Number(cfg.port)} onChange={v => setCfg({ ...cfg, port: String(v) })} min={1} max={65535} /></FormRow>
      <FormRow label={tr('inst.a81052')} required hint={tr('inst.7c4826')}><TextInput value={cfg.password} onChange={v => setCfg({ ...cfg, password: v })} type="password" mono /></FormRow>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('inst.625fb2')}</Button>
        <Button variant="outline" size="md" icon="terminal" disabled={!cfg.username.trim() || !cfg.password || !(cfg.host || getInstanceIp(inst))} onClick={() => { shell.closeModal(); openSshTerminalModal(shell, inst, cfg); }}>{tr('inst.e0f0e4')}</Button>
        <Button variant="primary" size="md" loading={saving} disabled={saving || !cfg.username.trim() || !cfg.password} onClick={async () => {
          setSaving(true);
          try {
            const j = await window.ociServices.instance.saveSshConfig({ instanceId: String(inst.dbId ?? inst.id), username: cfg.username, port: cfg.port, password: cfg.password });
            if (!j?.success) throw new Error(j?.message || tr('inst.092aaf'));
            shell.closeModal(); shell.showToast(tr('inst.a28612'), { kind: 'success' });
          } catch (e) { shell.showToast(tr('inst.2c9309').replace('{0}',e.message || e), { kind: 'error' }); }
          finally { setSaving(false); }
        }}>{tr('inst.be5fbb')}</Button>
      </div>
    </div>;
  };
  shell.openModal({ title: tr('inst.8c0f0f').replace('{0}',inst.name), icon: 'terminal', iconColor: 'var(--cyan)', size: 'md', body: <ConfigBody /> });
}

function useReinstallModal() {
  const shell = useShell();
  return React.useCallback((inst) => {
    const state = { os: 'ubuntu-22.04', cloudInit: 'none', keepData: false };
    const render = () => {
      shell.openModal({
        title: tr('inst.0dab1f').replace('{0}',inst.name),
        subtitle: tr('inst.88057b'),
        icon: 'refresh-cw',
        iconColor: 'var(--orange)',
        size: 'md',
        body: (
          <div style={{ padding: 22 }}>
            <div style={{
              padding: 10, background: 'var(--danger-soft)', border: '1px solid var(--danger)',
              borderRadius: 6, marginBottom: 14, fontSize: 11.5, color: 'var(--fg-1)',
              display: 'flex', gap: 8, alignItems: 'flex-start',
            }}>
              <Icon name="alert-triangle" size={13} style={{ color: 'var(--danger)', marginTop: 2 }} />
              <div><b style={{ color: 'var(--danger)' }}>{tr('inst.829281')}</b> {tr('inst.989bd4')}</div>
            </div>

            <FormRow label={tr('inst.a0e88e')} required>
              <CheckboxGroup
                value={[state.os]}
                onChange={v => { state.os = v[v.length - 1] || state.os; render(); }}
                columns={2}
                options={[
                  { value: 'ubuntu-22.04', label: 'Ubuntu 22.04 LTS' },
                  { value: 'ubuntu-24.04', label: 'Ubuntu 24.04 LTS' },
                  { value: 'oracle-linux-9', label: 'Oracle Linux 9' },
                  { value: 'debian-12', label: 'Debian 12' },
                  { value: 'rocky-9', label: 'Rocky Linux 9' },
                  { value: 'alma-9', label: 'AlmaLinux 9' },
                ]}
              />
            </FormRow>

            <FormRow label={tr('inst.48d067')}>
              <CustomDropdown value={state.cloudInit} onChange={e => { state.cloudInit = e; render(); }} height={32} width="100%">
                <option value="none">{tr('inst.57ed11')}</option>
                <option value="docker-bbr">docker + bbr</option>
                <option value="k3s">{tr('inst.f5f734')}</option>
                <option value="xray-reality">Xray + Reality</option>
              </CustomDropdown>
            </FormRow>

            <div style={{ padding: 12, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, marginTop: 4, fontSize: 11.5 }}>
              <b style={{ color: 'var(--fg-0)' }}>{tr('inst.2e4a64')}</b>
              <ul style={{ margin: '4px 0 0 0', paddingLeft: 16, color: 'var(--fg-2)' }}>
                <li>{tr('inst.0a77f5')} <span className="mono" style={{ color: 'var(--cyan)' }}>{getInstanceIp(inst)}</span></li>
                <li>{tr('inst.cb642e')}</li>
                <li>{tr('inst.87cc8a')}</li>
              </ul>
            </div>
          </div>
        ),
        footer: (
          <>
            <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('inst.625fb2')}</Button>
            <Button variant="danger" size="md" icon="refresh-cw" onClick={() => {
              shell.closeModal();
              shell.openConfirm({
                title: tr('inst.df0204').replace('{0}',inst.name),
                body: <div>{tr('inst.a1f3b2')}<br/>{tr('inst.1fa2e6')} <b>{state.os}</b></div>,
                danger: true,
                requireText: inst.name,
                confirmLabel: tr('inst.542e15'),
                onConfirm: async () => {
                  try {
                    const j = await window.ociServices.instance.quickDD2({ instanceId: String(inst.dbId ?? inst.id), osType: state.osType || state.os || 'Ubuntu', osVersion: state.osVersion || '', ddPassword: state.ddPassword || '' });
                    if (j?.success) { shell.showToast(tr('inst.3457d3').replace('{0}',inst.name).replace('{1}',state.os), { kind: 'warn' }); window.dispatchEvent(new CustomEvent('oci:instances-changed')); }
                    else shell.showToast(tr('inst.ffdbec').replace('{0}',(j && j.message) || ''), { kind: 'error' });
                  } catch (e) { shell.showToast(tr('inst.ffdbec').replace('{0}',e.message || e), { kind: 'error' }); }
                },
              });
            }}>{tr('inst.38ce27')}</Button>
          </>
        ),
      });
    };
    render();
  }, [shell]);
}

function useSnapshotModal() {
  const shell = useShell();
  return React.useCallback((inst) => {
    const state = { name: `${inst.name}-${new Date().toISOString().slice(0, 10)}`, description: '', freezeFs: true };
    const render = () => {
      shell.openModal({
        title: tr('inst.5196be').replace('{0}',inst.name),
        subtitle: tr('inst.ad3da0'),
        icon: 'camera',
        iconColor: 'var(--info)',
        size: 'md',
        body: (
          <div style={{ padding: 22 }}>
            <FormRow label={tr('inst.b67cbf')} required>
              <TextInput mono value={state.name} onChange={v => { state.name = v; render(); }} />
            </FormRow>
            <FormRow label={tr('inst.26420e')}>
              <TextArea value={state.description} onChange={v => { state.description = v; render(); }} rows={2} placeholder={tr('inst.c3cd7c')} />
            </FormRow>
            <label style={{
              padding: '9px 12px', background: 'var(--bg-2)', border: '1px solid var(--border)',
              borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, cursor: 'pointer',
            }}>
              <ToggleSwitch value={state.freezeFs} onChange={v => { state.freezeFs = v; render(); }} />
              <span style={{ flex: 1, color: 'var(--fg-0)' }}>{tr('inst.e5e2c2')}</span>
              <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>{tr('inst.9a91dd')}</span>
            </label>
          </div>
        ),
        footer: (
          <>
            <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('inst.625fb2')}</Button>
            <Button variant="primary" size="md" icon="camera" onClick={async () => {
              try {
                const j = await window.ociServices.instance.sysImageBackUp({ instanceId: String(inst.dbId ?? inst.id), tenantId: String(inst.tenantId ?? ''), compartmentId: inst.compartmentId || '' });
                // /oci/sysImageBackUp 成功时返回空 200；只有明确的错误
                // 状态或 success=false 才算失败。
                if (!j || (j.status !== 'error' && j.success !== false)) {
                  shell.showToast(tr('inst.f6e8b8').replace('{0}',state.name), { kind: 'success' });
                  window.dispatchEvent(new CustomEvent('oci:instances-changed'));
                  shell.closeModal();
                } else {
                  shell.showToast(tr('inst.ad4401').replace('{0}',j.message || j.error || tr('inst.unknown')), { kind: 'error' });
                }
              } catch (e) { shell.showToast(tr('inst.ad4401').replace('{0}',e.message || e), { kind: 'error' }); }
            }}>{tr('inst.d9ac92')}</Button>
          </>
        ),
      });
    };
    render();
  }, [shell]);
}

// ─── 16 项 · 实例行操作(2 列浮动菜单) ──────────────────────
// 对齐原项目"实例管理"表格行的操作集合;由 tenant-resources 等页面调用
// - 使用 portal 挂到 document.body,避免被父级 transform 上下文影响
// - 定位:菜单右边缘对齐按钮右边缘,紧贴按钮下方;下方空间不足则向上翻转
// - 危险动作(终止/删除)显示红色;成功/信息动作显示对应主题色
function InstanceRowActionMenu({ inst, anchorEl, onClose, onAction }) {
  // 按原项目 doubleDimple/oci-start 的 oci_machine_list.ftl dropdown-panel 严格对齐:
  // - state === 'stopped' → 显示"启动实例";state === 'running' → 显示"停止实例"
  //   其他后端状态不添加启停动作，保持与原项目条件分支一致。
  // - ipv6 === 'enabled'  → 显示 "复制IPv6" + "管理IPv6" (2 项)
  //   否则              → 显示 "启用IPv6" (1 项 · 引导用户购买/分配 IPv6)
  // - 终止/删除记录 用 danger 色;其它标为主题色以区分组
  const isRunning = inst?.status === 'running';
  const isStopped = inst?.status === 'stopped';
  const hasIpv6   = inst?.ipv6 === 'enabled';

  const items = [];
  if (isStopped) {
    items.push({ id: 'start', label: tr('inst.a4d877'), icon: 'play',   color: 'var(--accent)' });
  } else if (isRunning) {
    items.push({ id: 'stop',  label: tr('inst.1e1f9b'), icon: 'square', color: 'var(--orange)' });
  }
  items.push({ id: 'terminate', label: tr('inst.8d33c6'), icon: 'x-square', color: 'var(--danger)' });
  items.push({ id: 'edit-note', label: tr('inst.b1bfe2'), icon: 'edit-3' });
  items.push({ id: 'edit-name', label: tr('inst.797426'), icon: 'tag' });
  items.push({ id: 'edit-shape', label: tr('inst.2e4b9b'), icon: 'cpu' });
  items.push({ id: 'edit-disk',  label: tr('inst.64694d'), icon: 'hard-drive' });
  // 原项目提供 VPU 调整入口；当前后端没有对应 Controller，保留入口并在弹窗中明确提示未执行。
  items.push({ id: 'edit-vpu',   label: tr('inst.0777f6'), icon: 'sliders', color: 'var(--fg-3)' });
  items.push({ id: 'copy-ipv4',   label: tr('inst.6ed0d0'), icon: 'copy',       color: 'var(--info)' });
  items.push({ id: 'switch-ipv4', label: tr('inst.428d82'), icon: 'refresh-cw' });
  if (hasIpv6) {
    items.push({ id: 'copy-ipv6',   label: tr('inst.fa6732'), icon: 'copy',  color: 'var(--info)' });
    items.push({ id: 'manage-ipv6', label: tr('inst.5bb7a3'), icon: 'globe' });
  } else {
    items.push({ id: 'enable-ipv6', label: tr('inst.af776f'), icon: 'plus-circle', color: 'var(--accent)' });
  }
  items.push({ id: 'ssh',     label: tr('inst.b4399d'), icon: 'terminal', color: 'var(--accent)' });
  items.push({ id: 'vnc',     label: tr('inst.7d20ca'), icon: 'monitor' });
  items.push({ id: 'network', label: tr('inst.2f6dbb'), icon: 'share-2' });
  items.push({ id: 'reinstall',  label: tr('inst.d797c4'), icon: 'rotate-ccw', color: 'var(--orange)' });
  items.push({ id: 'delete-rec', label: tr('inst.a79020'), icon: 'trash-2',    color: 'var(--danger)' });

  const header = (
    <>
      <StatusDot status={inst?.status || 'idle'} size={5} pulse={isRunning} />
      <span className="mono" style={{
        color: 'var(--fg-0)', fontWeight: 500,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        flex: 1, minWidth: 0,
      }}>{inst?.name || tr('inst.480c21')}</span>
      <span style={{ fontSize: 9.5, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {items.length} {tr('inst.29645b')}
      </span>
    </>
  );

  return (
    <RowActionMenu
      anchorEl={anchorEl}
      header={header}
      items={items}
      onClose={onClose}
      onAction={(id) => onAction(id, inst)}
    />
  );
}

// 通用的 dispatch(接受 shell + inst + tenant 上下文,返回 (actionId) => void)
function makeInstanceActionRunner(shell, inst, tenant) {
  const svc = window.ociServices && window.ociServices.instance;
  const dbId = String(inst.dbId ?? inst.id ?? '');
  const ociId = String(inst.instanceId ?? '');
  const refreshInstances = () => {
    try { window.dispatchEvent(new CustomEvent('oci:instances-changed')); } catch {}
  };
  const responseSucceeded = (payload) => payload && (payload.success === true || payload.status === 'success');
  const runMutation = async (request, successMessage, failureLabel) => {
    try {
      const payload = await request();
      if (!responseSucceeded(payload)) throw new Error(payload?.message || tr('inst.d33183').replace('{0}',failureLabel));
      shell.showToast(successMessage, { kind: 'success' });
      refreshInstances();
      return payload;
    } catch (e) {
      shell.showToast(`${failureLabel}: ${e.message || e}`, { kind: 'error' });
      return null;
    }
  };
  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      shell.showToast(tr('inst.4e74a2').replace('{0}',label).replace('{1}',text), { kind: 'success' });
    } catch {
      shell.showToast(tr('inst.039b03').replace('{0}',text), { kind: 'warn' });
    }
  };
  return (actionId) => {
    switch (actionId) {
      case 'stop':
        shell.openConfirm({
          title: tr('inst.27fe8c'),
          body: <div>{tr('inst.7a2207')} <b className="mono">{inst.name}</b>?<div style={{ marginTop: 6, color: 'var(--fg-3)' }}>{tr('inst.4e4368')}</div></div>,
          confirmLabel: tr('inst.1e1f9b'),
          onConfirm: async () => {
            await runMutation(() => svc.stop({ instanceId: dbId }), tr('inst.8136aa').replace('{0}',inst.name), tr('inst.095e93'));
          },
        });
        return;
      case 'start':
        shell.openConfirm({
          title: tr('inst.27fe8c'),
          body: <div>{tr('inst.813a7c')} <b className="mono">{inst.name}</b>?</div>,
          confirmLabel: tr('inst.a4d877'),
          onConfirm: async () => {
            await runMutation(() => svc.start({ instanceId: dbId }), tr('inst.f90a9c').replace('{0}',inst.name), tr('inst.8e54dd'));
          },
        });
        return;
      case 'terminate':
        openTerminateInstanceModal(shell, inst);
        return;
      case 'edit-note':
        openUpdateRemarkModal(shell, inst);
        return;
      case 'edit-name':
        openUpdateNameModal(shell, inst);
        return;
      case 'edit-shape':
        openUpdateConfigModal(shell, inst);
        return;
      case 'edit-disk':
        openUpdateBootVolumeModal(shell, inst);
        return;
      case 'edit-vpu':
        openUpdateVpuModal(shell, inst);
        return;
      case 'copy-ipv4':
        return copyToClipboard(getInstanceIp(inst) || tr('inst.0e3de5'), 'IPv4');
      case 'switch-ipv4':
        openChangeIpModal(shell, inst);
        return;
      case 'copy-ipv6':
        return copyToClipboard(
          Array.isArray(inst.ipv6Addresses) ? inst.ipv6Addresses.join(', ') : (inst.ipv6Addresses || tr('inst.463776')),
          'IPv6',
        );
      case 'manage-ipv6':
        openManageIpv6Modal(shell, inst);
        return;
      case 'enable-ipv6':
        openManageIpv6Modal(shell, inst, { mode: 'enable' });
        return;
      case 'ssh':
        try { window.dispatchEvent(new CustomEvent('oci:open-ssh', { detail: inst })); } catch {}
        return;
      case 'vnc':
        try { window.dispatchEvent(new CustomEvent('oci:open-vnc', { detail: inst })); } catch {}
        return;
      case 'network':
        openNetworkManageModal(shell, inst);
        return;
      case 'reinstall':
        openQuickDDModal(shell, inst);
        return;
      case 'delete-rec':
        shell.openConfirm({
          title: tr('inst.6a88be').replace('{0}',inst.name),
          body: (
            <div>
              {tr('inst.6977f9')}<b>{tr('inst.c38f75')}</b>{tr('inst.0a674b')}
              <div style={{ marginTop: 6, color: 'var(--fg-3)' }}>{tr('inst.f0ab8c')}</div>
            </div>
          ),
          confirmLabel: tr('inst.a79020'),
          onConfirm: async () => {
            await runMutation(() => svc.deleteRecord({ id: dbId }), tr('inst.17b860'), tr('inst.2f4aad'));
          },
        });
        return;
      default:
        shell.showToast(tr('inst.93dbe7').replace('{0}',actionId), { kind: 'warn' });
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 实例操作 · 表单弹窗(严格对齐原项目 oci_machine_list.ftl 里的 modal 结构)
// ═══════════════════════════════════════════════════════════════════════

// #1 修改备注 — machine.updateRemark / machine.content
function openUpdateRemarkModal(shell, inst) {
  const RemarkBody = () => {
    const [val, setVal] = React.useState(inst.remark || '');
    const [saving, setSaving] = React.useState(false);
    return (
      <div style={{ padding: 20 }}>
        <FormRow label={tr('inst.2f4c8b')}>
          <TextArea
            value={val}
            onChange={setVal}
            placeholder={tr('inst.b351a1')}
            rows={4}
          />
        </FormRow>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('inst.625fb2')}</Button>
          <Button variant="primary" size="md" icon="check" loading={saving} disabled={saving} onClick={async () => {
            if (saving) return;
            setSaving(true);
            shell.showToast(tr('inst.2f7a3c'), { kind: 'info' });
            try {
              const j = await window.ociServices.instance.updateRemark({ instanceId: String(inst.dbId ?? inst.id), remark: val });
              if (!j?.success) throw new Error(j?.message || tr('inst.e6da38'));
              shell.closeModal();
              shell.showToast(tr('inst.22077c').replace('{0}',inst.name), { kind: 'success' });
              window.dispatchEvent(new CustomEvent('oci:instances-changed'));
            } catch (e) {
              shell.showToast(tr('inst.b6dcea').replace('{0}',e.message || e), { kind: 'error' });
            } finally { setSaving(false); }
          }}>{tr('inst.e83a25')}</Button>
        </div>
      </div>
    );
  };
  shell.openModal({
    title: tr('inst.b1bfe2'),
    subtitle: <span className="mono">{inst.name}</span>,
    icon: 'edit-3', iconColor: 'var(--fg-1)',
    size: 'md',
    body: <RemarkBody />,
  });
}

// #2 编辑名称 — machine.updateName / machine.newName
function openUpdateNameModal(shell, inst) {
  const NameBody = () => {
    const [val, setVal] = React.useState(inst.name || '');
    const [saving, setSaving] = React.useState(false);
    return (
      <div style={{ padding: 20 }}>
        <FormRow label={tr('inst.352de2')} hint={tr('inst.0b7464')} required>
          <TextInput
            value={val}
            onChange={setVal}
            placeholder={tr('inst.adf94c')}
            mono
          />
        </FormRow>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('inst.625fb2')}</Button>
          <Button variant="primary" size="md" icon="check" loading={saving} disabled={saving} onClick={async () => {
            if (saving) return;
            if (!val.trim()) { shell.showToast(tr('inst.adf94c'), { kind: 'warn' }); return; }
            setSaving(true);
            shell.showToast(tr('inst.e90209'), { kind: 'info' });
            try {
              const j = await window.ociServices.instance.updateName({ instanceId: String(inst.dbId ?? inst.id), newName: val.trim() });
              if (!j?.success) throw new Error(j?.message || tr('inst.f75ada'));
              shell.closeModal();
              shell.showToast(tr('inst.1d4f65').replace('{0}',val.trim()), { kind: 'success' });
              window.dispatchEvent(new CustomEvent('oci:instances-changed'));
            } catch (e) {
              shell.showToast(tr('inst.8f816e').replace('{0}',e.message || e), { kind: 'error' });
            } finally { setSaving(false); }
          }}>{tr('inst.e83a25')}</Button>
        </div>
      </div>
    );
  };
  shell.openModal({
    title: tr('inst.797426'),
    subtitle: <span className="mono">{inst.name}</span>,
    icon: 'tag', iconColor: 'var(--fg-1)',
    size: 'md',
    body: <NameBody />,
  });
}

// #3 修改配置 — machine.update / cpuInput + memoryInput
function openUpdateConfigModal(shell, inst) {
  const ConfigBody = () => {
    const [cpu, setCpu] = React.useState(getInstanceCpu(inst) || 1);
    const [mem, setMem] = React.useState(getInstanceMem(inst) || 6);
    const [saving, setSaving] = React.useState(false);
    return (
      <div style={{ padding: 20 }}>
        <FormRow label="CPU (OCPU)" hint="1 - 24">
          <NumberInput value={cpu} onChange={setCpu} min={1} max={24} />
        </FormRow>
        <FormRow label={tr('inst.02d4e1')} hint="1 - 256">
          <NumberInput value={mem} onChange={setMem} min={1} max={256} />
        </FormRow>
        <div style={{
          padding: '10px 12px',
          background: 'var(--info-soft)',
          border: '1px solid var(--info)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 11.5, color: 'var(--info)',
          marginBottom: 12,
        }}>
          <Icon name="info" size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          {tr('inst.9a1bdc')}<b>{tr('inst.829778')}</b>{tr('inst.fbc14f')} <b>{getInstanceCpu(inst)}C / {getInstanceMem(inst)}G</b>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('inst.625fb2')}</Button>
          <Button variant="primary" size="md" icon="check" loading={saving} disabled={saving} onClick={async () => {
            if (saving) return;
            setSaving(true);
            shell.showToast(tr('inst.20053c'), { kind: 'info' });
            try {
              const j = await window.ociServices.instance.updateConfig({ instanceId: String(inst.dbId ?? inst.id), cpu: Number(cpu), memory: Number(mem) });
              if (!j?.success) throw new Error(j?.message || tr('inst.742625'));
              shell.closeModal();
              shell.showToast(tr('inst.9d7efc').replace('{0}',cpu).replace('{1}',mem), { kind: 'success' });
              window.dispatchEvent(new CustomEvent('oci:instances-changed'));
            } catch (e) {
              shell.showToast(tr('inst.c9b015').replace('{0}',e.message || e), { kind: 'error' });
            } finally { setSaving(false); }
          }}>{tr('inst.e83a25')}</Button>
        </div>
      </div>
    );
  };
  shell.openModal({
    title: tr('inst.f32fff'),
    subtitle: <span className="mono">{inst.name}</span>,
    icon: 'cpu', iconColor: 'var(--info)',
    size: 'md',
    body: <ConfigBody />,
  });
}

// #4 调整磁盘 — machine.updateDiskSize / machine.vsize / bootVolumeSizeInput (min 47)
function openUpdateBootVolumeModal(shell, inst) {
  const DiskBody = () => {
    const [size, setSize] = React.useState(inst.disk || 50);
    const [saving, setSaving] = React.useState(false);
    return (
      <div style={{ padding: 20 }}>
        <FormRow label={tr('inst.13c005')} hint={tr('inst.46b295').replace('{0}',inst.disk)} required>
          <NumberInput value={size} onChange={setSize} min={47} max={32768} />
        </FormRow>
        <div style={{
          padding: '10px 12px',
          background: 'var(--orange-soft)',
          border: '1px solid var(--orange)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 11.5, color: 'var(--orange)',
          marginBottom: 12,
        }}>
          <Icon name="alert-triangle" size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          <b>{tr('inst.9d636b')}</b>{tr('inst.094191')} <span className="mono">oci-growfs</span> {tr('inst.e8c265')}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('inst.625fb2')}</Button>
          <Button variant="primary" size="md" icon="check" loading={saving} disabled={saving || Number(size) === Number(inst.disk)} onClick={async () => {
            if (saving) return;
            if (size < 47) { shell.showToast(tr('inst.0a17cb'), { kind: 'warn' }); return; }
            setSaving(true);
            shell.showToast(tr('inst.0c6512'), { kind: 'info' });
            try {
              const j = await window.ociServices.instance.updateBootVolume({ instanceId: String(inst.dbId ?? inst.id), bootVolumeSize: Number(size), expand: Number(size) >= Number(inst.disk) });
              if (!j?.success) throw new Error(j?.message || tr('inst.90ef5d'));
              shell.closeModal();
              shell.showToast(tr('inst.fb52aa').replace('{0}',size), { kind: 'success' });
              window.dispatchEvent(new CustomEvent('oci:instances-changed'));
            } catch (e) {
              shell.showToast(tr('inst.7aa9cb').replace('{0}',e.message || e), { kind: 'error' });
            } finally { setSaving(false); }
          }}>{tr('inst.e83a25')}</Button>
        </div>
      </div>
    );
  };
  shell.openModal({
    title: tr('inst.64694d'),
    subtitle: <span className="mono">{inst.name}</span>,
    icon: 'hard-drive', iconColor: 'var(--info)',
    size: 'md',
    body: <DiskBody />,
  });
}

// #5 调整 VPU — PUT /tenants/update-volumes/{bootVolumeId}
function openUpdateVpuModal(shell, inst) {
  const VpuBody = () => {
    // 原项目 `${instance.vpusPerGB!0}` 缺失时显示 0，必须保留合法的 0 值。
    const [vpu, setVpu] = React.useState(inst.vpu == null || inst.vpu === '' ? 0 : Number(inst.vpu));
    const [saving, setSaving] = React.useState(false);
    return (
      <div style={{ padding: 20 }}>
        <FormRow label={tr('inst.a8b957').replace('{0}',vpu)} hint={tr('inst.d0eed1')}>
          <input
            type="range"
            min={0} max={120} step={10}
            value={vpu}
            onChange={e => setVpu(+e.target.value)}
            style={{ width: '100%', accentColor: 'var(--accent)' }}
          />
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 10, color: 'var(--fg-3)', marginTop: 4,
            fontFamily: 'var(--font-mono)',
          }}>
            {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120].map(n => <span key={n}>{n}</span>)}
          </div>
        </FormRow>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('inst.625fb2')}</Button>
          <Button variant="primary" size="md" icon="check" loading={saving} disabled={saving} onClick={async () => {
            if (saving) return;
            if (!inst.bootVolumeId) {
              shell.showToast(tr('inst.b76f89'), { kind: 'error' });
              return;
            }
            setSaving(true);
            shell.showToast(tr('inst.67c349'), { kind: 'info' });
            try {
              const j = await window.ociServices.instance.updateVpu({
                bootVolumeId: String(inst.bootVolumeId),
                tenantId: String(inst.tenantId ?? ''),
                vpusPerGB: vpu,
                instanceDetailId: inst.dbId ?? inst.id,
              });
              if (!j?.success) throw new Error(j?.message || tr('inst.6e2b5c'));
              shell.closeModal();
              shell.showToast(j.message || tr('inst.7f7560').replace('{0}',inst.name).replace('{1}',vpu), { kind: 'success' });
              window.dispatchEvent(new CustomEvent('oci:instances-changed'));
            } catch (e) {
              shell.showToast(tr('inst.d15cc5').replace('{0}',e.message || e), { kind: 'error' });
            } finally { setSaving(false); }
          }}>{tr('inst.e83a25')}</Button>
        </div>
      </div>
    );
  };
  shell.openModal({
    title: tr('inst.26685a'),
    subtitle: <span className="mono">{inst.name}</span>,
    icon: 'sliders', iconColor: 'var(--info)',
    size: 'md',
    body: <VpuBody />,
  });
}

// #6 切换 IPv4 — machine.changeIp / 支持多个 CIDR
function openChangeIpModal(shell, inst) {
  const IpBody = () => {
    const [cidrs, setCidrs] = React.useState(['']);
    const [saving, setSaving] = React.useState(false);
    const [result, setResult] = React.useState(null);
    const addCidr = () => setCidrs([...cidrs, '']);
    const removeCidr = (i) => setCidrs(cidrs.filter((_, idx) => idx !== i));
    const updateCidr = (i, v) => setCidrs(cidrs.map((c, idx) => idx === i ? v : c));
    return (
      <div style={{ padding: 20 }}>
        <div style={{
          padding: '10px 12px',
          background: 'var(--info-soft)',
          border: '1px solid var(--info)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 11.5, color: 'var(--info)',
          marginBottom: 14,
        }}>
          <Icon name="info" size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          {tr('inst.63db0e')} <b className="mono">{getInstanceIp(inst)}</b> {tr('inst.3ba030')}
        </div>
        <FormRow label={tr('inst.d01717')} hint={tr('inst.2bc74a')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {cidrs.map((cidr, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <TextInput
                  value={cidr}
                  onChange={v => updateCidr(i, v)}
                  placeholder={tr('inst.f67aed')}
                  mono
                />
                {cidrs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCidr(i)}
                    style={{
                      width: 28, height: 28, borderRadius: 4,
                      background: 'var(--danger-soft)', color: 'var(--danger)',
                      border: '1px solid var(--danger)',
                      cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    title={tr('inst.86048b')}
                  ><Icon name="x" size={12} /></button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addCidr}
              style={{
                alignSelf: 'flex-start',
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '5px 10px',
                background: 'var(--bg-2)', border: '1px dashed var(--border-strong)',
                borderRadius: 4, color: 'var(--fg-1)',
                fontFamily: 'inherit', fontSize: 11,
                cursor: 'pointer',
              }}
            ><Icon name="plus" size={11} />{tr('inst.695a05')}</button>
          </div>
        </FormRow>
        {result && (
          <div style={{
            padding: '10px 12px', marginTop: 12,
            background: 'var(--accent-soft)', border: '1px solid var(--accent)',
            borderRadius: 'var(--radius-sm)', fontSize: 11.5, color: 'var(--accent)',
          }}>
            <div style={{ fontWeight: 600 }}>{result.message || tr('inst.ea7ffb')}</div>
            {result.details && (
              <div style={{ marginTop: 6, color: 'var(--fg-1)' }}>
                <div>{tr('inst.b2dd27')}<span className="mono">{result.details.oldIp || '—'}</span></div>
                <div>{tr('inst.199fd3')}<span className="mono" style={{ color: 'var(--cyan)' }}>{result.details.newIp || '—'}</span></div>
              </div>
            )}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('inst.625fb2')}</Button>
          <Button variant="primary" size="md" icon="refresh-cw" loading={saving} disabled={saving || !!result} onClick={async () => {
            setSaving(true);
            shell.showToast(tr('inst.34cf86'), { kind: 'info' });
            try {
              const j = await window.ociServices.instance.changeSpecIp({
                tenantId: String(inst.dbId ?? inst.id ?? ''),
                cidrRanges: cidrs.filter(Boolean),
              });
              if (j?.status !== 'success' && j?.success !== true) throw new Error(j?.message || tr('inst.095ee8'));
              setResult({ message: j.message || tr('inst.ea7ffb'), details: j.details || null });
              shell.showToast(j.message || tr('inst.2b3db5'), { kind: 'success' });
              window.dispatchEvent(new CustomEvent('oci:instances-changed'));
            } catch (e) {
              shell.showToast(tr('inst.ca82c1').replace('{0}',e.message || e), { kind: 'error' });
            } finally { setSaving(false); }
          }}>{tr('inst.586cd8')}</Button>
        </div>
      </div>
    );
  };
  shell.openModal({
    title: tr('inst.33acbc'),
    subtitle: <span className="mono">{inst.name}</span>,
    icon: 'refresh-cw', iconColor: 'var(--info)',
    size: 'md',
    body: <IpBody />,
  });
}

// #7 管理 IPv6 / 启用 IPv6 — machine.mgIpv6 / machine.startIpv6
function openManageIpv6Modal(shell, inst, opts = {}) {
  const isEnable = opts.mode === 'enable' || inst.ipv6 !== 'enabled';
  const Ipv6Body = () => {
    const [saving, setSaving] = React.useState(false);
    const [resultAddress, setResultAddress] = React.useState('');
    return (
      <div style={{ padding: 20 }}>
        {isEnable ? (
          <>
            <div style={{
              padding: '10px 12px',
              background: 'var(--accent-soft)',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 11.5, color: 'var(--accent)',
              marginBottom: 14,
            }}>
              <Icon name="info" size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              {tr('inst.a4a0e7')} <b>/128</b> {tr('inst.0e67d2')}
              <div style={{ marginTop: 4, color: 'var(--fg-2)' }}>{tr('inst.97f674')}</div>
            </div>
            <FormRow label={tr('inst.55fc51')} hint={tr('inst.5512eb')}>
              <TextInput placeholder={tr('inst.ca96b2')} mono />
            </FormRow>
          </>
        ) : (
          <>
            <FormRow label={tr('inst.4ae89c')}>
              <div className="mono" style={{
                padding: '7px 10px',
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12, color: 'var(--fg-0)',
                userSelect: 'text',
              }}>{Array.isArray(inst.ipv6Addresses) ? inst.ipv6Addresses.join(', ') : (inst.ipv6Addresses || tr('inst.0e3de5'))}</div>
            </FormRow>
            <div style={{
              padding: '8px 10px', marginBottom: 12,
              background: 'var(--bg-2)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', fontSize: 11, color: 'var(--fg-3)',
            }}>
              {tr('inst.11cebd')}
            </div>
          </>
        )}
        {resultAddress && (
          <div style={{
            padding: '10px 12px', marginTop: 12,
            background: 'var(--accent-soft)', border: '1px solid var(--accent)',
            borderRadius: 'var(--radius-sm)', fontSize: 11.5, color: 'var(--accent)',
          }}>
            <div style={{ fontWeight: 600 }}>{tr('inst.5b882c')}</div>
            <div style={{ marginTop: 6, color: 'var(--fg-1)' }}>{tr('inst.9d30a4')}<span className="mono">{resultAddress}</span></div>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('inst.b15d91')}</Button>
          {isEnable && !resultAddress && (
            <Button variant="primary" size="md" icon="check" loading={saving} disabled={saving} onClick={async () => {
              setSaving(true);
              shell.showToast(tr('inst.d12d33'), { kind: 'info' });
              try {
                const j = await window.ociServices.instance.enableIpv6({ tenantId: String(inst.dbId ?? inst.id ?? '') });
                if (j?.status !== 'success' && j?.success !== true) throw new Error(j?.message || tr('inst.a23bcf'));
                const address = j && j.details ? j.details.ipv6Address || '' : '';
                setResultAddress(address || tr('inst.dd71a8'));
                shell.showToast(j.message || tr('inst.8a0c0b').replace('{0}',inst.name), { kind: 'success' });
                window.dispatchEvent(new CustomEvent('oci:instances-changed'));
              } catch (e) {
                shell.showToast(tr('inst.c14002').replace('{0}',e.message || e), { kind: 'error' });
              } finally { setSaving(false); }
            }}>{tr('inst.af776f')}</Button>
          )}
        </div>
      </div>
    );
  };
  shell.openModal({
    title: isEnable ? tr('inst.af776f') : tr('inst.d2309e'),
    subtitle: <span className="mono">{inst.name}</span>,
    icon: 'globe', iconColor: 'var(--cyan)',
    size: 'md',
    body: <Ipv6Body />,
  });
}

// #8 系统重置 / DD — machine.osReset / ddOsSelect + ddPassword + ddConfirm
// ═══════════════════════════════════════════════════════════════════════
// 网络管理 · 严格对齐原项目 doubleDimple/oci-start oci_network_manage.ftl
//   /oci/network?instanceId=xxx —— VNIC 管理页,在这里以 xl modal 呈现
// ═══════════════════════════════════════════════════════════════════════
//   核心:VNIC 列表(主 + 辅) · 8 列表格
//     · 名称 (含 VNIC OCID 副行)
//     · 类型 (主 / 辅)
//     · 状态 (Available / Provisioning / Terminating)
//     · 公网 IPv4 (含复制 + 更换 IP)
//     · 私网 IPv4
//     · 子网 ID (中间省略号)
//     · IPv6 数量
//     · 操作 (查看IPv6 / 添加IPv6 / 复制子网 / 复制VNIC ID / 删除)
//   顶部按钮:查询 / 创建VNIC / 启用负载均衡 / 还原网络 / 刷新
//   子 modal:创建VNIC · IPv6 列表 · 添加 IPv6 · 删除 VNIC · 更换 IP · 负载均衡进度
// ═══════════════════════════════════════════════════════════════════════
function openNetworkManageModal(shell, inst) {
  const vcnId = inst.vcnId || '';
  const subnetId = inst.subnetId || '';

  const state = {
    queried: false,
    loading: true,
    error: '',
    vnics: [],
    lbEnabled: false,                    // 负载均衡状态
    hoveredRowId: null,
    // 统一使用 <RowActionMenu>(MIGRATION.md §10.1)
    menuFor: null,                       // { vnic, anchorEl }
  };

  // ─── 工具函数 ──────────────────────────────────
  const ellipsisMiddle = (str, max) => {
    if (!str || str.length <= max) return str;
    const half = Math.floor((max - 3) / 2);
    return str.slice(0, half) + '...' + str.slice(-half);
  };
  const copyText = (text, label) => {
    if (!text) {
      shell.showToast(tr('inst.96beb7').replace('{0}',label || tr('inst.content')), { kind: 'warn', duration: 1800 });
      return Promise.resolve(false);
    }
    return navigator.clipboard.writeText(text)
      .then(() => {
        shell.showToast(tr('inst.513872').replace('{0}',label || ''), { kind: 'info', duration: 1500 });
        return true;
      })
      .catch(() => {
        shell.showToast(tr('inst.900931').replace('{0}',label || ''), { kind: 'warn', duration: 2200 });
        return false;
      });
  };

  const normalizeVnic = (v) => ({
    ...v,
    vnicId: v.vnicId || v.id || '',
    name: v.vnicDisplayName || v.name || v.instanceName || 'VNIC',
    isPrimary: Boolean(v.isPrimary),
    state: v.lifecycleState || v.state || 'UNKNOWN',
    publicIp: v.publicIp || '', privateIp: v.privateIp || '', subnetId: v.subnetId || '',
    ipv6Addresses: Array.isArray(v.ipv6Addresses) ? v.ipv6Addresses : [],
  });
  const loadVnics = async (refresh = false) => {
    state.loading = true; state.error = ''; render();
    try {
      const payload = refresh
        ? await window.ociServices.instance.vnicRefresh({ instanceId: String(inst.instanceId ?? '') })
        : await window.ociServices.instance.vnicLoadData({ instanceId: String(inst.instanceId ?? '') });
      if (!payload?.success) throw new Error(payload?.message || tr('inst.4e5cad'));
      const data = payload.data || {};
      state.vnics = (data.vnicList || []).map(normalizeVnic);
      state.queried = true;
    } catch (e) { state.error = e.message || String(e); state.vnics = []; }
    finally { state.loading = false; render(); }
  };

  // ─── 子 modal:创建 VNIC ──────────────────────────
  const openCreateVnicModal = () => {
    const s2 = { subnetId, count: 1 };
    const paint = () => shell.openModal({
      title: tr('inst.22d3e8'),
      subtitle: <span>{tr('inst.935e96')} <span className="mono">{inst.name}</span> {tr('inst.d9fa32')}</span>,
      icon: 'plus',
      iconColor: 'var(--accent)',
      size: 'md',
      body: (
        <div style={{ padding: 20 }}>
          <div style={{
            padding: '10px 12px', marginBottom: 14,
            background: 'var(--info-soft)', border: '1px solid var(--info)',
            borderRadius: 6, fontSize: 11.5, color: 'var(--fg-1)', lineHeight: 1.6,
          }}>
            <Icon name="info" size={11} style={{ verticalAlign: 'middle', marginRight: 5, color: 'var(--info)' }} />
            {tr('inst.0c5f29')}<b>{tr('inst.b8865d')}</b>{tr('inst.b3234f')} <b>32</b> {tr('inst.b38efb')}
          </div>

          <FormRow label={tr('inst.58b4f3')} required hint={tr('inst.45ab8e')}>
            <TextInput value={s2.subnetId} onChange={v => { s2.subnetId = v; paint(); }} mono placeholder="ocid1.subnet.oc1..." />
          </FormRow>

          <FormRow label={tr('inst.77143a')} required hint={tr('inst.f60bef')}>
            <NumberInput value={s2.count} onChange={v => { s2.count = Math.max(1, Math.min(31 - state.vnics.length + 1, v)); paint(); }}
              min={1} max={Math.max(1, 32 - state.vnics.length)} />
          </FormRow>
        </div>
      ),
      footer: (
        <>
          <Button variant="ghost" size="md" onClick={() => { shell.closeModal(); render(); }}>{tr('inst.625fb2')}</Button>
          <Button variant="primary" size="md" icon="check"
            onClick={() => {
              if (!s2.subnetId.trim()) { shell.showToast(tr('inst.c5e6bb'), { kind: 'warn' }); return; }
              window.ociServices.instance.vnicCreate({ instanceId: String(inst.instanceId ?? ''), subnetId: s2.subnetId.trim(), vnicCount: s2.count, ipv6CountPerVnic: 0 })
                .then(j => {
                  if (!j?.success) throw new Error(j?.message || tr('inst.fdd1a5'));
                  shell.closeModal(); shell.showToast(j.message || tr('inst.0363ad').replace('{0}',s2.count), { kind: 'success' });
                  loadVnics(true);
                })
                .catch(e => shell.showToast(tr('inst.18d423').replace('{0}',e.message || e), { kind: 'error' }));
            }}
          >{tr('inst.d9ac92')}</Button>
        </>
      ),
    });
    paint();
  };

  // ─── 子 modal:查看 IPv6 列表 ─────────────────────
  const openIpv6ListModal = (vnic) => {
    const paint = () => shell.openModal({
      title: tr('inst.b25c10'),
      subtitle: <span><span className="mono">{vnic.name}</span> {tr('inst.632605')} <b>{vnic.ipv6Addresses.length}</b> {tr('inst.8ab2ac')}</span>,
      icon: 'globe',
      iconColor: 'var(--cyan)',
      size: 'md',
      body: (
        <div style={{ padding: 20 }}>
          {vnic.ipv6Addresses.length === 0 ? (
            <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 12,
              background: 'var(--bg-2)', border: '1px dashed var(--border)', borderRadius: 6 }}>
              <Icon name="globe" size={26} style={{ opacity: 0.35, marginBottom: 8 }} />
              <div>{tr('inst.62b1c4')}</div>
              <div style={{ marginTop: 4, fontSize: 10.5, color: 'var(--fg-3)' }}>{tr('inst.78e646')}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {vnic.ipv6Addresses.map((ip, i) => (
                <div key={ip} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px',
                  background: 'var(--bg-1)', border: '1px solid var(--border)',
                  borderRadius: 6,
                }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: 'var(--cyan-soft)', color: 'var(--cyan)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700,
                  }} className="num">{i + 1}</span>
                  <span className="mono" style={{ flex: 1, fontSize: 11.5, color: 'var(--fg-0)' }}>{ip}</span>
                  <button onClick={() => copyText(ip, ' IPv6')}
                    style={{ padding: '3px 8px', background: 'var(--bg-2)', color: 'var(--fg-1)',
                      border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer',
                      fontSize: 10.5, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="copy" size={10} />{tr('inst.79d3ab')}
                  </button>
                  <button onClick={() => shell.openConfirm({
                    title: tr('inst.d5ff3b').replace('{0}',ellipsisMiddle(ip, 30)),
                    body: <div>{tr('inst.8e5329')}</div>,
                    danger: true, confirmLabel: tr('inst.2f4aad'),
                    onConfirm: async () => {
                      try {
                        const j = await window.ociServices.instance.vnicDeleteIpv6({ instanceId: String(inst.instanceId ?? ''), vnicId: vnic.vnicId, ipv6Address: ip });
                        if (!j?.success) throw new Error(j?.message || tr('inst.f98da4'));
                        vnic.ipv6Addresses = vnic.ipv6Addresses.filter(x => x !== ip);
                        shell.showToast(tr('inst.9a24b8'), { kind: 'warn' }); paint();
                      } catch (e) { shell.showToast(tr('inst.4d3447').replace('{0}',e.message || e), { kind: 'error' }); }
                    },
                  })}
                    style={{ padding: '3px 8px', background: 'var(--bg-2)', color: 'var(--danger)',
                      border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer',
                      fontSize: 10.5, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="trash-2" size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
      footer: (
        <>
          <Button variant="ghost" size="md" onClick={() => { shell.closeModal(); render(); }}>{tr('inst.b15d91')}</Button>
          <Button variant="primary" size="md" icon="plus"
            onClick={() => { shell.closeModal(); openAddIpv6Modal(vnic); }}
          >{tr('inst.852d00')}</Button>
        </>
      ),
    });
    paint();
  };

  // ─── 子 modal:添加 IPv6 ─────────────────────────
  const openAddIpv6Modal = (vnic) => {
    const s2 = { count: 1, mode: 'auto', manualIp: '' };
    const paint = () => shell.openModal({
      title: tr('inst.d00c2f'),
      subtitle: <span><span className="mono">{vnic.name}</span> {tr('inst.7e1961')} {vnic.ipv6Addresses.length} {tr('inst.03561f')}</span>,
      icon: 'plus',
      iconColor: 'var(--cyan)',
      size: 'md',
      body: (
        <div style={{ padding: 20 }}>
          <FormRow label="VNIC ID" hint={tr('inst.85541b')}>
            <div style={{
              padding: '6px 10px', background: 'var(--bg-2)',
              border: '1px solid var(--border)', borderRadius: 4,
              fontSize: 11, color: 'var(--fg-2)',
            }} className="mono">{vnic.vnicId}</div>
          </FormRow>

          <FormRow label={tr('inst.c10029')}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { id: 'auto',   label: tr('inst.4fb763'), desc: tr('inst.669867') },
                { id: 'manual', label: tr('inst.ab3b52'), desc: tr('inst.83267a') },
              ].map(m => (
                <label key={m.id} style={{
                  padding: '8px 10px', cursor: 'pointer',
                  background: s2.mode === m.id ? 'var(--cyan-soft)' : 'var(--bg-2)',
                  border: '1.5px solid ' + (s2.mode === m.id ? 'var(--cyan)' : 'var(--border)'),
                  borderRadius: 5,
                }}>
                  <input type="radio" checked={s2.mode === m.id}
                    onChange={() => { s2.mode = m.id; paint(); }}
                    style={{ display: 'none' }} />
                  <div style={{ fontSize: 12, fontWeight: 600, color: s2.mode === m.id ? 'var(--cyan)' : 'var(--fg-0)' }}>{m.label}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 2 }}>{m.desc}</div>
                </label>
              ))}
            </div>
          </FormRow>

          {s2.mode === 'auto' ? (
            <FormRow label={tr('inst.77143a')} hint={tr('inst.827e38')}>
              <NumberInput value={s2.count} onChange={v => { s2.count = Math.max(1, Math.min(32 - vnic.ipv6Addresses.length, v)); paint(); }}
                min={1} max={Math.max(1, 32 - vnic.ipv6Addresses.length)} />
            </FormRow>
          ) : (
            <FormRow label={tr('inst.2f9570')} required>
              <TextInput value={s2.manualIp} onChange={v => { s2.manualIp = v; paint(); }} mono
                placeholder="2603:c020:6:e400::1" />
            </FormRow>
          )}
        </div>
      ),
      footer: (
        <>
          <Button variant="ghost" size="md" onClick={() => { shell.closeModal(); render(); }}>{tr('inst.625fb2')}</Button>
          <Button variant="primary" size="md" icon="check"
            onClick={() => {
              if (s2.mode === 'manual') {
                if (!s2.manualIp.trim() || !/^[0-9a-f:]+$/i.test(s2.manualIp)) {
                  shell.showToast(tr('inst.ca37ed'), { kind: 'warn' }); return;
                }
                shell.showToast(tr('inst.bf49c8'), { kind: 'warn' });
                return;
              } else {
                window.ociServices.instance.vnicCreateIpv6({ instanceId: String(inst.instanceId ?? ''), vnicId: vnic.vnicId, ipv6Count: s2.count })
                  .then(j => { if (!j?.success) throw new Error(j?.message || tr('inst.9508c4')); shell.closeModal(); shell.showToast(j.message || tr('inst.6ed8f4'), { kind: 'success' }); loadVnics(true); })
                  .catch(e => shell.showToast(tr('inst.82ac65').replace('{0}',e.message || e), { kind: 'error' }));
                return;
              }
            }}
          >{tr('inst.e39de3')}</Button>
        </>
      ),
    });
    paint();
  };

  // ─── 子 modal:更换公网 IP ───────────────────────
  const openSwitchIpModal = (vnic) => {
    let running = false;
    let outcome = null;
    let cidrs = [''];
    const paint = () => shell.openModal({
      title: tr('inst.557852'),
      subtitle: <span>{tr('inst.935e96')} <span className="mono">{vnic.name}</span> {tr('inst.754539')}</span>,
      icon: 'refresh-cw',
      iconColor: 'var(--orange)',
      size: 'sm',
      dismissable: !running,
      body: (
        <div style={{ padding: 20 }}>
          <div style={{
            padding: '10px 12px', marginBottom: 14,
            background: 'var(--danger-soft)', border: '1px solid var(--danger)',
            borderRadius: 6, fontSize: 11.5, color: 'var(--fg-1)', lineHeight: 1.6,
          }}>
            <Icon name="alert-triangle" size={11} style={{ verticalAlign: 'middle', marginRight: 5, color: 'var(--danger)' }} />
            {tr('inst.2bda4c')} <span className="mono" style={{ color: 'var(--fg-0)', fontWeight: 500 }}>{vnic.publicIp}</span> {tr('inst.a2e5e4')}<b>{tr('inst.cbdcab')}</b>{tr('inst.d4af6c')}<b>{tr('inst.f6d148')}</b>{tr('inst.1f1481')}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 12,
            background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6 }}>
            <span className="mono" style={{ color: 'var(--fg-2)', fontSize: 12 }}>{vnic.publicIp}</span>
            <Icon name="arrow-right" size={13} style={{ color: 'var(--fg-3)' }} />
            <span className="mono" style={{ color: 'var(--orange)', fontSize: 12, fontWeight: 500 }}>{tr('inst.36bc63')}</span>
          </div>
          <FormRow label={tr('inst.50d4ae')} hint={tr('inst.2bc74a')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {cidrs.map((cidr, index) => (
                <div key={index} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <TextInput
                    value={cidr}
                    onChange={value => { cidrs[index] = value; paint(); }}
                    placeholder={tr('inst.5462e5')}
                    mono
                  />
                  {cidrs.length > 1 && (
                    <button type="button" onClick={() => { cidrs = cidrs.filter((_, i) => i !== index); paint(); }}
                      style={{ width: 28, height: 28, borderRadius: 4, background: 'var(--danger-soft)', color: 'var(--danger)', border: '1px solid var(--danger)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      title={tr('inst.86048b')}><Icon name="x" size={12} /></button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => { cidrs = [...cidrs, '']; paint(); }}
                style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: 'var(--bg-2)', border: '1px dashed var(--border-strong)', borderRadius: 4, color: 'var(--fg-1)', fontFamily: 'inherit', fontSize: 11, cursor: 'pointer' }}>
                <Icon name="plus" size={11} />{tr('inst.f0f9a9')}
              </button>
            </div>
          </FormRow>
          {outcome && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 6, fontSize: 11.5, color: 'var(--accent)' }}>
              <div style={{ fontWeight: 600 }}>{outcome.message || tr('inst.ea7ffb')}</div>
              {outcome.details && <div style={{ marginTop: 6, color: 'var(--fg-1)' }}>
                <div>{tr('inst.b2dd27')}<span className="mono">{outcome.details.oldIp || '—'}</span></div>
                <div>{tr('inst.199fd3')}<span className="mono" style={{ color: 'var(--cyan)' }}>{outcome.details.newIp || '—'}</span></div>
              </div>}
            </div>
          )}
        </div>
      ),
      footer: (
        <>
          <Button variant="ghost" size="md" onClick={() => { shell.closeModal(); render(); }}>{tr('inst.625fb2')}</Button>
          <Button variant="orange" size="md" icon="refresh-cw" loading={running} disabled={running || !!outcome}
            onClick={async () => {
              running = true; paint();
              try {
                const j = await window.ociServices.instance.vnicChangeSpecIp({
                  instanceId: String(inst.instanceId ?? ''),
                  vnicId: vnic.vnicId,
                  cidrRanges: cidrs.map(value => String(value || '').trim()).filter(Boolean),
                });
                if (j?.status !== 'success' && j?.success !== true) throw new Error(j?.message || tr('inst.095ee8'));
                outcome = { message: j.message || tr('inst.ea7ffb'), details: j.details || null };
                shell.showToast(outcome.message, { kind: 'success' });
                loadVnics(true);
              } catch (e) {
                shell.showToast(tr('inst.ca82c1').replace('{0}',e.message || e), { kind: 'error' });
              } finally { running = false; paint(); }
            }}
          >{tr('inst.a9a81b')}</Button>
        </>
      ),
    });
    paint();
  };

  // ─── 子 modal:删除 VNIC ─────────────────────────
  const openDeleteVnicModal = (vnic) => {
    shell.openConfirm({
      title: tr('inst.f86bf5').replace('{0}',vnic.name),
      body: (
        <div>
          {tr('inst.585470')}<b>{tr('inst.224555')}</b>。
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: 'var(--fg-2)', fontSize: 11.5 }}>
            <li>{tr('inst.253176')} <span className="mono">{vnic.publicIp}</span></li>
            <li>{tr('inst.715eee')} <span className="mono">{vnic.privateIp}</span></li>
            <li>{tr('inst.7383df')} <b>{vnic.ipv6Addresses.length}</b> {tr('inst.930882')}</li>
          </ul>
          <div style={{ marginTop: 8, color: 'var(--danger)' }}>{tr('inst.a2eaaa')}</div>
        </div>
      ),
      danger: true,
      confirmLabel: tr('inst.631cd2'),
      onConfirm: async () => {
        try {
          const j = await window.ociServices.instance.vnicDelete({ instanceId: String(inst.instanceId ?? ''), vnicId: vnic.vnicId });
          if (!j?.success) throw new Error(j?.message || tr('inst.b3ac98'));
          shell.showToast(tr('inst.1e5301').replace('{0}',vnic.name), { kind: 'warn' }); loadVnics(true);
        } catch (e) { shell.showToast(tr('inst.a8f72d').replace('{0}',e.message || e), { kind: 'error' }); }
      },
    });
  };

  // 后端仅返回最终结果；不再用定时器伪造进度或成功。
  const openLoadBalancerModal = (mode) => {
    const action = mode === 'enable'
      ? window.ociServices.instance.vnicConfigureLoadBalancer
      : window.ociServices.instance.vnicRestoreNetwork;
    shell.openConfirm({
      title: mode === 'enable' ? tr('inst.d57124') : tr('inst.3aa0a7'),
      body: <div>{tr('inst.0742e4')} <b className="mono">{inst.name}</b> {tr('inst.07b841')}</div>,
      danger: mode !== 'enable',
      confirmLabel: mode === 'enable' ? tr('inst.7854b5') : tr('inst.69de8d'),
      onConfirm: async () => {
        try {
          const j = await action({ instanceId: String(inst.instanceId ?? '') });
          if (!j?.success) throw new Error(j?.message || tr('inst.e276f8'));
          state.lbEnabled = mode === 'enable';
          shell.showToast(j.message || (mode === 'enable' ? tr('inst.c08348') : tr('inst.467949')), { kind: 'success' });
          render();
        } catch (e) { shell.showToast(tr('inst.522816').replace('{0}',e.message || e), { kind: 'error' }); }
      },
    });
  };

  // ─── 主 modal 渲染 ────────────────────────────────
  const stateBadge = (s) => {
    const cfg = {
      ATTACHED:      { color: 'var(--accent)',  bg: 'var(--accent-soft)',  icon: 'check-circle' },
      AVAILABLE:     { color: 'var(--accent)',  bg: 'var(--accent-soft)',  icon: 'check-circle' },
      ACTIVE:        { color: 'var(--accent)',  bg: 'var(--accent-soft)',  icon: 'check-circle' },
      ATTACHING:     { color: 'var(--orange)',  bg: 'var(--orange-soft)',  icon: 'loader' },
      PROVISIONING:  { color: 'var(--orange)',  bg: 'var(--orange-soft)',  icon: 'loader' },
      DETACHED:      { color: 'var(--danger)',  bg: 'var(--danger-soft)',  icon: 'x-circle' },
      DETACHING:     { color: 'var(--danger)',  bg: 'var(--danger-soft)',  icon: 'x-circle' },
      TERMINATING:   { color: 'var(--orange)',  bg: 'var(--orange-soft)',  icon: 'x-circle' },
      TERMINATED:    { color: 'var(--danger)',  bg: 'var(--danger-soft)',  icon: 'x-circle' },
    }[String(s || '').toUpperCase()] || { color: 'var(--fg-3)', bg: 'var(--bg-3)', icon: 'circle' };
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '1px 8px', borderRadius: 3,
        background: cfg.bg, color: cfg.color,
        fontSize: 10.5, fontWeight: 500,
      }}>
        <Icon name={cfg.icon} size={10} />{s || '—'}
      </span>
    );
  };

  const render = () => {
    const primaryCount = state.vnics.filter(v => v.isPrimary).length;
    const secondaryCount = state.vnics.length - primaryCount;
    const totalIpv6 = state.vnics.reduce((sum, v) => sum + v.ipv6Addresses.length, 0);

    shell.openModal({
      title: tr('inst.2f6dbb'),
      subtitle: (
        <span>
          <span className="mono">{inst.name}</span> · <span className="mono" style={{ color: 'var(--fg-3)' }}>{inst.region}</span> · VCN &amp; VNIC Management
        </span>
      ),
      icon: 'share-2',
      iconColor: 'var(--info)',
      size: 'xl',
      body: (
        <div style={{ padding: 16 }}>
          {/* 顶部信息 + 操作栏 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: 12, marginBottom: 12,
            background: 'var(--bg-2)', border: '1px solid var(--border)',
            borderRadius: 8, flexWrap: 'wrap',
          }}>
            <Icon name="share-2" size={14} style={{ color: 'var(--info)' }} />
            <span style={{ fontSize: 12, color: 'var(--fg-0)', fontWeight: 600 }}>{tr('inst.698d6d')}</span>
            <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>
              {tr('inst.c6a084')} <span className="num" style={{ color: 'var(--accent)', fontWeight: 600 }}>{primaryCount}</span>
              {tr('inst.5a16a3')} <span className="num" style={{ color: 'var(--info)', fontWeight: 600 }}>{secondaryCount}</span>
              · IPv6 <span className="num" style={{ color: 'var(--cyan)', fontWeight: 600 }}>{totalIpv6}</span>
            </span>
            {state.lbEnabled && (
              <span style={{
                padding: '2px 8px', background: 'var(--violet-soft)', color: 'var(--violet)',
                borderRadius: 3, fontSize: 10, fontWeight: 600,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <Icon name="zap" size={10} />{tr('inst.b5f579')}
              </span>
            )}
            <div style={{ flex: 1 }} />
            <Button size="sm" variant="cyan" icon="refresh-cw"
              onClick={() => loadVnics(true)}
            >{tr('inst.694fc5')}</Button>
            <Button size="sm" variant="primary" icon="plus"
              onClick={openCreateVnicModal}
              disabled={state.vnics.length >= 32}
            >{tr('inst.22d3e8')}</Button>
            {state.lbEnabled ? (
              <Button size="sm" variant="orange" icon="rotate-ccw"
                onClick={() => openLoadBalancerModal('restore')}
              >{tr('inst.554819')}</Button>
            ) : (
              <Button size="sm" variant="violet" icon="zap"
                onClick={() => openLoadBalancerModal('enable')}
              >{tr('inst.d57124')}</Button>
            )}
          </div>

          {/* VCN 概览卡 */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12,
          }}>
            <div style={{
              padding: 10, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 6,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <Icon name="cloud" size={14} style={{ color: 'var(--info)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10.5, color: 'var(--fg-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>VCN</div>
                <div className="mono" title={vcnId} style={{ fontSize: 11, color: 'var(--fg-0)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ellipsisMiddle(vcnId, 44)}
                </div>
              </div>
              {vcnId && <button onClick={() => copyText(vcnId, ' VCN ID')}
                style={{ padding: '3px 8px', background: 'var(--bg-2)', color: 'var(--fg-2)',
                  border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer',
                  fontSize: 10, fontFamily: 'inherit' }}>{tr('inst.79d3ab')}</button>}
            </div>
            <div style={{
              padding: 10, background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 6,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <Icon name="layers" size={14} style={{ color: 'var(--accent)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10.5, color: 'var(--fg-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>SUBNET</div>
                <div className="mono" title={subnetId} style={{ fontSize: 11, color: 'var(--fg-0)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ellipsisMiddle(subnetId, 44)}
                </div>
              </div>
              {subnetId && <button onClick={() => copyText(subnetId, ' Subnet ID')}
                style={{ padding: '3px 8px', background: 'var(--bg-2)', color: 'var(--fg-2)',
                  border: '1px solid var(--border)', borderRadius: 3, cursor: 'pointer',
                  fontSize: 10, fontFamily: 'inherit' }}>{tr('inst.79d3ab')}</button>}
            </div>
          </div>

          {/* VNIC 表格 */}
          <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{
              padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Icon name="list" size={13} style={{ color: 'var(--fg-2)' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-0)' }}>{tr('inst.4a5d7d')}</span>
              <span className="num" style={{ color: 'var(--fg-3)', fontSize: 11 }}>({state.vnics.length})</span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 980, borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
                <thead>
                  <tr>
                    {[
                      // 严格对齐原项目 oci_network_manage.ftl — 8 列
                      { h: tr('inst.d7ec2d') },
                      { h: tr('inst.226b09'),       w: 60,  align: 'center' },
                      { h: tr('inst.3fea7c'),       w: 110, align: 'center' },
                      { h: tr('inst.0a77f5'),  w: 200 },
                      { h: tr('inst.eec4ca'),  w: 130 },
                      { h: tr('inst.58b4f3'),    w: 180 },
                      { h: 'IPv6',       w: 70,  align: 'center' },
                      { h: tr('inst.2b6bc0'),       w: 60,  align: 'center' },
                    ].map((c, i) => (
                      <th key={i} style={{
                        textAlign: c.align || 'left', padding: '9px 12px', width: c.w,
                        background: 'var(--bg-2)', color: 'var(--fg-3)',
                        fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
                        borderBottom: '1px solid var(--border)',
                      }}>{c.h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {state.loading ? (
                    <tr><td colSpan={8} style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>{tr('inst.c36383')}</td></tr>
                  ) : state.error ? (
                    <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--danger)', fontSize: 12 }}><Icon name="alert-circle" size={20} /><div style={{ marginTop: 8 }}>{state.error}</div></td></tr>
                  ) : state.vnics.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>
                        <Icon name="share-2" size={28} style={{ opacity: 0.35, marginBottom: 8 }} />
                        <div>{tr('inst.88b2c7')}</div>
                      </td>
                    </tr>
                  ) : state.vnics.map((v, i) => (
                    <tr key={v.vnicId} style={{
                      background: i % 2 === 1 ? 'color-mix(in oklab, var(--bg-2) 30%, transparent)' : 'transparent',
                    }}>
                      {/* 名称 + VNIC ID 副行 —— 上下留白拉开层级 */}
                      <td style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{
                          fontSize: 13, color: 'var(--fg-0)', fontWeight: 500,
                          lineHeight: 1.35, marginBottom: 5,
                        }}>{ellipsisMiddle(v.name, 24)}</div>
                        <div className="mono" title={v.vnicId} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '1px 6px',
                          background: 'var(--bg-2)',
                          borderRadius: 3,
                          fontSize: 10, color: 'var(--fg-3)',
                          letterSpacing: 0.2,
                          maxWidth: '100%',
                        }}>
                          <Icon name="fingerprint" size={9} style={{ color: 'var(--fg-3)', flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ellipsisMiddle(v.vnicId, 24)}
                          </span>
                        </div>
                      </td>
                      {/* 类型 */}
                      <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <span style={{
                          padding: '1px 8px', borderRadius: 3, fontSize: 10, fontWeight: 700,
                          background: v.isPrimary ? 'var(--accent-soft)' : 'var(--info-soft)',
                          color: v.isPrimary ? 'var(--accent)' : 'var(--info)',
                        }}>{v.isPrimary ? tr('inst.7bbc73') : tr('inst.10153a')}</span>
                      </td>
                      {/* 状态 */}
                      <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        {stateBadge(v.state)}
                      </td>
                      {/* 公网 IPv4 + 操作图标 */}
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <span className="mono" style={{ fontSize: 11.5, color: 'var(--cyan)' }}>{v.publicIp}</span>
                          <button onClick={() => copyText(v.publicIp, tr('inst.ac168c'))} title={tr('inst.79d3ab')} disabled={!v.publicIp}
                            style={{ padding: 2, background: 'transparent', color: 'var(--fg-3)',
                              border: 'none', cursor: 'pointer', borderRadius: 2, display: 'inline-flex' }}
                            onMouseOver={e => e.currentTarget.style.color = 'var(--info)'}
                            onMouseOut={e => e.currentTarget.style.color = 'var(--fg-3)'}>
                            <Icon name="copy" size={11} />
                          </button>
                          <button onClick={() => openSwitchIpModal(v)} title={tr('inst.282cb4')}
                            style={{ padding: 2, background: 'transparent', color: 'var(--fg-3)',
                              border: 'none', cursor: 'pointer', borderRadius: 2, display: 'inline-flex' }}
                            onMouseOver={e => e.currentTarget.style.color = 'var(--orange)'}
                            onMouseOut={e => e.currentTarget.style.color = 'var(--fg-3)'}>
                            <Icon name="refresh-cw" size={11} />
                          </button>
                        </span>
                      </td>
                      {/* 私网 IPv4 */}
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                        <span className="mono" style={{ fontSize: 11.5, color: 'var(--fg-1)' }}>{v.privateIp}</span>
                      </td>
                      {/* 子网 ID */}
                      <td title={v.subnetId} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                        <span className="mono" style={{ fontSize: 10.5, color: 'var(--fg-2)' }}>{ellipsisMiddle(v.subnetId, 22)}</span>
                      </td>
                      {/* IPv6 数量 */}
                      <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <button onClick={() => openIpv6ListModal(v)}
                          style={{
                            padding: '2px 10px', background: v.ipv6Addresses.length > 0 ? 'var(--cyan-soft)' : 'var(--bg-3)',
                            color: v.ipv6Addresses.length > 0 ? 'var(--cyan)' : 'var(--fg-3)',
                            border: '1px solid ' + (v.ipv6Addresses.length > 0 ? 'var(--cyan)' : 'var(--border)'),
                            borderRadius: 3, cursor: 'pointer',
                            fontSize: 11, fontFamily: 'inherit', fontWeight: 600,
                          }}
                          className="num">{v.ipv6Addresses.length}</button>
                      </td>
                      {/* 操作 · 更多菜单 —— 使用统一的 <RowActionMenu>(MIGRATION.md §10.1) */}
                      <td style={{ padding: '9px 12px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        <button type="button"
                          onClick={e => {
                            e.stopPropagation();
                            if (state.menuFor?.vnic === v) { state.menuFor = null; render(); return; }
                            state.menuFor = { vnic: v, anchorEl: e.currentTarget };
                            render();
                          }}
                          style={{
                            width: 26, height: 26, borderRadius: 4,
                            background: state.menuFor?.vnic === v ? 'var(--accent)' : 'var(--bg-2)',
                            border: '1px solid ' + (state.menuFor?.vnic === v ? 'var(--accent)' : 'var(--border)'),
                            color: state.menuFor?.vnic === v ? 'var(--accent-fg)' : 'var(--fg-1)',
                            cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'background 100ms',
                          }}
                          title={tr('inst.2b6bc0')}>
                          <Icon name="more-horizontal" size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 统一的行操作菜单 · 见 MIGRATION.md §10.1 <RowActionMenu> */}
          {state.menuFor && (() => {
            const v = state.menuFor.vnic;
            const items = [
              { id: 'view-ipv6',   label: tr('inst.cc5a46').replace('{0}',v.ipv6Addresses.length), icon: 'eye',    color: 'var(--info)' },
              { id: 'add-ipv6',    label: tr('inst.852d00'),                              icon: 'plus',   color: 'var(--cyan)' },
            ];
            // 原项目仅在后端确实返回对应 ID 时显示复制入口。
            if (v.subnetId) items.push({ id: 'copy-subnet', label: tr('inst.fc90ee'), icon: 'copy' });
            if (v.vnicId) items.push({ id: 'copy-vnic', label: tr('inst.5e173a'), icon: 'copy' });
            if (!v.isPrimary) {
              items.push({ id: 'delete', label: tr('inst.4cfdd7'), icon: 'trash-2', color: 'var(--danger)' });
            }
            const header = (
              <>
                <span style={{
                  padding: '1px 6px', borderRadius: 3, fontSize: 9.5, fontWeight: 700,
                  background: v.isPrimary ? 'var(--accent-soft)' : 'var(--info-soft)',
                  color: v.isPrimary ? 'var(--accent)' : 'var(--info)',
                }}>{v.isPrimary ? tr('inst.7bbc73') : tr('inst.10153a')}</span>
                <span className="mono" style={{
                  color: 'var(--fg-0)', fontWeight: 500,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  flex: 1, minWidth: 0,
                }}>{v.name}</span>
                <span style={{ fontSize: 9.5, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {items.length} {tr('inst.29645b')}
                </span>
              </>
            );
            return (
              <RowActionMenu
                anchorEl={state.menuFor.anchorEl}
                header={header}
                items={items}
                columns={1}
                width={220}
                onClose={() => { state.menuFor = null; render(); }}
                onAction={(id) => {
                  state.menuFor = null;
                  render();
                  switch (id) {
                    case 'view-ipv6':   openIpv6ListModal(v); break;
                    case 'add-ipv6':    openAddIpv6Modal(v); break;
                    case 'copy-subnet': copyText(v.subnetId, ' Subnet ID'); break;
                    case 'copy-vnic':   copyText(v.vnicId, ' VNIC ID'); break;
                    case 'delete':      openDeleteVnicModal(v); break;
                  }
                }}
              />
            );
          })()}
        </div>
      ),
      footer: <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('inst.b15d91')}</Button>,
    });
  };
  render();
  loadVnics();
}

function openQuickDDModal(shell, inst) {
  const DD_OS_OPTIONS = [
    { group: 'Alpine', items: [
      { value: 'alpine|3.19', label: 'Alpine 3.19' },
      { value: 'alpine|3.20', label: 'Alpine 3.20' },
      { value: 'alpine|3.21', label: 'Alpine 3.21' },
      { value: 'alpine|3.22', label: 'Alpine 3.22' },
    ] },
    { group: 'Debian', items: [
      { value: 'debian|9', label: 'Debian 9' },
      { value: 'debian|10', label: 'Debian 10' },
      { value: 'debian|11', label: 'Debian 11' },
      { value: 'debian|12', label: 'Debian 12' },
      { value: 'debian|13', label: 'Debian 13' },
    ] },
    { group: 'Ubuntu', items: [
      { value: 'ubuntu|16.04', label: 'Ubuntu 16.04' },
      { value: 'ubuntu|18.04', label: 'Ubuntu 18.04' },
      { value: 'ubuntu|20.04', label: 'Ubuntu 20.04' },
      { value: 'ubuntu|22.04', label: 'Ubuntu 22.04' },
      { value: 'ubuntu|24.04', label: 'Ubuntu 24.04' },
      { value: 'ubuntu|25.10', label: 'Ubuntu 25.10' },
    ] },
    { group: 'RHEL', items: [
      { value: 'centos|9', label: 'CentOS 9' },
      { value: 'centos|10', label: 'CentOS 10' },
      { value: 'rocky|8', label: 'Rocky 8' },
      { value: 'rocky|9', label: 'Rocky 9' },
      { value: 'rocky|10', label: 'Rocky 10' },
      { value: 'almalinux|8', label: 'AlmaLinux 8' },
      { value: 'almalinux|9', label: 'AlmaLinux 9' },
      { value: 'almalinux|10', label: 'AlmaLinux 10' },
      { value: 'oracle|8', label: 'Oracle 8' },
      { value: 'oracle|9', label: 'Oracle 9' },
      { value: 'oracle|10', label: 'Oracle 10' },
      { value: 'fedora|41', label: 'Fedora 41' },
      { value: 'fedora|42', label: 'Fedora 42' },
    ] },
    { group: 'Other', items: [
      { value: 'anolis|7', label: 'Anolis 7' },
      { value: 'anolis|8', label: 'Anolis 8' },
      { value: 'anolis|23', label: 'Anolis 23' },
      { value: 'opencloudos|8', label: 'OpenCloudOS 8' },
      { value: 'opencloudos|9', label: 'OpenCloudOS 9' },
      { value: 'openeuler|20.03', label: 'OpenEuler 20.03' },
      { value: 'openeuler|22.03', label: 'OpenEuler 22.03' },
      { value: 'openeuler|24.03', label: 'OpenEuler 24.03' },
      { value: 'openeuler|25.09', label: 'OpenEuler 25.09' },
      { value: 'opensuse|15.6', label: 'OpenSUSE 15.6' },
      { value: 'opensuse|16.0', label: 'OpenSUSE 16.0' },
      { value: 'opensuse|tumbleweed', label: 'OpenSUSE Tumbleweed' },
      { value: 'nixos|25.05', label: 'NixOS 25.05' },
      { value: 'kali|', label: 'Kali Linux' },
      { value: 'arch|', label: 'Arch Linux' },
      { value: 'gentoo|', label: 'Gentoo' },
      { value: 'aosc|', label: 'AOSC' },
      { value: 'fnos|', label: 'FNOS' },
      { value: 'netboot.xyz|', label: 'Netboot.xyz' },
    ] },
  ];
  const DDBody = () => {
    const [os, setOs] = React.useState('ubuntu|22.04');
    const [pass, setPass] = React.useState('');
    const [showPass, setShowPass] = React.useState(false);
    const [strength, setStrength] = React.useState(0);
    const onPassChange = (v) => {
      setPass(v);
      let s = 0;
      if (v.length >= 8) s++;
      if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
      if (/[0-9]/.test(v)) s++;
      if (/[^A-Za-z0-9]/.test(v)) s++;
      setStrength(s);
    };
    return (
      <div style={{ padding: 20 }}>
        <div style={{
          padding: '10px 12px',
          background: 'var(--danger-soft)',
          border: '1px solid var(--danger)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 11.5, color: 'var(--danger)',
          marginBottom: 14,
        }}>
          <Icon name="alert-triangle" size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          <b>{tr('inst.4ad948')}</b>{tr('inst.d7d101')}
        </div>

        <FormRow label={tr('inst.39a2df')} required>
          <CustomDropdown
            value={os}
            onChange={setOs}
            groups={DD_OS_OPTIONS}
            width="100%"
            height={32}
          />
        </FormRow>

        <FormRow label={tr('inst.67c05e')} hint={tr('inst.d5afa6')} required>
          <div style={{ position: 'relative' }}>
            <input
              type={showPass ? 'text' : 'password'}
              value={pass}
              onChange={e => onPassChange(e.target.value)}
              placeholder={tr('inst.e39ffe')}
              style={{
                width: '100%', padding: '7px 32px 7px 10px',
                background: 'var(--bg-2)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--fg-0)',
                fontFamily: 'var(--font-mono)', fontSize: 12,
              }}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              style={{
                position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                width: 22, height: 22, borderRadius: 3,
                background: 'transparent', border: 'none',
                color: 'var(--fg-3)', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
              title={showPass ? tr('inst.dce537') : tr('inst.4d775d')}
            ><Icon name={showPass ? 'eye-off' : 'eye'} size={12} /></button>
          </div>
          {pass && (
            <div style={{ marginTop: 6, display: 'flex', gap: 4, alignItems: 'center' }}>
              {[1, 2, 3, 4].map(n => (
                <div key={n} style={{
                  flex: 1, height: 3, borderRadius: 2,
                  background: strength >= n
                    ? (strength <= 1 ? 'var(--danger)' : strength <= 2 ? 'var(--orange)' : strength <= 3 ? 'var(--info)' : 'var(--accent)')
                    : 'var(--bg-3)',
                }} />
              ))}
              <span style={{ fontSize: 10, color: 'var(--fg-3)', marginLeft: 4, minWidth: 30 }}>
                {[tr('inst.549077'), tr('inst.549077'), tr('inst.aed1df'), tr('inst.7d0096'), tr('inst.01f3c7')][strength]}
              </span>
            </div>
          )}
        </FormRow>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('inst.625fb2')}</Button>
          <Button variant="danger" size="md" icon="rotate-ccw" disabled={pass.length < 8} onClick={() => {
            shell.closeModal();
            shell.openConfirm({
              title: tr('inst.0430d7'),
              body: <div>{tr('inst.7e189d')} <b>{DD_OS_OPTIONS.flatMap(g => g.items).find(item => item.value === os)?.label || os}</b> {tr('inst.4554c1')} <b className="mono">{inst.name}</b>?<div style={{ marginTop: 6, color: 'var(--danger)' }}>{tr('inst.5e4fb7')} <b>{tr('inst.0957f1')}</b> {tr('inst.555d63')}</div></div>,
              danger: true,
              requireText: inst.name,
              confirmLabel: tr('inst.8ed858'),
              onConfirm: async () => {
                const [osType, osVersion] = String(os).split('|');
                try {
                  const j = await window.ociServices.instance.quickDD2({
                    instanceId: String(inst.dbId ?? inst.id),
                    osType,
                    osVersion,
                    ddPassword: pass,
                  });
                  if (!j?.success) throw new Error(j?.message || tr('inst.dee043'));
                  shell.showToast(tr('inst.447219').replace('{0}',os).replace('{1}',inst.name), { kind: 'warn' });
                  window.dispatchEvent(new CustomEvent('oci:instances-changed'));
                } catch (e) { shell.showToast(tr('inst.14b567').replace('{0}',e.message || e), { kind: 'error' }); }
              },
            });
          }}>{tr('inst.0430d7')}</Button>
        </div>
      </div>
    );
  };
  shell.openModal({
    title: tr('inst.d797c4'),
    subtitle: <span className="mono">{inst.name}</span>,
    icon: 'rotate-ccw', iconColor: 'var(--orange)',
    size: 'md',
    body: <DDBody />,
  });
}

// #9 终止实例 — machine.temIns / 二次确认+验证码
function openTerminateInstanceModal(shell, inst) {
  const TermBody = () => {
    const [step, setStep] = React.useState(1);
    const [code, setCode] = React.useState('');
    const [sending, setSending] = React.useState(false);
    const [terminating, setTerminating] = React.useState(false);
    const sendCode = async () => {
      setSending(true);
      try {
        const j = await window.ociServices.instance.sendVerificationCode({ instanceId: String(inst.dbId ?? inst.id) });
        if (!j?.success) throw new Error(j?.message || tr('inst.152bbc'));
        shell.showToast(j.message || tr('inst.4d7fb5'), { kind: 'info' });
        setStep(2);
      } catch (e) {
        shell.showToast(tr('inst.7493b7').replace('{0}',e.message || e), { kind: 'error' });
      } finally { setSending(false); }
    };
    const terminate = async () => {
      setTerminating(true);
      try {
        const j = await window.ociServices.instance.terminate({ instanceId: String(inst.dbId ?? inst.id), verificationCode: code });
        if (!j?.success) throw new Error(j?.message || tr('inst.3bfa70'));
        shell.closeModal();
        shell.showToast(j.message || tr('inst.b4d905').replace('{0}',inst.name), { kind: 'warn' });
        try { window.dispatchEvent(new CustomEvent('oci:instances-changed')); } catch {}
      } catch (e) {
        shell.showToast(tr('inst.2b2379').replace('{0}',e.message || e), { kind: 'error' });
      } finally { setTerminating(false); }
    };
    return (
      <div style={{ padding: 20 }}>
        <div style={{
          padding: '10px 12px',
          background: 'var(--danger-soft)',
          border: '1px solid var(--danger)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 12, color: 'var(--danger)',
          marginBottom: 14,
        }}>
          <Icon name="alert-triangle" size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          <b>{tr('inst.815040')}</b>{tr('inst.2ee93f')} <b className="mono">{inst.name}</b>{tr('inst.4419e7')} <b>{tr('inst.f6d148')}</b>。
        </div>
        {step === 1 ? (
          <div>
            <div style={{ color: 'var(--fg-2)', fontSize: 12, lineHeight: 1.7, marginBottom: 14 }}>
              {tr('inst.622df5')}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="ghost" size="md" onClick={shell.closeModal}>{tr('inst.625fb2')}</Button>
              <Button variant="danger" size="md" icon="send" loading={sending} onClick={sendCode}>{tr('inst.1f1858')}</Button>
            </div>
          </div>
        ) : (
          <div>
            <FormRow label={tr('inst.983f59')} hint={<span>{tr('inst.ea82cf')}</span>} required>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder={tr('inst.a87595')}
                style={{
                  width: '100%', padding: '9px 12px',
                  background: 'var(--bg-2)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--fg-0)',
                  fontFamily: 'var(--font-mono)', fontSize: 16, letterSpacing: 6, textAlign: 'center',
                }}
              />
            </FormRow>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <Button variant="ghost" size="md" onClick={() => setStep(1)}>{tr('inst.eeb690')}</Button>
              <Button variant="outline" size="md" loading={sending} onClick={sendCode}>{tr('inst.89b213')}</Button>
              <Button variant="danger" size="md" icon="x-square" loading={terminating} disabled={code.length !== 6} onClick={terminate}>{tr('inst.b6a048')}</Button>
            </div>
          </div>
        )}
      </div>
    );
  };
  shell.openModal({
    title: tr('inst.8d33c6'),
    subtitle: <span className="mono">{inst.name}</span>,
    icon: 'x-square', iconColor: 'var(--danger)',
    size: 'md',
    body: <TermBody />,
  });
}

Object.assign(window, {
  useInstanceDetailDrawer, useVncModal, openSshConfigModal, openSshTerminalModal, useReinstallModal, useSnapshotModal,
  InstanceRowActionMenu, makeInstanceActionRunner,
  // 供其它页面直接触发(如实例主列表页需要相同菜单)
  openUpdateRemarkModal, openUpdateNameModal, openUpdateConfigModal,
  openUpdateBootVolumeModal, openUpdateVpuModal,
  openChangeIpModal, openManageIpv6Modal, openQuickDDModal,
  openTerminateInstanceModal,
  openNetworkManageModal,
});
