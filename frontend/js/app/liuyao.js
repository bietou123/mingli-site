/* app/liuyao.js —— 六爻起卦 + 断卦分析页 */
import { paipan, yaoFromCoins, timeCast, shuCast, setYijingData, meihuaTiYong, LIU_SHEN_MEANING, LIU_SHEN, EIGHT_PALACES, buildPalaceTable, TRIGRAMS, fullName, hexNameByYao6 } from '../engine/liuyao.js';
import { analyze as analyzeLiuyao, setKnowledge, yingQi, guaYi, setYijingForAnalyze } from '../engine/liuyao-analyze.js';
import { huangliMiniHtml, todayHuangli } from '../engine/huangli.js';

let rolls = [];
let shuN = ['', '', ''];
let LAST_LY = '';
let LAST_CAST = null;

const HISTORY_KEY = 'liuyao.history';
let history = [];
try { history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch {}
function saveHist(e) { history = [e, ...history].slice(0, 6); try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch {} }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/** 动爻六亲主事（《卜筮正宗》动爻章口径） */
const DONGQIN_MEANING = {
  父母: '动主文书契约、屋宅舟车、印信凭证、父母长辈——劳心费力之事；求文书屋宅可成，伤子息。',
  官鬼: '动主官职功名、忧疑病讼、小人灾厄——事生忧患；测官喜、测病忧，克兄弟。',
  妻财: '动主财禄妻室、经营货物、谋望之利——谋财有望；亦主破文书，克父母。',
  子孙: '动主解忧福泽、医药子女、僧道娱乐——无忧可解、能制官煞；测官讼不利，克官鬼。',
  兄弟: '动主竞争破耗、合伙朋辈、分利之争——财被分夺；测财须防分利，克妻财。',
};
/** 六亲取用速查（《卜筮正宗》六亲章口径） */
const LIUQIN_TABLE = [
    {
        name: '父母',
        renwu: '文书契约、屋宅舟车、印信凭证、父母长辈',
        quyong: '占文书考试、科举功名、签约购房、求长辈庇护',
        jixiong: '旺则文书易成、屋宅稳固；衰则印信难就、文件延误；动则劳心费力',
        kezhI: '父母克子孙——旺父母则伤子息，求子嗣忌父母过旺',
    },
    {
        name: '官鬼',
        renwu: '官职功名、官讼是非、疾病忧疑、小人灾厄',
        quyong: '占功名升迁、官司诉讼、疾病祛除（以官为病）',
        jixiong: '旺则权位可图、病情重；衰则官位难求、病易愈；动则生忧患是非',
        kezhI: '官鬼克兄弟——官旺则兄弟受制，合伙竞争防官压',
    },
    {
        name: '妻财',
        renwu: '财禄钱谷、妻室婚配、经营货物、谋望之利',
        quyong: '占求财经商、问妻室婚配、谋利营生',
        jixiong: '旺则财禄丰盈、妻道和顺；衰则财难聚、婚事迟；动则财动有望但亦流散',
        kezhI: '妻财克父母——财旺破文书印信，占考试文书忌妻财过动',
    },
    {
        name: '子孙',
        renwu: '子女后嗣、福泽解忧、医药僧道、娱乐安闲',
        quyong: '占子嗣生育、求平安健康、病体痊愈（子孙为药医）、出行平安',
        jixiong: '旺则福泽绵延、病解忧消；衰则子息艰难、福薄；动则诸事可解，官讼不利',
        kezhI: '子孙克官鬼——子旺则官受制，占功名官职忌子孙持世或过旺',
    },
    {
        name: '兄弟',
        renwu: '兄弟朋辈、竞争分利、合伙共事、口舌纷争',
        quyong: '占合伙事宜（须防劫财）、兄弟手足之事',
        jixiong: '旺则竞争激烈、财被瓜分；衰则纷争少；动则财被分夺，求财须警惕',
        kezhI: '兄弟克妻财——兄旺则财散，测财占婚最忌兄弟发动持世',
    },
];

/** 爻位取象（《卜筮正宗》六爻宫位） */
const YAOWEI_MEANING = {
  初爻: '足 · 地基 · 自身 · 乡里（内卦）',
  二爻: '腿 · 宅基 · 身家 · 正配（内卦）',
  三爻: '门户 · 兄弟 · 夫妻 · 床第（内卦）',
  四爻: '门庭 · 妻财 · 伯叔 · 外亲（外卦）',
  五爻: '道路 · 君位 · 父母 · 在外（外卦）',
  上爻: '首 · 祖辈 · 远行 · 边远（外卦）',
};

/** 纳甲术语速查数据表 */
const LIUYAO_TERMS = [
    { name: '用神', cat: '断卦', def: '所占之事对应之六亲爻，断卦之主；用神旺相则事成，衰绝则事难。' },
    { name: '原神', cat: '断卦', def: '生扶用神之爻，为用神之援助；原神旺动则用神得力，吉事易成。' },
    { name: '忌神', cat: '断卦', def: '克制用神之爻，为用神之大患；忌神旺动则用神受压，主事有阻。' },
    { name: '仇神', cat: '断卦', def: '克制原神之爻，间接损用神；仇神旺则原神受制，助力受损。' },
    { name: '世应', cat: '装卦', def: '世为问卦之人，应为所占之事或对方；世应相生相合主顺，相冲相克主逆。' },
    { name: '旬空', cat: '断卦', def: '日柱所在旬中缺此地支，临空之爻主事虚未实；待出空之日方可应验。' },
    { name: '月破', cat: '断卦', def: '月建与爻支相冲谓月破，主事难成破散；逢合则出破，可望转机。' },
    { name: '月建', cat: '断卦', def: '占卦当月之地支，月建旺则生克力最强；爻得月建生扶为旺，被冲克为衰。' },
    { name: '日辰', cat: '断卦', def: '占卦当日之干支，日辰冲合生克直接影响各爻吉凶；与月建合称「日月」。' },
    { name: '旺相休囚死', cat: '断卦', def: '五行与月建的生克关系：同气为旺，被生为相，生月建为休，被克为囚，克月建为死；衡量爻的力量。' },
    { name: '回头生克', cat: '断卦', def: '动爻变爻反过来生或克本爻，称回头生（得助）或回头克（受害）；是断动爻吉凶的要法。' },
    { name: '进神退神', cat: '断卦', def: '动爻变爻比本爻五行更进一步（如子→亥）为进神主进取，倒退为退神主退缩。' },
    { name: '六冲', cat: '断卦', def: '子午、丑未、寅申、卯酉、辰戌、巳亥相冲；冲主散、主速，六冲卦事难久持。' },
    { name: '六合', cat: '断卦', def: '子丑、寅亥、卯戌、辰酉、巳申、午未相合；合主聚、主和，六合卦事利长久。' },
    { name: '三合局', cat: '断卦', def: '寅午戌火局、申子辰水局、亥卯未木局、巳酉丑金局；三爻相合化一行，增强该五行之力。' },
    { name: '纳甲', cat: '装卦', def: '将天干地支纳入六爻卦位的方法，确定各爻的干支与五行属性，是装卦的基础规则。' },
    { name: '六神', cat: '装卦', def: '青龙、朱雀、勾陈、螣蛇、白虎、玄武六神临爻，按日干从初爻顺排，象征主事气质与吉凶倾向。' },
    { name: '飞神伏神', cat: '装卦', def: '卦中显现之爻称飞神，藏于飞神下未现之爻称伏神；用神不上卦时以伏神代之。' },
    { name: '冲中逢合', cat: '断卦', def: '爻本受冲，却被另一爻来合，冲力受阻，事反迟缓；合中逢冲则反之，和局被破。' },
];

/** 断卦口诀数据表（《卜筮正宗》《增删卜易》通行口诀） */
const DUAN_GUA_KOUJUE = [
    { koujue: '用神旺相，谋事可成', yi: '所占之事对应六亲爻气旺有力，谋划之事成功可期。', cat: '用神' },
    { koujue: '用神休囚，求谋难遂', yi: '用神气弱无力，所求之事阻碍重重，难以顺遂。', cat: '用神' },
    { koujue: '用神旬空，事难速成', yi: '用神临旬空，所占之事虚而未实，须待出空之日方有应验。', cat: '用神' },
    { koujue: '用神月破，事多无望', yi: '用神被月建冲破，主事破散难成，逢合出破方有转机。', cat: '用神' },
    { koujue: '用神入墓，进退维谷', yi: '用神被日辰或动变引入库墓，事陷僵局，进退两难。', cat: '用神' },
    { koujue: '原神发动，生机暗藏', yi: '生扶用神之爻动起，用神得援，事有转机，吉象渐生。', cat: '用神' },
    { koujue: '忌神发动，其害随至', yi: '克制用神之爻旺动，用神受压，所占之事阻碍立现。', cat: '用神' },
    { koujue: '世应相生，事有和合', yi: '世爻与应爻相互生扶，彼此顺应，所占之事多得和合。', cat: '世应' },
    { koujue: '世应相克，事多阻隔', yi: '世爻与应爻相互克制，双方相悖，所占之事阻隔难通。', cat: '世应' },
    { koujue: '日辰生用，得来助力', yi: '占卦当日地支生扶用神，用神得日辰之助，事有外力相援。', cat: '时日' },
    { koujue: '月建扶用，根基稳固', yi: '月建生旺用神，用神根基深厚，所谋之事基础扎实。', cat: '时日' },
    { koujue: '子孙持世，官讼无忧', yi: '子孙爻临世，福神护体，官司诉讼多可化解，平安可期。', cat: '六亲' },
    { koujue: '官鬼持世，灾厄宜防', yi: '官鬼爻临世，主有忧患病灾是非，宜谨慎防范。', cat: '六亲' },
    { koujue: '妻财持世，求财有望', yi: '妻财爻临世，财星当令，求财经营之事多有望成。', cat: '六亲' },
    { koujue: '兄弟持世，防人分财', yi: '兄弟爻临世，竞争分耗之象，求财须防他人劫夺分利。', cat: '六亲' },
    { koujue: '父母持世，文书当紧', yi: '父母爻临世，文书印信之事为重，签约考试宜抓紧。', cat: '六亲' },
];

/** 断卦口诀速查折叠表（export 供验证） */
export function duanGuaKoujueHtml() {
    const items = DUAN_GUA_KOUJUE.map((d) => `
        <div class="dgk-item">
            <div class="dgk-head"><b class="dgk-koujue">${esc(d.koujue)}</b><span class="dgk-cat">${esc(d.cat)}</span></div>
            <div class="dgk-yi">${esc(d.yi)}</div>
        </div>`).join('');
    return `
    <details class="hl-details dgk-details fade-in d3">
        <summary>断卦口诀速查 · 依《卜筮正宗》《增删卜易》</summary>
        <div class="dgk-grid">${items}</div>
        <div class="hl-note" style="margin-top:10px">口诀为断卦经验之谈，旺衰喜忌仍以日辰月建动变为准，命理当雷达，不当牢笼。</div>
    </details>`;
}

/** 安世应速查折叠表（export 供验证） */
export function anShiYingHtml(r) {
    // 宫五行
    const PALACE_WX = { 乾: '金', 坎: '水', 艮: '土', 震: '木', 巽: '木', 离: '火', 坤: '土', 兑: '金' };

    // 当前本卦 yao6 key（用 key 而非全名比对，避免依赖异步加载的卦名表）
    const curKey = r && r.benGua && r.benGua.yao ? r.benGua.yao.join('') : '';

    // rank 简短标注
    const rankShort = (rank) => {
        if (rank === '本宫卦（六世）') return '本宫';
        if (rank === '游魂卦（四世）') return '游魂';
        if (rank === '归魂卦（三世）') return '归魂';
        return rank.replace('卦', '');
    };

    // 生成八宫分组
    const table = buildPalaceTable();
    const palaceGroups = [];
    for (const p of EIGHT_PALACES) {
        const guaList = table.filter((g) => g.palace === p);
        const chipsHtml = guaList.map((g) => {
            const key = g.yao.join('');
            const shortName = hexNameByYao6(g.yao);
            const gname = shortName ? fullName(g.yao, shortName) : `${p}宫卦`;
            const yingPos = ((g.shiPos + 3 - 1) % 6) + 1;
            const isCur = key === curKey;
            return `<div class="sy-gua${isCur ? ' cur' : ''}" title="${esc(rankShort(g.rank))}">${esc(gname)}<small class="sy-pos">世${g.shiPos} 应${yingPos}</small>${isCur ? '<span class="sy-cur-tag">此卦</span>' : ''}</div>`;
        }).join('');
        palaceGroups.push(`<div class="sy-palace"><div class="sy-palace-head"><b>${esc(p)}宫</b><small class="sy-wx">${esc(PALACE_WX[p] || '')}行</small></div><div class="sy-chips">${chipsHtml}</div></div>`);
    }

    return `
    <details class="hl-details sy-details fade-in d3">
        <summary>安世应速查 · 八宫六十四卦世应</summary>
        <div class="sy-jue">天同二世天变五，地同四世地变初，人同游魂人变归，本宫之卦六世居</div>
        <div class="sy-grid">${palaceGroups.join('')}</div>
        <div class="hl-note" style="margin-top:10px">世应安法为京房纳甲古法，断卦仍以用神旺衰、动变生克为主，世应参合观事之我彼，命理当雷达，不当牢笼。</div>
    </details>`;
}

export function baguaLeixiangHtml() {
    const DATA = [
        { name: '乾', nature: '天', yinyang: '阳', rows: [
            ['天时', '天、冰、雹、霰'],
            ['人物', '君父、老人、当权者'],
            ['身体', '首、骨、肺'],
            ['方位', '西北'],
            ['性情', '刚健、果断、威严'],
            ['疾病', '头疾、骨病'],
        ]},
        { name: '兑', nature: '泽', yinyang: '阳', rows: [
            ['天时', '雨泽、新月'],
            ['人物', '少女、口舌之人、歌伎'],
            ['身体', '口、舌、肺'],
            ['方位', '西'],
            ['性情', '喜悦、口才、易变'],
            ['疾病', '口舌咽喉之疾'],
        ]},
        { name: '离', nature: '火', yinyang: '阳', rows: [
            ['天时', '日、电、虹、霞'],
            ['人物', '中女、文人、目疾者'],
            ['身体', '目、心、上焦'],
            ['方位', '南'],
            ['性情', '文明、依附、性急'],
            ['疾病', '目疾、心疾'],
        ]},
        { name: '震', nature: '雷', yinyang: '阳', rows: [
            ['天时', '雷、地震、霹雳'],
            ['人物', '长男、将帅、震动之事'],
            ['身体', '足、肝、筋'],
            ['方位', '东'],
            ['性情', '奋起、好动、易怒'],
            ['疾病', '足疾、肝胆之病'],
        ]},
        { name: '巽', nature: '风', yinyang: '阴', rows: [
            ['天时', '风、云、高空'],
            ['人物', '长女、秀士、商贾'],
            ['身体', '股、胆、气管'],
            ['方位', '东南'],
            ['性情', '谦逊、善入、不决'],
            ['疾病', '股肱、肝胆、风疾'],
        ]},
        { name: '坎', nature: '水', yinyang: '阴', rows: [
            ['天时', '月、雨、雪、水'],
            ['人物', '中男、盗贼、江湖之人'],
            ['身体', '耳、肾、血'],
            ['方位', '北'],
            ['性情', '险陷、智谋、劳苦'],
            ['疾病', '耳疾、肾水之疾'],
        ]},
        { name: '艮', nature: '山', yinyang: '阴', rows: [
            ['天时', '云、雾、山岚'],
            ['人物', '少男、山野之人、止物之人'],
            ['身体', '手指、鼻、背、骨'],
            ['方位', '东北'],
            ['性情', '静止、固执、厚重'],
            ['疾病', '手指、鼻、脾胃之疾'],
        ]},
        { name: '坤', nature: '地', yinyang: '阴', rows: [
            ['天时', '阴云、雾气、地'],
            ['人物', '老母、后妃、农夫、众人'],
            ['身体', '腹、脾、胃、肉'],
            ['方位', '西南'],
            ['性情', '柔顺、包容、迟缓'],
            ['疾病', '腹疾、脾胃之病'],
        ]},
    ];
    const yaoStr = (yao) => yao.slice().reverse().map((v) => v ? '━' : '━ ━').join(' ');
    const cards = DATA.map((d) => {
        const t = TRIGRAMS[d.name];
        const rows = d.rows.map((r) => `<div class="bgl-row"><b>${esc(r[0])}</b>：${esc(r[1])}</div>`).join('');
        return `<div class="bgl-card">
            <div class="bgl-head"><span class="bgl-name">${esc(d.name)}</span><span class="bgl-yao">${esc(yaoStr(t.yao))}</span><span class="bgl-nature">${esc(d.nature)}</span><span class="bgl-wx">${esc(t.wuxing)}</span><span class="bgl-yy">${esc(d.yinyang)}</span></div>
            <div class="bgl-rows">${rows}</div>
        </div>`;
    }).join('');
    return `
    <details class="hl-details bgl-details fade-in">
        <summary>八卦万物类象速查 · 梅花易数取象<span class="hint">乾兑离震 巽坎艮坤</span></summary>
        <div class="bgl-grid">${cards}</div>
        <div class="hl-note" style="margin-top:10px">八卦类象为取象之通例，断卦仍以用神旺衰、世应动变为准，命理当雷达，不当牢笼。</div>
    </details>`;
}

export function wuxingTableHtml() {
    const ATTR = [
        { wx: '木', fang: '东', se: '青', ji: '春', xiang: '生发条达' },
        { wx: '火', fang: '南', se: '赤', ji: '夏', xiang: '炎上热情' },
        { wx: '土', fang: '中', se: '黄', ji: '长夏', xiang: '稼穑厚重' },
        { wx: '金', fang: '西', se: '白', ji: '秋', xiang: '肃杀刚锐' },
        { wx: '水', fang: '北', se: '黑', ji: '冬', xiang: '润下智谋' },
    ];
    const SHENG = [['木','火'],['火','土'],['土','金'],['金','水'],['水','木']];
    const KE = [['木','土'],['土','水'],['水','火'],['火','金'],['金','木']];
    const WANGXIU = [
        { wx: '木', wang: '木', xiang: '火', xiu: '水', qiu: '金', si: '土' },
        { wx: '火', wang: '火', xiang: '土', xiu: '木', qiu: '水', si: '金' },
        { wx: '土', wang: '土', xiang: '金', xiu: '火', qiu: '木', si: '水' },
        { wx: '金', wang: '金', xiang: '水', xiu: '土', qiu: '火', si: '木' },
        { wx: '水', wang: '水', xiang: '木', xiu: '金', qiu: '土', si: '火' },
    ];
    const attrHtml = ATTR.map((a) => `<div class="wx5-row"><span class="wx5-big">${esc(a.wx)}</span><span class="wx5-fang">${esc(a.fang)}</span><span class="wx5-se">${esc(a.se)}</span><span class="wx5-ji">${esc(a.ji)}</span><span class="wx5-xiang">${esc(a.xiang)}</span></div>`).join('');
    const shengChips = SHENG.map((p) => `<span class="wx5-chip wx5-sheng-chip">${esc(p[0])}生${esc(p[1])}</span>`).join('<span class="wx5-arrow wx5-sarrow">→</span>');
    const keChips = KE.map((p) => `<span class="wx5-chip wx5-ke-chip">${esc(p[0])}克${esc(p[1])}</span>`).join('<span class="wx5-arrow wx5-karrow">→</span>');
    const wxCards = WANGXIU.map((w) => `<div class="wx5-card"><span class="wx5-big">${esc(w.wx)}</span><span class="wx5-state wx5-wang">旺·${esc(w.wang)}</span><span class="wx5-state wx5-xiang">相·${esc(w.xiang)}</span><span class="wx5-state wx5-xiu">休·${esc(w.xiu)}</span><span class="wx5-state wx5-qiu">囚·${esc(w.qiu)}</span><span class="wx5-state wx5-si">死·${esc(w.si)}</span></div>`).join('');
    return `
    <details class="hl-details wx5-details fade-in">
        <summary>五行生克旺衰速查 · 相生相克旺相休囚死<span class="hint">木火土金水</span></summary>
        <div class="wx5-attr">${attrHtml}</div>
        <div class="wx5-sheng">${shengChips}</div>
        <div class="wx5-ke">${keChips}</div>
        <div class="wx5-wx">${wxCards}</div>
        <div class="hl-note">五行生克旺衰为断卦取用神之基，吉凶仍以日辰月建、世应用神与动变生克综合论断，命理当雷达，不当牢笼。</div>
    </details>`;
}

/** 纳甲装卦速查折叠表（八宫纳甲与六神起例） */
export function najiaTableHtml() {
    const PALACES = [
        { name: '乾', wx: '金', nei: ['子', '寅', '辰'], wai: ['午', '申', '戌'] },
        { name: '坎', wx: '水', nei: ['寅', '辰', '午'], wai: ['申', '戌', '子'] },
        { name: '艮', wx: '土', nei: ['辰', '午', '申'], wai: ['戌', '子', '寅'] },
        { name: '震', wx: '木', nei: ['子', '寅', '辰'], wai: ['午', '申', '戌'] },
        { name: '巽', wx: '木', nei: ['丑', '亥', '酉'], wai: ['未', '巳', '卯'] },
        { name: '离', wx: '火', nei: ['卯', '丑', '亥'], wai: ['酉', '未', '巳'] },
        { name: '坤', wx: '土', nei: ['未', '巳', '卯'], wai: ['丑', '亥', '酉'] },
        { name: '兑', wx: '金', nei: ['巳', '卯', '丑'], wai: ['亥', '酉', '未'] },
    ];
    const rows = PALACES.map((p) => {
        const neiStr = p.nei.map((z) => `<b>${esc(z)}</b>`).join(' ');
        const waiStr = p.wai.map((z) => `<b>${esc(z)}</b>`).join(' ');
        return `<div class="nja-row">
            <span class="nja-palace">${esc(p.name)}（属${esc(p.wx)}）</span>
            <span class="nja-na">内：${neiStr}</span>
            <span class="nja-na">外：${waiStr}</span>
        </div>`;
    }).join('');
    return `
    <details class="hl-details nja-details fade-in">
        <summary>纳甲装卦速查 · 八宫纳甲与六神起例<span class="hint">京房纳甲法</span></summary>
        ${rows}
        <div class="nja-shen">
            <b>六神起例：</b>甲乙日起青龙、丙丁日起朱雀、戊日起勾陈、己日起螣蛇、庚辛日起白虎、壬癸日起玄武，自初爻起顺排至上爻。
        </div>
        <div class="hl-note">纳甲为装卦取地支五行六亲之基，断卦仍以世应用神旺衰动变为准，命理当雷达，不当牢笼。</div>
    </details>`;
}

/** 六十四卦卦名速查 · 上下卦交叉表（行=下卦，列=上卦） */
export function guaMingGridHtml() {
    // 八卦序：先天序（乾兑离震巽坎艮坤）
    const ORDER = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];
    // 硬编码 64 卦名：NAMES[下卦][上卦]，顺序同 ORDER
    const NAMES = {
        乾: { 乾:'乾', 兑:'夬', 离:'大有', 震:'大壮', 巽:'小畜', 坎:'需',  艮:'大畜', 坤:'泰'  },
        兑: { 乾:'履', 兑:'兑', 离:'睽',  震:'归妹', 巽:'中孚', 坎:'节',  艮:'损',   坤:'临'  },
        离: { 乾:'同人',兑:'革', 离:'离',  震:'丰',   巽:'家人', 坎:'既济',艮:'贲',   坤:'明夷'},
        震: { 乾:'无妄',兑:'随', 离:'噬嗑',震:'震',   巽:'益',   坎:'屯',  艮:'颐',   坤:'复'  },
        巽: { 乾:'姤',  兑:'大过',离:'鼎', 震:'恒',   巽:'巽',   坎:'井',  艮:'蛊',   坤:'升'  },
        坎: { 乾:'讼',  兑:'困', 离:'未济',震:'解',   巽:'涣',   坎:'坎',  艮:'蒙',   坤:'师'  },
        艮: { 乾:'遯',  兑:'咸', 离:'旅',  震:'小过', 巽:'渐',   坎:'蹇',  艮:'艮',   坤:'谦'  },
        坤: { 乾:'否',  兑:'萃', 离:'晋',  震:'豫',   巽:'观',   坎:'比',  艮:'剥',   坤:'坤'  },
    };
    // 尝试用 engine 访问器覆盖（浏览器运行时卦爻辞已加载时更准）
    const TRIGRAM_YAO = { 乾:[1,1,1], 兑:[1,1,0], 离:[1,0,1], 震:[1,0,0], 巽:[0,1,1], 坎:[0,1,0], 艮:[0,0,1], 坤:[0,0,0] };
    const resolvedNames = {};
    let allFromEngine = true;
    for (const lo of ORDER) {
        resolvedNames[lo] = {};
        for (const up of ORDER) {
            const yao6 = [...TRIGRAM_YAO[lo], ...TRIGRAM_YAO[up]];
            const engineName = hexNameByYao6(yao6);
            resolvedNames[lo][up] = engineName ?? NAMES[lo][up];
            if (engineName === null) allFromEngine = false;
        }
    }
    // 表头行
    const headCells = ORDER.map(u => `<th class="gmg-th">${esc(u)}</th>`).join('');
    // 数据行
    const dataRows = ORDER.map(lo => {
        const cells = ORDER.map(up => {
            const name = resolvedNames[lo][up];
            const isPure = lo === up;
            const cellClass = isPure ? 'gmg-cell gmg-opp' : 'gmg-cell';
            const inner = name.length > 2 ? `<small>${esc(name)}</small>` : esc(name);
            return `<td class="${cellClass}">${inner}</td>`;
        }).join('');
        return `<tr><th class="gmg-th gmg-row-th">${esc(lo)}</th>${cells}</tr>`;
    }).join('');
    return `
    <details class="hl-details gmg-details fade-in">
        <summary>六十四卦卦名速查 · 上下卦交叉表<span class="hint">行下卦 · 列上卦</span></summary>
        <div class="gmg-wrap">
        <table class="gmg-table">
            <thead><tr><th class="gmg-th gmg-corner">下＼上</th>${headCells}</tr></thead>
            <tbody>${dataRows}</tbody>
        </table>
        </div>
        <div class="hl-note">上卦下卦相叠成六十四卦，卦名为断卦取象之索引，断卦仍以世应用神旺衰动变为准，命理当雷达，不当牢笼。</div>
    </details>`;
}

