/* app/bazi.js —— 八字排盘 + 命理分析页 */
import { analyze, analyzeYear, yearTrend, monthTrend, monthShiShen, curMonthZhi, suiyunInteraction, liunianPillars, daYunShensha, setKnowledge, TIAOHOU, SHISHEN_YEAR, sanmingDetail, NAYIN, touGanTongGen, gongWeiShiShen, liuQinOf, LIUQIN, xiyongGuide, changShengState } from '../engine/bazi-analyze.js';
import { GAN_WUXING, ZHI_WUXING, xun } from '../engine/ganzhi.js';
import { trueSolarTime } from '../engine/calendar.js';
import { huangliMiniHtml, todayHuangli } from '../engine/huangli.js';
import { paipan as zwPaipan, analyzeYear as zwAnalyzeYear } from '../engine/ziwei.js';

let KB = null;
let LAST = null;
let LAST_ZW = null;
let LAST_EXPORT = '';

/** 神煞一览总表（依渊海子平口径）：起法 + 吉凶 + 含义 */
const SHENSHA_TABLE = [
  { name: '天乙贵人', from: '日干', good: 1, desc: '逢凶化吉，最吉之神', rule: '甲戊庚见丑未 · 乙己见子申 · 丙丁见亥酉 · 壬癸见卯巳 · 辛见午寅' },
  { name: '文昌', from: '日干', good: 1, desc: '聪慧好学，利文才考试', rule: '甲巳 乙午 丙戊申 丁己酉 庚亥 辛子 壬寅 癸卯' },
  { name: '羊刃', from: '日干', good: 0, desc: '刚烈果决，冲劲亦易招破', rule: '甲卯 丙戊午 庚酉 壬子（阴干从禄前后取刃）' },
  { name: '禄神', from: '日干', good: 1, desc: '衣食财禄，事业根基', rule: '甲寅 乙卯 丙巳 丁午 戊巳 己午 庚申 辛酉 壬亥 癸子' },
  { name: '金舆', from: '日干', good: 1, desc: '车马荫庇，自带贵气', rule: '甲辰 乙巳 丙未 丁申 戊未 己申 庚戌 辛亥 壬丑 癸寅' },
  { name: '桃花', from: '年支或日支', good: 0, desc: '人缘与异性缘、审美艺术，旺则风流有情', rule: '申子辰见酉 · 寅午戌见卯 · 巳酉丑见午 · 亥卯未见子' },
  { name: '驿马', from: '年支或日支', good: 0, desc: '奔波变动、远行迁移，主动求新', rule: '申子辰见寅 · 寅午戌见申 · 巳酉丑见亥 · 亥卯未见巳' },
  { name: '华盖', from: '年支', good: 0, desc: '孤高清雅、才艺玄学、宗教缘', rule: '申子辰见辰 · 寅午戌见戌 · 巳酉丑见丑 · 亥卯未见未' },
  { name: '将星', from: '年支', good: 1, desc: '领导威望、统御之能', rule: '申子辰见子 · 寅午戌见午 · 巳酉丑见酉 · 亥卯未见卯' },
  { name: '天德贵人', from: '月支', good: 1, desc: '积善福泽，逢凶化吉', rule: '按月支查天德方（寅月丁、卯月申、辰月壬…）' },
  { name: '月德贵人', from: '月支', good: 1, desc: '福荫安泰，灾祸潜消', rule: '按月支三合局阳干（寅午戌月丙、申子辰月壬…）' },
  { name: '魁罡', from: '日柱', good: 0, desc: '性刚果断，聪明正直', rule: '庚辰 庚戌 戊辰 戊戌 壬辰 壬戌 六日' },
  { name: '红鸾', from: '年支', good: 1, desc: '婚恋喜庆之兆', rule: '年支三合顺数对宫（申子辰见卯…）' },
  { name: '天喜', from: '年支', good: 1, desc: '喜庆吉事临门', rule: '红鸾对冲之支' },
  { name: '空亡', from: '日柱', good: -1, desc: '该宫主事虚而不实，宜静不宜动', rule: '日柱所在旬之空亡二支' },
  { name: '孤辰', from: '年支', good: 0, desc: '孤独自立、清净离群，亦主内省与专注', rule: '地支顺连三合组首 +3 位' },
  { name: '寡宿', from: '年支', good: 0, desc: '孤僻沉静、喜独处，宜静心修行', rule: '三合组首 -1 位' },
  { name: '亡神', from: '年支', good: 0, desc: '心机深沉、操权有谋，正用则旺', rule: '年支三合五行顺排之临官位' },
  { name: '劫煞', from: '年支', good: -1, desc: '行事刚烈、动易有波折，慎防急进', rule: '年支三合五行之绝位（申子辰见巳…）' },
];

export const template = `
  <section class="page-head fade-in">
    <h1>八字排盘 <em>·</em> 命理分析</h1>
    <p>四柱 · 十神 · 旺衰 · 用神 · 大运流年 —— 断语依古籍，离线可推演</p>
  </section>

  <section class="form-panel glass fade-in d1">
    <form id="bazi-form" class="form-grid" autocomplete="off">
      <div class="field">
        <label>姓名 / 备注</label>
        <input type="text" id="f-name" placeholder="留空则以「命主」示人" value="命主">
      </div>
      <div class="field">
        <label>出生时间<span class="opt">公历</span></label>
        <input type="datetime-local" id="f-datetime" value="1990-01-01T08:00" step="60">
      </div>
      <div class="field">
        <label>性别</label>
        <select id="f-gender">
          <option value="男" selected>男</option>
          <option value="女">女</option>
        </select>
      </div>
      <div class="field">
        <label>出生地经度<span class="opt">东经 73.5~135</span></label>
        <input type="number" id="f-lng" value="120" min="73.5" max="135" step="0.01">
      </div>
      <div class="field">
        <label>真太阳时修正<span class="opt">建议开启</span></label>
        <select id="f-true">
          <option value="1" selected>开启（经度 + 均时差）</option>
          <option value="0">关闭（用钟表时间）</option>
        </select>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn">排 盘</button>
        <button type="button" class="btn ghost" id="btn-fill">填入我的命盘</button>
        <button type="button" class="btn ghost" id="btn-share" title="生成含本排盘参数的可分享链接">复制排盘链接</button>
      </div>
    </form>
  </section>

  <div id="bazi-result"></div>
`;

export function mounted(root) {
  const form = root.querySelector('#bazi-form');
  const fill = root.querySelector('#btn-fill');
  const result = root.querySelector('#bazi-result');
  const nameInput = root.querySelector('#f-name');

  // 档案一键排盘：读取上一页选中的命主并填充表单
  try {
    const sel = JSON.parse(localStorage.getItem('mingli.selectedProfile'));
    if (sel && sel.datetime) {
      root.querySelector('#f-datetime').value = sel.datetime;
      root.querySelector('#f-gender').value = sel.gender || '男';
      if (sel.longitude) root.querySelector('#f-lng').value = sel.longitude;
      nameInput.value = sel.name || '命主';
    }
  } catch {}
  localStorage.removeItem('mingli.selectedProfile');

  // 知识库用 fetch 加载（浏览器兼容性优于 import attributes，且离线部署同样可行）
  const kbUrl = new URL('../../data/knowledge-bazi.json', import.meta.url);
  const kbPromise = fetch(kbUrl)
    .then((res) => res.json())
    .then((d) => { setKnowledge(d); KB = d; return d; })
    .catch((e) => console.warn('知识库加载失败', e));

  fill.addEventListener('click', () => {
    root.querySelector('#f-datetime').value = '1990-01-01T08:00';
    root.querySelector('#f-gender').value = '男';
    root.querySelector('#f-lng').value = '120';
    root.querySelector('#f-true').value = '1';
    nameInput.value = '命主';
    run();
  });

  // 分享链接自动排盘：打开 ?t=...&g=...&l=... 直接出盘
  const sp = window.__shareParams;
  if (sp && sp.get('t')) {
    if (sp.get('t')) root.querySelector('#f-datetime').value = sp.get('t');
    if (sp.get('g')) root.querySelector('#f-gender').value = sp.get('g');
    if (sp.get('l')) root.querySelector('#f-lng').value = sp.get('l');
    if (sp.get('true') !== null) root.querySelector('#f-true').value = sp.get('true');
    if (sp.get('n')) nameInput.value = sp.get('n');
  }

  const shareBtn = root.querySelector('#btn-share');
  if (shareBtn) shareBtn.addEventListener('click', () => {
    const t = root.querySelector('#f-datetime').value;
    const g = root.querySelector('#f-gender').value;
    const l = root.querySelector('#f-lng').value;
    const n = nameInput.value.trim() || '命主';
    const tr = root.querySelector('#f-true').value;
    const url = `${location.origin}${location.pathname}#/bazi?t=${encodeURIComponent(t)}&g=${encodeURIComponent(g)}&l=${encodeURIComponent(l)}&n=${encodeURIComponent(n)}&true=${tr}`;
    copyText(url).then(() => {
      shareBtn.textContent = '链接已复制';
      setTimeout(() => { shareBtn.textContent = '复制排盘链接'; }, 1600);
    });
  });

  form.addEventListener('submit', (e) => { e.preventDefault(); run(); });

  function run() {
    const name = nameInput.value.trim() || '命主';
    const raw = new Date(root.querySelector('#f-datetime').value);
    if (Number.isNaN(raw.getTime())) { result.innerHTML = `<div class="tip red fade-in">请输入有效的出生时间。</div>`; return; }
    const gender = root.querySelector('#f-gender').value;
    const lng = parseFloat(root.querySelector('#f-lng').value) || 120;
    const useTrue = root.querySelector('#f-true').value === '1';
    let date = raw;
    let tstInfo = null;
    if (useTrue) { tstInfo = trueSolarTime(raw, lng); date = tstInfo.trueSolar; }
    result.innerHTML = `<div class="panel glass fade-in" style="text-align:center"><p class="sub">推演中…</p></div>`;
    kbPromise.then(() => {
      const r = analyze({ date, gender });
      LAST = r;
      try { LAST_ZW = zwPaipan({ date, gender }); } catch (e) { LAST_ZW = null; }
      result.innerHTML = renderResult(r, { name, useTrue, lng, tstInfo });
      result.querySelectorAll('.fade-in').forEach((el) => { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; });
      bindLiunian(result, r);
      bindHecan(result, r);
      bindDayunLiu(result);
      bindPillarDetail(result);
      LAST_EXPORT = exportText(r, { name, useTrue, lng });
      bindExport(result);
    });
  }

  run(); // 默认盘直接展示
}

/* 流年十神主事月历渲染 */
function renderMonthShiShen(r, year) {
  const ms = monthShiShen(r, year);
  if (ms.error) return '';
  // 喜忌色 class：xi=喜用(绿) / ji=忌神(红) / mid=中和
  const favClass = (fav) => (fav === 'xi' ? 'ms-fav' : fav === 'ji' ? 'ms-ji' : '');
  const cardsHtml = ms.months.map((m) => `
    <div class="ms10-card ${favClass(m.fav)}">
      <div class="ms10-head">
        <b class="ms10-name">${m.monthName}</b>
        <span class="ms10-gz">${m.gz}</span>
      </div>
      <div class="ms10-ss ${favClass(m.fav)}">${m.ganSS}</div>
      <div class="ms10-text">${m.text}</div>
      <div class="ms10-fav-label">${m.fav === 'xi' ? '<span class="ms-fav">喜用</span>' : m.fav === 'ji' ? '<span class="ms-ji">宜慎</span>' : '<span style="color:var(--text-faint)">中和</span>'}</div>
    </div>`).join('');
  return `
    <div class="ms10-wrap fade-in d3" style="margin-top:14px">
      <div class="ms-title">流年十神主事月历 · ${year} ${ms.liunian}<span class="hint">十二节气月 · 依子平十神主事 · 与逐月要点互补</span></div>
      <div class="ms10-grid">${cardsHtml}</div>
      <div class="d" style="margin-top:8px;font-size:12px;color:var(--text-faint)">本历侧重「每月天干对日主的十神主事断语」；逐月要点侧重「月支与日支/流年支的冲合关系」，两者互补参阅。断语源自子平概观，喜忌以身强/身弱为准（绿=喜用 · 红=宜慎 · 灰=中和）。</div>
    </div>`;
}

