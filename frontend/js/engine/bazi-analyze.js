/**
 * engine/bazi-analyze.js —— 八字排盘 + 命理分析规则引擎
 * =========================================================
 * 排盘基于 lunar-javascript 的 EightChar；解读基于本地古籍知识库
 * （knowledge-bazi.json），全部离线计算，不依赖网络/AI。
 *
 * 口径：
 *  - 旺衰用「得令 + 根气」两维简化判断，标注强/中/弱
 *  - 用神按「调候 → 扶抑」顺序取
 *  - 断语由特征匹配知识库，负面断语以「提醒」语气呈现
 *  - 大运流年由 lunar 推算（节气定月，阳男阴女顺排）
 */

import { Solar } from './lunar.esm.js';
import { GAN, ZHI, GAN_WUXING, ZHI_WUXING, SHENG, KE, wuxingRelation, zhiAdd, GAN_HE, SAN_HE, xun, LIU_HE, LIU_HAI, XING, isSelfXing, CHANG_SHENG, sanHeOf } from './ganzhi.js';

let KB = null;
export function setKnowledge(data) { KB = data; }

const MONTH_JIE = [
  '', '', '立春', '惊蛰', '清明', '立夏', '芒种', '小暑', '立秋', '白露', '寒露', '立冬', '大雪', '',
];

/** 调候用神表（按生月支 × 日主五行 → 首选/次选用神） */
export const TIAOHOU = {
  子: { 木: '丙、癸', 火: '丙、甲', 土: '丙、戊', 金: '丁、丙', 水: '丙、戊' },
  丑: { 木: '丙、癸', 火: '丙、甲', 土: '丙、癸', 金: '丙、己', 水: '丙、丁' },
  寅: { 木: '丙、癸', 火: '甲、丙', 土: '丙、癸', 金: '丁、庚', 水: '丙、戊' },
  卯: { 木: '癸、丙', 火: '甲、丙', 土: '丙、癸', 金: '丁、庚', 水: '丙、戊' },
  辰: { 木: '甲、癸', 火: '甲、丙', 土: '戊、甲', 金: '庚、丁', 水: '丙、癸' },
  巳: { 木: '癸、庚', 火: '甲、庚', 土: '丙、庚', 金: '庚、壬', 水: '庚、壬' },
  午: { 木: '癸、壬', 火: '壬、庚', 土: '癸、壬', 金: '壬、庚', 水: '壬、癸' },
  未: { 木: '癸、壬', 火: '壬、甲', 土: '癸、丙', 金: '丁、甲', 水: '癸、甲' },
  申: { 木: '癸、丁', 火: '壬、庚', 土: '甲、丙', 金: '壬、庚', 水: '庚、戊' },
  酉: { 木: '癸、丁', 火: '丙、甲', 土: '癸、辛', 金: '丁、庚', 水: '癸、辛' },
  戌: { 木: '甲、癸', 火: '甲、壬', 土: '丙、戊', 金: '庚、丁', 水: '丙、丁' },
  亥: { 木: '丙、壬', 火: '甲、壬', 土: '丙、甲', 金: '壬、丙', 水: '壬、戊' },
};

/** 地支藏干主气（本气），用于格局定月令 */
const ZHI_MAN = { 子: '癸', 丑: '己', 寅: '甲', 卯: '乙', 辰: '戊', 巳: '丙', 午: '丁', 未: '己', 申: '庚', 酉: '辛', 戌: '戊', 亥: '壬' };

/** 五行对应天干 */
const WX_GAN = { 木: ['甲', '乙'], 火: ['丙', '丁'], 土: ['戊', '己'], 金: ['庚', '辛'], 水: ['壬', '癸'] };

function pillar(gan, zhi, ganSS, zhiSS, naYin, hideGan) {
  return { gan, zhi, ganzhi: gan + zhi, shiShenGan: ganSS, shiShenZhi: zhiSS, naYin, hideGan };
}

/**
 * @param {object} opt
 * @param {Date} opt.date 出生时间
 * @param {'男'|'女'} opt.gender
 */
export function analyze(opt) {
  const { date, gender = '男' } = opt;
  const solar = Solar.fromDate(date);
  const lunar = solar.getLunar();
  const ec = lunar.getEightChar();

  const pillars = {
    year: pillar(ec.getYearGan(), ec.getYearZhi(), ec.getYearShiShenGan(), ec.getYearShiShenZhi(), ec.getYearNaYin(), ec.getYearHideGan()),
    month: pillar(ec.getMonthGan(), ec.getMonthZhi(), ec.getMonthShiShenGan(), ec.getMonthShiShenZhi(), ec.getMonthNaYin(), ec.getMonthHideGan()),
    day: pillar(ec.getDayGan(), ec.getDayZhi(), '日主', ec.getDayShiShenZhi(), ec.getDayNaYin(), ec.getDayHideGan()),
    time: pillar(ec.getTimeGan(), ec.getTimeZhi(), ec.getTimeShiShenGan(), ec.getTimeShiShenZhi(), ec.getTimeNaYin(), ec.getTimeHideGan()),
  };

  const dayGan = ec.getDayGan();
  const dayWuxing = GAN_WUXING[dayGan];

  // ── 五行统计（含藏干，主气权重2、余气权重1） ──
  const wuxingCount = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  const addGan = (g, w) => { wuxingCount[GAN_WUXING[g]] = (wuxingCount[GAN_WUXING[g]] || 0) + w; };
  addGan(ec.getYearGan(), 1); addGan(ec.getMonthGan(), 1); addGan(dayGan, 1); addGan(ec.getTimeGan(), 1);
  ['year', 'month', 'day', 'time'].forEach((k) => {
    const hides = ec[`get${k[0].toUpperCase()}${k.slice(1)}HideGan`]();
    if (hides) hides.forEach((g, idx) => addGan(g, idx === 0 ? 2 : 1));
  });
  const wuxingRank = Object.entries(wuxingCount).sort((a, b) => b[1] - a[1]);

  // ── 旺衰：得令 + 根气 ──
  const monthZhi = ec.getMonthZhi();
  const monthWx = ZHI_WUXING[monthZhi];
  const monthRelation = wuxingRelation(dayWuxing, monthWx); // 日主对月令
  // 生我/同我 → 得令（相/旺）；我生/我克 → 失令（泄/耗）；克我 → 失令（囚）
  const deLing = monthRelation === '生我' || monthRelation === '同我';
  const hideOfDay = Object.values(ZHI).map((z) => ZHI_WUXING[z] === dayWuxing ? z : null).filter(Boolean);
  const hasRoot = Object.values(pillars).some((p) => p.hideGan && p.hideGan.some((g) => GAN_WUXING[g] === dayWuxing));
  const supportCount = [ec.getYearGan(), ec.getMonthGan(), ec.getTimeGan()].filter((g) => wuxingRelation(dayWuxing, GAN_WUXING[g]) === '生我' || GAN_WUXING[g] === dayWuxing).length;
  let strength;
  if (deLing && (hasRoot || supportCount >= 2)) strength = '强';
  else if (!deLing && !hasRoot && supportCount === 0) strength = '弱';
  else strength = '中';

  // ── 格局（月令本气十神） ──
  const monthManGan = ZHI_MAN[monthZhi];
  const monthManSS = ec.getMonthShiShenZhi()[0] || wuxingRelation(dayWuxing, GAN_WUXING[monthManGan]);
  const gejuSS = monthManSS;
  const gejuName = gejuNameOf(gejuSS);
  const gejuDesc = (KB?.geju || []).find((g) => g.name === gejuName);

  // ── 用神（调候 → 扶抑） ──
  const tiaoHou = (TIAOHOU[monthZhi] || {})[dayWuxing] || '';
  const fuyi = strength === '强' ? '取克泄耗（官杀食伤财）' : strength === '弱' ? '取生扶（印比）' : '看调候通关';
  const yongshen = { tiaoHou, fuyi, final: strength === '中' ? (tiaoHou || '中和需观大运') : `${tiaoHou || '调候从简'}；${fuyi}` };

  // ── 大运 ──
  const yun = ec.getYun(gender === '男' ? 1 : 0);
  const qiyunSolar = yun.getStartSolar();
  const daYun = yun.getDaYun().filter((d) => d.getGanZhi()).map((d, idx) => {
    const gz = d.getGanZhi();
    const startSolar = qiyunSolar.nextYear(idx * 10); // 第 idx 步真运（idx 从 0 起）交运于起运日 + 10 年 × idx
    return {
      startYear: d.getStartYear(), endYear: d.getEndYear(), ganzhi: gz,
      startSolar: startSolar.toYmd(),
      ganSS: gz ? shiShenOf(gz[0], dayGan) : '',
      zhiSS: gz ? shiShenOf(ZHI_MAIN_GAN[gz[1]], dayGan) : '',
      liuNian: d.getLiuNian().slice(0, 10).map((n) => ({ year: n.getYear(), ganzhi: n.getGanZhi() })),
    };
  });

  // ── 断语匹配 ──
  const matches = matchDuanyu({ pillars, dayGan, strength, gejuName, wuxingRank, wuxingCount, gender });
  const shishenSummary = summarizeShiShen(pillars, dayGan);
  const shensha = shenshaOf({ pillars, dayGan });
  const relation = ganZhiRelation({ pillars, dayGan });
  const changSheng = changShengOf({ pillars, dayGan });

  return {
    solarText: solar.toYmdHms(),
    lunarText: lunar.toString(),
    ganzhi: { year: ec.getYear(), month: ec.getMonth(), day: ec.getDay(), time: ec.getTime() },
    pillars,
    dayGan, dayWuxing, monthZhi,
    wuxingCount, wuxingRank,
    strength, deLing, hasRoot, supportCount,
    geju: { name: gejuName, ss: gejuSS, desc: gejuDesc },
    yongshen,
    taiYuan: ec.getTaiYuan(), mingGong: ec.getMingGong(), shenGong: ec.getShenGong(),
    qiYun: { startYear: yun.getStartYear(), startMonth: yun.getStartMonth(), startDay: yun.getStartDay(), startSolar: yun.getStartSolar() },
    daYun,
    shishenSummary,
    shensha,
    relation,
    changSheng,
    duanyu: matches,
    gender,
  };
}

