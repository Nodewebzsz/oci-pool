import { readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { extractFrontendRequests } from './modern-ui-contracts.mjs';

function mappingText(args = '') {
  const match = args.match(/["']([^"']*)["']/);
  return match ? match[1] : '';
}

function joinPaths(prefix, suffix) {
  const joined = `${prefix || ''}/${suffix || ''}`.replace(/\/+/g, '/');
  return joined === '/' ? '/' : joined.replace(/\/$/, '') || '/';
}

function normalizedPath(path) {
  const withoutQuery = path.split('?')[0];
  const normalized = withoutQuery
    .replace(/\$\{[^}]+\}/g, '{param}')
    .replace(/\{[^}]+\}/g, '{param}')
    // A concatenated string literal + variable can otherwise emit two adjacent
    // placeholders for one path segment (e.g. `/delete/{id}`).
    .replace(/\{param\}\{param\}/g, '{param}')
    .replace(/\/+/g, '/');
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}
// Derive the wire encoding for a Controller endpoint from its Spring binding and
// whether any parameter is a multipart file upload.
function encodingFor(method, requestBinding) {
  const multipart = method.params.some(p =>
    p.binding === 'RequestParam'
    && (p.type === 'MultipartFile' || /file$/i.test(p.valueName)));
  if (multipart) return 'multipart/form-data';
  if (requestBinding === 'json-body') return 'application/json';
  if (requestBinding === 'form-urlencoded') return 'application/x-www-form-urlencoded';
  if (requestBinding === 'unknown-body') return 'unknown';
  return 'query-string';
}

// Collect every original Freemarker template request expression keyed by
// METHOD PATH so each Modern contract can name the original call site.
async function buildOriginalTemplateMap(projectRoot) {
  const templateRoot = resolve(projectRoot, "oci-server/src/main/resources/templates");
  const templateFiles = await walkFiles(templateRoot, new Set(['.ftl']));
  const map = new Map();
  for (const path of templateFiles) {
    const source = await readFile(path, "utf8");
    for (const req of extractFrontendRequests(source, relative(projectRoot, path))) {
      const key = req.method + ' ' + req.path;
      const set = map.get(key) || new Set();
      set.add(basename(path));
      map.set(key, set);
    }
  }
  return map;
}

function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '<' || ch === '(' || ch === '[') depth += 1;
    else if (ch === '>' || ch === ')' || ch === ']') depth -= 1;
    else if (ch === ',' && depth === 0) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  const tail = text.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

function parseParam(piece) {
  const bindingMatch = piece.match(/@(\w+)\s*(?:\(\s*([^)]*)\s*\))?/);
  // Validation annotations may precede the transport binding (for example
  // `@Validated @RequestBody EmailReceiveAddRequest`). Prefer RequestBody,
  // RequestParam, PathVariable, and RequestHeader when any of them appear so
  // encoding and DTO-field extraction reflect the actual Spring binding.
  const transport = piece.match(/@(RequestBody|RequestParam|PathVariable|RequestHeader)\b/);
  const binding = transport ? transport[1] : (bindingMatch ? bindingMatch[1] : '');
  const annotations = piece.replace(/@\w+(?:\s*\([^)]*\))?/g, ' ').trim();
  const declaration = annotations.match(/([\w<>?,.\s]+?)\s+(\w+)\s*$/);
  if (!declaration) return null;
  const type = declaration[1].trim();
  const name = declaration[2];
  let valueName = name;
  if (bindingMatch && bindingMatch[2]) {
    const value = bindingMatch[2].match(/(?:value|name)\s*=\s*["']([^"']+)["']/);
    if (value) valueName = value[1];
    else {
      const positional = bindingMatch[2].match(/["']([^"']+)["']/);
      if (positional && !bindingMatch[2].includes('defaultValue')) valueName = positional[1];
    }
  }
  return { binding, name, type, valueName };
}

