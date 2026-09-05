# 系统监控页平板至 PC 自适应实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `768px` 至桌面宽度范围内，让系统监控页完整、清晰地响应式重排，并让平板侧栏以不挤压正文的浮层方式展开。

**Architecture:** 监控页 JSX 只负责添加稳定语义类名，所有断点和尺寸规则集中写入 Modern UI 全局 CSS；应用外壳新增由 `matchMedia('(min-width: 768px) and (max-width: 1199px)')` 驱动的平板临时侧栏状态，并与持久化的桌面折叠偏好隔离。现有接口、轮询、主题和页面路由保持不变。

**Tech Stack:** React 18 UMD、JSX、CSS Grid、CSS Media Queries、Node.js `node:test`、esbuild、Codex 内置 Chromium 浏览器。

## Global Constraints

- 仅优化系统监控页及其依赖的应用侧栏，不修改其他业务页面正文布局。
- 支持范围为 `768px` 至桌面宽度，不新增低于 `768px` 的手机布局。
- `768–1199px` 侧栏默认占 `60px`，完整展开时覆盖正文，并可通过遮罩、菜单选择或 `Escape` 收回。
- 平板浮层状态不得写入或覆盖桌面 `sidebarCollapsed` 偏好。
- `≥1200px` 保持桌面侧栏行为和原有视觉语言。
- 不减少指标，不改变接口、字段、10 秒轮询、主题颜色和信息密度功能。
- 页面不得产生文档级横向滚动。
- Git 提交信息使用中文，只做本地提交，不推送远端。

---

### Task 1: 建立响应式回归约束

**Files:**
- Create: `tools/modern-ui-responsive.test.mjs`

**Interfaces:**
- Consumes: `page-monitor.jsx`、`app.jsx`、`layout.jsx` 与 `index.html` 的源码文本。
- Produces: 可由 `node --test tools/modern-ui-responsive.test.mjs` 重复执行的结构和断点约束。

- [x] **Step 1: 写入监控页布局失败测试**

```js
test('monitor page exposes semantic responsive layout hooks', async () => {
  const page = await loadText('oci-server/src/main/resources/static/modern-ui/src/page-monitor.jsx');
  const html = await loadText('oci-server/src/main/resources/static/modern-ui/index.html');
  for (const className of ['monitor-page', 'monitor-header', 'monitor-kpi-grid', 'monitor-resource-grid', 'monitor-bottom-grid', 'monitor-gauge', 'monitor-activity-row']) {
    assert.match(page, new RegExp(className));
  }
  assert.match(html, /@media\s*\(min-width:\s*768px\)\s*and\s*\(max-width:\s*1023px\)/);
  assert.match(html, /@media\s*\(min-width:\s*1024px\)\s*and\s*\(max-width:\s*1199px\)/);
  assert.match(html, /monitor-kpi-grid[\s\S]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(html, /monitor-resource-grid[\s\S]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
}
```

- [x] **Step 2: 写入平板侧栏失败测试**

```js
test('tablet sidebar is temporary and independent from desktop preference', async () => {
  const app = await loadText('oci-server/src/main/resources/static/modern-ui/src/app.jsx');
  const layout = await loadText('oci-server/src/main/resources/static/modern-ui/src/layout.jsx');
  assert.match(app, /useTabletLayout/);
  assert.match(app, /tabletSidebarOpen/);
  assert.match(app, /tablet-sidebar-backdrop/);
  assert.match(app, /Escape/);
  assert.match(layout, /sidebar--tablet-overlay/);
  assert.match(layout, /onNavigateComplete/);
}
```

- [x] **Step 3: 运行测试并确认因功能尚不存在而失败**

Run: `node --test tools/modern-ui-responsive.test.mjs`

Expected: FAIL，首个失败信息指出 `page-monitor.jsx` 中缺少 `monitor-page`，而不是语法或路径错误。

### Task 2: 实现监控页响应式网格

