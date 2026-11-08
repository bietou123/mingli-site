/* engine/huangli.js —— 今日黄历：日干支 + 建除十二神 + 宜忌（离线推演，依《协纪辨方书》建除十二直） */
import { chart } from './calendar.js';

const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/**
 * 建除十二神（建·除·满·平·定·执·破·危·成·收·开·闭）。
 * 起法：以当月「节气月支」为建日（与月支同支之日），自建日起逐日顺行十二神。
 * 神位序 = (日支序 - 月支序) mod 12：0=建、1=除、…、11=闭。
 */
export const JIANCHU = [
  { name: '建', level: '吉', cls: 'ok', desc: '万物生发，宜建不立破', yi: ['出行', '上任', '开张', '求谋'], ji: ['动土', '安葬'] },
  { name: '除', level: '吉', cls: 'ok', desc: '除旧布新，扫除晦气', yi: ['除旧', '扫舍', '求医', '沐浴'], ji: ['嫁娶', '远行'] },
  { name: '满', level: '吉', cls: 'ok', desc: '丰盈圆满，宜纳宜收', yi: ['祈福', '祭祀', '结亲', '纳财'], ji: ['动土', '开池'] },
  { name: '平', level: '平', cls: 'mid', desc: '平和安定，宜守常', yi: ['修屋', '平路', '治病', '赴任'], ji: ['开渠', '破土'] },
  { name: '定', level: '吉', cls: 'ok', desc: '安定不移，宜约定', yi: ['安床', '交易', '订婚', '签约'], ji: ['诉讼', '远行'] },
  { name: '执', level: '平', cls: 'mid', desc: '执着持守，宜耕种', yi: ['栽种', '捕捉', '积蓄'], ji: ['搬迁', '开市'] },
  { name: '破', level: '凶', cls: 'bad', desc: '破败之日，万事慎行', yi: [], ji: ['大事', '出行', '嫁娶', '动土'] },
  { name: '危', level: '凶', cls: 'bad', desc: '危而不险，宜守静', yi: ['安床', '祭祀'], ji: ['出行', '动土', '开市'] },
  { name: '成', level: '吉', cls: 'ok', desc: '成就圆满，宜成大事', yi: ['结婚', '开市', '入学', '求财', '上任'], ji: ['诉讼'] },
  { name: '收', level: '平', cls: 'mid', desc: '收敛纳财，宜收不宜放', yi: ['收账', '纳财', '嫁娶', '收藏'], ji: ['开市', '动土'] },
  { name: '开', level: '吉', cls: 'ok', desc: '开启新生，诸事可行', yi: ['开市', '开工', '出行', '求财', '婚嫁'], ji: ['安葬'] },
  { name: '闭', level: '平', cls: 'mid', desc: '闭塞不通，宜静不宜动', yi: ['筑堤', '补墙', '安葬', '收藏'], ji: ['开市', '出行', '嫁娶'] },
];

const TAG = { '吉': '诸事可行，宜乘势进取', '平': '平稳之日，宜守常渐进', '凶': '谨言慎行，大事缓图' };

/** 彭祖百忌 · 日干忌（依《协纪辨方书》引彭祖百忌：逐日干支各一句，传统民俗日忌） */
export const PENGZU_GAN = {
  甲: '甲不开仓，财物耗散', 乙: '乙不栽植，千株不长', 丙: '丙不修灶，必见灾殃',
  丁: '丁不剃头，头必生疮', 戊: '戊不受田，田主不祥', 己: '己不破券，二比并亡',
  庚: '庚不经络，织机虚张', 辛: '辛不合酱，主人不尝', 壬: '壬不泱水，更难提防',
  癸: '癸不词讼，理弱敌强',
};
/** 彭祖百忌 · 日支忌 */
export const PENGZU_ZHI = {
  子: '子不问卜，自惹祸殃', 丑: '丑不冠带，主不还乡', 寅: '寅不祭祀，神鬼不尝',
  卯: '卯不穿井，水泉不香', 辰: '辰不哭泣，必主重丧', 巳: '巳不远行，财物伏藏',
  午: '午不苫盖，屋主更张', 未: '未不服药，毒气入肠', 申: '申不安床，鬼祟入房',
  酉: '酉不会客，醉坐颠狂', 戌: '戌不吃犬，作怪上床', 亥: '亥不嫁娶，不利新郎',
};
/** 依日干/日支取彭祖百忌各一句 */
export function pengzuBaiJi(gan, zhi) {
  return {
    ganJi: { gan, text: PENGZU_GAN[gan] || '' },
    zhiJi: { zhi, text: PENGZU_ZHI[zhi] || '' },
  };
}

