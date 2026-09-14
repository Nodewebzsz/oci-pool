// Auth pages — Login / Register / MFA / Forgot Password
//
// A single self-contained SPA overlay shown when the user is not authed.
// Field names + endpoint paths align with the original oci-start Freemarker
// login_user.ftl:
//   POST /perform_login     · {username, password, verificationCode?, mfaCode?, remember-me?}
//   POST /api/send-verification-code  · {username}   (消息验证码)
//   POST /api/register-first-user     · {username, password, confirmPassword}
//   POST /perform_logout
//
// 真实后端(对齐原项目 LoginController):
//   密码明文提交即可 —— RsaDecryptionFilter 在无 session 私钥时自动回退到明文校验。
//   Login 视图 submit → POST /perform_login: 成功直接登录; 服务端提示"需验证码"则进入 verify 视图。
//   Verify 视图 submit → POST /perform_login(带 verificationCode 或 mfaCode): 成功即登录。
//   登录因子开关来自 GET /api/config/{message,mfa}-enabled(匿名接口·已入 sa-token 白名单):
//     messageEnabled = telegram||dingtalk||bark · mfaEnabled = mfa.isEnabled()

const { useState: useStateAuth, useEffect: useEffectAuth, useRef: useRefAuth } = React;

// 服务端提示"需要验证码"→ 登录失败应进入统一验证视图收集验证码(而非就地报错)
function needsVerification(message) {
  return /验证码|mfa|MFA/i.test(message || '');
}

// ── Brand Logo: 内嵌高能电光云 (Cloud + Inset Lightning Core · 纯白居中) ─────────────
function BrandLogoRender({ size = 25, color = '#ffffff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      {/* 科技云朵外轮廓（纯白、上移2px光学居中） */}
      <path d="M7.5 23a4.8 4.8 0 0 1 2.2-8.5 7 7 0 0 1 13.8 1.5 4.8 4.8 0 0 1 3.5 9H7.5z"
            stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      {/* 居中高能折角闪电核（纯白） */}
      <polygon points="18.5,11.2 14.2,16.5 17.5,16.5 15.8,21.8 21.8,15.2 18.2,15.2"
               fill={color} stroke={color} strokeWidth="0.8" strokeLinejoin="round" />
    </svg>
  );
}

// ── Brand hero (SVG · left panel) ────────────────────────────────────────

