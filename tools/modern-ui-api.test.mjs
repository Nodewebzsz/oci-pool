import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const apiSource = await readFile(
  new URL('../oci-server/src/main/resources/static/modern-ui/src/api.jsx', import.meta.url),
  'utf8',
);

function loadApi(fetchImpl) {
  const window = { fetch: fetchImpl };
  vm.runInNewContext(apiSource, {
    window,
    URLSearchParams,
    CustomEvent: class CustomEvent {
      constructor(type, init) { this.type = type; this.detail = init?.detail; }
    },
  });
  return window.ociApi;
}

test('request adds Ajax headers and credentials without dropping caller headers', async () => {
  let captured;
  const api = loadApi(async (path, options) => {
    captured = { path, options };
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  await api.request('/example', { headers: { 'X-Test': 'yes' } });

  assert.equal(captured.path, '/example');
  assert.equal(captured.options.credentials, 'include');
  assert.equal(captured.options.headers.Accept, 'application/json');
  assert.equal(captured.options.headers['X-Requested-With'], 'XMLHttpRequest');
  assert.equal(captured.options.headers['X-Test'], 'yes');
});

test('request throws a structured error for non-2xx JSON responses', async () => {
  const api = loadApi(async () => new Response(
    JSON.stringify({ code: 422, message: '字段错误' }),
    { status: 422, headers: { 'Content-Type': 'application/json' } },
  ));

  await assert.rejects(
    api.request('/bad'),
    error => error.name === 'ApiError'
      && error.status === 422
      && error.code === 422
      && error.message === '字段错误',
  );
});

test('request surfaces a plain-text error body as the ApiError message', async () => {
  const api = loadApi(async () => new Response(
    'System already initialized',
    { status: 400, headers: { 'Content-Type': 'text/plain;charset=UTF-8' } },
  ));

  await assert.rejects(
    api.request('/api/register-first-user'),
    error => error.name === 'ApiError' && error.status === 400 && error.message === 'System already initialized',
  );
});

test('request tolerates application/json content-type with a non-JSON body', async () => {
  const api = loadApi(async () => new Response(
    'System already initialized',
    { status: 400, headers: { 'Content-Type': 'application/json;charset=UTF-8' } },
  ));

  await assert.rejects(
    api.request('/api/register-first-user'),
    error => error.name === 'ApiError' && error.status === 400 && error.message === 'System already initialized',
  );
});

test('getPage preserves the backend pagination envelope', async () => {
  const payload = { content: [{ id: 1 }], currentPage: 2, totalPages: 4, totalElements: 31, size: 10 };
  const api = loadApi(async path => {
    assert.equal(path, '/items?page=2&size=10');
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  const result = await api.getPage('/items', { page: 2, size: 10 });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), payload);
});
