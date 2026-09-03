// Contract validators for the Modern UI. No JSX, so it can be executed by the
// Node test runner as well as loaded in the browser before the service layer.
(function installOciContracts(global) {
  'use strict';

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  // Normalize a backend identifier to a string. Preserves the numeric 0.
  // Rejects undefined, null, empty string, and whitespace-only strings.
  function id(value, label) {
    label = label || 'id';
    if (value === undefined || value === null) throw new Error('缺少' + label);
    const str = String(value);
    if (str.trim() === '') throw new Error('缺少' + label);
    return str;
  }

  // Accept a plain object record; reject null/array/primitive.
  function record(value, label) {
    label = label || '记录';
    if (!isPlainObject(value)) throw new Error(label + ' 必须是对象');
    return value;
  }

  // Validate a Spring page envelope: it must carry a `content` array.
  function page(envelope, label) {
    label = label || '分页结果';
    if (!isPlainObject(envelope)) throw new Error(label + ' 必须是分页信封对象');
    if (!Array.isArray(envelope.content)) throw new Error(label + ' 缺少 content 数组');
    return envelope;
  }

  // Validate a backend ApiResponse-style object.
  function api(res, label) {
    label = label || '接口响应';
    if (!isPlainObject(res)) throw new Error(label + ' 必须是对象');
    return res;
  }

  global.ociContracts = Object.freeze({ id: id, record: record, page: page, api: api });
})(typeof window !== 'undefined' ? window : globalThis);
