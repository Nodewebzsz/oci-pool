import { readdir, readFile } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

function mappingPath(argumentsText = '') {
  const match = argumentsText.match(/["']([^"']*)["']/);
  return match ? match[1] : '';
}

function joinPath(prefix, suffix) {
  const joined = `${prefix || ''}/${suffix || ''}`.replace(/\/+/g, '/');
  return joined === '/' ? '/' : joined.replace(/\/$/, '') || '/';
}

function normalizedPath(path) {
  const withoutQuery = path.split('?')[0];
  const normalized = withoutQuery
    .replace(/\$\{[^}]+\}/g, '{param}')
    .replace(/\{[^}]+\}/g, '{param}')
    .replace(/\{param\}\{param\}/g, '{param}')
    .replace(/\/+/g, '/');
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

export function extractSpringEndpoints(source, controller) {
  const classIndex = source.search(/\bclass\s+\w+/);
  if (classIndex < 0) return [];

  const beforeClass = source.slice(0, classIndex);
  const classMappings = [...beforeClass.matchAll(/@RequestMapping\s*\(([^)]*)\)/g)];
  const prefix = classMappings.length
    ? mappingPath(classMappings[classMappings.length - 1][1])
    : '';
  const methodSource = source.slice(classIndex);
  const endpoints = [];

  const shortcut = /@(Get|Post|Put|Delete|Patch)Mapping(?:\s*\(([^)]*)\))?/g;
  for (const match of methodSource.matchAll(shortcut)) {
    endpoints.push({
      controller,
      method: match[1].toUpperCase(),
      path: normalizedPath(joinPath(prefix, mappingPath(match[2]))),
    });
  }

  const requestMapping = /@RequestMapping(?:\s*\(([^)]*)\))?/g;
  for (const match of methodSource.matchAll(requestMapping)) {
    const argumentsText = match[1] || '';
    const methods = [...argumentsText.matchAll(/RequestMethod\.(GET|POST|PUT|DELETE|PATCH)/g)]
      .map(method => method[1]);
    for (const method of methods.length ? methods : ['ANY']) {
      endpoints.push({
        controller,
        method,
        path: normalizedPath(joinPath(prefix, mappingPath(argumentsText))),
      });
    }
  }

  return endpoints.sort((a, b) =>
    a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

function readFirstArgument(source, start) {
  let i = start;
  let depth = 0;
  let quote = null;
  while (i < source.length) {
    const ch = source[i];
    if (quote) {
      if (ch === quote && source[i - 1] !== '\\') quote = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; i += 1; continue; }
    if (ch === '(' || ch === '[' || ch === '{') { depth += 1; i += 1; continue; }
    if (ch === ')' || ch === ']' || ch === '}') {
      if (ch === ')' && depth === 0) break;
      depth -= 1;
      i += 1;
      continue;
    }
    if (ch === ',' && depth === 0) break;
    i += 1;
  }
  return source.slice(start, i);
}

// Normalize a dynamic URL expression (string literals concatenated with variables
// or template interpolations) into a path with `{param}` placeholders.
function normalizeDynamicUrl(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      i += 1;
      while (i < text.length) {
        const c = text[i];
        if (c === quote && text[i - 1] !== '\\') { i += 1; break; }
        if (quote === '`' && c === '$' && text[i + 1] === '{') {
          let j = i + 2;
          let d = 1;
          while (j < text.length && d > 0) {
            if (text[j] === '{') d += 1;
            else if (text[j] === '}') d -= 1;
            j += 1;
          }
          out += '{param}';
          i = j;
          continue;
        }
        out += c;
        i += 1;
      }
    } else if (/[A-Za-z0-9_$]/.test(ch)) {
      out += '{param}';
      let j = i;
      while (j < text.length && /[A-Za-z0-9_$]/.test(text[j])) j += 1;
      while (j < text.length && /\s/.test(text[j])) j += 1;
      if (text[j] === '(') {
        let d = 0;
        let k = j;
        while (k < text.length) {
          if (text[k] === '(') d += 1;
          else if (text[k] === ')') { d -= 1; if (d === 0) { k += 1; break; } }
          k += 1;
        }
        j = k;
      }
      i = j;
    } else {
      i += 1;
    }
  }
  return out.replace(/\/+/g, '/');
}