/** 日月建旺衰速查折叠表（《增删卜易》口径） */
export function yueJianTableHtml() {
    const YUE_JIAN = [
        { yue: '正月', zhi: '寅', jieqi: '立春', ling: '木令当旺，万物萌发' },
        { yue: '二月', zhi: '卯', jieqi: '惊蛰', ling: '木气最旺，生发盛极' },
        { yue: '三月', zhi: '辰', jieqi: '清明', ling: '木退土进，辰为土库' },
        { yue: '四月', zhi: '巳', jieqi: '立夏', ling: '火令当旺，炎热渐起' },
        { yue: '五月', zhi: '午', jieqi: '芒种', ling: '火气最旺，阳极阴生' },
        { yue: '六月', zhi: '未', jieqi: '小暑', ling: '火退土进，未为土库' },
        { yue: '七月', zhi: '申', jieqi: '立秋', ling: '金令当旺，肃杀渐至' },
        { yue: '八月', zhi: '酉', jieqi: '白露', ling: '金气最旺，收敛最盛' },
        { yue: '九月', zhi: '戌', jieqi: '寒露', ling: '金退土进，戌为火库' },
        { yue: '十月', zhi: '亥', jieqi: '立冬', ling: '水令当旺，寒气渐深' },
        { yue: '冬月', zhi: '子', jieqi: '大雪', ling: '水气最旺，阴极阳生' },
        { yue: '腊月', zhi: '丑', jieqi: '小寒', ling: '水退土进，丑为金库' },
    ];
    const SI_SHI = [
        { ji: '春', list: [
            { wx: '木', state: '旺', cls: 'yj2-wang' },
            { wx: '火', state: '相', cls: 'yj2-xiang' },
            { wx: '土', state: '休', cls: 'yj2-xiu' },
            { wx: '金', state: '囚', cls: 'yj2-qiu' },
            { wx: '水', state: '死', cls: 'yj2-si' },
        ]},
        { ji: '夏', list: [
            { wx: '火', state: '旺', cls: 'yj2-wang' },
            { wx: '土', state: '相', cls: 'yj2-xiang' },
            { wx: '金', state: '休', cls: 'yj2-xiu' },
            { wx: '水', state: '囚', cls: 'yj2-qiu' },
            { wx: '木', state: '死', cls: 'yj2-si' },
        ]},
        { ji: '秋', list: [
            { wx: '金', state: '旺', cls: 'yj2-wang' },
            { wx: '水', state: '相', cls: 'yj2-xiang' },
            { wx: '木', state: '休', cls: 'yj2-xiu' },
            { wx: '火', state: '囚', cls: 'yj2-qiu' },
            { wx: '土', state: '死', cls: 'yj2-si' },
        ]},
        { ji: '冬', list: [
            { wx: '水', state: '旺', cls: 'yj2-wang' },
            { wx: '木', state: '相', cls: 'yj2-xiang' },
            { wx: '火', state: '休', cls: 'yj2-xiu' },
            { wx: '土', state: '囚', cls: 'yj2-qiu' },
            { wx: '金', state: '死', cls: 'yj2-si' },
        ]},
    ];
    const ROLES = [
        '日辰为六爻之主宰，月建为当权之提纲，断卦首重日月。',
        '用神临月建日辰则旺，得月建生扶则有气，受月建克泄则衰。',
        '月破之爻虽弱，若临日辰生扶，逢冲之月可解，亦可酌情取用。',
        '旬空之爻须辨真空假空：月建日辰填实则不空，动爻自填亦不为空。',
        '动爻生扶用神主吉，动爻克泄用神主凶，静爻随日月旺衰论断。',
        '世爻为占者自身，应爻为所问对象，日辰月建冲克世应须重点留意。',
    ];
    const chipsHtml = YUE_JIAN.map((m) =>
        `<span class="yj2-chip">${esc(m.yue)} · ${esc(m.zhi)} <i>${esc(m.jieqi)}</i><small>${esc(m.ling)}</small></span>`
    ).join('');
    const sjCards = SI_SHI.map((s) => {
        const states = s.list.map((item) =>
            `<span class="yj2-state ${esc(item.cls)}">${esc(item.wx)}${esc(item.state)}</span>`
        ).join('');
        return `<div class="yj2-sj-card"><div class="yj2-sj-title">${esc(s.ji)}</div><div class="yj2-sj-states">${states}</div></div>`;
    }).join('');
    const roleItems = ROLES.map((r) => `<li>${esc(r)}</li>`).join('');
    const blocksHtml = `
        <div class="yj2-block">
            <div class="yj2-title">十二月建当令</div>
            <div class="yj2-chips">${chipsHtml}</div>
        </div>
        <div class="yj2-sj">
            <div class="yj2-title">四时旺相休囚死</div>
            <div class="yj2-sj-cards">${sjCards}</div>
        </div>
        <div class="yj2-role">
            <div class="yj2-title">日辰月建作用要点</div>
            <ul class="yj2-role-list">${roleItems}</ul>
        </div>`;
    return `<details class="hl-details yj2-details fade-in">
      <summary>日月建旺衰速查 · 月建当令与四时旺衰<span class="hint">增删卜易</span></summary>
      <div class="yj2-wrap">
        ${blocksHtml}
        <div class="hl-note">日月建为断卦旺衰之依据，吉凶仍以用神世应旺衰动变为准，命理当雷达，不当牢笼。</div>
      </div>
    </details>`;
}

