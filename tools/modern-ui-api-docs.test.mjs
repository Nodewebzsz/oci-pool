import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (p) => readFile(new URL(p, root), 'utf8');

test('Swagger anonymous exemptions and dead UI links are removed across Server, Web, and Mac', async () => {
  const saToken = await read('oci-server/src/main/java/com/nodewebzsz/ociserver/config/SaTokenConfig.java');
  const tokenServices = await read('oci-server/src/main/resources/static/modern-ui/src/services-token.js');
  const proxyPage = await read('oci-server/src/main/resources/static/modern-ui/src/page-proxy.jsx');
  const macView = await read('oci-pool-mac/OciPool/Features/ApiTokens/ApiTokensView.swift');

  assert.doesNotMatch(saToken, /swagger-ui|\/v3\/api-docs/);
  assert.match(tokenServices, /S\.openApiSpec\s*=\s*mark\(/);
  assert.doesNotMatch(proxyPage, /\/swagger-ui\/index\.html|\/v3\/api-docs/);
  assert.doesNotMatch(macView, /\/swagger-ui\/index\.html|\/v3\/api-docs/);
});
