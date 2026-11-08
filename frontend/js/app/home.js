/* app/home.js —— 玄机阁首页 dashboard：品牌 + 今日黄历 + 今日流日 + 三系统入口 + 我的命盘快捷 */
import { todayHuangli, JIANCHU, pickDays } from '../engine/huangli.js';
import { analyze, shiShenOf } from '../engine/bazi-analyze.js';
import { LIU_HE, LIU_HAI, XING, isChong, sanHeOf, zhiAdd } from '../engine/ganzhi.js';
const API = '/api/profiles';

/** 地支藏干（主气·中气·余气） */
const HIDE_GAN = {
  子: '癸', 丑: '己癸辛', 寅: '甲丙戊', 卯: '乙', 辰: '戊乙癸', 巳: '丙戊庚',
  午: '丁己', 未: '己丁乙', 申: '庚壬戊', 酉: '辛', 戌: '戊辛丁', 亥: '壬甲',
};
/** 十神 → 喜忌分组（身强取克泄耗=财官食伤、身弱取生扶=印比） */
const SS_GROUP = {
  正印: '印比', 偏印: '印比', 比肩: '印比', 劫财: '印比',
  正财: '财官食伤', 偏财: '财官食伤', 正官: '财官食伤', 七杀: '财官食伤', 食神: '财官食伤', 伤官: '财官食伤',
};

export const template = `
  <section class="page-head fade-in">
    <h1>玄机阁 <em>·</em> 离线命理推演</h1>
    <p>八字排盘 · 六爻起卦 · 紫微斗数 —— 全部在本机离线计算，不依赖网络</p>
  </section>

  <section class="panel glass hero-card fade-in d1">
    <div class="hero-seal">玄</div>
    <div class="hero-body">
      <h2>三命同参，一阁观之</h2>
      <p class="sub">命理是观察自我的镜子，不是决定命运的判决书。把结论当作雷达，不当牢笼；问卦宜诚，成事在人。</p>
    </div>
    <div class="hero-badges">
      <span class="ss-chip">全离线</span>
      <span class="ss-chip">可安装</span>
      <span class="ss-chip">数据本机</span>
    </div>
  </section>

  <section class="section">
    <div class="section-head"><span class="tick"></span><h2>今日黄历</h2><span class="hint" id="home-hl-hint">读取中…</span></div>
    <div id="home-hl" class="panel glass fade-in d1"><p class="sub">读取中…</p></div>
    <div id="home-liuri"></div>
  </section>

  <section class="section">
    <div class="section-head"><span class="tick"></span><h2>三大推演</h2><span class="hint">依古籍规则化推演 · 离线可用</span></div>
    <div class="home-grid">
      <a class="home-card fade-in d1" href="#/bazi">
        <div class="hc-ico">八字</div>
        <div class="hc-t">八字排盘 · 命理分析</div>
        <div class="hc-d">四柱 · 格局 · 旺衰用神 · 神煞 · 大运流年 · 双系统合参</div>
      </a>
      <a class="home-card fade-in d2" href="#/liuyao">
        <div class="hc-ico">六爻</div>
        <div class="hc-t">六爻起卦 · 断卦参考</div>
        <div class="hc-d">摇钱 / 时间起卦 · 装卦 · 用神旺衰 · 应期 · 梅花体用</div>
      </a>
      <a class="home-card fade-in d3" href="#/ziwei">
        <div class="hc-ico">紫微</div>
        <div class="hc-t">紫微斗数 · 十二宫</div>
        <div class="hc-d">五行局 · 命宫身宫 · 三方四正 · 流年四化 · 大限小限</div>
      </a>
    </div>
  </section>

  <section class="section">
    <div class="section-head"><span class="tick"></span><h2>我的命盘</h2><span class="hint" id="home-pf-hint">读取档案…</span></div>
    <div id="home-profiles" class="panel glass fade-in d1"><p class="sub">读取中…</p></div>
  </section>
`;

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/**
 * 今日流日 · 对命主：今日干支对某命主日主的十神与喜忌、与日柱生克关系。
 * 以黄历今日干支（chart 日柱）为「流日」，对照档案命主的日主（analyze 排盘）。
 */