/** 六十甲子纳音 */
export const NAYIN = {
  甲子: '海中金', 乙丑: '海中金', 丙寅: '炉中火', 丁卯: '炉中火', 戊辰: '大林木', 己巳: '大林木',
  庚午: '路旁土', 辛未: '路旁土', 壬申: '剑锋金', 癸酉: '剑锋金', 甲戌: '山头火', 乙亥: '山头火',
  丙子: '涧下水', 丁丑: '涧下水', 戊寅: '城头土', 己卯: '城头土', 庚辰: '白蜡金', 辛巳: '白蜡金',
  壬午: '杨柳木', 癸未: '杨柳木', 甲申: '泉中水', 乙酉: '泉中水', 丙戌: '屋上土', 丁亥: '屋上土',
  戊子: '霹雳火', 己丑: '霹雳火', 庚寅: '松柏木', 辛卯: '松柏木', 壬辰: '长流水', 癸巳: '长流水',
  甲午: '沙中金', 乙未: '沙中金', 丙申: '山下火', 丁酉: '山下火', 戊戌: '平地木', 己亥: '平地木',
  庚子: '壁上土', 辛丑: '壁上土', 壬寅: '金箔金', 癸卯: '金箔金', 甲辰: '覆灯火', 乙巳: '覆灯火',
  丙午: '天河水', 丁未: '天河水', 戊申: '大驿土', 己酉: '大驿土', 庚戌: '钗钏金', 辛亥: '钗钏金',
  壬子: '桑柘木', 癸丑: '桑柘木', 甲寅: '大溪水', 乙卯: '大溪水', 丙辰: '沙中土', 丁巳: '沙中土',
  戊午: '天上火', 己未: '天上火', 庚申: '石榴木', 辛酉: '石榴木', 壬戌: '大海水', 癸亥: '大海水',
};

/** 十二支藏干（主气在前） */
const ZANG_GAN = {
  子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'],
  辰: ['戊', '乙', '癸'], 巳: ['丙', '庚', '戊'], 午: ['丁', '己'], 未: ['己', '丁', '乙'],
  申: ['庚', '壬', '戊'], 酉: ['辛'], 戌: ['戊', '辛', '丁'], 亥: ['壬', '甲'],
};

/** 子平三命详解：胎元 / 命宫 / 身宫（干十神 + 支藏干十神 + 纳音 + 含义） */
export function sanmingDetail(r) {
  const mk = (name, gz, theme, desc) => {
    const gan = gz[0], zhi = gz[1];
    const ganSS = shiShenOf(gan, r.dayGan);
    const cang = (ZANG_GAN[zhi] || []).map((g) => `${g}（${shiShenOf(g, r.dayGan)}）`).join('、');
    return { name, gz, gan, zhi, naYin: NAYIN[gz] || '—', ganSS, cang, theme, desc };
  };
  return {
    taiYuan: mk('胎元', r.taiYuan, '受胎之气 · 先天根气', '以月柱天干进一、地支进三推得，为受孕之初所禀之气，主先天体质与早年根气。'),
    mingGong: mk('命宫', r.mingGong, '定局之纲 · 一生纲领', '以生月与生时推得之宫垣，为一生命运之纲领，主格局气象与一生大方向。'),
    shenGong: mk('身宫', r.shenGong, '后天作为 · 行为趋向', '与命宫互为体用，主后天作为与行为趋向，观其干支十神可知行藏所向。'),
  };
}

/** 十神 → 格局名 */
function gejuNameOf(ss) {
  const map = { 正官: '正官格', 七杀: '七杀格', 正财: '正财格', 偏财: '偏财格', 正印: '印绶格', 偏印: '偏印格', 食神: '食神格', 伤官: '伤官格', 比肩: '建禄格', 劫财: '羊刃格' };
  return map[ss] || `${ss}格`;
}

/** 特征匹配断语（条件键与 knowledge-bazi.json 的 duanyu[].condition 一一对应） */
let DUANYU_KEYS = [];
export function getDuanyuKeys() { return DUANYU_KEYS; }

