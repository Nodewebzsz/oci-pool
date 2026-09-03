import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const helperPath = path.join(root, 'oci-server/src/main/resources/static/modern-ui/src/auth-factor.js');
const pageAuthPath = path.join(root, 'oci-server/src/main/resources/static/modern-ui/src/page-auth.jsx');
const indexPath = path.join(root, 'oci-server/src/main/resources/static/modern-ui/index.html');

function loadFactorHelper() {
  if (!fs.existsSync(helperPath)) {
    assert.fail('缺少 auth-factor.js，登录验证方式无法独立测试');
  }
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(helperPath, 'utf8'), context, { filename: helperPath });
  return context.window.ociAuthFactor;
}

test('后端仅开启消息验证码时始终选择 message，而不是沿用旧 MFA 状态', () => {
  const factor = loadFactorHelper();
  assert.equal(
    factor.selectMethod({ messageEnabled: true, mfaEnabled: false }, 'mfa'),
    'message',
  );
});

test('后端仅开启 MFA 时选择 mfa；两种都开时默认优先消息验证码', () => {
  const factor = loadFactorHelper();
  assert.equal(factor.selectMethod({ messageEnabled: false, mfaEnabled: true }, 'message'), 'mfa');
  assert.equal(factor.selectMethod({ messageEnabled: true, mfaEnabled: true }, ''), 'message');
});

test('只有消息验证码时首次进入验证页自动发送一次', () => {
  const factor = loadFactorHelper();
  const messageOnly = { messageEnabled: true, mfaEnabled: false };

  assert.equal(factor.shouldAutoSendMessage(messageOnly, false, 'zszweb'), true);
  assert.equal(factor.shouldAutoSendMessage(messageOnly, true, 'zszweb'), false);
  assert.equal(factor.shouldAutoSendMessage(messageOnly, false, ''), false);
});

test('MFA 或消息加 MFA 模式不自动发送消息验证码', () => {
  const factor = loadFactorHelper();

  assert.equal(factor.shouldAutoSendMessage({ messageEnabled: false, mfaEnabled: true }, false, 'zszweb'), false);
  assert.equal(factor.shouldAutoSendMessage({ messageEnabled: true, mfaEnabled: true }, false, 'zszweb'), false);
  assert.equal(factor.shouldAutoSendMessage({ messageEnabled: false, mfaEnabled: false }, false, 'zszweb'), false);
});

test('验证页以一次性标记调用真实验证码发送服务', () => {
  const page = fs.readFileSync(pageAuthPath, 'utf8');

  assert.match(page, /const\s+autoSendRef\s*=\s*useRefAuth\(false\)/);
  assert.match(page, /shouldAutoSendMessage\([\s\S]*?autoSendRef\.current[\s\S]*?state\.username[\s\S]*?\)/);
  assert.match(page, /autoSendRef\.current\s*=\s*true;[\s\S]*?sendMessageCode\(\)/);
});

test('认证相关脚本使用版本参数，部署后不会继续命中旧缓存', () => {
  const html = fs.readFileSync(indexPath, 'utf8');
  assert.match(html, /src="\/modern-ui\/src\/auth-factor\.js\?v=\d+"/);
  assert.match(html, /src="\/modern-ui\/src\/services-auth\.js\?v=\d+"/);
  assert.match(html, /src="\/modern-ui\/src\/page-auth\.jsx\?v=\d+"/);
});
