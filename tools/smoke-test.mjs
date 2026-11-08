/**
 * smoke-test.mjs —— 结构冒烟测试（不含任何真实出生数据）
 *
 * 目的：确认三大引擎与渲染函数能正常工作、数据文件齐全。
 * 开发期曾有一整套以固定命盘为基准的回归脚本，因含真实出生时间不入库；
 * 这里的断言只依赖结构，不依赖具体某个人的命盘。
 *
 * 用法：node tools/smoke-test.mjs
 */
import { analyze as baziAnalyze, setKnowledge as setBaziKB, NAYIN } from '../frontend/js/engine/bazi-analyze.js';
import { paipan as ziweiPaipan } from '../frontend/js/engine/ziwei.js';
import { renderResult as ziweiRender, setKnowledge as setZiweiKB } from '../frontend/js/app/ziwei.js';
import { timeCast, paipan as lyPaipan, setYijingData } from '../frontend/js/engine/liuyao.js';
import { analyze as lyAnalyze, setKnowledge as setLyKB, setYijingForAnalyze } from '../frontend/js/engine/liuyao-analyze.js';
import { renderResult as baziRender } from '../frontend/js/app/bazi.js';
import { renderResult as lyRender } from '../frontend/js/app/liuyao.js';
import BKB from '../frontend/data/knowledge-bazi.json' with { type: 'json' };
import LKB from '../frontend/data/knowledge-liuyao.json' with { type: 'json' };
import ZKB from '../frontend/data/knowledge-ziwei.json' with { type: 'json' };
import YJ from '../frontend/data/yijing64.json' with { type: 'json' };
import BRI from '../frontend/data/ziwei-brightness.json' with { type: 'json' };

setBaziKB(BKB);
setZiweiKB(ZKB);
setLyKB(LKB);
setYijingData(YJ);
setYijingForAnalyze(YJ);

let pass = 0, fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${detail}`); }
};

// 中性示例时刻，仅用于结构验证
const date = new Date(2020, 5, 15, 12, 0, 0);

console.log('\n【八字引擎】');
const b = baziAnalyze({ date, gender: '男' });
check('四柱齐全', ['year', 'month', 'day', 'time'].every((k) => typeof b.ganzhi[k] === 'string' && b.ganzhi[k].length === 2), JSON.stringify(b.ganzhi));
check('五行权重均为非负整数', Object.values(b.wuxingCount).every((x) => Number.isInteger(x) && x >= 0), JSON.stringify(b.wuxingCount));
check('日主为单字天干', typeof b.dayGan === 'string' && b.dayGan.length === 1, b.dayGan);
check('旺衰取值为 强/弱', ['强', '弱', '中和'].includes(b.strength), b.strength);
check('大运序列非空', Array.isArray(b.daYun) && b.daYun.length >= 8, String(b.daYun?.length));
check('起运信息完整', b.qiYun && b.qiYun.startYear > 0, JSON.stringify(b.qiYun));
check('神煞为数组', Array.isArray(b.shensha), typeof b.shensha);
check('纳音表非空', Object.keys(NAYIN).length === 60, String(Object.keys(NAYIN).length));

console.log('\n【紫微引擎】');
const z = ziweiPaipan({ date, gender: '男', brightness: BRI });
const palaces = z.palaces || [];
check('十二宫齐全', palaces.length === 12, String(palaces.length));
check('每宫有宫名与干支', palaces.every((p) => p.name && p.gan && p.zhi), '');
check('五行局存在', typeof z.fiveElements === 'string' && z.fiveElements.length > 0, JSON.stringify(z.fiveElements));

console.log('\n【六爻引擎】');
const t = timeCast(date);
check('时间起卦得到六爻', Array.isArray(t.yao) && t.yao.length === 6, String(t.yao?.length));
const cast = lyPaipan({ beiCounts: [3, 3, 3, 3, 3, 3], dt: date, longitude: 120, question: '结构冒烟' });
check('摇卦得到本卦名', typeof cast.benGua?.fullName === 'string' && cast.benGua.fullName.length > 0, cast.benGua?.fullName);
check('六爻皆动识别正确', cast.movingPositions.length === 6, JSON.stringify(cast.movingPositions));
const ly = lyAnalyze(cast, '事业');
check('六爻分析返回对象', ly && typeof ly === 'object', '');

console.log('\n【渲染】');
const bHtml = baziRender(b, { name: '示例', useTrue: false, lng: 120, tstInfo: null });
check('八字 HTML 含四柱容器', bHtml.includes('class="pillars"'));
check('八字 HTML 含古籍断语区', bHtml.includes('class="duanyu-list"'));
check('八字 HTML 含免责口径', bHtml.includes('当雷达，不当牢笼'));
const zHtml = ziweiRender(z, { name: '示例', useTrue: false, lng: 120, tst: null });
check('紫微 HTML 含十二宫容器', zHtml.includes('class="palace-grid"'));
const lyHtml = lyRender(cast, ly);
check('六爻 HTML 非空', typeof lyHtml === 'string' && lyHtml.length > 100, String(lyHtml?.length));

console.log('\n【数据文件】');
check('八字断语库非空', Array.isArray(BKB.duanyu) && BKB.duanyu.length > 0, String(BKB.duanyu?.length));
check('六爻知识库非空', Object.keys(LKB).length > 0, '');
check('紫微知识库非空', Object.keys(ZKB).length > 0, '');
check('六十四卦齐全', Array.isArray(YJ.hexagrams) && YJ.hexagrams.length === 64, String(YJ.hexagrams?.length));

console.log(`\n========== 冒烟测试: ${pass} 通过 / ${fail} 失败 ==========`);
process.exit(fail ? 1 : 0);