// 全球算力互联拓扑 (Global Cloud Topology · 深度强化版)
function AuthHeroArt() {
  return (
    <svg viewBox="0 0 600 600" width="100%" height="100%" style={{ maxWidth: 550, maxHeight: 550 }}
         xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* 球体大气层晕光 */}
        <radialGradient id="topo-atmo" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="50%" stopColor="var(--cyan)" stopOpacity="0.10" />
          <stop offset="85%" stopColor="var(--cyan)" stopOpacity="0.02" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
        {/* 边缘高光轮廓渐变 */}
        <linearGradient id="topo-rim" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.8" />
          <stop offset="50%" stopColor="var(--cyan)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.1" />
        </linearGradient>
        {/* 核心反应堆渐变 */}
        <radialGradient id="topo-core-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
        {/* 光缆流光渐变 */}
        <linearGradient id="topo-beam-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--orange)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.2" />
        </linearGradient>
        <filter id="topo-blur-sm"><feGaussianBlur stdDeviation="3" /></filter>
        <filter id="topo-blur-lg"><feGaussianBlur stdDeviation="10" /></filter>
      </defs>

      {/* 背景 HUD 经纬标星与极简点阵 */}
      <g stroke="var(--fg-3)" strokeOpacity="0.25" strokeWidth="1">
        <path d="M 120 120 L 120 128 M 120 120 L 128 120" />
        <path d="M 480 120 L 480 128 M 480 120 L 472 120" />
        <path d="M 120 480 L 120 472 M 120 480 L 128 480" />
        <path d="M 480 480 L 480 472 M 480 480 L 472 480" />
      </g>
      <text x="300" y="86" textAnchor="middle" fill="var(--fg-3)" fontSize="10" fontWeight="600"
            fontFamily="var(--font-mono)" letterSpacing="2.5" opacity="0.6">
        OCI-POOL · 45 REGIONS GLOBAL TOPOLOGY
      </text>

      {/* 球体大气层底衬 */}
      <circle cx="300" cy="300" r="215" fill="url(#topo-atmo)" filter="url(#topo-blur-lg)" />
      <circle cx="300" cy="300" r="200" fill="var(--bg-1)" fillOpacity="0.3" stroke="url(#topo-rim)" strokeWidth="1.6" />

      {/* 23.5° 空间物理倾角：外层自转天体环 */}
      <g transform="rotate(-22 300 300)">
        <ellipse cx="300" cy="300" rx="236" ry="68" fill="none" stroke="var(--accent)" strokeWidth="1.2"
                 strokeOpacity="0.4" strokeDasharray="8 6">
          <animateTransform attributeName="transform" type="rotate" from="0 300 300" to="360 300 300" dur="30s" repeatCount="indefinite" />
        </ellipse>
        <ellipse cx="300" cy="300" rx="248" ry="72" fill="none" stroke="var(--cyan)" strokeWidth="0.8"
                 strokeOpacity="0.25" strokeDasharray="30 180 60 120">
          <animateTransform attributeName="transform" type="rotate" from="360 300 300" to="0 300 300" dur="24s" repeatCount="indefinite" />
        </ellipse>
      </g>

      {/* 3D 经纬球体骨架（增强厚度与景深） */}
      <g stroke="var(--cyan)" fill="none">
        {/* 纬线 */}
        <ellipse cx="300" cy="225" rx="165" ry="46" strokeWidth="0.9" strokeOpacity="0.2" strokeDasharray="3 3" />
        <ellipse cx="300" cy="300" rx="200" ry="58" strokeWidth="1.2" strokeOpacity="0.35" />
        <ellipse cx="300" cy="375" rx="165" ry="46" strokeWidth="0.9" strokeOpacity="0.2" strokeDasharray="3 3" />
        {/* 经线 */}
        <ellipse cx="300" cy="300" rx="65" ry="200" strokeWidth="1" strokeOpacity="0.3" />
        <ellipse cx="300" cy="300" rx="135" ry="200" strokeWidth="0.9" strokeOpacity="0.25" strokeDasharray="4 3" />
        {/* 地轴线 */}
        <line x1="300" y1="95" x2="300" y2="505" strokeWidth="0.8" strokeOpacity="0.2" strokeDasharray="4 4" />
      </g>

      {/* 中心发射的向外脉冲声呐波纹 (Sonar Heartbeat Waves) */}
      <circle cx="300" cy="300" r="50" fill="none" stroke="var(--accent)" strokeWidth="1.5" opacity="0.6">
        <animate attributeName="r" values="50;210" dur="3.6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.7;0" dur="3.6s" repeatCount="indefinite" />
        <animate attributeName="strokeWidth" values="1.8;0.4" dur="3.6s" repeatCount="indefinite" />
      </circle>
      <circle cx="300" cy="300" r="50" fill="none" stroke="var(--cyan)" strokeWidth="1.2" opacity="0.6">
        <animate attributeName="r" values="50;210" begin="1.8s" dur="3.6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.7;0" begin="1.8s" dur="3.6s" repeatCount="indefinite" />
        <animate attributeName="strokeWidth" values="1.6;0.4" begin="1.8s" dur="3.6s" repeatCount="indefinite" />
      </circle>

      {/* 动态弧线光缆 (Curved Data Beams) 汇聚到中心 */}
      <g stroke="var(--accent)" fill="none">
        {/* 美西 PHX 飞线 */}
        <path d="M 160 210 Q 210 280 260 290" strokeWidth="1.4" strokeOpacity="0.6" strokeDasharray="5 4">
          <animate attributeName="stroke-dashoffset" from="0" to="-28" dur="1.8s" repeatCount="indefinite" />
        </path>
        {/* 欧洲 FRA 飞线 */}
        <path d="M 330 155 Q 310 220 300 260" strokeWidth="1.4" strokeOpacity="0.6" strokeDasharray="6 4">
          <animate attributeName="stroke-dashoffset" from="0" to="-30" dur="2.2s" repeatCount="indefinite" />
        </path>
        {/* 亚太 NRT 飞线 */}
        <path d="M 425 210 Q 370 240 338 285" strokeWidth="1.5" strokeOpacity="0.7" strokeDasharray="5 3" stroke="var(--orange)">
          <animate attributeName="stroke-dashoffset" from="0" to="-24" dur="1.6s" repeatCount="indefinite" />
        </path>
        {/* 亚太 SIN 飞线 */}
        <path d="M 390 385 Q 350 330 325 330" strokeWidth="1.4" strokeOpacity="0.55" strokeDasharray="6 4">
          <animate attributeName="stroke-dashoffset" from="0" to="-30" dur="2s" repeatCount="indefinite" />
        </path>
        {/* 南美 GRU 飞线 */}
        <path d="M 180 375 Q 230 330 265 315" strokeWidth="1.3" strokeOpacity="0.45" strokeDasharray="5 5">
          <animate attributeName="stroke-dashoffset" from="0" to="-30" dur="2.5s" repeatCount="indefinite" />
        </path>
      </g>

      {/* 真实 OCI 区域节点与微型地标徽章 */}
      {[
        { x: 160, y: 210, code: 'US-PHX', name: '美西', hot: true, tagX: -54, tagY: -10 },
        { x: 220, y: 175, code: 'US-IAD', name: '美东', hot: false, tagX: -50, tagY: -12 },
        { x: 330, y: 155, code: 'EU-FRA', name: '法兰克福', hot: true, tagX: 10, tagY: -12 },
        { x: 425, y: 210, code: 'AP-NRT', name: '东京', hot: true, tagX: 12, tagY: -10 },
        { x: 440, y: 310, code: 'AP-ICN', name: '首尔', hot: false, tagX: 12, tagY: -2 },
        { x: 390, y: 385, code: 'AP-SIN', name: '新加坡', hot: true, tagX: 12, tagY: 6 },
        { x: 330, y: 415, code: 'AP-SYD', name: '悉尼', hot: false, tagX: 10, tagY: 10 },
        { x: 180, y: 375, code: 'SA-GRU', name: '圣保罗', hot: false, tagX: -52, tagY: 10 },
        { x: 130, y: 310, code: 'ME-DXB', name: '迪拜', hot: true, tagX: -50, tagY: 4 },
        { x: 250, y: 250, code: '', hot: false },
        { x: 360, y: 260, code: '', hot: false },
        { x: 275, y: 345, code: '', hot: false },
        { x: 430, y: 260, code: '', hot: false },
        { x: 170, y: 270, code: '', hot: false },
      ].map((pt, idx) => (
        <g key={idx}>
          {/* 热点多层波纹 */}
          {pt.hot && (
            <>
              <circle cx={pt.x} cy={pt.y} r="12" fill="none" stroke="var(--orange)" strokeWidth="1" opacity="0.6">
                <animate attributeName="r" values="5;15;5" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.8;0.1;0.8" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx={pt.x} cy={pt.y} r="6" fill="var(--orange)" fillOpacity="0.25" />
            </>
          )}

          {/* 节点实体圆点 */}
          <circle cx={pt.x} cy={pt.y} r={pt.hot ? 4.5 : 3}
                  fill={pt.hot ? 'var(--orange)' : 'var(--cyan)'}
                  stroke="var(--bg-0)" strokeWidth="1.5">
            {pt.hot && (
              <animate attributeName="r" values="4;5.5;4" dur="2s" repeatCount="indefinite" />
            )}
          </circle>

          {/* 核心地标文字微徽章 */}
          {pt.code && (
            <g transform={`translate(${pt.x + pt.tagX}, ${pt.y + pt.tagY})`}>
              <rect width="42" height="15" rx="3" fill="var(--bg-1)" fillOpacity="0.85"
                    stroke={pt.hot ? 'var(--orange)' : 'var(--cyan)'} strokeWidth="0.8" strokeOpacity="0.6" />
              <text x="21" y="11" textAnchor="middle"
                    fill={pt.hot ? 'var(--orange)' : 'var(--fg-1)'}
                    fontSize="8.5" fontWeight="700" fontFamily="var(--font-mono)">
                {pt.code}
              </text>
            </g>
          )}
        </g>
      ))}

      {/* 中心 OCI 算力中枢反应堆 (Luminous Compute Reactor) */}
      <g transform="translate(300,300)">
        {/* 核心外层氛围光晕 */}
        <circle r="65" fill="url(#topo-core-glow)" filter="url(#topo-blur-sm)" />

        {/* 外部精密 HUD 刻度齿轮环 */}
        <circle r="52" fill="none" stroke="var(--cyan)" strokeWidth="1" strokeDasharray="3 4" strokeOpacity="0.4">
          <animateTransform attributeName="transform" type="rotate" from="360" to="0" dur="20s" repeatCount="indefinite" />
        </circle>
        <circle r="46" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeDasharray="16 8 8 8" strokeOpacity="0.75">
          <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="14s" repeatCount="indefinite" />
        </circle>

        {/* 核心磨砂玻璃底盘 */}
        <circle r="38" fill="var(--bg-1)" stroke="var(--accent)" strokeWidth="1.8" />
        <circle r="32" fill="var(--bg-2)" fillOpacity="0.7" stroke="var(--border)" strokeWidth="1" />

        {/* 中心 OCI 云池芯片徽标（适当放大为 46px） */}
        <g transform="translate(-23,-23)">
          <BrandLogoRender size={46} color="var(--accent)" />
        </g>
      </g>
    </svg>
  );
}

