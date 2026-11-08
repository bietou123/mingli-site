/* app/main.js —— 玄机阁 SPA 路由（hash 路由 + 懒加载页面模块） */
const routes = {
  home: () => import('./home.js'),
  bazi: () => import('./bazi.js'),
  liuyao: () => import('./liuyao.js'),
  ziwei: () => import('./ziwei.js'),
  profiles: () => import('./profiles.js'),
};

const TITLES = { home: '首页', bazi: '八字排盘', liuyao: '六爻起卦', ziwei: '紫微斗数', profiles: '我的档案' };

/* 分享参数：hash 形如 #/bazi?t=1990-01-01T08:00&g=男&l=120&n=命主&true=1 */
const _rawHash = (location.hash.replace(/^#\/?/, '') || 'home').trim();
const _qIdx = _rawHash.indexOf('?');
window.__shareParams = new URLSearchParams(_qIdx >= 0 ? _rawHash.slice(_qIdx + 1) : '');

async function render() {
  const rawHash = (location.hash.replace(/^#\/?/, '') || 'home').trim();
  const qIdx = rawHash.indexOf('?');
  const route = (qIdx >= 0 ? rawHash.slice(0, qIdx) : rawHash).trim();
  const loader = routes[route] || routes.home;
  const view = document.getElementById('view');
  try {
    const mod = await loader();
    view.innerHTML = mod.template;
    document.title = `${TITLES[route] || '命理推演'} · 玄机阁`;
    if (typeof mod.mounted === 'function') mod.mounted(view);
    view.querySelectorAll('.fade-in').forEach((el) => {
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';
    });
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="panel"><h2>页面加载失败</h2><p class="sub">${err.message}</p></div>`;
  }
  document.querySelectorAll('.nav a').forEach((a) => {
    a.classList.toggle('active', a.dataset.route === (routes[route] ? route : 'home'));
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.addEventListener('hashchange', render);
render();

/* Service Worker：预缓存静态资源，离线可推演（后端档案需联网） */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Service Worker 注册失败', e));
  });
}

/* PWA 安装引导：浏览器给出可安装信号时，底部浮条提示添加到桌面 */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallTip();
});
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  document.getElementById('install-tip')?.remove();
});

function showInstallTip() {
  if (!deferredPrompt || document.getElementById('install-tip')) return;
  const tip = document.createElement('div');
  tip.id = 'install-tip';
  tip.className = 'install-tip fade-in';
  tip.innerHTML = `
    <span class="install-seal">玄</span>
    <div class="install-body">
      <b>玄机阁可安装</b>
      <span class="hint">添加到桌面 · 断网也能推演</span>
    </div>
    <button type="button" class="btn" id="install-now">立即安装</button>
    <button type="button" class="install-x" id="install-x" aria-label="关闭">×</button>`;
  document.body.appendChild(tip);
  tip.querySelector('#install-now').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    tip.remove();
  });
  tip.querySelector('#install-x').addEventListener('click', () => tip.remove());
}