function matchDuanyu({ pillars, dayGan, strength, gejuName, wuxingCount, gender }) {
  if (!KB) return [];
  const out = [];
  const dayWx = GAN_WUXING[dayGan];
  const ganSS = [pillars.year.shiShenGan, pillars.month.shiShenGan, pillars.time.shiShenGan];
  const allZhiSS = [pillars.year, pillars.month, pillars.day, pillars.time].flatMap((p) => p.shiShenZhi || []);
  const allZhi = [pillars.year.zhi, pillars.month.zhi, pillars.day.zhi, pillars.time.zhi];
  const has = (ss) => ganSS.includes(ss);
  const hasZhi = (ss) => allZhiSS.includes(ss);
  // 五行得分（含藏干权重）：我克=财、生我=印、克我=官杀
  const caiWx = KE[dayWx];
  const yinWx = SHENG[dayWx];
  const guanWx = Object.entries(KE).find(([k]) => KE[k] === dayWx)?.[0];
  const caiScore = wuxingCount[caiWx] || 0;
  const bijieScore = wuxingCount[dayWx] || 0;
  const yinScore = wuxingCount[yinWx] || 0;
  const hasRoot = Object.values(pillars).some((p) => p.hideGan && p.hideGan.some((g) => GAN_WUXING[g] === dayWx));
  const luZhi = GAN_LU[dayGan]; // 日主临官（禄）所在支

  const conds = {
    '财旺身弱无印比': strength === '弱' && !has('正印') && !has('偏印') && !has('比肩') && !has('劫财'),
    '财弱比劫旺': caiScore > 0 && bijieScore - caiScore >= 2,
    '正官七杀同透': has('正官') && has('七杀'),
    '正官+劫财透干': has('正官') && has('劫财'),
    '伤官+正官同透': has('伤官') && has('正官'),
    '伤官格无财星': gejuName === '伤官格' && !has('正财') && !has('偏财'),
    '印格+财透干': gejuName === '印绶格' && (has('正财') || has('偏财')),
    '印星过旺无官杀': yinScore >= 4 && !has('正官') && !has('七杀'),
    '官印双清无财': has('正官') && has('正印') && !has('正财') && !has('偏财'),
    '七杀正印同支透干无破坏': hasZhi('七杀') && hasZhi('正印') && has('正印'),
    '建禄无官透': gejuName === '建禄格' && !has('正官'),
    '时柱日禄被冲': luZhi && pillars.time.zhi === luZhi && allZhi.some((z) => zhiAdd(luZhi, 6) === z),
    '身弱财透干': strength === '弱' && (has('正财') || has('偏财')),
    '官杀混杂女命': gender === '女' && has('正官') && has('七杀'),
    '官印身均有根': has('正官') && hasZhi('正官') && (has('正印') || has('偏印')) && hasRoot,
    '食伤生财身强': strength === '强' && (has('食神') || has('伤官')) && (has('正财') || has('偏财')),
    // ── 第二轮扩充（渊海子平 / 滴天髓 / 三命通会） ──
    '枭神夺食': has('偏印') && has('食神') && !has('正财') && !has('偏财'),
    '食神制杀': has('食神') && has('七杀'),
    '比劫夺财': strength === '强' && has('劫财') && (has('正财') || has('偏财')),
    '伤官伤尽': gejuName === '伤官格' && !has('正官') && !has('七杀'),
    '日禄归时': GAN_LU[dayGan] === pillars.time.zhi,
    '日坐专禄': GAN_LU[dayGan] === pillars.day.zhi,
    '印重身弱': strength === '弱' && yinScore >= 3,
  };
  DUANYU_KEYS = Object.keys(conds);

  for (const d of KB.duanyu || []) {
    if (conds[d.condition]) {
      out.push({ text: d.text, source: d.source, condition: d.condition });
    }
  }
  return out;
}

/** 日主 → 临官禄支 */
const GAN_LU = { 甲: '寅', 乙: '卯', 丙: '巳', 戊: '巳', 丁: '午', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };

/* ── 神煞表（渊海子平 / 三命通会通行口径） ──────────────── */
const TIAN_YI = { 甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'], 乙: ['子', '申'], 己: ['子', '申'], 丙: ['亥', '酉'], 丁: ['亥', '酉'], 壬: ['卯', '巳'], 癸: ['卯', '巳'], 辛: ['寅', '午'] };
const WEN_CHANG = { 甲: '巳', 乙: '午', 丙: '申', 戊: '申', 丁: '酉', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' };
const YANG_REN = { 甲: '卯', 乙: '寅', 丙: '午', 戊: '午', 丁: '巳', 己: '巳', 庚: '酉', 辛: '申', 壬: '子', 癸: '亥' };
const JIN_YU = { 甲: '辰', 乙: '巳', 丙: '未', 戊: '未', 丁: '申', 己: '申', 庚: '戌', 辛: '亥', 壬: '丑', 癸: '寅' };
const TIAN_DE = { 寅: '丁', 卯: '申', 辰: '壬', 巳: '辛', 午: '亥', 未: '甲', 申: '癸', 酉: '寅', 戌: '丙', 亥: '乙', 子: '巳', 丑: '庚' };
const YUE_DE = { 寅午戌: '丙', 申子辰: '壬', 亥卯未: '甲', 巳酉丑: '庚' };
const HONG_LUAN = { 子: '卯', 丑: '寅', 寅: '丑', 卯: '子', 辰: '亥', 巳: '戌', 午: '酉', 未: '申', 申: '未', 酉: '午', 戌: '巳', 亥: '辰' };
const GUI_JI = ['庚辰', '庚戌', '壬辰', '戊戌'];
/** 三合局类星：按年支/日支所在三合局查 */
const STAR_FOUR = {
  桃花: { 申子辰: '酉', 寅午戌: '卯', 巳酉丑: '午', 亥卯未: '子' },
  驿马: { 申子辰: '寅', 寅午戌: '申', 巳酉丑: '亥', 亥卯未: '巳' },
  华盖: { 申子辰: '辰', 寅午戌: '戌', 巳酉丑: '丑', 亥卯未: '未' },
  将星: { 申子辰: '子', 寅午戌: '午', 巳酉丑: '酉', 亥卯未: '卯' },
};
/* 孤辰寡宿：以年支地支顺连三合定（亥子丑/寅卯辰/巳午未/申酉戌） */
const GU_GROUP = { 亥: ['亥', '子', '丑'], 寅: ['寅', '卯', '辰'], 巳: ['巳', '午', '未'], 申: ['申', '酉', '戌'] };
/* 亡神劫煞：以年支五行三合定 */
const WANG_JIE = {
  亡神: { 申子辰: '寅', 寅午戌: '巳', 巳酉丑: '申', 亥卯未: '亥' },
  劫煞: { 申子辰: '巳', 寅午戌: '亥', 巳酉丑: '寅', 亥卯未: '申' },
};
const STAR_DESC = {
  桃花: '人缘与异性缘、审美艺术，旺则风流有情', 驿马: '奔波变动、远行迁移，主动求新', 华盖: '孤高清雅、才艺玄学、宗教缘', 将星: '领导威望、统御之能',
  天乙贵人: '逢凶化吉，最吉之神', 文昌: '聪慧好学，利文才考试', 羊刃: '刚烈果决，冲劲亦易招破', 禄神: '衣食财禄，事业根基', 金舆: '车马荫庇，自带贵气',
  天德贵人: '积善福泽，逢凶化吉', 月德贵人: '福荫安泰，灾祸潜消', 魁罡: '性刚果断，聪明正直', 红鸾: '婚恋喜庆之兆', 天喜: '喜庆吉事临门', 空亡: '该宫主事虚而不实，宜静不宜动',
  孤辰: '孤独自立、清净离群，亦主内省与专注', 寡宿: '孤僻沉静、喜独处，宜静心修行', 亡神: '心机深沉、操权有谋，正用则旺', 劫煞: '行事刚烈、动易有波折，慎防急进',
};

/** 神煞：年支/日支起驿马桃花华盖将星，日干起贵人文昌羊刃禄金舆，月支起天德月德，日柱定魁罡空亡，年支起红鸾天喜 */
function shenshaOf({ pillars, dayGan }) {
  const dayZhi = pillars.day.zhi;
  const monthZhi = pillars.month.zhi;
  const yearZhi = pillars.year.zhi;
  const out = [];
  const push = (name, gz, palace, good = true) => {
    if (out.some((o) => o.name === name && o.palace === palace)) return;
    out.push({ name, gz, palace, desc: STAR_DESC[name] || '', good });
  };
  const palaceOf = (target, kind) => {
    const table = kind === '支'
      ? { year: pillars.year.zhi, month: pillars.month.zhi, day: pillars.day.zhi, time: pillars.time.zhi }
      : { year: pillars.year.gan, month: pillars.month.gan, day: pillars.day.gan, time: pillars.time.gan };
    for (const [p, v] of Object.entries(table)) if (v === target) return p;
    return null;
  };
  const sanKey = (z) => (SAN_HE.find((h) => h.zhi.includes(z)) || {}).zhi?.join('') || '';

  ['year', 'day'].forEach((from) => {
    const k = sanKey(pillars[from].zhi);
    if (!k) return;
    Object.keys(STAR_FOUR).forEach((n) => {
      const target = STAR_FOUR[n][k];
      const p = palaceOf(target, '支');
      if (p) push(n, target, p);
    });
  });

  const dayGanTables = [['天乙贵人', TIAN_YI, '支'], ['文昌', WEN_CHANG, '支'], ['羊刃', YANG_REN, '支'], ['禄神', GAN_LU, '支'], ['金舆', JIN_YU, '支']];
  dayGanTables.forEach(([name, table]) => {
    const target = table[dayGan];
    if (!target) return;
    if (Array.isArray(target)) target.forEach((t) => { const p = palaceOf(t, '支'); if (p) push(name, t, p); });
    else { const p = palaceOf(target, '支'); if (p) push(name, target, p); }
  });

  const tianDe = TIAN_DE[monthZhi];
  const yueDe = YUE_DE[sanKey(monthZhi)];
  const pT = palaceOf(tianDe, '干'); if (pT) push('天德贵人', tianDe, pT);
  const pY = palaceOf(yueDe, '干'); if (pY) push('月德贵人', yueDe, pY);

  if (GUI_JI.includes(dayGan + dayZhi)) push('魁罡', dayGan + dayZhi, 'day');

  const hong = HONG_LUAN[yearZhi];
  const pH = palaceOf(hong, '支'); if (pH) push('红鸾', hong, pH);
  const pT2 = palaceOf(zhiAdd(hong, 6), '支'); if (pT2) push('天喜', zhiAdd(hong, 6), pT2);

  const { xunKong } = xun(dayGan + dayZhi);
  xunKong.forEach((z) => { const p = palaceOf(z, '支'); if (p) push('空亡', z, p, false); });

  // 孤辰寡宿（年支，地支顺连三合；孤辰=组首+3，寡宿=组首-1）
  const head = Object.keys(GU_GROUP).find((h) => GU_GROUP[h].includes(yearZhi));
  if (head) {
    const gu = ZHI[(ZHI.indexOf(head) + 3) % 12];
    const gua = ZHI[(ZHI.indexOf(head) + 11) % 12];
    const pGu = palaceOf(gu, '支'); if (pGu) push('孤辰', gu, pGu);
    const pGua = palaceOf(gua, '支'); if (pGua) push('寡宿', gua, pGua);
  }
  // 亡神劫煞（年支，五行三合）
  const wjKey = sanKey(yearZhi);
  if (wjKey) Object.keys(WANG_JIE).forEach((n) => {
    const target = WANG_JIE[n][wjKey];
    const p = palaceOf(target, '支');
    if (p) push(n, target, p);
  });

  return out;
}

/** 大运支神煞：每步大运地支相对命局（年支/日支起驿马桃花华盖将星、日干起贵人文昌羊刃禄金舆、年支起红鸾天喜亡神劫煞孤辰寡宿、日柱起空亡）所落神煞 */
export function daYunShensha(r) {
  const dayZhi = r.pillars.day.zhi;
  const yearZhi = r.pillars.year.zhi;
  const dayGan = r.dayGan;
  const sanKey = (z) => (SAN_HE.find((h) => h.zhi.includes(z)) || {}).zhi?.join('') || '';
  const yuanKey = sanKey(yearZhi);
  const riKey = sanKey(dayZhi);
  const { xunKong } = xun(dayGan + dayZhi);
  const head = Object.keys(GU_GROUP).find((h) => GU_GROUP[h].includes(yearZhi));
  const hong = HONG_LUAN[yearZhi];

  return (r.daYun || []).map((d) => {
    const z = d.ganzhi[1];
    const hits = [];
    const add = (name, extra) => {
      const ex = hits.find((h) => h.name === name);
      if (ex) { if (extra && !ex.extra.includes(extra)) ex.extra += '、' + extra; return; }
      hits.push({ name, desc: STAR_DESC[name] || '', extra: extra || '' });
    };
    if (yuanKey) Object.entries(STAR_FOUR).forEach(([n, t]) => { if (t[yuanKey] === z) add(n, '年支起'); });
    if (riKey) Object.entries(STAR_FOUR).forEach(([n, t]) => { if (t[riKey] === z) add(n, '日支起'); });
    [['天乙贵人', TIAN_YI], ['文昌', WEN_CHANG], ['羊刃', YANG_REN], ['禄神', GAN_LU], ['金舆', JIN_YU]].forEach(([name, table]) => {
      const t = table[dayGan];
      if (!t) return;
      if (Array.isArray(t)) { if (t.includes(z)) add(name, '日干起'); }
      else if (t === z) add(name, '日干起');
    });
    if (hong === z) add('红鸾', '年支起');
    if (zhiAdd(hong, 6) === z) add('天喜', '年支起');
    if (xunKong.includes(z)) add('空亡', '日柱起');
    if (head) {
      if (ZHI[(ZHI.indexOf(head) + 3) % 12] === z) add('孤辰', '年支起');
      if (ZHI[(ZHI.indexOf(head) + 11) % 12] === z) add('寡宿', '年支起');
    }
    if (yuanKey) Object.entries(WANG_JIE).forEach(([n, t]) => { if (t[yuanKey] === z) add(n, '年支起'); });
    return { ganzhi: d.ganzhi, zhi: z, years: `${d.startYear}~${d.endYear}`, shensha: hits };
  });
}

/** 命局关系：天干五合 + 地支六合六冲相刑六害 + 自刑 */
function ganZhiRelation({ pillars, dayGan }) {
  const P = { 年: pillars.year, 月: pillars.month, 日: { gan: dayGan, zhi: pillars.day.zhi }, 时: pillars.time };
  const keys = ['年', '月', '日', '时'];
  const ganHe = [];
  const zhiRel = [];
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const a = keys[i], b = keys[j];
      const ga = P[a].gan, gb = P[b].gan;
      const za = P[a].zhi, zb = P[b].zhi;
      if (GAN_HE[ga] === gb) ganHe.push({ a: `${a}${ga}`, b: `${b}${gb}`, rel: '五合', result: `合化${GAN_HE_WX[ga + gb] || GAN_HE_WX[gb + ga] || '（合而不化）'}` });
      if (LIU_HE[za] === zb) zhiRel.push({ a: `${a}${za}`, b: `${b}${zb}`, rel: '六合' });
      if (zhiAdd(za, 6) === zb) zhiRel.push({ a: `${a}${za}`, b: `${b}${zb}`, rel: '六冲' });
      if (XING[za] === zb && za !== zb) zhiRel.push({ a: `${a}${za}`, b: `${b}${zb}`, rel: '相刑' });
      if (LIU_HAI[za] === zb) zhiRel.push({ a: `${a}${za}`, b: `${b}${zb}`, rel: '六害' });
    }
  }
  const count = {};
  Object.values(P).forEach((p) => { count[p.zhi] = (count[p.zhi] || 0) + 1; });
  const selfXing = Object.entries(count).filter(([z, n]) => n >= 2 && isSelfXing(z)).map(([z, n]) => ({ z, n }));
  return { ganHe, zhiRel, selfXing };
}

/** 天干五合化 */
const GAN_HE_WX = { 甲己: '土', 乙庚: '金', 丙辛: '水', 丁壬: '木', 戊癸: '火' };

