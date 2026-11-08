/**
 * engine/ziwei.js —— 紫微斗数排盘模块
 * =========================================================
 * 自研实现，安星算法参考 iztro（MIT）并保持一致口径；农历数据来自 lunar-javascript。
 * 完全本地计算，不依赖网络。
 *
 * 输入：公历出生时间 + 性别
 * 输出：命宫身宫、五行局、十二宫（含各宫干支与星曜）、生年四化、大限、庙旺亮度。
 *
 * 口径说明（与主流排盘一致）：
 *  - 年干支以农历年（春节）为界；
 *  - 五行局由命宫干支纳音定（取数法）；
 *  - 紫微星定位用「商顺余奇逆偶顺」算法；
 *  - 十二宫以命宫起逆排，宫干用五虎遁。
 */

import { Solar } from './lunar.esm.js';

// ───────────────────────── 常量 ─────────────────────────
const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const YIN = 2; // 寅在 ZHI 中的索引，紫微斗数以寅为第一宫

/** 五虎遁：生年天干 → 寅宫天干 */
const TIGER_RULE = { 甲: '丙', 乙: '戊', 丙: '庚', 丁: '壬', 戊: '甲', 己: '丙', 庚: '戊', 辛: '庚', 壬: '壬', 癸: '甲' };

/** 十二宫（从命宫起，地支顺时针方向依次为父母、福德……） */
const PALACES = ['命宫', '父母', '福德', '田宅', '官禄', '仆役', '迁移', '疾厄', '财帛', '子女', '夫妻', '兄弟'];

/** 五行局数：纳音五行 → 局数 */
const JU_BY_WUXING = { 木: 3, 金: 4, 水: 2, 火: 6, 土: 5 };

/** 生年四化：年干 → [化禄, 化权, 化科, 化忌] */
const SI_HUA = {
  甲: ['廉贞', '破军', '武曲', '太阳'], 乙: ['天机', '天梁', '紫微', '太阴'],
  丙: ['天同', '天机', '文昌', '廉贞'], 丁: ['太阴', '天同', '天机', '巨门'],
  戊: ['贪狼', '太阴', '右弼', '天机'], 己: ['武曲', '贪狼', '天梁', '文曲'],
  庚: ['太阳', '武曲', '太阴', '天同'], 辛: ['巨门', '太阳', '文曲', '文昌'],
  壬: ['天梁', '紫微', '左辅', '武曲'], 癸: ['破军', '巨门', '太阴', '贪狼'],
};