export function todayLiuRiHtml(profile) {
  if (!profile) return '';
  const h = todayHuangli(new Date());
  const dgz = h.dgz || '';
  if (!dgz) return '';
  const tGan = dgz[0], tZhi = dgz[1];
  let r;
  try { r = analyze({ date: new Date(profile.datetime.replace(' ', 'T')), gender: profile.gender === '女' ? '女' : '男' }); } catch { return ''; }
  const dayGan = r.dayGan;
  const strong = r.strength;
  const fav = (ss) => {
    if (strong === '中') return 'mid';
    const g = SS_GROUP[ss];
    const isFav = strong === '强' ? g === '财官食伤' : g === '印比';
    return isFav ? 'good' : 'bad';
  };
  const ganSS = shiShenOf(tGan, dayGan);
  const hides = (HIDE_GAN[tZhi] || '').split('');
  const hideSS = hides.map((g) => ({ g, ss: shiShenOf(g, dayGan) }));
  const dayZhi = r.pillars.day.zhi;
  const rel = (() => {
    if (LIU_HE[tZhi] === dayZhi) return { name: '六合', cls: 'good', txt: `${tZhi}${dayZhi}六合，今日地支与日柱相合，人缘顺遂` };
    if (isChong(tZhi, dayZhi)) return { name: '相冲', cls: 'bad', txt: `${tZhi}${dayZhi}相冲，今日地支冲日支，宜稳勿躁` };
    if (XING[tZhi] === dayZhi) return { name: '相刑', cls: 'bad', txt: `${tZhi}${dayZhi}相刑，今日地支刑日支，谨言慎行` };
    if (LIU_HAI[tZhi] === dayZhi) return { name: '六害', cls: 'bad', txt: `${tZhi}${dayZhi}六害，今日地支害日支，防小人不顺` };
    if (tZhi === dayZhi) return { name: '伏吟', cls: 'mid', txt: `${tZhi}${dayZhi}伏吟，今日地支与日支同支，宜守成` };
    return { name: '无冲合', cls: 'mid', txt: `${tZhi}与日支${dayZhi}无冲合，平淡安稳` };
  })();
  const chips = (ssArr) => ssArr.map((x) => {
    const c = fav(x.ss);
    return `<span class="tlr-ss ${c}" title="${x.ss}">${x.g}<i>${x.ss}</i></span>`;
  }).join('');
  const ganCls = fav(ganSS);
  const goodN = (ganCls === 'good' ? 1 : 0) + hideSS.filter((x) => fav(x.ss) === 'good').length;
  const badN = (ganCls === 'bad' ? 1 : 0) + hideSS.filter((x) => fav(x.ss) === 'bad').length;
  const note = (() => {
    const base = `今日 ${dgz} 日，对日主 ${dayGan} 而言：天干${ganSS}、地支藏干 ${hideSS.map((x) => x.g + x.ss).join('、')}。`;
    if (rel.cls === 'bad') return `${base}地支${rel.txt}——流日为提醒，宜稳守待时、主动化解，勿冒进。`;
    if (goodN > badN) return `${base}喜用之气居多，且${rel.txt}——可顺势而为，但吉凶仍以当日所为为准。`;
    if (badN > goodN) return `${base}忌神之气稍重，虽${rel.txt}——宜守常渐进，把这一天过稳就是赢。`;
    return `${base}${rel.txt}——平稳之日，按自己的节奏来即可。`;
  })();
  const action = (() => {
    const lv = h.level;
    if (rel.cls === 'bad') return `建除${h.name}（${lv}）· 流日冲刑日支——今日大事缓图，宜稳为主、主动化解；小事先行亦可。`;
    if (lv === '凶') return `今日建除${h.name}（凶）——诸事缓图，宜谨言慎行；重要决策可改日。`;
    if (goodN > badN) return `建除${h.name}（${lv}）＋ 流日喜用居多——今日气场顺，宜乘势推进开市、签约、求财等要事。`;
    if (badN > goodN) return `建除${h.name}（${lv}）· 流日忌神稍重——宜守常渐进，重要之事放到更顺的日子。`;
    return `建除${h.name}（${lv}）· 流日平稳——按既定节奏行事，大事可期、小事从容。`;
  })();
  return `
    <div class="panel glass fade-in d1 tlr-box">
      <div class="tlr-head">
        <b>今日流日 · 对${esc(profile.name || '命主')}</b>
        <span class="tlr-gz">${tGan}<i>${tZhi}</i>日</span>
        <span class="tlr-meta">日主 ${dayGan} · 身${strong}</span>
      </div>
      <div class="tlr-rows">
        <div class="tlr-row">
          <span class="tlr-lbl">天干</span>
          <span class="tlr-g">${tGan}</span>
          <span class="tlr-ss ${ganCls}"><i>${ganSS}</i></span>
        </div>
        <div class="tlr-row">
          <span class="tlr-lbl">藏干</span>
          ${chips(hideSS.map((x) => ({ g: x.g, ss: x.ss })))}
        </div>
        <div class="tlr-row">
          <span class="tlr-lbl">与日柱</span>
          <span class="tlr-rel ${rel.cls}">${rel.txt}</span>
        </div>
      </div>
      <div class="tlr-action"><b>今日行动</b> ${action}</div>
      <div class="tlr-note">${note}</div>
    </div>`;
}

