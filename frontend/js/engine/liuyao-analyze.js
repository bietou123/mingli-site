/**
 * engine/liuyao-analyze.js —— 六爻断卦规则引擎
 * =========================================================
 * 在 liuyao.js 排盘（纯装卦，不做吉凶判断）之上叠加一层「规则化参考」：
 * 按所占之事定用神 → 评估用神旺衰 → 察原神忌神 → 世应关系 →
 * 匹配 knowledge-liuyao.json 的古籍断语。
 *
 * 口径：只做结构化提示，不替占者下吉凶判决；负面断语以「提醒」语气呈现。
 */
import { SHENG, KE, wuxingRelation, ZHI, ZHI_WUXING, zhiChong, LIU_HE } from './ganzhi.js';
import { Solar } from './lunar.esm.js';

let KB = null;
export function setKnowledge(data) { KB = data; }

let _YJ = null;
export function setYijingForAnalyze(data) { _YJ = data; }

/** 根据卦名返回大象传卦意一句话（xiangci），查不到返回 null */
export function guaYi(name) {
    if (!_YJ || !_YJ.hexagrams) return null;
    const h = _YJ.hexagrams.find((x) => x.name === name);
    return (h && h.xiangci) ? h.xiangci : null;
}

/** 所占事项 → 用神六亲（婚姻双看，其余取一） */
const ITEM_MAP = {
  测财: '妻财', 财运: '妻财', 求财: '妻财',
  测官: '官鬼', 功名: '官鬼', 事业: '官鬼', 升迁: '官鬼',
  婚姻: '婚姻',
  测病: '世爻', 疾病: '世爻', 健康: '世爻',
  官非: '官鬼', 诉讼: '官鬼',
  父母: '父母', 长辈: '父母',
  子女: '子孙', 后代: '子孙',
  出行: '世爻', 远行: '世爻',
};

const SHI_YING_NAMES = { 生我: '应生世', 我生: '世生应', 同我: '世应比和', 我克: '世克应', 克我: '应克世' };

/** 爻之旺衰：临日月建 +2，得日月生 +1，被日月克 -1，旬空 -2，月破 -3 */
function score(y, ctx) {
  if (y.yuePo) return -3;
  if (y.xunKong) return -2;
  let s = 0;
  if (y.wuxing === ctx.wuxingZhi) s += 2;
  if (y.wuxing === ctx.monthWuxing) s += 2;
  if (y.vsDayZhi === '生我') s += 1;
  if (y.vsMonthZhi === '生我') s += 1;
  if (y.vsDayZhi === '克我') s -= 1;
  if (y.vsMonthZhi === '克我') s -= 1;
  return s;
}

/** 旺衰成因明细：与 score() 同口径，另附每条原因（供可视化 chips） */
function scoreDetail(y, ctx) {
  if (y.yuePo) return { score: -3, causes: [{ t: '月破', n: -3, bad: true }] };
  if (y.xunKong) return { score: -2, causes: [{ t: '旬空', n: -2, bad: true }] };
  const causes = [];
  if (y.wuxing === ctx.wuxingZhi) causes.push({ t: '临日辰', n: 2 });
  if (y.wuxing === ctx.monthWuxing) causes.push({ t: '临月建', n: 2 });
  if (y.vsDayZhi === '生我') causes.push({ t: '得日辰生', n: 1 });
  if (y.vsMonthZhi === '生我') causes.push({ t: '得月建生', n: 1 });
  if (y.vsDayZhi === '克我') causes.push({ t: '受日辰克', n: -1, bad: true });
  if (y.vsMonthZhi === '克我') causes.push({ t: '受月建克', n: -1, bad: true });
  return { score: causes.reduce((a, c) => a + c.n, 0), causes };
}
const wangLv = (s) => (s >= 3 ? '旺相' : s >= 1 ? '中和' : s >= -1 ? '休囚' : '衰绝');

function yInfo(y, ctx) {
  const { score: sc, causes } = scoreDetail(y, ctx);
  return {
    pos: y.pos, posName: y.posName, liuQin: y.liuQin, ganzhi: y.ganzhi, zhi: y.zhi,
    wuxing: y.wuxing, yinYang: y.yinYang,
    moving: y.moving, isShi: y.isShi, isYing: y.isYing,
    xunKong: y.xunKong, yuePo: y.yuePo, liuShen: y.liuShen || '',
    huiTou: y.moving && y.bian ? `${y.bian.huiTou?.name || ''}` : '',
    score: sc, wang: wangLv(sc), causes,
  };
}

