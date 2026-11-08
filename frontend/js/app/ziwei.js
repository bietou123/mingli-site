/* app/ziwei.js —— 紫微斗数十二宫页 */
import { paipan, analyzeYear, liunianPan, daxianSihua, liunianSihua } from '../engine/ziwei.js';
import { trueSolarTime } from '../engine/calendar.js';
import { SAN_HE } from '../engine/ganzhi.js';
import { huangliMiniHtml, todayHuangli } from '../engine/huangli.js';

let KB = null;
let BRIGHT = null;
let LAST_EXPORT = '';

export function setKnowledge(data) { KB = data; }
export function setBrightness(d) { BRIGHT = d; }

const BRIGHT_CN = { miao: '庙', wang: '旺', de: '得', li: '利', ping: '平', xian: '陷', bu: '不' };
/* 星曜亮度三档：庙旺得=吉(绿) / 利平=平(金) / 陷不=凶(红) */
const BRIGHT_CLS = { miao: 's', wang: 's', de: 's', li: 'm', ping: 'm', xian: 'b', bu: 'b' };
const HUA_CN = { 禄: '禄', 权: '权', 科: '科', 忌: '忌' };
const JU_CN = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六' };
/** 宫名统一带「宫」字：PALACES 定义中仅命宫/父母/福德自带「宫」，其余需补 */
const palName = (n) => (n && n.includes('宫') ? n : `${n}宫`);

/** 命主/身主（依生年地支）：命主按六合对（子丑贪狼…）、身主按六冲对（子午火星…） */
const MINGZHU = { '子': '贪狼', '丑': '贪狼', '寅': '禄存', '卯': '禄存', '辰': '文曲', '巳': '文曲', '午': '破军', '未': '破军', '申': '武曲', '酉': '武曲', '戌': '廉贞', '亥': '廉贞' };
const SHENZHU = { '子': '火星', '丑': '天相', '寅': '天梁', '卯': '天同', '辰': '文昌', '巳': '天机', '午': '火星', '未': '天相', '申': '天梁', '酉': '天同', '戌': '文昌', '亥': '天机' };

export const template = `
  <section class="page-head fade-in">
    <h1>紫微斗数 <em>·</em> 十二宫</h1>
    <p>安星 · 五行局 · 生年四化 · 大限 —— 依《紫微斗数全书》本地推演</p>
  </section>

  <section class="form-panel glass fade-in d1">
    <form id="zw-form" class="form-grid" autocomplete="off">
      <div class="field">
        <label>姓名 / 备注</label>
        <input type="text" id="zw-name" value="命主">
      </div>
      <div class="field">
        <label>出生时间<span class="opt">公历</span></label>
        <input type="datetime-local" id="zw-datetime" value="1990-01-01T08:00" step="60">
      </div>
      <div class="field">
        <label>性别</label>
        <select id="zw-gender"><option value="男" selected>男</option><option value="女">女</option></select>
      </div>
      <div class="field">
        <label>经度<span class="opt">东经</span></label>
        <input type="number" id="zw-lng" value="120" min="73.5" max="135" step="0.01">
      </div>
      <div class="field">
        <label>真太阳时<span class="opt">建议开启</span></label>
        <select id="zw-true"><option value="1" selected>开启</option><option value="0">关闭</option></select>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn">排 盘</button>
        <button type="button" class="btn ghost" id="zw-fill">填入我的命盘</button>
        <button type="button" class="btn ghost" id="zw-share" title="生成含本排盘参数的可分享链接">复制排盘链接</button>
      </div>
    </form>
  </section>

  <div id="zw-result"></div>
`;

export function mounted(root) {
  const form = root.querySelector('#zw-form');
  const fill = root.querySelector('#zw-fill');
  const result = root.querySelector('#zw-result');

  // 档案一键排盘：读取上一页选中的命主并填充表单
  try {
    const sel = JSON.parse(localStorage.getItem('mingli.selectedProfile'));
    if (sel && sel.datetime) {
      root.querySelector('#zw-datetime').value = sel.datetime;
      root.querySelector('#zw-gender').value = sel.gender || '男';
      if (sel.longitude) root.querySelector('#zw-lng').value = sel.longitude;
      root.querySelector('#zw-name').value = sel.name || '命主';
    }
  } catch {}
  localStorage.removeItem('mingli.selectedProfile');

  const kbPromise = fetch(new URL('../../data/knowledge-ziwei.json', import.meta.url))
    .then((res) => res.json()).then((d) => { setKnowledge(d); return d; })
    .catch((e) => console.warn('紫微知识库加载失败', e));
  const brPromise = fetch(new URL('../../data/ziwei-brightness.json', import.meta.url))
    .then((res) => res.json()).then((d) => { setBrightness(d); return d; })
    .catch((e) => console.warn('亮度表加载失败', e));

  fill.addEventListener('click', () => {
    root.querySelector('#zw-datetime').value = '1990-01-01T08:00';
    root.querySelector('#zw-gender').value = '男';
    root.querySelector('#zw-lng').value = '120';
    root.querySelector('#zw-true').value = '1';
    root.querySelector('#zw-name').value = '命主';
    run();
  });

  // 分享链接自动排盘：打开 ?t=...&g=...&l=... 直接出盘
  const sp = window.__shareParams;
  if (sp && sp.get('t')) {
    if (sp.get('t')) root.querySelector('#zw-datetime').value = sp.get('t');
    if (sp.get('g')) root.querySelector('#zw-gender').value = sp.get('g');
    if (sp.get('l')) root.querySelector('#zw-lng').value = sp.get('l');
    if (sp.get('true') !== null) root.querySelector('#zw-true').value = sp.get('true');
    if (sp.get('n')) root.querySelector('#zw-name').value = sp.get('n');
  }

  const shareBtn = root.querySelector('#zw-share');
  if (shareBtn) shareBtn.addEventListener('click', () => {
    const t = root.querySelector('#zw-datetime').value;
    const g = root.querySelector('#zw-gender').value;
    const l = root.querySelector('#zw-lng').value;
    const n = root.querySelector('#zw-name').value.trim() || '命主';
    const tr = root.querySelector('#zw-true').value;
    const url = `${location.origin}${location.pathname}#/ziwei?t=${encodeURIComponent(t)}&g=${encodeURIComponent(g)}&l=${encodeURIComponent(l)}&n=${encodeURIComponent(n)}&true=${tr}`;
    copyText(url).then(() => {
      shareBtn.textContent = '链接已复制';
      setTimeout(() => { shareBtn.textContent = '复制排盘链接'; }, 1600);
    });
  });

  form.addEventListener('submit', (e) => { e.preventDefault(); run(); });

  function run() {
    const name = root.querySelector('#zw-name').value.trim() || '命主';
    const raw = new Date(root.querySelector('#zw-datetime').value);
    if (Number.isNaN(raw.getTime())) { result.innerHTML = `<div class="tip red fade-in">请输入有效时间。</div>`; return; }
    const gender = root.querySelector('#zw-gender').value;
    const lng = parseFloat(root.querySelector('#zw-lng').value) || 120;
    const useTrue = root.querySelector('#zw-true').value === '1';
    let date = raw, tst = null;
    if (useTrue) { tst = trueSolarTime(raw, lng); date = tst.trueSolar; }
    result.innerHTML = `<div class="panel glass fade-in" style="text-align:center"><p class="sub">安星中…</p></div>`;
    Promise.all([kbPromise, brPromise]).then(() => {
      const r = paipan({ date, gender, brightness: BRIGHT });
      const meta = { name, useTrue, lng, tst, birthYear: date.getFullYear() };
      result.innerHTML = renderResult(r, meta);
      result.querySelectorAll('.fade-in').forEach((el) => { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; });
      bindLiunian(result, r, meta);
      bindDaxian(result, r, meta);
      bindPalace(result, r, meta);
      LAST_EXPORT = exportText(r, meta);
      bindExport(result);
    });
  }

  run();
}

/* ── 流年分析（小限 + 流年四化） ─────────────── */

const HUA_MEANING = {
  禄: '机缘生发，顺势而为易有收获',
  权: '主动担责，宜握住方向不松手',
  科: '名望教养，贵人提携声名扬',
  忌: '执着提醒——是提示而非判决，宜静观自省、主动化解',
};
const PALACE_THEME = {
  命宫: '自身·性格格局', 父母: '父母·文书·长辈', 福德: '精神·兴趣·享福',
  田宅: '不动产·家庭', 官禄: '事业·学业·名位', 仆役: '交友·部属',
  迁移: '外出·机遇·远行', 疾厄: '健康·身体', 财帛: '财富·理财',
  子女: '子女·下属门生', 夫妻: '感情·配偶', 兄弟: '兄弟姊妹·平辈',
};
function huaCardHtml(r, h) {
  const pal = h.palaceIndex >= 0 ? r.palaces[h.palaceIndex] : null;
  const loc = h.palaceName === '—' ? '未落十二宫（该星未入主辅，当年四化作用不显）' : `${h.palaceName}宫`;
  const stars = pal ? (pal.stars.map((s) => s.name).join(' ') || '无主星') : '';
  const minor = pal && pal.minorStars.length ? ' · ' + pal.minorStars.map((s) => s.name).join('') : '';
  const theme = pal ? `${PALACE_THEME[pal.name] || ''}${stars ? ' · ' + stars : ''}${minor || ''}` : '—';
  return `
    <div class="hua-card${h.hua === '忌' ? ' bad' : ''}">
      <span class="hc-hua">${h.hua}</span>
      <div class="hc-body">
        <div class="hc-star">${h.star}化${h.hua} <small>@${loc}</small></div>
        <div class="hc-theme">${theme}</div>
        <div class="hc-meaning">${HUA_MEANING[h.hua]}</div>
      </div>
    </div>`;
}

export function renderLiunian(r, year) {
  const y = analyzeYear(r, year);
  const p = y.palace;
  const starTxt = p.stars.length ? p.stars.join(' ') : '无主星';
  const sihuaHtml = y.sihua.map((h) => {
    const name = h.palaceName === '—' ? '未落十二宫' : `${h.palaceName}宫`;
    return `<span class="ss-chip${h.hua === '忌' ? ' red' : ''}">${h.star}化${h.hua} <b>@${name}</b></span>`;
  }).join('');
  const ji = y.sihua.find((h) => h.hua === '忌');
  return `
    <div class="grid-cards" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-top:10px">
      <div class="info-card"><div class="k">${y.year} 流年</div><div class="v gold" style="font-size:20px">${y.ganzhi}</div>
        <div class="d">虚岁 ${y.xuSui} · ${p.gan}${p.zhi}</div></div>
      <div class="info-card"><div class="k">小限宫位</div><div class="v">${p.name}</div>
        <div class="d">${starTxt}${p.isBody ? ' · 身宫' : ''}</div></div>
      <div class="info-card"><div class="k">流年四化</div><div class="v" style="font-size:15px">${sihuaHtml}</div></div>
    </div>
    ${ji && ji.palaceName !== '—' ? `<div class="d" style="margin-top:10px;font-size:12px;color:var(--text-faint)">${ji.star}化忌落在${ji.palaceName}宫，为当年最需留意之处——化忌是「提醒」而非「判决」，宜作主动化解与成长的契机。</div>` : ''}
    <div class="hua-detail">${y.sihua.map((h) => huaCardHtml(r, h)).join('')}</div>
    ${liunianMhHtml(r, year)}
    <details class="hl-details lyp-details fade-in d2" style="margin-top:12px">
      <summary>流年十二宫（以流年支为流年命宫，看当年十二宫人事落在原盘何处）</summary>
      <div class="lyp-grid">${liunianPanHtml(r, year)}</div>
      <div class="d" style="margin-top:8px;font-size:12px;color:var(--text-faint)">流年各宫对应原盘宫位之星，即该宫当年所主人事；〈命〉为流年命宫，红框为化忌宫。</div>
    </details>`;
}