/** 今日十二时辰吉凶：以日支定 —— 六合吉、三合次吉、六冲/六害/相刑凶、余平 */
export function shichenJixiong(dayZhi) {
  const ALL = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const TIMES = ['23-1', '1-3', '3-5', '5-7', '7-9', '9-11', '11-13', '13-15', '15-17', '17-19', '19-21', '21-23'];
  return ALL.map((z, i) => {
    if (LIU_HE[dayZhi] === z) return { z, t: TIMES[i], level: '吉', txt: `${dayZhi}${z}六合` };
    const san = sanHeOf(dayZhi);
    if (z !== dayZhi && san && san.zhi.includes(z)) return { z, t: TIMES[i], level: '次吉', txt: `${dayZhi}${z}三合` };
    if (zhiAdd(dayZhi, 6) === z) return { z, t: TIMES[i], level: '凶', txt: `${dayZhi}冲${z}` };
    if (LIU_HAI[dayZhi] === z) return { z, t: TIMES[i], level: '凶', txt: `${dayZhi}害${z}` };
    if (XING[dayZhi] === z) return { z, t: TIMES[i], level: '凶', txt: dayZhi === z ? '自刑' : `${dayZhi}刑${z}` };
    return { z, t: TIMES[i], level: '平', txt: z === dayZhi ? '本支伏吟' : '无事之辰' };
  });
}

/** 十二时辰吉凶渲染（export 供验证脚本直接断言） */
export function shichenHtml(dayZhi) {
  const LV = { 吉: 'good', 次吉: 'mid', 凶: 'bad', 平: 'flat' };
  const list = shichenJixiong(dayZhi);
  return `
    <div class="sc-wrap">
      <div class="sc-title">今日十二时辰吉凶 <small>以日支${dayZhi}定 · 六合吉 / 三合次吉 / 冲害刑凶 / 余平</small></div>
      <div class="sc-grid">
        ${list.map((x) => `<div class="sc-cell ${LV[x.level]}" title="${x.z}时 ${x.txt}">
          <span class="sc-z">${x.z}</span><span class="sc-t">${x.t}</span>
          <span class="sc-lv">${x.level}</span><span class="sc-txt">${x.txt}</span>
        </div>`).join('')}
      </div>
      <div class="hl-note">时辰吉凶按日支与十二辰之六合、三合、六冲、六害、相刑简断，仅供参考；行事仍以宜忌与个人命盘为准。</div>
    </div>`;
}