/** 紫微星系（自紫微宫逆时针，空位为无星） */
const ZIWEI_GROUP = ['紫微', '天机', '', '太阳', '武曲', '天同', '', '', '廉贞'];
/** 天府星系（自天府宫顺时针，空位为无星） */
const TIANFU_GROUP = ['天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '', '', '', '破军'];

/** 主星亮度表 key（iztro 命名） */
const STAR_KEY = {
  紫微: 'ziweiMaj', 天机: 'tianjiMaj', 太阳: 'taiyangMaj', 武曲: 'wuquMaj', 天同: 'tiantongMaj', 廉贞: 'lianzhenMaj',
  天府: 'tianfuMaj', 太阴: 'taiyinMaj', 贪狼: 'tanlangMaj', 巨门: 'jumenMaj', 天相: 'tianxiangMaj', 天梁: 'tianliangMaj',
  七杀: 'qishaMaj', 破军: 'pojunMaj',
  左辅: 'zuofuMin', 右弼: 'youbiMin', 文昌: 'wenchangMin', 文曲: 'wenquMin',
  天魁: 'tiankuiMin', 天钺: 'tianyueMin', 禄存: 'lucunMin', 擎羊: 'qingyangMin', 陀罗: 'tuoluoMin',
  火星: 'huoxingMin', 铃星: 'lingxingMin', 地空: 'dikongMin', 地劫: 'dijieMin', 天马: 'tianmaMin',
};

const mod = (n, m) => ((n % m) + m) % m;
/** 地支相对寅宫的索引（寅=0） */
const zhiFromYin = (z) => mod(ZHI.indexOf(z) - YIN, 12);

// ───────────────────────── 命宫身宫 ─────────────────────────
/**
 * 定命宫身宫：
 *  - 寅起正月顺数至生月，自生月逆数生时为命宫
 *  - 寅起正月顺数至生月，自生月顺数生时为身宫
 * monthIndex / timeIndex 均以寅为 0 的相对索引
 */
function getSoulAndBody(lunar) {
  const monthIndex = Math.abs(lunar.getMonth()) - 1; // 正月=0，闰月按当月
  const timeZhi = lunar.getTimeZhi();
  const timeIndex = ZHI.indexOf(timeZhi); // 地支绝对索引（子=0，酉=9），与 iztro 口径一致
  const soulIndex = mod(monthIndex - timeIndex, 12);
  const bodyIndex = mod(monthIndex + timeIndex, 12);
  return { soulIndex, bodyIndex, timeZhi, timeIndex };
}

// ───────────────────────── 五行局 ─────────────────────────
/** 纳音五行（取数法）：木1 金2 水3 火4 土5 */
function naYinWuxing(gan, zhi) {
  const ganNum = Math.floor(GAN.indexOf(gan) / 2) + 1; // 甲乙1 丙丁2 戊己3 庚辛4 壬癸5
  const zhiNum = Math.floor(mod(ZHI.indexOf(zhi), 6) / 2) + 1; // 子丑午未1 寅卯申酉2 辰巳戌亥3
  let sum = ganNum + zhiNum;
  while (sum > 5) sum -= 5;
  return ['木', '金', '水', '火', '土'][sum - 1];
}

// ───────────────────────── 紫微星定位 ─────────────────────────
/** iztro getStartIndex 算法：商顺余奇逆偶顺 */
function getZiweiTianfuIndex(day, ju, maxDays) {
  let offset = -1, quotient, remainder;
  let _day = day > maxDays ? day - maxDays : day;
  do {
    offset++;
    const divisor = _day + offset;
    quotient = Math.floor(divisor / ju);
    remainder = divisor % ju;
  } while (remainder !== 0);
  quotient %= 12;
  let ziweiIndex = quotient - 1;
  if (offset % 2 === 0) ziweiIndex += offset;
  else ziweiIndex -= offset;
  ziweiIndex = mod(ziweiIndex, 12);
  return { ziweiIndex, tianfuIndex: mod(12 - ziweiIndex, 12) };
}

// ───────────────────────── 辅星 ─────────────────────────
/** 禄存擎羊陀罗天马（年干定禄存，年支定天马） */
function getLuYangTuoMa(yearGan, yearZhi) {
  const LU = { 甲: '寅', 乙: '卯', 丙: '巳', 戊: '巳', 丁: '午', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };
  const luZhi = LU[yearGan];
  const luIndex = zhiFromYin(luZhi);
  const MA = { 寅: '申', 午: '申', 戌: '申', 申: '寅', 子: '寅', 辰: '寅', 巳: '亥', 酉: '亥', 丑: '亥', 亥: '巳', 卯: '巳', 未: '巳' };
  return {
    luIndex,
    yangIndex: mod(luIndex + 1, 12),
    tuoIndex: mod(luIndex - 1, 12),
    maIndex: zhiFromYin(MA[yearZhi]),
  };
}

/** 天魁天钺（年干） */
function getKuiYue(yearGan) {
  const TABLE = { 甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'], 乙: ['子', '申'], 己: ['子', '申'], 辛: ['午', '寅'], 丙: ['亥', '酉'], 丁: ['亥', '酉'], 壬: ['卯', '巳'], 癸: ['卯', '巳'] };
  const [kui, yue] = TABLE[yearGan];
  return { kuiIndex: zhiFromYin(kui), yueIndex: zhiFromYin(yue) };
}

/** 左辅右弼（生月）：辰上顺左辅，戌上逆右弼 */
function getZuoYou(monthIndex) {
  return {
    zuoIndex: mod(zhiFromYin('辰') + monthIndex, 12),
    youIndex: mod(zhiFromYin('戌') - monthIndex, 12),
  };
}

/** 文昌文曲（生时）：戌逆文昌，辰顺文曲 */
function getChangQu(timeIndex) {
  return {
    changIndex: mod(zhiFromYin('戌') - timeIndex, 12),
    quIndex: mod(zhiFromYin('辰') + timeIndex, 12),
  };
}

/** 火星铃星（年支+时支） */
function getHuoLing(yearZhi, timeIndex) {
  let huoBase, lingBase;
  switch (yearZhi) {
    case '寅': case '午': case '戌': huoBase = zhiFromYin('丑'); lingBase = zhiFromYin('卯'); break;
    case '申': case '子': case '辰': huoBase = zhiFromYin('寅'); lingBase = zhiFromYin('戌'); break;
    case '巳': case '酉': case '丑': huoBase = zhiFromYin('卯'); lingBase = zhiFromYin('戌'); break;
    default: huoBase = zhiFromYin('酉'); lingBase = zhiFromYin('戌'); break;
  }
  return { huoIndex: mod(huoBase + timeIndex, 12), lingIndex: mod(lingBase + timeIndex, 12) };
}

/** 地空地劫（生时）：亥逆地空，亥顺地劫 */
function getKongJie(timeIndex) {
  const hai = zhiFromYin('亥');
  return { kongIndex: mod(hai - timeIndex, 12), jieIndex: mod(hai + timeIndex, 12) };
}

// ───────────────────────── 主排盘 ─────────────────────────
/**
 * @param {object} opt
 * @param {Date} opt.date 公历出生时间
 * @param {'男'|'女'} opt.gender 性别
 * @param {object} [opt.brightness] 庙旺亮度表（ziwei-brightness.json 内容），缺省则不算亮度
 */
export function paipan(opt) {
  const { date, gender = '男', brightness } = opt;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new Error('ziwei: 无效的出生时间');

  const solar = Solar.fromDate(date);
  const lunar = solar.getLunar();
  const yearGan = lunar.getYearGan();
  const yearZhi = lunar.getYearZhi();
  const lunarMonth = lunar.getMonth();
  const lunarDay = lunar.getDay();

  const { soulIndex, bodyIndex, timeZhi, timeIndex } = getSoulAndBody(lunar);

  // 命宫天干（五虎遁）+ 地支
  const soulGan = GAN[mod(GAN.indexOf(TIGER_RULE[yearGan]) + soulIndex, 10)];
  const soulZhi = ZHI[mod(soulIndex + YIN, 12)];
  const bodyZhi = ZHI[mod(bodyIndex + YIN, 12)];

  // 五行局
  const wuxing = naYinWuxing(soulGan, soulZhi);
  const ju = JU_BY_WUXING[wuxing];

  // 紫微 / 天府
  const maxDays = lunarDay; // 简化：生日即当月天数上限（不跨月）
  const { ziweiIndex, tianfuIndex } = getZiweiTianfuIndex(lunarDay, ju, maxDays);

  // 主星（index = 地支相对寅，0~11）
  const major = new Array(12).fill(null).map(() => []);
  ZIWEI_GROUP.forEach((s, i) => { if (s) major[mod(ziweiIndex - i, 12)].push(s); });
  TIANFU_GROUP.forEach((s, i) => { if (s) major[mod(tianfuIndex + i, 12)].push(s); });

  // 辅星
  const minor = new Array(12).fill(null).map(() => []);
  const { luIndex, yangIndex, tuoIndex, maIndex } = getLuYangTuoMa(yearGan, yearZhi);
  const { kuiIndex, yueIndex } = getKuiYue(yearGan);
  const { zuoIndex, youIndex } = getZuoYou(Math.abs(lunarMonth) - 1);
  const { changIndex, quIndex } = getChangQu(timeIndex);
  const { huoIndex, lingIndex } = getHuoLing(yearZhi, timeIndex);
  const { kongIndex, jieIndex } = getKongJie(timeIndex);
  const place = (idx, name) => { if (idx >= 0) minor[mod(idx, 12)].push(name); };
  place(luIndex, '禄存'); place(yangIndex, '擎羊'); place(tuoIndex, '陀罗'); place(maIndex, '天马');
  place(kuiIndex, '天魁'); place(yueIndex, '天钺');
  place(zuoIndex, '左辅'); place(youIndex, '右弼');
  place(changIndex, '文昌'); place(quIndex, '文曲');
  place(huoIndex, '火星'); place(lingIndex, '铃星');
  place(kongIndex, '地空'); place(jieIndex, '地劫');

  // 生年四化
  const sihua = SI_HUA[yearGan];
  const mutagen = {};
  ['禄', '权', '科', '忌'].forEach((k, i) => { mutagen[sihua[i]] = k; });

  // 十二宫（地支从寅起顺排，宫名以命宫为起点）
  const palaces = [];
  for (let i = 0; i < 12; i++) {
    const zhi = ZHI[mod(i + YIN, 12)];
    const palaceName = PALACES[mod(i - soulIndex, 12)];
    const gan = GAN[mod(GAN.indexOf(TIGER_RULE[yearGan]) + i, 10)];
    const stars = [...major[i]];
    const minors = [...minor[i]];
    palaces.push({
      index: i, name: palaceName, gan, zhi,
      stars: stars.map((s) => ({
        name: s, type: 'major',
        mutagen: mutagen[s] || null,
        brightness: brightness && STAR_KEY[s] ? brightness[STAR_KEY[s]]?.[i] : null,
      })),
      minorStars: minors.map((s) => ({
        name: s, type: 'minor',
        brightness: brightness && STAR_KEY[s] ? brightness[STAR_KEY[s]]?.[i] : null,
      })),
      isSoul: i === soulIndex, isBody: i === bodyIndex,
    });
  }

  // 大限（阳男阴女顺行）
  const yinYang = mod(GAN.indexOf(yearGan), 2) === 0 ? '阳' : '阴'; // 年干阴阳
  const forward = gender === '男' ? yinYang === '阳' : yinYang === '阴';
  const startAge = ju; // 几局几岁起限
  const decadals = [];
  for (let i = 0; i < 12; i++) {
    const idx = forward ? mod(soulIndex + i, 12) : mod(soulIndex - i, 12);
    const zhi = ZHI[mod(idx + YIN, 12)];
    const gan = GAN[mod(GAN.indexOf(TIGER_RULE[yearGan]) + idx, 10)];
    decadals.push({ gan, zhi, start: startAge + 10 * i, end: startAge + 10 * i + 9, palaceIndex: idx });
  }

  return {
    lunar: { year: lunar.getYear(), month: Math.abs(lunarMonth), day: lunarDay, text: lunar.toString() },
    ganzhi: { year: `${yearGan}${yearZhi}`, month: lunar.getMonthInGanZhi ? '' : '', time: timeZhi },
    gender,
    birthYear: date.getFullYear(),
    soul: { index: soulIndex, gan: soulGan, zhi: soulZhi },
    body: { index: bodyIndex, zhi: bodyZhi },
    fiveElements: wuxing, ju,
    ziweiIndex, tianfuIndex,
    palaces,
    sihua: Object.entries(mutagen).map(([star, hua]) => ({ star, hua })),
    decadals,
    forward,
    startAge,
  };
}

/**
 * 流年分析：流年干支、流年四化落宫、小限宫位（男顺女逆，命宫起 1 虚岁）
 * @param {object} r paipan() 的返回
 * @param {number} year 公历年份
 */
export function analyzeYear(r, year) {
  const ln = Solar.fromDate(new Date(year, 1, 4)).getLunar(); // 立春（2/4）后已入节气年
  const ygan = ln.getYearGanByLiChun();
  const yzhi = ln.getYearZhiByLiChun();
  const xuSui = year - (r.birthYear || 2002) + 1;
  const dir = r.gender === '男' ? 1 : -1; // 小限：男顺女逆
  const palaceIndex = mod(r.soul.index + (xuSui - 1) * dir, 12);
  const p = r.palaces[palaceIndex];
  const si = SI_HUA[ygan] || SI_HUA['甲'];
  const sihua = ['禄', '权', '科', '忌'].map((k, i) => {
    const star = si[i];
    const home = r.palaces.find((pl) => pl.stars.some((s) => s.name === star) || pl.minorStars.some((s) => s.name === star));
    return { star, hua: k, palaceIndex: home ? home.index : -1, palaceName: home ? home.name : '—' };
  });
  return {
    year,
    ganzhi: `${ygan}${yzhi}`,
    xuSui,
    palaceIndex,
    palace: {
      name: p.name, gan: p.gan, zhi: p.zhi,
      stars: p.stars.map((s) => s.name),
      isSoul: p.isSoul, isBody: p.isBody,
    },
    sihua,
  };
}

/**
 * 大限四化：以该大限干支之干查 SI_HUA，逐宫找四化星落点。
 * @param {object} r paipan() 的返回
 * @param {number} index 大限序号（0-based，对应 r.decadals）
 * @returns {Array<{star, hua, palaceIndex, palaceName, self}>} self=化落本大限宫位自身
 */
export function daxianSihua(r, index) {
  const dx = r.decadals[index];
  if (!dx) return [];
  const si = SI_HUA[dx.gan] || SI_HUA['甲'];
  return ['禄', '权', '科', '忌'].map((k, i) => {
    const star = si[i];
    const home = r.palaces.find((p) => p.stars.some((s) => s.name === star) || p.minorStars.some((s) => s.name === star));
    return {
      star, hua: k,
      palaceIndex: home ? home.index : -1,
      palaceName: home ? home.name : '未落十二主星',
      self: !!(home && home.index === dx.palaceIndex),
    };
  });
}

const LIUNIAN_PALACES = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母'];

/**
 * 流年命宫四化（流年运限四化）：以流年命宫（流年支所在宫）之宫干起四化。
 * 与岁君四化（流年干支 SI_HUA）的区别：宫干按生年五虎遁固定于命盘，
 * 个别年份（宫干循环与流年干支循环错位时）两套四化不同——2034 甲寅（宫干壬 vs 甲）即为例。
 * @param {object} r paipan() 的返回
 * @param {number} year 公历年份
 * @returns {object|null} { gan, gz, soulIdx, sameAsYear, items:[{star,hua,palaceIndex,palaceName,self}] }
 */
export function liunianSihua(r, year) {
  const y = analyzeYear(r, year);
  if (!y || !y.ganzhi) return null;
  const yzhi = y.ganzhi[1];
  const soulIdx = mod(ZHI.indexOf(yzhi) - YIN, 12);
  const p = r.palaces[soulIdx];
  if (!p) return null;
  const gan = p.gan;
  const si = SI_HUA[gan] || SI_HUA['甲'];
  const items = ['禄', '权', '科', '忌'].map((k, i) => {
    const star = si[i];
    const home = r.palaces.find((pl) => pl.stars.some((s) => s.name === star) || pl.minorStars.some((s) => s.name === star));
    return {
      star, hua: k,
      palaceIndex: home ? home.index : -1,
      palaceName: home ? home.name : '未落十二主星',
      self: !!(home && home.index === soulIdx),
    };
  });
  return { gan, gz: `${gan}${p.zhi}`, soulIdx, sameAsYear: gan === y.ganzhi[0], items };
}

/**
 * 流年十二宫：以流年支为流年命宫地支，顺排十二宫（紫微标准序），各宫主星取原命盘对应地支宫位之星。
 * @returns {object} { year, ganzhi, xuSui, liunian, soulIdx, cells: [{name, origName, gan, zhi, stars, minorStars, oppName, oppStars, isSoul, hasJi}] }
 */
export function liunianPan(r, year) {
  const y = analyzeYear(r, year);
  const yzhi = y.ganzhi[1];
  const soulIdx = mod(ZHI.indexOf(yzhi) - YIN, 12);
  const jiIdx = y.sihua.find((h) => h.hua === '忌')?.palaceIndex ?? -1;
  const cells = [];
  for (let i = 0; i < 12; i++) {
    const oi = mod(soulIdx + i, 12);
    const op = r.palaces[oi];
    const opp = r.palaces[mod(oi + 6, 12)];
    cells.push({
      name: LIUNIAN_PALACES[i],
      origName: op.name,
      gan: op.gan, zhi: op.zhi,
      stars: op.stars.map((s) => ({ name: s.name, brightness: s.brightness, mutagen: s.mutagen })),
      minorStars: op.minorStars.map((s) => s.name),
      oppName: op.stars.length ? '' : opp.name,
      oppStars: op.stars.length ? '' : opp.stars.map((s) => s.name).join('、'),
      isSoul: i === 0,
      hasJi: oi === jiIdx,
    });
  }
  return { year, ganzhi: y.ganzhi, xuSui: y.xuSui, liunian: yzhi, soulIdx, cells };
}

export default { paipan, analyzeYear, liunianPan, daxianSihua, liunianSihua };
