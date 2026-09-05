import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));

async function loadText(path) {
  return readFile(resolve(root, path), 'utf8');
}

test('系统监控页提供稳定的响应式布局挂钩', async () => {
  const page = await loadText('oci-server/src/main/resources/static/modern-ui/src/page-monitor.jsx');
  const html = await loadText('oci-server/src/main/resources/static/modern-ui/index.html');

  for (const className of [
    'monitor-page',
    'monitor-header',
    'monitor-kpi-grid',
    'monitor-resource-grid',
    'monitor-resource-card',
    'monitor-bottom-grid',
    'monitor-gauge',
    'monitor-activity-row',
  ]) {
    assert.match(page, new RegExp(className), `缺少 ${className} 语义类名`);
  }

  assert.match(html, /@media\s*\(min-width:\s*768px\)\s*and\s*\(max-width:\s*1023px\)/);
  assert.match(html, /@media\s*\(min-width:\s*1024px\)\s*and\s*\(max-width:\s*1199px\)/);
  assert.match(html, /\.monitor-kpi-grid\s*\{[^}]*repeat\(5,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(html, /@media\s*\(min-width:\s*768px\)[\s\S]*?\.monitor-kpi-grid[^}]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(html, /@media\s*\(min-width:\s*1024px\)[\s\S]*?\.monitor-kpi-grid[^}]*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(html, /\.monitor-resource-grid\s*\{[^}]*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(html, /\.monitor-bottom-grid\s*\{[^}]*minmax\(0,\s*1\.6fr\)/s);
});

test('平板侧栏使用独立于桌面偏好的临时浮层状态', async () => {
  const app = await loadText('oci-server/src/main/resources/static/modern-ui/src/app.jsx');
  const layout = await loadText('oci-server/src/main/resources/static/modern-ui/src/layout.jsx');
  const html = await loadText('oci-server/src/main/resources/static/modern-ui/index.html');

  assert.match(app, /function\s+useTabletLayout\s*\(/);
  assert.match(app, /tabletSidebarOpen/);
  assert.match(app, /tablet-sidebar-backdrop/);
  assert.match(app, /event\.key\s*===\s*['"]Escape['"]/);
  assert.match(layout, /sidebar--tablet-overlay/);
  assert.match(layout, /onNavigateComplete/);
  assert.match(html, /\.tablet-sidebar-backdrop\s*\{/);
  assert.match(html, /\.sidebar--tablet-overlay\s*\{/);
});

test('响应式改动递增浏览器缓存版本', async () => {
  const html = await loadText('oci-server/src/main/resources/static/modern-ui/index.html');

  assert.match(html, /dist\/src\/charts\.js\?v=2/);
  assert.match(html, /dist\/src\/layout\.js\?v=19/);
  assert.match(html, /dist\/src\/page-monitor\.js\?v=9/);
  assert.match(html, /dist\/src\/app\.js\?v=13/);
});