// ── Password strength meter ──────────────────────────────────────────────
function passwordStrength(pw) {
  if (!pw) return { score: 0, label: '', color: 'var(--fg-3)' };
  let score = 0;
  if (pw.length >= 6)  score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw))   score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const table = [
    { label: '',       color: 'var(--fg-3)' },
    { label: tr('auth.pw.veryWeak'), color: 'var(--danger)' },
    { label: tr('auth.pw.weak'), color: 'var(--orange)' },
    { label: tr('auth.pw.medium'), color: 'var(--info)' },
    { label: tr('auth.pw.strong'), color: 'var(--accent)' },
    { label: tr('auth.pw.veryStrong'), color: 'var(--accent)' },
  ];
  return { score, ...table[score] };
}

// ── Small primitives (self-contained so this file doesn't couple to ui.jsx) ──
function AuthField({ label, error, children, hint }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <div style={{
        fontSize: 11, fontWeight: 500, color: 'var(--fg-2)',
        marginBottom: 6, display: 'flex', justifyContent: 'space-between',
      }}>
        <span>{label}</span>
        {hint && <span style={{ color: 'var(--fg-3)' }}>{hint}</span>}
      </div>
      {children}
      {error && (
        <div style={{
          fontSize: 10.5, color: 'var(--danger)', marginTop: 5,
          display: 'flex', alignItems: 'center', gap: 4,
          animation: 'auth-shake 350ms',
        }}>
          <Icon name="alert-circle" size={12} />
          {error}
        </div>
      )}
    </label>
  );
}

function AuthInput({ type = 'text', value, onChange, placeholder, autoFocus, autoComplete, onKeyDown, maxLength, mono }) {
  const [reveal, setReveal] = useStateAuth(false);
  const isPassword = type === 'password';
  const effType = isPassword && reveal ? 'text' : type;
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={effType}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        maxLength={maxLength}
        style={{
          width: '100%',
          padding: isPassword ? '10px 36px 10px 12px' : '10px 12px',
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          color: 'var(--fg-0)',
          fontFamily: mono ? 'var(--font-mono)' : 'inherit',
          fontSize: 13, outline: 'none',
          transition: 'border-color 100ms, background 100ms',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--bg-1)'; }}
        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-2)'; }}
      />
      {isPassword && (
        <button type="button" tabIndex={-1}
          onClick={() => setReveal(!reveal)}
          title={reveal ? tr('common.hide') : tr('common.show')}
          style={{
            position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
            width: 30, height: 30, padding: 0,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--fg-3)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name={reveal ? 'eye-off' : 'eye'} size={14} />
        </button>
      )}
    </div>
  );
}

function AuthButton({ children, variant = 'primary', loading, onClick, type = 'button', icon, disabled }) {
  const styles = {
    primary: {
      background: 'var(--accent)',
      color: 'var(--accent-fg)',
      border: '1px solid var(--accent)',
    },
    outline: {
      background: 'transparent',
      color: 'var(--fg-1)',
      border: '1px solid var(--border-strong)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--fg-2)',
      border: '1px solid transparent',
    },
  };
  const style = styles[variant] || styles.primary;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        ...style,
        width: '100%',
        height: 40,
        padding: '0 16px',
        borderRadius: 6,
        fontSize: 13, fontWeight: 600,
        cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
        opacity: (disabled || loading) ? 0.6 : 1,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: 8,
        fontFamily: 'inherit',
        transition: 'all 120ms',
      }}
    >
      {loading && (
        <span style={{
          width: 14, height: 14, borderRadius: '50%',
          border: '2px solid currentColor', borderTopColor: 'transparent',
          animation: 'auth-spin 700ms linear infinite',
        }} />
      )}
      {!loading && icon && <Icon name={icon} size={14} />}
      {children}
    </button>
  );
}

// ── Individual views ─────────────────────────────────────────────────────