/** 梅花易数起卦速查折叠表（邵雍口径，六种起卦法） */
export function meihuaQiGuaHtml() {
    const BAGUA_NUM = '乾1 兑2 离3 震4 巽5 坎6 艮7 坤8（余0取8）';
    const cards = [
        {
            name: '时间起卦',
            steps: '年支数+月+日 → 上卦；年支数+月+日+时数 → 下卦；日+时数 → 动爻',
            method: '① 取当年地支数（子1丑2寅3卯4辰5巳6午7未8申9酉10戌11亥12）+ 月数 + 日数，÷8 余数定上卦；② 年支数 + 月数 + 日数 + 时数（子1丑2…亥12），÷8 余数定下卦；③ 日数 + 时数，÷6 余数定动爻。余0时：上下卦余0取坤（8），动爻余0取6爻。',
            example: '假设某年支数9（申年）+ 月3 + 日15 = 27，27÷8余3，上卦为离（3）；27 + 时8（辰时）= 35，35÷8余3，下卦亦离；15+8=23，23÷6余5，动爻第5爻。得离为火卦五爻动。',
        },
        {
            name: '报数起卦',
            steps: '第一数 → 上卦；第二数 → 下卦；两数之和 → 动爻',
            method: '① 第一个报数 ÷8 余数定上卦；② 第二个报数 ÷8 余数定下卦；③ 两数相加 ÷6 余数定动爻。余0规则同上。',
            example: '报数3与5：3÷8余3，上卦离；5÷8余5，下卦巽；3+5=8，8÷6余2，动爻第2爻。得火风鼎卦，但以报数法时卦为火风鼎二爻动。',
        },
        {
            name: '三数起卦',
            steps: '第一数 → 上卦；第二数 → 下卦；第三数 → 动爻',
            method: '① 第一数 ÷8 余数定上卦；② 第二数 ÷8 余数定下卦；③ 第三数 ÷6 余数定动爻，余0取6。此法最简，三个随机数即可成卦。',
            example: '三数7、2、4：7÷8余7，上卦艮；2÷8余2，下卦兑；4÷6余4，动爻第4爻。得山泽损卦四爻动。',
        },
        {
            name: '字数起卦',
            steps: '二字：上字笔画÷8上卦，下字÷8下卦，总笔画÷6动爻；三字：前一字上卦，后两字合数下卦',
            method: '二字起卦：上字笔画数 ÷8 余数定上卦，下字笔画数 ÷8 余数定下卦，上下字总笔画 ÷6 余数定动爻。三字起卦：第一字笔画 ÷8 定上卦，后两字笔画之和 ÷8 定下卦，三字总笔画 ÷6 定动爻。余0规则同上。',
            example: '二字「平安」：「平」5画÷8余5，上卦巽；「安」6画÷8余6，下卦坎；总11画÷6余5，动爻5。得风水涣卦五爻动。',
        },
        {
            name: '声音起卦',
            steps: '闻几声÷8上卦；再闻几声÷8下卦；两次声数之和÷6动爻',
            method: '① 第一次听到的声数 ÷8 余数定上卦；② 第二次听到的声数 ÷8 余数定下卦；③ 两次声数相加 ÷6 余数定动爻。若只闻一次，则上下卦皆用此数，总数×2 ÷6 定动爻。',
            example: '敲门三声：3÷8余3，上卦离；再敲两声：2÷8余2，下卦兑；3+2=5，5÷6余5，动爻第5爻。得火泽睽卦五爻动。',
        },
        {
            name: '物数方位起卦',
            steps: '见物之数÷8上卦；物所在方位数÷8下卦；物数+方位数÷6动爻',
            method: '① 所见物体数量 ÷8 余数定上卦；② 该物所处方位按后天八卦取数（离南3、坎北6、震东4、兑西2、巽东南5、乾西北1、坤西南8、艮东北7），÷8 余数定下卦；③ 物数 + 方位数 ÷6 余数定动爻。',
            example: '见南方飞来5只鸟：5÷8余5，上卦巽；南方为离，方位数3，3÷8余3，下卦离；5+3=8，8÷6余2，动爻第2爻。得风火家人卦二爻动。',
        },
    ];

    const cardsHtml = cards.map((c) => `
        <div class="mhq-card">
            <div class="mhq-head">${esc(c.name)}<span class="mhq-steps">${esc(c.steps)}</span></div>
            <div class="mhq-method">${esc(c.method)}</div>
            <div class="mhq-example">示例：${esc(c.example)}</div>
            <div class="mhq-num">八卦数字对应：${esc(BAGUA_NUM)}</div>
        </div>`).join('');

    return `
    <details class="hl-details mhq-details fade-in">
        <summary>梅花易数起卦速查 · 六种起卦法<span class="hint">邵雍《梅花易数》口径</span></summary>
        <div class="mhq-grid">${cardsHtml}</div>
        <div class="hl-note">梅花起卦法为取象之方便门，断卦仍以用神旺衰世应动变为准，命理当雷达，不当牢笼。</div>
    </details>`;
}