/* 流年分析渲染 + 事件绑定 */
const CS_MEAN = {
  长生: '初生之气，宜开新局', 沐浴: '沐浴交接，变局之象', 冠带: '渐入佳境，循序而为',
  临官: '当令得势，宜进取', 帝旺: '气数最旺，盛极防衰', 衰: '气转衰微，宜守成',
  病: '气弱带病，宜养晦', 死: '气数将尽，宜静守', 墓: '收藏入库，宜蓄力',
  绝: '气绝待机，慎启新事', 胎: '怀胎待发，宜酝酿', 养: '培育蓄积，宜积累',
};
function renderLiunian(r, year) {
  const y = analyzeYear(r, year);
  if (y.error) return `<div class="tip red fade-in">${y.error}</div>`;
  const flagChips = y.flags.length
    ? y.flags.map((f) => `<span class="ss-chip red">${f}</span>`).join('')
    : '<span style="color:var(--text-faint);font-size:12px">无岁运并临 / 冲提纲 / 伏吟反吟等重冲之象</span>';
  const tiaoHits = y.hitsGan || y.hitsZhi ? `<span class="ss-chip gold">流年干支得调候之气（${r.yongshen.tiaoHou || '—'}）</span>` : '';
  const PAL_CN = { year: '年', month: '月', day: '日', time: '时' };
  const ssHits = (y.shenshaHits || []).map((s) => `<span class="ss-chip" title="${s.desc || ''}">${s.name} <b>@${PAL_CN[s.palace] || ''}柱</b></span>`).join('');
  const si = suiyunInteraction(r, year);
  const SI_CLS = { 吉: 'ok', 谨: 'warn', 平: 'mid', 凶: 'bad' };
  const siHtml = si.tags && si.tags.length ? `
    <div class="suiyun-card fade-in" style="margin-top:10px">
      <div class="suiyun-head"><b>岁运互动</b><span class="hint">流年干支 × 大运干支 · 生克合冲</span>
        <span class="suiyun-lv ${SI_CLS[si.level] || 'mid'}">${si.level}</span></div>
      <div class="suiyun-rows">
        ${si.gan ? `<div class="suiyun-row"><span class="suiyun-part">天干</span><b>${si.gan.text}</b><span class="suiyun-rel">${si.gan.rel}</span></div>` : ''}
        ${si.zhi ? `<div class="suiyun-row"><span class="suiyun-part">地支</span><b>${si.zhi.text}</b><span class="suiyun-rel">${si.zhi.rel}</span></div>` : ''}
      </div>
      <div class="suiyun-text">${si.text}</div>
    </div>` : '';
  const mt = monthTrend(r, year);
  const nowYear = new Date().getFullYear();
  const curZhi = nowYear === year ? curMonthZhi(new Date()) : '';
  const monthsHtml = !mt.error ? mt.months.map((m) => `
    <div class="ms-cell${m.zhi === curZhi ? ' cur' : ''}">
      <div class="ms-head"><b>${m.name}</b><span class="ms-gz">${m.ganzhi}</span><span class="ms-range" title="${m.jie} · ${m.range}">${m.jie}${m.range ? ' · ' + m.range : ''}</span></div>
      <div class="ms-shishen">干 ${m.ganSS} · 支 ${m.zhiSS}</div>
      <div class="ms-tag ${m.score >= 70 ? 'ok' : m.score < 50 ? 'bad' : 'mid'}">${m.tag}</div>
      ${m.flags.length ? `<div class="ms-flags">${m.flags.map((f) => `<span class="ms-flag${/冲|伏吟|刑/.test(f) ? ' warn' : ''}">${f}</span>`).join('')}</div>` : ''}
    </div>`).join('') : '';
  return `
    <div class="grid-cards" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-top:10px">
      <div class="info-card"><div class="k">${y.year} 流年</div><div class="v gold" style="font-size:20px">${y.liunian}</div>
        <div class="d">大运 ${y.daYun}（${y.daYunYears}）</div></div>
      <div class="info-card"><div class="k">天干十神</div><div class="v">${y.ganSS}</div>
        <div class="d">${y.favGan ? '<span class="ok">宜</span> ' : '<span class="red">慎</span> '}财官食伤，为喜神方向</div>
        ${y.ssYearText ? `<div class="d ss-year" style="margin-top:4px;color:var(--text-dim)">${y.ssYearText}</div>` : ''}</div>
      <div class="info-card"><div class="k">地支十神</div><div class="v">${y.zhiSS}</div>
        <div class="d">${y.favZhi ? '<span class="ok">宜</span> ' : '<span class="red">慎</span> '}印比，为忌神方向</div></div>
      <div class="info-card"><div class="k">调候用神</div><div class="v">${y.hitsGan || y.hitsZhi ? '得气' : '未得'}</div>
        <div class="d">调候 ${r.yongshen.tiaoHou || '—'}，本流年${y.hitsGan || y.hitsZhi ? '命中' : '未命中'}</div></div>
      <div class="info-card"><div class="k">流年气数</div><div class="v ${y.yzs === '临官' || y.yzs === '帝旺' || y.yzs === '长生' ? 'gold' : y.yzs === '病' || y.yzs === '死' || y.yzs === '绝' ? 'red' : ''}">${y.yzs}</div>
        <div class="d">${y.liunian[1]}支 日主${r.dayGan} · ${CS_MEAN[y.yzs] || ''}</div></div>
    </div>
    <div class="lp-wrap fade-in d1" style="margin-top:12px">
      <div class="lp-title">流年动四柱<span class="hint">${y.liunian} × 命局四柱 · 逐柱生克合冲</span></div>
      <div class="lp-grid">
        ${liunianPillars(r, year).items.map((it) => `
          <div class="lp-cell">
            <div class="lp-head"><b>${it.palace}</b><span class="lp-gz">${it.gz}</span></div>
            <div class="lp-ss">${it.ganSS}</div>
            ${it.ganRel ? `<div class="lp-rel gan">${it.ganRel.text}</div>` : '<div class="lp-rel none">天干无合冲</div>'}
            ${it.zhiRel ? `<div class="lp-rel zhi">${it.zhiRel.text}</div>` : '<div class="lp-rel none">地支无合冲</div>'}
          </div>`).join('')}
      </div>
      <div class="d" style="margin-top:8px;font-size:12px;color:var(--text-faint)">流年干支动于何柱、如何动——五合入柱主牵动、冲害刑伏吟主应事；具体吉凶仍以旺衰喜忌与岁运全盘为准。</div>
    </div>
    <div style="margin-top:10px">${flagChips}${tiaoHits}</div>
    ${siHtml}
    ${ssHits ? `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center"><span style="font-size:12px;color:var(--text-faint);margin-right:4px">引动神煞</span>${ssHits}</div>` : ''}
    ${mt.error ? '' : `
    <div class="ms-wrap fade-in d2" style="margin-top:12px">
      <div class="ms-title">逐月要点 · ${year} ${mt.liunian}<span class="hint">12 节气月 · 依《协纪辨方书》以节为月界</span></div>
      <div class="ms-grid">${monthsHtml}</div>
      <div class="d" style="margin-top:8px;font-size:12px;color:var(--text-faint)">月干支按五虎遁顺推，节气日为约略前后 ±1 日；流月吉凶依月令与流年/大运冲合而定，作月度节奏参考。</div>
    </div>`}
    ${renderMonthShiShen(r, year)}
    <div class="d" style="margin-top:8px;font-size:12px;color:var(--text-faint)">喜忌方向依身强取克泄耗 / 身弱取生扶判断；岁运冲合并临之年宜静守，可作预警参考。</div>`;
}

function bindLiunian(root, r) {
  const yearInput = root.querySelector('#liunian-year');
  const btn = root.querySelector('#liunian-btn');
  const out = root.querySelector('#liunian-out');
  if (!yearInput || !btn || !out) return;
  const refresh = () => {
    const yr = parseInt(yearInput.value, 10);
    if (!yr || yr < 1900 || yr > 2200) { out.innerHTML = '<div class="tip red fade-in">请输入有效公历年份（1900~2200）。</div>'; return; }
    out.innerHTML = renderLiunian(r, yr);
  };
  btn.addEventListener('click', refresh);
  yearInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') refresh(); });
}

/* 大运流年点击联动：点流年干支 → 自动填入流年分析与双系统合参并刷新 */
function bindDayunLiu(root) {
  const jump = (yr) => {
    if (!yr) return;
    const liunianInput = root.querySelector('#liunian-year');
    const liunianBtn = root.querySelector('#liunian-btn');
    const hecanInput = root.querySelector('#hecan-year');
    const hecanBtn = root.querySelector('#hecan-btn');
    if (liunianInput) liunianInput.value = yr;
    if (liunianBtn) liunianBtn.click();
    if (hecanInput) hecanInput.value = yr;
    if (hecanBtn) hecanBtn.click();
    root.querySelector('.liunian-box')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  root.querySelectorAll('.dayun-step .dy-liu').forEach((el) => {
    el.addEventListener('click', () => jump(Number(el.dataset.year)));
  });
  root.querySelectorAll('.liunian-strip .ls-cell').forEach((el) => {
    el.addEventListener('click', () => jump(Number(el.dataset.year)));
  });
}

/* 四柱点击展开：单击柱体展开该柱纳音 / 藏干 / 长生 / 神煞 / 生克关系 */
function bindPillarDetail(root) {
  root.querySelectorAll('.pillar').forEach((el) => {
    el.addEventListener('click', () => {
      const d = el.querySelector('.p-detail');
      if (!d) return;
      const wasOpen = !d.hidden;
      root.querySelectorAll('.pillar').forEach((x) => { x.classList.remove('open'); x.querySelector('.p-detail')?.setAttribute('hidden', ''); });
      if (!wasOpen) { el.classList.add('open'); d.removeAttribute('hidden'); }
    });
  });
}

/* 命书导出：把排盘结果组装为纯文本并复制到剪贴板 */
export function exportText(r, meta) {
  const L = [];
  L.push('【玄机阁 · 八字命书】');
  L.push(`${meta.name} · ${r.solarText} · ${r.gender} · ${meta.useTrue ? '真太阳时' : '钟表时'}${meta.lng ? `（东经${meta.lng}°）` : ''}`);
  const cangLine = (p) => (p.hideGan || []).map((g, i) => `${g}${p.shiShenZhi?.[i] ? '·' + p.shiShenZhi[i] : ''}`).join('、');
  L.push(`四柱：${r.pillars.year.ganzhi} ${r.pillars.month.ganzhi} ${r.pillars.day.ganzhi} ${r.pillars.time.ganzhi}`);
  L.push(`藏干：${['year', 'month', 'day', 'time'].map((k) => cangLine(r.pillars[k]) || '—').join(' ｜ ')}`);
  const smE = sanmingDetail(r);
  L.push(`三命：胎元${smE.taiYuan.gz}（${smE.taiYuan.naYin}）· 命宫${smE.mingGong.gz}（${smE.mingGong.naYin}）· 身宫${smE.shenGong.gz}（${smE.shenGong.naYin}）`);
  L.push(`日主：${r.dayGan}${r.dayWuxing} · 旺衰 ${r.strength}（${r.deLing ? '得月令' : '失月令'}${r.hasRoot ? '·有根' : '·根弱'}）`);
  L.push(`格局：${r.geju.name} · 调候用神 ${r.yongshen.tiaoHou || '—'} · 扶抑 ${r.yongshen.fuyi}`);
  L.push(`五行权重：${Object.entries(r.wuxingCount).map(([k, v]) => `${k}${v}`).join(' ')}`);
  const missWxTxt = Object.entries(r.wuxingCount).filter(([, v]) => v === 0).map(([k]) => k);
  if (missWxTxt.length) {
    const y0y = new Date().getFullYear();
    const mYr = [];
    for (let i = 0; i < 12; i++) {
      const yc = analyzeYear(r, y0y + i);
      if (yc.error || !yc.liunian || yc.liunian.length < 2) continue;
      if (missWxTxt.includes(GAN_WUXING[yc.liunian[0]]) || missWxTxt.includes(ZHI_WUXING[yc.liunian[1]])) mYr.push(`${y0y + i}（${yc.liunian}）`);
    }
    L.push(`五行缺失：缺 ${missWxTxt.join('、')}${mYr.length ? ` · 未来12年 ${mYr.slice(0, 3).join('、')} 等年引动` : ''}`);
  }
  const _xyg = xiyongGuide(r);
  if (_xyg) {
    L.push(`喜用趋吉：${_xyg.direction}｜幸运色 ${_xyg.colors.map((c) => c.wx + c.color.join('/')).join('、')}｜利方位 ${_xyg.dirs.map((d) => d.wx + d.dir).join('、')}`);
  }
  L.push(`十神分布：${r.shishenSummary.map((s) => `${s.name}${s.n}`).join(' ')}`);
  const tgEx = touGanTongGen(r);
  L.push(`透干通根：${tgEx.map((x) => `${x.palace}干${x.gan}${x.floating ? '无根虚浮' : '通根' + x.roots.map((rt) => `${rt.zhi}·${rt.qi}${rt.n > 1 ? '×' + rt.n : ''}`).join('、')}`).join('；')}`);
  L.push(`宫位十神：${gongWeiShiShen(r).map((x) => `${x.palace}柱${x.gan}${x.ganSS}·${x.zhi}藏${x.zhiMain}${x.zhiMainSS}`).join('；')}`);
  L.push(`六亲：${liuQinOf(r).map((x) => `${x.palace}柱${x.gan}${x.ss}→${x.kin || '—'}`).join('；')}`);
  if (r.shensha.length) L.push(`神煞：${r.shensha.map((s) => s.name + (s.good ? '' : '(空)')).join('、')}`);
  const qyY = r.qiYun.startSolar ? r.qiYun.startSolar.getYear() : 0;
  const qyEYang = ['甲', '丙', '戊', '庚', '壬'].includes(r.pillars.year.gan);
  const qyEShun = qyEYang === (r.gender === '男');
  L.push(`起运：约 ${qyY ? qyY - new Date(r.solarText.slice(0, 10)).getFullYear() + 1 : r.qiYun.startYear + 1} 虚岁起运（${r.qiYun.startYear}年${r.qiYun.startMonth}月${r.qiYun.startDay}日）· ${qyEYang ? '阳' : '阴'}${r.gender === '男' ? '男' : '女'}${qyEShun ? '顺' : '逆'}排`);
  L.push(`大运：${r.daYun.map((d) => `${d.ganzhi}(${d.startYear}~${d.endYear}${d.startSolar ? ' 交运' + d.startSolar : ''})`).join(' ')}`);
  const dysAll = daYunShensha(r);
  const dysText = dysAll.filter((x) => x.shensha.length).map((x) => `${x.ganzhi} ${x.shensha.map((s) => s.name).join('/')}`).join('；');
  if (dysText) L.push(`大运神煞：${dysText}`);
  const ycNow = analyzeYear(r, new Date().getFullYear());
  if (!ycNow.error) {
    L.push(`今年 ${ycNow.liunian}：干${ycNow.ganSS} 支${ycNow.zhiSS} ${ycNow.favGan && ycNow.favZhi ? '（喜用方向）' : ycNow.favGan || ycNow.favZhi ? '（喜忌参半）' : '（忌神方向）'}${ycNow.flags.length ? ' · ' + ycNow.flags.join('、') : ''}`);
    if (ycNow.ssYearText) L.push(`  十神主事：${ycNow.ssYearText}`);
    if (ycNow.shenshaHits.length) {
      const PAL_CN = { year: '年', month: '月', day: '日', time: '时' };
      L.push(`  引动神煞：${ycNow.shenshaHits.map((s) => `${s.name}（@${PAL_CN[s.palace] || ''}柱）`).join('、')}`);
    }
    const siNow = suiyunInteraction(r, new Date().getFullYear());
    if (siNow.tags && siNow.tags.length) {
      L.push(`  岁运互动：${siNow.tags.join('；')}（${siNow.level}）`);
      L.push(`  　${siNow.text}`);
    }
    const lpNow = liunianPillars(r, new Date().getFullYear());
    if (!lpNow.error) {
      const lpText = lpNow.items.filter((it) => it.ganRel || it.zhiRel).map((it) => `${it.palace}${it.gz}${it.ganRel ? '·' + it.ganRel.text : ''}${it.zhiRel ? '·' + it.zhiRel.text : ''}`).join('；');
      if (lpText) L.push(`  动四柱：${lpText}`);
    }
  }
  if (r.duanyu.length) {
    L.push('断语：');
    r.duanyu.forEach((d) => L.push(`  · ${d.text}`));
  }
  // 流年十神主事月历（当年 12 节气月）
  const msNow = monthShiShen(r, new Date().getFullYear());
  if (!msNow.error) {
    const XI_SET_LABEL = ['正财', '偏财', '正官', '七杀', '食神', '伤官'];
    const favLabel = (fav, ss) => fav === 'xi' ? '喜' : fav === 'ji' ? '慎' : '中';
    L.push(`流年十神主事（${msNow.year} ${msNow.liunian}）：`);
    L.push(msNow.months.map((m) => `  ${m.gz}${m.monthName}【${m.ganSS}·${favLabel(m.fav)}】${m.text}`).join('\n'));
  }
  const hlNow = todayHuangli();
  L.push(`今日黄历：${hlNow.solarText.slice(0, 10)} ${hlNow.dgz}日 · 建除${hlNow.name}（${hlNow.level}）· 宜${hlNow.yi.slice(0, 4).join('/') || '诸事不宜'} · 忌${hlNow.ji.join('/') || '无'}`);
  L.push('—— 玄机阁离线推演 · 预测当雷达，不当牢笼。');
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
  const btn = root.querySelector('#bazi-export');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (!LAST_EXPORT) return;
    copyText(LAST_EXPORT).then(() => {
      btn.textContent = '已 复 制';
      setTimeout(() => { btn.textContent = '复 制 命 书'; }, 1600);
    });
  });
}

/* 双系统合参：八字流年 × 紫微流年 同一年份互证 */
function renderHecan(zw, year) {
  if (!LAST) return '<div class="tip red fade-in">请先完成排盘。</div>';
  const y = analyzeYear(LAST, year);
  if (y.error) return `<div class="tip red fade-in">${y.error}</div>`;
  const yw = zwAnalyzeYear(zw, year);
  const dec = (zw.decadals || []).find((d) => yw.xuSui >= d.start && yw.xuSui <= d.end);
  const decName = dec ? `${dec.gan}${dec.zhi}大限（${dec.start}~${dec.end}岁）` : '';
  const c = hecanConclusion(y, yw);
  const ji = yw.sihua.find((s) => s.hua === '忌');
  const ssCls = c.level.cls === 'red' ? 'red' : c.level.cls === 'gold' ? 'gold' : 'ok';
  return `
    <div class="grid-cards" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-top:10px">
      <div class="info-card"><div class="k">${year} 流年干支</div><div class="v gold" style="font-size:20px">${y.liunian}</div>
        <div class="d">八字大运 ${y.daYun}（${y.daYunYears}）</div></div>
      <div class="info-card"><div class="k">八字十神</div><div class="v">${y.ganSS} / ${y.zhiSS}</div>
        <div class="d">天干${y.favGan ? '<span class="ok">宜</span>' : '<span class="red">慎</span>'} · 地支${y.favZhi ? '<span class="ok">宜</span>' : '<span class="red">慎</span>'}</div></div>
      <div class="info-card"><div class="k">紫微小限</div><div class="v">${yw.palace.name} <small style="font-size:12px;color:var(--text-dim)">虚岁${yw.xuSui}</small></div>
        <div class="d">${decName} · ${yw.palace.stars.length ? '主星 ' + yw.palace.stars.join('、') : '无主星'}</div></div>
      <div class="info-card"><div class="k">流年四化</div><div class="v" style="font-size:14px">${yw.sihua.map((s) => `${s.star}化${s.hua}@${s.palaceName}`).join('　')}</div>
        <div class="d">${ji && ji.palaceName !== '—' ? `忌星：${ji.star}化忌落${ji.palaceName}` : '本流年无化忌落宫'}</div></div>
    </div>
    <div style="margin-top:12px"><span class="ss-chip ${ssCls}">双系统合参 · ${c.level.tag}</span></div>
    ${c.warns.length ? `<div style="margin-top:10px">${c.warns.map((w) => `<div class="tip" style="margin-top:6px">${w}</div>`).join('')}</div>` : ''}
    ${c.goods.length ? `<div style="margin-top:10px">${c.goods.map((g) => `<div class="tip" style="margin-top:6px;border-color:rgba(143,212,158,.35)">${g}</div>`).join('')}</div>` : ''}
    <div class="d" style="margin-top:10px;font-size:12px;color:var(--text-faint)">八字与紫微两套系统独立推演、取交集互证。预测当雷达，不当牢笼。</div>`;
}

function hecanConclusion(y, yw) {
  const redFlags = ['岁运并临', '冲提纲', '伏吟日支', '反吟日支'].filter((f) => y.flags.includes(f));
  const ji = yw.sihua.find((s) => s.hua === '忌');
  const warns = [];
  const goods = [];
  if (redFlags.length) warns.push(`八字岁运重冲（${redFlags.join('、')}），流年与命局感应强烈，宜静守防变`);
  if (ji && ji.palaceName !== '—') warns.push(`紫微流年${ji.star}化忌落${ji.palaceName}，此宫之事多加关照`);
  if (y.favGan && y.favZhi && !warns.length) goods.push('八字财官食伤方向皆属喜用，进取阻力小');
  const goodHua = yw.sihua.filter((s) => s.hua !== '忌' && s.palaceName !== '—').map((s) => `${s.star}化${s.hua}@${s.palaceName}`);
  if (goodHua.length >= 2) goods.push(`紫微流年${goodHua.join('、')}，吉化颇多`);
  let level;
  if (warns.length && goods.length) level = { tag: '吉凶互见', cls: 'gold', note: '利好与风险并存，择善而从、谨慎进取' };
  else if (warns.length) level = { tag: '宜静守', cls: 'red', note: '岁运冲合并临 / 忌星照宫，稳守为本' };
  else if (goods.length) level = { tag: '顺遂', cls: 'ok', note: '双系统皆利，可大胆求进' };
  else level = { tag: '平顺', cls: 'ok', note: '无重大冲忌亦无突出吉应，按部就班' };
  return { level, warns, goods };
}

function bindHecan(root, r) {
  const yearInput = root.querySelector('#hecan-year');
  const btn = root.querySelector('#hecan-btn');
  const out = root.querySelector('#hecan-out');
  if (!yearInput || !btn || !out) return;
  const refresh = () => {
    const yr = parseInt(yearInput.value, 10);
    if (!yr || yr < 1900 || yr > 2200) { out.innerHTML = '<div class="tip red fade-in">请输入有效公历年份（1900~2200）。</div>'; return; }
    out.innerHTML = LAST_ZW ? renderHecan(LAST_ZW, yr) : '<div class="tip red fade-in">紫微引擎未就绪，暂无法合参。</div>';
  };
  btn.addEventListener('click', refresh);
  yearInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') refresh(); });
}

/* ── 渲染 ─────────────────────────────────────── */

const WX_COLOR = { 木: '木', 火: '火', 土: '土', 金: '金', 水: '水' };

/** 五行对应CSS色值 */
const WX_CSS_COLOR = { 木: '#4caf6e', 火: '#e0585a', 土: '#c9a86b', 金: '#d8d0c0', 水: '#5b8bd4' };

/**
 * 喜用趋吉指南 HTML 渲染
 * @param {object} r  analyze() 的返回对象
 * @returns {string} HTML string
 */
export function xiyongGuideHtml(r) {
  const g = xiyongGuide(r);
  if (!g) return '';
  const avoidHtml = g.avoid.length
    ? `<div class="xyg-avoid"><span>宜避</span> ${g.avoid.map((a) => `${a.wx}（色${a.color.join('/')}·${a.dir}）`).join('、')}</div>`
    : '';
  const missingHtml = g.missing.length
    ? `<div class="xyg-missing">五行缺 <b style="color:var(--gold)">${g.missing.join('、')}</b>——流年大运引动可补，见五行盛衰区</div>`
    : '';
  return `
    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>喜用趋吉指南</h2><span class="hint">身强/弱取用神五行 · 颜色方位行业参考</span></div>
      <div class="panel glass fade-in d1 xyg-guide">
        <div class="xyg-dir-line"><b>喜用方向</b> ${g.direction}</div>
        <div class="xyg-colors">${g.colors.map((c) => `<span class="xyg-color"><i style="background:${WX_CSS_COLOR[c.wx]};display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;vertical-align:middle"></i>${c.wx} · ${c.color.join('/')}</span>`).join('')}</div>
        <div class="xyg-dirs">${g.dirs.map((d) => `<span class="xyg-dir">${d.wx} · ${d.dir}</span>`).join('')}</div>
        <div class="xyg-careers">${g.careers.map((c) => `<span class="xyg-career">${c.wx}类 · ${c.career.join('、')}</span>`).join('')}</div>
        ${avoidHtml}
        ${missingHtml}
        <div class="xyg-tips d" style="margin-top:10px;color:var(--text-faint)">${g.tips}</div>
      </div>
    </div>`;
}

export function renderResult(r, meta) {
  const wx = r.wuxingCount;
  const maxWx = Math.max(...Object.values(wx), 1);
  const shiShenZh = (ss) => (ss || []).join('、');
  const sm = sanmingDetail(r);

  // 起运顺逆与虚岁（阳年男/阴年女顺排，阴年男/阳年女逆排；虚岁=起运公历年-出生年+1）
  const yangGan = ['甲', '丙', '戊', '庚', '壬'];
  const qyYang = yangGan.includes(r.pillars.year.gan);
  const qyMale = r.gender === '男';
  const qyShun = qyYang === qyMale;
  const qyType = (qyYang ? '阳' : '阴') + (qyMale ? '男' : '女');
  const qySui = (r.qiYun.startSolar ? r.qiYun.startSolar.getYear() : 0) - new Date(r.solarText.slice(0, 10)).getFullYear() + 1;

  const pillarDetailHtml = (k, p) => {
    const PL = { year: '年柱', month: '月柱', day: '日柱', time: '时柱' };
    const hideGan = (p.hideGan || []).map((g, i) => `${g} <span style="color:var(--text-faint)">${p.shiShenZhi?.[i] || ''}</span>`).join('、');
    const cs = r.changSheng.cells.find((c) => c.palace === k);
    const shensha = r.shensha.filter((s) => s.palace === k);
    const ganHe = r.relation.ganHe.filter((h) => h.a.endsWith(p.gan) || h.b.endsWith(p.gan));
    const zhiRel = r.relation.zhiRel.filter((h) => h.a.endsWith(p.zhi) || h.b.endsWith(p.zhi));
    const selfXing = r.relation.selfXing.filter((s) => s.z === p.zhi);
    const relTxt = [];
    ganHe.forEach((h) => relTxt.push(`${h.a} ${h.b} ${h.rel}（${h.result}）`));
    zhiRel.forEach((h) => relTxt.push(`${h.a} ${h.b} ${h.rel}`));
    selfXing.forEach((s) => relTxt.push(`${s.z}×${s.n} 自刑`));
    return `
      <div class="pd-row"><span class="pd-k">纳音</span><span>${p.naYin || '—'}</span></div>
      <div class="pd-row"><span class="pd-k">藏干</span><span>${hideGan || '—'}</span></div>
      <div class="pd-row"><span class="pd-k">长生</span><span>${r.dayGan}日主 ${r.changSheng.base} 起长生，行至${PL[k]}${cs ? '·' + cs.state : ''}</span></div>
      ${shensha.length ? `<div class="pd-row"><span class="pd-k">神煞</span><span>${shensha.map((s) => `${s.name}${s.good ? '' : '（空亡）'}`).join('、')}</span></div>` : ''}
      ${relTxt.length ? `<div class="pd-row"><span class="pd-k">生克</span><span>${relTxt.join('；')}</span></div>` : ''}`;
  };

  const pillarHtml = ['year', 'month', 'day', 'time'].map((k, i) => {
    const p = r.pillars[k];
    const label = ['年柱', '月柱', '日柱', '时柱'][i];
    const isDay = k === 'day';
    const ssOk = (ss) => (r.strength === '强' ? !['正印', '偏印', '比肩', '劫财'].includes(ss) : ['正印', '偏印', '比肩', '劫财'].includes(ss));
    const cangHtml = (p.hideGan || []).map((g, j) => {
      const ss = p.shiShenZhi?.[j] || '';
      return `<span class="p-cg${j === 0 ? ' main' : ''}" style="color:${ss ? (ssOk(ss) ? '#8fd49e' : 'var(--cinnabar)') : 'var(--text-dim)'}">${g}${ss ? `<i class="p-cg-ss">${ss}</i>` : ''}</span>`;
    }).join('');
    return `
      <div class="pillar fade-in d${i + 1}" data-pk="${k}">
        <div class="p-name">${label}</div>
        <div class="p-ss">${isDay ? '日主' : (p.shiShenGan || '')}</div>
        <div class="p-gan">${p.gan}</div>
        <div class="p-zhi">${p.zhi}</div>
        <div class="p-hidden"><span class="p-cg-lbl">藏干</span>${cangHtml || '<span class="p-cg-none">—</span>'}</div>
        <div class="p-meta">${p.shiShenZhi ? shiShenZh(p.shiShenZhi) : ''}<br>${p.naYin || ''}</div>
        <div class="p-detail" hidden>${pillarDetailHtml(k, p)}</div>
      </div>`;
  }).join('');

  const wxBars = Object.keys(WX_COLOR).map((wxName) => {
    const v = wx[wxName] || 0;
    const isDay = wxName === r.dayWuxing;
    const isMissing = v === 0;
    const pct = Math.round((v / maxWx) * 100);
    const tag = isMissing ? '缺' : v >= maxWx * 0.6 ? '旺' : v >= maxWx * 0.25 ? '平' : '弱';
    const tagCls = isMissing ? 'bad' : v >= maxWx * 0.6 ? 'strong' : 'mid';
    return `
      <div class="wx-bar wx-${WX_COLOR[wxName]}${isDay ? ' is-day' : ''}${isMissing ? ' is-missing' : ''}">
        <span class="wx-name">${wxName}${isDay ? '<i class="wx-day">主</i>' : ''}</span>
        <div class="track"><div class="fill" style="width:${isMissing ? 3 : pct}%"></div></div>
        <span class="val">${v}</span>
        <span class="wx-tag ${tagCls}">${tag}</span>
      </div>`;
  }).join('');

  const ssChips = r.shishenSummary.map((s) => `<span class="ss-chip">${s.name} <b>${s.n}</b></span>`).join('');

  const dg = KB?.daygan?.[r.dayGan] || null;
  const tt = KB?.shishenTend || {};
  const topTend = r.shishenSummary[0]?.name || '';
  const tendKey = ['正印', '偏印'].includes(topTend) ? '印'
    : ['比肩', '劫财'].includes(topTend) ? '比劫'
    : ['食神', '伤官'].includes(topTend) ? '食伤'
    : ['正财', '偏财'].includes(topTend) ? '财'
    : ['正官', '七杀'].includes(topTend) ? '官杀' : null;

  const yNow = analyzeYear(r, new Date().getFullYear());
  const favTxt = yNow.favGan && yNow.favZhi ? '喜用方向，可进取' : yNow.favGan || yNow.favZhi ? '喜忌参半，宜审慎' : '忌神方向，宜稳健';

  const missingWx = Object.entries(r.wuxingCount).filter(([, v]) => v === 0).map(([k]) => k);

  // 流年五行引动：未来 12 年内，流年干支含命局所缺五行的年份
  const nowYear = new Date().getFullYear();
  const missYears = [];
  if (missingWx.length) {
    for (let i = 0; i < 12; i++) {
      const yc = analyzeYear(r, nowYear + i);
      if (yc.error || !yc.liunian || yc.liunian.length < 2) continue;
      const gWx = GAN_WUXING[yc.liunian[0]] || '';
      const zWx = ZHI_WUXING[yc.liunian[1]] || '';
      if (missingWx.includes(gWx) || missingWx.includes(zWx)) missYears.push({ y: nowYear + i, gz: yc.liunian, wx: [...new Set([gWx, zWx])] });
    }
  }
  const missYearTxt = missYears.length
    ? `<div class="d" style="margin-top:8px;font-size:12px;color:var(--text-dim);line-height:1.8">未来 12 年内，<b style="color:var(--gold)">${missingWx.join('、')}</b> 之气将于 <b>${missYears.map((m) => `${m.y}（${m.gz}·${m.wx.join('/')}）`).join('、')}</b> 等年引动——届时五行渐趋平衡，可把握相应运势窗口，主动补足其所主之事。</div>`
    : '';

  const CS_CN = { year: '年', month: '月', day: '日', time: '时' };
  const csCells = r.changSheng.cells.map((c) => `<span class="ss-chip" title="${CS_CN[c.palace]}柱">${c.zhi} ${c.state}</span>`).join('');

  const PALACE_CN = { year: '年', month: '月', day: '日', time: '时' };
  const shenshaHtml = r.shensha.length
    ? r.shensha.map((s, i) => `
        <div class="info-card fade-in d${(i % 4) + 1}">
          <div class="k">${s.name}${s.good ? '' : ' <span style="color:var(--cinnabar)">· 空</span>'}</div>
          <div class="v gold" style="font-size:16px">${s.gz} <small style="color:var(--text-dim);font-size:12px">${PALACE_CN[s.palace]}柱</small></div>
          <div class="d">${s.desc}</div>
        </div>`).join('')
    : '<div class="tip fade-in">四柱未见常用神煞，命局更显纯粹。</div>';

  const relChips = [];
  r.relation.ganHe.forEach((h) => relChips.push(`<span class="ss-chip gold" title="天干五合">${h.a}${h.b} ${h.result}</span>`));
  r.relation.zhiRel.forEach((h) => relChips.push(`<span class="ss-chip${['六冲', '六害', '相刑'].includes(h.rel) ? ' red' : ''}">${h.a}${h.b} ${h.rel}</span>`));
  r.relation.selfXing.forEach((s) => relChips.push(`<span class="ss-chip red">${s.z}×${s.n} 自刑</span>`));
  const relHtml = relChips.length ? `<div style="display:flex;flex-wrap:wrap">${relChips.join('')}</div>` : '<div class="tip fade-in">四柱天干地支无合冲刑害之交互。</div>';

  const tgList = touGanTongGen(r);
  const tgTotal = tgList.reduce((s, x) => s + x.roots.reduce((a, b) => a + b.n, 0), 0);
  const tgFloating = tgList.filter((x) => x.floating);
  const tgHtml = `
    <div class="tg-grid">${tgList.map((x) => `
      <div class="tg-cell${x.floating ? ' float' : ''}">
        <div class="tg-top"><b>${x.gan}</b><i>${x.palace}${x.wx}</i>${x.floating ? '<span class="tg-flag">虚浮</span>' : ''}</div>
        <div class="tg-roots">${x.roots.length ? x.roots.map((rt) => `<span class="tg-root${rt.qi === '本气' ? ' ben' : ''}">${rt.zhi}<em>${rt.qi}${rt.n > 1 ? '×' + rt.n : ''}</em></span>`).join('') : '<span class="tg-none">无根</span>'}</div>
      </div>`).join('')}</div>
    <div class="tg-sum">四柱天干共 <b>${tgTotal}</b> 处通根${tgFloating.length ? `；${tgFloating.map((f) => `${f.palace}干${f.gan}`).join('、')}无根而浮` : ''}。</div>
    <div class="hl-note" style="margin-top:8px">透干谓天干现于四柱，通根谓地支有同气之藏。干得根则立、根得干则显，根深者气专力盛，浮而无根者力弱待扶——此与旺衰喜忌相参，非吉凶判决。</div>`;

  const xiSet = ['正财', '偏财', '正官', '七杀', '食神', '伤官'];
  const favSS = (ss) => (r.strength === '强' ? xiSet.includes(ss) : !xiSet.includes(ss));
  const ssCls = (ss) => (ss ? (favSS(ss) ? 'ok' : 'xi') : '');
  const gwList = gongWeiShiShen(r);
  const gwHtml = `
    <div class="gw-grid">${gwList.map((x) => {
      const isDay = x.palace === '日';
      return `<div class="gw-cell${isDay ? ' is-day' : ''}">
        <div class="gw-top">${x.palace}柱<em>${x.gong}</em></div>
        <div class="gw-gan">${x.gan}<i class="gw-ss ${ssCls(x.ganSS)}">${x.ganSS}</i></div>
        <div class="gw-zhi">${x.zhi}藏 <b>${x.zhiMain}</b><i class="gw-ss ${ssCls(x.zhiMainSS)}">${x.zhiMainSS}</i></div>
      </div>`;
    }).join('')}</div>
    <div class="hl-note" style="margin-top:8px">宫位论以年祖辈少年、月父母青年、日自身中年、时子女晚年配十神——看人生各阶段的当值主题。十神绿=喜用方向、红=忌神方向（身强取财官食伤、身弱取印比）。日柱为身宫，日支为配偶宫。</div>`;
  const lqList = liuQinOf(r);
  const lqHtml = `
    <div class="lq-grid">${lqList.map((x) => `
      <div class="lq-cell${x.palace === '日' ? ' is-day' : ''}">
        <div class="lq-top">${x.palace}柱<em>${x.gan}</em></div>
        <div class="lq-ss ${ssCls(x.ss)}">${x.ss}</div>
        <div class="lq-kin">${x.kin || '—'}</div>
        <div class="lq-note">${x.note || ''}</div>
      </div>`).join('')}
      <div class="lq-ref-grid">${Object.entries(LIUQIN).map(([ss, v]) => `<div class="lq-ref"><b>${ss}</b><span>${v.kin}</span></div>`).join('')}</div>
    </div>
    <div class="hl-note" style="margin-top:8px">六亲对应依子平通行口径（正印母/偏印继母·祖父/偏财父/正财妻/正官女命之夫/七杀男命之子等）；古籍于父妻子女归属颇有出入，本表供参详不作判决。日柱日主为自身。</div>`;
  const DAYUN_THEME = {
    正印: { kw: '学习 · 贵人 · 文书', txt: '印星主学习文书，得长辈提携，宜读书进修、广结善缘' },
    偏印: { kw: '玄学 · 思考 · 技艺', txt: '偏印主钻研独处，宜精进技艺玄学，忌孤僻多虑、思多行缓' },
    比肩: { kw: '合作 · 竞争 · 友伴', txt: '比肩主同辈协作，宜结伴共事，防平辈相争、利益分摊' },
    劫财: { kw: '破耗 · 竞争 · 社交', txt: '劫财主破耗竞争，合伙宜慎，忌冲动投资、先散后聚' },
    食神: { kw: '创意 · 口福 · 表达', txt: '食神主才华享乐，宜展现才艺、以食会友，忌贪逸误事' },
    伤官: { kw: '锋芒 · 突破 · 创新', txt: '伤官主锐气变革，宜创新求进，防口舌是非、锋芒太露' },
    正财: { kw: '正途 · 求财 · 稳定', txt: '正财主勤恳营财，宜稳步累积，忌投机取巧、见利忘义' },
    偏财: { kw: '横财 · 人脉 · 风险', txt: '偏财主灵活生财、人脉经营，忌铤而走险、贪多务得' },
    正官: { kw: '事业 · 名誉 · 约束', txt: '正官主事业名望，宜循规进取、担职尽责，忌优柔寡断' },
    七杀: { kw: '压力 · 挑战 · 魄力', txt: '七杀主压力挑战，宜迎难而上、以魄力破局，忌刚愎冲动' },
  };
  const dayunTopicHtml = r.daYun.map((d) => {
    const isNow = d.startYear <= nowYear && nowYear <= d.endYear;
    const g = DAYUN_THEME[d.ganSS] || null;
    const z = DAYUN_THEME[d.zhiSS] || null;
    const gFav = favSS(d.ganSS), zFav = favSS(d.zhiSS);
    const kw = [g?.kw, z?.kw].filter(Boolean);
    const both = gFav && zFav ? '喜用方向 · 顺势而为宜' : gFav || zFav ? '喜忌参半 · 见机取舍' : '忌神方向 · 宜守成自省';
    const txt = (g?.txt || z?.txt || '');
    return `
      <div class="dayun-topic fade-in${isNow ? ' now' : ''}">
        <div class="dt-head"><span class="dt-gz">${d.ganzhi}</span><span class="dt-years">${d.startYear}~${d.endYear}</span>
          ${isNow ? '<span class="dt-now">当运</span>' : ''}</div>
        <div class="dt-ss"><span class="${ssCls(d.ganSS)}">干·${d.ganSS}</span><span class="${ssCls(d.zhiSS)}">支·${d.zhiSS}</span></div>
        ${kw.length ? `<div class="dt-kw">${kw.join('<em>·</em>')}</div>` : ''}
        <div class="dt-txt">${txt}</div>
        <div class="dt-tag ${both.includes('喜用') ? 'good' : both.includes('忌神') ? 'bad' : 'mid'}">${both}</div>
      </div>`;
  }).join('');
  const dayunHtml = r.daYun.map((d) => {
    const isCurrent = d.startYear <= nowYear && nowYear <= d.endYear;
    const liu = (d.liuNian || []).slice(0, 5).map((n) => `<span class="dy-liu" data-year="${n.year}" title="点击查看 ${n.year} 流年分析">${n.ganzhi}</span>`).join('');
    const dys = daYunShensha(r).find((x) => x.ganzhi === d.ganzhi);
    const dSs = dys && dys.shensha.length
      ? `<div class="d-shensha">${dys.shensha.map((s) => `<span class="d-ss-chip" title="${s.desc}${s.extra ? '（' + s.extra + '）' : ''}">${s.name}</span>`).join('')}</div>`
      : '';
    return `
      <div class="dayun-step ${isCurrent ? 'current' : ''}">
        <div class="d-ganzhi">${d.ganzhi}${isCurrent ? '<span class="cur-tag">当前</span>' : ''}</div>
        <div class="d-ss"><span class="${ssCls(d.ganSS)}">${d.ganSS || ''}</span><em>·</em><span class="${ssCls(d.zhiSS)}">${d.zhiSS || ''}</span></div>
        <div class="d-years">${d.startYear}~${d.endYear}${d.startSolar ? ` <span class="d-jiaoyun" title="交运于 ${d.startSolar}">交运 ${d.startSolar}</span>` : ''}</div>
        ${dSs}
        <div class="d-liunian">${liu}</div>
      </div>`;
  }).join('');

  /* 流年运势总览条：未来 12 年逐年喜忌可视化（金=喜用 / 黄=参半 / 暗红=忌，⚠=关键年份） */
  const stripYears = Array.from({ length: 12 }, (_, i) => nowYear + i);
  const stripHtml = stripYears.map((y) => {
    const yc = analyzeYear(r, y);
    if (yc.error) return '';
    const fav = yc.favGan && yc.favZhi ? 2 : (yc.favGan || yc.favZhi ? 1 : 0);
    const cls = fav === 2 ? 'ok' : fav === 1 ? 'mid' : 'bad';
    const warn = (yc.flags || []).length ? '<i class="ls-warn" title="' + yc.flags.join(' / ') + '">⚠</i>' : '';
    const tag = fav === 2 ? '宜进取' : fav === 1 ? '宜审慎' : '宜稳健';
    return `<button type="button" class="ls-cell ${cls}" data-year="${y}" title="点击查看 ${y} 流年分析">
      <span class="ls-y">${y}</span><span class="ls-gz">${yc.liunian || ''}</span>${warn}<span class="ls-tag">${tag}</span></button>`;
  }).join('');

  /* 未来 12 年走势曲线：逐年评分 SVG（宜进取>65 · 平顺45~65 · 宜审慎<45，关键年⚠） */
  const trendPts = yearTrend(r, nowYear, 12);
  const W = 740, H = 240, L = 44, R = 14, T = 26, B = 46;
  const scoreY = (s) => T + (100 - s) / 100 * (H - T - B);
  const xAt = (i) => trendPts.length > 1 ? L + i * (W - L - R) / (trendPts.length - 1) : L;
  const C_GOOD = '#8fd49e', C_MID = '#d4af37', C_BAD = '#ff4c00', C_DIM = '#9a958b';
  const cOf = (s) => (s >= 65 ? C_GOOD : s >= 45 ? C_MID : C_BAD);
  const trendPath = trendPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${scoreY(p.score).toFixed(1)}`).join(' ');
  const warnYears = trendPts.filter((p) => p.flags.length);
  const trendHtml = `<svg class="trend-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="未来12年吉凶走势曲线">
      <line x1="${L}" y1="${scoreY(65)}" x2="${W - R}" y2="${scoreY(65)}" stroke="${C_DIM}" stroke-width="1" stroke-dasharray="4 3" opacity=".5"/>
      <text x="${L - 4}" y="${scoreY(65) + 3}" fill="${C_DIM}" font-size="9" text-anchor="end">65</text>
      <line x1="${L}" y1="${scoreY(45)}" x2="${W - R}" y2="${scoreY(45)}" stroke="${C_DIM}" stroke-width="1" stroke-dasharray="4 3" opacity=".5"/>
      <text x="${L - 4}" y="${scoreY(45) + 3}" fill="${C_DIM}" font-size="9" text-anchor="end">45</text>
      <path d="${trendPath}" fill="none" stroke="${C_DIM}" stroke-width="1.5" opacity=".55"/>
      ${trendPts.map((p, i) => {
        const x = xAt(i).toFixed(1), y = scoreY(p.score).toFixed(1);
        const warn = p.flags.length ? `<text x="${x}" y="${(parseFloat(y) - 9).toFixed(1)}" fill="${C_BAD}" font-size="11" text-anchor="middle" font-weight="700">⚠</text>` : '';
        return `<circle cx="${x}" cy="${y}" r="4.5" fill="${cOf(p.score)}" stroke="#0e0e12" stroke-width="1.2"/><text x="${x}" y="${(parseFloat(y) - 11).toFixed(1)}" fill="${cOf(p.score)}" font-size="9" text-anchor="middle">${p.score}</text>${warn}
        <text x="${x}" y="${H - 26}" fill="${C_DIM}" font-size="9.5" text-anchor="middle">${p.year}</text>
        <text x="${x}" y="${H - 13}" fill="${cOf(p.score)}" font-size="10.5" text-anchor="middle">${p.gz}</text>`;
      }).join('')}
      ${warnYears.map((p, i) => {
        const x = xAt(trendPts.indexOf(p)).toFixed(1);
        return `<title>${p.year} ${p.gz}：${p.flags.join(' / ')}</title>`;
      }).join('')}
    </svg>`;
  const trendBest = trendPts.reduce((a, b) => (b.score > a.score ? b : a), trendPts[0]);
  const trendLow = trendPts.reduce((a, b) => (b.score < a.score ? b : a), trendPts[0]);
  const trendLowNote = trendLow.flags.length ? ` · 此年 ${trendLow.flags.join('、')}，宜提前布局、稳字当头` : '';
  const trendWarnTxt = warnYears.length ? ` ⚠${warnYears.map((p) => `${p.year} ${p.gz}`).join('、')}` : '';

  const duanyuHtml = r.duanyu.length
    ? r.duanyu.map((d) => `
        <div class="duanyu fade-in">
          <span class="q">${d.text}</span>
          <span class="src">${d.source}</span>
        </div>`).join('')
    : `<div class="tip fade-in">命局特征未触及古籍断语条目，仅作结构性呈现。</div>`;

  const gejuDesc = r.geju?.desc || {};
  const gd = r.geju?.desc || null;

  return `
    <div class="hl-mini-row fade-in">${huangliMiniHtml()}</div>
    <div class="export-bar fade-in">
      <span class="hint">命书可一键复制为文本，便于存档与分享</span>
      <button type="button" class="btn ghost" id="bazi-export">复 制 命 书</button>
    </div>
    <div class="guide-line panel glass fade-in d1" style="padding:14px 16px;margin-bottom:14px">
      <b class="gl-g">${r.dayGan}${r.dayWuxing} · ${r.strength} · ${r.geju.name}</b>
      <span style="margin-left:10px">${r.yongshen.fuyi}</span>
      <span style="margin-left:14px;color:var(--text-dim)">今年 ${yNow.liunian}（${yNow.ganSS} / ${yNow.zhiSS}）${favTxt}</span>
    </div>
    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>四柱命盘</h2>
        <span class="hint">${meta.name} · ${meta.useTrue ? '真太阳时' : '钟表时'} ${meta.useTrue ? `(经度${meta.lng}°${meta.tstInfo ? '，时差' + (meta.tstInfo.deltaMin >= 0 ? '+' : '') + meta.tstInfo.deltaMin.toFixed(1) + '分' : ''})` : ''}</span>
      </div>
      <div class="pillars">${pillarHtml}</div>
      <div class="grid-cards" style="margin-top:16px">
        <div class="info-card fade-in d1"><div class="k">公历</div><div class="v">${r.solarText}</div></div>
        <div class="info-card fade-in d1"><div class="k">农历</div><div class="v" style="font-size:15px">${r.lunarText}</div></div>
        <div class="info-card fade-in d1"><div class="k">日主</div><div class="v gold">${r.dayGan}${r.dayWuxing} <small style="color:var(--text-dim);font-size:12px">${r.dayGan}水命</small></div></div>
        <div class="info-card fade-in d1"><div class="k">三元 / 命宫</div>
          <div class="v" style="font-size:13.5px;line-height:1.6">
            <span style="color:var(--gold)">胎</span> ${sm.taiYuan.gz} <small style="color:var(--text-dim)">${sm.taiYuan.naYin}</small><br>
            <span style="color:var(--gold)">命</span> ${sm.mingGong.gz} <small style="color:var(--text-dim)">${sm.mingGong.naYin}</small><br>
            <span style="color:var(--gold)">身</span> ${sm.shenGong.gz} <small style="color:var(--text-dim)">${sm.shenGong.naYin}</small>
          </div>
          <div class="d">胎元 · 命宫 · 身宫（子平三命）</div>
        </div>
      </div>
      <details class="hl-details sm-details fade-in d1">
        <summary>三命详解 · 胎元 / 命宫 / 身宫 <span class="hint">观先天之气与后天作为</span></summary>
        <div class="sm-grid">
          ${['taiYuan', 'mingGong', 'shenGong'].map((k) => {
            const s = sm[k];
            return `<div class="sm-card">
              <div class="sm-head"><b>${s.name}</b><span class="sm-gz">${s.gz}</span><span class="sm-nayin">${s.naYin}</span></div>
              <div class="sm-theme">${s.theme}</div>
              <div class="sm-ss">${s.gan}（${s.ganSS}）· ${s.zhi}藏 ${s.cang}</div>
              <div class="sm-desc">${s.desc}三命为子平参考一法，吉凶仍以旺衰用神与大运流年为准。</div>
            </div>`;
          }).join('')}
        </div>
      </details>
    </div>

    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>五行盛衰</h2>
        <span class="hint">权重含藏干（主气×2 / 余气×1）· 旺平弱缺按占最高值比</span></div>
      <div class="panel glass fade-in d1">
        <div class="wx-bars">${wxBars}</div>
        ${missingWx.length ? `<div class="d" style="margin-top:10px;font-size:12px;color:var(--text-dim);line-height:1.8">命局五行缺 <b style="color:var(--gold)">${missingWx.join('、')}</b>。缺者不必然为忌——所缺可随大运流年引动而补，断吉凶仍以用神喜忌为准，勿单凭「缺」字。</div>` : ''}
        ${missYearTxt}
      </div>
    </div>

    ${xiyongGuideHtml(r)}

    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>格局 · 旺衰 · 用神</h2></div>
      <div class="grid-cards">
        <div class="info-card fade-in d1"><div class="k">格局</div><div class="v gold">${r.geju.name}</div>
          <div class="d">月令本气：${r.geju.ss}。${gd && gd.xi ? '喜：' + gd.xi.join('、') : ''}${gd && gd.ji ? '；忌：' + gd.ji.join('、') : ''}</div></div>
        <div class="info-card fade-in d1"><div class="k">日主旺衰</div><div class="v ${r.strength === '强' ? 'red' : r.strength === '弱' ? 'gold' : ''}">${r.strength}</div>
          <div class="d">${r.deLing ? '得月令' : '失月令'} · ${r.hasRoot ? '有根气' : '根气不足'} · 生扶${r.supportCount}位天干</div></div>
        <div class="info-card fade-in d1"><div class="k">调候用神</div><div class="v red">${r.yongshen.tiaoHou || '—'}</div>
          <div class="d">按生月 ${r.monthZhi} 月 · 日主 ${r.dayWuxing}</div></div>
        <div class="info-card fade-in d1"><div class="k">扶抑取向</div><div class="v">${r.yongshen.fuyi}</div></div>
        <div class="info-card fade-in d1"><div class="k">日主十二长生</div>
          <div class="v" style="font-size:14px">${csCells}</div>
          <div class="d">${r.dayGan} 长生于 ${r.changSheng.base}（阳生阴死口径，阴干逆行）——气数流转为参照，吉凶仍以旺衰用神为准</div></div>
      </div>
      <details class="hl-details th-details fade-in d2">
        <summary>穷通宝鉴 · 调候用神全表（十二生月 × 日主五行）</summary>
        <div class="th-table-wrap">
          <table class="th-table">
            <thead><tr><th>生月</th><th>木</th><th>火</th><th>土</th><th>金</th><th>水</th></tr></thead>
            <tbody>${Object.entries(TIAOHOU).map(([mz, row]) => `
              <tr class="${mz === r.monthZhi ? 'cur' : ''}">
                <td>${mz}月</td>
                ${['木', '火', '土', '金', '水'].map((w) => `<td class="${mz === r.monthZhi && w === r.dayWuxing ? 'hit' : ''}">${row[w] || '—'}</td>`).join('')}
              </tr>`).join('')}</tbody>
          </table>
          <div class="th-note">调候为〈穷通宝鉴〉一法：出生月令寒暖燥湿极处必取一五行调候（冬需丙火暖、夏需壬癸润）。黄行为本命生月，青底为命主日主所在格，交叉格即本命调候。调候用神常与扶抑冲突，取用仍以整体平衡论。</div>
        </div>
      </details>
    </div>

    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>日主性格</h2>
        <span class="hint">日主天干 + 十神倾向 · 作自我观照参考</span></div>
      <div class="panel glass fade-in d1">
        ${dg ? `<div class="guide-line"><b class="gl-g">${r.dayGan}${r.dayWuxing}</b> · ${dg.text}</div>` : ''}
        ${tendKey ? `<div class="guide-line" style="margin-top:8px"><b class="gl-g">${topTend}偏重</b> · ${tt[tendKey]}</div>` : ''}
        ${dg && dg.warn ? `<div class="guide-line" style="margin-top:8px;color:var(--cinnabar)"><b class="gl-g">宜留意</b> · ${dg.warn}</div>` : ''}
        <div class="d" style="margin-top:10px;color:var(--text-faint)">性格描述源自传统命理经验框架，供观照自我而非贴签；行止取舍，始终在自己。</div>
      </div>
    </div>

    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>十神分布</h2></div>
      <div class="panel glass fade-in d1"><div>${ssChips}</div></div>
    </div>

    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>神煞</h2>
        <span class="hint">天乙 · 文昌 · 桃花 · 驿马 · 天德月德 · 空亡 —— 依渊海子平口径</span></div>
      <div class="grid-cards">${shenshaHtml}</div>
      <details class="hl-details ss-table-details fade-in d2">
        <summary>神煞一览总表（${SHENSHA_TABLE.length} 项 · 起法依渊海子平）</summary>
        <div class="ss-table-wrap">
          <div class="ss-table">
            <div class="ss-thead"><span>神煞</span><span>起法</span><span>吉凶</span><span>含义</span><span>本盘</span></div>
            ${SHENSHA_TABLE.map((t) => {
              const hit = r.shensha.filter((s) => s.name === t.name);
              const hitHtml = hit.length
                ? hit.map((s) => `<b class="hit">${s.gz} @${PALACE_CN[s.palace]}柱</b>`).join('')
                : '<span class="no-hit">—</span>';
              return `<div class="ss-tr${hit.length ? ' has' : ''}">
                <span class="ss-name">${t.name}</span>
                <span class="ss-from">${t.from}</span>
                <span class="ss-good ${t.good > 0 ? 'ji' : t.good < 0 ? 'xiong' : 'zhong'}">${t.good > 0 ? '吉' : t.good < 0 ? '凶' : '中性'}</span>
                <span class="ss-desc">${t.desc}<small>${t.rule}</small></span>
                <span class="ss-hit">${hitHtml}</span>
              </div>`;
            }).join('')}
          </div>
        </div>
        <div class="d" style="margin-top:8px;font-size:12px;color:var(--text-faint)">命中者以金底标出；神煞为命理「参照系数」，吉凶仍以旺衰用神与大运流年为主。</div>
      </details>
    </div>

    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>命局关系</h2>
        <span class="hint">四柱天干五合 · 地支六合六冲相刑六害 · 自刑</span></div>
      <div class="panel glass fade-in d1">${relHtml}</div>
    </div>

    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>透干通根</h2>
        <span class="hint">《滴天髓》透干通根论 · 本气根 > 中余气根 · 无根为虚浮</span></div>
      <div class="panel glass fade-in d1">${tgHtml}</div>
    </div>

    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>四柱宫位</h2>
        <span class="hint">年祖辈少年 · 月父母青年 · 日自身中年 · 时子女晚年 · 宫位十神主事</span></div>
      <div class="panel glass fade-in d1">${gwHtml}</div>
    </div>

    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>六亲与十神</h2>
        <span class="hint">十神配六亲 · 依子平通行口径 · 供参详</span></div>
      <div class="panel glass fade-in d1">${lqHtml}</div>
      ${shishenTableHtml()}
    </div>

    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>大运流年</h2>
        <span class="hint">约 ${qySui} 虚岁起运（${r.qiYun.startYear} 年 ${r.qiYun.startMonth} 月 ${r.qiYun.startDay} 日）· ${qyType}${qyShun ? '顺' : '逆'}排 · 十神绿=喜用方向</span></div>
      <div class="panel glass fade-in d1"><div class="dayun">${dayunHtml}</div></div>
      <div class="dayun-topic-grid fade-in d1">
        <div class="dt-note">每步大运十年，干支十神各主一事；绿=喜用方向顺势而为、黄=喜忌参半见机取舍、红=忌神方向守成自省。</div>
        <div class="dt-grid">${dayunTopicHtml}</div>
      </div>
      <div class="liunian-strip fade-in d2">
        <div class="ls-head"><b>流年运势 · 未来 12 年</b>
          <span class="hint">金=喜用方向 · 黄=喜忌参半 · 暗红=忌神方向 · ⚠=关键年份（岁运并临/伏吟反吟等）</span></div>
        <div class="ls-track">${stripHtml || ''}</div>
      </div>
      <div class="liunian-strip trend-box fade-in d2">
        <div class="ls-head"><b>未来 12 年走势</b>
          <span class="hint">评分=基础50 ＋ 喜忌方向 ＋ 关键flag(岁运并临/伏吟等) ＋ 吉神煞引动 ＋ 调候命中 · 高峰宜进取、低谷宜蓄力</span></div>
        <div class="trend-wrap">${trendHtml}</div>
        <div class="trend-note"><span class="dot good"></span>宜进取（≥65）<span class="dot mid"></span>平顺（45~65）<span class="dot bad"></span>宜审慎（&lt;45）<span class="dot warn">⚠</span>关键年${trendWarnTxt}</div>
        <div class="trend-tip">未来 12 年高峰在 <b style="color:var(--gold)">${trendBest.year} ${trendBest.gz}（${trendBest.score}）</b>，可大胆进取；低谷在 <b style="color:#ffb39e">${trendLow.year} ${trendLow.gz}（${trendLow.score}）</b>${trendLowNote}。走势为趋势雷达，非命运判决——吉年防骄、凶年蓄力，主动权始终在你。</div>
      </div>
      <div class="liunian-box fade-in d3">
        <div class="liunian-head">
          <b>流年分析</b>
          <input type="number" id="liunian-year" value="${new Date().getFullYear()}" min="1900" max="2200" step="1" aria-label="流年公历年">
          <button type="button" id="liunian-btn" class="btn ghost">看 流 年</button>
        </div>
        <div id="liunian-out">${renderLiunian(r, new Date().getFullYear())}</div>
      </div>
      <div class="liunian-box fade-in d3">
        <div class="liunian-head">
          <b>双系统合参</b>
          <span class="hint" style="margin-left:auto">八字 + 紫微 · 同一年份</span>
          <input type="number" id="hecan-year" value="${new Date().getFullYear()}" min="1900" max="2200" step="1" aria-label="合参公历年">
          <button type="button" id="hecan-btn" class="btn ghost">合 参</button>
        </div>
        <div id="hecan-out">${LAST_ZW ? renderHecan(LAST_ZW, new Date().getFullYear()) : '<div class="tip red fade-in">紫微引擎加载中…</div>'}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>古籍断语</h2>
        <span class="hint">依《渊海子平》《滴天髓》等 · 作提醒参考</span></div>
      <div class="duanyu-list">${duanyuHtml}</div>
    </div>

    <div class="section">
      ${nayinTableHtml()}
    </div>

    <div class="section">
      ${changshengTableHtml(r)}
    </div>

    <div class="section">
      ${ganzhiTableHtml(r)}
    </div>

    <div class="section">
      ${dizhiRelationTableHtml()}
    </div>

    <div class="section">
      ${tianGanHeHuaTableHtml()}
    </div>

    <div class="section">
      ${shenShaTableHtml()}
    </div>

    <div class="section">
      ${cangGanTableHtml(r)}
    </div>

    <div class="section">
      ${xunKongTableHtml(r)}
    </div>

    <div class="section">
      ${baziTermsHtml()}
    </div>

    <div class="section">
      <div class="tip fade-in">断语与用神均出自传统命理框架，属经验体系而非科学证明。预测当雷达，不当牢笼；把结论当作观察自我的镜子，而非决定命运的判决书。</div>
    </div>
  `;
}