/** 今日吉时择时条（export 供验证脚本断言） */
export function jishiHtml(dayZhi) {
  const list = shichenJixiong(dayZhi).filter((x) => x.level === '吉' || x.level === '次吉');
  if (!list.length) return '';
  const chips = list.map((x) => {
    const cls = x.level === '吉' ? 'jshi-good' : 'jshi-mid';
    const tag = x.level === '吉' ? '六合' : '三合';
    return `<div class="jshi-chip ${cls}"><b>${x.z}</b><span>${x.t}</span><i>${tag}</i></div>`;
  }).join('');
  return `
    <div class="jshi-wrap">
      <div class="jshi-title">今日吉时 <small>以日支${dayZhi}定 · 六合吉 / 三合次吉</small></div>
      <div class="jshi-chips">${chips}</div>
      <div class="jshi-tips">吉时为日支与十二辰关系的参考——择要事（签约、出行、求财、面谈）可优先安排在吉时，其余时辰并非不可行；吉凶仍以个人命盘与当日所为为准。</div>
    </div>`;
}

/**
 * 流日周历：未来 7 天（含今日）逐日卡，对命主日主进行十神喜忌分析。
 * @param {object|null} profile  档案对象（需含 datetime/gender/name）
 * @returns {string} HTML 字符串，无档案时返回 ''
 */
