// noVNC ESM 入口:把 RFB(与 url 构建器)暴露到 window,供 Babel JSX 组件使用。
// 本文件按 ES module 加载(<script type="module">),noVNC 的 core/* 与 vendor/pako 均为纯相对导入,
// 由浏览器原生解析;无需 bundler。加载完成后设置 window.OCiVnc,未就绪前组件轮询等待。
import RFB from './core/rfb.js';

// 构造浏览器能连到的 websockify URL：HTTP 直连动态端口，HTTPS 走
// Nginx 反代 /websockify/{port}。这与原 console_terminal.ftl 完全一致。
function buildVncUrl(info) {
  const port = info && (info.websockifyPort || (info.raw && info.raw.websockifyPort));
  if (port) {
    if (window.location.protocol === 'https:') {
      return `wss://${window.location.host}/websockify/${port}`;
    }
    const host = window.location.host.split(':')[0];
    return `ws://${host}:${port}/`;
  }
  return (info && info.vncUrl) || '';
}

window.OCiVnc = {
  RFB,
  buildVncUrl,
  ready: true,
};