/** 子平术语速查数据表（18 项，古籍通行口径） */
const BAZI_TERMS = [
    { term: '日主', tag: '基础', def: '四柱日柱天干，代表命主本人，是论命之中心轴。' },
    { term: '十神', tag: '基础', def: '以日干为我，与其他七字的生克关系定出：比肩、劫财、食神、伤官、正财、偏财、正官、七杀、正印、偏印。' },
    { term: '透干', tag: '基础', def: '地支藏干出现在对应或相邻天干位，称透干，其五行力量倍增，入格取用以透干为要。' },
    { term: '通根', tag: '基础', def: '天干在地支中有同类藏干（本气中气余气），称有根，天干力量得地支延续。' },
    { term: '藏干', tag: '基础', def: '每一地支内藏一至三个天干（本气/中气/余气），是地支隐含之五行力量。' },
    { term: '身强身弱', tag: '基础', def: '日主得月令、有根、多比印则身强；失月令、少根、被克泄多则身弱。取用神须先定强弱。' },
    { term: '格局', tag: '格局', def: '月令本气或透干之十神即为格局（如月令正官透出→正官格），格局定一命大方向与喜忌。' },
    { term: '从格', tag: '格局', def: '日主极弱，四柱无印比帮扶，顺从旺神之格，分从财、从官杀、从食伤、从强等。' },
    { term: '化气格', tag: '格局', def: '日主与邻干合化（甲己化土等），且化神得月令或多见，称化气格，真化假化以月令断。' },
    { term: '大运', tag: '大运', def: '每十年一步大运，由月柱顺逆推算，代表人生各阶段的五行环境与机遇。' },
    { term: '起运', tag: '大运', def: '命主开始行第一步大运的年龄，阳男阴女顺布，阴男阳女逆布，以天数折算。' },
    { term: '岁运并临', tag: '大运', def: '大运与流年的干支完全相同，主该年事多变动、强烈感受，吉者大吉凶者大凶。' },
    { term: '伏吟', tag: '大运', def: '大运或流年天干地支与四柱原局相同（重叠），主重复纠缠、原地踏步、旧事重演。' },
    { term: '反吟', tag: '大运', def: '大运或流年干支与原局完全相冲，主剧烈变动、分离、翻覆，力量比一般冲更猛。' },
    { term: '空亡', tag: '神煞', def: '日柱所在旬中缺失的两个地支，该宫所主之事虚而不实，宜静不宜动，行运逢之尤须留意。' },
    { term: '羊刃', tag: '神煞', def: '日干帝旺之支（甲卯、丙戊午、庚酉、壬子），主刚烈勇猛，有力量也易招破，须有官杀制约。' },
    { term: '驿马', tag: '神煞', def: '申子辰见寅、寅午戌见申、巳酉丑见亥、亥卯未见巳，主奔波变动、远行迁移、求新求变。' },
    { term: '天乙贵人', tag: '神煞', def: '逢凶化吉之最吉神煞，见之得贵人相助、逢凶自解，甲戊庚见丑未等，吉运逢之格外有力。' },
];