/** 纳甲术语速查折叠表（export 供验证） */
export function liuyaoTermsHtml() {
    const items = LIUYAO_TERMS.map((t) => `
        <div class="lyt-item">
            <div class="lyt-head"><b class="lyt-name">${esc(t.name)}</b><span class="lyt-cat">${esc(t.cat)}</span></div>
            <div class="lyt-def">${esc(t.def)}</div>
        </div>`).join('');
    return `
    <details class="hl-details lyt-details fade-in d3">
        <summary>纳甲术语速查 · 六爻名词</summary>
        <div class="lyt-grid">${items}</div>
        <div class="hl-note" style="margin-top:10px">术语为理解断卦结果之助，断卦仍以世应用神旺衰动变为准；命理当雷达，不当牢笼。</div>
    </details>`;
}

/** 六亲取用速查折叠表（export 供验证） */
export function liuQinTableHtml() {
    const items = LIUQIN_TABLE.map((lq) => `
        <div class="lqk-item">
            <div class="lqk-head"><b class="lqk-name">${esc(lq.name)}</b></div>
            <div class="lqk-row"><b>代表人事</b>：${esc(lq.renwu)}</div>
            <div class="lqk-row"><b>取用场景</b>：${esc(lq.quyong)}</div>
            <div class="lqk-row"><b>旺衰吉凶</b>：${esc(lq.jixiong)}</div>
            <div class="lqk-row lqk-ke"><b>克制关系</b>：${esc(lq.kezhI)}</div>
        </div>`).join('');
    return `
    <details class="hl-details lqk-details fade-in d2">
        <summary>六亲取用速查 · 依《卜筮正宗》</summary>
        <div class="lqk-list">${items}</div>
        <div class="hl-note" style="margin-top:10px">六亲为断卦取用神之纲，旺衰喜忌仍以日辰月建动变为准，命理当雷达，不当牢笼。</div>
    </details>`;
}

/** 动爻直断渲染：六亲主事 × 六神所主 × 爻位取象（export 供验证） */
export function dongyaoHtml(r, a) {
  const moving = [...(r?.benGua?.yaos || [])].filter((y) => y.moving);
  if (!moving.length) return '';
  const list = moving.map((y) => {
    const dq = DONGQIN_MEANING[y.liuQin] || '';
    const ss = (y.liuShen && LIU_SHEN_MEANING[y.liuShen]) || '';
    const yw = YAOWEI_MEANING[y.posName] || '';
    const isYong = a?.ys?.posName === y.posName;
    return `
      <div class="dyd-item${isYong ? ' is-yong' : ''}">
        <div class="dyd-head">${y.posName} <b>${y.liuQin}</b>动${y.isShi ? ' · 世爻' : ''}${y.isYing ? ' · 应爻' : ''}${isYong ? ' · 用神' : ''}
          ${y.liuShen ? `<span class="dyd-shen">临${y.liuShen}</span>` : ''}
          ${y.bian ? `<span class="dyd-bian">变出 ${y.bian.ganzhi}${y.bian.huiTou?.name ? `（${y.bian.huiTou.name}）` : ''}</span>` : ''}</div>
        <div class="dyd-row"><b>六亲</b>：${dq}</div>
        <div class="dyd-row"><b>六神</b>：${ss}</div>
        <div class="dyd-row"><b>爻位</b>：${yw}</div>
      </div>`;
  }).join('');
  return `
    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>动爻直断</h2>
        <span class="hint">《卜筮正宗》· 动爻六亲主事 × 六神所主 × 爻位取象，作参详</span></div>
      <div class="dyd-list">${list}</div>
      <div class="hl-note" style="margin-top:10px">动爻为事之枢纽：逢用神动，主其事有应；逢忌神动，须防其害。仍以用神旺衰喜忌为总纲。</div>
    </div>`;
}

/** 六神主事：本卦六爻所临六神一览 + 六神取象详解（依《卜筮正宗》六神章） */
export function liuShenYaoLan(r) {
  const rows = [...r.benGua.yaos].reverse().map((y) => {
    const idx = LIU_SHEN.indexOf(y.liuShen);
    const scls = idx >= 0 ? ` c${idx}` : '';
    const flag = `${y.isShi ? '<b class="lsh-flag shi">世</b>' : ''}${y.isYing ? '<b class="lsh-flag ying">应</b>' : ''}${y.moving ? '<b class="lsh-flag mov">动</b>' : ''}${y.xunKong ? '<b class="lsh-flag kong">空</b>' : ''}`;
    return `
      <div class="lsh-row">
        <span class="lsh-shen${scls}">${y.liuShen || '—'}</span>
        <span class="lsh-pos">${y.posName}</span>
        ${flag}
        <span class="lsh-qin">${y.liuQin || ''}</span>
        <span class="lsh-wx">${y.wuxing || ''}</span>
      </div>`;
  }).join('');
  const cards = LIU_SHEN.map((name, i) => `
    <div class="lsh-card">
      <b class="lsh-card-name c${i}">${name}</b>
      <span class="lsh-card-desc">${LIU_SHEN_MEANING[name] || ''}</span>
    </div>`).join('');
  return `
    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>六神主事</h2>
        <span class="hint">本卦六神排列 · 取象依《卜筮正宗》六神章</span></div>
      <div class="lsh-wrap">
        <div class="lsh-list">${rows}</div>
        <div class="lsh-cards">${cards}</div>
      </div>
      <div class="d" style="margin-top:8px;font-size:12px;color:var(--text-faint)">六神按日干起：甲乙青龙、丙丁朱雀、戊勾陈、己螣蛇、庚辛白虎、壬癸玄武，自初爻顺排至六爻。临用神看主事之吉凶倾向，作参考不迷信。</div>
    </div>`;
}

export const template = `
  <section class="page-head fade-in">
    <h1>六爻 <em>·</em> 起卦</h1>
    <p>摇钱装卦 · 定用神 · 察旺衰 —— 依《增删卜易》《卜筮正宗》作规则化参考</p>
  </section>

  <section class="form-panel glass fade-in d1">
    <form id="ly-form" autocomplete="off">
      <div class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
        <div class="field">
          <label>起卦方式</label>
          <select id="ly-mode">
            <option value="yao" selected>摇钱（六次手动）</option>
            <option value="time">时间起卦（当下）</option>
            <option value="shu">报数起卦（三数）</option>
          </select>
        </div>
        <div class="field">
          <label>所占何事</label>
          <select id="ly-item">
            <option value="测财">财运求财</option>
            <option value="事业">事业功名</option>
            <option value="婚姻">婚姻感情</option>
            <option value="测病">疾病健康</option>
            <option value="官非">官非诉讼</option>
            <option value="父母">父母长辈</option>
            <option value="子女">子女后代</option>
            <option value="出行">出行远行</option>
            <option value="其他">其他 / 不详</option>
          </select>
        </div>
        <div class="field">
          <label>经度<span class="opt">时间起卦用</span></label>
          <input type="number" id="ly-lng" value="120" min="73.5" max="135" step="0.01">
        </div>
        <div class="field">
          <label>&nbsp;</label>
          <button type="button" class="btn ghost" id="ly-clear" style="width:100%">清空</button>
        </div>
      </div>

      <div id="ly-cast" class="cast-box" style="margin-top:20px"></div>

      <div class="form-actions" style="grid-template-columns:1fr;display:grid">
        <button type="submit" class="btn" id="ly-go">起 卦 装 盘</button>
      </div>
    </form>
  </section>

  <div id="ly-result"></div>

  <section class="section">
    <div class="section-head"><span class="tick"></span><h2>六十四卦速查</h2><span class="hint">依《周易》通行本 · 卦辞爻辞原文</span></div>
    <div class="panel glass fade-in d1">
      <details class="hl-details" open>
        <summary>六十四卦索引 · 点击任意卦查看卦辞与爻辞</summary>
        <div class="yj-grid" id="ly-yj-grid"><p class="sub">卦辞加载中…</p></div>
        <div id="ly-yj-detail" class="yj-detail"></div>
      </details>
    </div>
  </section>
`;

let YIJING_LIST = [];
let YJ_CURRENT = 0;