/**
 * @param {object} r liuyao.js paipan() 的返回
 * @param {string} item 所占事项键（见 ITEM_MAP）
 */
export function analyze(r, item = '其他') {
  if (!KB) throw new Error('六爻知识库未加载');
  const ctx = r.dayChen;
  const shi = r.benGua.yaos.find((y) => y.isShi);
  const ying = r.benGua.yaos.find((y) => y.isYing);

  // ── 用神 ──
  let ysYaos = [], label;
  const ysKey = ITEM_MAP[item] || '世爻';
  if (ysKey === '世爻') { ysYaos = shi ? [shi] : []; label = '世爻（自占，以我为主）'; }
  else if (ysKey === '婚姻') { ysYaos = r.benGua.yaos.filter((y) => y.liuQin === '妻财' || y.liuQin === '官鬼'); label = '妻财 / 官鬼（婚恋双看）'; }
  else { ysYaos = r.benGua.yaos.filter((y) => y.liuQin === ysKey); label = `${ysKey}（${item}）`; }

  // 多现取旺相，动爻优先
  const ys = ysYaos.length
    ? [...ysYaos].sort((a, b) => (b.moving ? 1 : 0) - (a.moving ? 1 : 0) || score(b, ctx) - score(a, ctx))[0]
    : null;

  // ── 原神 / 忌神（以用神五行为体，跨六亲按五行取） ──
  const ysWx = ys ? ys.wuxing : null;
  const yuanWx = ysWx ? Object.entries(SHENG).find(([k, v]) => v === ysWx)?.[0] : null;
  const jiWx = ysWx ? Object.entries(KE).find(([k, v]) => v === ysWx)?.[0] : null;
  const yuanYaos = yuanWx ? r.benGua.yaos.filter((y) => y.wuxing === yuanWx) : [];
  const jiYaos = jiWx ? r.benGua.yaos.filter((y) => y.wuxing === jiWx) : [];
  const yuan = yuanYaos.find((y) => y.moving) || yuanYaos.sort((a, b) => score(b, ctx) - score(a, ctx))[0] || null;
  const ji = jiYaos.find((y) => y.moving) || jiYaos.sort((a, b) => score(b, ctx) - score(a, ctx))[0] || null;

  // ── 世应关系 ──
  const shiYingRel = shi && ying ? wuxingRelation(shi.wuxing, ying.wuxing) : null;
  const movingCount = r.movingPositions.length;

  // ── 断语匹配（条件键与 knowledge-liuyao.json 的 duanyu[].condition 对应） ──
  const conds = {
    '用神多现': ysYaos.length > 1,
    '原神受伤': yuan ? (yuan.xunKong || yuan.yuePo || yuan.vsDayZhi === '克我' || (ji && ji.moving && score(ji, ctx) >= 1)) : false,
    '忌神旺动': ji ? (ji.moving && score(ji, ctx) >= 1) : false,
    '用神衰弱': ys ? score(ys, ctx) <= -1 : true,
    '用神发动': ys ? ys.moving : false,
    '世应相生': shiYingRel === '生我' || shiYingRel === '我生',
    '动化回头克': ys ? (ys.moving && ys.bian && ys.bian.huiTou?.name?.includes('克')) : false,
    '用神临月破': ys ? ys.yuePo : false,
    '用神逢旬空': ys ? ys.xunKong : false,
    '伏克飞神': r.fuShen.some((f) => f.relation === '克我'),
    '飞来克伏': r.fuShen.some((f) => f.relation === '我克'),
    '世爻安静无克': shi ? (!shi.moving && shi.vsDayZhi !== '克我') : false,
    '六爻乱动': movingCount >= 5,
    '忌神原神同动': ji && yuan ? (ji.moving && yuan.moving) : false,
    '子孙持世占官': shi ? (shi.liuQin === '子孙' && /官|功名/.test(item)) : false,
    '官鬼持世占疾': shi ? (shi.liuQin === '官鬼' && /病|疾/.test(item)) : false,
    '应爻动化财生世': ying ? (ying.moving && ying.bian && wuxingRelation(ying.bian.wuxing, shi?.wuxing) === '我生') : false,
  };

  const duanyu = (KB.duanyu || []).filter((d) => conds[d.condition])
    .map((d) => ({ text: d.text, source: d.source, condition: d.condition }));

  return {
    item, label,
    ysName: ysKey, ys: ys ? yInfo(ys, ctx) : null, ysList: ysYaos.map((y) => yInfo(y, ctx)),
    yuan: yuan ? yInfo(yuan, ctx) : null,
    ji: ji ? yInfo(ji, ctx) : null,
    shi: shi ? yInfo(shi, ctx) : null,
    ying: ying ? yInfo(ying, ctx) : null,
    shiYingRel, shiYingText: shiYingRel ? SHI_YING_NAMES[shiYingRel] : null,
    movingCount, duanyu,
    kongWang: r.dayChen.xunKong, monthZhi: ctx.monthZhi, yuePoZhi: ctx.yuePo,
  };
}