/** 子平术语速查折叠表 HTML */
export function baziTermsHtml() {
    const TAG_COLOR = {
        '基础': 'var(--text-dim)',
        '格局': 'var(--gold)',
        '大运': '#8fd49e',
        '神煞': 'var(--cinnabar)',
    };
    const items = BAZI_TERMS.map((t) => {
        const clr = TAG_COLOR[t.tag] || 'var(--text-dim)';
        return `<div class="bzt-item">
          <div class="bzt-head"><b class="bzt-name">${t.term}</b><span class="bzt-tag" style="color:${clr};border-color:${clr}">${t.tag}</span></div>
          <div class="bzt-def">${t.def}</div>
        </div>`;
    }).join('');
    return `<details class="hl-details bzt-details fade-in d3">
      <summary>子平术语速查 · 常用名词</summary>
      <div class="bzt-grid">
        ${items}
        <div class="bzt-note" style="grid-column:1/-1;font-size:12px;color:var(--text-faint);margin-top:6px;line-height:1.7">术语为理解排盘结果之助，命理当雷达，不当牢笼；定义基于子平通行口径，研习进深可参〈渊海子平〉〈滴天髓〉原文。</div>
      </div>
    </details>`;
}

/** 十神含义速查数据表（子平口径） */
const SHISHEN_TABLE = [
    {
        name: '正财',
        alt: '我克同性为正财',
        def: '以规矩手段获取的稳定财富',
        xiji: '身强喜用：正财主务实求财，身强者宜取以平衡；身弱者财多身弱反为所累',
        kin: LIUQIN['正财'].kin,
        qingxing: '勤俭务实，处事有节，重信守诺',
        zhushi: SHISHEN_YEAR['正财'],
    },
    {
        name: '偏财',
        alt: '我克异性为偏财',
        def: '灵活流动之财、机遇横财与人脉财',
        xiji: '身强喜用：偏财主开拓人脉、灵活生财；身弱者偏财散漫难聚',
        kin: LIUQIN['偏财'].kin,
        qingxing: '慷慨好动，喜结交，乐于分享',
        zhushi: SHISHEN_YEAR['偏财'],
    },
    {
        name: '正官',
        alt: '克我同性为正官',
        def: '约束规范我的正当权威与职位',
        xiji: '身强喜用：正官主名位约束，身强者得正官制衡，循规进取；身弱者官多则压',
        kin: LIUQIN['正官'].kin,
        qingxing: '正直自律，循规蹈矩，尽职守责',
        zhushi: SHISHEN_YEAR['正官'],
    },
    {
        name: '七杀',
        alt: '克我异性为七杀（偏官）',
        def: '强势克制我的力量，主压力与魄力',
        xiji: '身强喜用：七杀主挑战压力，身强者以魄力破局；身弱者七杀攻身难承',
        kin: LIUQIN['七杀'].kin,
        qingxing: '果决魄力，敢于担当，锋芒毕露',
        zhushi: SHISHEN_YEAR['七杀'],
    },
    {
        name: '正印',
        alt: '生我同性为正印',
        def: '滋养护佑我的文书、母爱与贵人',
        xiji: '身弱喜用：正印生扶日主，身弱者得印护身；身强者印多则懒散依赖',
        kin: LIUQIN['正印'].kin,
        qingxing: '仁慈稳重，温文儒雅，好学善思',
        zhushi: SHISHEN_YEAR['正印'],
    },
    {
        name: '偏印',
        alt: '生我异性为偏印（枭神）',
        def: '异类滋养我的技艺、玄学与孤高之智',
        xiji: '身弱喜用：偏印亦生扶日主，宜精进技艺；身强者偏印枭夺食神福泽',
        kin: LIUQIN['偏印'].kin,
        qingxing: '机敏孤高，思虑深远，擅独处钻研',
        zhushi: SHISHEN_YEAR['偏印'],
    },
    {
        name: '食神',
        alt: '我生同性为食神',
        def: '我所生之同性，主才华享福与口福',
        xiji: '身强喜用：食神泄秀生财，身强者宜以食神展才；身弱者食神泄气则耗',
        kin: LIUQIN['食神'].kin,
        qingxing: '温和乐观，才艺自然，重口福享乐',
        zhushi: SHISHEN_YEAR['食神'],
    },
    {
        name: '伤官',
        alt: '我生异性为伤官',
        def: '我所生之异性，主才华锋芒与创新突破',
        xiji: '身强喜用：伤官泄秀最烈，身强者宜以伤官一展所长；身弱者伤官过旺则折',
        kin: LIUQIN['伤官'].kin,
        qingxing: '聪慧锋芒，敢言善辩，创新求变',
        zhushi: SHISHEN_YEAR['伤官'],
    },
    {
        name: '比肩',
        alt: '同我同性为比肩',
        def: '与日主同五行同阴阳，主自我与同辈',
        xiji: '身弱喜用：比肩帮扶日主，身弱者得比肩助力；身强者比肩叠加则傲慢争财',
        kin: LIUQIN['比肩'].kin,
        qingxing: '自强独立，坚持自我，重义气团结',
        zhushi: SHISHEN_YEAR['比肩'],
    },
    {
        name: '劫财',
        alt: '同我异性为劫财（败财）',
        def: '与日主同五行异阴阳，主竞争破耗',
        xiji: '身弱喜用：劫财亦帮扶日主，但易带争夺之气；身强者劫财破耗财星难守',
        kin: LIUQIN['劫财'].kin,
        qingxing: '豪爽争强，不拘小节，义气重情',
        zhushi: SHISHEN_YEAR['劫财'],
    },
];

