// Instance / OCI request constructors.
(function installOciInstanceServices(global) {
  'use strict';
  const api = global.ociApi;
  const contracts = global.ociContracts;
  const S = {};

  function mark(fn, method, path, encoding) { fn.endpoint = { method: method, path: path, encoding: encoding }; return fn; }
  function jsonBody(obj) {
    return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
  }
  function formBody(params) {
    const usp = new URLSearchParams();
    for (const k in params || {}) { const v = params[k]; if (v !== undefined && v !== null && v !== '') usp.set(k, String(v)); }
    return usp;
  }

  S.list = mark(function list(input) {
    const o = input || {};
    return api.getPage('/oci/list/json', { size: o.size, page: o.page, tenantId: o.tenantId });
  }, 'GET', '/oci/list/json', 'query-string');

  S.quickDD2 = mark(function quickDD2(input) {
    const o = input || {};
    return api.request('/oci/instance/quickDD2', jsonBody({
      instanceId: contracts.id(o.instanceId, 'instanceId'),
      osType: contracts.id(o.osType, 'osType'),
      // Some supported images (Kali/Arch/etc.) intentionally have an empty
      // version; the backend DTO still requires the field name, so preserve
      // an explicit empty string while rejecting an omitted value.
      osVersion: o.osVersion == null ? '' : String(o.osVersion),
      ddPassword: contracts.id(o.ddPassword, 'ddPassword'),
    }));
  }, 'POST', '/oci/instance/quickDD2', 'application/json');

  S.sysImageBackUp = mark(function sysImageBackUp(input) {
    const o = input || {};
    return api.request('/oci/sysImageBackUp', jsonBody({
      instanceId: contracts.id(o.instanceId, 'instanceId'),
      tenantId: contracts.id(o.tenantId, 'tenantId'),
      compartmentId: o.compartmentId,
    }));
  }, 'POST', '/oci/sysImageBackUp', 'application/json');

  S.stop = mark(function stop(input) {
    const o = input || {};
    return api.request('/oci/stopInstance', jsonBody({ instanceId: contracts.id(o.instanceId, 'instanceId') }));
  }, 'POST', '/oci/stopInstance', 'application/json');

  S.updateRemark = mark(function updateRemark(input) {
    const o = input || {};
    return api.request('/oci/updateRemark', jsonBody({
      instanceId: contracts.id(o.instanceId, 'instanceId'),
      remark: o.remark == null ? '' : String(o.remark),
    }));
  }, 'POST', '/oci/updateRemark', 'application/json');

  S.updateName = mark(function updateName(input) {
    const o = input || {};
    return api.request('/oci/updateName', jsonBody({
      instanceId: contracts.id(o.instanceId, 'instanceId'),
      newName: String(o.newName == null ? '' : o.newName),
    }));
  }, 'POST', '/oci/updateName', 'application/json');

  S.updateConfig = mark(function updateConfig(input) {
    const o = input || {};
    return api.request('/oci/updateConfig', jsonBody({
      instanceId: contracts.id(o.instanceId, 'instanceId'),
      cpu: Number(o.cpu),
      memory: Number(o.memory),
    }));
  }, 'POST', '/oci/updateConfig', 'application/json');

  S.updateBootVolume = mark(function updateBootVolume(input) {
    const o = input || {};
    return api.request('/oci/updateBootVolume', jsonBody({
      instanceId: contracts.id(o.instanceId, 'instanceId'),
      bootVolumeSize: Number(o.bootVolumeSize),
      expand: Boolean(o.expand),
    }));
  }, 'POST', '/oci/updateBootVolume', 'application/json');

  // 引导卷 VPU/名称由 TenantController 的 boot-volume DTO 处理。
  S.updateVpu = mark(function updateVpu(input) {
    const o = input || {};
    const bootVolumeId = contracts.id(o.bootVolumeId, 'bootVolumeId');
    return api.request('/tenants/update-volumes/' + encodeURIComponent(bootVolumeId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vpusPerGB: Number(o.vpusPerGB),
        tenantId: contracts.id(o.tenantId, 'tenantId'),
        displayName: o.displayName == null ? undefined : String(o.displayName),
        instanceDetailId: o.instanceDetailId == null ? undefined : Number(o.instanceDetailId),
      }),
    });
  }, 'PUT', '/tenants/update-volumes/{param}', 'application/json');

  // 原项目 changeSpecIp 使用 IpSwitchRequest：tenantId 字段实际承载实例数据库主键。
  // DTO 中 instanceId 为 Long，但原页面并不发送该字段；不要把 OCI
  // instance OCID 写入它，否则 Jackson 会在 Controller 前触发类型转换失败。
  S.changeSpecIp = mark(function changeSpecIp(input) {
    const o = input || {};
    return api.request('/oci/changeSpecIp', jsonBody({
      tenantId: contracts.id(o.tenantId, 'tenantId'),
      cidrRanges: Array.isArray(o.cidrRanges) ? o.cidrRanges : [],
    }));
  }, 'POST', '/oci/changeSpecIp', 'application/json');

  S.enableIpv6 = mark(function enableIpv6(input) {
    const o = input || {};
    return api.request('/oci/enableIpv6', jsonBody({
      tenantId: contracts.id(o.tenantId, 'tenantId'),
    }));
  }, 'POST', '/oci/enableIpv6', 'application/json');

  S.sendVerificationCode = mark(function sendVerificationCode(input) {
    const o = input || {};
    return api.request('/oci/sendVerificationCode', jsonBody({
      instanceId: contracts.id(o.instanceId, 'instanceId'),
    }));
  }, 'POST', '/oci/sendVerificationCode', 'application/json');

  S.vnicLoadData = mark(function vnicLoadData(input) {
    const o = input || {};
    return api.request('/oci/vnic/loadData?instanceId=' + encodeURIComponent(contracts.id(o.instanceId, 'instanceId')));
  }, 'GET', '/oci/vnic/loadData', 'query-string');
  S.vnicRefresh = mark(function vnicRefresh(input) {
    const o = input || {};
    return api.request('/oci/vnic/refresh?instanceId=' + encodeURIComponent(contracts.id(o.instanceId, 'instanceId')));
  }, 'GET', '/oci/vnic/refresh', 'query-string');
  S.vnicCreate = mark(function vnicCreate(input) {
    const o = input || {};
    return api.request('/oci/vnic/create', jsonBody({
      instanceId: contracts.id(o.instanceId, 'instanceId'), subnetId: o.subnetId,
      vnicCount: Number(o.vnicCount), ipv6CountPerVnic: Number(o.ipv6CountPerVnic),
    }));
  }, 'POST', '/oci/vnic/create', 'application/json');
  S.vnicDelete = mark(function vnicDelete(input) {
    const o = input || {};
    return api.request('/oci/vnic/delete', jsonBody({ instanceId: contracts.id(o.instanceId, 'instanceId'), vnicId: o.vnicId }));
  }, 'POST', '/oci/vnic/delete', 'application/json');
  S.vnicCreateIpv6 = mark(function vnicCreateIpv6(input) {
    const o = input || {};
    return api.request('/oci/vnic/createIpv6', jsonBody({ instanceId: contracts.id(o.instanceId, 'instanceId'), vnicId: o.vnicId, ipv6Count: Number(o.ipv6Count) }));
  }, 'POST', '/oci/vnic/createIpv6', 'application/json');
  S.vnicDeleteIpv6 = mark(function vnicDeleteIpv6(input) {
    const o = input || {};
    return api.request('/oci/vnic/deleteIpv6', jsonBody({ instanceId: contracts.id(o.instanceId, 'instanceId'), vnicId: o.vnicId, ipv6Address: o.ipv6Address }));
  }, 'POST', '/oci/vnic/deleteIpv6', 'application/json');
  S.vnicDeleteAllSecondary = mark(function vnicDeleteAllSecondary(input) {
    const o = input || {};
    return api.request('/oci/vnic/deleteAllSecondary', jsonBody({ instanceId: contracts.id(o.instanceId, 'instanceId') }));
  }, 'POST', '/oci/vnic/deleteAllSecondary', 'application/json');
  S.vnicChangeSpecIp = mark(function vnicChangeSpecIp(input) {
    const o = input || {};
    return api.request('/oci/vnic/changeSpecIp', jsonBody({
      instanceId: contracts.id(o.instanceId, 'instanceId'), vnicId: o.vnicId,
      cidrRanges: Array.isArray(o.cidrRanges) ? o.cidrRanges : [], preferredIp: o.preferredIp == null ? null : o.preferredIp,
    }));
  }, 'POST', '/oci/vnic/changeSpecIp', 'application/json');
  S.vnicConfigureLoadBalancer = mark(function vnicConfigureLoadBalancer(input) {
    const o = input || {};
    return api.request('/oci/vnic/network/configureLoadBalancer', jsonBody({ instanceId: contracts.id(o.instanceId, 'instanceId') }));
  }, 'POST', '/oci/vnic/network/configureLoadBalancer', 'application/json');
  S.vnicRestoreNetwork = mark(function vnicRestoreNetwork(input) {
    const o = input || {};
    return api.request('/oci/vnic/network/restoreNetwork', jsonBody({ instanceId: contracts.id(o.instanceId, 'instanceId') }));
  }, 'POST', '/oci/vnic/network/restoreNetwork', 'application/json');

  S.getSshConfig = mark(function getSshConfig(input) {
    const o = input || {};
    return api.request('/oci/ssh/config/' + encodeURIComponent(contracts.id(o.instanceId, 'instanceId')));
  }, 'GET', '/oci/ssh/config/{param}', 'query-string');
  S.saveSshConfig = mark(function saveSshConfig(input) {
    const o = input || {};
    const port = contracts.id(o.port, 'port');
    return api.request('/oci/ssh/config', jsonBody({
      instanceId: contracts.id(o.instanceId, 'instanceId'),
      username: contracts.id(o.username, 'username'),
      port,
      password: contracts.id(o.password, 'password'),
    }));
  }, 'POST', '/oci/ssh/config', 'application/json');

  // SSH 终端的文件传输接口与原 ssh_terminal.ftl 保持完全一致。
  S.sftpUpload = mark(function sftpUpload(input) {
    const o = input || {};
    const host = contracts.id(o.host, 'host');
    const port = contracts.id(o.port, 'port');
    const username = contracts.id(o.username, 'username');
    const password = contracts.id(o.password, 'password');
    const remotePath = contracts.id(o.remotePath, 'remotePath');
    if (!o.file) throw new Error('缺少file');
    const fd = new FormData();
    fd.set('host', host);
    fd.set('port', port);
    fd.set('username', username);
    fd.set('password', password);
    fd.set('remotePath', remotePath);
    fd.set('file', o.file);
    return api.request('/oci/sftp/upload', { method: 'POST', body: fd });
  }, 'POST', '/oci/sftp/upload', 'multipart/form-data');

  S.sftpDownload = mark(function sftpDownload(input) {
    const o = input || {};
    const host = contracts.id(o.host, 'host');
    const port = contracts.id(o.port, 'port');
    const username = contracts.id(o.username, 'username');
    const password = contracts.id(o.password, 'password');
    const remotePath = contracts.id(o.remotePath, 'remotePath');
    return api.request('/oci/sftp/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host, port: Number(port), username,
        password, remotePath,
      }),
      responseType: 'blob',
    });
  }, 'POST', '/oci/sftp/download', 'application/json');

  // 需要保留 Content-Disposition 文件名时，调用方使用 raw 版本读取响应头，
  // 再将响应体转换为 Blob；普通调用继续由 sftpDownload 返回 Blob。
  S.sftpDownloadResponse = mark(function sftpDownloadResponse(input) {
    const o = input || {};
    const host = contracts.id(o.host, 'host');
    const port = contracts.id(o.port, 'port');
    const username = contracts.id(o.username, 'username');
    const password = contracts.id(o.password, 'password');
    const remotePath = contracts.id(o.remotePath, 'remotePath');
    return api.request('/oci/sftp/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host, port: Number(port), username,
        password, remotePath,
      }),
      responseType: 'raw',
    });
  }, 'POST', '/oci/sftp/download', 'application/json');

  S.start = mark(function start(input) {
    const o = input || {};
    return api.request('/oci/startInstance', jsonBody({ instanceId: contracts.id(o.instanceId, 'instanceId') }));
  }, 'POST', '/oci/startInstance', 'application/json');

  S.deleteRecord = mark(function deleteRecord(input) {
    const o = input || {};
    return api.request('/oci/deleteInstanceRecord', jsonBody({ id: contracts.id(o.id, 'id') }));
  }, 'POST', '/oci/deleteInstanceRecord', 'application/json');

  S.terminate = mark(function terminate(input) {
    const o = input || {};
    return api.request('/oci/terminateInstance', jsonBody({
      instanceId: contracts.id(o.instanceId, 'instanceId'),
      verificationCode: contracts.id(o.verificationCode, 'verificationCode'),
    }));
  }, 'POST', '/oci/terminateInstance', 'application/json');

  S.export = mark(function exportInstances() {
    // OciController.exportInstances returns a text/plain attachment. Preserve
    // it as a Blob so the browser can download the response without attempting
    // JSON decoding.
    return api.request('/oci/export', { responseType: 'blob' });
  }, 'GET', '/oci/export', 'query-string');

  // Object storage (OCI)
  S.createBucket = mark(function createBucket(input) {
    const o = input || {};
    return api.request('/oci/storage/bucket/create', jsonBody({
      tenantId: contracts.id(o.tenantId, 'tenantId'),
      bucketName: o.bucketName, publicAccessType: o.publicAccessType,
    }));
  }, 'POST', '/oci/storage/bucket/create', 'application/json');

  S.presignObject = mark(function presignObject(input) {
    const o = input || {};
    return api.request('/oci/storage/object/presigned', jsonBody({
      tenantId: contracts.id(o.tenantId, 'tenantId'),
      namespace: o.namespace, bucketName: o.bucketName, objectName: o.objectName, validitySeconds: o.validitySeconds,
    }));
  }, 'POST', '/oci/storage/object/presigned', 'application/json');

  S.deleteBucket = mark(function deleteBucket(input) {
    const o = input || {};
    return api.request('/oci/storage/bucket/delete', jsonBody({
      tenantId: contracts.id(o.tenantId, 'tenantId'), namespace: o.namespace, bucketName: o.bucketName,
    }));
  }, 'POST', '/oci/storage/bucket/delete', 'application/json');

  S.uploadObject = mark(function uploadObject(input) {
    const o = input || {};
    const fd = new FormData();
    fd.set('tenantId', contracts.id(o.tenantId, 'tenantId'));
    fd.set('namespace', o.namespace || '');
    fd.set('bucketName', o.bucketName || '');
    fd.set('objectName', o.objectName || '');
    if (o.file) fd.set('file', o.file);
    return api.request('/oci/storage/object/upload', { method: 'POST', body: fd });
  }, 'POST', '/oci/storage/object/upload', 'multipart/form-data');

  S.deleteObject = mark(function deleteObject(input) {
    const o = input || {};
    return api.request('/oci/storage/object/delete', jsonBody({
      tenantId: contracts.id(o.tenantId, 'tenantId'),
      namespace: o.namespace, bucketName: o.bucketName, objectName: o.objectName,
    }));
  }, 'POST', '/oci/storage/object/delete', 'application/json');

  global.ociServices = global.ociServices || {};
  global.ociServices.instance = Object.freeze(S);
})(typeof window !== 'undefined' ? window : globalThis);
