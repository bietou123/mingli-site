# 玄机阁 · 离线命理推演

八字排盘、六爻起卦、紫微斗数三套引擎，加本地命主档案管理。排盘全部在浏览器里离线计算，后端只负责静态托管与 SQLite 档案存取，不调用任何外部接口、不上传任何数据。

纯前端 **原生 JavaScript**（无框架、无构建步骤）＋ **FastAPI + SQLite** 后端，一条 `start.bat` / `start.sh` 即可跑起来，也可以直接双击 `frontend/index.html` 使用离线功能。

## 功能

### 八字

- 四柱排盘（支持真太阳时、经度校正）
- 天干地支、藏干、十神标注、透干通根
- 五行统计与旺衰判级、月令得令/失令、格局判定
- 用神（扶抑 + 调候）、喜用趋吉指南（颜色/方位/行业）
- 大运起运与十步大运、流年十神、岁运互动（五合/三合/六害/相刑/伏吟）
- 神煞一览（19 项，标注落在哪一柱）、纳音、胎元/命宫/身宫三命详解
- 未来 12 年走势评分、古籍断语库匹配

### 六爻

- 手摇（三枚铜钱）、按时间起卦、数字起卦，支持变卦
- 纳甲装卦、安世应、六神、旬空
- 动爻直断、六冲六合、用神/原神/忌神旺衰打分
- 应期推算、卦辞/爻辞原文、梅花体用

### 紫微斗数

- 十二宫排盘、十四主星与辅星、庙旺落陷矩阵
- 四化飞星与四化落宫意象、三方四正
- 大限/流年、星曜一览、安星口诀

### 其他

- 今日黄历：建除十二神、彭祖百忌、十二时辰吉凶、宜忌
- 命主档案：新增/编辑/删除、JSON 备份导入导出、分享链接
- PWA：断网可用（Service Worker 缓存），移动端自适应
- 所有页面的结论附「当雷达，不当牢笼」口径提示

## 快速开始

需要 Python 3.10+。无需 Node.js。

**Windows**：双击 `start.bat`，浏览器打开 <http://127.0.0.1:8090>。

**Linux / NAS**：

```bash
chmod +x start.sh && ./start.sh
```

首次运行会自动 `pip install -r backend/requirements.txt`（fastapi、uvicorn）。

只想用排盘、不需要档案功能时，也可以直接双击 `frontend/index.html`——引擎和页面都是纯前端的。

## 目录结构

```
backend/            FastAPI 服务：静态托管 + 档案 REST API + SQLite
frontend/
  index.html        SPA 入口（hash 路由）
  js/app/           页面层：home / bazi / liuyao / ziwei / profiles
  js/engine/        计算引擎：bazi-analyze / ziwei / liuyao(-analyze) / calendar / lunar
  data/             断语库、六十四卦原文、庙旺落陷表
  css/  sw.js  manifest.webmanifest
tools/smoke-test.mjs  结构冒烟测试
```

## 后端 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/profiles` | 档案列表 |
| POST | `/api/profiles` | 新建档案 |
| PUT | `/api/profiles/{id}` | 修改档案 |
| DELETE | `/api/profiles/{id}` | 删除档案 |
| GET | `/api/export` | 导出全部档案 |
| POST | `/api/import` | 导入档案（按姓名+时间判重） |

数据库文件 `backend/mingli.db` 首次运行自动创建，已在 `.gitignore` 中。

## 测试

```bash
node tools/smoke-test.mjs
```

引擎对 CPU 无依赖，但需要 Node.js 18+（使用 JSON import attributes）。冒烟测试用中性示例时刻做结构断言，24 项全部通过。

> 开发期另有一套以固定命盘为基准的逐项回归脚本（干支、神煞、大运、应期等逐条对照第三方排盘结果），因为基准里含真实出生时间，不随仓库发布。

## 隐私

- 排盘与断语全部在本地浏览器计算
- 档案只写入本机 SQLite，导出文件由用户自己保管
- 前端不加载任何第三方脚本、字体 CDN 或统计代码

## 免责

命理内容属于传统文化与概率性参考，不构成医疗、法律、投资或人生决策建议。「预测当雷达，不当牢笼」。

## 许可

MIT License，见 [LICENSE](LICENSE)。