/** 十神含义速查折叠表 */
export function shishenTableHtml() {
    const rows = SHISHEN_TABLE.map((t) => `
      <div class="ss10-tr">
        <div class="ss10-name">${t.name}<small class="ss10-alt">${t.alt}</small></div>
        <div class="ss10-def">${t.def}</div>
        <div class="ss10-kin"><b>六亲：</b>${t.kin}</div>
        <div class="ss10-xiji"><b>喜忌：</b>${t.xiji}</div>
        <div class="ss10-qx"><b>性情：</b>${t.qingxing}</div>
        <div class="ss10-zhushi"><b>主事：</b>${t.zhushi}</div>
      </div>`).join('');
    return `<details class="hl-details ss10-details fade-in d3">
      <summary>十神含义速查 · 依子平</summary>
      <div class="ss10-wrap">
        ${rows}
        <div class="ss10-note">十神为子平论命之纲，喜忌须结合日主旺衰与全局取用，命理当雷达，不当牢笼。</div>
      </div>
    </details>`;
}

/** 六十甲子纳音速查折叠表 */
export function nayinTableHtml() {
    const GAN_ORDER = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
    // 按天干分组：每干在六十甲子中出现 6 次
    const groups = GAN_ORDER.map((gan) => {
        const entries = Object.entries(NAYIN).filter(([gz]) => gz[0] === gan);
        const cells = entries.map(([gz, ny]) =>
            `<span class="ny-cell"><b>${gz}</b><i>${ny}</i></span>`
        ).join('');
        return `<div class="ny-row"><span class="ny-gan">${gan}</span>${cells}</div>`;
    }).join('');

    return `<details class="hl-details ny-details fade-in d2">
      <summary>六十甲子纳音速查</summary>
      <div class="ny-table-wrap">
        ${groups}
        <div class="ny-note">纳音为年柱及大运流年之表象参考，命理当雷达，不当牢笼。</div>
      </div>
    </details>`;
}