/**
 * 透干通根（《滴天髓》透干通根论）：四柱天干，在地支中是否同气有根。
 * 本气根 = 地支五行同日干五行（力最强）；中气/余气根 = 地支藏干含该字。
 * 同支同气合并计次（n=根数）。返回 [{ palace, gan, wx, roots:[{zhi,qi,n}], floating }]
 */
export function touGanTongGen(r) {
  const P = { 年: r.pillars.year, 月: r.pillars.month, 日: r.pillars.day, 时: r.pillars.time };
  const KEYS = ['年', '月', '日', '时'];
  return KEYS.map((k) => {
    const g = P[k].gan;
    const wx = GAN_WUXING[g];
    const map = new Map();
    const push = (zhi, qi) => { const key = zhi + qi; const v = map.get(key) || { zhi, qi, n: 0 }; v.n++; map.set(key, v); };
    KEYS.forEach((k2) => {
      const p2 = P[k2];
      (p2.hideGan || []).forEach((hg, idx) => {
        if (hg === g) push(p2.zhi, idx === 0 ? '本气' : idx === 1 ? '中气' : '余气');
      });
    });
    return { palace: k, gan: g, wx, roots: [...map.values()], floating: map.size === 0 };
  });
}

/** 四柱宫位十神（子平宫位论：年祖辈少年 · 月父母青年 · 日自身中年 · 时子女晚年） */
export function gongWeiShiShen(r) {
  const GONG = { 年: '祖辈 · 少年', 月: '父母 · 青年', 日: '自身 · 中年', 时: '子女 · 晚年' };
  const P = { 年: r.pillars.year, 月: r.pillars.month, 日: r.pillars.day, 时: r.pillars.time };
  return ['年', '月', '日', '时'].map((k) => {
    const p = P[k];
    const zhiMain = ZHI_MAN[p.zhi];
    return {
      palace: k, gong: GONG[k],
      gan: p.gan, ganSS: k === '日' ? '日主' : shiShenOf(p.gan, r.dayGan),
      zhi: p.zhi, zhiMain, zhiMainSS: shiShenOf(zhiMain, r.dayGan),
    };
  });
}

/** 十神六亲对应（子平通行口径；六亲归属古籍颇有出入，凡有争议处均注明） */
export const LIUQIN = {
  正印: { kin: '母亲', note: '生我同阴阳为正印，母之象。' },
  偏印: { kin: '继母 · 祖父', note: '生我异阴阳为偏印（枭神），或主祖父、师长长辈。' },
  正财: { kin: '正妻', note: '男命我克正财为妻、正室；亦主正途之财。' },
  偏财: { kin: '父亲', note: '通行口径偏财为父（另一说正财为父）；亦主偏财外财、人缘。' },
  正官: { kin: '女命之夫', note: '克我正官为女命夫星；男命亦主女儿、官职。' },
  七杀: { kin: '男命之子', note: '克我七杀为男命子星（一说子女）；女命主偏夫、严苛之缘。' },
  食神: { kin: '男命之子', note: '我生食神，男命子星、福禄之源。' },
  伤官: { kin: '女命之女', note: '我生伤官，女命女星；亦主才华泄秀、傲性。' },
  比肩: { kin: '同辈 · 兄弟', note: '同我同性，为兄弟、同侪之象。' },
  劫财: { kin: '同辈 · 姊妹', note: '同我异性，为姊妹、同事之象；亦主争夺分利。' },
};
/** 逐柱天干十神 → 六亲对应 */
export function liuQinOf(r) {
  const P = { 年: r.pillars.year, 月: r.pillars.month, 日: r.pillars.day, 时: r.pillars.time };
  return ['年', '月', '日', '时'].map((k) => {
    const p = P[k];
    const ss = k === '日' ? '日主' : shiShenOf(p.gan, r.dayGan);
    const lq = LIUQIN[ss];
    return { palace: k, gan: p.gan, ss, kin: lq ? lq.kin : '', note: lq ? lq.note : '' };
  });
}


/** 十神流年主事断语（子平概观口径；吉凶仍以旺衰喜忌为准） */
export const SHISHEN_YEAR = {
  正财: '正财当令，务实求财之岁——利正途经营、守成进取，防因财失和。',
  偏财: '偏财浮游，外财机遇之岁——利投资开拓、人脉生财，防投机破耗。',
  正官: '正官掌权，名位职级之岁——利求职晋升、按部就班，防约束争议。',
  七杀: '七杀攻身，压力挑战之岁——利攻坚突破、担当要务，防小人官非。',
  正印: '正印护身，贵人学识之岁——利进修考证、得人提携，防懒散依赖。',
  偏印: '偏印孤智，玄学技艺之岁——利钻研独特、另辟蹊径，防思虑过重。',
  食神: '食神生财，才华享福之岁——利才艺创意、饮食娱乐，防口舌放纵。',
  伤官: '伤官泄秀，锐气表现之岁——利开拓变革、一展所长，防冲动争执。',
  比肩: '比肩帮身，合伙竞争之岁——利自立合作、并肩共事，防分财争利。',
  劫财: '劫财夺财，破耗竞争之岁——防破财借贷、义气损财，利运动强身。',
};

/** 天干长生位（阳生阴死主流口径：阳干顺行、阴干逆行） */
const GAN_ZHANGSHENG = { 甲: '亥', 乙: '午', 丙: '寅', 丁: '酉', 戊: '寅', 己: '酉', 庚: '巳', 辛: '子', 壬: '申', 癸: '卯' };

/** 日主十二长生：日主在四支的气数状态（长生沐浴冠带临官帝旺衰病死墓绝胎养） */
function changShengOf({ pillars, dayGan }) {
  const cells = ['year', 'month', 'day', 'time'].map((k) => ({ palace: k, zhi: pillars[k].zhi, state: changShengState(dayGan, pillars[k].zhi) }));
  return { dayGan, base: GAN_ZHANGSHENG[dayGan], cells };
}

/** 某支相对日主的十二长生状态（阳干顺行、阴干逆行） */
export function changShengState(dayGan, zhi) {
  const base = GAN_ZHANGSHENG[dayGan];
  const baseIdx = ZHI.indexOf(base);
  const isYang = GAN.indexOf(dayGan) % 2 === 0;
  const step = isYang ? (ZHI.indexOf(zhi) - baseIdx + 12) % 12 : (baseIdx - ZHI.indexOf(zhi) + 12) % 12;
  return CHANG_SHENG[step];
}

/** 十神分布摘要（以十神类别归并） */
function summarizeShiShen(pillars, dayGan) {
  const ss = ['正官', '七杀', '正印', '偏印', '正财', '偏财', '食神', '伤官', '比肩', '劫财'];
  const count = {};
  ss.forEach((s) => { count[s] = 0; });
  const addSS = (v) => { if (v && v !== '日主' && count[v] !== undefined) count[v]++; };
  addSS(pillars.year.shiShenGan); addSS(pillars.month.shiShenGan); addSS(pillars.time.shiShenGan);
  [pillars.year, pillars.month, pillars.day, pillars.time].forEach((p) => {
    (p.shiShenZhi || []).forEach((v) => addSS(v));
  });
  return Object.entries(count).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n }));
}

/** 地支 → 本气藏干（流年十神用） */
const ZHI_MAIN_GAN = { 子: '癸', 丑: '己', 寅: '甲', 卯: '乙', 辰: '戊', 巳: '丙', 午: '丁', 未: '己', 申: '庚', 酉: '辛', 戌: '戊', 亥: '壬' };
const ganYinYangOf = (g) => (GAN.indexOf(g) % 2 === 0 ? '阳' : '阴');