export default { analyze, setKnowledge, yingQi };

/**
 * 应期参考：依用神旺衰/旬空/月破/动爻/忌神状态，扫描未来 days 天，
 * 找符合传统应期原则的最早节点。仅作参考提示，不作准话。
 * @param {object} a analyze() 的返回
 * @param {Date}   dt 起卦公历时刻
 * @param {number} [days=60] 扫描天数
 * @returns {Array<{key:string,desc:string,date:string,ganzhi:string,offset:number}>}
 */
export function yingQi(a, dt, days = 60) {
  const ys = a.ys;
  if (!ys) return [];
  const zhisOf = (wx) => ZHI.filter((z) => ZHI_WUXING[z] === wx);
  const liuHe = LIU_HE[ys.zhi] || null;
  const yuanWx = SHENG[ys.wuxing];
  const score = ys.score ?? 0;
  const wants = [];

  if (ys.xunKong) {
    wants.push({ key: '出空', desc: `用神${ys.liuQin}旬空，逢值（${ys.zhi}）之日出空`, zhis: [ys.zhi] });
    if (score >= 0) wants.push({ key: '逢合', desc: `用神${ys.liuQin}旺相，逢合（${liuHe}）之日为佳`, zhis: liuHe ? [liuHe] : [] });
    else wants.push({ key: '逢生', desc: `用神${ys.liuQin}休囚，逢生扶（${yuanWx}）之日为佳`, zhis: zhisOf(yuanWx) });
  } else if (score >= 0) {
    wants.push({ key: '逢值逢合', desc: `用神${ys.liuQin}旺相，逢值（${ys.zhi}）或逢合（${liuHe}）之日`, zhis: [ys.zhi, liuHe].filter(Boolean) });
  } else {
    wants.push({ key: '逢生', desc: `用神${ys.liuQin}休囚，逢生扶（${yuanWx}）之日为佳`, zhis: zhisOf(yuanWx) });
  }
  if (ys.yuePo) {
    const he = LIU_HE[ys.zhi];
    wants.push({ key: '出破', desc: `用神月破，逢合（${he}）之日出破`, zhis: he ? [he] : [] });
  }
  if (a.ji && a.ji.moving && (a.ji.score ?? 0) >= 1) {
    wants.push({ key: '忌神受制', desc: `忌神${a.ji.liuQin}发动，逢冲（${zhiChong(a.ji.zhi)}）之日受制`, zhis: [zhiChong(a.ji.zhi)] });
  }

  if (!wants.length) return [];
  const today = Solar.fromDate(dt);
  const seen = new Set();
  const found = [];
  for (let i = 1; i <= days && found.length < wants.length; i++) {
    const sol = today.next(i);
    const gz = sol.getLunar().getEightChar().getDay();
    const zhi = gz[1];
    for (let wi = 0; wi < wants.length; wi++) {
      if (seen.has(wi) || !wants[wi].zhis.includes(zhi)) continue;
      seen.add(wi);
      found.push({ key: wants[wi].key, desc: wants[wi].desc, date: sol.toYmd(), ganzhi: gz, offset: i });
      break;
    }
  }
  return found;
}