export function changshengTableHtml(r) {
    const GAN_LIST = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
    const ZHI_LIST = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    const STATE_CLASS = {
        '长生': 's-ok', '临官': 's-ok', '帝旺': 's-ok', '冠带': 's-ok',
        '沐浴': 's-mid', '衰': 's-mid', '病': 's-mid',
        '死': 's-bad', '墓': 's-bad', '绝': 's-bad',
        '胎': '', '养': ''
    };
    const dayGan = r.pillars.day.gan;
    const pillarZhiMap = {
        [r.pillars.year.zhi]: '年支',
        [r.pillars.month.zhi]: '月支',
        [r.pillars.day.zhi]: '日支',
        [r.pillars.time.zhi]: '时支'
    };
    const hitZhis = new Set([r.pillars.year.zhi, r.pillars.month.zhi, r.pillars.day.zhi, r.pillars.time.zhi]);

    const rows = GAN_LIST.map((gan) => {
        const isCur = gan === dayGan;
        const cells = ZHI_LIST.map((zhi) => {
            const state = changShengState(gan, zhi);
            const sc = STATE_CLASS[state] || '';
            const isHit = isCur && hitZhis.has(zhi);
            const titleAttr = isHit ? ` title="${pillarZhiMap[zhi] || ''}"` : '';
            return `<span class="cst-cell${sc ? ' ' + sc : ''}${isHit ? ' hit' : ''}"${titleAttr}>${state}<small>${zhi}</small></span>`;
        }).join('');
        return `<div class="cst-row${isCur ? ' cst-cur' : ''}"><span class="cst-gan">${gan}</span><span class="cst-cells">${cells}</span></div>`;
    }).join('');

    return `<details class="hl-details cs-tb-details fade-in d2">
      <summary>十二长生一览 · 十干十二支循环<span class="hint">阳干顺行 阴干逆行</span></summary>
      <div class="cst-wrap">
        ${rows}
        <div class="hl-note">十二长生为五行气数之循环节律，吉凶仍以旺衰用神与大运流年综合参详，命理当雷达，不当牢笼。</div>
      </div>
    </details>`;
}