export function mounted(root) {
  const castBox = root.querySelector('#ly-cast');
  const modeSel = root.querySelector('#ly-mode');
  const form = root.querySelector('#ly-form');
  const result = root.querySelector('#ly-result');
  const clearBtn = root.querySelector('#ly-clear');

  // 数据加载
  const kbPromise = fetch(new URL('../../data/knowledge-liuyao.json', import.meta.url))
    .then((res) => res.json()).then((d) => setKnowledge(d))
    .catch((e) => console.warn('六爻知识库加载失败', e));
  const yjPromise = fetch(new URL('../../data/yijing64.json', import.meta.url))
    .then((res) => res.json()).then((d) => { setYijingData(d); setYijingForAnalyze(d); YIJING_LIST = d.hexagrams || []; populateYj(); })
    .catch((e) => console.warn('易经卦辞加载失败', e));

  // ── 六十四卦速查（卦辞爻辞） ──
  const yjGrid = root.querySelector('#ly-yj-grid');
  const yjDetail = root.querySelector('#ly-yj-detail');
  function populateYj() {
    if (!yjGrid) return;
    if (!YIJING_LIST.length) { yjGrid.innerHTML = '<p class="sub">卦辞加载失败。</p>'; return; }
    yjGrid.innerHTML = YIJING_LIST.map((g) => `<button type="button" class="yj-cell${g.no === YJ_CURRENT ? ' cur' : ''}" data-yj-no="${g.no}" title="${g.upper}上 · ${g.lower}下">${g.no}. ${esc(g.name)}</button>`).join('');
    yjGrid.querySelectorAll('[data-yj-no]').forEach((b) => b.addEventListener('click', () => showYj(Number(b.dataset.yjNo))));
    if (YJ_CURRENT) showYj(YJ_CURRENT);
  }
  function showYj(no) {
    const g = YIJING_LIST.find((x) => x.no === no);
    if (!g || !yjDetail) return;
    YJ_CURRENT = no;
    yjGrid.querySelectorAll('[data-yj-no]').forEach((b) => b.classList.toggle('cur', Number(b.dataset.yjNo) === no));
    yjDetail.innerHTML = `
      <div class="yj-d-head"><b>${g.no}. ${esc(g.name)}</b><span class="hint">${esc(g.upper)}上 · ${esc(g.lower)}下</span></div>
      <div class="yj-gua"><b>卦辞</b>${esc(g.guaci)}</div>
      ${g.xiangci ? `<div class="yj-yi">${esc(g.xiangci)}</div>` : ''}
      <div class="yj-yao">${(g.yaoci || []).map((y) => `<div class="yj-yao-row"><span class="yj-yao-t">${esc(y.title)}</span>${esc(y.text)}</div>`).join('')}</div>
      ${g.yongjiu ? `<div class="yj-yong">用九 / 用六　${esc(g.yongjiu)}</div>` : ''}
      <div class="yj-note">卦辞爻辞为原文参考，断卦仍以世应 · 用神 · 旺衰 · 动变为准。</div>`;
  }

  function renderCast() {
    const mode = modeSel.value;
    const isYao = mode === 'yao';
    const isShu = mode === 'shu';
    castBox.innerHTML = `
      <div class="cast-head">
        <span>${isYao ? '第 ' + (rolls.length + 1) + ' 摇 · 自下而上' : isShu ? '报数起卦 · 随口报三个正整数' : '时间起卦：自动定六爻与动爻'}</span>
        <span class="hint">${isYao ? '背（○）为阳记 3/1，面（×）为阴记 0/2' : isShu ? '第一数定上卦 · 第二数定下卦 · 第三数定动爻' : '梅花易数年月日时法，仅一爻动'}</span>
      </div>
      ${isShu ? `
        <div class="shu-inputs">
          <label class="field">第一数
            <input type="number" id="shu-n1" min="1" placeholder="例 7" value="${esc(shuN[0])}">
          </label>
          <label class="field">第二数
            <input type="number" id="shu-n2" min="1" placeholder="例 19" value="${esc(shuN[1])}">
          </label>
          <label class="field">第三数
            <input type="number" id="shu-n3" min="1" placeholder="例 25" value="${esc(shuN[2])}">
          </label>
        </div>
        <div class="shu-note">先天卦数：1乾 2兑 3离 4震 5巽 6坎 7艮 8坤。数字超过范围按余数取，余 0 即 8（或 6）。</div>
        <button type="button" class="btn ghost" id="shu-random" style="margin-top:14px;font-size:13px;padding:9px 20px">随 缘 取 数</button>` : `
        <div class="cast-slots">
          ${[5, 4, 3, 2, 1, 0].map((i) => {
            const r = rolls[i];
            const name = r ? yaoFromCoins(r.bei).name : '—';
            const mark = r ? yaoFromCoins(r.bei).symbol : '';
            return `<div class="cast-slot ${r ? 'filled' : ''}">
              <span class="cs-pos">${i + 1} 爻</span>
              <span class="cs-val">${r ? `${r.bei}背` : '待摇'}</span>
              <span class="cs-name">${name}</span>
            </div>`;
          }).join('')}
        </div>`}
      <div class="cast-actions">
        ${isYao
          ? (rolls.length < 6
            ? `<button type="button" class="btn" id="ly-shake">摇 一 爻</button>`
            : `<button type="button" class="btn ghost" id="ly-shake">重 摇 六 爻</button>`)
          : ''}
        ${isYao && rolls.length ? `<button type="button" class="btn ghost" id="ly-undo">退 一 步</button>` : ''}
      </div>`;
    // 事件
    const shake = castBox.querySelector('#ly-shake');
    if (shake) shake.addEventListener('click', () => {
      const c = shakeRoll();
      if (rolls.length >= 6) rolls = [];
      rolls.push({ bei: c });
      renderCast();
    });
    const undo = castBox.querySelector('#ly-undo');
    if (undo) undo.addEventListener('click', () => { rolls.pop(); renderCast(); });
    ['n1', 'n2', 'n3'].forEach((k, i) => {
      const el = castBox.querySelector('#shu-' + k);
      if (el) el.addEventListener('input', () => { shuN[i] = el.value; });
    });
    const shuRandom = castBox.querySelector('#shu-random');
    if (shuRandom) shuRandom.addEventListener('click', () => {
      const rnd = () => String(Math.floor(Math.random() * 9) + 1);
      shuN = [rnd(), rnd(), rnd()];
      renderCast();
    });
  }

  function shakeRoll() {
    const rnd = () => (globalThis.crypto?.getRandomValues
      ? (() => { const a = new Uint8Array(1); globalThis.crypto.getRandomValues(a); return a[0] / 256; })()
      : Math.random());
    return [0, 1, 2].reduce((s) => s + (rnd() < 0.5 ? 1 : 0), 0);
  }

  modeSel.addEventListener('change', renderCast);
  clearBtn.addEventListener('click', () => { rolls = []; result.innerHTML = ''; renderCast(); });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const item = root.querySelector('#ly-item').value;
    const lng = parseFloat(root.querySelector('#ly-lng').value) || 120;
    const mode = modeSel.value;
    const now = new Date();
    const question = root.querySelector('#ly-item').selectedOptions[0].text;
    let r;
    let tc = null;
    if (mode === 'yao') {
      if (rolls.length !== 6) { result.innerHTML = `<div class="tip red fade-in">请先摇满六爻，或改用时间 / 报数起卦。</div>`; return; }
      LAST_CAST = null; // 摇钱随机，不可复现，不提供分享
      r = paipan({ beiCounts: rolls.map((x) => x.bei), dt: now, longitude: lng, question });
    } else if (mode === 'shu') {
      const nums = [1, 2, 3].map((i) => parseInt(root.querySelector('#shu-n' + i)?.value, 10));
      if (nums.some((n) => !Number.isInteger(n) || n < 1)) {
        result.innerHTML = `<div class="tip red fade-in">请填写三个正整数后再起卦。</div>`; return;
      }
      tc = shuCast(nums[0], nums[1], nums[2]);
      LAST_CAST = { mode: 'shu', n: [...nums], lng, item, q: question };
      r = paipan({ yao: tc.yao, movingPositions: tc.movingPositions, dt: now, longitude: lng, question, castMode: '报数起卦', castDetail: tc.detail });
    } else {
      tc = timeCast(now, lng, 2, true);
      LAST_CAST = { mode: 'time', t: now.toISOString(), lng, item, q: question };
      r = paipan({ yao: tc.yao, movingPositions: tc.movingPositions, dt: now, longitude: lng, question, castMode: '时间起卦', castDetail: tc.detail });
    }
    result.innerHTML = `<div class="panel glass fade-in" style="text-align:center"><p class="sub">装卦中…</p></div>`;
    Promise.all([kbPromise, yjPromise]).then(() => {
      const a = analyzeLiuyao(r, item);
      a.yingQi = yingQi(a, now);
      saveHist({
        mode,
        beiCounts: mode === 'yao' ? rolls.map((x) => x.bei) : undefined,
        yao: mode === 'yao' ? undefined : tc.yao,
        movingPositions: mode === 'yao' ? undefined : tc.movingPositions,
        shuN: mode === 'shu' ? [...shuN] : undefined,
        dt: now.toISOString(), lng, item, question,
        ben: r.benGua.name, bian: r.bianGua?.name || '', at: now.toLocaleString(),
      });
      result.innerHTML = topBarHtml() + renderResult(r, a) + historyHtml();
      result.querySelectorAll('.fade-in').forEach((el) => { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; });
      bindHistory();
      bindExport(result);
      bindShare(result);
    });
  });

  // ── 分享链接自动起卦：打开 #/liuyao?t=...（时间起卦）或 #/liuyao?n=1,2,3（报数起卦）直接出卦 ──
  const sp = window.__shareParams;
  const shareT = sp && sp.get('t');
  const shareN = sp && sp.get('n');
  if (shareT || shareN) {
    const VALID_ITEMS = ['测财', '事业', '婚姻', '测病', '官非', '父母', '子女', '出行', '其他'];
    const itemSel = root.querySelector('#ly-item');
    const item = VALID_ITEMS.includes(sp.get('item')) ? sp.get('item') : '其他';
    if (itemSel) itemSel.value = item;
    const lng = parseFloat(sp.get('lng')) || 120;
    Promise.all([kbPromise, yjPromise]).then(() => {
      const now = shareT ? new Date(shareT) : new Date();
      const question = sp.get('q') || (itemSel.selectedOptions[0]?.text || '其他 / 不详');
      let tc, castMode;
      if (shareT) {
        if (modeSel) modeSel.value = 'time';
        tc = timeCast(now, lng, 2, true);
        castMode = '时间起卦';
        LAST_CAST = { mode: 'time', t: String(shareT), lng, item, q: question };
      } else {
        if (modeSel) modeSel.value = 'shu';
        const nums = String(shareN).split(',').map((x) => parseInt(x, 10));
        if (nums.some((n) => !Number.isInteger(n) || n < 1)) return;
        shuN = nums.map((x) => String(x));
        tc = shuCast(nums[0], nums[1], nums[2]);
        castMode = '报数起卦';
        LAST_CAST = { mode: 'shu', n: nums, lng, item, q: question };
      }
      renderCast();
      const r = paipan({ yao: tc.yao, movingPositions: tc.movingPositions, dt: now, longitude: lng, question, castMode, castDetail: tc.detail });
      result.innerHTML = `<div class="panel glass fade-in" style="text-align:center"><p class="sub">装卦中…</p></div>`;
      const a = analyzeLiuyao(r, item);
      a.yingQi = yingQi(a, now);
      result.innerHTML = topBarHtml() + renderResult(r, a) + historyHtml();
      result.querySelectorAll('.fade-in').forEach((el) => { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; });
      bindHistory();
      bindExport(result);
      bindShare(result);
    });
  }