/** 流年/大运天干十神（相对日主） */
export function shiShenOf(gan, dayGan) {
  if (gan === dayGan) return '比肩';
  const rel = wuxingRelation(GAN_WUXING[dayGan], GAN_WUXING[gan]);
  const yinGan = ganYinYangOf(gan), yinDay = ganYinYangOf(dayGan);
  const map = {
    '生我': yinGan === yinDay ? '偏印' : '正印',
    '同我': yinGan === yinDay ? '比肩' : '劫财',
    '我生': yinGan === yinDay ? '食神' : '伤官',
    '我克': yinGan === yinDay ? '偏财' : '正财',
    '克我': yinGan === yinDay ? '七杀' : '正官',
  };
  return map[rel] || '';
}

/**
 * 流年分析：岁运并临 / 冲提纲 / 伏吟反吟 / 干支十神与喜忌方向提示
 * @param {object} r analyze() 的返回
 * @param {number} year 公历年份
 */
export function analyzeYear(r, year) {
  const dayGan = r.dayGan;
  const monthZhi = r.monthZhi;
  const monthGan = r.pillars.month.gan;
  const dayZhi = r.pillars.day.zhi;
  const d = r.daYun.find((x) => x.startYear <= year && year <= x.endYear) || null;
  let liunian = null;
  if (d) {
    const ln = (d.liuNian || []).find((n) => n.year === year);
    if (ln) liunian = ln.ganzhi;
  }
  if (!liunian) return { year, liunian: null, error: '该年不在当前大运表内' };

  const ygan = liunian[0], yzhi = liunian[1];
  const flags = [];

  if (d && liunian === d.ganzhi) flags.push('岁运并临');
  if (zhiAdd(yzhi, 6) === monthZhi) flags.push('冲提纲');
  if (GAN_HE[ygan] === monthGan) flags.push('合月干');
  if (yzhi === dayZhi) flags.push('伏吟日支');
  if (zhiAdd(yzhi, 6) === dayZhi) flags.push('反吟日支');

  const ss = shiShenOf(ygan, dayGan);
  const ssZhi = shiShenOf(ZHI_MAIN_GAN[yzhi], dayGan);
  const favGan = r.strength === '强' ? !['正印', '偏印', '比肩', '劫财'].includes(ss) : ['正印', '偏印', '比肩', '劫财'].includes(ss);
  const favZhi = r.strength === '强' ? !['正印', '偏印', '比肩', '劫财'].includes(ssZhi) : ['正印', '偏印', '比肩', '劫财'].includes(ssZhi);

  const tiao = (r.yongshen.tiaoHou || '').split('、').filter(Boolean);
  const hitsGan = tiao.includes(ygan);
  const hitsZhi = tiao.includes(ZHI_MAIN_GAN[yzhi]);

  const shenshaHits = (r.shensha || []).filter((s) => s.good && s.gz === yzhi).map((s) => ({ name: s.name, palace: s.palace, desc: s.desc }));
  const yzs = changShengState(dayGan, yzhi);

  return {
    year, liunian, daYun: d ? d.ganzhi : null, daYunYears: d ? `${d.startYear}~${d.endYear}` : null,
    ganSS: ss, zhiSS: ssZhi, yzs, ssYearText: SHISHEN_YEAR[ss] || '', flags, favGan, favZhi, hitsGan, hitsZhi, shenshaHits,
  };
}

/**
 * 流年动四柱：流年干支对命局四柱（年/月/日/时）的逐柱关系
 * 天干：五合（含化）→ 比和（同干）→ 克 → 生
 * 地支：伏吟（同支）→ 六冲 → 六合 → 六害 → 相刑
 * 返回 { year, liunian, items: [{ palace, gz, ganSS, ganRel, zhiRel }] }
 */
export function liunianPillars(r, year) {
  const y = analyzeYear(r, year);
  if (!y.liunian) return { year, liunian: null, error: y.error };
  const ygan = y.liunian[0], yzhi = y.liunian[1];
  const dayGan = r.dayGan;
  const PAL = [
    { palace: '年柱', gz: r.pillars.year.gan + r.pillars.year.zhi },
    { palace: '月柱', gz: r.pillars.month.gan + r.pillars.month.zhi },
    { palace: '日柱', gz: r.pillars.day.gan + r.pillars.day.zhi },
    { palace: '时柱', gz: r.pillars.time.gan + r.pillars.time.zhi },
  ];
  const items = PAL.map((p) => {
    const pgan = p.gz[0], pzhi = p.gz[1];
    let ganRel = null;
    if (GAN_HE[ygan] === pgan) {
      const hua = GAN_HE_WX[ygan + pgan] || GAN_HE_WX[pgan + ygan];
      ganRel = { rel: '五合', text: `${ygan}${pgan}相合${hua ? '，合化' + hua : ''}` };
    } else if (ygan === pgan) {
      ganRel = { rel: '比和', text: `${ygan}${pgan}同干，伏吟于${p.palace}` };
    } else {
      const yWx = GAN_WUXING[ygan], pWx = GAN_WUXING[pgan];
      if (KE[yWx] === pWx) ganRel = { rel: '流年克柱', text: `${ygan}（${yWx}）克${pgan}（${pWx}）` };
      else if (KE[pWx] === yWx) ganRel = { rel: '柱克流年', text: `${pgan}（${pWx}）克${ygan}（${yWx}）` };
      else if (SHENG[yWx] === pWx) ganRel = { rel: '流年生柱', text: `${ygan}（${yWx}）生${pgan}（${pWx}）` };
      else if (SHENG[pWx] === yWx) ganRel = { rel: '柱生流年', text: `${pgan}（${pWx}）生${ygan}（${yWx}）` };
    }
    let zhiRel = null;
    if (yzhi === pzhi) zhiRel = { rel: '伏吟', text: `${yzhi}${pzhi}同支，伏吟于${p.palace}` };
    else if (zhiAdd(yzhi, 6) === pzhi) zhiRel = { rel: '六冲', text: `${yzhi}冲${pzhi}` };
    else if (LIU_HE[yzhi] === pzhi) zhiRel = { rel: '六合', text: `${yzhi}${pzhi}六合` };
    else if (LIU_HAI[yzhi] === pzhi) zhiRel = { rel: '六害', text: `${yzhi}害${pzhi}` };
    else if (XING[yzhi] === pzhi) zhiRel = { rel: '相刑', text: `${yzhi}刑${pzhi}` };
    return { palace: p.palace, gz: p.gz, ganSS: shiShenOf(ygan, dayGan), ganRel, zhiRel };
  });
  return { year, liunian: y.liunian, items };
}

/**
 * 岁运互动：流年干支 与 大运干支 的 生克合冲刑害（子平岁运同论的一层）
 * 天干：五合（合化五行）→ 相克（流年克运/运克流年）→ 相生 → 比和
 * 地支：六冲（岁运相冲，重象）→ 六合 → 六害 → 相刑 → 三合局同气
 * 返回 { year, gan, zhi, level: 吉/谨/平/凶, text, tags }（gan/zhi 各自 {rel,text} 或 null）
 */
