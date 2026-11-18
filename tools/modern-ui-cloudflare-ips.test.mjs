import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (p) => readFile(new URL(p, root), 'utf8');

test('Cloudflare official IPs contract and DNS public IP extractor exist in Web and Mac', async () => {
  const proxySvc = await read('oci-server/src/main/resources/static/modern-ui/src/services-proxy.js');
  const proxyPage = await read('oci-server/src/main/resources/static/modern-ui/src/page-proxy.jsx');
  const macCfSvc = await read('oci-pool-mac/OciPool/Features/Cloudflare/CloudflareService.swift');

  assert.match(proxySvc, /S\.cloudflareOfficialIps\s*=\s*mark\(/);
  assert.match(proxySvc, /\/dns\/cloudflare\/api\/official-ips/);
  assert.match(proxyPage, /CF-Connecting-IP|nginxRealIpSnippet/);
  assert.match(proxyPage, /extractCloudflarePublicIps/);
  assert.match(macCfSvc, /\/dns\/cloudflare\/api\/official-ips/);
});