function topBarHtml() {
  const shareBtn = LAST_CAST ? `<button type="button" class="btn ghost" id="ly-share" style="padding:8px 18px;font-size:13px" title="复制本卦分享链接，他人打开即见同卦">复 制 卦 象 链 接</button>` : '';
  return `
    <div class="panel glass fade-in d1" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
      <span style="font-size:13px;color:var(--text-dim)">卦成 · 诚一为贵，勿贪连摇</span>
      <span style="display:flex;gap:8px;flex-wrap:wrap">${shareBtn}
      <button type="button" class="btn ghost" id="ly-again" style="padding:8px 18px;font-size:13px">再 摇 一 卦</button></span>
    </div>`;
}

function historyHtml() {
  if (!history.length) return '';
  return `
    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>卦录</h2>
        <span class="hint">最近 ${history.length} 卦 · 点击「再看」重排此卦</span></div>
      <div class="panel glass fade-in d1">
        ${history.map((h, i) => `
          <div class="his-row">
            <span class="his-time">${h.at}</span>
            <span class="his-q">${esc(h.question || '占事')}</span>
            <span class="his-gua">${h.ben}${h.bian ? `<span class="zhuan">之</span>${h.bian}` : ''}</span>
            <div class="his-acts">
              <button class="btn ghost" data-hi="${i}" data-act="re">再看</button>
              <button class="btn ghost" data-hi="${i}" data-act="del" style="color:var(--cinnabar)">删</button>
            </div>
          </div>`).join('')}
        <div style="margin-top:12px"><button type="button" class="btn ghost" id="ly-his-clear">清空卦录</button></div>
      </div>
    </div>`;
}

async function recast(h) {
  const input = h.mode === 'yao'
    ? { beiCounts: h.beiCounts, dt: new Date(h.dt), longitude: h.lng, question: h.question }
    : h.mode === 'shu'
      ? (() => {
          const sc = shuCast(parseInt(h.shuN?.[0], 10) || 1, parseInt(h.shuN?.[1], 10) || 1, parseInt(h.shuN?.[2], 10) || 1);
          return { yao: sc.yao, movingPositions: sc.movingPositions, dt: new Date(h.dt), longitude: h.lng, question: h.question, castMode: '报数起卦', castDetail: sc.detail };
        })()
      : (() => { const tc = timeCast(new Date(h.dt), h.lng, 2, true); return { yao: tc.yao, movingPositions: tc.movingPositions, dt: new Date(h.dt), longitude: h.lng, question: h.question, castMode: '时间起卦', castDetail: tc.detail }; })();
  const r = paipan(input);
  await Promise.all([kbPromise, yjPromise]);
  const a = analyzeLiuyao(r, h.item);
  a.yingQi = yingQi(a, new Date(h.dt));
  result.innerHTML = topBarHtml() + renderResult(r, a) + historyHtml();
  result.querySelectorAll('.fade-in').forEach((el) => { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; });
  bindHistory();
  bindExport(result);
}

function bindHistory() {
  const bar = result.querySelector('#ly-again');
  if (bar) bar.addEventListener('click', () => {
    rolls = []; result.innerHTML = ''; renderCast();
    root.querySelector('.form-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  const clear = result.querySelector('#ly-his-clear');
  if (clear) clear.addEventListener('click', () => {
    history = []; try { localStorage.removeItem(HISTORY_KEY); } catch {}
    result.innerHTML = topBarHtml() + historyHtml();
    bindHistory();
  });
  result.querySelectorAll('[data-hi]').forEach((btn) => btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const i = Number(btn.dataset.hi);
    const h = history[i];
    if (!h) return;
    if (btn.dataset.act === 'del') {
      history.splice(i, 1);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch {}
      result.innerHTML = topBarHtml() + historyHtml();
      bindHistory();
      return;
    }
    await recast(h);
  }));
}

  renderCast();
}

/* ── 六冲 / 六合卦判断（《增删卜易》《卜筮正宗》口径） ──────── */

/** 六冲卦：八纯卦 + 天雷无妄 + 雷天大壮（共 10 个） */
const LIU_CHONG_SET = new Set(['乾', '坤', '震', '巽', '坎', '离', '艮', '兑', '无妄', '大壮']);
/** 六合卦：共 8 个 */
const LIU_HE_GUA_SET = new Set(['否', '泰', '夬', '履', '豫', '复', '贲', '旅']);

/**
 * 判断卦名（单字）是否为六冲卦或六合卦。
 * @param {string} name 卦名单字，如 '乾' '泰' '无妄'
 * @returns {'六冲'|'六合'|''}
 */
export function liuChongHe(name) {
  if (LIU_CHONG_SET.has(name)) return '六冲';
  if (LIU_HE_GUA_SET.has(name)) return '六合';
  return '';
}

/* ── 渲染 ─────────────────────────────────────── */

export function exportLiuyaoText(r, a) {
  const L = [];
  L.push('【玄机阁 · 六爻命书】');
  L.push(`${r.cast?.mode || '摇钱起卦'} · ${r.time?.trueSolar || ''} · ${r.question || '占事'}`);
  L.push(`本卦：${r.benGua.name}${r.benGua.fullName ? '（' + r.benGua.fullName + '）' : ''}${r.bianGua ? ` → 变卦：${r.bianGua.name}（${r.bianGua.fullName || ''}）` : ''}`);
  const _benYi = guaYi(r.benGua.name);
  if (_benYi) L.push(`本卦卦意：${_benYi}`);
  const _lch = liuChongHe(r.benGua.name);
  if (_lch === '六冲') L.push('本卦卦性：六冲（主散速，不利久持）');
  else if (_lch === '六合') L.push('本卦卦性：六合（主和合，利长久）');
  if (r.cast?.detail) {
    const d = r.cast.detail;
    const ty = meihuaTiYong(d);
    if (r.cast.mode === '报数起卦') {
      L.push(`梅花数理：所报三数 ${d.n1}、${d.n2}、${d.n3}`);
      L.push(`  上卦＝${d.n1}÷8 余 ${d.upN} → ${d.up}；下卦＝${d.n2}÷8 余 ${d.lowN} → ${d.low}；动爻＝第${d.movePos}爻`);
    } else {
      const rem = (n, mod) => (n % mod === 0 ? mod : n % mod);
      L.push(`梅花数理：${d.yearGz} ${d.monthGz} ${d.dayGz} ${d.hourGz}（${d.lunarText}）`);
      L.push(`  上卦＝年序${d.yearZhiIdx}＋月${d.lunarMonth}＋日${d.lunarDay}＝${d.upperN}（余${rem(d.upperN, 8)}）→ ${d.up}；`);
      L.push(`  下卦＝${d.upperN}＋时序${d.hourIdx}＝${d.lowerN}（余${rem(d.lowerN, 8)}）→ ${d.low}；动爻＝第${d.movePos}爻`);
    }
    if (ty) L.push(`  梅花体用：体卦${ty.ti}（${ty.tiWx}）· 用卦${ty.yong}（${ty.yongWx}）→ ${ty.level}，${ty.text}`);
  }
  L.push('六爻（自下而上）：');
  [...r.benGua.yaos].reverse().forEach((y) => {
    L.push(`  ${y.posName} ${y.liuShen} ${y.isShi ? '世' : y.isYing ? '应' : '　'} ${y.liuQin} ${y.ganzhi} ${y.wuxing}${y.moving ? ' ●动' : ''}${y.xunKong ? ' 旬空' : ''}${y.yuePo ? ' 月破' : ''}`);
  });
  if (a.ys) L.push(`用神：${a.ys.liuQin}（${a.ys.posName}）${a.ys.ganzhi} ${a.ys.wuxing} ${a.ys.wang}${a.ys.moving ? ' · 发动' : ''}${a.ys.xunKong ? ' · 旬空' : ''}${a.ys.liuShen ? ' · 临' + a.ys.liuShen : ''}`);
  const lyMoving = [...r.benGua.yaos].filter((y) => y.moving);
  if (lyMoving.length) {
    L.push('动爻直断：');
    lyMoving.forEach((y) => L.push(`  · ${y.posName}${y.liuQin}动${y.liuShen ? '·临' + y.liuShen : ''}${y.bian ? `·变出${y.bian.ganzhi}${y.bian.huiTou?.name ? `（${y.bian.huiTou.name}）` : ''}` : ''}：${DONGQIN_MEANING[y.liuQin] || ''}`));
  }
  L.push(`六神主事：${[...r.benGua.yaos].map((y) => `${y.posName}${y.liuShen || '—'}`).join('、')}`);
  if (a.shiYingText) L.push(`世应：${a.shiYingText}`);
  if (a.duanyu?.length) {
    L.push('断语：');
    a.duanyu.forEach((d) => L.push(`  · ${d.text}（${d.source}）`));
  }
  if (a.yingQi?.length) {
    L.push('应期参考（仅供参考）：');
    a.yingQi.forEach((y) => L.push(`  · ${y.ganzhi} ${y.date} · ${y.desc}`));
  }
  const hlNow = todayHuangli();
  L.push(`今日黄历：${hlNow.solarText.slice(0, 10)} ${hlNow.dgz}日 · 建除${hlNow.name}（${hlNow.level}）· 宜${hlNow.yi.slice(0, 4).join('/') || '诸事不宜'} · 忌${hlNow.ji.join('/') || '无'}`);
  L.push('—— 玄机阁离线推演 · 问卦宜诚，成事在人。');
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
  const btn = root.querySelector('#ly-export');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (!LAST_LY) return;
    copyText(LAST_LY).then(() => {
      btn.textContent = '已 复 制';
      setTimeout(() => { btn.textContent = '复 制 命 书'; }, 1600);
    });
  });
}

function bindShare(root) {
  const btn = root.querySelector('#ly-share');
  if (!btn || !LAST_CAST) return;
  btn.addEventListener('click', () => {
    const c = LAST_CAST;
    const params = c.mode === 'time'
      ? `t=${encodeURIComponent(c.t)}&lng=${c.lng}&item=${encodeURIComponent(c.item)}&q=${encodeURIComponent(c.q)}`
      : `n=${c.n.join(',')}&lng=${c.lng}&item=${encodeURIComponent(c.item)}&q=${encodeURIComponent(c.q)}`;
    const url = `${location.origin}${location.pathname}#/liuyao?${params}`;
    copyText(url).then(() => {
      btn.textContent = '已 复 制';
      setTimeout(() => { btn.textContent = '复 制 卦 象 链 接'; }, 1600);
    });
  });
}

const HT_CLS = { '回头生': 'good', '化进神': 'good', '回头克': 'bad', '化退神': 'bad', '化伏吟': 'bad', '化泄气': 'mid', '化耗气': 'mid' };