export function suiyunInteraction(r, year) {
  const y = analyzeYear(r, year);
  if (!y.liunian || !y.daYun) return { year, gan: null, zhi: null, level: '平', text: '', tags: [] };
  const ygan = y.liunian[0], yzhi = y.liunian[1];
  const dgan = y.daYun[0], dzhi = y.daYun[1];
  const parts = [];
  let score = 0;

  // ── 天干互动 ──
  let gan = null;
  if (GAN_HE[ygan] === dgan) {
    const hua = GAN_HE_WX[ygan + dgan] || GAN_HE_WX[dgan + ygan] || '';
    gan = { rel: '五合', text: `${ygan}${dgan}相合${hua ? '，合化' + hua : ''}` };
    parts.push(gan); score += 1;
  } else {
    const yWx = GAN_WUXING[ygan], dWx = GAN_WUXING[dgan];
    if (KE[yWx] === dWx) { gan = { rel: '流年克运', text: `${ygan}（${yWx}）克${dgan}（${dWx}）` }; parts.push(gan); score -= 1; }
    else if (KE[dWx] === yWx) { gan = { rel: '运克流年', text: `${ygan}（${yWx}）受${dgan}（${dWx}）克` }; parts.push(gan); score -= 1; }
    else if (SHENG[yWx] === dWx) { gan = { rel: '流年生运', text: `${ygan}（${yWx}）生${dgan}（${dWx}）` }; parts.push(gan); }
    else if (SHENG[dWx] === yWx) { gan = { rel: '运生流年', text: `${dgan}（${dWx}）生${ygan}（${yWx}）` }; parts.push(gan); }
    else if (yWx === dWx) { gan = { rel: '比和', text: `${ygan}${dgan}同气（${yWx}）` }; parts.push(gan); }
  }

  // ── 地支互动 ──
  let zhi = null;
  if (zhiAdd(yzhi, 6) === dzhi) { zhi = { rel: '相冲', text: `${yzhi}${dzhi}相冲（岁运相冲）` }; parts.push(zhi); score -= 2; }
  else if (LIU_HE[yzhi] === dzhi) { zhi = { rel: '六合', text: `${yzhi}${dzhi}六合` }; parts.push(zhi); score += 1; }
  else if (LIU_HAI[yzhi] === dzhi) { zhi = { rel: '六害', text: `${yzhi}${dzhi}相害` }; parts.push(zhi); score -= 2; }
  else if (XING[yzhi] === dzhi || XING[dzhi] === yzhi) { zhi = { rel: '相刑', text: `${yzhi}${dzhi}相刑` }; parts.push(zhi); score -= 1; }
  else {
    const sy = sanHeOf(yzhi), sd = sanHeOf(dzhi);
    if (sy && sd && sy === sd) { zhi = { rel: '三合', text: `${yzhi}${dzhi}同为${sy.wuxing}局（${sy.zhi.join('')}）` }; parts.push(zhi); score += 1; }
  }

  if (!parts.length) return { year, gan, zhi, level: '平', text: `流年 ${y.liunian} 与大运 ${y.daYun} 干支无显著冲合，平稳过渡之象。`, tags: [] };

  const tags = parts.map((p) => `${p.text}（${p.rel}）`);
  let level, text;
  if (score <= -2) { level = '凶'; text = `流年与大运「${tags.join('、')}」——变动牵扯之象较明显，宜稳住节奏、谋定后动，不妄作大破大立。`; }
  else if (score === -1) { level = '谨'; text = `流年与大运「${tags.join('、')}」——压力与牵制并存，遇事多三分周旋，防外缘搅扰心志。`; }
  else if (score >= 1) { level = '吉'; text = `流年与大运「${tags.join('、')}」——气机相顺，人缘助力可期，顺势而为自见转机。`; }
  else { level = '平'; text = `流年与大运「${tags.join('、')}」——吉凶参半之象，成事在谋，不必过喜过忧。`; }
  return { year, gan, zhi, level, text, tags };
}

/**
 * 未来 N 年吉凶走势评分（0~100，确定性算法便于图表/验证）：
 *  基础 50 ＋ 喜忌方向(±25/10/15) ＋ 关键flags惩罚(岁运并临-30/伏吟-20/反吟冲提纲-15/合月干-10)
 *  ＋ 吉神煞引动(每个+10, 上限+30) ＋ 调候命中(各+8)
 * @returns {Array<{year, gz, score, tag, flags, shensha, daYun}>}
 */
export function yearTrend(r, startYear, n = 12) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const y = analyzeYear(r, startYear + i);
    if (y.error || !y.liunian) continue;
    let score = 50;
    if (y.favGan && y.favZhi) score += 25;
    else if (y.favGan || y.favZhi) score += 10;
    else score -= 15;
    for (const f of y.flags) {
      if (f === '岁运并临') score -= 30;
      else if (f === '伏吟日支') score -= 20;
      else if (f === '反吟日支' || f === '冲提纲') score -= 15;
      else score -= 10; // 合月干
    }
    score += Math.min(30, y.shenshaHits.length * 10);
    if (y.hitsGan) score += 8;
    if (y.hitsZhi) score += 8;
    score = Math.max(5, Math.min(100, Math.round(score)));
    pts.push({
      year: y.year, gz: y.liunian, score,
      tag: score >= 65 ? '宜进取' : score >= 45 ? '平顺' : '宜审慎',
      flags: y.flags, shensha: y.shenshaHits.map((s) => s.name), daYun: y.daYun,
    });
  }
  return pts;
}

/** 十二节气月（依《协纪辨方书》以节为月界：立春=寅月…小寒=丑月），range 为约略公历区间 */
const MONTH_JIE_CN = [
  { zhi: '寅', name: '寅月', range: '约2/4~3/5', jie: '立春' },
  { zhi: '卯', name: '卯月', range: '约3/6~4/4', jie: '惊蛰' },
  { zhi: '辰', name: '辰月', range: '约4/5~5/5', jie: '清明' },
  { zhi: '巳', name: '巳月', range: '约5/6~6/5', jie: '立夏' },
  { zhi: '午', name: '午月', range: '约6/6~7/6', jie: '芒种' },
  { zhi: '未', name: '未月', range: '约7/7~8/7', jie: '小暑' },
  { zhi: '申', name: '申月', range: '约8/8~9/7', jie: '立秋' },
  { zhi: '酉', name: '酉月', range: '约9/8~10/7', jie: '白露' },
  { zhi: '戌', name: '戌月', range: '约10/8~11/6', jie: '寒露' },
  { zhi: '亥', name: '亥月', range: '约11/7~12/6', jie: '立冬' },
  { zhi: '子', name: '子月', range: '约12/7~1/5', jie: '大雪' },
  { zhi: '丑', name: '丑月', range: '约1/6~2/3', jie: '小寒' },
];

/** 某公历日期所属节气月支（近似，按标准节气日划分） */
export function curMonthZhi(dt) {
  const key = (dt.getMonth() + 1) * 100 + dt.getDate();
  if (key < 204) return '丑'; // 小寒1/6~立春2/4 前
  const cuts = [[2, 4, '寅'], [3, 5, '卯'], [4, 5, '辰'], [5, 5, '巳'], [6, 6, '午'], [7, 7, '未'], [8, 8, '申'], [9, 8, '酉'], [10, 8, '戌'], [11, 7, '亥'], [12, 7, '子']];
  let res = '寅';
  for (const [cm, cd, z] of cuts) { if (key >= cm * 100 + cd) res = z; else break; }
  return res;
}

/**
 * 流年逐月要点（12 节气月）：
 * 月干按五虎遁（甲己之年丙作首…），月支固定寅→丑；逐月评 干支十神喜忌 + 与日支/流年支/大运支的冲合刑害。
 * @returns {object} { year, liunian, daYun, months: [{zhi, ganzhi, jie, range, ganSS, zhiSS, favGan, favZhi, flags, score, tag}] }
 */