**Files:**
- Modify: `oci-server/src/main/resources/static/modern-ui/src/page-monitor.jsx:72`
- Modify: `oci-server/src/main/resources/static/modern-ui/src/charts.jsx:5`
- Modify: `oci-server/src/main/resources/static/modern-ui/index.html:144`

**Interfaces:**
- Consumes: Task 1 定义的 `monitor-*` 语义类名。
- Produces: 监控页在桌面、平板横屏和平板竖屏的 CSS Grid 布局。

- [x] **Step 1: 为监控页结构添加语义类名**

```jsx
<div className="monitor-page">
  <div className="monitor-header"><PageHeader ... /></div>
  <div className="monitor-kpi-grid">...</div>
  <div className="monitor-resource-grid">...</div>
  <div className="monitor-bottom-grid">...</div>
</div>
```

仪表容器使用 `monitor-gauge`，资源卡使用 `monitor-resource-card`，实时活动行使用 `monitor-activity-row`，并移除这些网格上的固定内联 `gridTemplateColumns`。

- [x] **Step 2: 添加监控页基础和断点样式**

```css
.monitor-page { width: 100%; min-width: 0; }
.monitor-kpi-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); }
.monitor-resource-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
.monitor-bottom-grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr); }
.monitor-kpi-grid > *, .monitor-resource-grid > *, .monitor-bottom-grid > * { min-width: 0; }
.monitor-gauge > div { width: clamp(136px, 13vw, 180px) !important; height: clamp(136px, 13vw, 180px) !important; }
.monitor-gauge svg { width: 100%; height: 100%; }

@media (min-width: 1024px) and (max-width: 1199px) {
  .monitor-kpi-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .monitor-resource-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .monitor-bottom-grid { grid-template-columns: minmax(0, 1.45fr) minmax(260px, 1fr); }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .monitor-kpi-grid, .monitor-resource-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .monitor-bottom-grid { grid-template-columns: minmax(0, 1fr); }
  .monitor-header > div { align-items: flex-start; flex-wrap: wrap; }
}
```

- [x] **Step 3: 运行前端构建和测试**

Run: `npm --prefix oci-server/modern-ui-build run build`

Expected: PASS，并输出 `Done: ... .jsx files compiled`。

Run: `node --test tools/modern-ui-responsive.test.mjs`

Expected: 监控页断点测试 PASS；侧栏测试仍 FAIL。

### Task 3: 实现平板临时浮层侧栏

**Files:**
- Modify: `oci-server/src/main/resources/static/modern-ui/src/app.jsx:1`
- Modify: `oci-server/src/main/resources/static/modern-ui/src/layout.jsx:410`
- Modify: `oci-server/src/main/resources/static/modern-ui/index.html:144`

**Interfaces:**
- Consumes: `useTabletLayout()` 返回布尔值，`tabletSidebarOpen` 为临时状态。
- Produces: `Sidebar` 新增 `tabletOverlay` 与 `onNavigateComplete` 属性；平板遮罩类名为 `tablet-sidebar-backdrop`。

- [x] **Step 1: 在应用外壳中监听平板断点**

```jsx
function useTabletLayout() {
  const query = '(min-width: 768px) and (max-width: 1199px)';
  const [matches, setMatches] = useStateA(() => window.matchMedia(query).matches);
  useEffectA(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return matches;
}
```

- [x] **Step 2: 将平板侧栏状态与桌面偏好隔离**

```jsx
const isTabletLayout = useTabletLayout();
const [tabletSidebarOpen, setTabletSidebarOpen] = useStateA(false);
const sidebarCollapsed = isTabletLayout ? !tabletSidebarOpen : tweaks.sidebarCollapsed;
const toggleSidebar = () => {
  if (isTabletLayout) setTabletSidebarOpen((open) => !open);
  else setTweak('sidebarCollapsed', !tweaks.sidebarCollapsed);
};
```

监听 `Escape`、离开平板断点和路由变化时关闭临时侧栏；渲染遮罩；向 `Sidebar` 传入 `tabletOverlay` 和 `onNavigateComplete`。

