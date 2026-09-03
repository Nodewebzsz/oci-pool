// Authentication request constructors. No JSX so it runs under the Node test
// runner and in the browser after api.jsx/contracts.js.
(function installOciAuthServices(global) {
  'use strict';
  const api = global.ociApi;
  const contracts = global.ociContracts;
  const S = {};

  function mark(fn, method, path, encoding) { fn.endpoint = { method: method, path: path, encoding: encoding }; return fn; }
  function formBody(params) {
    const usp = new URLSearchParams();
    for (const k in params || {}) {
      const v = params[k];
      if (v !== undefined && v !== null && v !== '') usp.set(k, String(v));
    }
    return usp;
  }

  S.login = mark(function login(input) {
    const o = input || {};
    const body = new URLSearchParams();
    body.set('username', contracts.id(o.username, 'username'));
    body.set('password', o.password != null ? String(o.password) : '');
    if (o.verificationCode != null && o.verificationCode !== '') body.set('verificationCode', String(o.verificationCode));
    if (o.mfaCode != null && o.mfaCode !== '') body.set('mfaCode', String(o.mfaCode));
    if (o.remember || o.rememberMe) body.set('remember-me', 'on');
    return api.request('/perform_login', { method: 'POST', body: body });
  }, 'POST', '/perform_login', 'query-string');

  S.logout = mark(function logout() {
    return api.request('/perform_logout', { method: 'POST', body: formBody({}) });
  }, 'POST', '/perform_logout', 'query-string');

  S.userInfo = mark(function userInfo() {
    return api.request('/api/userInfo');
  }, 'GET', '/api/userInfo', 'query-string');

  S.registerFirstUser = mark(function registerFirstUser(input) {
    const o = input || {};
    return api.request('/api/register-first-user', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: contracts.id(o.username, 'username'), password: o.password }),
    });
  }, 'POST', '/api/register-first-user', 'application/json');

  S.sendVerificationCode = mark(function sendVerificationCode(input) {
    const o = input || {};
    return api.request('/api/send-verification-code', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: contracts.id(o.username, 'username') }),
    });
  }, 'POST', '/api/send-verification-code', 'application/json');

  S.sendResetCode = mark(function sendResetCode(input) {
    const o = input || {};
    return api.request('/api/send-reset-code', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: contracts.id(o.username, 'username') }),
    });
  }, 'POST', '/api/send-reset-code', 'application/json');

  S.verifyResetCode = mark(function verifyResetCode(input) {
    const o = input || {};
    return api.request('/api/verify-reset-code', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: contracts.id(o.username, 'username'), verificationCode: contracts.id(o.verificationCode, 'verificationCode') }),
    });
  }, 'POST', '/api/verify-reset-code', 'application/json');

  S.resetPassword = mark(function resetPassword(input) {
    const o = input || {};
    const resetToken = contracts.id(o.resetToken, 'resetToken');
    return api.request('/api/reset-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Reset-Token': resetToken },
      body: JSON.stringify({ username: contracts.id(o.username, 'username'), resetToken: resetToken }),
    });
  }, 'POST', '/api/reset-password', 'application/json');

  S.messageEnabled = mark(function messageEnabled() {
    return api.request('/api/config/message-enabled');
  }, 'GET', '/api/config/message-enabled', 'query-string');

  S.mfaEnabled = mark(function mfaEnabled() {
    return api.request('/api/config/mfa-enabled');
  }, 'GET', '/api/config/mfa-enabled', 'query-string');

  global.ociServices = global.ociServices || {};
  global.ociServices.auth = Object.freeze(S);
})(typeof window !== 'undefined' ? window : globalThis);