function guaLines(gua, opts = {}) {
  const htMap = opts.huiTouMap || {};
  const rev = [...gua.yaos].reverse();
  return rev.map((y, ri) => {
    const i = gua.yaos.length - 1 - ri; // 原始索引（0=初爻）
    const ht = htMap[i];
    const lineCls = `yao-line ${y.yinYang === '阳' ? 'yang' : 'yin'}${y.moving ? ' moving' : ''}`;
    const flag = y.isShi ? '世' : y.isYing ? '应' : y.moving ? '动' : '';
    const tip = [y.posName, y.liuShen ? `${y.liuShen}` : '', y.liuQin ? `${y.liuQin}` : '', y.moving ? '动' : ''].filter(Boolean).join(' · ');
    const htHtml = ht ? `<span class="yd-ht ${HT_CLS[ht.name] || 'mid'}" title="${esc(ht.desc)}${ht.chongDesc ? '；' + esc(ht.chongDesc) : ''}">${esc(ht.name)}</span>` : '';
    return `
      <div class="yao-row" title="${esc(tip)}">
        <span class="yd-shen">${y.liuShen ? esc(y.liuShen) : ''}</span>
        <div class="${lineCls}"></div>
        <span class="yd-qin">${y.liuQin ? esc(y.liuQin) : ''}</span>
        ${htHtml}
        <span class="yd-flag${flag ? '' : ' empty'}">${flag}</span>
      </div>`;
  }).join('');
}

function guaCard(gua, title, sub, opts = {}) {
  if (!gua) return '';
  const movingN = gua.yaos.filter((y) => y.moving).length;
  return `
    <div class="gua-card fade-in">
      <div class="gua-name">${title || ''} ${gua.fullName || gua.name || '—'}<small>${sub || ''}</small></div>
      ${guaLines(gua, opts)}
      <div style="font-size:12px;color:var(--text-dim);margin-top:8px">${movingN ? `${movingN} 爻动` : '安静卦'}</div>
    </div>`;
}

function meihuaHtml(d, benName, bianName) {
  const rem = (n, mod) => (n % mod === 0 ? mod : n % mod);
  const rawMove = d.lowerN % 6;
  const moveTxt = rawMove === 0 ? '整除（取 6）' : `余 ${rawMove}`;
  const ty = meihuaTiYong(d);
  const tyHtml = ty ? `
    <div class="meihua-tiyong">
      <span class="mt-role">体卦 <b>${ty.ti}</b><small>${ty.tiWx}</small></span>
      <span class="mt-op">相</span>
      <span class="mt-role">用卦 <b>${ty.yong}</b><small>${ty.yongWx}</small></span>
      <span class="mt-judge ${ty.cls}">${ty.level} · ${ty.text}</span>
    </div>` : '';
  return `
    <div class="panel glass fade-in d1">
      <div class="meihua-ctx">起卦时刻 <b>${esc(d.lunarText)}</b> · 四柱 <b>${esc(d.yearGz)} ${esc(d.monthGz)} ${esc(d.dayGz)} ${esc(d.hourGz)}</b><span class="hint">${esc(d.solarText)}</span></div>
      <div class="meihua-grid">
        <div class="meihua-step">
          <div class="ms-k">① 取数</div>
          <div class="ms-row"><span>年支 <b class="ms-zhi">${esc(d.yearGz[1])}</b></span><span>序 <b>${d.yearZhiIdx}</b></span></div>
          <div class="ms-row"><span>农历月</span><span><b>${d.lunarMonth}</b></span></div>
          <div class="ms-row"><span>农历日</span><span><b>${d.lunarDay}</b></span></div>
          <div class="ms-row"><span>时支 <b class="ms-zhi">${esc(d.hourZhi)}</b></span><span>序 <b>${d.hourIdx}</b></span></div>
        </div>
        <div class="meihua-step">
          <div class="ms-k">② 上卦</div>
          <div class="ms-formula">年序 ${d.yearZhiIdx} ＋ 月 ${d.lunarMonth} ＋ 日 ${d.lunarDay} ＝ <b>${d.upperN}</b></div>
          <div class="ms-formula">${d.upperN} ÷ 8 余 <b>${rem(d.upperN, 8)}</b> → 先天数</div>
          <div class="ms-result">上卦 <b class="ms-up">${d.up}</b></div>
        </div>
        <div class="meihua-step">
          <div class="ms-k">③ 下卦</div>
          <div class="ms-formula">上卦和 ${d.upperN} ＋ 时序 ${d.hourIdx} ＝ <b>${d.lowerN}</b></div>
          <div class="ms-formula">${d.lowerN} ÷ 8 余 <b>${rem(d.lowerN, 8)}</b> → 先天数</div>
          <div class="ms-result">下卦 <b class="ms-low">${d.low}</b></div>
        </div>
        <div class="meihua-step">
          <div class="ms-k">④ 动爻</div>
          <div class="ms-formula">总和 ${d.lowerN} ÷ 6，${moveTxt}</div>
          <div class="ms-result">第 <b class="ms-move">${d.movePos}</b> 爻动</div>
        </div>
      </div>
      <div class="meihua-note">上卦 <b>${d.up}</b> 下卦 <b>${d.low}</b> 合成本卦 <b>${benName || ''}</b>，第 ${d.movePos} 爻动${bianName ? ` → 变卦 <b>${bianName}</b>` : ''}。梅花以「数」起卦，六爻以「象」断事，数定而象生。</div>
      ${tyHtml}
    </div>`;
}

function shuHtml(d, benName, bianName) {
  const ty = meihuaTiYong(d);
  const tyHtml = ty ? `
    <div class="meihua-tiyong">
      <span class="mt-role">体卦 <b>${ty.ti}</b><small>${ty.tiWx}</small></span>
      <span class="mt-op">相</span>
      <span class="mt-role">用卦 <b>${ty.yong}</b><small>${ty.yongWx}</small></span>
      <span class="mt-judge ${ty.cls}">${ty.level} · ${ty.text}</span>
    </div>` : '';
  return `
    <div class="panel glass fade-in d1">
      <div class="meihua-ctx">所报三数 <b>${esc(String(d.n1))} · ${esc(String(d.n2))} · ${esc(String(d.n3))}</b><span class="hint">数字起卦 · 先天数 1乾 2兑 3离 4震 5巽 6坎 7艮 8坤</span></div>
      <div class="meihua-grid">
        <div class="meihua-step">
          <div class="ms-k">① 取数</div>
          <div class="ms-row"><span>第一数</span><span><b>${esc(String(d.n1))}</b></span></div>
          <div class="ms-row"><span>第二数</span><span><b>${esc(String(d.n2))}</b></span></div>
          <div class="ms-row"><span>第三数</span><span><b>${esc(String(d.n3))}</b></span></div>
        </div>
        <div class="meihua-step">
          <div class="ms-k">② 上卦</div>
          <div class="ms-formula">${d.n1} ÷ 8 余 <b>${d.upN}</b> → 先天数</div>
          <div class="ms-result">上卦 <b class="ms-up">${d.up}</b></div>
        </div>
        <div class="meihua-step">
          <div class="ms-k">③ 下卦</div>
          <div class="ms-formula">${d.n2} ÷ 8 余 <b>${d.lowN}</b> → 先天数</div>
          <div class="ms-result">下卦 <b class="ms-low">${d.low}</b></div>
        </div>
        <div class="meihua-step">
          <div class="ms-k">④ 动爻</div>
          <div class="ms-formula">${d.n3} ÷ 6 余 <b>${d.moveN}</b></div>
          <div class="ms-result">第 <b class="ms-move">${d.movePos}</b> 爻动</div>
        </div>
      </div>
      <div class="meihua-note">上卦 <b>${d.up}</b> 下卦 <b>${d.low}</b> 合成本卦 <b>${benName || ''}</b>，第 ${d.movePos} 爻动${bianName ? ` → 变卦 <b>${bianName}</b>` : ''}。心诚数灵，数随心动。</div>
      ${tyHtml}
    </div>`;
}

