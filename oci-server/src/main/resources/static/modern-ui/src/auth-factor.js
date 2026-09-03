// Pure authentication-factor selection logic shared by the login UI and tests.
(function installAuthFactor(global) {
  'use strict';

  function selectMethod(config, currentMethod) {
    const messageEnabled = !!config?.messageEnabled;
    const mfaEnabled = !!config?.mfaEnabled;

    // A single backend-enabled factor is authoritative and must override stale UI state.
    if (messageEnabled && !mfaEnabled) return 'message';
    if (mfaEnabled && !messageEnabled) return 'mfa';

    // When both are available, preserve an explicit user choice; otherwise prefer message.
    if (messageEnabled && mfaEnabled) {
      return currentMethod === 'mfa' || currentMethod === 'message' ? currentMethod : 'message';
    }

    // Config may still be loading. Default to message so the UI never falsely claims MFA.
    return currentMethod === 'mfa' || currentMethod === 'message' ? currentMethod : 'message';
  }

  function shouldAutoSendMessage(config, alreadySent, username) {
    return !!username
      && !!config?.messageEnabled
      && !config?.mfaEnabled
      && !alreadySent;
  }

  global.ociAuthFactor = Object.freeze({ selectMethod, shouldAutoSendMessage });
})(typeof window !== 'undefined' ? window : globalThis);