export function liuRiWeekHtml(profile) {
    if (!profile) return '';
    let r;
    try { r = analyze({ date: new Date(profile.datetime.replace(' ', 'T')), gender: profile.gender === '女' ? '女' : '男' }); } catch { return ''; }
    const dayGan = r.dayGan;
    const strong = r.strength;
    const dayZhiMaster = r.pillars.day.zhi;
    const fav = (ss) => {
        if (strong === '中') return 'mid';
        const g = SS_GROUP[ss];
        const isFav = strong === '强' ? g === '财官食伤' : g === '印比';
        return isFav ? 'good' : 'bad';
    };
    const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六'];
    const LV_CLS = { '吉': 'ok', '平': 'mid', '凶': 'bad' };
    const cards = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const dt = new Date(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T12:00:00`);
        let h;
        try { h = todayHuangli(dt); } catch { continue; }
        const dgz = h.dgz || '';
        if (!dgz) continue;
        const tGan = dgz[0], tZhi = dgz[1];
        const ganSS = shiShenOf(tGan, dayGan);
        const ganCls = fav(ganSS);
        const hides = (HIDE_GAN[tZhi] || '').split('').filter(Boolean);
        const hideSS = hides.map((g) => ({ g, ss: shiShenOf(g, dayGan) }));
        // 与日柱关系
        const rel = (() => {
            if (LIU_HE[tZhi] === dayZhiMaster) return { name: '六合', cls: 'good' };
            if (isChong(tZhi, dayZhiMaster)) return { name: '相冲', cls: 'bad' };
            if (XING[tZhi] === dayZhiMaster) return { name: '相刑', cls: 'bad' };
            if (LIU_HAI[tZhi] === dayZhiMaster) return { name: '六害', cls: 'bad' };
            if (tZhi === dayZhiMaster) return { name: '伏吟', cls: 'mid' };
            return { name: '无冲合', cls: 'mid' };
        })();
        // 吉时简示（取前 2 个吉/次吉）
        const jsList = shichenJixiong(tZhi).filter((x) => x.level === '吉' || x.level === '次吉').slice(0, 2);
        const jsTxt = jsList.length
            ? jsList.map((x) => `${x.z} ${x.t}`).join(' · ')
            : '无明显吉时';
        // 宜 tags 前 3
        const yiTags = h.yi.slice(0, 3).map((x) => `<span class="hl-tag ok" style="font-size:11px">${esc(x)}</span>`).join('');
        const dateLabel = `${d.getMonth() + 1}/${d.getDate()}`;
        const weekLabel = i === 0 ? '今日' : `周${WEEK_CN[d.getDay()]}`;
        const lvCls = LV_CLS[h.level] || 'mid';
        cards.push(`
        <div class="week-day panel glass fade-in" data-date="${dt.toISOString().slice(0, 10)}">
            <div class="wd-head">
                <span class="wd-date">${dateLabel}</span>
                <span class="wd-week ${i === 0 ? 'today-badge' : ''}">${weekLabel}</span>
                <span class="wd-gz">${esc(dgz)}日</span>
                <span class="hl-level ${lvCls}" style="font-size:11px;padding:2px 6px">${h.name}·${h.level}</span>
            </div>
            <div class="wd-body">
                <div class="wd-row">
                    <span class="tlr-lbl">天干</span>
                    <span class="tlr-ss ${ganCls}" title="${ganSS}">${esc(tGan)}<i>${ganSS}</i></span>
                    ${hideSS.slice(0, 2).map((x) => {
                        const c = fav(x.ss);
                        return `<span class="tlr-ss ${c}" title="${x.ss}">${esc(x.g)}<i>${x.ss}</i></span>`;
                    }).join('')}
                    <span class="wd-rel ${rel.cls}">${rel.name}</span>
                </div>
                <div class="wd-row wd-yi">
                    <span class="tlr-lbl">宜</span>${yiTags || '<span class="hl-tag" style="font-size:11px">诸事不宜</span>'}
                </div>
                <div class="wd-row">
                    <span class="tlr-lbl">吉时</span>
                    <span class="wd-jishi">${esc(jsTxt)}</span>
                </div>
            </div>
        </div>`);
    }
    if (!cards.length) return '';
    return `
    <div class="week-liuri-wrap panel glass fade-in d2" style="margin-top:12px">
        <div class="tlr-head">
            <b>流日周历 · 未来 7 天 · 对${esc(profile.name || '命主')}</b>
            <span class="tlr-meta">日主 ${esc(dayGan)} · 身${esc(strong)}</span>
        </div>
        <div class="week-grid">
            ${cards.join('')}
        </div>
        <div class="hl-note" style="margin-top:8px">周历为逐日参考，命理当雷达，不当牢笼；重事仍择吉日吉时安排，吉凶以个人当日所为为准。</div>
    </div>`;
}

export function mounted(root) {
  const box = root.querySelector('#home-profiles');
  const hint = root.querySelector('#home-pf-hint');
  if (!box) return;

  // ── 今日黄历（建除十二神 + 择日查询） ──
  const hlBox = root.querySelector('#home-hl');
  const hlHint = root.querySelector('#home-hl-hint');
  const parseDate = (s) => (s ? new Date(`${s}T12:00:00`) : new Date());
  let hlDate = new Date();
  const renderHuangli = () => {
    if (!hlBox) return;
    try {
      const h = todayHuangli(hlDate);
      hlHint.textContent = `${h.lunarText} · ${h.week}`;
      const v = `${hlDate.getFullYear()}-${String(hlDate.getMonth() + 1).padStart(2, '0')}-${String(hlDate.getDate()).padStart(2, '0')}`;
      hlBox.innerHTML = `
        <div class="hl-wrap">
          <div class="hl-pick">
            <input type="date" id="hl-date" value="${v}">
            <button type="button" class="btn ghost" id="hl-today" style="padding:6px 12px;font-size:12px">今天</button>
            <span class="hint" style="margin-left:auto">${h.ygz} ${h.mgz} · 月建 ${h.mgz[1]}</span>
          </div>
          <div class="hl-main">
            <div class="hl-gz">${h.dgz}日 · 建除 <b>${h.name}</b></div>
            <span class="hl-level ${h.cls}">${h.level}</span>
          </div>
          <div class="hl-desc">${h.desc} —— 以本月月建（${h.mgz[1]}月）起，${h.dgz[1]}日值 ${h.name}。</div>
          <div class="hl-row"><span class="hl-k ok">宜</span><div class="hl-tags">${h.yi.length ? h.yi.map((x) => `<span class="hl-tag ok">${esc(x)}</span>`).join('') : '<span class="hl-tag">诸事不宜</span>'}</div></div>
          <div class="hl-row"><span class="hl-k bad">忌</span><div class="hl-tags">${h.ji.length ? h.ji.map((x) => `<span class="hl-tag bad">${esc(x)}</span>`).join('') : '<span class="hl-tag">无忌</span>'}</div></div>
          <div class="hl-tagline">${h.tag}</div>
          <div class="hl-xk">旬空 ${h.xunKong.join(' ')} · 旬首 ${h.xunShou} · 冲 ${h.chongZhi}（${h.chongSx}）${h.shaFang ? `· 煞${h.shaFang}` : ''}${h.nextJie ? ` · 下一节 ${h.nextJie.name} ${h.nextJie.at.slice(0, 10)}` : ''}</div>
          <div class="hl-pz"><b>彭祖百忌</b> ${h.pz.ganJi.text} · ${h.pz.zhiJi.text}<span class="hint">传统日忌歌诀 · 作日常参考，不必畏惧</span></div>
          ${shichenHtml(h.dgz[1])}
          ${jishiHtml(h.dgz[1])}
          ${h.festivals && h.festivals.length ? `<div class="hl-fest">今日 ${h.festivals.map((f) => `<b>${esc(f)}</b>`).join(' · ')}</div>` : ''}
          <details class="hl-details">
            <summary>建除十二神一览（依《协纪辨方书》）</summary>
            <div class="hl-table">
              ${JIANCHU.map((j) => `
                <div class="hl-tr">
                  <span class="hl-td-name">${j.name}</span>
                  <span class="hl-td-lv ${j.cls}">${j.level}</span>
                  <span class="hl-td-desc">${j.desc}</span>
                  <span class="hl-td-yi">宜 ${j.yi.length ? j.yi.join('、') : '—'}</span>
                  <span class="hl-td-ji">忌 ${j.ji.length ? j.ji.join('、') : '—'}</span>
                </div>`).join('')}
            </div>
          </details>
          <details class="hl-details pick-details" style="margin-top:10px">
            <summary>近 15 日吉日 · 按宜事选日</summary>
            <div class="pick-bar">
              <label class="field" style="min-width:150px">宜事
                <select id="hl-pick-want">
                  <option value="开市">开市</option>
                  <option value="签约">签约</option>
                  <option value="交易">交易</option>
                  <option value="求财">求财</option>
                  <option value="出行">出行</option>
                  <option value="嫁娶">嫁娶</option>
                  <option value="入学">入学</option>
                </select>
              </label>
              <span class="hint">自所选日期起 15 日内「宜 X」且非凶之日，吉日在前</span>
            </div>
            <div class="pick-list" id="hl-pick-list"></div>
          </details>
          <div class="hl-note">建除十二神依《协纪辨方书》口径，日建随节气月支而定。选日期可查其宜忌，作为择日参考，非吉凶判决。</div>
        </div>`;
      const inp = hlBox.querySelector('#hl-date');
      inp.addEventListener('change', () => { hlDate = parseDate(inp.value); renderHuangli(); });
      hlBox.querySelector('#hl-today').addEventListener('click', () => { hlDate = new Date(); renderHuangli(); });
      const pickList = hlBox.querySelector('#hl-pick-list');
      const wantSel = hlBox.querySelector('#hl-pick-want');
      const renderPick = () => {
        if (!pickList || !wantSel) return;
        const days = pickDays(hlDate, 15, wantSel.value, 6);
        pickList.innerHTML = days.length
          ? days.map((d) => `
            <div class="pick-day">
              <span class="pick-date">${d.solar.slice(5)}<small>${d.week}</small></span>
              <span class="pick-gz">${d.dgz}日</span>
              <span class="pick-name">${d.name}</span>
              <span class="pick-lv ${d.cls}">${d.level}</span>
              <span class="pick-yi">宜 ${d.yi.join('·')}</span>
            </div>`).join('')
          : `<p class="sub">近 15 日无「宜 ${wantSel.value}」且非凶之日，可放宽窗口或改选他事。</p>`;
      };
      wantSel.addEventListener('change', renderPick);
      renderPick();
    } catch (e) {
      hlHint.textContent = '读取失败';
      hlBox.innerHTML = `<p class="sub">黄历读取失败：${esc(e.message)}</p>`;
    }
  };
  renderHuangli();

  function go(route, profile) {
    localStorage.setItem('mingli.selectedProfile', JSON.stringify(profile));
    location.hash = `#/${route}`;
  }

  async function load() {
    let items;
    try {
      const res = await fetch(API);
      if (!res.ok) throw new Error(`${res.status}`);
      items = await res.json();
    } catch {
      hint.textContent = '档案服务未连接，可离线排盘';
      box.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <div style="flex:1"><b>档案服务未连接</b>
            <div class="d" style="font-size:12px;color:var(--text-dim);margin-top:4px">未检测到后端（uvicorn:8090）。八字 / 六爻 / 紫微仍可离线推演，档案保存需联网后端。</div></div>
          <a class="btn ghost" href="#/bazi" style="padding:9px 18px;font-size:13px">即刻排盘</a>
        </div>`;
      return;
    }
    if (!items.length) {
      hint.textContent = '暂无档案';
      box.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <div style="flex:1">尚未保存命主档案。<span class="hint">可前往档案页录入，或直接排盘。</span></div>
          <a class="btn ghost" href="#/profiles" style="padding:9px 18px;font-size:13px">新建档案</a>
          <a class="btn ghost" href="#/bazi" style="padding:9px 18px;font-size:13px">即刻排盘</a>
        </div>`;
      return;
    }
    hint.textContent = `已保存 ${items.length} 条 · 点击一键排盘`;
    box.innerHTML = `<div class="home-pf-list">${items.map((p) => `
      <div class="profile-item fade-in" style="margin:0">
        <div class="avatar">${esc((p.name || '命')[0])}</div>
        <div style="flex:1">
          <div class="pi-name">${esc(p.name)}</div>
          <div class="pi-meta">${p.datetime.replace('T', ' ') || ''} · ${p.gender}${p.note ? ' · ' + esc(p.note) : ''}</div>
        </div>
        <button class="btn ghost" data-h-go="bazi" data-h-id="${p.id}" style="padding:8px 14px;font-size:13px">排八字</button>
        <button class="btn ghost" data-h-go="ziwei" data-h-id="${p.id}" style="padding:8px 14px;font-size:13px">排紫微</button>
      </div>`).join('')}</div>`;
    // 今日流日：优先上次选中的命主，否则用首条档案
    let cur = items[0];
    try {
      const saved = JSON.parse(localStorage.getItem('mingli.selectedProfile') || 'null');
      if (saved && saved.datetime && items.some((p) => p.datetime === saved.datetime)) cur = saved;
    } catch {}
    const liuri = root.querySelector('#home-liuri');
    if (liuri) liuri.innerHTML = todayLiuRiHtml(cur) + liuRiWeekHtml(cur);
    box.querySelectorAll('[data-h-go]').forEach((btn) => btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.hId);
      try {
        const res = await fetch(`${API}/${id}`);
        const p = await res.json();
        go(btn.dataset.hGo, p);
      } catch {}
    }));
  }

  load();
}