function LoginView({ state, dispatch, tr, onLoginSuccess }) {
  const [loading, setLoading] = useStateAuth(false);
  const submit = async () => {
    if (!state.username || !state.password) {
      dispatch({ type: 'error', field: !state.username ? 'username' : 'password',
                 msg: tr('auth.err.required') });
      return;
    }
    setLoading(true);
    try {
      const json = await window.ociServices.auth.login({
        username: state.username, password: state.password, remember: state.remember,
      });
      if (json.success) {
        // 无因子场景直接登录成功(或服务端已判定无需再验证)
        onLoginSuccess && onLoginSuccess();
      } else {
        const msg = json.message || tr('auth.err.invalid');
        // 密码已通过,仅缺"验证码/MFA"→ 进入统一验证视图收集(所需因子由服务端决定)
        if (needsVerification(msg)) {
          dispatch({ type: 'goto', view: 'verify' });
        } else {
          dispatch({ type: 'error', field: 'password', msg });
        }
      }
    } catch (e) {
      const msg = (e && e.message) || tr('auth.err.network');
      // 后端登录失败(错误密码 / 需要验证码 / MFA)统一以 HTTP 401 返回,
      // api 层会把服务端 message 放进 ApiError.message,这里要读取它,否则会误显示"网络错误"
      if (needsVerification(msg)) {
        dispatch({ type: 'goto', view: 'verify' });
      } else {
        dispatch({ type: 'error', field: 'password', msg });
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <>
      <div style={{ marginBottom: 26 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg-0)', margin: 0, letterSpacing: -0.3 }}>
          {tr('auth.login.title')}
        </h1>
        <p style={{ fontSize: 12.5, color: 'var(--fg-2)', margin: '6px 0 0' }}>
          {tr('auth.login.subtitle')}
        </p>
      </div>

      <AuthField label={tr('auth.username')} error={state.errors.username}>
        <AuthInput
          value={state.username}
          onChange={v => dispatch({ type: 'set', field: 'username', value: v })}
          placeholder={tr('auth.username.placeholder')}
          autoFocus
          autoComplete="username"
          onKeyDown={e => e.key === 'Enter' && submit()}
        />
      </AuthField>

      <AuthField label={tr('auth.password')} error={state.errors.password}
                 hint={
                   <button type="button"
                     onClick={() => dispatch({ type: 'goto', view: 'forgot' })}
                     style={{ background: 'none', border: 'none', color: 'var(--info)',
                              cursor: 'pointer', fontSize: 11, padding: 0 }}>
                     {tr('auth.forgot')}
                   </button>
                 }>
        <AuthInput type="password"
          value={state.password}
          onChange={v => dispatch({ type: 'set', field: 'password', value: v })}
          placeholder={tr('auth.password.placeholder')}
          autoComplete="current-password"
          onKeyDown={e => e.key === 'Enter' && submit()}
        />
      </AuthField>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8,
                      fontSize: 12, color: 'var(--fg-2)', marginBottom: 20, cursor: 'pointer' }}>
        <input type="checkbox" checked={state.remember}
               onChange={e => dispatch({ type: 'set', field: 'remember', value: e.target.checked })}
               style={{ margin: 0, accentColor: 'var(--accent)' }} />
        {tr('auth.remember')}
      </label>

      <AuthButton onClick={submit} loading={loading} icon="log-in">
        {tr('auth.login.submit')}
      </AuthButton>

      {/* Initial admin notice */}
      <div style={{
        marginTop: 18, padding: '10px 12px',
        background: 'var(--info-soft)', border: '1px dashed var(--info)',
        borderRadius: 6, fontSize: 11, color: 'var(--fg-1)',
        display: 'flex', gap: 8, alignItems: 'center', lineHeight: 1.5,
      }}>
        <Icon name="info" size={13} style={{ color: 'var(--info)', flexShrink: 0 }} />
        <span>{tr('auth.login.notice')}</span>
      </div>
    </>
  );
}

function RegisterView({ state, dispatch, tr }) {
  const [loading, setLoading] = useStateAuth(false);
  const strength = passwordStrength(state.password);
  const mismatch = state.confirmPassword && state.password !== state.confirmPassword;
  const submit = async () => {
    if (!state.username) return dispatch({ type: 'error', field: 'username', msg: tr('auth.err.required') });
    if (!state.password) return dispatch({ type: 'error', field: 'password', msg: tr('auth.err.required') });
    if (state.password.length < 6) return dispatch({ type: 'error', field: 'password', msg: tr('auth.err.pw.short') });
    if (mismatch) return dispatch({ type: 'error', field: 'confirmPassword', msg: tr('auth.err.pw.mismatch') });
    setLoading(true);
    try {
      await window.ociServices.auth.registerFirstUser({ username: state.username, password: state.password });
      setLoading(false);
      dispatch({ type: 'goto', view: 'login', flash: tr('auth.registered.flash') });
    } catch (e) {
      setLoading(false);
      dispatch({ type: 'error', field: 'username', msg: (e && e.message) || tr('auth.err.invalid') });
    }
  };
  return (
    <>
      <div style={{ marginBottom: 26 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg-0)', margin: 0, letterSpacing: -0.3 }}>
          {tr('auth.register.title')}
        </h1>
        <p style={{ fontSize: 12.5, color: 'var(--fg-2)', margin: '6px 0 0' }}>
          {tr('auth.register.subtitle')}
        </p>
      </div>

      <AuthField label={tr('auth.username')} error={state.errors.username}>
        <AuthInput
          value={state.username}
          onChange={v => dispatch({ type: 'set', field: 'username', value: v })}
          placeholder={tr('auth.username.placeholder')}
          autoFocus
          autoComplete="username"
        />
      </AuthField>

      <AuthField label={tr('auth.password')} error={state.errors.password}
                 hint={strength.label && (
                   <span style={{ color: strength.color, fontWeight: 600 }}>{strength.label}</span>
                 )}>
        <AuthInput type="password"
          value={state.password}
          onChange={v => dispatch({ type: 'set', field: 'password', value: v })}
          placeholder={tr('auth.password.new.placeholder')}
          autoComplete="new-password"
        />
        {/* Strength bar */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 3, marginTop: 6,
        }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{
              height: 3, borderRadius: 2,
              background: i <= strength.score ? strength.color : 'var(--bg-3)',
              transition: 'background 120ms',
            }} />
          ))}
        </div>
      </AuthField>

      <AuthField label={tr('auth.confirmPassword')}
                 error={mismatch ? tr('auth.err.pw.mismatch') : state.errors.confirmPassword}>
        <AuthInput type="password"
          value={state.confirmPassword}
          onChange={v => dispatch({ type: 'set', field: 'confirmPassword', value: v })}
          placeholder={tr('auth.confirmPassword.placeholder')}
          autoComplete="new-password"
          onKeyDown={e => e.key === 'Enter' && submit()}
        />
      </AuthField>

      <AuthButton onClick={submit} loading={loading} icon="user-plus">
        {tr('auth.register.submit')}
      </AuthButton>

      <div style={{ marginTop: 14, textAlign: 'center', fontSize: 12, color: 'var(--fg-2)' }}>
        {tr('auth.have.account')}{' '}
        <button type="button"
          onClick={() => dispatch({ type: 'goto', view: 'login' })}
          style={{ background: 'none', border: 'none', color: 'var(--accent)',
                   cursor: 'pointer', fontWeight: 600, padding: 0, fontSize: 12 }}>
          {tr('auth.go.login')}
        </button>
      </div>
    </>
  );
}

