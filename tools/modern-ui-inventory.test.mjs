import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractFrontendRequests,
  extractSpringEndpoints,
  matchFrontendRequests,
} from './modern-ui-contracts.mjs';

test('extractSpringEndpoints combines class and method mappings', () => {
  const source = `
    @RequestMapping("/tenants")
    public class TenantController {
      @GetMapping("/list/json")
      public Object list(@RequestParam int page) { return null; }

      @PostMapping(value = "/save")
      public Object save(@RequestBody TenantDTO request) { return null; }
    }
  `;

  assert.deepEqual(extractSpringEndpoints(source, 'TenantController.java'), [
    { controller: 'TenantController.java', method: 'GET', path: '/tenants/list/json' },
    { controller: 'TenantController.java', method: 'POST', path: '/tenants/save' },
  ]);
});

test('extractSpringEndpoints supports bare and multi-method RequestMapping', () => {
  const source = `
    @RequestMapping("/boot")
    public class BootController {
      @RequestMapping("/startBoot")
      public Object start() { return null; }

      @RequestMapping(value = "/toggle", method = {RequestMethod.GET, RequestMethod.POST})
      public Object toggle() { return null; }
    }
  `;

  assert.deepEqual(extractSpringEndpoints(source, 'BootController.java'), [
    { controller: 'BootController.java', method: 'ANY', path: '/boot/startBoot' },
    { controller: 'BootController.java', method: 'GET', path: '/boot/toggle' },
    { controller: 'BootController.java', method: 'POST', path: '/boot/toggle' },
  ]);
});

test('extractFrontendRequests finds fetch paths and explicit methods', () => {
  const source = `
    fetch('/tenants/list/json?page=0');
    fetch(\`/tenants/deleteApi?tenantId=\${id}\`, { method: 'DELETE' });
  `;

  assert.deepEqual(extractFrontendRequests(source, 'page-tenants.jsx'), [
    { file: 'page-tenants.jsx', method: 'GET', path: '/tenants/list/json' },
    { file: 'page-tenants.jsx', method: 'DELETE', path: '/tenants/deleteApi' },
  ]);
});

test('extractFrontendRequests finds shared API client calls', () => {
  const source = `
    window.ociApi.getPage('/oci/list/json', { page: 0 });
    window.ociApi.request('/boot/startBoot?bootId=1', { method: 'POST' });
  `;

  assert.deepEqual(extractFrontendRequests(source, 'page.jsx'), [
    { file: 'page.jsx', method: 'GET', path: '/oci/list/json' },
    { file: 'page.jsx', method: 'POST', path: '/boot/startBoot' },
  ]);
});

test('matchFrontendRequests reports unmatched method/path pairs', () => {
  const requests = [
    { file: 'page.jsx', method: 'GET', path: '/tenants/list/json' },
    { file: 'page.jsx', method: 'POST', path: '/missing' },
  ];
  const endpoints = [
    { controller: 'TenantController.java', method: 'GET', path: '/tenants/list/json' },
    { controller: 'FallbackController.java', method: 'ANY', path: '/missing' },
  ];

  assert.deepEqual(matchFrontendRequests(requests, endpoints), [
    { ...requests[0], status: 'matched', controller: 'TenantController.java' },
    { ...requests[1], status: 'matched', controller: 'FallbackController.java' },
  ]);
});