export function renderResult(r, a) {  const ben = r.benGua;
  const bian = r.bianGua;
  const t = r.time;
  const dc = r.dayChen;

  const yaoRows = [...ben.yaos].reverse().map((y) => {
    const shenIdx = r.liuShen.indexOf(y.liuShen);
    return `<tr>
      <td class="guizhou">${y.posName}</td>
      <td>${y.liuShen}</td>
      <td>${y.isShi ? '<b style="color:var(--cinnabar)">世</b>' : ''}${y.isYing ? '<b style="color:var(--gold)">应</b>' : ''}</td>
      <td>${y.liuQin}</td>
      <td class="guizhou">${y.ganzhi}</td>
      <td>${y.wuxing}</td>
      <td class="${y.moving ? 'moving' : ''}">${y.moving ? '●' + y.yaoCi?.title?.slice(0, 4) || '' : ''}</td>
      <td>${y.moving && y.bian ? `<span class="zhufu">${y.bian.ganzhi}</span> ${y.bian.liuQin} <small style="color:var(--text-faint)">${y.bian.huiTou?.name || ''}</small>` : ''}</td>
      <td>${y.xunKong ? '空' : ''}${y.yuePo ? '破' : ''}</td>
    </tr>`;
  }).join('');

  const fuHtml = r.fuShen.length ? r.fuShen.map((f) => `
    <div class="ss-chip" style="margin-bottom:0">${f.liuQin}：伏 ${f.fu.ganzhi} <span style="color:var(--text-dim)">${f.fu.posName}</span>
      于 <b>${f.fei.ganzhi}</b>${f.relation === '生我' ? ' · 飞生伏' : f.relation === '我克' ? ' · 飞克伏（伏难出）' : f.relation === '克我' ? ' · 伏克飞（出暴）' : ''}</div>`).join('')
    : '<p class="sub">六亲俱全，无伏神。</p>';

  const wangBar = (s) => {
    const n = Math.max(0, Math.min(5, Math.round(((s + 3) / 8) * 5)));
    return `<span class="wang-bar" title="旺衰分 ${s}">${'<i class="wb-on"></i>'.repeat(n)}${'<i class="wb-off"></i>'.repeat(5 - n)}</span>`;
  };
  const causeChips = (causes) => (causes || []).map((c) =>
    `<span class="cause-chip ${c.bad ? 'bad' : 'good'}" title="${c.n >= 0 ? '加分' : '减分'} ${c.n >= 0 ? '+' : ''}${c.n}">${c.t}<em>${c.n >= 0 ? '+' : ''}${c.n}</em></span>`).join('')
    || '<span class="cause-chip">日月同气</span>';
  const ysJudge = a.ys ? (
    a.ys.xunKong ? '用神旬空，事缓则圆——待出空再议。'
    : a.ys.yuePo ? '用神月破，暂勿强动——待出破（逢合）转机。'
    : a.ys.wang === '旺相' ? '用神得气，事可图谋——逢值逢合之机而应。'
    : a.ys.wang === '中和' ? '用神中和，吉凶凭事——见机而行，不疾不徐。'
    : a.ys.wang === '休囚' ? '用神休囚，力有不逮——宜待时，逢生扶之日可图。'
    : '用神衰绝，气数已微——慎勿强求，守成为上。'
  ) : '';

  const ysInfo = a.ys ? `
    <div class="info-card fade-in"><div class="k">用神 · 旺衰</div>
      <div class="v gold">${a.ys.liuQin} <span style="font-size:13px;color:var(--text-dim)">${a.ys.posName}</span></div>
      <div class="d">${a.ys.ganzhi} ${a.ys.wuxing} · ${a.ys.wang}（${a.ys.score >= 0 ? '+' : ''}${a.ys.score}）
        ${a.ys.moving ? '· 发动' : ''}${a.ys.xunKong ? '· 旬空' : ''}${a.ys.yuePo ? '· 月破' : ''}${a.ys.huiTou ? `· ${a.ys.huiTou}` : ''}</div>
      <div class="wang-row">${wangBar(a.ys.score)}<span class="wang-txt">${a.ys.wang}</span></div>
      <div class="cause-chips">${causeChips(a.ys.causes)}</div>
      ${a.ys.liuShen && LIU_SHEN_MEANING[a.ys.liuShen] ? `<div class="ys-shen"><b>用神临${a.ys.liuShen}</b>${LIU_SHEN_MEANING[a.ys.liuShen]}</div>` : ''}
      ${ysJudge ? `<div class="ys-judge ${a.ys.wang === '旺相' || a.ys.wang === '中和' ? 'good' : 'warn'}">${ysJudge}</div>` : ''}</div>`
    : `<div class="info-card fade-in"><div class="k">用神</div><div class="v">卦中未现</div>
        <div class="d">看伏神或取世爻为用。</div></div>`;

  const shiYing = a.shiYingText ? `
    <div class="info-card fade-in"><div class="k">世应关系</div>
      <div class="v">${a.shiYingText}</div>
      <div class="d">世 ${a.shi?.ganzhi}（${a.shi?.liuQin}） vs 应 ${a.ying?.ganzhi}（${a.ying?.liuQin}）</div></div>` : '';

  const yuanJi = `
    <div class="info-card fade-in"><div class="k">原神 / 忌神</div>
      <div class="v" style="font-size:15px">${a.yuan ? `<span class="good">原神 ${a.yuan.liuQin}</span> <small class="dim">${a.yuan.ganzhi} ${a.yuan.wang}${wangBar(a.yuan.score)}</small>` : '原神不现'} ${a.ji ? `<span style="color:var(--cinnabar)">· 忌神 ${a.ji.liuQin}</span> <small class="dim">${a.ji.ganzhi} ${a.ji.wang}${wangBar(a.ji.score)}</small>` : ''}</div>
      <div class="d">原神生用神为吉，忌神克用神为忧；${a.ji?.moving ? '忌神发动，须防' : '忌神安静，可缓'}</div></div>`;

  const duanyuHtml = a.duanyu.length
    ? a.duanyu.map((d) => `<div class="duanyu fade-in"><span class="q">${d.text}</span><span class="src">${d.source}</span></div>`).join('')
    : '<div class="tip fade-in">此卦特征未落入古籍断语条目，请结合用神旺衰与事体自行参详。</div>';

  const movingYaos = [...ben.yaos].filter((y) => y.moving);
  const yaociSection = movingYaos.length ? `
    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>动爻爻辞</h2>
        <span class="hint">本卦动爻爻辞 · 依《周易》原文，供参详</span></div>
      <div class="duanyu-list">${movingYaos.map((y) => `
        <div class="duanyu fade-in">
          <span class="q">${y.posName} ${y.yaoTi || ''}：${y.yaoCi || '爻辞暂缺'}</span>
          <span class="src">本卦</span>
        </div>`).join('')}</div>
    </div>` : '';

  const yingQiHtml = a.yingQi?.length ? `
    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>应期参考</h2>
        <span class="hint">逢值逢合 · 出空出破 · 忌神受制 · 仅作参考不作准话</span></div>
      <div class="panel glass fade-in d1">
        <div style="display:grid;gap:10px">${a.yingQi.map((y) => `
          <div class="yingqi-row">
            <span class="yq-gz">${y.ganzhi}</span>
            <span class="yq-date">${y.date}<small>（${y.offset} 天后）</small></span>
            <span class="yq-desc">${esc(y.desc)}</span>
          </div>`).join('')}
        </div>
        <div class="meihua-note" style="margin-top:12px">应期为「可能的时间窗口」而非准确日期，事体缓急与当下机缘当为准绳。</div>
      </div>
    </div>` : '';

  LAST_LY = exportLiuyaoText(r, a);
  return `
    <div class="hl-mini-row fade-in">${huangliMiniHtml()}</div>
    <div class="export-bar fade-in">
      <span class="hint">命书可一键复制为文本，便于存档与分享</span>
      <button type="button" class="btn ghost" id="ly-export">复 制 命 书</button>
    </div>
    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>卦象</h2>
        <span class="hint">${r.cast?.mode || ''} · ${t.trueSolar}</span></div>
      <div class="panel glass fade-in d1">
        <div class="gua-row">
          ${(() => { const ht = {}; ben.yaos.forEach((y, i) => { if (y.bian && y.bian.huiTou) ht[i] = y.bian.huiTou; }); return `
          ${guaCard(ben, '本卦', `${ben.upperInfo.nature}上${ben.lowerInfo.nature}下 · ${ben.palace}宫${ben.rank}世${ben.shiPos}应${ben.yingPos}`)}
          ${bian ? guaCard(bian, '变卦', `${bian.upperInfo.nature}上${bian.lowerInfo.nature}下`, { huiTouMap: ht }) : ''}`; })()}
          <div style="align-self:center">
            ${r.huGua && r.huGua.name !== r.benGua.name ? `<div class="gua-card" style="margin-bottom:10px"><div class="gua-name" style="font-size:16px">互卦 ${r.huGua.fullName || r.huGua.name || ''}<small>${r.huGua.upperInfo.nature}上${r.huGua.lowerInfo.nature}下 · 互见中节</small></div>${guaLines(r.huGua)}${r.huGua.guaCi ? `<div class="gua-ci"><b>互卦卦辞</b>：${r.huGua.guaCi}</div>` : ''}</div>` : ''}
            ${r.cuoGua ? `<div class="gua-card" style="margin-bottom:10px"><div class="gua-name" style="font-size:16px">错卦 ${r.cuoGua.fullName || r.cuoGua.name || ''}<small>六爻全反 · 观其对立</small></div>${guaLines(r.cuoGua)}</div>` : ''}
            ${r.zongGua && r.zongGua.name !== r.benGua.name ? `<div class="gua-card"><div class="gua-name" style="font-size:16px">综卦 ${r.zongGua.fullName || r.zongGua.name || ''}<small>反覆之象 · 观事之来去</small></div>${guaLines(r.zongGua)}</div>` : ''}
          </div>
        </div>
        ${(() => {
          const lch = liuChongHe(ben.name);
          const guaLabel = esc(ben.fullName || ben.name);
          if (lch === '六冲') return `<div class="gua-lc lc-chong"><b>本卦六冲卦</b>（<span>${guaLabel}</span>）——主散、主速、不利久持：占婚占病占谋长远之事宜慎，宜速断速行勿拖延；测行役开张等散事则利。</div>`;
          if (lch === '六合') return `<div class="gua-lc lc-he"><b>本卦六合卦</b>（<span>${guaLabel}</span>）——主合、主和、主长久：占婚占谋和顺易成，唯测病讼嫌其缠绵不决。</div>`;
          return '';
        })()}
        ${ben.guaCi ? `<div class="tip" style="margin-top:16px"><b>本卦卦辞：</b>${ben.guaCi}</div>` : ''}
        ${(() => { const yi = guaYi(ben.name); return yi ? `<div class="gua-yi tip" style="margin-top:8px;color:var(--gold)"><b>卦意 · 一句话</b>：${esc(yi)}</div>` : ''; })()}
        ${bian && bian.guaCi && bian.name !== ben.name ? `<div class="tip" style="margin-top:8px"><b>变卦卦辞：</b>${bian.guaCi}</div>` : ''}
        ${bian && bian.name !== ben.name ? (() => { const yi = guaYi(bian.name); return yi ? `<div class="gua-yi tip" style="margin-top:8px;color:var(--gold)"><b>变卦卦意 · 一句话</b>：${esc(yi)}</div>` : ''; })() : ''}
        ${r.zongGua && r.zongGua.guaCi && r.zongGua.name !== ben.name ? `<div class="tip" style="margin-top:8px;color:var(--gold)"><b>综卦卦辞：</b>${r.zongGua.guaCi}<span class="hint" style="margin-left:6px">反覆颠倒看，观事态之来去往复</span></div>` : ''}
        ${ben.yaos.some((y) => y.yaoCi) ? `<div class="tip" style="margin-top:8px;color:var(--gold)"><b>爻辞提示：</b>动爻爻辞详见下方「动爻爻辞」。</div>` : ''}
      </div>
    </div>

    ${r.cast?.detail ? `
    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>梅花数理推导</h2>
        <span class="hint">梅花易数 · ${r.cast.mode === '报数起卦' ? '数字起卦法' : '年月日时起卦法'}，一步一算见其所以然</span></div>
      ${r.cast.mode === '报数起卦' ? shuHtml(r.cast.detail, ben.fullName, bian?.fullName) : meihuaHtml(r.cast.detail, ben.fullName, bian?.fullName)}
    </div>` : ''}

    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>装卦明细</h2>
        <span class="hint">日辰 ${dc.ganzhi} · 旬空 ${dc.xunKong.join(' ')} · 月建 ${dc.monthZhi} · 月破 ${dc.yuePo}</span></div>
      <div class="panel glass fade-in d1" style="overflow-x:auto">
        <table class="yao-table">
          <thead><tr><th>爻</th><th>六神</th><th>世应</th><th>六亲</th><th>纳甲</th><th>五行</th><th>动</th><th>变爻</th><th>空破</th></tr></thead>
          <tbody>${yaoRows}</tbody>
        </table>
      </div>
    </div>
    ${yaociSection}
    ${dongyaoHtml(r, a)}
    ${liuShenYaoLan(r)}

    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>用神参详</h2>
        <span class="hint">${a.label}</span></div>
      <div class="grid-cards">${ysInfo}${yuanJi}${shiYing}</div>
      ${a.movingCount ? `<div class="tip" style="margin-top:14px">全卦 ${a.movingCount} 爻动${a.movingCount >= 5 ? '，六爻乱动事难明，须向用神看' : ''}。</div>` : ''}
      ${r.fuShen.length ? `<div class="panel glass fade-in d1" style="margin-top:14px"><b style="font-size:13px;color:var(--text-dim)">伏神</b><div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:10px">${fuHtml}</div></div>` : ''}
    </div>

    ${yingQiHtml}
    ${liuQinTableHtml()}
    ${liuyaoTermsHtml()}
    ${duanGuaKoujueHtml()}
    ${anShiYingHtml(r)}
    ${baguaLeixiangHtml()}
    ${wuxingTableHtml()}
    ${najiaTableHtml()}
    ${guaMingGridHtml()}
    ${yueJianTableHtml()}
    ${meihuaQiGuaHtml()}

    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>古籍断语</h2>
        <span class="hint">依《增删卜易》《卜筮正宗》《火珠林》 · 作参考提示</span></div>
      <div class="duanyu-list">${duanyuHtml}</div>
    </div>

    <div class="section">
      <div class="section-head"><span class="tick"></span><h2>排盘说明</h2></div>
      <div class="panel glass fade-in d1">
        <ul style="list-style:none;display:grid;gap:8px;font-size:13px;color:var(--text-dim)">
          ${r.notes.map((n) => `<li>· ${n}</li>`).join('')}
        </ul>
      </div>
    </div>

    <div class="section">
      <div class="tip fade-in">断语与旺衰均出自传统框架的规则化推演，供参详而不作判决。问卦宜诚，成事在人。</div>
    </div>
  `;
}
