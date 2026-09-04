import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function source(relativePath) {
  return readFile(new URL(relativePath, root), 'utf8');
}

test('production data bundle contains no realistic business fixtures', async () => {
  const data = await source('oci-server/src/main/resources/static/modern-ui/src/data.jsx');

  assert.doesNotMatch(data, /const\s+TENANTS\s*=\s*\[[\s\S]*?tenancy\s*:/);
  assert.doesNotMatch(data, /const\s+INSTANCES\s*=\s*\[[\s\S]*?publicIp\s*:/);
  assert.doesNotMatch(data, /const\s+GRAB_TASKS\s*=/);
  assert.doesNotMatch(data, /const\s+GRAB_LOGS\s*=/);
  assert.doesNotMatch(data, /const\s+PROXIES\s*=/);
  assert.doesNotMatch(data, /const\s+SYSTEM_METRICS\s*=/);
  assert.doesNotMatch(data, /const\s+GRAB_RATE\s*=/);
  assert.doesNotMatch(data, /const\s+SUCCESS_TIMELINE\s*=/);
  assert.doesNotMatch(data, /const\s+SHAPES\s*=/);
  assert.doesNotMatch(data, /const\s+SYSTEM\s*=\s*\{[\s\S]*?dashboard\s*:/);
  assert.doesNotMatch(data, /rootPassword\s*:/);
  assert.doesNotMatch(data, /publicIp\s*:/);
  assert.doesNotMatch(data, /ocid1\.tenancy\.oc1\.\./);
  assert.doesNotMatch(data, /requestId\s*:/);
  assert.doesNotMatch(data, /latency\s*:/);
  assert.doesNotMatch(data, /Math\.random\s*\(\)/);
});

test('tenant list starts empty and never invents backend-owned fields', async () => {
  const page = await source('oci-server/src/main/resources/static/modern-ui/src/page-tenants.jsx');

  assert.doesNotMatch(page, /useStateT\(TENANTS\)/);
  assert.doesNotMatch(page, /task:\s*'idle'/);
  assert.doesNotMatch(page, /multiRegion:\s*false/);
  assert.doesNotMatch(page, /catch\s*\([^)]*\)\s*\{\s*\}/);
});

test('boot detail UI uses real BootInstance records and does not fabricate workers', async () => {
  const actions = await source('oci-server/src/main/resources/static/modern-ui/src/grab-actions.jsx');
  const services = await source('oci-server/src/main/resources/static/modern-ui/src/services-boot.js');
  assert.match(services, /S\.bootDetail\s*=\s*mark/);
  assert.match(services, /S\.toggleStatus\s*=\s*mark/);
  assert.match(services, /S\.deleteBootDetail\s*=\s*mark/);
  assert.match(actions, /window\.ociServices\.boot\.bootDetail\(/);
  assert.match(actions, /window\.ociServices\.boot\.toggleStatus\(/);
  assert.match(actions, /window\.ociServices\.boot\.deleteBootDetail\(/);
  assert.doesNotMatch(actions, /Array\.from\(\{ length: count \}/);
  assert.doesNotMatch(actions, /Math\.random\(\)/);
  assert.doesNotMatch(actions, /GRAB_LOGS\.filter/);
});

test('tenant API import validates custom-name duplicates before reporting success', async () => {
  const actions = await source('oci-server/src/main/resources/static/modern-ui/src/tenant-actions.jsx');
  const services = await source('oci-server/src/main/resources/static/modern-ui/src/services-tenant.js');
  const service = await source('oci-server/src/main/java/com/doubledimple/ociserver/service/impl/TenantServiceImpl.java');
  const controller = await source('oci-server/src/main/java/com/doubledimple/ociserver/controller/TenantController.java');
  const repository = await source('oci-dao/src/main/java/com/doubledimple/dao/repository/TenantRepository.java');

  // The UI must surface the backend conflict and never close the modal/show
  // a success toast when a user-selected custom name is already used.
  assert.match(actions, /const customName = state\.alias\.trim\(\)/);
  assert.match(actions, /checkCustomName\(/);
  assert.match(actions, /custom_name: customName \|\| null/);
  assert.match(actions, /自定义名称已存在/);
  assert.match(actions, /导入失败/);
  assert.match(services, /\/tenants\/checkCustomName/);

  // The import service remains authoritative (the list is paginated and can
  // be stale), checking both names in one request and persisted tenant names.
  assert.match(service, /Set<String> importNames/);
  assert.match(service, /existsParentByTenancyNameAndCloudType/);
  assert.match(service, /自定义名称已存在/);
  assert.match(controller, /@GetMapping\("\/checkCustomName"\)/);
  assert.match(repository, /existsParentByTenancyNameAndCloudType/);
});

test('instance list preserves database id and OCI instanceId separately', async () => {
  const page = await source('oci-server/src/main/resources/static/modern-ui/src/page-instances.jsx');

  assert.doesNotMatch(page, /useStateIn\(INSTANCES\)/);
  assert.doesNotMatch(page, /id:\s*i\.instanceId\s*\|\|\s*i\.id/);
  assert.match(page, /id:\s*i\.id\b/);
  assert.match(page, /instanceId:\s*i\.instanceId\b/);
  assert.match(page, /ociTenantRow\.normalize/);
  assert.doesNotMatch(page, /normalizeTenantRow\(/);
  assert.doesNotMatch(page, /catch\s*\([^)]*\)\s*\{\s*\}/);
});

test('instance normalization preserves numeric tenant id when tenantIdStr is empty and defaults VPU to zero', async () => {
  const page = await source('oci-server/src/main/resources/static/modern-ui/src/page-instances.jsx');
  assert.match(page, /tenantId:\s*String\(tenantDbId\s*\?\?\s*''\)/);
  assert.match(page, /vpu:\s*i\.vpusPerGB == null \|\| i\.vpusPerGB === '' \? 0 : i\.vpusPerGB/);
});

test('instance list sends route pagination and tenant filter to the real backend', async () => {
  const page = await source('oci-server/src/main/resources/static/modern-ui/src/page-instances.jsx');
  assert.match(page, /getPage\('\/oci\/list\/json', \{[\s\S]*tenantId: regionFilter \|\| undefined,[\s\S]*\}\)/);
  assert.match(page, /\}, \[refreshToken, regionFilter, page, perPage\]\);/);
  assert.match(page, /const total = Number\(json\.totalElements\) \|\| 0/);
  assert.match(page, /setTotalElements\(total\)/);
  assert.match(page, /if \(page > totalPages\)/);
  assert.match(page, /ociRouter\?\.go\('instances'/);
  assert.doesNotMatch(page, /getPage\('\/oci\/list\/json', \{ page: 0, size: 500, tenantId/);
});

test('instance list renders original backend cpuAndMem and createTime fields', async () => {
  const page = await source('oci-server/src/main/resources/static/modern-ui/src/page-instances.jsx');
  assert.match(page, /cpuAndMem: i\.cpuAndMem/);
  assert.match(page, /const createdAt = i\.createTime \|\| ''/);
  assert.match(page, /r\.cpuAndMem == null \|\| r\.cpuAndMem === '' \? '—' : r\.cpuAndMem/);
  assert.doesNotMatch(page, /createdAt: i\.timeCreated \|\| i\.createTime/);
});

test('instance tenant filter displays the tenant name while sending its database id', async () => {
  const page = await source('oci-server/src/main/resources/static/modern-ui/src/page-instances.jsx');
  const row = await source('oci-server/src/main/resources/static/modern-ui/src/tenant-row.js');
  const data = await source('oci-server/src/main/resources/static/modern-ui/src/data.jsx');
  assert.match(page, /value: getTenantDbId\(t\)/);
  assert.match(page, /instanceTenantDisplayName\(t\) \|\| getTenantDbId\(t\)/);
  assert.match(page, /tenantOptions\.find\(t => getTenantDbId\(t\) === String\(tenantFilter\)\)/);
  assert.match(page, /instanceTenantDisplayName\(t\)/);
  assert.match(page, /instanceTenantDisplayAlias\(selected\) \|\| instanceTenantDisplayName\(selected\)/);
  assert.match(page, /listParentTenants\(\)/);
  assert.match(page, /Array\.isArray\(tenantRows\)/);
  assert.match(row, /source\.idStr, source\.id, source\.tenantDbId/);
  assert.match(row, /source\.tenancyName \?\? source\.userName \?\? source\.name/);
  assert.match(data, /t\?\.idStr, t\?\.id, t\?\.tenantDbId/);
  assert.match(data, /t\?\.tenancyName, t\?\.userName, t\?\.name/);
});

test('instance tenant and region filters cascade through real child-tenant records', async () => {
  const page = await source('oci-server/src/main/resources/static/modern-ui/src/page-instances.jsx');
  const services = await source('oci-server/src/main/resources/static/modern-ui/src/services-tenant.js');

  assert.match(services, /S\.listRegions\s*=\s*mark\(function listRegions/);
  assert.match(services, /\/tenants\/listRegions/);
  assert.match(services, /parentId/);
  assert.match(page, /const \[regionOptions, setRegionOptions\]/);
  assert.match(page, /window\.ociServices\.tenant\.listRegions\(\{ parentId: tenantFilter \}\)/);
  assert.match(page, /options=\{regionOptions\.map/);
  assert.match(page, /disabled=\{!tenantFilter \|\| regionLoading \|\| regionOptions\.length === 0\}/);
  assert.match(page, /<Button variant="primary" size="md" icon="search" disabled=\{!regionFilter\}/);
  assert.match(page, /tenantId: regionFilter \|\| undefined/);
  assert.match(page, /if \(regionFilter && i\.tenantId !== regionFilter\) return false/);
  assert.doesNotMatch(page, /if \(regionFilter && i\.region !== regionFilter\) return false/);
  assert.doesNotMatch(page, /if \(!regionFilter && tenantFilter && i\.tenantId !== tenantFilter\)/);
  assert.doesNotMatch(page, /options=\{REGIONS\.map\(r => \(\{ value: r\.code/);
});

test('instance region dropdown enables original searchable behavior only for multiple regions', async () => {
  const page = await source('oci-server/src/main/resources/static/modern-ui/src/page-instances.jsx');
  const ui = await source('oci-server/src/main/resources/static/modern-ui/src/ui.jsx');
  assert.match(ui, /function Select\(\{.*searchable\s*=\s*false/);
  assert.match(ui, /searchable=\{searchable\}/);
  assert.match(ui, /String\(searchTerm \|\| ''\)\.trim\(\)\.toLowerCase\(\)/);
  assert.match(ui, /无匹配项/);
  assert.match(page, /searchable=\{regionOptions\.length > 1\}/);
});

test('instance filter summary stays fixed when no filters are selected', async () => {
  const page = await source('oci-server/src/main/resources/static/modern-ui/src/page-instances.jsx');

  // Keep the summary slot stable so the result area does not jump when a
  // tenant/region filter is added or cleared. Empty state is explicit and the
  // clear action cannot submit a no-op request.
  assert.doesNotMatch(page, /\{hasFilter\s*&&\s*\(/);
  assert.match(page, /!hasFilter\s*&&\s*\(/);
  assert.match(page, /<span className="mono">未选择<\/span>/);
  assert.match(page, /disabled=\{!hasFilter\}/);
});

test('instance tenant mapping cache versions track the field mapper changes', async () => {
  const index = await source('oci-server/src/main/resources/static/modern-ui/index.html');
  assert.match(index, /services-instance\.js\?v=4/);
  assert.match(index, /services-tenant\.js\?v=12/);
  assert.match(index, /ui\.js\?v=13/);
  assert.match(index, /tenant-row\.js\?v=9/);
  assert.match(index, /data\.js\?v=11/);
  assert.match(index, /page-tenant-resources\.js\?v=7/);
  assert.match(index, /page-instances\.js\?v=17/);
  assert.match(index, /instance-actions\.js\?v=24/);
});

test('instance detail does not fabricate metrics or resource identifiers', async () => {
  const actions = await source('oci-server/src/main/resources/static/modern-ui/src/instance-actions.jsx');
  assert.doesNotMatch(actions, /Math\.random\(\)/);
  assert.doesNotMatch(actions, /vcn-\$\{|ocid1\.vcn\.oc1\..*btoa/);
  assert.doesNotMatch(actions, /ocid1\.instance\.oc1\.\$\{inst\.region\}/);
  assert.doesNotMatch(actions, /2603:c020:\.\.\./);
  assert.doesNotMatch(actions, /预计 IOPS|预计吞吐|预计快照大小|0\.0255/);
  assert.match(actions, /inst\.ipv6Addresses/);
});

test('tenant resource actions use real export and preserve zero VPU values', async () => {
  const page = await source('oci-server/src/main/resources/static/modern-ui/src/page-tenant-resources.jsx');
  assert.match(page, /window\.ociServices\.instance\.export\(\)/);
  assert.doesNotMatch(page, /已导出 \$\{filtered\.length\} 个实例/);
  assert.doesNotMatch(page, /inst\.vpu \|\| 10/);
  assert.match(page, /inst\.vpu == null \|\| inst\.vpu === '' \? 0 : inst\.vpu/);
});

test('tenant resource region selection takes precedence over deep-link context', async () => {
  const page = await source('oci-server/src/main/resources/static/modern-ui/src/page-tenant-resources.jsx');
  const start = page.indexOf('const selectedRegion = useMemoTR');
  const end = page.indexOf('const loadInstances', start);
  assert.ok(start >= 0 && end > start, 'selected region block must exist');
  const block = page.slice(start, end);
  assert.ok(block.indexOf('getTenantRegion(row) === regionSel') < block.indexOf('row.id) === String(ctx?.regionTenantId'), 'region selector must be checked before deep-link id');
});

test('instance tenant masking never invents an unmasked name', async () => {
  const page = await source('oci-server/src/main/resources/static/modern-ui/src/page-instances.jsx');
  const resources = await source('oci-server/src/main/resources/static/modern-ui/src/page-tenant-resources.jsx');
  assert.doesNotMatch(page, /replace\('\\*\\*\\*',\s*'user'\)/);
  assert.doesNotMatch(resources, /replace\(\/\\\\\*\/g,\s*'a'\)/);
});

test('instance action menu preserves all original actions and separate identifiers', async () => {
  const page = await source('oci-server/src/main/resources/static/modern-ui/src/page-instances.jsx');
  const actions = await source('oci-server/src/main/resources/static/modern-ui/src/instance-actions.jsx');

  // The backend response has four different identifier meanings; never collapse
  // them into one fallback value at the UI boundary.
  assert.match(page, /id:\s*i\.id\b/);
  assert.match(page, /dbId:\s*i\.id\b/);
  assert.match(page, /instanceId:\s*i\.instanceId\b/);
  assert.match(page, /bootVolumeId:\s*i\.bootVolumeId\b/);
  assert.match(page, /tenantId:\s*String\(tenantDbId\s*\?\?\s*''\)/);

  // oci_machine_list.ftl includes VPU between disk and IPv4; the Modern menu
  // keeps it visible and uses TenantController's boot-volume DTO endpoint.
  assert.match(actions, /id:\s*'edit-vpu'/);
  assert.match(actions, /openUpdateVpuModal\(shell, inst\)/);
  assert.match(actions, /updateVpu\(/);
  assert.doesNotMatch(actions, /后端未提供调整 VPU 接口/);
  assert.match(actions, /inst\.vpu == null \|\| inst\.vpu === '' \? 0 : Number\(inst\.vpu\)/);
  // Unknown/transitional states must not gain an extra lifecycle action that
  // the original oci_machine_list.ftl does not render.
  assert.doesNotMatch(actions, /else\s*\{\s*items\.push\(\{ id: 'start'/);
});

test('instance VPU action does not rename the boot volume as a side effect', async () => {
  const actions = await source('oci-server/src/main/resources/static/modern-ui/src/instance-actions.jsx');

  // The original oci_machine_list.ftl VPU request sends only vpusPerGB,
  // tenantId and instanceDetailId. displayName is an optional DTO field but
  // passing the instance name here would rename the OCI boot volume.
  assert.match(actions, /updateVpu\(\{[\s\S]*bootVolumeId: String\(inst\.bootVolumeId\)/);
  assert.doesNotMatch(actions, /updateVpu\(\{[\s\S]*displayName: inst\.name/);
});

test('instance VPU control preserves the original 0-120 range and step 10', async () => {
  const actions = await source('oci-server/src/main/resources/static/modern-ui/src/instance-actions.jsx');
  const start = actions.indexOf('function openUpdateVpuModal');
  const end = actions.indexOf('// #6 切换 IPv4', start);
  assert.ok(start >= 0 && end > start, 'VPU modal source block must exist');
  const block = actions.slice(start, end);
  assert.match(block, /min=\{0\}\s+max=\{120\}\s+step=\{10\}/);
  assert.match(block, /步长 10/);
});

test('instance DD selection submits the original osType and osVersion values', async () => {
  const actions = await source('oci-server/src/main/resources/static/modern-ui/src/instance-actions.jsx');
  const start = actions.indexOf('function openQuickDDModal');
  const end = actions.indexOf('// #9 终止实例', start);
  assert.ok(start >= 0 && end > start, 'DD modal source block must exist');
  const block = actions.slice(start, end);
  assert.match(block, /value:\s*'ubuntu\|22\.04'/);
  assert.match(block, /const \[os, setOs\] = React\.useState\('ubuntu\|22\.04'\)/);
  assert.match(block, /const \[osType, osVersion\] = String\(os\)\.split\('\|'\)/);
  assert.match(block, /osType,\s*osVersion,\s*ddPassword/);
  assert.doesNotMatch(block, /String\(os\)\.match\(\/\^\(\.\*\?\)/);
});

test('instance boot-volume action does not submit an unchanged size', async () => {
  const actions = await source('oci-server/src/main/resources/static/modern-ui/src/instance-actions.jsx');

  // oci_machine_list.ftl disables the confirmation button when the requested
  // size equals the current size, avoiding a meaningless expansion request.
  const start = actions.indexOf('function openUpdateBootVolumeModal');
  const end = actions.indexOf('// #5 调整 VPU', start);
  assert.ok(start >= 0 && end > start, 'boot-volume modal source block must exist');
  const diskBlock = actions.slice(start, end);
  assert.match(diskBlock, /disabled=\{saving\s*\|\|\s*Number\(size\) === Number\(inst\.disk\)\}/);
  assert.doesNotMatch(actions.slice(0, start), /disabled=\{Number\(size\) === Number\(inst\.disk\)\}/);
});

test('instance termination keeps original confirmation then verification flow', async () => {
  const actions = await source('oci-server/src/main/resources/static/modern-ui/src/instance-actions.jsx');
  assert.match(actions, /const \[step, setStep\] = React\.useState\(1\)/);
  assert.match(actions, /setStep\(2\)/);
  assert.match(actions, /sendVerificationCode/);
  assert.match(actions, /terminate\(\{ instanceId: String\(inst\.dbId \?\? inst\.id\), verificationCode: code \}\)/);
  assert.doesNotMatch(actions, /preserveVol/);
});

test('instance SSH action exposes the real SSH websocket and SFTP endpoints', async () => {
  const actions = await source('oci-server/src/main/resources/static/modern-ui/src/instance-actions.jsx');
  assert.match(actions, /\/ws\/ssh/);
  assert.match(actions, /sftpUpload/);
  assert.match(actions, /sftpDownload/);
  assert.match(actions, /type:\s*'connect'/);
  assert.match(actions, /type:\s*'input'/);
  assert.match(actions, /SSH 配置加载失败/);
  assert.match(actions, /openSshTerminalModal\(shell, inst/);
});

test('instance SFTP controls require an established SSH connection', async () => {
  const actions = await source('oci-server/src/main/resources/static/modern-ui/src/instance-actions.jsx');
  const start = actions.indexOf('function SshTerminalModal');
  const end = actions.indexOf('function openSshTerminalModal', start);
  assert.ok(start >= 0 && end > start, 'SSH terminal source block must exist');
  const block = actions.slice(start, end);
  assert.match(block, /disabled=\{status !== 'connected' \|\| transfer === 'uploading'\}/);
  assert.match(block, /disabled=\{status !== 'connected' \|\| transfer === 'downloading'\}/);
});

test('instance SSH configuration can be entered when no saved backend config exists', async () => {
  const actions = await source('oci-server/src/main/resources/static/modern-ui/src/instance-actions.jsx');
  const start = actions.indexOf('function openSshConfigModal');
  const end = actions.indexOf('function useReinstallModal', start);
  assert.ok(start >= 0 && end > start, 'SSH config modal source block must exist');
  const block = actions.slice(start, end);
  assert.match(block, /SSH 配置加载失败/);
  assert.doesNotMatch(block, /if \(error\) return <div/);
  assert.match(block, /error &&/);
  assert.match(block, /saveSshConfig\(/);
});

test('instance SSH configuration requires a password before opening the backend websocket', async () => {
  const actions = await source('oci-server/src/main/resources/static/modern-ui/src/instance-actions.jsx');
  const start = actions.indexOf('function openSshConfigModal');
  const end = actions.indexOf('function useReinstallModal', start);
  assert.ok(start >= 0 && end > start, 'SSH config modal source block must exist');
  const block = actions.slice(start, end);
  assert.match(block, /FormRow label="密码" required/);
  assert.match(block, /disabled=\{saving \|\| !cfg\.username\.trim\(\) \|\| !cfg\.password\}/);
});

test('instance VNC action unwraps the backend output envelope and IPv6 management preserves DTO field', async () => {
  const actions = await source('oci-server/src/main/resources/static/modern-ui/src/instance-actions.jsx');
  // ConsoleWebSocketHandler sends progress frames as { type: 'output', data }.
  assert.match(actions, /if \(j\.type === 'output'\)/);
  assert.match(actions, /push\(j\.data == null \? '' : String\(j\.data\)\)/);
  assert.doesNotMatch(actions, /if \(j\.type === 'error' \|\| j\.message\)/);
  // InstanceDetailsRes exposes ipv6Addresses (plural); there is no ipv6Address getter.
  assert.match(actions, /Array\.isArray\(inst\.ipv6Addresses\) \? inst\.ipv6Addresses\.join\('\, '\) : \(inst\.ipv6Addresses \|\| '未分配'\)/);
  assert.doesNotMatch(actions, /inst\.ipv6Address\b/);
});

test('instance IP and IPv6 actions render backend success details', async () => {
  const actions = await source('oci-server/src/main/resources/static/modern-ui/src/instance-actions.jsx');
  const ipStart = actions.indexOf('function openChangeIpModal');
  const ipEnd = actions.indexOf('// #7 管理 IPv6', ipStart);
  assert.ok(ipStart >= 0 && ipEnd > ipStart, 'IPv4 modal source block must exist');
  const ipBlock = actions.slice(ipStart, ipEnd);
  assert.match(ipBlock, /details\.oldIp/);
  assert.match(ipBlock, /details\.newIp/);
  assert.match(ipBlock, /setResult/);

  const ipv6Start = actions.indexOf('function openManageIpv6Modal');
  const ipv6End = actions.indexOf('// #8 系统重置', ipv6Start);
  assert.ok(ipv6Start >= 0 && ipv6End > ipv6Start, 'IPv6 modal source block must exist');
  const ipv6Block = actions.slice(ipv6Start, ipv6End);
  assert.match(ipv6Block, /details\.ipv6Address/);
  assert.match(ipv6Block, /setResultAddress/);
});

test('SFTP download preserves backend Content-Disposition filename', async () => {
  const actions = await source('oci-server/src/main/resources/static/modern-ui/src/instance-actions.jsx');
  const services = await source('oci-server/src/main/resources/static/modern-ui/src/services-instance.js');
  assert.match(services, /S\.sftpDownloadResponse[\s\S]*responseType:\s*'raw'/);
  assert.match(actions, /Content-Disposition/);
  assert.match(actions, /serverName/);
});

test('VNIC IP switch renders backend old/new IP details', async () => {
  const actions = await source('oci-server/src/main/resources/static/modern-ui/src/instance-actions.jsx');
  const start = actions.indexOf('const openSwitchIpModal');
  const end = actions.indexOf('// ─── 子 modal:删除 VNIC', start);
  assert.ok(start >= 0 && end > start, 'VNIC IP switch modal source block must exist');
  const block = actions.slice(start, end);
  assert.match(block, /outcome\.details\.oldIp/);
  assert.match(block, /outcome\.details\.newIp/);
  assert.match(block, /vnicChangeSpecIp\(\{[\s\S]*instanceId: String\(inst\.instanceId/);
  assert.match(block, /cidrRanges: cidrs\.map\(value => String\(value \|\| ''\)\.trim\(\)\)\.filter\(Boolean\)/);
});

test('VNIC status and row actions preserve original enum and conditional identifiers', async () => {
  const actions = await source('oci-server/src/main/resources/static/modern-ui/src/instance-actions.jsx');
  assert.match(actions, /ATTACHED:\s*\{/);
  assert.match(actions, /DETACHED:\s*\{/);
  assert.match(actions, /if \(v\.subnetId\) items\.push\(\{ id: 'copy-subnet'/);
  assert.match(actions, /if \(v\.vnicId\) items\.push\(\{ id: 'copy-vnic'/);
});

test('VNIC overview and public-IP copy controls are conditional and report clipboard errors', async () => {
  const actions = await source('oci-server/src/main/resources/static/modern-ui/src/instance-actions.jsx');
  const start = actions.indexOf('function openNetworkManageModal');
  const end = actions.indexOf('function openQuickDDModal', start);
  assert.ok(start >= 0 && end > start, 'network modal source block must exist');
  const block = actions.slice(start, end);
  assert.match(block, /navigator\.clipboard\.writeText\(text\)\s*\.then/);
  assert.match(block, /复制失败/);
  assert.match(block, /\{vcnId &&/);
  assert.match(block, /\{subnetId &&/);
  assert.match(block, /disabled=\{!v\.publicIp\}/);
});

test('instance VNC handshake preserves the original connection type and lifecycle messages', async () => {
  const actions = await source('oci-server/src/main/resources/static/modern-ui/src/instance-actions.jsx');
  assert.match(actions, /connectionType:\s*'vnc'/);
  assert.match(actions, /const instanceDetailsId = inst\.dbId \?\? inst\.id/);
  assert.match(actions, /instanceId: String\(instanceDetailsId\)/);
  assert.match(actions, /缺少实例数据库 ID，无法建立 VNC 连接/);
  assert.match(actions, /缺少租户数据库 ID，无法建立 VNC 连接/);
  assert.doesNotMatch(actions, /instanceId: String\(inst\.dbId \?\? inst\.instanceId \?\? inst\.id/);
  assert.match(actions, /if \(!readyUrl && !readyPort\)/);
  assert.match(actions, /VNC 代理启动失败，无法建立画面连接/);
  assert.match(actions, /type:\s*'heartbeat'/);
  assert.match(actions, /type:\s*'heartbeat_response'/);
  assert.match(actions, /type:\s*'disconnect'/);
  assert.match(actions, /clearInterval\(heartbeatRef\.current\)/);
});

test('VNC URL construction matches the original HTTP direct-port and HTTPS proxy branches', async () => {
  const entry = await source('oci-server/src/main/resources/static/modern-ui/vendor/novnc/entry.mjs');
  // console_terminal.ftl uses ws://host:port/ for HTTP and /websockify/{port}
  // only when the page is HTTPS.  An unconditional proxy path breaks the
  // method-1 HTTP deployment because Spring is not listening on that route.
  assert.match(entry, /window\.location\.protocol\s*===\s*['"]https:['"]/);
  assert.match(entry, /host\.split\(['"]:\\?['"]\)\[0\]/);
  assert.match(entry, /:\$\{port\}\\?\//);
  assert.match(entry, /\/websockify\/\$\{port\}/);
});

test('instance IPv6 management does not expose unsupported release or reallocate actions', async () => {
  const actions = await source('oci-server/src/main/resources/static/modern-ui/src/instance-actions.jsx');
  const start = actions.indexOf('function openManageIpv6Modal');
  const end = actions.indexOf('// #8 系统重置', start);
  assert.ok(start >= 0 && end > start, 'IPv6 modal source block must exist');
  const block = actions.slice(start, end);
  assert.doesNotMatch(block, /重新分配/);
  assert.doesNotMatch(block, /释放IPv6/);
  assert.doesNotMatch(block, /后端未提供释放 IPv6 接口/);
});

test('instance detail does not offer an executable restart action without a backend endpoint', async () => {
  const actions = await source('oci-server/src/main/resources/static/modern-ui/src/instance-actions.jsx');
  assert.match(actions, /disabled\s+title="后端未提供独立重启接口"/);
  assert.doesNotMatch(actions, /onClick=\{\(\) => shell\.showToast\('后端未提供独立重启接口/);
});

test('shared Button honors loading state for real instance operations', async () => {
  const ui = await source('oci-server/src/main/resources/static/modern-ui/src/ui.jsx');
  assert.match(ui, /disabled=\{disabled \|\| loading\}/);
  assert.match(ui, /loading = false/);
  assert.match(ui, /name="loader"/);
  assert.match(ui, /button-spin/);
});

test('instance mutation dialogs lock their real requests while saving', async () => {
  const actions = await source('oci-server/src/main/resources/static/modern-ui/src/instance-actions.jsx');
  for (const [name, marker] of [
    ['remark', 'function openUpdateRemarkModal'],
    ['name', 'function openUpdateNameModal'],
    ['config', 'function openUpdateConfigModal'],
    ['boot volume', 'function openUpdateBootVolumeModal'],
    ['VPU', 'function openUpdateVpuModal'],
  ]) {
    const start = actions.indexOf(marker);
    assert.ok(start >= 0, `${name} modal must exist`);
    const end = actions.indexOf('\nfunction ', start + marker.length);
    const block = actions.slice(start, end > start ? end : undefined);
    assert.match(block, /useState\(false\)/, `${name} modal must track saving state`);
    assert.match(block, /loading=\{saving\}/, `${name} submit must show loading state`);
    assert.match(block, /disabled=\{saving(?:\s*\|\|[^}]*)?\}/, `${name} submit must disable while saving`);
  }
});

test('instance export preserves the original sensitive-data confirmation flow', async () => {
  const page = await source('oci-server/src/main/resources/static/modern-ui/src/page-instances.jsx');
  const services = await source('oci-server/src/main/resources/static/modern-ui/src/services-instance.js');

  // The original oci_machine_list.ftl warns that /oci/export contains every
  // tenant's plaintext root password and only downloads after confirmation.
  assert.match(page, /shell\.openConfirm\(/);
  assert.match(page, /明文密码/);
  assert.match(page, /ociServices\.instance\.export\(/);
  assert.doesNotMatch(page, /ociApi\.request\('\/oci\/export'/);
  assert.match(services, /S\.export = mark\(/);
});

test('data loading uses effects rather than state initializers', async () => {
  const tenants = await source('oci-server/src/main/resources/static/modern-ui/src/page-tenants.jsx');
  const instances = await source('oci-server/src/main/resources/static/modern-ui/src/page-instances.jsx');
  const regions = await source('oci-server/src/main/resources/static/modern-ui/src/page-regions.jsx');

  assert.doesNotMatch(tenants, /useStateT\(\(\)\s*=>\s*\{\s*loadTenants\(\)/);
  assert.doesNotMatch(instances, /useStateIn\(\(\)\s*=>\s*\{\s*let alive/);
  assert.doesNotMatch(regions, /useStateR\(\(\)\s*=>\s*\{\s*let alive/);
});

test('authentication state is derived from the backend session', async () => {
  const app = await source('oci-server/src/main/resources/static/modern-ui/src/app.jsx');

  assert.match(app, /['"]\/api\/userInfo['"]/);
  assert.match(app, /ocip:unauthorized/);
  assert.doesNotMatch(app, /localStorage\.getItem\(['"]ocip-authed['"]\)/);
  assert.doesNotMatch(app, /localStorage\.setItem\(['"]ocip-authed['"]/);
  assert.doesNotMatch(app, /window\.fetch\s*=/);
});

test('boot task actions use the database id and backend-owned fields', async () => {
  const page = await source('oci-server/src/main/resources/static/modern-ui/src/page-grab.jsx');

  assert.doesNotMatch(page, /useStateG\(GRAB_TASKS\)/);
  assert.match(page, /ociServices\.boot\.fullBootList\(/);
  assert.match(page, /page:\s*page - 1/);
  assert.match(page, /size:\s*perPage/);
  assert.match(page, /tenantId:\s*tenantFilter \|\| undefined/);
  assert.doesNotMatch(page, /getPage\('\/boot\/fullBootList\/json', \{ page: 0, size: 500/);
  assert.match(page, /id:\s*b\.id\b/);
  assert.match(page, /defName:\s*b\.defName\b/);
  assert.match(page, /openBootFlag:\s*b\.openBootFlag\b/);
  assert.match(page, /ociServices\.boot\.startBoot\(\{ bootId: task\.id \}\)/);
  assert.match(page, /ociServices\.boot\.stopBoot\(\{ bootId: task\.id \}\)/);
  assert.match(page, /ociServices\.boot\.deleteBoot\(\{ bootId: task\.id \}\)/);
  assert.doesNotMatch(page, /catch\s*\([^)]*\)\s*\{\s*\}/);
});

test('boot task edit, clone and one-shot actions use real service requests', async () => {
  const actions = await source('oci-server/src/main/resources/static/modern-ui/src/grab-actions.jsx');
  const services = await source('oci-server/src/main/resources/static/modern-ui/src/services-boot.js');
  assert.match(actions, /ociServices\.boot\.updateBoot\(/);
  assert.match(actions, /ociServices\.boot\.startCloneBoot\(/);
  assert.match(actions, /ociServices\.boot\.manualBoot\(/);
  const oneShot = actions.slice(actions.indexOf('function useGrabOneShotModal()'), actions.indexOf('function PhaseLine'));
  assert.doesNotMatch(oneShot, /Math\.random\(\)/);
  assert.doesNotMatch(oneShot, /Simulated single-shot/);
  assert.match(services, /S\.startCloneBoot\s*=\s*mark\(/);
  assert.match(services, /S\.manualBoot\s*=\s*mark\(/);
  assert.match(services, /S\.updateBoot\s*=\s*mark\(/);
  assert.match(services, /body: JSON\.stringify\(\{[\s\S]*loopTime: o\.loopTime[\s\S]*rootPassword: o\.rootPassword[\s\S]*dayGap: o\.dayGap/);
});

test('boot creation uses the tenant service and exact BootInstance fields', async () => {
  const actions = await source('oci-server/src/main/resources/static/modern-ui/src/tenant-actions.jsx');
  const services = await source('oci-server/src/main/resources/static/modern-ui/src/services-tenant.js');
  assert.match(actions, /ociServices\.tenant\.bootSave\(\{[\s\S]*tenantId: state\.tenantId[\s\S]*instanceCount: state\.instanceCount[\s\S]*rootPassword: state\.rootPassword/);
  assert.doesNotMatch(actions, /fetch\(['"]\/tenants\/boot\/save/);
  assert.match(services, /S\.bootSave\s*=\s*mark\(function bootSave\(input\)/);
  assert.match(services, /instanceCount: o\.instanceCount/);
  assert.match(services, /operatingSystemVersion: o\.operatingSystemVersion/);
  assert.match(services, /rootPassword: o\.rootPassword/);
});

test('monitor does not present polling snapshots as historical trend data', async () => {
  const page = await source('oci-server/src/main/resources/static/modern-ui/src/page-monitor.jsx');
  assert.doesNotMatch(page, /attemptHistory|successHistory|setAttemptHistory|setSuccessHistory/);
  assert.match(page, /data=\{\[\]\}/);
  assert.match(page, /后端当前仅提供累计统计，未提供历史趋势接口/);
  assert.match(page, /N\/A（后端未提供）/);
  assert.doesNotMatch(page, /\/ · ext4/);
  assert.doesNotMatch(page, /s\.system\.machineId/);
});

test('region monitor uses the original ARM region endpoints', async () => {
  const page = await source('oci-server/src/main/resources/static/modern-ui/src/page-regions.jsx');

  assert.doesNotMatch(page, /useStateR\(REGIONS\)/);
  assert.match(page, /['"]\/resource\/arm-data['"]/);
  assert.match(page, /['"]\/resource\/my-regions['"]/);
  assert.match(page, /armRecords/);
  assert.match(page, /regionMap/);
  assert.match(page, /monthlyOpenCount/);
  assert.doesNotMatch(page, /TENANTS\.map|INSTANCES\.map/);
});

test('region monitor sorts by most-recent boot time descending with unknown last', async () => {
  const page = await source('oci-server/src/main/resources/static/modern-ui/src/page-regions.jsx');

  // The filtered memo must sort after filtering, treating unknown lastAt last.
  assert.match(page, /return \[\.\.\.list\]\.sort/);
  assert.match(page, /r\.lastAt === '—'/);
  assert.match(page, /-Infinity/);
  assert.match(page, /Date\.parse\(r\.lastAt\)/);
});

test('tenant detail loads regions, instances and boot tasks from scoped endpoints', async () => {
  const page = await source('oci-server/src/main/resources/static/modern-ui/src/page-tenant-detail.jsx');

  assert.match(page, /\/tenants\/regionList\/json/);
  assert.match(page, /['"]\/oci\/list\/json['"]/);
  assert.match(page, /['"]\/boot\/fullBootList\/json['"]/);
  assert.match(page, /\/tenants\/syncOci\?tenantId=/);
  assert.doesNotMatch(page, /TENANTS\.find/);
  assert.doesNotMatch(page, /INSTANCES\.filter/);
  assert.doesNotMatch(page, /GRAB_TASKS\.filter/);
  assert.doesNotMatch(page, /ap-tokyo-1|ap-singapore-1/);
});

test('tenant child pages use the shared tenant-row mapper', async () => {
  for (const name of ['page-tenant-detail.jsx', 'page-tenant-grab.jsx', 'page-tenant-resources.jsx']) {
    const page = await source(`oci-server/src/main/resources/static/modern-ui/src/${name}`);
    assert.match(page, /window\.ociTenantRow\.normalize\(row/);
    assert.doesNotMatch(page, /\bnormalizeTenantRow\(/);
    assert.doesNotMatch(page, /tenant\.name\.replace/);
  }
});

test('tenant detail renders status, region count, type and cost from backend fields', async () => {
  const page = await source('oci-server/src/main/resources/static/modern-ui/src/page-tenant-detail.jsx');

  assert.match(page, /tenant\._ui\.status/);
  assert.match(page, /tenant\._ui\.hasChildren/);
  assert.match(page, /tenant\.accountTypeName/);
  assert.match(page, /tenant\.accountCost \?\? tenant\.cost \?\? 0/);
  assert.doesNotMatch(page, /tenant\.multiRegion/);
  assert.doesNotMatch(page, /tenant\.status\b/);
});

test('tenant detail sync badge reflects Tenant.apiSynced instead of defaulting to synced', async () => {
  const page = await source('oci-server/src/main/resources/static/modern-ui/src/page-tenant-detail.jsx');

  assert.match(page, /row\.apiSynced === true/);
  assert.doesNotMatch(page, /row\.syncStatus \|\| ['"]synced['"]/);
});

test('tenant boot page loads scoped backend tasks without placeholders', async () => {
  const page = await source('oci-server/src/main/resources/static/modern-ui/src/page-tenant-grab.jsx');

  assert.match(page, /\/tenants\/regionList\/json/);
  assert.match(page, /['"]\/boot\/fullBootList\/json['"]/);
  assert.match(page, /['"]\/boot\/stopBoot['"]/);
  assert.match(page, /['"]\/boot\/startBoot['"]/);
  assert.match(page, /['"]\/boot\/deleteBoot['"]/);
  assert.match(page, /\?bootId=\$\{encodeURIComponent\(task\.id\)\}/);
  assert.doesNotMatch(page, /TENANTS\.find|GRAB_TASKS\.filter/);
  assert.doesNotMatch(page, /ap-tokyo-1|ap-singapore-1/);
  assert.doesNotMatch(page, /简单占位/);
});

test('tenant resource page loads scoped backend instances', async () => {
  const page = await source('oci-server/src/main/resources/static/modern-ui/src/page-tenant-resources.jsx');

  assert.match(page, /\/tenants\/regionList\/json/);
  assert.match(page, /['"]\/oci\/list\/json['"]/);
  assert.doesNotMatch(page, /TENANTS\.find|INSTANCES\.filter/);
  assert.doesNotMatch(page, /ap-tokyo-1|ap-singapore-1/);
});

test('boot logs use history and SSE instead of bundled log fixtures', async () => {
  const page = await source('oci-server/src/main/resources/static/modern-ui/src/page-logs.jsx');

  assert.doesNotMatch(page, /useStateLg\(GRAB_LOGS\)/);
  assert.match(page, /['"]\/system\/openLogs\/json['"]/);
  assert.match(page, /new EventSource\(['"]\/system\/streamLogs\?isBootLog=true['"]\)/);
  assert.doesNotMatch(page, /TENANTS\.map/);
  assert.doesNotMatch(page, /catch\s*\([^)]*\)\s*\{\s*\}/);
});

test('monitor uses backend metrics without bundled charts or state-effect misuse', async () => {
  const page = await source('oci-server/src/main/resources/static/modern-ui/src/page-monitor.jsx');

  assert.doesNotMatch(page, /useStateM\(SYSTEM\)/);
  assert.doesNotMatch(page, /useStateM\(\(\)\s*=>\s*\{/);
  assert.match(page, /['"]\/boot\/dashboard-stats['"]/);
  assert.match(page, /['"]\/boot\/stats['"]/);
  assert.match(page, /['"]\/system\/openLogs\/json['"]/);
  assert.doesNotMatch(page, /GRAB_RATE|SUCCESS_TIMELINE|GRAB_LOGS/);
});