function methodFromOptions(source, restStart) {
  const rest = source.slice(restStart);
  const opts = rest.match(/^\s*,\s*\{([\s\S]*?)\}\s*\)/);
  const mm = opts?.[1].match(/\bmethod\s*:\s*["']([A-Za-z]+)["']/);
  // Shared service modules wrap options in small helpers (`jsonBody`,
  // `formBody`, `json`, or `body`).  The helper's first argument may be an
  // explicit HTTP method string (`json('PUT', {...})`) or an options object
  // carrying `method`.  Read it from there so a PUT/DELETE update is not
  // blindly classified as POST.
  const wrapperMatch = rest.match(/^\s*,\s*(?:jsonBody|formBody|json|body)\s*\(/);
  if (wrapperMatch) {
    const openParen = wrapperMatch[0].length - 1;
    const firstArg = readFirstArgument(rest, openParen + 1);
    const methodStr = firstArg.match(/^["']([A-Za-z]+)["']$/);
    if (methodStr) return methodStr[1].toUpperCase();
    const methodObj = firstArg.match(/\bmethod\s*:\s*["']([A-Za-z]+)["']/);
    if (methodObj) return methodObj[1].toUpperCase();
    return 'POST';
  }
  return mm ? mm[1].toUpperCase() : 'GET';
}

export function extractFrontendRequests(source, file) {
  const requests = [];
  const callRe = /\b(fetch|(?:window\.)?ociApi\.(getPage|request)|api\.request)\s*\(/g;
  for (const match of source.matchAll(callRe)) {
    const name = match[1];
    const openParen = match.index + match[0].length - 1;
    const argStart = openParen + 1;
    const firstArg = readFirstArgument(source, argStart);
    const restStart = argStart + firstArg.length;
    const rawPath = normalizeDynamicUrl(firstArg);
    if (!rawPath.startsWith('/')) continue;
    let method = 'GET';
    if (name === 'fetch' || name === 'ociApi.request' || name === 'window.ociApi.request' || name === 'api.request') {
      method = methodFromOptions(source, restStart);
    }
    requests.push({
      index: match.index,
      file,
      method,
      path: normalizedPath(rawPath),
    });
  }
  return requests
    .sort((a, b) => a.index - b.index)
    .map(({ index, ...request }) => request);
}

export function matchFrontendRequests(requests, endpoints) {
  return requests.map(request => {
    const match = endpoints.find(endpoint =>
      (endpoint.method === 'ANY' || endpoint.method === request.method)
      && endpoint.path === request.path);
    return {
      ...request,
      status: match ? 'matched' : 'unmatched',
      controller: match?.controller || '',
    };
  });
}

async function walk(directory, extensions) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path, extensions));
    else if (extensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

export async function buildInventory(projectRoot) {
  const controllerRoot = resolve(projectRoot, 'oci-server/src/main/java/com/doubledimple/ociserver/controller');
  const modernRoot = resolve(projectRoot, 'oci-server/src/main/resources/static/modern-ui/src');
  const templateRoot = resolve(projectRoot, 'oci-server/src/main/resources/templates');

  const controllerFiles = await walk(controllerRoot, new Set(['.java']));
  // Include shared request-constructor modules as well as JSX pages so the
  // generated manifest can verify every service endpoint (not only direct
  // fetch calls embedded in page components).
  const modernFiles = await walk(modernRoot, new Set(['.jsx', '.js']));
  const templateFiles = await walk(templateRoot, new Set(['.ftl']));

  const endpoints = (await Promise.all(controllerFiles.map(async path =>
    extractSpringEndpoints(await readFile(path, 'utf8'), relative(projectRoot, path))
  ))).flat();
  const modernRequests = (await Promise.all(modernFiles.map(async path =>
    extractFrontendRequests(await readFile(path, 'utf8'), relative(projectRoot, path))
  ))).flat();
  const originalRequests = (await Promise.all(templateFiles.map(async path =>
    extractFrontendRequests(await readFile(path, 'utf8'), relative(projectRoot, path))
  ))).flat();

  return {
    endpointCount: endpoints.length,
    modernRequestCount: modernRequests.length,
    originalRequestCount: originalRequests.length,
    modern: matchFrontendRequests(modernRequests, endpoints),
    original: matchFrontendRequests(originalRequests, endpoints),
  };
}

const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  const projectRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));
  const inventory = await buildInventory(projectRoot);
  process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`);
}