export function monthTrend(r, year) {
  const y = analyzeYear(r, year);
  if (y.error || !y.liunian) return { year, error: y.error || '该年无流年' };
  const ygan = y.liunian[0], yzhi = y.liunian[1];
  const dayGan = r.dayGan, dayZhi = r.pillars.day.zhi;
  const yinGan = (GAN.indexOf(ygan) * 2 + 2) % 10; // 寅月天干（五虎遁）
  const d = r.daYun.find((x) => x.startYear <= year && year <= x.endYear) || null;
  const dyZhi = d ? d.ganzhi[1] : null;
  const sanHeOf = (z) => SAN_HE.find((s) => s.zhi.includes(z));
  const xingOf = (a, b) => XING[a] === b || XING[b] === a;

  const months = MONTH_JIE_CN.map((m, idx) => {
    const mg = GAN[(yinGan + idx) % 10];
    const mz = m.zhi;
    const ganSS = shiShenOf(mg, dayGan);
    const zhiSS = shiShenOf(ZHI_MAIN_GAN[mz], dayGan);
    const favGan = r.strength === '强' ? !['正印', '偏印', '比肩', '劫财'].includes(ganSS) : ['正印', '偏印', '比肩', '劫财'].includes(ganSS);
    const favZhi = r.strength === '强' ? !['正印', '偏印', '比肩', '劫财'].includes(zhiSS) : ['正印', '偏印', '比肩', '劫财'].includes(zhiSS);

    const flags = [];
    if (LIU_HE[mz] === dayZhi) flags.push(`合日支${dayZhi}`);
    if (zhiAdd(mz, 6) === dayZhi) flags.push('冲日支');
    if (LIU_HAI[mz] === dayZhi) flags.push(`害日支${dayZhi}`);
    if (xingOf(mz, dayZhi)) flags.push('刑日支');
    if (mz === dayZhi && isSelfXing(mz)) flags.push('伏吟日支');

    if (LIU_HE[mz] === yzhi) flags.push(`合流年支${yzhi}`);
    if (zhiAdd(mz, 6) === yzhi) flags.push('冲流年支');
    if (LIU_HAI[mz] === yzhi) flags.push(`害流年支${yzhi}`);
    if (xingOf(mz, yzhi)) flags.push('刑流年支');
    const sh = sanHeOf(mz), sy = sanHeOf(yzhi);
    if (sh && sy && sh.wuxing === sy.wuxing) flags.push(`${sh.wuxing}局`);
    if (GAN_HE[mg] === ygan) flags.push('月干合流年干');

    if (dyZhi) {
      if (zhiAdd(mz, 6) === dyZhi) flags.push('冲大运支');
      if (LIU_HE[mz] === dyZhi) flags.push(`合大运支${dyZhi}`);
    }

    let score = 60;
    if (favGan && favZhi) score += 15;
    else if (favGan || favZhi) score += 5;
    else score -= 10;
    if (flags.includes('冲日支') || flags.includes('伏吟日支')) score -= 15;
    if (flags.includes('冲流年支')) score -= 12;
    if (flags.includes('冲大运支')) score -= 10;
    if (flags.includes('合日支') || flags.includes('合流年支') || flags.includes('合大运支') || flags.includes('月干合流年干')) score += 8;
    score = Math.max(10, Math.min(95, Math.round(score)));

    return {
      idx, zhi: mz, ganzhi: mg + mz, jie: m.jie, range: m.range,
      ganSS, zhiSS, favGan, favZhi, flags,
      score,
      tag: score >= 70 ? '宜进取' : score >= 50 ? '平顺' : '宜审慎',
    };
  });

  return { year, liunian: y.liunian, daYun: y.daYun, strength: r.strength, months };
}

/**
 * 流年十神主事月历（12 节气月）：
 * 复用 monthTrend 的月干支，对每月天干相对日主取十神，
 * 结合 SHISHEN_YEAR 给出断语，按旺衰标注喜忌色。
 * @param {object} r  analyze() 的返回值
 * @param {number} year 公历年份
 * @returns {{ year, liunian, months: Array<{monthName, gz, ganSS, text, fav}> } | { year, error } }
 *   fav: 'xi'=喜用（绿）/ 'ji'=忌神（红）/ 'mid'=中和
 */
export function monthShiShen(r, year) {
  const mt = monthTrend(r, year);
  if (mt.error) return { year, error: mt.error };

  // 喜用十神集合（身强：财官食伤；身弱：印比）
  const XI_SET = ['正财', '偏财', '正官', '七杀', '食神', '伤官'];
  const favOf = (ss) => {
    if (r.strength === '中') return 'mid';
    const isXi = XI_SET.includes(ss);
    return r.strength === '强' ? (isXi ? 'xi' : 'ji') : (isXi ? 'ji' : 'xi');
  };

  const months = mt.months.map((m) => ({
    monthName: m.zhi + '月',   // '寅月'…'丑月'（由 monthTrend 返回的 zhi 拼接）
    gz: m.ganzhi,        // 如 '庚寅'
    ganSS: m.ganSS,      // 如 '正印'
    text: SHISHEN_YEAR[m.ganSS] || `${m.ganSS}当令。`,
    fav: favOf(m.ganSS),
  }));

  return { year, liunian: mt.liunian, months };
}

/** 五行类象映射表（古籍类象） */
const WX_XIANG = {
  木: { colors: ['青绿'], dir: '东方', careers: ['教育文化', '木艺家装', '园艺医药'], desc: '木主生发仁德，利学习成长、文书文化之业' },
  火: { colors: ['红紫'], dir: '南方', careers: ['能源电子', '餐饮娱乐', '美容传媒'], desc: '火主礼热忱，利开疆拓土、表达表现之业' },
  土: { colors: ['黄棕'], dir: '中央/本土', careers: ['地产建筑', '仓储农业', '咨询中介'], desc: '土主信稳重，利置业守成、落地实干之业' },
  金: { colors: ['白金'], dir: '西方', careers: ['金融金属', '机械军警', '司法五金'], desc: '金主义决断，利财经交易、纪律规范之业' },
  水: { colors: ['黑蓝'], dir: '北方', careers: ['物流贸易', '旅游流动', '水务渔业'], desc: '水主智流通，利人际流通、远方发展之业' },
};

/**
 * 喜用神趋吉指南
 * @param {object} r  analyze() 的返回对象
 * @returns {object|null}
 */
export function xiyongGuide(r) {
  if (!r || !r.strength || !r.wuxingCount) return null;
  const { strength, wuxingCount } = r;

  let direction, favWx, avoidWx;
  if (strength === '强') {
    direction = '取克泄耗（食伤·财·官杀）';
    favWx = ['木', '火', '土'];
    avoidWx = ['金', '水'];
  } else if (strength === '弱') {
    direction = '取生扶（印·比劫）';
    favWx = ['金', '水'];
    avoidWx = ['木', '火', '土'];
  } else {
    const missing = Object.entries(wuxingCount).filter(([, v]) => v === 0).map(([k]) => k);
    if (missing.length) {
      favWx = missing;
      direction = '五行补益缺失——以大运流年引动所缺五行为要';
    } else {
      favWx = ['木', '火', '土', '金', '水'];
      direction = '喜忌参半，五行均衡为要';
    }
    avoidWx = [];
  }

  const missing = Object.entries(wuxingCount).filter(([, v]) => v === 0).map(([k]) => k);

  return {
    direction,
    favWx,
    avoidWx,
    colors: favWx.map((wx) => ({ wx, color: WX_XIANG[wx].colors })),
    dirs: favWx.map((wx) => ({ wx, dir: WX_XIANG[wx].dir })),
    careers: favWx.map((wx) => ({ wx, career: WX_XIANG[wx].careers })),
    avoid: avoidWx.map((wx) => ({ wx, color: WX_XIANG[wx].colors, dir: WX_XIANG[wx].dir })),
    missing,
    tips: '趋吉指南依身强/身弱取用神五行推演，属五行调性参考——助你顺势选择颜色方位与行业方向，非成功保证；具体吉凶仍以旺衰用神与大运流年为准。',
  };
}

export default { analyze, analyzeYear, yearTrend, monthTrend, monthShiShen, curMonthZhi, suiyunInteraction, setKnowledge, liuQinOf };
