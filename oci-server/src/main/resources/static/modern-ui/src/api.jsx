// Shared backend client for the Modern UI. This file intentionally contains no JSX
// so it can also be executed by the contract tests without a browser build step.
(function installOciApi(global) {
  class ApiError extends Error {
    constructor(message, details = {}) {
      super(message || (global.tr ? global.tr('api.requestFail').replace('{status}', String(details.status || 0)) : `请求失败 (${details.status || 0})`));
      this.name = 'ApiError';
      this.status = details.status || 0;
      this.code = details.code;
      this.payload = details.payload;
      this.path = details.path || '';
    }
  }

  async function decodeResponse(response, responseType) {
    if (responseType === 'raw') return response;
    if (responseType === 'blob') return response.blob();
    if (responseType === 'text') return response.text();

    const contentType = response.headers?.get?.('content-type') || '';
    const text = await response.text();
    if (!text) return null;
    // 后端部分错误接口返回纯文本(如注册已初始化时的 "System already initialized"),
    // 即使浏览器把 content-type 标为 application/json,不应当 JSON.parse 失败抛错,
    // 而是安全回退到原始文本。
    try { return JSON.parse(text); } catch { return text; }
  }

  async function request(path, options = {}) {
    const {
      responseType = 'auto',
      headers: callerHeaders = {},
      ...fetchOptions
    } = options;
    const headers = {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...callerHeaders,
    };
    const response = await global.fetch(path, {
      credentials: 'include',
      ...fetchOptions,
      headers,
    });
    const payload = await decodeResponse(response, responseType);

    if (!response.ok) {
      const error = new ApiError(
        (typeof payload === 'string' ? payload : (payload?.message || payload?.error))
          || response.statusText
          || (global.tr ? global.tr('api.requestFail').replace('{status}', String(response.status)) : `请求失败 (${response.status})`),
        {
          status: response.status,
          code: payload?.code,
          payload,
          path,
        },
      );
      if (response.status === 401 && typeof global.dispatchEvent === 'function') {
        global.dispatchEvent(new CustomEvent('ocip:unauthorized', { detail: error }));
      }
      throw error;
    }
    return payload;
  }

  async function getPage(path, query = {}, options = {}) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      }
    });
    const url = params.size ? `${path}?${params.toString()}` : path;
    const page = await request(url, options);
    if (!page || !Array.isArray(page.content)) {
      throw new ApiError(global.tr ? global.tr('api.pageNoContent') : '分页接口响应缺少 content 数组', { path, payload: page });
    }
    return page;
  }

  global.ociApi = Object.freeze({ ApiError, request, getPage });
})(window);