/* 流年命宫四化（以流年命宫之干起四化，与岁君四化互为补充） */
function liunianMhHtml(r, year) {
  const ln = liunianSihua(r, year);
  if (!ln) return '';
  const y = analyzeYear(r, year);
  const note = ln.sameAsYear
    ? `本年流年命宫干支 ${ln.gz} 即岁君干支，两套四化同——化忌所落宫位为当年最需留意处。`
    : `本年流年命宫干支 ${ln.gz} 与岁君 ${y.ganzhi} 不同，四化异动——以 ${ln.gan} 干四化观命宫所主之事，与岁君四化互为补充。`;
  return `
    <div class="lnmh-box fade-in d2">
      <div class="lnmh-head">流年命宫四化<small>以流年命宫 ${ln.gz} 之干「${ln.gan}」起四化</small></div>
      <div class="lnmh-chips">
        ${ln.items.map((s) => `<span class="lnmh-chip ${s.hua === '忌' ? 'ji' : s.hua === '禄' ? 'lu' : s.hua === '权' ? 'quan' : 'ke'}"><b>${s.star}</b><i>${s.hua}</i><small>@${s.palaceName}${s.self ? '·本宫' : ''}</small></span>`).join('')}
      </div>
      <div class="lnmh-note">${note}</div>
    </div>`;
}

/* 流年十二宫网格 */
function liunianPanHtml(r, year) {
  const pan = liunianPan(r, year);
  return pan.cells.map((c) => `
    <div class="lyp-row${c.isSoul ? ' soul' : ''}${c.hasJi ? ' ji' : ''}">
      <span class="lyp-name">${c.isSoul ? '〈命〉' : ''}${c.name}</span>
      <span class="lyp-arrow">→</span>
      <span class="lyp-orig">${c.origName}<small>${c.gan}${c.zhi}</small></span>
      <span class="lyp-stars">${c.stars.length
        ? c.stars.map((s) => `${s.name}${bdgHtml(s)}${s.mutagen ? HUA_CN[s.mutagen] : ''}`).join('')
        : (c.oppStars ? `<span class="lyp-opp">借对宫${c.oppName}：${c.oppStars}</span>` : '<span class="lyp-opp">无主星</span>')}</span>
      ${c.hasJi ? '<span class="lyp-ji">化忌</span>' : ''}
    </div>`).join('');
}

function bindLiunian(root, r, meta) {
  const yearInput = root.querySelector('#zw-liunian-year');
  const btn = root.querySelector('#zw-liunian-btn');
  const out = root.querySelector('#zw-liunian-out');
  if (!yearInput || !btn || !out) return;
  const refresh = () => {
    const yr = parseInt(yearInput.value, 10);
    if (!yr || yr < 1900 || yr > 2200) { out.innerHTML = '<div class="tip red fade-in">请输入有效公历年份（1900~2200）。</div>'; return; }
    out.innerHTML = renderLiunian(r, yr);
    const grid = root.querySelector('#zw-palace-grid');
    if (grid) { grid.innerHTML = palaceGridHtml(r, meta, yr); bindPalace(root, r, meta); }
  };
  btn.addEventListener('click', refresh);
  yearInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') refresh(); });
}