// 生肖序与地支一致（子鼠=0）
const SHENGXIAO = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
// 三合局煞方：本日支属申子辰=煞南、寅午戌=煞北、巳酉丑=煞东、亥卯未=煞西
const SAN_SHA = {
  '申': '南', '子': '南', '辰': '南',
  '寅': '北', '午': '北', '戌': '北',
  '巳': '东', '酉': '东', '丑': '东',
  '亥': '西', '卯': '西', '未': '西',
};

/** 命盘页顶部 mini 条：今日日柱 · 建除 · 宜 · 节日 · 彭祖百忌（纯文本拼接，供各 renderResult 复用） */
export function huangliMiniHtml(dt = new Date()) {
  const h = todayHuangli(dt);
  const yi = h.yi.length ? h.yi.slice(0, 4).map((x) => `<span class="hlm-tag ok">${x}</span>`).join('') : '<span class="hlm-tag">诸事不宜</span>';
  const fest = h.festivals && h.festivals.length ? `<span class="hlm-fest">${h.festivals.join('·')}</span>` : '';
  const pz = h.pz;
  const pzTxt = [pz.ganJi.text, pz.zhiJi.text].filter(Boolean).join(' · ');
  return `<div class="hl-mini">今日 ${h.dgz}日 · 建除 <b>${h.name}</b><span class="hl-mini-lv ${h.cls}">${h.level}</span>${fest}<span class="hlm-k">宜</span>${yi}<a class="hlm-more" href="#/home">今日黄历 ›</a>${pzTxt ? `<span class="hlm-pz" title="彭祖百忌 · 传统日忌歌诀，作日常参考">百忌 ${pzTxt}</span>` : ''}</div>`;
}

export function todayHuangli(dt = new Date()) {
  const c = chart(dt);
  const dayZhi = c.pillars.day[1];
  const monthZhi = c.pillars.month[1];
  const di = ZHI.indexOf(dayZhi);
  const mi = ZHI.indexOf(monthZhi);
  const jcIdx = ((di - mi) % 12 + 12) % 12;
  const jc = JIANCHU[jcIdx];
  const chongIdx = (di + 6) % 12;
  return {
    solarText: c.solar.text,
    week: c.solar.week,
    lunarText: c.lunar.text,
    festivals: c.lunar.festivals || [],
    ygz: c.pillars.year, mgz: c.pillars.month, dgz: c.pillars.day,
    dayZhi, monthZhi, jcIdx,
    xunShou: c.xun.xunShou,
    xunKong: c.xun.xunKong,
    nextJie: c.jieqi.nextJie ? { name: c.jieqi.nextJie.name, at: c.jieqi.nextJie.at } : null,
    chongZhi: ZHI[chongIdx],
    chongSx: SHENGXIAO[chongIdx],
    shaFang: SAN_SHA[dayZhi] || '',
    pz: pengzuBaiJi(c.pillars.day[0], dayZhi),
    ...jc,
    tag: TAG[jc.level],
  };
}

/**
 * 择吉日：从 dt 次日起扫描未来 days 天，选出「宜」含 want 且非凶的日子。
 * 排序：吉级优先于平级，同级按日期先后；最多返回 max 条。
 * @returns {Array<{solar, week, dgz, name, level, cls, yi}>}
 */
export function pickDays(dt = new Date(), days = 15, want = '开市', max = 6) {
  const base = new Date(dt);
  const out = [];
  for (let i = 1; i <= days; i++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i, 12, 0, 0);
    const h = todayHuangli(d);
    if (h.level === '凶') continue;
    if (!h.yi.includes(want)) continue;
    out.push({
      solar: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      week: h.week, dgz: h.dgz, name: h.name, level: h.level, cls: h.cls, yi: h.yi,
    });
  }
  return out.sort((a, b) => (a.level === b.level ? (a.solar < b.solar ? -1 : 1) : a.level === '吉' ? -1 : 1)).slice(0, max);
}