- [x] **Step 3: 为侧栏添加浮层语义和关闭回调**

```jsx
function Sidebar({ activePage, onNavigate, collapsed = false, tabletOverlay = false, onNavigateComplete }) {
  const selectPage = (page) => {
    onNavigate(page);
    if (onNavigateComplete) onNavigateComplete();
  };
  return <aside className={tabletOverlay ? 'sidebar sidebar--tablet-overlay' : 'sidebar'}>...</aside>;
}
```

所有菜单导航改为调用 `selectPage`，确保选择后自动收回浮层。

- [x] **Step 4: 添加平板侧栏与遮罩样式**

```css
.sidebar { z-index: 30; }
.tablet-sidebar-backdrop { position: fixed; inset: 0; background: rgba(3, 10, 8, 0.52); backdrop-filter: blur(2px); z-index: 24; }
@media (min-width: 768px) and (max-width: 1199px) {
  .sidebar--tablet-overlay { position: fixed !important; left: 0; top: 0; box-shadow: var(--shadow-md); }
}
```

- [x] **Step 5: 构建并运行完整响应式测试**

Run: `npm --prefix oci-server/modern-ui-build run build`

Expected: PASS。

Run: `node --test tools/modern-ui-responsive.test.mjs`

Expected: 全部 PASS。

### Task 4: 浏览器验收与本地提交

**Files:**
- Modify: `docs/superpowers/plans/2026-09-05-monitor-responsive.md`

**Interfaces:**
- Consumes: 已运行在 `http://localhost:9857/#/monitor` 的本地服务。
- Produces: 六种尺寸、两种主题、侧栏交互和控制台检查的验收结果。

- [x] **Step 1: 检查六种视口**

使用内置浏览器依次设为 `768×1024`、`1024×768`、`1180×820`、`1366×768`、`1440×900`、`1920×1080`，每个尺寸执行：

```js
({
  viewport: [window.innerWidth, window.innerHeight],
  scrollWidth: document.documentElement.scrollWidth,
  overflow: document.documentElement.scrollWidth > window.innerWidth,
  kpiColumns: getComputedStyle(document.querySelector('.monitor-kpi-grid')).gridTemplateColumns,
  resourceColumns: getComputedStyle(document.querySelector('.monitor-resource-grid')).gridTemplateColumns,
  bottomColumns: getComputedStyle(document.querySelector('.monitor-bottom-grid')).gridTemplateColumns,
})
```

Expected: 所有尺寸 `overflow: false`；列数分别符合设计文档。

- [x] **Step 2: 检查平板侧栏交互**

在 `768×1024` 和 `1024×768` 验证初始侧栏宽 `60px`；点击顶部按钮后侧栏宽 `188px` 且正文宽度不变；点击遮罩、选择菜单和按 `Escape` 均能关闭。

- [x] **Step 3: 检查主题和控制台**

在一个平板尺寸和一个桌面尺寸分别切换浅色、深色主题，确认卡片、文字、遮罩和图表可读；确认浏览器控制台无新增错误和警告。

- [x] **Step 4: 运行最终验证**

Run: `npm --prefix oci-server/modern-ui-build run build && node --test tools/modern-ui-responsive.test.mjs`

Expected: 构建和测试全部 PASS。

- [x] **Step 5: 创建本地提交**

```bash
git add -f docs/superpowers/plans/2026-09-05-monitor-responsive.md
git add tools/modern-ui-responsive.test.mjs \
  oci-server/src/main/resources/static/modern-ui/src/page-monitor.jsx \
  oci-server/src/main/resources/static/modern-ui/src/charts.jsx \
  oci-server/src/main/resources/static/modern-ui/src/app.jsx \
  oci-server/src/main/resources/static/modern-ui/src/layout.jsx \
  oci-server/src/main/resources/static/modern-ui/index.html \
  oci-server/src/main/resources/static/modern-ui/dist
git commit -m "优化：完善系统监控页平板自适应布局"
```

Expected: 提交成功，`git status --short` 无未提交改动。