// 统一验证视图 · 根据 auth config 决定表单形态:
//   messageEnabled  only  → 消息验证码(顶部无 tab)
//   mfaEnabled       only  → MFA(顶部无 tab · 与原 MfaView 视觉一致)
//   两者都开              → 顶部 tab 切换 · 严格对齐原项目 login_user.ftl 的 verificationChoice
function VerifyView({ state, dispatch, tr, onSuccess, authConfig }) {
  const { messageEnabled, mfaEnabled, channels } = authConfig;
  // 默认方法:两个都开时优先 message · 只开一个时锁死
  const initialMethod = window.ociAuthFactor.selectMethod(authConfig, '');
  const [method, setMethod] = useStateAuth(initialMethod);
  const [code, setCode] = useStateAuth(['', '', '', '', '', '']);
  const [loading, setLoading] = useStateAuth(false);
  const [error, setError] = useStateAuth('');
  const [countdown, setCountdown] = useStateAuth(0);   // 0 = 可发送 · 消息码专用
  const [sending, setSending] = useStateAuth(false);
  const [sentTo, setSentTo] = useStateAuth('');        // 显示"已发送到 xxx"
  const inputsRef = useRefAuth([]);
  const autoSendRef = useRefAuth(false);

  // 后端因子配置是异步加载的。配置到达或改变后必须覆盖过期的 UI method，
  // 例如 message=true / mfa=false 时绝不能继续显示旧的 MFA 页面。
  useEffectAuth(() => {
    const nextMethod = window.ociAuthFactor.selectMethod(
      { messageEnabled, mfaEnabled },
      method,
    );
    if (nextMethod !== method) setMethod(nextMethod);
  }, [messageEnabled, mfaEnabled]);

  // 切换 method 时清空输入
  useEffectAuth(() => {
    setCode(['', '', '', '', '', '']);
    setError('');
    inputsRef.current[0] && inputsRef.current[0].focus();
  }, [method]);

  useEffectAuth(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const activeChannelName = () => {
    // 挑第一个 enabled 的渠道作显示 (对齐原项目 Telegram 优先)
    if (channels.tg)   return 'Telegram';
    if (channels.dd)   return 'DingTalk';
    if (channels.bark) return 'Bark';
    return '';
  };

  const sendMessageCode = async () => {
    setSending(true);
    setError('');
    try {
      await window.ociServices.auth.sendVerificationCode({ username: state.username });
      setCountdown(60);
      setSentTo(activeChannelName() || tr('auth.verify.targetChannel'));
    } catch (e) {
      setError((e && e.message) || tr('auth.verify.err.send'));
    } finally {
      setSending(false);
    }
  };

  // 仅消息验证码模式下，进入验证页自动发送一次。ref 防止倒计时及状态更新重复触发；
  // 返回登录会卸载本视图，因此下一次新的登录流程仍可重新自动发送。
  useEffectAuth(() => {
    const shouldSend = window.ociAuthFactor.shouldAutoSendMessage(
      { messageEnabled, mfaEnabled },
      autoSendRef.current,
      state.username,
    );
    if (!shouldSend) return;
    autoSendRef.current = true;
    sendMessageCode();
  }, [messageEnabled, mfaEnabled, state.username]);

  const handleChange = (i, v) => {
    if (!/^\d?$/.test(v)) return;
    setError('');
    const next = [...code];
    next[i] = v;
    setCode(next);
    if (v && i < 5) inputsRef.current[i + 1] && inputsRef.current[i + 1].focus();
    if (next.every(x => x)) setTimeout(() => submit(next.join('')), 100);
  };
  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) inputsRef.current[i - 1] && inputsRef.current[i - 1].focus();
  };
  const handlePaste = (e) => {
    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      e.preventDefault();
      setCode(pasted.split(''));
      setTimeout(() => submit(pasted), 100);
    }
  };

  const submit = async (fullCode) => {
    const c = fullCode || code.join('');
    if (c.length !== 6) return setError(tr('auth.err.mfa.length'));
    // 消息码模式需要先"发送"
    if (method === 'message' && !sentTo && !fullCode) {
      return setError(tr('auth.verify.err.notSent'));
    }
    setLoading(true);
    try {
      const json = await window.ociServices.auth.login({
        username: state.username,
        password: state.password,
        remember: state.remember,
        ...(method === 'message' ? { verificationCode: c } : { mfaCode: c }),
      });
      if (json.success) { onSuccess && onSuccess(); }
      else setError(json.message || tr('auth.err.invalid'));
    } catch (e) {
      // 验证码错误 / MFA 错误同样由后端以 HTTP 401 返回,读取 e.message
      setError((e && e.message) || tr('auth.err.network'));
    } finally {
      setLoading(false);
    }
  };

  const iconName    = method === 'message' ? 'mail' : 'shield-check';
  const iconColor   = method === 'message' ? 'var(--info)'  : 'var(--accent)';
  const softColor   = method === 'message' ? 'var(--info-soft)' : 'var(--accent-soft)';
  const titleKey    = method === 'message' ? 'auth.verify.msg.title'   : 'auth.mfa.title';
  const subtitleKey = method === 'message' ? 'auth.verify.msg.subtitle': 'auth.mfa.subtitle';

  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: softColor, color: iconColor,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 12,
          transition: 'background 200ms, color 200ms',
        }}>
          <Icon name={iconName} size={22} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg-0)', margin: 0, letterSpacing: -0.3 }}>
          {tr(titleKey)}
        </h1>
        <p style={{ fontSize: 12.5, color: 'var(--fg-2)', margin: '6px 0 0', lineHeight: 1.6 }}>
          {tr(subtitleKey)}
        </p>
      </div>

      {/* 两者都开时 · 显示方式切换 tab (严格对齐原项目 verificationChoice) */}
      {messageEnabled && mfaEnabled && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 4, padding: 3,
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: 6, marginBottom: 18,
        }}>
          {[
            { id: 'message', label: tr('auth.verify.method.msg'), icon: 'mail' },
            { id: 'mfa',     label: tr('auth.verify.method.mfa'), icon: 'shield-check' },
          ].map(t => {
            const on = method === t.id;
            return (
              <button key={t.id} type="button"
                onClick={() => setMethod(t.id)}
                style={{
                  padding: '7px 10px', borderRadius: 4,
                  background: on ? 'var(--bg-1)' : 'transparent',
                  border: 'none',
                  color: on ? 'var(--fg-0)' : 'var(--fg-2)',
                  fontFamily: 'inherit', fontSize: 12, fontWeight: on ? 600 : 500,
                  cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  boxShadow: on ? '0 1px 2px rgba(0,0,0,0.15)' : 'none',
                  transition: 'all 120ms',
                }}>
                <Icon name={t.icon} size={13} />
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* 消息码模式:发送按钮 + 状态 */}
      {method === 'message' && (
        <div style={{ marginBottom: 14 }}>
          {sentTo ? (
            <div style={{
              padding: '8px 12px',
              background: 'var(--info-soft)', border: '1px solid var(--info)',
              borderRadius: 6, fontSize: 11.5, color: 'var(--info)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Icon name="check-circle-2" size={13} />
              {tr('auth.verify.msg.sentTo')} <b className="mono">{sentTo}</b>
              {countdown > 0 && <span style={{ marginLeft: 'auto', color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{countdown}s</span>}
            </div>
          ) : (
            <AuthButton variant="outline" icon="send"
              onClick={sendMessageCode} loading={sending}>
              {tr('auth.verify.msg.send')}{activeChannelName() ? ` · ${activeChannelName()}` : ''}
            </AuthButton>
          )}
        </div>
      )}

      {/* 6 格数字输入 */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginBottom: 16 }}>
        {code.map((v, i) => (
          <input key={i}
            ref={el => inputsRef.current[i] = el}
            type="text" inputMode="numeric" maxLength={1}
            value={v}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            onPaste={handlePaste}
            style={{
              width: 48, height: 56,
              background: v ? 'var(--bg-1)' : 'var(--bg-2)',
              border: '1px solid ' + (v ? iconColor : 'var(--border)'),
              borderRadius: 8,
              textAlign: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: 22, fontWeight: 600,
              color: 'var(--fg-0)',
              outline: 'none',
              transition: 'all 120ms',
            }}
          />
        ))}
      </div>

      {error && (
        <div style={{
          fontSize: 11, color: 'var(--danger)', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 4,
          animation: 'auth-shake 350ms',
        }}>
          <Icon name="alert-circle" size={12} />
          {error}
        </div>
      )}

      <AuthButton onClick={() => submit()} loading={loading} icon="check">
        {tr('auth.mfa.submit')}
      </AuthButton>

      {/* MFA 模式没有"重发"逻辑 · 只有消息模式才显示倒计时/重发 */}
      {method === 'message' && sentTo && (
        <div style={{ marginTop: 14, textAlign: 'center', fontSize: 12, color: 'var(--fg-2)' }}>
          {countdown > 0 ? (
            <span>{tr('auth.mfa.resendIn')} <b className="mono" style={{ color: 'var(--fg-1)' }}>{countdown}s</b></span>
          ) : (
            <button type="button"
              onClick={sendMessageCode}
              style={{ background: 'none', border: 'none', color: iconColor,
                       cursor: 'pointer', fontWeight: 600, padding: 0, fontSize: 12 }}>
              {tr('auth.mfa.resend')}
            </button>
          )}
        </div>
      )}

      <div style={{ marginTop: 10, textAlign: 'center' }}>
        <button type="button"
          onClick={() => dispatch({ type: 'goto', view: 'login' })}
          style={{ background: 'none', border: 'none', color: 'var(--fg-3)',
                   cursor: 'pointer', fontSize: 11.5, padding: 4,
                   display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon name="chevron-left" size={11} />
          {tr('auth.mfa.back')}
        </button>
      </div>
    </>
  );
}

function ForgotView({ state, dispatch, tr }) {
  const [step, setStep] = useStateAuth(1); // 1=input email, 2=verify code, 3=confirm reset
  const [loading, setLoading] = useStateAuth(false);
  const [error, setError] = useStateAuth('');
  const [resetToken, setResetToken] = useStateAuth('');
  // 新版忘记密码:后端会自行生成新密码并发送到通知终端,前端不再输入新密码。
  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      if (step === 1) {
        const j = await window.ociServices.auth.sendResetCode({ username: state.resetUsername });
        if (j && j.success === false) setError(j.message || tr('auth.err.network'));
        else setStep(2);
      } else if (step === 2) {
        const j = await window.ociServices.auth.verifyResetCode({ username: state.resetUsername, verificationCode: state.resetCode });
        if (j && j.success !== false && j.data && j.data.resetToken) {
          setResetToken(j.data.resetToken);
          setStep(3);
        } else setError((j && j.message) || tr('auth.forgot.verify.invalid'));
      } else {
        const j = await window.ociServices.auth.resetPassword({ username: state.resetUsername, resetToken });
        if (j && j.success === false) setError(j.message || tr('auth.err.network'));
        else dispatch({ type: 'goto', view: 'login', flash: tr('auth.forgot.done') });
      }
    } catch (e) {
      setError((e && e.message) || tr('auth.err.network'));
    } finally {
      setLoading(false);
    }
  };
  return (
    <>
      <div style={{ marginBottom: 26 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg-0)', margin: 0, letterSpacing: -0.3 }}>
          {tr('auth.forgot.title')}
        </h1>
        <p style={{ fontSize: 12.5, color: 'var(--fg-2)', margin: '6px 0 0' }}>
          {tr('auth.forgot.step')} {step} / 3
        </p>
      </div>

      {/* Step progress */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i <= step ? 'var(--accent)' : 'var(--bg-3)',
            transition: 'background 200ms',
          }} />
        ))}
      </div>

      {step === 1 && (
        <AuthField label={tr('auth.forgot.username')}>
          <AuthInput value={state.resetUsername}
            onChange={v => dispatch({ type: 'set', field: 'resetUsername', value: v })}
            placeholder={tr('auth.forgot.username.placeholder')}
            autoFocus autoComplete="username"
          />
        </AuthField>
      )}
      {step === 2 && (
        <AuthField label={tr('auth.forgot.code')}
                   hint={<span style={{ color: 'var(--fg-3)' }}>{tr('auth.forgot.code.sent')} {state.resetUsername}</span>}>
          <AuthInput mono value={state.resetCode}
            onChange={v => dispatch({ type: 'set', field: 'resetCode', value: v })}
            placeholder={tr('auth.code.placeholder')}
            maxLength={6} autoFocus
          />
        </AuthField>
      )}
      {step === 3 && (
        <div style={{
          padding: '12px 14px', borderRadius: 8,
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          fontSize: 12.5, color: 'var(--fg-1)', lineHeight: 1.6, marginBottom: 18,
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <Icon name="info" size={16} style={{ marginTop: 1, color: 'var(--info)' }} />
          <span>{tr('auth.forgot.reset.notice')}</span>
        </div>
      )}

      {error && (
        <div style={{
          padding: '10px 12px', marginBottom: 14,
          background: 'color-mix(in oklab, var(--red) 12%, transparent)',
          border: '1px solid var(--red)', borderRadius: 6,
          fontSize: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Icon name="alert-circle" size={14} />
          {error}
        </div>
      )}

      <AuthButton onClick={submit} loading={loading}
                  icon={step === 3 ? 'check' : 'arrow-right'}>
        {step === 3 ? tr('auth.forgot.submit') : tr('auth.forgot.next')}
      </AuthButton>

      <div style={{ marginTop: 14, textAlign: 'center' }}>
        <button type="button"
          onClick={() => dispatch({ type: 'goto', view: 'login' })}
          style={{ background: 'none', border: 'none', color: 'var(--fg-2)',
                   cursor: 'pointer', fontSize: 12, padding: 4,
                   display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon name="chevron-left" size={12} />
          {tr('auth.go.login')}
        </button>
      </div>
    </>
  );
}

// ── Main AuthPage container ──────────────────────────────────────────────
function AuthPage({ onLogin, authView, onAuthViewChange }) {
  const { t: tr, lang, setLang } = useT();
  // 登录视图由 hash 提供: /login | /register | /forgot-password
  const routeView = authView === 'register' ? 'register'
    : authView === 'forgot-password' ? 'forgot' : 'login';
  const initialState = {
    view: routeView,                 // login | register | verify | forgot
    username: '', password: '', confirmPassword: '',
    remember: false,
    resetUsername: '', resetCode: '',
    errors: {},
    flash: '',
  };
  const [state, setState] = useStateAuth(initialState);
  // 当 hash 在 login/register/forgot 之间切换时,同步本地视图
  useEffectAuth(() => {
    setState(s => ({ ...s, view: routeView }));
  }, [routeView]);
  const dispatch = (action) => {
    setState(s => {
      if (action.type === 'set')   return { ...s, [action.field]: action.value, errors: { ...s.errors, [action.field]: null } };
      if (action.type === 'error') return { ...s, errors: { ...s.errors, [action.field]: action.msg } };
      if (action.type === 'goto') {
        // login/register/forgot 会切换 hash;verify 保留在 login 视图内
        if (action.view === 'login' || action.view === 'register' || action.view === 'forgot') {
          const hashView = action.view === 'forgot' ? 'forgot-password' : action.view;
          onAuthViewChange && onAuthViewChange(hashView);
        }
        return { ...s, view: action.view, errors: {}, flash: action.flash || '' };
      }
      return s;
    });
  };
  // Auto-dismiss flash after 4s
  useEffectAuth(() => {
    if (!state.flash) return;
    const t = setTimeout(() => setState(s => ({ ...s, flash: '' })), 4000);
    return () => clearTimeout(t);
  }, [state.flash]);

  // 服务端实际启用的登录因子(真实来源)。GET /api/config/{message,mfa}-enabled(匿名接口)。
  const [serverAuth, setServerAuth] = useStateAuth(null);
  useEffectAuth(() => {
    let alive = true;
    Promise.all([
      window.ociServices.auth.messageEnabled().then(t => String(t) === 'true'),
      window.ociServices.auth.mfaEnabled().then(t => String(t) === 'true'),
    ]).then(([messageEnabled, mfaEnabled]) => { if (alive) setServerAuth({ messageEnabled, mfaEnabled }); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // 登录页底部显示后端真实运行版本(原先误写死为上游 v2.14.0)
  const [appVersion, setAppVersion] = useStateAuth('');
  useEffectAuth(() => {
    let alive = true;
    fetch('/api/version/check').then(r => r.json()).then(info => {
      if (alive && info && info.currentVersion) setAppVersion(info.currentVersion);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // 进入 verify view 时快照 auth config(服务端优先 · localStorage channels 仅作展示兜底)
  const verifyCfg = React.useMemo(() => {
    if (state.view === 'verify') {
      const local = (window.getAuthConfig && window.getAuthConfig()) || {};
      const base = serverAuth || { messageEnabled: false, mfaEnabled: false };
      return { messageEnabled: !!base.messageEnabled, mfaEnabled: !!base.mfaEnabled, channels: local.channels || {} };
    }
    return { messageEnabled: false, mfaEnabled: false, channels: {} };
  }, [state.view, serverAuth]);

  const renderView = () => {
    if (state.view === 'login')    return <LoginView state={state} dispatch={dispatch} tr={tr} onLoginSuccess={onLogin} />;
    if (state.view === 'register') return <RegisterView state={state} dispatch={dispatch} tr={tr} />;
    if (state.view === 'verify')   return <VerifyView key={`sv-${Number(verifyCfg.messageEnabled)}-${Number(verifyCfg.mfaEnabled)}`} state={state} dispatch={dispatch} tr={tr} onSuccess={onLogin} authConfig={verifyCfg} />;
    if (state.view === 'forgot')   return <ForgotView state={state} dispatch={dispatch} tr={tr} />;
  };

  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100vw',
      background: 'var(--bg-0)',
      overflow: 'hidden',
    }}>
      {/* Inject keyframes locally */}
      <style>{`
        @keyframes auth-spin { to { transform: rotate(360deg); } }
        @keyframes auth-shake {
          0%,100% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          75% { transform: translateX(3px); }
        }
        @keyframes auth-fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── LEFT: Brand hero ─────────────────────────────────────── */}
      <div style={{
        flex: '0 0 55%',
        background: 'linear-gradient(135deg, var(--bg-1) 0%, var(--bg-0) 100%)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        padding: '48px 56px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Subtle noise texture */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `radial-gradient(circle at 20% 30%, color-mix(in oklab, var(--accent) 8%, transparent), transparent 45%),
                            radial-gradient(circle at 80% 70%, color-mix(in oklab, var(--cyan)  8%, transparent), transparent 45%)`,
          pointerEvents: 'none',
        }} />

        {/* Top: mini logo bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 1 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: 'linear-gradient(135deg, var(--accent), var(--cyan))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px color-mix(in oklab, var(--accent) 30%, transparent)',
          }}>
            <BrandLogoRender size={25} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-0)', letterSpacing: -0.2 }}>{tr('brand.name')}</div>
            <div style={{ fontSize: 10, color: 'var(--fg-3)', letterSpacing: 0.4 }}>{tr('brand.tagline')}</div>
          </div>
        </div>

        {/* Middle: hero SVG (centered) */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', zIndex: 1,
        }}>
          <AuthHeroArt />
        </div>

        {/* Bottom: brand tagline + stats */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{
            fontSize: 30, fontWeight: 800, color: 'var(--fg-0)', margin: 0,
            letterSpacing: -0.8, lineHeight: 1.15,
          }}>
            {tr('auth.hero.title')}
          </h2>
          <p style={{
            fontSize: 13.5, color: 'var(--fg-2)', margin: '10px 0 22px', maxWidth: 460,
            lineHeight: 1.6,
          }}>
            {tr('auth.hero.subtitle')}
          </p>
          <div style={{ display: 'flex', gap: 32 }}>
            {[
              { num: '14+',  label: tr('auth.hero.stat.tenants') },
              { num: '45',   label: tr('auth.hero.stat.regions') },
              { num: '24/7', label: tr('auth.hero.stat.uptime')  },
            ].map((s, i) => (
              <div key={i}>
                <div className="num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>{s.num}</div>
                <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4, letterSpacing: 0.3 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT: Form panel ─────────────────────────────────────── */}
      <div style={{
        flex: '0 0 45%',
        display: 'flex', flexDirection: 'column',
        padding: '32px 56px',
        overflow: 'auto',
      }}>
        {/* Top-right controls */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 40 }}>
          <button type="button"
            onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            title={lang === 'zh' ? tr('top.switchToEn') : tr('top.switchToZh')}
            style={{
              height: 30, padding: '0 10px',
              background: 'var(--bg-2)', border: '1px solid var(--border)',
              borderRadius: 6, color: 'var(--fg-1)',
              fontFamily: 'inherit', fontSize: 11.5, fontWeight: 500, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
            <Icon name="languages" size={13} />
            <span className="mono">{lang === 'zh' ? tr('top.lang.zh') : tr('top.lang.en')}</span>
          </button>
        </div>

        {/* Form card */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div key={state.view} style={{
            width: '100%', maxWidth: 380,
            animation: 'auth-fade-up 260ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}>
            {/* Flash notice */}
            {state.flash && (
              <div style={{
                padding: '10px 12px', marginBottom: 20,
                background: 'var(--accent-soft)', border: '1px solid var(--accent)',
                borderRadius: 6, fontSize: 12, color: 'var(--accent)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Icon name="check-circle-2" size={14} />
                {state.flash}
              </div>
            )}

            {renderView()}

            {/* Social login (login / register only) */}
            {(state.view === 'login' || state.view === 'register') && (
              <>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  margin: '24px 0 16px', color: 'var(--fg-3)', fontSize: 11,
                }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span>{tr('auth.or.continue')}</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <AuthButton variant="outline" icon="github"
                    onClick={() => window.__ocipShell && window.__ocipShell.showToast(tr('auth.oauth.github'), { kind: 'info' })}>
                    GitHub
                  </AuthButton>
                  <AuthButton variant="outline" icon="chrome"
                    onClick={() => window.__ocipShell && window.__ocipShell.showToast(tr('auth.oauth.google'), { kind: 'info' })}>
                    Google
                  </AuthButton>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center', fontSize: 10.5, color: 'var(--fg-3)',
          marginTop: 24,
          fontFamily: 'var(--font-mono)',
        }}>
          {appVersion ? `v${appVersion.replace(/^[vV]-?/, '')} · ` : ''}MIT · <a href="https://github.com/Nodewebzsz/oci-pool" target="_blank" rel="noopener"
                              style={{ color: 'var(--fg-3)', textDecoration: 'none' }}>Nodewebzsz/oci-pool</a>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AuthPage });