export function ganzhiTableHtml(r) {
    const GAN_DATA = [
        { name: '甲', wx: '甲木', yin: '阳', pos: '东', season: '春', xiang: '栋梁大木' },
        { name: '乙', wx: '乙木', yin: '阴', pos: '东', season: '春', xiang: '花草之木' },
        { name: '丙', wx: '丙火', yin: '阳', pos: '南', season: '夏', xiang: '太阳之火' },
        { name: '丁', wx: '丁火', yin: '阴', pos: '南', season: '夏', xiang: '灯烛之火' },
        { name: '戊', wx: '戊土', yin: '阳', pos: '中', season: '长夏', xiang: '城墙之土' },
        { name: '己', wx: '己土', yin: '阴', pos: '中', season: '长夏', xiang: '田园之土' },
        { name: '庚', wx: '庚金', yin: '阳', pos: '西', season: '秋', xiang: '刀剑之金' },
        { name: '辛', wx: '辛金', yin: '阴', pos: '西', season: '秋', xiang: '珠玉之金' },
        { name: '壬', wx: '壬水', yin: '阳', pos: '北', season: '冬', xiang: '江河之水' },
        { name: '癸', wx: '癸水', yin: '阴', pos: '北', season: '冬', xiang: '雨露之水' },
    ];
    const ZHI_DATA = [
        { name: '子', wx: '子水', yin: '阳', pos: '北', shi: '23-1', sheng: '子鼠', cang: '癸' },
        { name: '丑', wx: '丑土', yin: '阴', pos: '东北', shi: '1-3', sheng: '丑牛', cang: '己癸辛' },
        { name: '寅', wx: '寅木', yin: '阳', pos: '东北', shi: '3-5', sheng: '寅虎', cang: '甲丙戊' },
        { name: '卯', wx: '卯木', yin: '阴', pos: '东', shi: '5-7', sheng: '卯兔', cang: '乙' },
        { name: '辰', wx: '辰土', yin: '阳', pos: '东南', shi: '7-9', sheng: '辰龙', cang: '戊乙癸' },
        { name: '巳', wx: '巳火', yin: '阴', pos: '东南', shi: '9-11', sheng: '巳蛇', cang: '丙戊庚' },
        { name: '午', wx: '午火', yin: '阳', pos: '南', shi: '11-13', sheng: '午马', cang: '丁己' },
        { name: '未', wx: '未土', yin: '阴', pos: '西南', shi: '13-15', sheng: '未羊', cang: '己丁乙' },
        { name: '申', wx: '申金', yin: '阳', pos: '西南', shi: '15-17', sheng: '申猴', cang: '庚壬戊' },
        { name: '酉', wx: '酉金', yin: '阴', pos: '西', shi: '17-19', sheng: '酉鸡', cang: '辛' },
        { name: '戌', wx: '戌土', yin: '阳', pos: '西北', shi: '19-21', sheng: '戌狗', cang: '戊辛丁' },
        { name: '亥', wx: '亥水', yin: '阴', pos: '西北', shi: '21-23', sheng: '亥猪', cang: '壬甲' },
    ];
    const dayGan = r && r.pillars ? r.pillars.day.gan : '';
    const dayZhi = r && r.pillars ? r.pillars.day.zhi : '';
    const ganRows = GAN_DATA.map(g => {
        const cur = g.name === dayGan;
        return `<div class="gzd-row${cur ? ' cur' : ''}"${cur ? ' title="日干"' : ''}><span class="gzd-name">${g.name}</span><span class="gzd-cols"><span>${g.wx}</span><span>${g.yin}</span><span>${g.pos}</span><span>${g.season}</span><span>${g.xiang}</span></span></div>`;
    }).join('');
    const zhiRows = ZHI_DATA.map(z => {
        const cur = z.name === dayZhi;
        return `<div class="gzd-row${cur ? ' cur' : ''}"${cur ? ' title="日支"' : ''}><span class="gzd-name">${z.name}</span><span class="gzd-cols"><span>${z.wx}</span><span>${z.yin}</span><span>${z.pos}</span><span>${z.shi}</span><span>${z.sheng}</span><span>藏${z.cang}</span></span></div>`;
    }).join('');
    return `<details class="hl-details gzd-details fade-in">
      <summary>天干地支速查 · 五行阴阳方位类象<span class="hint">十干十二支通识</span></summary>
      <div class="gzd-wrap">
        <div class="gzd-gan">${ganRows}</div>
        <div class="gzd-zhi">${zhiRows}</div>
        <div class="hl-note">干支为四柱之基，五行阴阳类象为参详之辅，吉凶仍以旺衰用神与大运流年综合论断，命理当雷达，不当牢笼。</div>
      </div>
    </details>`;
}

/** 十二地支关系速查折叠表（六合六冲三合三会刑害） */
export function dizhiRelationTableHtml() {
    const blocks = [
        {
            title: '六合（合化）',
            chips: ['子丑合土', '寅亥合木', '卯戌合火', '辰酉合金', '巳申合水', '午未合土'],
        },
        {
            title: '六冲',
            chips: ['子午相冲', '丑未相冲', '寅申相冲', '卯酉相冲', '辰戌相冲', '巳亥相冲'],
        },
        {
            title: '三合局',
            chips: ['申子辰合水局', '寅午戌合火局', '巳酉丑合金局', '亥卯未合木局'],
        },
        {
            title: '三会方',
            chips: ['寅卯辰会木方', '巳午未会火方', '申酉戌会金方', '亥子丑会水方'],
        },
        {
            title: '相刑',
            chips: ['寅刑巳·巳刑申·申刑寅（无恩之刑）', '丑刑戌·戌刑未·未刑丑（恃势之刑）', '子刑卯·卯刑子（无礼之刑）', '辰午酉亥自刑'],
        },
        {
            title: '六害',
            chips: ['子未相害', '丑午相害', '寅巳相害', '卯辰相害', '申亥相害', '酉戌相害'],
        },
    ];
    const blocksHtml = blocks.map(b => {
        const chipsHtml = b.chips.map(c => `<span class="dzr-chip">${c}</span>`).join('');
        return `<div class="dzr-block"><div class="dzr-title">${b.title}</div><div class="dzr-chips">${chipsHtml}</div></div>`;
    }).join('');
    return `<details class="hl-details dzr-details fade-in">
      <summary>十二地支关系速查 · 六合六冲三合三会刑害<span class="hint">地支生克常法</span></summary>
      <div class="dzr-wrap">
        ${blocksHtml}
        <div class="hl-note">地支六合六冲三合三会为命理生克之常法，吉凶仍以旺衰用神与大运流年综合论断，命理当雷达，不当牢笼。</div>
      </div>
    </details>`;
}