function matchControllerMethod(source, controllerPath) {
  const classIndex = source.search(/\bclass\s+\w+/);
  if (classIndex < 0) return [];
  const beforeClass = source.slice(0, classIndex);
  const classMappings = [...beforeClass.matchAll(/@RequestMapping\s*\(([^)]*)\)/g)];
  const prefix = classMappings.length
    ? mappingText(classMappings[classMappings.length - 1][1])
    : '';
  const rest = source.slice(classIndex);
  const methods = [];

  const addFromAnnotation = (annotationText, requestMappingText) => {
    const after = rest.slice(annotationText.index + annotationText[0].length);
    const declaration = after.match(/\bpublic\s+([^({]+?)\s+(\w+)\s*\(/);
    if (!declaration) return;
    const methodName = declaration[2];
    const openParen = after.indexOf('(', declaration.index);
    let closeParen = openParen;
    let depth = 0;
    for (let i = openParen; i < after.length; i += 1) {
      if (after[i] === '(') depth += 1;
      else if (after[i] === ')') {
        depth -= 1;
        if (depth === 0) { closeParen = i; break; }
      }
    }
    const paramsText = after.slice(openParen + 1, closeParen);
    const params = splitTopLevel(paramsText).map(parseParam).filter(Boolean);
    const bodyOpen = after.indexOf('{', closeParen);
    let bodyClose = bodyOpen;
    let bodyDepth = 0;
    if (bodyOpen >= 0) {
      for (let i = bodyOpen; i < after.length; i += 1) {
        if (after[i] === '{') bodyDepth += 1;
        else if (after[i] === '}') {
          bodyDepth -= 1;
          if (bodyDepth === 0) { bodyClose = i; break; }
        }
      }
    }
    const body = bodyOpen >= 0 ? after.slice(bodyOpen + 1, bodyClose) : '';
    methods.push({
      controller: relative('/Users/zszweb/Downloads/oci-start-modern-ui-v4', controllerPath),
      method: requestMappingText.method,
      path: normalizedPath(joinPaths(prefix, requestMappingText.path)),
      methodName,
      returnType: declaration[1].trim(),
      params,
      body,
    });
  };

  const shortcut = /@(Get|Post|Put|Delete|Patch)Mapping\s*\(([^)]*)\)/g;
  for (const match of rest.matchAll(shortcut)) {
    addFromAnnotation(match, { method: match[1].toUpperCase(), path: mappingText(match[2]) });
  }
  const bareShortcut = /@(Get|Post|Put|Delete|Patch)Mapping\b(?!\s*\()/g;
  for (const match of rest.matchAll(bareShortcut)) {
    addFromAnnotation(match, { method: match[1].toUpperCase(), path: '' });
  }
  const requestMapping = /@RequestMapping\s*\(([^)]*)\)/g;
  for (const match of rest.matchAll(requestMapping)) {
    const args = match[1] || '';
    const methodsMatch = [...args.matchAll(/RequestMethod\.(GET|POST|PUT|DELETE|PATCH)/g)]
      .map(m => m[1]);
    for (const method of methodsMatch.length ? methodsMatch : ['ANY']) {
      addFromAnnotation(match, { method, path: mappingText(args) });
    }
  }
  return methods;
}

export function extractJavaFields(source) {
  return [...source.matchAll(/\bprivate\s+(?:[\w<>?,.\s]+)\s+(\w+)\s*(?:=[^;]+)?;/g)]
    .map(m => m[1]);
}

// Request keys read from `Map` / `List<Map>` request bodies in Java Controllers.
// These cannot be derived from a DTO because the Controller accepts a raw map.
// Every entry below is backed by explicit source evidence recorded in `source`.
const MAP_BODY_REQUEST_FIELDS = {
  'OciController:stopInstance': {
    fields: ['instanceId'],
    source: 'oci-server/src/main/java/com/doubledimple/ociserver/controller/OciController.java:559',
  },
  'OciController:startInstance': {
    fields: ['instanceId'],
    source: 'oci-server/src/main/java/com/doubledimple/ociserver/controller/OciController.java:521',
  },
  'OciController:deleteInstanceRecord': {
    fields: ['id'],
    source: 'oci-server/src/main/java/com/doubledimple/ociserver/controller/OciController.java:681',
  },
  'OciController:terminateInstance': {
    fields: ['instanceId', 'verificationCode'],
    source: 'oci-server/src/main/java/com/doubledimple/ociserver/controller/OciController.java:345-346',
  },
  'PasswordResetController:sendResetCode': {
    fields: ['username'],
    source: 'oci-server/src/main/java/com/doubledimple/ociserver/controller/login/PasswordResetController.java:31',
  },
  'PasswordResetController:verifyResetCode': {
    fields: ['username', 'verificationCode'],
    source: 'oci-server/src/main/java/com/doubledimple/ociserver/controller/login/PasswordResetController.java:54-55',
  },
  'PasswordResetController:resetPassword': {
    fields: ['username', 'resetToken'],
    source: 'oci-server/src/main/java/com/doubledimple/ociserver/controller/login/PasswordResetController.java:91-94',
  },
  'TenantController:importData': {
    fields: ['id', 'tenant_id', 'user_name', 'fingerprint', 'tenancy', 'region', 'api_synced', 'enable_icmp', 'enable_all_protocol', 'is_home_region', 'paren_id', 'tenancy_name', 'custom_name', 'tenancy_des', 'account_type', 'cloud_type', 'region_en', 'id_str', 'email_address', 'created_at', 'children'],
    source: 'oci-server/src/main/java/com/doubledimple/ociserver/service/impl/TenantServiceImpl.java:1391-1427, custom_name validation',
  },
  'TenantController:subscribeToRegions': {
    fields: ['tenantId', 'regionKeys'],
    source: 'oci-server/src/main/java/com/doubledimple/ociserver/controller/TenantController.java:364-366',
  },
  'TenantController:enableEmailService': {
    fields: ['tenantId', 'emailDomain'],
    source: 'oci-server/src/main/java/com/doubledimple/ociserver/service/impl/TenantServiceImpl.java:884-899',
  },
};

// Controllers declare `@RequestParam` values that the frontend actually sends
// as an `application/x-www-form-urlencoded` body.  Spring binds both forms, so
// these are fully connected; only the recorded encoding needs to be corrected.
const REQUEST_BINDING_OVERRIDES = {
  'SystemSettingsApiController:updateLogoName': 'form-urlencoded',
};

function extractMapKeys(body) {
  const keys = new Set();
  for (const match of body.matchAll(/\.\s*(?:get|getStringValue|getLongValue|getBooleanValue|getIntegerValue)\s*\(\s*["']([^"']+)["']/g)) {
    keys.add(match[1]);
  }
  return [...keys];
}

// Response DTOs / top-level fields for Controller methods whose declared return
// type hides the actual data (raw `ApiResponse`, `ResponseEntity<?>`, `Object`).
// Each entry is backed by reading the Controller method body.
const RESPONSE_OVERRIDES = {
  'DashBoardController:getDashboardStats': { dto: 'DashboardStats' },
  'DashBoardController:getSystemStats': { dto: 'SystemMetrics' },
  'ArmResourcesController:getArmData': { dto: 'OpenRegionNotify' },
  'ArmResourcesController:getMyRegions': { dto: 'OpenRegionNotify' },
  'VpnProxyRecordController:pageList': { dto: 'VpnProxyRecord' },
  'SystemSettingsController:getAiModels': { dto: 'ModelSummaryDef' },
  'OpenBootController:bootDetail': { dto: 'BootInstance' },
  'EmailController:listTenant': { dto: 'TenantEmailConfig' },
  'LoginUserController:getUserInfo': { fields: ['username'] },
  'LogController:openLogsJson': { fields: ['lines', 'count', 'error'] },
};

// Identifier semantics per contract. Mirrors the plan's Core Field Contracts.
const ID_RULES = {
  'POST /oci/terminateInstance': 'body.instanceId = database record id (Long.valueOf(instanceId)); body.verificationCode required',
  'POST /oci/startInstance': 'body.instanceId = database instance record id (OracleInstanceService.startInstance parses Long)',
  'POST /oci/stopInstance': 'body.instanceId = database instance record id (OracleInstanceService.stopInstanceByInstanceId parses Long)',
  'POST /oci/updateRemark': 'body.instanceId = database instance record id (UpdateRemarkRequest.instanceId Long)',
  'POST /oci/updateName': 'body.instanceId = database instance record id (OracleInstanceService.updateInstanceName)',
  'POST /oci/updateConfig': 'body.instanceId = database instance record id (UpdateConfigRequest.instanceId)',
  'POST /oci/updateBootVolume': 'body.instanceId = database instance record id (UpdateVolumeDefRequest.instanceId)',
  'POST /oci/enableIpv6': 'body.tenantId = database instance record id (controller calls enableOrRefreshIpv6)',
  'POST /oci/instance/quickDD2': 'body.instanceId = database instance record id (QuickDdService loads by primary key)',
  'POST /oci/sysImageBackUp': 'body.instanceId and body.tenantId = database instance/tenant ids',
  'POST /oci/deleteInstanceRecord': 'body.id = database record id (Long.valueOf)',
  'POST /boot/startBoot': 'query bootId = BootInstance.id (BootInstanceRepository.findById)',
  'POST /boot/stopBoot': 'query bootId = BootInstance.id (BootInstanceRepository.findById)',
  'POST /boot/deleteBoot': 'query bootId = BootInstance.id (BootInstanceRepository.findById)',
  'POST /tenants/updateCustomName': 'body.tenantId = Tenant.idStr ?? String(Tenant.id) (database id)',
  'POST /tenants/subscribe-regions': 'body.tenantId = database id; body.regionKeys = region codes',
  'GET /tenants/regionList/json': 'query tenantId = database id (tenantDbId)',
  'GET /tenants/syncOci': 'query tenantId = database id (tenantDbId)',
  'GET /oci/list/json': 'query tenantId = database id (tenantDbId)',
  'GET /boot/fullBootList/json': 'query tenantId = database id (tenantDbId)',
};

// Confirmation flow requirements per destructive/verification action.
const CONFIRMATION_FLOWS = {
  'POST /oci/terminateInstance': 'requires verificationCode input; destructive terminate',
  'POST /oci/deleteInstanceRecord': 'destructive record delete; confirm dialog',
  'POST /oci/stopInstance': 'confirm stop in original template',
  'POST /oci/startInstance': 'confirm start in original template',
  'POST /boot/stopBoot': 'confirm boot task stop in original template',
  'POST /boot/deleteBoot': 'confirm boot task delete in original template',
  'POST /vpnProxy/delete': 'confirm proxy record delete in original template',
  'DELETE /api/system/deleteMfaConfig': 'confirm MFA config delete in original template',
  'POST /oci/storage/bucket/delete': 'confirm storage bucket delete',
  'POST /oci/storage/object/delete': 'confirm storage object delete',
};

async function walkFiles(directory, extensions, output = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await walkFiles(path, extensions, output);
    else if (extensions.has(extname(entry.name))) output.push(path);
  }
  return output;
}

async function buildTypeIndex(projectRoot) {
  const roots = [
    resolve(projectRoot, 'oci-server/src/main/java'),
    resolve(projectRoot, 'oci-common/src/main/java'),
    resolve(projectRoot, 'oci-dao/src/main/java/com/doubledimple/dao/entity'),
  ];
  const skips = ['/controller/', '/service/', '/config/', '/task/', '/third/', '/aspect/', '/filter/'];
  const envelope = new Set(['ApiResponse', 'Page', 'Pageable', 'Result', 'ResponseEntity']);
  const files = (await Promise.all(roots.map(root => walkFiles(root, new Set(['.java']))))).flat();
  const index = new Map();
  for (const path of files) {
    const rel = path.replace(/\\/g, '/');
    if (skips.some(segment => rel.includes(segment))) continue;
    const source = await readFile(path, 'utf8');
    const classMatch = source.match(/\b(?:class|enum)\s+(\w+)/);
    if (!classMatch) continue;
    const name = classMatch[1];
    if (envelope.has(name)) continue;
    const fields = extractJavaFields(source);
    if (!fields.length) continue;
    index.set(name, { path: relative(projectRoot, path), fields });
  }
  return index;
}

function baseType(type) {
  return type
    .replace(/^ResponseEntity\s*</, '')
    .replace(/^ApiResponse\s*</, '')
    .replace(/^Page\s*</, '')
    .replace(/^List\s*</, '')
    .replace(/>.*$/, '')
    .trim();
}

function resolveResponseFields(returnType, typeIndex) {
  const inner = returnType.match(/[<]([^<>]+)>/);
  const target = inner ? inner[1].trim() : baseType(returnType);
  const candidate = target.split(',').pop().trim();
  const info = typeIndex.get(candidate);
  if (info) return { responseType: candidate, responseFields: info.fields, resolved: true };
  // Nested generics (e.g. `ResponseEntity<List<Tenant>>`) hide the row DTO behind
  // a wrapper; if the declared return type names a known DTO, use it.
  for (const [name, dto] of typeIndex) {
    if (new RegExp(`\\b${name}\\b`).test(returnType)) {
      return { responseType: name, responseFields: dto.fields, resolved: true };
    }
  }
  return { responseType: candidate, responseFields: [], resolved: false };
}

// When a Controller returns `Object`, `ApiResponse`, `ResponseEntity<?>` or a
// `Map`, the real row DTO is usually referenced as a generic argument inside the
// method body (e.g. `Page<Tenant> userPage`, `List<InstanceDetailsRes>`).
// Fall back to that evidence so response fields are not left empty.
function inferResponseFields(returnType, body, typeIndex) {
  const existing = resolveResponseFields(returnType, typeIndex);
  if (existing.resolved && existing.responseFields.length) return existing;
  // Only infer a row DTO from the method body for page-envelope responses
  // (the PageEnvelope<T> shape used by the list endpoints: content/totalElements).
  // Mutation endpoints that return `Map` with success/message must not be
  // mistaken for data responses even if they reference a `List<DTO>` internally.
  const isPageEnvelope = /\bcontent\b/.test(body) && /\btotalElements\b/.test(body);
  if (!isPageEnvelope) return existing;
  for (const [name, info] of typeIndex) {
    const pattern = new RegExp(`(?:List|Page|Set|Collection)\\s*<[\\s]*${name}(?:[\\s]|>|,|\\[)`);
    if (pattern.test(body)) {
      return { responseType: name, responseFields: info.fields, resolved: true };
    }
  }
  return existing;
}

export async function buildParity(projectRoot) {
  const controllerRoot = resolve(projectRoot, 'oci-server/src/main/java/com/doubledimple/ociserver/controller');
  const modernRoot = resolve(projectRoot, 'oci-server/src/main/resources/static/modern-ui/src');

  const controllerFiles = await walkFiles(controllerRoot, new Set(['.java']));
  // Include service modules as well as page modules so manifest coverage also
  // verifies requests constructed through the shared `api` client wrapper.
  const modernFiles = await walkFiles(modernRoot, new Set(['.jsx', '.js']));
  const typeIndex = await buildTypeIndex(projectRoot);
  const originalTemplateMap = await buildOriginalTemplateMap(projectRoot);

  const controllerMethods = (await Promise.all(controllerFiles.map(async path =>
    matchControllerMethod(await readFile(path, 'utf8'), path)
  ))).flat();

  const frontendRequests = (await Promise.all(modernFiles.map(async path =>
    extractFrontendRequests(await readFile(path, 'utf8'), relative(projectRoot, path))
  ))).flat();

  const contracts = frontendRequests.map(request => {
    const method = controllerMethods.find(m =>
      (m.method === 'ANY' || m.method === request.method)
      && m.path === request.path);
    const isStaticAsset = request.path.startsWith('/modern-ui/')
      || request.path.startsWith('/vendor/');
    if (!method) {
      return {
        ...request,
        controller: '',
        methodName: '',
        requestFields: [],
        responseType: '',
        responseFields: [],
        requestBinding: 'none',
        requestKind: isStaticAsset ? 'static-asset' : 'business',
        status: isStaticAsset ? 'connected' : 'manual-review',
        note: isStaticAsset ? 'local static asset' : 'no backend mapping found',
      };
    }
    const requestParams = method.params.filter(p =>
      p.binding === 'RequestParam' || p.binding === 'PathVariable' || p.binding === 'RequestHeader');
    const bodyParams = method.params.filter(p => p.binding === 'RequestBody');
    const bodyType = bodyParams[0]?.type || '';
    const isMapBody = /^Map\s*</.test(bodyType) || /^List\s*<\s*Map/.test(bodyType);
    const bodyInfo = typeIndex.get(baseType(bodyType));
    const mapKey = `${basename(method.controller, '.java')}:${method.methodName}`;
    const mapOverride = isMapBody ? MAP_BODY_REQUEST_FIELDS[mapKey] : null;
    let requestFields = [
      ...requestParams.map(p => `${p.binding}:${p.valueName}`),
      ...(bodyInfo ? bodyInfo.fields.map(f => `body:${f}`) : []),
    ];
    let requestBinding;
    let status;
    let note;
    if (mapOverride) {
      requestFields = [...requestFields, ...mapOverride.fields.map(f => `body:${f}`)];
      requestBinding = 'json-body';
      status = 'connected';
      note = `map body keys from ${mapOverride.source}`;
    } else if (isMapBody) {
      const keys = extractMapKeys(method.body);
      requestFields = [...requestFields, ...keys.map(f => `body:${f}`)];
      requestBinding = 'json-body';
      status = keys.length ? 'connected' : 'manual-review';
      note = keys.length
        ? `map body keys ${keys.join(', ')}`
        : `unresolved body type ${bodyType}`;
    } else if (bodyInfo) {
      requestBinding = 'json-body';
      status = 'connected';
      note = `request body from ${relative(projectRoot, bodyInfo.path)}`;
    } else if (bodyType) {
      requestBinding = 'unknown-body';
      status = 'manual-review';
      note = `unresolved body type ${bodyType}`;
    } else {
      requestBinding = 'query-params';
      status = 'connected';
      note = 'query-param request';
    }
    const bindingOverride = REQUEST_BINDING_OVERRIDES[mapKey];
    if (bindingOverride) {
      requestBinding = bindingOverride;
      status = 'connected';
      note = 'request binding overridden to form-urlencoded';
    }
    const responseOverride = RESPONSE_OVERRIDES[`${basename(method.controller, '.java')}:${method.methodName}`];
    let resolvedResponse;
    if (responseOverride) {
      if (responseOverride.dto) {
        const dtoInfo = typeIndex.get(responseOverride.dto);
        resolvedResponse = {
          responseType: responseOverride.dto,
          responseFields: dtoInfo ? dtoInfo.fields : [],
          resolved: true,
        };
      } else {
        resolvedResponse = {
          responseType: responseOverride.responseType || 'Object',
          responseFields: responseOverride.fields || [],
          resolved: true,
        };
      }
    } else {
      resolvedResponse = inferResponseFields(method.returnType, method.body, typeIndex);
    }
    return {
      ...request,
      controller: method.controller,
      methodName: method.methodName,
      requestFields: [...new Set(requestFields)],
      responseType: resolvedResponse.responseType,
      responseFields: resolvedResponse.responseFields,
      responseFieldSource: resolvedResponse.responseFields.length && resolvedResponse.responseType
        ? Object.fromEntries(resolvedResponse.responseFields.map(f => [f, resolvedResponse.responseType + '.get' + f[0].toUpperCase() + f.slice(1) + '()']))
        : {},
      preservation: 'preserve valid 0 and false with explicit nullish checks; empty string renders blank',
      requestBinding,
      encoding: encodingFor(method, requestBinding),
      originalTemplate: [...(originalTemplateMap.get(request.method + ' ' + request.path) || [])].sort(),
      responseDtoPath: typeIndex.get(resolvedResponse.responseType)?.path || '',
      requestKind: 'business',
      status,
      note,
      ...(ID_RULES[`${request.method} ${request.path}`]
        ? { idRules: ID_RULES[`${request.method} ${request.path}`] }
        : {}),
      ...(CONFIRMATION_FLOWS[`${request.method} ${request.path}`]
        ? { confirmationFlow: CONFIRMATION_FLOWS[`${request.method} ${request.path}`] }
        : {}),
    };
  });

  const endpointRows = controllerMethods.map(method => ({
    controller: method.controller,
    method: method.method,
    path: method.path,
    methodName: method.methodName,
    params: method.params.map(p => `${p.binding ?? 'plain'}:${p.name}`),
  }));

  return {
    endpointCount: controllerMethods.length,
    modernRequestCount: frontendRequests.length,
    contracts,
    endpointRows,
  };
}

// Task 1 的“Modern UI 静态可识别请求”基线只统计页面入口文件（app/page-*）。
// 共享 action/service 模块同样保留在 contracts 中，供服务契约测试和后续任务覆盖，
// 当前页面入口请求基线由生成结果决定；共享 action/service 请求同样
// 保留在 contracts 中供服务契约测试和后续任务覆盖。
export function countPageBaselineRequests(contracts) {
  return contracts.filter(c => /\/app\.jsx$|\/page-[^/]+\.jsx$/.test(c.file)).length;
}

const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  const projectRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));
  const parity = await buildParity(projectRoot);
  if (process.argv.includes('--write-manifest')) {
    const statusSummary = {};
    for (const contract of parity.contracts) {
      statusSummary[contract.status] = (statusSummary[contract.status] || 0) + 1;
    }
    const manifest = {
      generatedAt: new Date().toISOString(),
      endpointCount: parity.endpointCount,
      modernRequestCount: countPageBaselineRequests(parity.contracts),
      modernRequestCountAll: parity.modernRequestCount,
      statusSummary,
      contracts: parity.contracts,
    };
    await writeFile(
      resolve(projectRoot, 'docs/modern-ui-contract-manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    process.stdout.write(`wrote manifest (${parity.contracts.length} contracts)\n`);
  } else {
    process.stdout.write(`${JSON.stringify(parity, null, 2)}\n`);
  }
}