/* 大限点击联动：点大限步骤 → 流年输入填入该大限起始公历年并刷新（小限 + 四化落宫盘） */
function bindDaxian(root, r, meta) {
  root.querySelectorAll('.dayun-step[data-zw-year]').forEach((el) => {
    el.addEventListener('click', () => {
      const yr = Number(el.dataset.zwYear);
      if (!yr) return;
      const input = root.querySelector('#zw-liunian-year');
      const btn = root.querySelector('#zw-liunian-btn');
      if (input) input.value = yr;
      if (btn) btn.click();
      root.querySelector('.liunian-box')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

/* 命书导出 */
export function exportText(r, meta) {
  const L = [];
  L.push('【玄机阁 · 紫微命书】');
  L.push(`${meta.name} · ${r.lunar.text} · ${r.gender} · ${meta.useTrue ? '真太阳时' : '钟表时'}${meta.lng ? `（东经${meta.lng}°）` : ''}`);
  L.push(`五行局：${r.fiveElements}${JU_CN[r.ju] || r.ju}局 · 大限${r.forward ? '顺行' : '逆行'} · ${r.startAge}岁起限`);
  const soul = r.palaces.find((p) => p.isSoul);
  const body = r.palaces.find((p) => p.isBody);
  L.push(`命宫：${soul.gan}${soul.zhi} ${soul.stars.map((s) => s.name + (s.brightness ? '（' + BRIGHT_CN[s.brightness] + '）' : '')).join('、') || '无主星'}${soul === body ? '（身宫同宫）' : ''}`);
  L.push(`身宫：${body.gan}${body.zhi} ${body.name}`);
  const mzYz = (r.ganzhi && r.ganzhi.year) ? r.ganzhi.year[1] : '';
  const mzL = MINGZHU[mzYz], szL = SHENZHU[mzYz];
  const loc = (s) => { const p = r.palaces.find((q) => q.stars.some((x) => x.name === s) || q.minorStars.some((x) => x.name === s)); return p ? p.name : '—'; };
  L.push(`命主：${mzL || '—'}（${mzYz}）落${loc(mzL)} · 身主：${szL || '—'}（${mzYz}）落${loc(szL)}`);
  L.push('十二宫：');
  r.palaces.forEach((p) => {
    const opp = r.palaces[(r.palaces.indexOf(p) + 6) % 12];
    const star = p.stars.length
      ? p.stars.map((s) => s.name + (s.brightness ? '（' + BRIGHT_CN[s.brightness] + '）' : '') + (s.mutagen ? HUA_CN[s.mutagen] : '')).join('、')
      : (opp && opp.stars.length ? `无主星(借对宫${opp.name}:${opp.stars.map((s) => s.name).join('、')})` : '无主星');
    L.push(`  ${p.name}（${p.gan}${p.zhi}）：${star}${p.minorStars.length ? ' · ' + p.minorStars.map((s) => s.name).join('、') : ''}`);
  });
  L.push(`生年四化：${r.sihua.map(({ star, hua }) => `${star}化${hua}`).join(' ')}`);
  // 辅星汇总行
  const minorLine = r.palaces
    .filter((p) => p.minorStars && p.minorStars.length > 0)
    .map((p) => `${p.name}（${p.minorStars.map((s) => { const d = MINOR_DESC[s.name]; return `${s.name}·${d ? d.cls : '中性'}`; }).join('、')}）`)
    .join('、');
  if (minorLine) L.push(`辅星：${minorLine}`);
  L.push(`大限：${r.decadals.map((d) => `${d.gan}${d.zhi}（${d.start}~${d.end}岁·${r.palaces[d.palaceIndex].name}）`).join(' ')}`);
  const hlNow = todayHuangli();
  L.push(`今日黄历：${hlNow.solarText.slice(0, 10)} ${hlNow.dgz}日 · 建除${hlNow.name}（${hlNow.level}）· 宜${hlNow.yi.slice(0, 4).join('/') || '诸事不宜'} · 忌${hlNow.ji.join('/') || '无'}`);
  L.push('—— 玄机阁离线推演 · 化忌是「提醒」而非「判决」。');
  return L.join('\n');
}

function copyText(t) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(t);
  const ta = document.createElement('textarea');
  ta.value = t;
  ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch {}
  document.body.removeChild(ta);
  return Promise.resolve();
}

function bindExport(root) {
  const btn = root.querySelector('#zw-export');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (!LAST_EXPORT) return;
    copyText(LAST_EXPORT).then(() => {
      btn.textContent = '已 复 制';
      setTimeout(() => { btn.textContent = '复 制 命 书'; }, 1600);
    });
  });
}

/* ── 渲染 ─────────────────────────────────────── */

/* 命宫/身宫主星解读卡 */
function readStarHtml(p) {
  if (!KB) return '';
  return p.stars.map((s) => {
    const d = KB.stars.find((x) => x.name === s.name);
    return d ? `<div class="info-card fade-in">
      <div class="k">${d.name}${bdgHtml(s)} · ${d.wuxing} · ${d.role}</div>
      <div class="v gold" style="font-size:16px">${d.character}</div>
      <div class="d">事业：${d.career} · 感情：${d.love}${d.yu && d.yu.length ? ` · 格局：${d.yu.join('、')}` : ''}</div>
    </div>` : '';
  }).join('');
}

/* 十二宫盘：按流年年份高亮小限宫 + 四化落宫标记（禄权科忌） */
const HUA_CLS = { 禄: 'hua-li', 权: 'hua-quan', 科: 'hua-ke', 忌: 'hua-ji' };

/* 星曜亮度角标（庙旺得=绿 / 利平=金 / 陷不=红） */
const bdgHtml = (s) => (s.brightness && BRIGHT_CN[s.brightness] ? `<i class="bdg bd-${BRIGHT_CLS[s.brightness] || 'm'}" title="亮度 ${BRIGHT_CN[s.brightness]}">${BRIGHT_CN[s.brightness]}</i>` : '');

function palaceGridHtml(r, meta, year) {
  const nowAge = new Date().getFullYear() - (meta.birthYear || 1990) + 1;
  const nowDec = r.decadals.find((d) => d.start <= nowAge && nowAge <= d.end);
  let xiaoxianIdx = null;
  let sihuaByPalace = [];
  try {
    const y = analyzeYear(r, year);
    xiaoxianIdx = y.palaceIndex;
    sihuaByPalace = y.sihua.filter((h) => h.palaceIndex >= 0);
  } catch {}
  return r.palaces.map((p, i) => {
    const starTags = p.stars.map((s) => `
      <span class="major${s.mutagen ? ' mutagen' : ''}" title="${BRIGHT_CN[s.brightness] || ''} ${s.brightness || ''}">${s.name}${bdgHtml(s)}${s.mutagen ? HUA_CN[s.mutagen] : ''}</span>`).join('');
    const minorTags = p.minorStars.map((s) => `<span title="${s.brightness || ''}">${s.name}</span>`).join('');
    const opp = r.palaces[(i + 6) % 12];
    const oppStars = opp ? opp.stars.map((s) => s.name).join('、') : '';
    const starLine = starTags || (oppStars ? `<span style="color:var(--text-faint)">无主星 · 借对宫${opp.name}：${oppStars}</span>` : '<span style="color:var(--text-faint)">无主星</span>');
    const badge = [];
    if (p.isSoul) badge.push('<span class="p-badge">命</span>');
    if (p.isBody) badge.push('<span class="p-badge" style="color:var(--gold)">身</span>');
    if (nowDec && i === nowDec.palaceIndex) badge.push('<span class="p-badge daxian">限</span>');
    if (i === xiaoxianIdx) badge.push('<span class="p-badge xiaoxian">年</span>');
    const huaHere = sihuaByPalace.filter((h) => h.palaceIndex === i);
    huaHere.forEach((h) => badge.push(`<span class="p-badge ${HUA_CLS[h.hua] || ''}" title="流年四化">${h.hua}</span>`));
    const huaCls = huaHere.some((h) => h.hua === '忌') ? ' hua-ji' : '';
    const cls = `${p.isSoul ? ' soul' : ''}${p.isBody ? ' body' : ''}${nowDec && i === nowDec.palaceIndex ? ' daxian' : ''}${i === xiaoxianIdx ? ' xiaoxian' : ''}${huaCls}`;
    return `
      <div class="palace clickable${cls}" data-pi="${i}" title="点击展开「${palName(p.name)}」详解">
        <div class="p-head"><b>${p.name}</b><span class="gz">${p.gan}${p.zhi}</span>${badge.join('')}</div>
        <div class="p-stars">${starLine}</div>
        <div class="p-minor">${minorTags}</div>
      </div>`;
  }).join('');
}

/* 十二宫星曜速查总表（宫盘一览：主星/辅星/亮度/四化/空宫借对宫） */
function zwPalaceTableHtml(r) {
  return r.palaces.map((p, i) => {
    const starTxt = p.stars.map((s) => `${s.name}${bdgHtml(s)}${s.mutagen ? HUA_CN[s.mutagen] : ''}`).join(' ');
    const opp = r.palaces[(i + 6) % 12];
    const oppStars = opp && opp.stars.length ? opp.stars.map((s) => s.name).join('、') : '';
    const isKong = !p.stars.length;
    const mainTxt = starTxt || (oppStars ? `<span style="color:var(--text-faint)">无主星 · 借对宫${opp.name}</span>` : '<span style="color:var(--text-faint)">无主星</span>');
    const flag = `${p.isSoul ? '<b class="zt-flag">命</b>' : ''}${p.isBody ? '<b class="zt-flag body">身</b>' : ''}`;
    return `<div class="zw-tr${p.isSoul ? ' soul' : ''}">
      <div class="zt-name">${flag}${p.name}</div>
      <div class="zt-gz">${p.gan}${p.zhi}</div>
      <div class="zt-stars">${mainTxt}</div>
      <div class="zt-minor">${p.minorStars.map((s) => s.name).join(' ') || '—'}</div>
      <div class="zt-note">${isKong ? (oppStars ? `空宫 · 借${opp.name}` : '空宫') : '—'}</div>
    </div>`;
  }).join('');
}

/* 十二宫逐宫详解（宫格点击展开）：宫位主题 + 主星性格 + 辅煞 + 三方四正 */
const SAN_HE_Z = [['申', '子', '辰'], ['寅', '午', '戌'], ['巳', '酉', '丑'], ['亥', '卯', '未']];
export function palaceDetailHtml(r, i) {
  const p = r.palaces[i];
  const opp = r.palaces[(i + 6) % 12];
  const grp = SAN_HE_Z.find((g) => g.includes(p.zhi)) || [];
  const starCards = p.stars.map((s) => {
    const d = KB && KB.stars ? KB.stars.find((x) => x.name === s.name) : null;
    return d ? `<div class="info-card fade-in">
      <div class="k">${d.name}${bdgHtml(s)}${s.mutagen ? `<i class="st-hua">${s.mutagen}</i>` : ''} · ${d.wuxing} · ${d.role}</div>
      <div class="v gold" style="font-size:15px">${d.character}</div>
      <div class="d">事业：${d.career} · 感情：${d.love}${d.yu && d.yu.length ? ` · 格局：${d.yu.join('、')}` : ''}</div>
    </div>` : `<div class="info-card fade-in"><div class="k">${s.name}${s.mutagen ? `<i class="st-hua">${s.mutagen}</i>` : ''}</div><div class="d">主星。</div></div>`;
  }).join('');
  const sanheIdx = grp.filter((z) => z !== p.zhi).map((z) => r.palaces.findIndex((pl) => pl.zhi === z)).filter((x) => x >= 0);
  const palTxt = (pi) => {
    const q = r.palaces[pi];
    return `${q.name}宫（${q.gan}${q.zhi}）：${q.stars.map((s) => s.name + (s.mutagen || '')).join('、') || '无主星'}` +
      (q.minorStars.length ? ` · 辅${q.minorStars.join('、')}` : '');
  };
  const oppTxt = `${opp.name}宫（${opp.gan}${opp.zhi}）：${opp.stars.map((s) => s.name + (s.mutagen || '')).join('、') || '无主星'}${opp.minorStars.length ? ' · 辅' + opp.minorStars.join('、') : ''}`;
  const heTxt = sanheIdx.map(palTxt).join('　');
  return `<div class="pd-box fade-in">
    <div class="pd-head"><b>${palName(p.name)}</b><span class="pd-gz">${p.gan}${p.zhi}</span>
      <span class="pd-theme">${PALACE_THEME[p.name] || '人事宫'}</span>
      <span class="pd-badges">${p.isSoul ? '<i class="bd">命</i>' : ''}${p.isBody ? '<i class="bd">身</i>' : ''}</span>
      <span class="pd-close" title="收起">×</span></div>
    ${starCards || `<div class="tip">${palName(p.name)}无主星——借对宫 ${opp.name}：${opp.stars.map((s) => s.name).join('、')} 参详（紫微空宫论法）。</div>`}
    ${p.minorStars.length ? `<div class="pd-minor"><b>辅煞</b>${p.minorStars.map((s) => `<span class="ss-chip">${s.name}${s.brightness ? '（' + BRIGHT_CN[s.brightness] + '）' : ''}</span>`).join('')}</div>` : ''}
    <div class="pd-opp"><b>对宫照</b>${oppTxt}</div>
    ${heTxt ? `<div class="pd-opp"><b>三合会</b>${heTxt}</div>` : ''}
  </div>`;
}

/* 宫格点击：展开/收起该宫详解 */
function bindPalace(root, r, meta) {
  const grid = root.querySelector('#zw-palace-grid');
  const detail = root.querySelector('#zw-palace-detail');
  if (!grid || !detail) return;
  grid.querySelectorAll('.palace[data-pi]').forEach((el) => {
    el.addEventListener('click', () => {
      const pi = Number(el.dataset.pi);
      const isOpen = detail.dataset.pi === String(pi);
      if (isOpen) {
        detail.innerHTML = '';
        delete detail.dataset.pi;
        grid.querySelectorAll('.palace').forEach((x) => x.classList.remove('sel'));
        return;
      }
      detail.innerHTML = palaceDetailHtml(r, pi);
      detail.dataset.pi = String(pi);
      grid.querySelectorAll('.palace').forEach((x) => x.classList.toggle('sel', x === el));
      detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      const close = detail.querySelector('.pd-close');
      if (close) close.addEventListener('click', () => { detail.innerHTML = ''; delete detail.dataset.pi; grid.querySelectorAll('.palace').forEach((x) => x.classList.remove('sel')); });
    });
  });
}

export function renderResult(r, meta) {
  const soulP = r.palaces.find((p) => p.isSoul);
  const bodyP = r.palaces.find((p) => p.isBody);
  const nowAge = new Date().getFullYear() - (meta.birthYear || 1990) + 1;
  const nowDec = r.decadals.find((d) => d.start <= nowAge && nowAge <= d.end);

  const palaceGrid = palaceGridHtml(r, meta, new Date().getFullYear());

  // 命宫/身宫主星解读
  const soulReadHtml = readStarHtml(soulP);
  const bodyReadHtml = readStarHtml(bodyP);

  // 命主 / 身主（按生年支定星；命主=命宫守护指方向、身主=后天重心）
  const mzYearZhi = (r.ganzhi && r.ganzhi.year) ? r.ganzhi.year[1] : '';
  const mzStar = MINGZHU[mzYearZhi] || '';
  const szStar = SHENZHU[mzYearZhi] || '';
  const findStarPalace = (s) => r.palaces.find((p) => p.stars.some((x) => x.name === s) || p.minorStars.some((x) => x.name === s));
  const mzP = mzStar && findStarPalace(mzStar);
  const szP = szStar && findStarPalace(szStar);
  const mzShenHtml = [
    mzStar ? `<div class="info-card fade-in"><div class="k">命主 · ${mzStar}</div><div class="v">落${mzP ? mzP.name + '宫' + (mzP.stars.length ? ' · 与 ' + mzP.stars.map((s) => s.name).join('、') + ' 同宫' : '') : '—'}</div><div class="d">生年 ${mzYearZhi} · 命主为命宫守护之星，指示一生方向与性格基调所在之宫。</div></div>` : '',
    szStar ? `<div class="info-card fade-in"><div class="k">身主 · ${szStar}</div><div class="v">落${szP ? szP.name + '宫' : '—'}</div><div class="d">生年 ${mzYearZhi} · 身主主后天重心，中年后精力与际遇多由此宫牵动。</div></div>` : '',
  ].filter(Boolean).join('');

  // 格局匹配（命宫三方四正）
  const gejuHits = matchGeju(r, soulP);
  const gejuHtml = gejuHits.length
    ? gejuHits.map((g, i) => `
      <div class="info-card fade-in d${i + 1}">
        <div class="k">格局 ${g.name}</div>
        <div class="v" style="font-size:16px;color:var(--gold)">${g.stars}</div>
        <div class="d">${g.duan}<br><span style="color:var(--text-faint)">${g.note || ''}</span></div>
      </div>`).join('')
    : '<div class="tip fade-in">三方四正未落入知识库命式，按星曜逐项参详。</div>';

  // 辅星解读（命宫 + 身宫）
  const minorRead = [...new Set([...soulP.minorStars, ...bodyP.minorStars])].map((s) => {
    const d = KB.auxiliary.find((x) => x.name === s.name);
    return d ? `${s.name}（${d.trait}）：${d.meaning}` : null;
  }).filter(Boolean);

  // 四化解读
  const sihuaHtml = r.sihua.map(({ star, hua }) => {
    const d = KB.sihua.find((x) => x.name === hua);
    const palaceName = r.palaces.find((p) => p.stars.some((s) => s.name === star))?.name || '—';
    return `<div class="ss-chip">${star}<b>${hua}</b>${d ? '：' + d.meaning.split('：')[0] : ''}<span style="color:var(--text-faint)">@${palaceName}</span></div>`;
  }).join('');

  // 大限
  const daxianHtml = r.decadals.map((d) => {
    const p = r.palaces[d.palaceIndex];
    const isNow = d.start <= nowAge && nowAge <= d.end;
    const yr = (meta.birthYear || 1990) + d.start - 1;
    return `
      <div class="dayun-step" data-zw-year="${yr}" style="cursor:pointer;${isNow ? 'border-color:var(--cinnabar);background:var(--cinnabar-soft)' : ''}" title="点击查看 ${yr} 年（该大限起始）流年分析">
        <div class="d-ganzhi">${d.gan}${d.zhi}</div>
        <div class="d-years">${d.start}~${d.end}岁</div>
        <div style="font-size:11px;color:var(--text-dim);margin-top:2px">${palName(p.name)}${isNow ? ' <b style="color:var(--cinnabar)">·今</b>' : ''}</div>
      </div>`;
  }).join('');

  // 大限运程解读：逐大限十年主题（宫位人事 + 主星 + 化忌标注）
  const journeyHtml = r.decadals.map((d, i) => {
    const p = r.palaces[d.palaceIndex];
    const isNow = d === nowDec;
    const yr = (meta.birthYear || 1990) + d.start - 1;
    const stars = p.stars.map((s) => s.name + (s.mutagen ? `<i class="st-hua">${s.mutagen}</i>` : '')).join('') || '<span class="no-star">无主星</span>';
    const hasJi = p.stars.some((s) => s.mutagen === '忌');
    const minor = p.minorStars.length ? `<div class="dx-minor">辅 · ${p.minorStars.map((s) => s.name).join('、')}</div>` : '';
    const dxh = daxianSihua(r, i);
    const dxhHtml = dxh.length ? `<div class="dx-sihua" title="大限干 ${d.gan} 四化：${dxh.map((s) => s.star + s.hua).join('、')}">
      <span class="dxh-lbl">${d.gan}化</span>
      ${dxh.map((s) => `<span class="dxh ${s.hua === '忌' ? 'ji' : s.hua === '禄' ? 'lu' : s.hua === '权' ? 'quan' : 'ke'}"><b>${s.star}</b><i>${s.hua}</i><small>${s.palaceName}${s.self ? '·本限' : ''}</small></span>`).join('')}
    </div>` : '';
    return `
      <div class="daxian-card fade-in${isNow ? ' now' : ''}">
        <div class="dx-head"><span class="dx-gz">${d.gan}${d.zhi}</span>
          <span class="dx-years">${d.start}~${d.end}岁<small>${yr}~${yr + 9}年</small></span>
          ${isNow ? '<span class="dx-now">当运</span>' : ''}</div>
        <div class="dx-palace"><b>${palName(p.name)}</b><span class="dx-theme">${PALACE_THEME[p.name] || ''}</span></div>
        <div class="dx-stars">${stars}${hasJi ? '<span class="dx-ji">带化忌 · 静观自省</span>' : ''}</div>
        ${dxhHtml}
        ${minor}</div>`;
  }).join('');

  // 三方四正：命宫地支三合局（命/财/官三方）+ 迁移宫四正照
  const sanHe = SAN_HE.find((s) => s.zhi.includes(soulP.zhi));
  const sanIdx = sanHe ? sanHe.zhi.map((z) => r.palaces.findIndex((p) => p.zhi === z)) : [soulP.index];
  const duiIdx = (soulP.index + 6) % 12;
  const focusIdx = [...new Set([...sanIdx, duiIdx])];
  const sifangHtml = focusIdx.map((i) => {
    const p = r.palaces[i];
    const tag = i === soulP.index ? '命' : i === duiIdx ? '照' : '方';
    const stars = p.stars.map((s) => s.name + (s.mutagen ? HUA_CN[s.mutagen] : '')).join('、') || '无主星';
    return `
      <div class="info-card fade-in">
        <div class="k">${tag === '命' ? '<b style="color:var(--cinnabar)">命</b>' : tag === '照' ? '<b style="color:var(--gold)">照</b>' : '方'} ${p.name}</div>
        <div class="v" style="font-size:14px">${stars}</div>
        <div class="d">${p.gan}${p.zhi}${p.minorStars.length ? ' · ' + p.minorStars.map((s) => s.name).join('、') : ''}</div>
      </div>`;
  }).join('');

  // 各宫人事解读
  const palaceRead = r.palaces.map((p, i) => {
    const d = KB.palaces.find((x) => x.name === p.name);
    const stars = p.stars.map((s) => s.name + (s.mutagen ? HUA_CN[s.mutagen] : '')).join(' ');
    return `
      <div class="info-card fade-in" style="grid-template-columns:auto"><div class="k">${p.name} · ${p.gan}${p.zhi}${p.isSoul ? '（命）' : ''}${p.isBody ? '（身）' : ''}</div>
        <div class="v" style="font-size:14px">${stars || '无主星'}</div>
        <div class="d">${d ? `${d.things} · ${d.keywords}` : ''}</div></div>`;
  }).join('');

  return `
    <div class="hl-mini-row fade-in">${huangliMiniHtml()}</div>
    <div class="export-bar fade-in">
      <span class="hint">命书可一键复制为文本，便于存档与分享</span>
      <button type="button" class="btn ghost" id="zw-export">复 制 命 书</button>
    </div>
    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>十二宫盘</h2>
        <span class="hint">${meta.name} · ${meta.useTrue ? '真太阳时' : '钟表时'} · ${r.lunar.text}</span></div>
      <div class="palace-grid" id="zw-palace-grid">${palaceGrid}</div>
      <div id="zw-palace-detail"></div>
      <div class="palace-legend">
        <span><i class="lg-badge">命</i>命宫</span><span><i class="lg-badge" style="color:var(--gold)">身</i>身宫</span>
        <span><i class="lg-badge" style="color:#bcd6ff">限</i>当前大限</span><span><i class="lg-badge" style="color:#e2c8ff">年</i>流年小限</span>
        <span><i class="lg-badge hua-li">禄</i>禄</span><span><i class="lg-badge hua-quan">权</i>权</span>
        <span><i class="lg-badge hua-ke">科</i>科</span><span><i class="lg-badge hua-ji">忌</i>忌<i style="font-style:normal;color:var(--text-faint)">·流年四化落宫</i></span>
        <span><i class="bdg bd-s">庙</i>庙旺</span><span><i class="bdg bd-m">利平</i>平利</span><span><i class="bdg bd-b">陷</i>落陷</span><i style="font-style:normal;color:var(--text-faint)">·星曜亮度</i>
      </div>
      <div class="grid-cards" style="margin-top:16px">
        <div class="info-card fade-in"><div class="k">命宫</div><div class="v gold">${soulP.gan}${soulP.zhi} <small style="color:var(--text-dim)">五行局</small> ${r.fiveElements}${JU_CN[r.ju] || r.ju}局</div></div>
        <div class="info-card fade-in"><div class="k">身宫</div><div class="v">${bodyP.zhi} <small style="color:var(--text-dim)">${bodyP.name}宫</small></div></div>
        <div class="info-card fade-in"><div class="k">紫微 / 天府</div><div class="v">${r.palaces[r.ziweiIndex].zhi} / ${r.palaces[r.tianfuIndex].zhi}</div></div>
        <div class="info-card fade-in"><div class="k">大限</div><div class="v">${r.forward ? '顺行' : '逆行'} · ${r.startAge}岁起限</div></div>
      </div>
      <details class="hl-details zw-table-details fade-in d1">
        <summary>十二宫星曜速查 <span class="hint">宫盘一览 · 主星 / 辅星 / 亮度 / 四化 / 空宫借对宫</span></summary>
        <div class="zw-table-wrap"><div class="zw-table">
          <div class="zw-thead"><div>宫位</div><div>干支</div><div>主星</div><div>辅星</div><div>备注</div></div>
          ${zwPalaceTableHtml(r)}
        </div></div>
      </details>
    </div>

    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>命主星曜</h2>
        <span class="hint">命宫主星 + 命主/身主（依生年支）</span></div>
      <div class="grid-cards">${soulReadHtml || '<div class="tip">命宫无主星，宜借对宫星曜参详。</div>'}</div>
      ${mzShenHtml ? `<div class="grid-cards">${mzShenHtml}</div>` : ''}
      ${minorRead.length ? `<div class="panel glass fade-in d1" style="margin-top:14px"><b style="font-size:13px;color:var(--text-dim)">辅煞</b><div style="margin-top:8px;font-size:13px;color:var(--text-dim)">${minorRead.join('；')}</div></div>` : ''}
    </div>

    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>身宫 · 后天重心</h2>
        <span class="hint">${bodyP.name} · 身宫为后天精力投注之处，主为人处世之方</span></div>
      <div class="grid-cards">${bodyReadHtml || '<div class="tip">身宫无主星，宜借对宫星曜参详。</div>'}</div>
    </div>

    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>格局命式</h2>
        <span class="hint">命宫 + 财官迁三方四正</span></div>
      <div class="grid-cards">${gejuHtml}</div>
    </div>

    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>三方四正</h2>
        <span class="hint">命宫三合（命 · 财帛 · 官禄）+ 迁移对宫相照 —— 格局与吉凶看此四宫</span></div>
      <div class="grid-cards">${sifangHtml}</div>
    </div>

    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>生年四化</h2></div>
      <div class="panel glass fade-in d1"><div>${sihuaHtml || '—'}</div>
        <div style="margin-top:10px;font-size:12px;color:var(--text-faint)">${r.sihua.map(({ star, hua }) => { const d = KB.sihua.find((x) => x.name === hua); return d ? `${star}化${hua}：${d.meaning}${d.note ? '（' + d.note + '）' : ''}` : ''; }).filter(Boolean).join('<br>')}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>大限行运</h2>
        <span class="hint">${r.forward ? '顺行' : '逆行'} · ${r.fiveElements}${JU_CN[r.ju] || r.ju}局 ${r.startAge}岁起限</span></div>
      <div class="panel glass fade-in d1"><div class="dayun">${daxianHtml}</div></div>
      <div class="daxian-journey fade-in d2">
        <div class="dx-note">每十年一段行运，观其宫位主题与主星定吉凶倾向；带化忌之年段宜静观自省、主动化解，而非消极定论。</div>
        <div class="dx-grid">${journeyHtml}</div>
      </div>
      <div class="liunian-box fade-in d2">
        <div class="liunian-head">
          <b>流年分析</b>
          <input type="number" id="zw-liunian-year" value="${new Date().getFullYear()}" min="1900" max="2200" step="1" aria-label="流年公历年">
          <button type="button" id="zw-liunian-btn" class="btn ghost">看 流 年</button>
        </div>
        <div id="zw-liunian-out">${renderLiunian(r, new Date().getFullYear())}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>十二宫人事</h2></div>
      <div class="grid-cards">${palaceRead}</div>
    </div>

    ${xingYaoLan(r)}

    ${fuXingYaoLan(r)}

    ${wuxingYaoLanHtml()}

    ${zhuStarTableHtml()}

    ${sihuaStarTableHtml()}

    ${anxingTableHtml()}

    ${miaoXianTableHtml()}

    ${sanFangTableHtml()}

    ${mingShenZhuTableHtml()}

    ${palaceThemeTableHtml()}

    ${ziweiTermsHtml()}

    ${sihuaPalaceHtml()}

    ${gejuTableHtml(r)}

    <div class="section">
      <div class="tip fade-in">紫微解读属传统斗数经验体系，化忌是「提醒」而非「判决」，负面提示宜作主动化解与成长的契机。</div>
    </div>
  `;
}

/* ── 星曜五行阴阳表 ─────────────────────────────── */

/** 十四主星 + 常用辅星五行/阴阳（古籍口径） */
export const STAR_WUXING = {
  // 十四主星
  紫微: '土·阳', 天机: '木·阴', 太阳: '火·阳', 武曲: '金·阴',
  天同: '水·阳', 廉贞: '火·阴', 天府: '土·阳', 太阴: '水·阴',
  贪狼: '木·阳', 巨门: '水·阴', 天相: '水·阳', 天梁: '土·阴',
  七杀: '金·阳', 破军: '水·阴',
  // 常用辅星（阴阳存疑者只给五行）
  左辅: '土', 右弼: '水', 文昌: '金', 文曲: '水',
  天魁: '火', 天钺: '火', 禄存: '土',
  擎羊: '金', 陀罗: '金', 火星: '火', 铃星: '火',
  地空: '火', 地劫: '火', 天马: '火',
};

/* ── 命盘星曜一览 ───────────────────────────────── */

/** 十四主星古籍口径一句性情 */
const STAR_DESC = {
  紫微: '帝座之星，主贵、主统御、掌权柄，喜得左辅右弼百官朝拱。',
  天机: '谋略之星，主智、主变动，善策划而多思虑。',
  太阳: '光明之星，主贵、主施与，照人之星喜居卯辰巳午。',
  武曲: '财帛之星，主财、主刚毅，居财帛田宅皆宜。',
  天同: '福气之星，主和、主安逸，福泽绵长而进取稍缓。',
  廉贞: '次桃花星，主官禄亦主感情，性烈而多变。',
  天府: '库藏之星，主财、主安享，如财库充实而偏守成。',
  太阴: '明月之星，主财、主母妻，温柔内敛喜居酉戌亥子。',
  贪狼: '欲望之星，主才艺桃花，多才多艺而欲念重。',
  巨门: '口舌之星，主是非口才，善言辨而须防口舌。',
  天相: '辅佐之星，主印信、主协调，温和稳重而独立性弱。',
  天梁: '荫星，主寿、主解厄，逢凶化吉而性子孤高。',
  七杀: '肃杀之星，主威权、主变动，勇决而起伏大。',
  破军: '破耗之星，主开创、主变动，先破后立、起伏剧烈。',
};

/**
 * 命盘星曜一览：遍历十二宫，有主星则列出宫名/主星/亮度/四化/古籍描述。
 * 空宫跳过。
 * @param {object} r paipan() 返回
 * @returns {string} HTML 字符串
 */
function xingYaoLan(r) {
  const rows = r.palaces
    .filter((p) => p.stars.length > 0)
    .map((p) => {
      const starItems = p.stars.map((s) => {
        const hua = s.mutagen ? `<span class="xy-hua xy-hua-${['禄','权','科','忌'].indexOf(s.mutagen) >= 0 ? ['lu','quan','ke','ji'][['禄','权','科','忌'].indexOf(s.mutagen)] : ''}">${s.mutagen}</span>` : '';
        const bdg = bdgHtml(s);
        const desc = STAR_DESC[s.name] || '';
        return `
          <div class="xy-star">
            <div class="xy-star-head">
              <span class="xy-star-name">${s.name}</span>${STAR_WUXING[s.name] ? `<i class="xy-wx">属${STAR_WUXING[s.name]}</i>` : ''}${bdg}${hua}
            </div>
            ${desc ? `<div class="xy-star-desc">${desc}</div>` : ''}
          </div>`;
      }).join('');
      const badges = [
        p.isSoul ? '<span class="xy-pbadge soul">命</span>' : '',
        p.isBody ? '<span class="xy-pbadge body">身</span>' : '',
      ].filter(Boolean).join('');
      return `
        <div class="xy-palace panel glass fade-in">
          <div class="xy-palace-head">
            <b class="xy-pname">${palName(p.name)}</b><span class="xy-gz">${p.gan}${p.zhi}</span>${badges}
          </div>
          <div class="xy-stars">${starItems}</div>
        </div>`;
    });

  if (!rows.length) return '';
  return `
    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>命盘星曜一览</h2>
        <span class="hint">有主星各宫 · 亮度 · 四化 · 古籍性情</span></div>
      <div class="xy-wrap">${rows.join('')}</div>
      <div class="d" style="margin-top:8px;font-size:12px;color:var(--text-faint)">空宫不显示；亮度角标：庙旺=强 / 利平=中 / 陷不=弱；命理当雷达，不当牢笼。</div>
    </div>`;
}

/* ── 辅星解读表 ─────────────────────────────────── */
export const MINOR_DESC = {
  左辅: { kw: '左右扶持·贵人助力', cls: '吉', note: '左辅为助力之星，主得贵人同侪相扶、谋事多助。' },
  右弼: { kw: '机变协调·暗助', cls: '吉', note: '右弼为暗助之星，主得无形助力、善于协调周旋。' },
  文昌: { kw: '文星·科名才艺', cls: '吉', note: '文昌主文名才艺、考试功名，利文书学业。' },
  文曲: { kw: '才艺·口才人缘', cls: '吉', note: '文曲主才艺口才、文艺人缘，利表达创作。' },
  天魁: { kw: '天乙贵人·功名', cls: '吉', note: '天魁为天乙贵人，主科甲功名、贵人提携。' },
  天钺: { kw: '天乙贵人·提拔', cls: '吉', note: '天钺为天乙贵人，主受上级器重、阴贵人助力。' },
  禄存: { kw: '财禄·守成', cls: '吉', note: '禄存主财禄安稳、积累守成，忌冲破。' },
  擎羊: { kw: '刑伤·冲动', cls: '煞', note: '擎羊主刑伤冲突、行动果决，成也快败也急。' },
  陀罗: { kw: '暗昧·拖延', cls: '煞', note: '陀罗主暗昧反复、拖延阻隔，需耐性化解。' },
  火星: { kw: '突发·火爆', cls: '煞', note: '火星主突发变动、性急火爆，爆发力强须节制。' },
  铃星: { kw: '暗涌·惊扰', cls: '煞', note: '铃星主暗涌惊扰、内耗焦虑，宜静守调心。' },
  地空: { kw: '空亡·破耗', cls: '煞', note: '地空主空亡幻变、计划落空，宜实不宜虚。' },
  地劫: { kw: '劫夺·损耗', cls: '煞', note: '地劫主波折劫耗、财物破失，宜守勿赌。' },
  天马: { kw: '驿马·奔波', cls: '中性', note: '天马主变动奔波、外出流动，利远行不喜静守。' },
};

const MINOR_CLS_MAP = { 吉: 'g', 煞: 'b', 中性: 'm' };

/**
 * 辅星一览：遍历十二宫有辅星的宫，三色标注吉/煞/中性。
 * @param {object} r paipan() 返回
 * @returns {string} HTML 字符串
 */
export function fuXingYaoLan(r) {
  const palaces = r.palaces.filter((p) => p.minorStars && p.minorStars.length > 0);
  if (!palaces.length) return '';

  const cards = palaces.map((p) => {
    const label = `${p.name}${p.isSoul ? ' · 命' : p.isBody ? ' · 身' : ''}`;
    const starItems = p.minorStars.map((s) => {
      const d = MINOR_DESC[s.name] || null;
      const cls = d ? MINOR_CLS_MAP[d.cls] : 'm';
      const clsLabel = d ? d.cls : '中性';
      const kw = d ? d.kw : '';
      return `<div class="fx-star fx-star-${cls}" title="${kw}">
        <b>${s.name}</b><i class="fx-tag fx-${cls}">${clsLabel}</i>
        ${kw ? `<span class="fx-kw">${kw}</span>` : ''}
      </div>`;
    }).join('');

    const descs = p.minorStars.map((s) => {
      const d = MINOR_DESC[s.name];
      return d ? `<span class="fx-note-item">${s.name}：${d.note}</span>` : null;
    }).filter(Boolean);

    return `
      <div class="fx-palace panel glass fade-in">
        <div class="fx-palace-head">
          <b class="fx-pname">${label}</b><em class="fx-gz">${p.gan}${p.zhi}</em>
        </div>
        <div class="fx-stars">${starItems}</div>
        ${descs.length ? `<div class="fx-desc">${descs.join('<br>')}</div>` : ''}
      </div>`;
  }).join('');

  return `
    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>辅星一览</h2>
        <span class="hint">十四辅星 · 吉煞中性三色 · 配合主星参详</span></div>
      <div class="fx-grid">${cards}</div>
      <div class="fx-tips d" style="margin-top:8px;font-size:12px;color:var(--text-faint)">辅星为吉凶之辅助参照，吉凶主星为纲、辅星为目；趋吉避凶仍以整体命盘与大运流年为主。</div>
    </div>`;
}

/* ── 十二宫人事主题速查 ──────────────────────────── */

/** 十二宫人事数据表（古籍口径）：宫名 / 人事主题 / 主管意象 / 常见事象 tags */
const PALACE_TABLE = [
    { name: '命宫',  theme: '自身·性格格局',   image: '主管一生格局禀赋与性情根基',           tags: ['格局判断', '性情气质', '身心状态', '人生主轴'] },
    { name: '兄弟',  theme: '手足·平辈姊妹缘', image: '主管手足情缘与平辈助力',               tags: ['手足缘薄厚', '平辈关系', '合伙互助', '近邻情谊'] },
    { name: '夫妻',  theme: '感情·配偶',        image: '主管婚恋缘分与感情经营',               tags: ['婚恋时机', '配偶状况', '感情经营', '离合聚散'] },
    { name: '子女',  theme: '子嗣·下属门生',   image: '主管子嗣缘分与下属桃李',               tags: ['子嗣缘深浅', '下属关系', '桃李情谊', '生育状况'] },
    { name: '财帛',  theme: '财富·理财',        image: '主管钱财得失去留与求财方式',           tags: ['正财偏财', '开源节流', '理财方式', '财运盛衰'] },
    { name: '疾厄',  theme: '健康·身体',        image: '主管身体健康与疾病灾厄',               tags: ['体质强弱', '慢性疾患', '意外灾厄', '养生方向'] },
    { name: '迁移',  theme: '外出·机遇·远行',  image: '主管外出际遇与离乡发展',               tags: ['出行运势', '外地发展', '人际际遇', '离乡得失'] },
    { name: '仆役',  theme: '交友·部属',        image: '主管朋友助力与部属缘分',               tags: ['贵人助力', '友情质量', '部属忠诚', '合作吉凶'] },
    { name: '官禄',  theme: '事业·学业·名位',  image: '主管事业升迁功名与学业成就',           tags: ['事业发展', '升迁时机', '学业功名', '工作运势'] },
    { name: '田宅',  theme: '不动产·家庭',      image: '主管家业房产与居家环境',               tags: ['置产时机', '家庭关系', '居家环境', '祖业家业'] },
    { name: '福德',  theme: '精神·福泽·享福',  image: '主管精神福泽与内心喜忧',               tags: ['精神状态', '兴趣享乐', '内心安宁', '福报积累'] },
    { name: '父母',  theme: '父母·文书·长辈',  image: '主管父母长辈缘分与文书证件',           tags: ['父母缘深浅', '长辈贵人', '文书合约', '功名考试'] },
];

/**
 * 十二宫人事速查折叠区
 * @returns {string} HTML 字符串
 */
export function palaceThemeTableHtml() {
    const rows = PALACE_TABLE.map((p) => {
        const tagHtml = p.tags.map((t) => `<span class="zwt-tag">${t}</span>`).join('');
        return `
        <div class="zwt-item">
          <div class="zwt-name">${p.name}</div>
          <div class="zwt-theme">${p.theme}</div>
          <div class="zwt-image">${p.image}</div>
          <div class="zwt-tags">${tagHtml}</div>
        </div>`;
    }).join('');

    return `
    <details class="hl-details zwt-details fade-in d2">
      <summary>十二宫人事速查 <span class="hint">紫微斗数 · 古籍口径</span></summary>
      <div class="zwt-grid">${rows}</div>
      <div class="d" style="margin-top:10px;font-size:12px;color:var(--text-faint)">
        十二宫管人事，吉凶仍以主星庙旺、三方四正与四化综合论之，命理当雷达，不当牢笼。
      </div>
    </details>`;
}

/* ── 星曜五行速查 ────────────────────────────────── */

const WUXING_IMG = { 木: '生发·变通', 火: '热情·激烈', 土: '厚重·安稳', 金: '刚锐·肃杀', 水: '流动·智慧' };

/**
 * 星曜五行速查折叠区：列出十四主星 + 常用辅星的五行阴阳与五行意象。
 * @returns {string} HTML 字符串
 */
export function wuxingYaoLanHtml() {
  const MAIN = ['紫微','天机','太阳','武曲','天同','廉贞','天府','太阴','贪狼','巨门','天相','天梁','七杀','破军'];
  const MINOR = ['左辅','右弼','文昌','文曲','天魁','天钺','禄存','擎羊','陀罗','火星','铃星','地空','地劫','天马'];

  const renderItem = (name) => {
    const wx = STAR_WUXING[name];
    if (!wx) return '';
    const element = wx.split('·')[0];
    const img = WUXING_IMG[element] || element;
    return `<span class="wx-item"><b>${name}</b><em>属${wx}</em><small>${img}</small></span>`;
  };

  return `
    <details class="section wx-details fade-in">
      <summary class="section-head" style="cursor:pointer;list-style:none">
        <span class="tick"></span><h2>星曜五行速查</h2>
        <span class="hint">五行属性 · 阴阳性情 · 参考口径</span>
      </summary>
      <div class="wx-group">
        <div class="wx-label">十四主星</div>
        <div class="wx-list">${MAIN.map(renderItem).join('')}</div>
      </div>
      <div class="wx-group">
        <div class="wx-label">常用辅星</div>
        <div class="wx-list">${MINOR.map(renderItem).join('')}</div>
      </div>
      <div class="d" style="margin-top:8px;font-size:12px;color:var(--text-faint)">五行属阴阳为星曜性情之参考，古籍口径并非唯一定论；命理当雷达，不当牢笼，宜结合整体命盘综合参详。</div>
    </details>`;
}

/* ── 斗数术语速查 ────────────────────────────────── */

/** 斗数常用术语表：术语名 / 一句话定义 / 类别（排盘·星曜·运限） */
const ZW_TERMS = [
    { term: '五行局', cat: '排盘', def: '命宫干支纳音定局数（水2·木3·金4·土5·火6），决定紫微星安星起点与大限起运年龄。' },
    { term: '命宫',   cat: '排盘', def: '紫微斗数第一宫，主一生性格格局与人生走向，是论断命盘的核心基准宫。' },
    { term: '身宫',   cat: '排盘', def: '后天精力投注之处，主为人处世方式与中年后际遇重心，由生年支六冲对定星。' },
    { term: '十二宫', cat: '排盘', def: '命宫起，顺序排列兄弟·夫妻·子女·财帛·疾厄·迁移·仆役·官禄·田宅·福德·父母十二人事宫。' },
    { term: '三方四正', cat: '排盘', def: '命财官三合宫加迁移对宫共四宫，是论断吉凶格局的核心视角，四宫会星即成格局。' },
    { term: '对宫',   cat: '排盘', def: '与本宫相隔六宫的正对宫位，主「照」射关系，论命时常与本宫互参。' },
    { term: '借对宫', cat: '排盘', def: '空宫无主星时，借对面宫的主星参断本宫人事，为紫微空宫论法之核心。' },
    { term: '十四主星', cat: '星曜', def: '紫微·天机·太阳·武曲·天同·廉贞·天府·太阴·贪狼·巨门·天相·天梁·七杀·破军，分紫微系与天府系两大星系。' },
    { term: '六吉六煞', cat: '星曜', def: '六吉：左辅右弼文昌文曲天魁天钺，为助力吉星；六煞：擎羊陀罗火星铃星地空地劫，为冲击煞星。' },
    { term: '庙旺平陷', cat: '星曜', def: '星曜在所在宫的「亮度」等级——庙旺得力为吉·利平为中·陷不得力为弱，是判断星力强弱的基准。' },
    { term: '四化',   cat: '星曜', def: '禄权科忌四星化气——禄主机缘·权主担责·科主名望·忌主执着提醒，是命盘吉凶流转之枢纽。' },
    { term: '紫微星系', cat: '星曜', def: '紫微为帝座，附属天机·太阳·武曲·天同·廉贞五颗，在子丑寅卯辰巳六宫落位。' },
    { term: '天府星系', cat: '星曜', def: '天府为南斗主，附属太阴·贪狼·巨门·天相·天梁·七杀·破军七颗，与紫微系分布十二宫。' },
    { term: '杀破狼',  cat: '星曜', def: '七杀·破军·贪狼三星组合，主变动开创冒险，入命宫三方多主起伏大而前景广阔。' },
    { term: '机月同梁', cat: '星曜', def: '天机·太阴·天同·天梁四星组合，主稳健辅佐职，入命三方宜任职而不宜独力创业。' },
    { term: '大限',   cat: '运限', def: '每十年一段行运宫，依五行局顺逆行，论该十年人生主题与吉凶倾向，是运程分析的主框架。' },
    { term: '小限',   cat: '运限', def: '每年流转一宫，以生年为始，配合流年干支论断当年人事轻重，辅佐流年四化参详。' },
    { term: '流年',   cat: '运限', def: '当年岁次，以流年天干起四化，看化禄化权化科化忌落在原盘何宫，定该年吉凶方向。' },
    { term: '流年四化', cat: '运限', def: '以流年岁干起禄权科忌，落宫即该年人事重点——化忌落宫为当年最需留意处，宜主动化解。' },
    { term: '命主·身主', cat: '运限', def: '命主依生年支六合定星，主一生方向；身主依生年支六冲定星，主后天重心，中年后尤重。' },
];

/**
 * 斗数术语速查折叠区
 * @returns {string} HTML 字符串
 */
export function ziweiTermsHtml() {
    const catCls = { '排盘': 'cat-paipan', '星曜': 'cat-xingyao', '运限': 'cat-yunxian' };
    const items = ZW_TERMS.map((t) => `
        <div class="zterm-item">
          <div class="zterm-head">
            <span class="zterm-name">${t.term}</span>
            <span class="zterm-cat ${catCls[t.cat] || ''}">${t.cat}</span>
          </div>
          <div class="zterm-def">${t.def}</div>
        </div>`).join('');

    return `
    <details class="hl-details zwt2-details fade-in d3">
      <summary>斗数术语速查 <span class="hint">常用名词 · 排盘 / 星曜 / 运限</span></summary>
      <div class="zterm-grid">${items}</div>
      <div class="d" style="margin-top:10px;font-size:12px;color:var(--text-faint)">
        术语为理解命盘之助，吉凶仍以整体格局与运限综合论之，命理当雷达，不当牢笼。
      </div>
    </details>`;
}

/* ── 四化落宫意象速查 ────────────────────────────── */

/**
 * 四化落十二宫意象表（古籍通行口径）：4 化 × 12 宫 = 48 条
 * 结构：{ 禄|权|科|忌: { 宫名: '意象一句' } }
 */
export const SIHUA_PALACE = {
    禄: {
        命宫: '机遇临身，自身气场旺盛，得天时相助易有所成',
        父母: '长辈文书有助，父母缘厚，文书证件顺利',
        福德: '精神享乐丰裕，内心喜悦，生活品质自然提升',
        田宅: '居家安稳，置产有利，家业财源稳步积聚',
        官禄: '事业有喜，工作开展顺畅，功名出路渐宽',
        仆役: '人脉广结，朋友助力多，合作易有收益',
        迁移: '出行际遇佳，外地机缘好，离乡发展有利',
        疾厄: '身体元气充足，健康状态向好，忌怠惰过度享乐',
        财帛: '财源有进，正财偏财皆见增益，理财顺畅',
        子女: '子嗣缘深，下属门生助力，创作事业有产出',
        夫妻: '感情缘份增温，婚恋顺遂，配偶助力明显',
        兄弟: '手足平辈相助，合伙共事有利，团队氛围和谐',
    },
    权: {
        命宫: '自立掌权，主动担责，性格刚健有领导气场',
        父母: '长辈有权威，与上司关系主动，文书有决策力',
        福德: '精神主动进取，内心意志强，兴趣执行力高',
        田宅: '家业主动经营，置产有主导权，家庭话语权重',
        官禄: '事业有为，升迁主动，手握职权掌方向',
        仆役: '驭人有道，部属服从，人际主动主导',
        迁移: '外出主动开拓，际遇靠自身争取，行动力强',
        疾厄: '身体能量强，但宜防过度用力造成压力积累',
        财帛: '主动求财，财权握于己手，经营能力强',
        子女: '对子女或下属有主导管理欲，教育主动把关',
        夫妻: '感情中主导强势，配偶关系宜留余地以防压制',
        兄弟: '在手足平辈中居主导地位，有带头倾向',
    },
    科: {
        命宫: '名声自彰，文雅气质凸显，贵人提携自然而至',
        父母: '长辈文书缘佳，考试功名有光，文件顺利',
        福德: '精神文化涵养丰厚，内心平和，享受雅趣',
        田宅: '居家文雅有品，家庭教育氛围好，置产有文书助',
        官禄: '功名有光，学业事业皆得名望，形象加分',
        仆役: '人缘极佳，善得文友助力，名声在人脉中传扬',
        迁移: '外出形象好，广结善缘，出行有贵人相助',
        疾厄: '身体保养有道，养生名声佳，医缘良好',
        财帛: '财来有名有义，理财形象好，正当途径取财',
        子女: '子女聪慧有名，桃李形象佳，教育成果显',
        夫妻: '感情文雅有缘，配偶有名望，婚恋形象加分',
        兄弟: '手足平辈中有名望之人，文化交流顺畅',
    },
    忌: {
        命宫: '自我执着较深，宜觉察内心执念，主动松绑自我限制',
        父母: '与长辈或文书有摩擦，证件文书宜细心核查，留意父母健康',
        福德: '内心纠结，精神压力积累，宜培养静心习惯主动疏解',
        田宅: '居家或房产有波折，家庭关系有压力，宜耐心沟通化解',
        官禄: '事业有阻，工作压力大，宜主动应对而非拖延回避',
        仆役: '人际有摩擦，朋友或部属关系需留意，防小人口舌',
        迁移: '出行多阻，外地际遇不顺，宜多做准备再行动',
        疾厄: '身体宜多关注，留意慢性积累问题，养生调理为上',
        财帛: '破财防损，财务宜保守谨慎，防借贷投资风险',
        子女: '与子女或下属有执着纠结，沟通宜耐心留余地',
        夫妻: '感情执着纠结，婚恋有摩擦，宜主动沟通化解执念',
        兄弟: '手足或平辈有口舌矛盾，合伙事宜宜谨慎立约',
    },
};

/**
 * 四化落宫意象速查 HTML 折叠区
 * @returns {string} HTML 字符串
 */
export function sihuaPalaceHtml() {
    const PALACES_ORDER = ['命宫', '父母', '福德', '田宅', '官禄', '仆役', '迁移', '疾厄', '财帛', '子女', '夫妻', '兄弟'];
    const HUA_LIST = [
        { key: '禄', label: '禄', desc: HUA_MEANING['禄'], cls: 'shp-group-lu' },
        { key: '权', label: '权', desc: HUA_MEANING['权'], cls: 'shp-group-quan' },
        { key: '科', label: '科', desc: HUA_MEANING['科'], cls: 'shp-group-ke' },
        { key: '忌', label: '忌', desc: HUA_MEANING['忌'], cls: 'shp-group-ji', special: true },
    ];

    const groupsHtml = HUA_LIST.map(({ key, label, desc, cls, special }) => {
        const items = PALACES_ORDER.map((pal) => {
            const meaning = SIHUA_PALACE[key][pal] || '—';
            return `<div class="shp-item${special ? ' shp-item-ji' : ''}">
              <div class="shp-pal">${pal}</div>
              <div class="shp-meaning">${meaning}</div>
            </div>`;
        }).join('');
        const jiNote = special
            ? `<div class="shp-ji-note">化忌为提醒非判决——落宫指出执着与需留意处，宜主动觉察化解，非消极定论。</div>`
            : '';
        return `
        <div class="shp-group ${cls}">
          <div class="shp-group-head">
            <span class="shp-hua-label">${label}</span>
            <span class="shp-hua-desc">${desc}</span>
          </div>
          ${jiNote}
          <div class="shp-grid">${items}</div>
        </div>`;
    }).join('');

    return `
    <details class="hl-details shp-details fade-in d3">
      <summary>四化落宫意象速查 · 禄权科忌 <span class="hint">4 化 × 12 宫 · 古籍通行口径</span></summary>
      ${groupsHtml}
      <div class="shp-note d">四化为吉凶之枢，落宫意象须结合星曜庙旺与整体格局综合参详，命理当雷达，不当牢笼。</div>
    </details>`;
}

/** 常见格局速查总表 HTML 折叠区 */
export function gejuTableHtml(r) {
    if (!KB || !KB.geju) return '';
    const soulP = r.palaces.find((p) => p.isSoul);
    const hits = soulP ? matchGeju(r, soulP) : [];
    const hitNames = new Set(hits.map((g) => g.name));

    const escStr = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const cards = KB.geju.map((g) => {
        const isHit = hitNames.has(g.name);
        const badge = isHit ? `<span class="gj-badge">命中</span>` : '';
        return `<div class="gj-item${isHit ? ' hit' : ''}">
          <div class="gj-name${isHit ? ' hit' : ''}">${escStr(g.name)}${badge}</div>
          <div class="gj-stars">${escStr(g.stars || '')}</div>
          <div class="gj-duan">${escStr(g.duan || '')}</div>
          <div class="gj-note">${escStr(g.note || '')}</div>
        </div>`;
    }).join('');

    return `
    <details class="hl-details gj-details fade-in">
      <summary>常见格局速查 · 依古法格局论命 <span class="hint">${KB.geju.length} 格局 · 命中高亮</span></summary>
      <div class="gj-grid">${cards}</div>
      <div class="hl-note">格局为古法论命之参照，须结合主星庙旺、三方四正与四化综合参详；格局成否不以单一条件定论，命理当雷达，不当牢笼。</div>
    </details>`;
}

export function zhuStarTableHtml() {
  const ORDER = ['紫微','天机','太阳','武曲','天同','廉贞','天府','太阴','贪狼','巨门','天相','天梁','七杀','破军'];
  const SHU = {
    紫微: '帝座·事业权威', 天机: '智慧·谋划变动', 太阳: '光明·博爱名声',
    武曲: '财星·刚毅实干', 天同: '福星·安逸协调', 廉贞: '次桃花·官禄品格',
    天府: '库星·厚藏稳健', 太阴: '财星·田宅母荫', 贪狼: '欲望·才艺桃花',
    巨门: '口才·是非暗星', 天相: '印星·辅佐协调', 天梁: '荫星·解厄清高',
    七杀: '肃杀·变革先锋', 破军: '破耗·先破后立',
  };
  const JI_SET = new Set(['武曲','贪狼','巨门','廉贞','七杀','破军']);
  const cards = ORDER.map((name) => {
    const wx = STAR_WUXING[name] || '';
    const desc = STAR_DESC[name] || '';
    const shu = SHU[name] || '';
    const isJi = JI_SET.has(name);
    const tag = isJi
      ? `<span class="zst-tag zst-b">杂·煞</span>`
      : `<span class="zst-tag zst-g">吉</span>`;
    return `<div class="zst-card">
      <div class="zst-head"><span class="zst-name">${name}</span><span class="zst-wx">属${wx}</span></div>
      <div class="zst-shu">${shu}</div>
      <div class="zst-desc">${desc}</div>
      ${tag}
    </div>`;
  }).join('');
  return `
  <details class="hl-details zst-details fade-in">
    <summary>十四主星一览 · 性情与主事 <span class="hint">十四主星通识</span></summary>
    <div class="zst-grid">${cards}</div>
    <div class="hl-note">十四主星性情为参详之本，吉凶仍以庙旺落宫、三方四正与四化综合论断，命理当雷达，不当牢笼。</div>
  </details>`;
}

export function sihuaStarTableHtml() {
  const GANS = [
    { gan: '甲', lu: '廉贞', quan: '破军', ke: '武曲', ji: '太阳' },
    { gan: '乙', lu: '天机', quan: '天梁', ke: '紫微', ji: '太阴' },
    { gan: '丙', lu: '天同', quan: '天机', ke: '文昌', ji: '廉贞' },
    { gan: '丁', lu: '太阴', quan: '天同', ke: '天机', ji: '巨门' },
    { gan: '戊', lu: '贪狼', quan: '太阴', ke: '右弼', ji: '天机' },
    { gan: '己', lu: '武曲', quan: '贪狼', ke: '天梁', ji: '文曲' },
    { gan: '庚', lu: '太阳', quan: '武曲', ke: '太阴', ji: '天同' },
    { gan: '辛', lu: '巨门', quan: '太阳', ke: '文曲', ji: '文昌' },
    { gan: '壬', lu: '天梁', quan: '紫微', ke: '左辅', ji: '武曲' },
    { gan: '癸', lu: '破军', quan: '巨门', ke: '太阴', ji: '贪狼' },
  ];
  const HUA_TITLE = {
    lu: '化禄：机缘流通、财禄顺畅',
    quan: '化权：主动担责、掌控强势',
    ke: '化科：名声文采、贵人提携',
    ji: '化忌：执着纠缠、须留意化解',
  };
  const rows = GANS.map(({ gan, lu, quan, ke, ji }) => `
    <div class="sh4-row">
      <span class="sh4-gan">${gan}</span>
      <div class="sh4-huas">
        <span class="sh4-hua lu" title="${HUA_TITLE.lu}"><b>${lu}</b><i>化禄</i></span>
        <span class="sh4-hua quan" title="${HUA_TITLE.quan}"><b>${quan}</b><i>化权</i></span>
        <span class="sh4-hua ke" title="${HUA_TITLE.ke}"><b>${ke}</b><i>化科</i></span>
        <span class="sh4-hua ji" title="${HUA_TITLE.ji}"><b>${ji}</b><i>化忌</i></span>
      </div>
    </div>`).join('');
  return `
  <details class="hl-details sh4-details fade-in">
    <summary>四化星速查 · 十干四化对照 <span class="hint">禄权科忌</span></summary>
    ${rows}
    <div class="hl-note">四化为星曜吉凶之枢，化禄主机缘、化权主主动担责、化科主名声、化忌主执着须留意；吉凶仍以庙旺落宫与整体格局综合论断，命理当雷达，不当牢笼。</div>
  </details>`;
}

export function anxingTableHtml() {
  const escStr = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const cards = [
    {
      name: '起寅安宫诀',
      koujue: '寅宫起正月，顺数至生月；\n生月宫起子，逆数生时定命宫；\n顺数生时定身宫。',
      desc: '以寅宫为正月起点顺数到生月，再从该宫以子时逆数生时，落宫即命宫；顺数生时得身宫。',
    },
    {
      name: '定十二宫诀',
      koujue: '命宫既定，逆布十二宫：\n兄弟 · 夫妻 · 子女 · 财帛 · 疾厄 · 迁移\n仆役 · 官禄 · 田宅 · 福德 · 父母 · 命宫（循环）。',
      desc: '命宫定后，逆时针依次排布十一宫，构成紫微斗数基本宫位框架。',
    },
    {
      name: '起五行局诀',
      koujue: '水二局 · 木三局 · 金四局 · 土五局 · 火六局，\n以命宫干支查纳音五行定局。\n局数即起限岁数，亦决定紫微星落宫起法。',
      desc: '纳音五行决定五行局，局数为小限起运年岁，也是安紫微星的计数基础。',
    },
    {
      name: '安紫微星诀',
      koujue: '紫微逆去天机安，隔一太阳武曲联，\n天同再隔廉贞地，空三复见紫微垣。\n五行局数定紫微所在宫，余星依诀逆布。',
      desc: '五行局数在十二宫中定出紫微位，随后逆行依口诀间隔排布天机、太阳、武曲、天同、廉贞五星。',
    },
    {
      name: '天府星系诀',
      koujue: '紫微对宫起天府，顺行布：\n太阴 · 贪狼 · 巨门 · 天相 · 天梁 · 七杀；\n破军与紫微同宫对位（紫府同宫时天府居寅申）。',
      desc: '天府与紫微永远对宫，以天府为起点顺时针依次安布天府系六星，破军居紫微对面。',
    },
    {
      name: '安辅星诀',
      koujue: '左辅辰月起，顺数生月定位；\n右弼戌月起，逆数生月定位；\n文昌戌起顺，文曲辰起逆，均以生时数；\n天魁天钺年干起；禄存随年干；\n擎羊陀罗居禄存前后一位；\n火星铃星年支起；天马年支定。',
      desc: '六吉六煞诸辅星各有固定起点与顺逆数法，以生年月时干支分别安布。',
    },
    {
      name: '起大限诀',
      koujue: '阳男阴女顺行大限，阴男阳女逆行大限；\n水二局2岁起，木三局3岁起，\n金四局4岁起，土五局5岁起，火六局6岁起；\n自命宫起，每宫十年一大限，循十二宫。',
      desc: '阴阳男女决定大限顺逆方向，局数决定起限年岁，每十年经过一宫为一大限。',
    },
    {
      name: '四化诀',
      koujue: '甲廉破武阳　乙机梁紫阴\n丙同机昌廉　丁阴同机巨\n戊贪阴弼机　己武贪梁曲\n庚阳武阴同　辛巨阳曲昌\n壬梁紫左武　癸破巨阴贪\n（顺序：化禄·化权·化科·化忌）',
      desc: '十天干各化四星，禄权科忌依序对应；流年大限宫干亦可起四化，以判断该限运吉凶侧重。',
    },
  ];

  const cardHtml = cards.map(({ name, koujue, desc }) => `
    <div class="anx-card">
      <div class="anx-name">${escStr(name)}</div>
      <pre class="anx-koujue">${escStr(koujue)}</pre>
      <div class="anx-desc">${escStr(desc)}</div>
    </div>`).join('');

  return `
  <details class="hl-details anx-details fade-in">
    <summary>安星口诀速查 · 紫微斗数排盘诸诀 <span class="hint">斗数全书</span></summary>
    <div class="anx-grid">${cardHtml}</div>
    <div class="hl-note">安星诀为排盘基础，助理解命盘星曜排布，吉凶仍以庙旺落宫、三方四正与四化综合论断，命理当雷达，不当牢笼。</div>
  </details>`;
}

/** 主星庙旺落陷速查 · 十四主星亮度矩阵 */
export function miaoXianTableHtml() {
  const escStr = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /* 十二地支顺序（子=0…亥=11），与 ziwei-brightness.json 数组下标一致 */
  const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  /* 十四主星：显示名 + JSON 键名 */
  const STARS = [
    { cn: '紫微', key: 'ziweiMaj' },
    { cn: '天机', key: 'tianjiMaj' },
    { cn: '太阳', key: 'taiyangMaj' },
    { cn: '武曲', key: 'wuquMaj' },
    { cn: '天同', key: 'tiantongMaj' },
    { cn: '廉贞', key: 'lianzhenMaj' },
    { cn: '天府', key: 'tianfuMaj' },
    { cn: '太阴', key: 'taiyinMaj' },
    { cn: '贪狼', key: 'tanlangMaj' },
    { cn: '巨门', key: 'jumenMaj' },
    { cn: '天相', key: 'tianxiangMaj' },
    { cn: '天梁', key: 'tianliangMaj' },
    { cn: '七杀', key: 'qishaMaj' },
    { cn: '破军', key: 'pojunMaj' },
  ];

  /* 硬编码亮度数据（与 frontend/data/ziwei-brightness.json 一致，子→亥下标 0-11） */
  const BRI_DATA = {
    ziweiMaj:    ['wang','wang','de','wang','miao','miao','wang','wang','de','wang','ping','miao'],
    tianjiMaj:   ['de','wang','li','ping','miao','xian','de','wang','li','ping','miao','xian'],
    taiyangMaj:  ['wang','miao','wang','wang','wang','de','de','xian','bu','xian','xian','bu'],
    wuquMaj:     ['de','li','miao','ping','wang','miao','de','li','miao','ping','wang','miao'],
    tiantongMaj: ['li','ping','ping','miao','xian','bu','wang','ping','ping','miao','wang','bu'],
    lianzhenMaj: ['miao','ping','li','xian','ping','li','miao','ping','li','xian','ping','li'],
    tianfuMaj:   ['miao','de','miao','de','wang','miao','de','wang','miao','de','miao','miao'],
    taiyinMaj:   ['wang','xian','xian','xian','bu','bu','li','bu','wang','miao','miao','miao'],
    tanlangMaj:  ['ping','li','miao','xian','wang','miao','ping','li','miao','xian','wang','miao'],
    jumenMaj:    ['miao','miao','xian','wang','wang','bu','miao','miao','xian','wang','wang','bu'],
    tianxiangMaj:['miao','xian','de','de','miao','de','miao','xian','de','de','miao','miao'],
    tianliangMaj:['miao','miao','miao','xian','miao','wang','xian','de','miao','xian','miao','wang'],
    qishaMaj:    ['miao','wang','miao','ping','wang','miao','miao','miao','miao','ping','wang','miao'],
    pojunMaj:    ['de','xian','wang','ping','miao','wang','de','xian','wang','ping','miao','wang'],
  };

  /* 亮度中文映射 */
  const BRI_CN = { miao: '庙', wang: '旺', de: '得', li: '利', ping: '平', xian: '陷', bu: '不' };
  /* 三档颜色 class（复用文件级 BRIGHT_CLS 逻辑） */
  const BRI_CLS = { miao: 's', wang: 's', de: 's', li: 'm', ping: 'm', xian: 'b', bu: 'b' };

  /* 表头行 */
  const headerCells = ZHI.map(z => `<th class="mw-th">${escStr(z)}</th>`).join('');
  const header = `<tr class="mw-header-row"><th class="mw-star-th">主星</th>${headerCells}</tr>`;

  /* 数据行 */
  const dataRows = STARS.map(({ cn, key }) => {
    const arr = BRI_DATA[key] || [];
    const cells = ZHI.map((_, i) => {
      const val = arr[i] || '';
      const cls = BRI_CLS[val] || '';
      const label = BRI_CN[val] || val;
      return `<td class="mw-cell mw-cell-${cls}">${escStr(label)}</td>`;
    }).join('');
    return `<tr class="mw-row"><td class="mw-star-name">${escStr(cn)}</td>${cells}</tr>`;
  }).join('');

  /* 图例 */
  const legend = `<div class="mw-legend">
    <span class="mw-legend-item mw-cell-s">庙旺得 · 吉</span>
    <span class="mw-legend-item mw-cell-m">利平 · 中</span>
    <span class="mw-legend-item mw-cell-b">陷不 · 凶</span>
  </div>`;

  return `
  <details class="hl-details mw-details fade-in">
    <summary>主星庙旺落陷速查 · 十四主星亮度矩阵<span class="hint">庙旺得吉 · 利平 · 陷不凶</span></summary>
    <div class="mw-scroll">
      <table class="mw-table">
        <thead>${header}</thead>
        <tbody>${dataRows}</tbody>
      </table>
    </div>
    ${legend}
    <div class="hl-note">庙旺落陷为星曜力量之参考，吉凶仍以整体格局、三方四正与四化综合论断，命理当雷达，不当牢笼。</div>
  </details>`;
}

/** 三方四正速查 · 十二宫三合会照 */
export function sanFangTableHtml() {
  const escStr = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const PALACE = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母'];
  const NOTE = [
    '命为枢机，观身命强弱以定格局',
    '论兄弟手足与同辈助力',
    '论配偶缘分与感情经营',
    '论子息桃花与门庭',
    '论钱财得失去留',
    '论体质健康与隐忧',
    '论外出发展与环境变化',
    '论交友人际与部属',
    '论事业功名与升迁',
    '论家宅根基与祖业',
    '论精神享受与福分',
    '论长辈师长与文书',
  ];

  const cardsHtml = ZHI.map((zhi, i) => {
    const tri1 = (i + 4) % 12;
    const tri2 = (i + 8) % 12;
    const dui  = (i + 6) % 12;
    return `<div class="sf3-card">
  <div class="sf3-name">${escStr(PALACE[i])} · ${escStr(zhi)}</div>
  <div class="sf3-tri">三方：${escStr(ZHI[tri1])}(${escStr(PALACE[tri1])}) ${escStr(ZHI[tri2])}(${escStr(PALACE[tri2])})</div>
  <div class="sf3-dui">对宫：${escStr(ZHI[dui])}(${escStr(PALACE[dui])})</div>
  <div class="sf3-note">${escStr(NOTE[i])}</div>
</div>`;
  }).join('');

  return `<details class="hl-details sf3-details fade-in">
    <summary>三方四正速查 · 十二宫三合会照<span class="hint">斗数论盘</span></summary>
    <div class="sf3-grid">${cardsHtml}</div>
    <div class="hl-note">三方四正为看盘之纲领：本宫看直接吉凶，三合看力量扶助，对宫看拱照呼应，吉凶仍以整体格局与四化综合论断，命理当雷达，不当牢笼。</div>
  </details>`;
}

/** 命主身主速查 · 生年支对应命主身主 */
export function mingShenZhuTableHtml() {
  const escStr = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const DATA = [
    { zhi: '子', ming: '贪狼', shen: '火星', desc: '贪狼主欲望机变，火星主急躁果断' },
    { zhi: '丑', ming: '巨门', shen: '天相', desc: '巨门主口舌是非，天相主印绶辅佐' },
    { zhi: '寅', ming: '禄存', shen: '天梁', desc: '禄存主财禄守成，天梁主荫庇清高' },
    { zhi: '卯', ming: '文曲', shen: '天同', desc: '文曲主文采，天同主福泽' },
    { zhi: '辰', ming: '廉贞', shen: '文昌', desc: '廉贞主次桃花，文昌主科甲' },
    { zhi: '巳', ming: '武曲', shen: '天机', desc: '武曲主财星刚毅，天机主善变' },
    { zhi: '午', ming: '破军', shen: '火星', desc: '破军主破立，火星主急躁果断' },
    { zhi: '未', ming: '武曲', shen: '天相', desc: '武曲主财星刚毅，天相主印绶辅佐' },
    { zhi: '申', ming: '廉贞', shen: '天梁', desc: '廉贞主次桃花，天梁主荫庇清高' },
    { zhi: '酉', ming: '文曲', shen: '天同', desc: '文曲主文采，天同主福泽' },
    { zhi: '戌', ming: '禄存', shen: '文昌', desc: '禄存主财禄守成，文昌主科甲' },
    { zhi: '亥', ming: '巨门', shen: '天机', desc: '巨门主口舌是非，天机主善变' },
  ];

  const rows = DATA.map(({ zhi, ming, shen, desc }) => `
    <div class="msz-row">
      <span class="msz-zhi">${escStr(zhi)}</span>
      <span class="msz-pair"><b>命主</b> ${escStr(ming)}</span>
      <span class="msz-pair"><b>身主</b> ${escStr(shen)}</span>
      <span class="msz-desc">${escStr(desc)}</span>
    </div>`).join('');

  const koujue = '命主：子贪狼丑亥巨门寅戌禄存卯酉文曲辰申廉贞巳未武曲午破军；身主：子午火星丑未天相寅申天梁卯酉天同辰戌文昌巳亥天机';

  return `<details class="hl-details msz-details fade-in">
    <summary>命主身主速查 · 生年支对照 <span class="hint">安星之基</span></summary>
    <div class="msz-list">${rows}
    </div>
    <div class="msz-koujue">${escStr(koujue)}</div>
    <div class="hl-note">命主身主为安星之基础，主先天秉性与后天际遇之倾向，吉凶仍以整体格局、三方四正与四化综合论断，命理当雷达，不当牢笼。</div>
  </details>`;
}

/** 三方四正格匹配：同宫（A+B）或 三方四正会照（/） */
function matchGeju(r, soulP) {
  if (!KB) return [];
  const hits = [];
  const zhiFromYin = (z) => (((r.palaces.findIndex((p) => p.zhi === z)) % 12) + 12) % 12;
  const he = SAN_HE.find((s) => s.zhi.includes(soulP.zhi));
  const sanHeIdx = he ? he.zhi.map(zhiFromYin) : [soulP.index];
  const duiIdx = (soulP.index + 6) % 12;
  const focus = [...new Set([...sanHeIdx, duiIdx])];
  // 星名清洗：'七杀同宫'→'七杀'、'天府同宫(寅/申)'→'天府'、'太阳入庙旺'→'太阳'
  const starNames = (KB.stars || []).map((x) => x.name).sort((a, b) => b.length - a.length);
  const starNameOf = (raw) => {
    const s = String(raw).split('(')[0].trim();
    for (const st of starNames) if (s.startsWith(st)) return st;
    return null;
  };
  for (const g of KB.geju || []) {
    const desc = g.stars || '';
    if (desc.includes('+')) {
      const names = desc.split('+').map(starNameOf).filter(Boolean);
      if (names.length === 2 && names.every((n) => KB.stars.some((x) => x.name === n)) && r.palaces.some((p) => names.every((n) => p.stars.some((s) => s.name === n)))) hits.push(g);
    } else if (desc.includes('/')) {
      const names = desc.split('/').map((s) => s.split('，')[0].split('(')[0].trim()).filter((n) => KB.stars.some((x) => x.name === n));
      if (names.length && names.every((n) => focus.some((i) => r.palaces[i].stars.some((s) => s.name === n)))) hits.push(g);
    }
  }
  return hits.slice(0, 4);
}