/** 天干五合速查 · 合化引化与古籍 */
export function tianGanHeHuaTableHtml() {
    const cards = [
        {
            pair: '甲己',
            wuxing: '合化土',
            name: '中正之合',
            cond: '辰戌丑未月（土旺）或火土月令',
            gu: '甲己为中正之合，尊崇重大，宽厚平直',
        },
        {
            pair: '乙庚',
            wuxing: '合化金',
            name: '仁义之合',
            cond: '申酉月（金旺）或辰戌丑未月',
            gu: '乙庚为仁义之合，刚柔相济，果敢守义',
        },
        {
            pair: '丙辛',
            wuxing: '合化水',
            name: '威制之合',
            cond: '亥子月（水旺）或申酉月',
            gu: '丙辛为威制之合，仪表威肃，威慑刚毅',
        },
        {
            pair: '丁壬',
            wuxing: '合化木',
            name: '匿和之合',
            cond: '寅卯月（木旺）或亥子月',
            gu: '丁壬为匿和之合，多谋善虑，外柔内明',
        },
        {
            pair: '戊癸',
            wuxing: '合化火',
            name: '无情之合',
            cond: '巳午月（火旺）或寅卯月',
            gu: '戊癸为无情之合，主多情易变，男娶少女女嫁少夫',
        },
    ];
    const cardsHtml = cards.map(c => `
        <div class="hh5-card">
          <div class="hh5-head">${c.pair} ${c.wuxing}</div>
          <div class="hh5-name">${c.name}</div>
          <div class="hh5-cond">引化条件：${c.cond}</div>
          <div class="hh5-gu">「${c.gu}」</div>
        </div>`).join('');
    return `<details class="hl-details hh5-details fade-in">
      <summary>天干五合速查 · 合化引化与古籍<span class="hint">渊海子平</span></summary>
      <div class="hh5-wrap">
        ${cardsHtml}
        <div class="hl-note">天干五合主合绊与合化，是否合化成功须看月令引化与全局旺衰，吉凶仍以旺衰用神与大运流年综合论断，命理当雷达，不当牢笼。</div>
      </div>
    </details>`;
}

/** 神煞速查折叠表（常用十二神煞，依《渊海子平》口径） */
export function shenShaTableHtml() {
    const items = [
        {
            name: '天乙贵人',
            tag: '吉',
            tagClass: 'sxs-tag',
            method: '甲戊庚牛羊，乙己鼠猴乡，丙丁猪鸡位，壬癸兔蛇藏，庚辛逢虎马',
            jixiong: '贵人扶持，逢凶化吉，遇难呈祥',
            gu: '「天乙贵人为至尊之神，遇之则吉，凶中化吉」',
        },
        {
            name: '文昌贵人',
            tag: '吉',
            tagClass: 'sxs-tag',
            method: '甲乙巳午报君知，丙戊申宫丁己鸡，庚猪辛鼠壬逢虎，癸人见卯入云梯',
            jixiong: '利学业文思，聪明才智出众，考试得助',
            gu: '「文昌者，主文采聪慧，功名文章之神」',
        },
        {
            name: '驿马',
            tag: '中',
            tagClass: 'sxs-tag sxs-tag-mid',
            method: '申子辰马在寅，寅午戌马在申，巳酉丑马在亥，亥卯未马在巳',
            jixiong: '主动迁变动移，逢冲则动，宜出行远行',
            gu: '「驿马动则迁移，冲则远行，合则绊足不动」',
        },
        {
            name: '桃花（咸池）',
            tag: '中',
            tagClass: 'sxs-tag sxs-tag-mid',
            method: '申子辰在酉，寅午戌在卯，巳酉丑在午，亥卯未在子',
            jixiong: '主人缘情欲，得令则风流多情，失令则情感纷扰',
            gu: '「咸池为桃花之地，主男女情爱、人缘魅力」',
        },
        {
            name: '禄神',
            tag: '吉',
            tagClass: 'sxs-tag',
            method: '甲禄寅乙禄卯，丙戊禄巳丁己禄午，庚禄申辛禄酉，壬禄亥癸禄子',
            jixiong: '主财禄衣禄，逢禄则衣食丰足，禄被冲破则财路不稳',
            gu: '「建禄者，天干临本气之旺地，衣禄充实之象」',
        },
        {
            name: '羊刃',
            tag: '煞',
            tagClass: 'sxs-tag sxs-tag-bad',
            method: '甲羊刃卯、丙戊刃午、庚刃酉、壬刃子（阳干起，阴干不论）',
            jixiong: '主刚强果断、锋芒过露，用之得当则英勇，用之失当则灾伤',
            gu: '「羊刃者，月刃煞也，刚强好胜，须用官杀制之」',
        },
        {
            name: '将星',
            tag: '吉',
            tagClass: 'sxs-tag',
            method: '申子辰将星在子，寅午戌在午，巳酉丑在酉，亥卯未在卯',
            jixiong: '主掌权统御之才，逢将星则威权在握，利官场仕途',
            gu: '「将星为权贵之神，主统帅领导，逢之宜官宜贵」',
        },
        {
            name: '华盖',
            tag: '中',
            tagClass: 'sxs-tag sxs-tag-mid',
            method: '申子辰华盖在辰，寅午戌在戌，巳酉丑在丑，亥卯未在未',
            jixiong: '主聪慧孤高、艺术之缘，利宗教文艺，易孤独独行',
            gu: '「华盖为艺术孤高之神，聪明绝顶却易独处」',
        },
        {
            name: '亡神',
            tag: '煞',
            tagClass: 'sxs-tag sxs-tag-bad',
            method: '申子辰亡神在亥，寅午戌在巳，巳酉丑在申，亥卯未在寅',
            jixiong: '主心机谋略、易陷是非，谋事善筹，防口舌纷争',
            gu: '「亡神为暗谋之煞，心机重，防是非缠身」',
        },
        {
            name: '劫煞',
            tag: '煞',
            tagClass: 'sxs-tag sxs-tag-bad',
            method: '申子辰劫煞在巳，寅午戌在亥，巳酉丑在寅，亥卯未在申',
            jixiong: '主竞争争夺、防破耗，逢劫煞岁运须防财物受损',
            gu: '「劫煞为破耗争夺之煞，逢之宜防横夺与竞争」',
        },
        {
            name: '天医',
            tag: '吉',
            tagClass: 'sxs-tag',
            method: '正月起戌顺行十二支（正戌、二亥、三子、四丑、五寅、六卯、七辰、八巳、九午、十未、十一申、十二酉）',
            jixiong: '主医药健康，利从事医疗保健行业，逢之病情易好转',
            gu: '「天医为救病愈疾之神，宜医药养生、济世活人」',
        },
        {
            name: '红鸾天喜',
            tag: '吉',
            tagClass: 'sxs-tag',
            method: '红鸾：正卯、二丑、三寅、四午、五未、六申、七酉、八亥、九戌、十子、十一巳、十二辰',
            jixiong: '主人缘喜事，利婚嫁结缘，逢红鸾天喜岁运多喜庆',
            gu: '「红鸾天喜为桃花喜事之神，主婚嫁人缘、喜庆临门」',
        },
    ];
    const cardsHtml = items.map(s => `
        <div class="sxs-card">
          <div class="sxs-head">${s.name}<span class="${s.tagClass}">${s.tag}</span></div>
          <div class="sxs-method">查法：${s.method}</div>
          <div class="sxs-jixiong">吉凶：${s.jixiong}</div>
          <div class="sxs-gu">${s.gu}</div>
        </div>`).join('');
    return `<details class="hl-details sxs-details fade-in">
      <summary>神煞速查 · 常用神煞一览<span class="hint">渊海子平</span></summary>
      <div class="sxs-grid">${cardsHtml}</div>
      <div class="hl-note">神煞为命理常用参考，吉凶仍以旺衰用神与大运流年综合论断，命理当雷达，不当牢笼。</div>
    </details>`;
}

/** 旬空速查折叠表（六十甲子六旬） */
export function xunKongTableHtml(r) {
    const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
    const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

    // 六十甲子顺序
    const JIAZI = [];
    for (let i = 0; i < 60; i++) {
        JIAZI.push(GAN[i % 10] + ZHI[i % 12]);
    }

    const yearGz = r.pillars.year.ganzhi;
    const dayGz  = r.pillars.day.ganzhi;

    // 每旬10个
    const groups = [];
    for (let x = 0; x < 6; x++) {
        const slice = JIAZI.slice(x * 10, x * 10 + 10);
        const xunHead = slice[0]; // 甲X
        const kongInfo = xun(xunHead);
        const kongStr  = kongInfo.xunKong.join('');

        const chips = slice.map((gz) => {
            const isYear = gz === yearGz;
            const isDay  = gz === dayGz;
            let cls = 'kx-gz';
            if (isYear && isDay) cls += ' hit hit-year hit-day';
            else if (isYear)     cls += ' hit hit-year';
            else if (isDay)      cls += ' hit hit-day';
            return `<span class="${cls}">${gz}</span>`;
        }).join('');

        const xunShou = xunHead[1]; // 旬首支，如'子'
        groups.push(
            `<div class="kx-xun">` +
            `<span class="kx-head">${xunHead[0]}${xunShou}旬 · <span class="kx-kong">空 ${kongStr}</span></span>` +
            `<span class="kx-chips">${chips}</span>` +
            `</div>`
        );
    }

    return `<details class="hl-details kx-details fade-in d2">
      <summary>旬空速查 · 六十甲子六旬</summary>
      <div class="kx-table-wrap">
        ${groups.join('\n        ')}
        <div class="hl-note">旬空为命理常用神煞之一，吉凶须结合旺衰用神与大运流年综合参详，命理当雷达，不当牢笼。</div>
      </div>
    </details>`;
}

/** 四柱藏干速查折叠表（通识十二支藏干 + 用户盘透干通根） */
export function cangGanTableHtml(r) {
    // 十二支藏干数据：[本气, 中气?, 余气?]
    const CANG_GAN = {
        子: [{ gan: '癸', level: 'main' }],
        丑: [{ gan: '己', level: 'main' }, { gan: '癸', level: 'mid' }, { gan: '辛', level: 'yu' }],
        寅: [{ gan: '甲', level: 'main' }, { gan: '丙', level: 'mid' }, { gan: '戊', level: 'yu' }],
        卯: [{ gan: '乙', level: 'main' }],
        辰: [{ gan: '戊', level: 'main' }, { gan: '乙', level: 'mid' }, { gan: '癸', level: 'yu' }],
        巳: [{ gan: '丙', level: 'main' }, { gan: '庚', level: 'mid' }, { gan: '戊', level: 'yu' }],
        午: [{ gan: '丁', level: 'main' }, { gan: '己', level: 'mid' }],
        未: [{ gan: '己', level: 'main' }, { gan: '丁', level: 'mid' }, { gan: '乙', level: 'yu' }],
        申: [{ gan: '庚', level: 'main' }, { gan: '壬', level: 'mid' }, { gan: '戊', level: 'yu' }],
        酉: [{ gan: '辛', level: 'main' }],
        戌: [{ gan: '戊', level: 'main' }, { gan: '辛', level: 'mid' }, { gan: '丁', level: 'yu' }],
        亥: [{ gan: '壬', level: 'main' }, { gan: '甲', level: 'mid' }],
    };
    const ZHI_ORDER = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    const LEVEL_LABEL = { main: '本气', mid: '中气', yu: '余气' };

    // 第一部分：通识十二支藏干表
    const rowsHtml = ZHI_ORDER.map(zhi => {
        const cangList = CANG_GAN[zhi];
        const chipsHtml = cangList.map(({ gan, level }) => {
            const cls = level === 'main' ? 'cg-gz cg-main' : 'cg-gz';
            return `<span class="${cls}" title="${LEVEL_LABEL[level]}">${gan}<sub>${LEVEL_LABEL[level]}</sub></span>`;
        }).join(' ');
        return `<div class="cg-row"><span class="cg-zhi">${zhi}</span>${chipsHtml}</div>`;
    }).join('\n        ');

    // 第二部分：四柱透干通根（仅当 r 含 pillars 时）
    let pillarsHtml = '';
    if (r && r.pillars) {
        const PILLAR_NAMES = [
            { key: 'year', label: '年柱' },
            { key: 'month', label: '月柱' },
            { key: 'day', label: '日柱' },
            { key: 'time', label: '时柱' },
        ];

        const touNotes = [];
        const cardsHtml = PILLAR_NAMES.map(({ key, label }) => {
            const p = r.pillars[key];
            if (!p) return '';
            const tg = p.gan;
            const dz = p.zhi;
            const cangList = CANG_GAN[dz] || [];

            const chipItems = cangList.map(({ gan, level }) => {
                const isTou = gan === tg;
                const levelLabel = LEVEL_LABEL[level];
                if (isTou) {
                    return `<span class="cg-gz cg-tou" title="天干透出通根">${gan}<sup>透</sup></span>`;
                } else {
                    return `<span class="cg-gz cg-xu" title="${levelLabel}藏而未透">${gan}<sup>藏</sup></span>`;
                }
            }).join(' ');

            // 透干结论
            const touGans = cangList.filter(({ gan }) => gan === tg).map(() => tg);
            let noteText = '';
            if (touGans.length > 0) {
                noteText = `${label[0]}干${tg}通根于${dz}`;
                touNotes.push(noteText);
            } else {
                noteText = `${label[0]}干${tg}在${dz}中无透`;
            }

            return `<div class="cg-pillar">
          <div class="cg-pillar-head">${label} ${p.ganzhi || tg + dz}</div>
          <div class="cg-pillar-chips">${chipItems || '<span class="cg-empty">无藏干</span>'}</div>
          <div class="cg-note">${noteText}</div>
        </div>`;
        }).join('\n        ');

        const summaryNote = touNotes.length > 0
            ? touNotes.join('，')
            : '本盘四柱天干均未透出通根';

        pillarsHtml = `
      <div class="cg-section-title">四柱透干通根（本盘）</div>
      <div class="cg-pillars">
        ${cardsHtml}
      </div>
      <div class="cg-summary">${summaryNote}</div>`;
    }

    return `<details class="hl-details cg-details fade-in">
      <summary>四柱藏干速查 · 透干通根<span class="hint">子平要法</span></summary>
      <div class="cg-wrap">
        <div class="cg-section-title">十二支藏干通识</div>
        <div class="cg-table">
        ${rowsHtml}
        </div>${pillarsHtml}
        <div class="hl-note">透干通根为子平看旺衰之要法，吉凶仍以旺衰用神与大运流年综合论断，命理当雷达，不当牢笼。</div>
      </div>
    </details>`;
}
