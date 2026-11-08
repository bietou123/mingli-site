/* app/profiles.js —— 命主档案（FastAPI + SQLite CRUD） */
import { analyze as bzAnalyze, setKnowledge as bzSetKnowledge } from '../engine/bazi-analyze.js';
import { paipan as zwPaipan } from '../engine/ziwei.js';
import { exportText as bzExportText } from './bazi.js';
import { exportText as zwExportText } from './ziwei.js';

const API = '/api/profiles';

let EDIT_ID = null;

export const template = `
  <section class="page-head fade-in">
    <h1>我的 <em>·</em> 档案</h1>
    <p>保存常用命主，一键重排八字 / 紫微</p>
  </section>

  <section class="form-panel glass fade-in d1">
    <div class="section-head" style="margin-bottom:14px"><span class="tick"></span><h2 id="pf-form-title">新增档案</h2></div>
    <form id="pf-form" class="form-grid" autocomplete="off">
      <div class="field">
        <label>姓名 / 称呼 *</label>
        <input type="text" id="pf-name" required maxlength="20" placeholder="例：命主">
      </div>
      <div class="field">
        <label>出生时间（公历）*</label>
        <input type="datetime-local" id="pf-datetime" required step="60" value="1990-01-01T08:00">
      </div>
      <div class="field">
        <label>性别</label>
        <select id="pf-gender"><option value="男" selected>男</option><option value="女">女</option></select>
      </div>
      <div class="field">
        <label>经度（东经）</label>
        <input type="number" id="pf-lng" value="120" min="73.5" max="135" step="0.01">
      </div>
      <div class="field" style="grid-column:1/-1">
        <label>备注</label>
        <input type="text" id="pf-note" maxlength="60" placeholder="可选：亲友称谓、出生地等">
      </div>
      <div class="form-actions">
        <button type="submit" class="btn" id="pf-save">保 存</button>
        <button type="button" class="btn ghost" id="pf-cancel" style="display:none">取 消</button>
      </div>
    </form>
  </section>

  <div class="panel glass fade-in d1" style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:16px">
    <span style="font-size:13px;color:var(--text-dim)">档案存于本机后端 SQLite · 可一键导出备份 / 导入恢复</span>
    <div style="display:flex;gap:8px;align-items:center">
      <button type="button" class="btn ghost" id="pf-export" style="padding:8px 16px;font-size:13px">导 出 备 份</button>
      <button type="button" class="btn ghost" id="pf-import" style="padding:8px 16px;font-size:13px">导 入 备 份</button>
      <input type="file" id="pf-file" accept="application/json,.json" style="display:none">
    </div>
  </div>

  <div id="pf-list"></div>
`;

export function mounted(root) {
  const form = root.querySelector('#pf-form');
  const listEl = root.querySelector('#pf-list');
  const titleEl = root.querySelector('#pf-form-title');
  const cancelBtn = root.querySelector('#pf-cancel');

  const kbPromise = fetch(new URL('../../data/knowledge-bazi.json', import.meta.url))
    .then((r) => r.json()).then((d) => bzSetKnowledge(d)).catch(() => {});

  async function api(url, opt) {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opt });
    if (!res.ok) {
      let msg = `请求失败（${res.status}）`;
      try { msg = (await res.json()).detail || msg; } catch {}
      throw new Error(msg);
    }
    return res.status === 204 ? null : res.json();
  }

  function fill(sel) {
    root.querySelector('#pf-name').value = sel.name;
    root.querySelector('#pf-datetime').value = sel.datetime;
    root.querySelector('#pf-gender').value = sel.gender;
    root.querySelector('#pf-lng').value = sel.longitude;
    root.querySelector('#pf-note').value = sel.note || '';
  }

  function resetForm() {
    form.reset();
    root.querySelector('#pf-datetime').value = '1990-01-01T08:00';
    EDIT_ID = null;
    titleEl.textContent = '新增档案';
    cancelBtn.style.display = 'none';
  }

  async function load() {
    listEl.innerHTML = `<div class="panel glass fade-in" style="text-align:center"><p class="sub">读取档案…</p></div>`;
    let items;
    try { items = await api(API); }
    catch (e) {
      listEl.innerHTML = `<div class="tip red fade-in">档案服务不可用：${e.message}。请确认后端已启动（uvicorn 运行在 8090）。</div>`;
      return;
    }
    if (!items.length) {
      listEl.innerHTML = `<div class="panel glass fade-in"><p class="sub">暂无档案。在下方录入一位命主后保存。</p></div>`;
      return;
    }
    await kbPromise;
    const cards = await Promise.all(items.map(async (p) => {
      const date = new Date(p.datetime);
      const gender = p.gender || '男';
      let bzLine = '';
      try {
        const r = bzAnalyze({ date, gender });
        bzLine = `${r.ganzhi.year} ${r.ganzhi.month} ${r.ganzhi.day} ${r.ganzhi.time} · ${r.dayGan}${r.dayWuxing} · ${r.geju.name} · ${r.strength}日主`;
      } catch {}
      let zwLine = '';
      try {
        const zr = zwPaipan({ date, gender });
        const soul = zr.palaces.find((pl) => pl.isSoul);
        zwLine = `${zr.fiveElements}${zr.ju}局 · 命宫${soul.stars.length ? ' ' + soul.stars.map((s) => s.name).join('') : ''}`;
      } catch {}
      return { p, bzLine, zwLine };
    }));
    listEl.innerHTML = `<div class="section"><div class="section-head"><span class="tick"></span><h2>已保存（${items.length}）</h2></div>
      <div class="profile-list">${cards.map(({ p, bzLine, zwLine }) => `
        <div class="profile-item fade-in">
          <div class="avatar">${(p.name || '命')[0]}</div>
          <div style="flex:1">
            <div class="pi-name">${esc(p.name)}</div>
            <div class="pi-meta">${p.datetime.replace('T', ' ') || ''} · ${p.gender} · 东经${p.longitude}°${p.note ? ' · ' + esc(p.note) : ''}</div>
            ${(bzLine || zwLine) ? `<div class="pi-summary">${bzLine ? esc(bzLine) : ''}${bzLine && zwLine ? '<span class="ps-sep">｜</span>' : ''}${zwLine ? esc(zwLine) : ''}</div>` : ''}
          </div>
          <button class="btn ghost" data-act="bazi" data-id="${p.id}" style="padding:8px 16px;font-size:13px">排八字</button>
          <button class="btn ghost" data-act="ziwei" data-id="${p.id}" style="padding:8px 16px;font-size:13px">排紫微</button>
          <button class="btn ghost" data-act="export" data-id="${p.id}" style="padding:8px 16px;font-size:13px;color:var(--gold)">综合命书</button>
          <button class="btn ghost" data-act="edit" data-id="${p.id}" style="padding:8px 16px;font-size:13px">编辑</button>
          <button class="btn ghost" data-act="del" data-id="${p.id}" style="padding:8px 16px;font-size:13px;color:var(--cinnabar)">删除</button>
        </div>`).join('')}</div></div>`;
    listEl.querySelectorAll('[data-act]').forEach((btn) => btn.addEventListener('click', onItem));
  }

  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  async function copyText(t) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(t);
    const ta = document.createElement('textarea');
    ta.value = t;
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch {}
    document.body.removeChild(ta);
  }

  async function onItem(e) {
    const btn = e.currentTarget;
    const id = Number(btn.dataset.id);
    const act = btn.dataset.act;
    if (act === 'del') {
      if (!confirm('确定删除该档案？')) return;
      try { await api(`${API}/${id}`, { method: 'DELETE' }); } catch (err) { alert(err.message); }
      return load();
    }
    if (act === 'edit') {
      try {
        const p = await api(`${API}/${id}`);
        fill(p); EDIT_ID = id;
        titleEl.textContent = `编辑「${p.name}」`;
        cancelBtn.style.display = '';
        root.querySelector('#pf-datetime').scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (err) { alert(err.message); }
      return;
    }
    if (act === 'export') {
      // 综合命书：八字 + 紫微 双系统合并复制
      try {
        const p = await api(`${API}/${id}`);
        const date = new Date(p.datetime);
        const gender = p.gender || '男';
        const lng = p.longitude || 120;
        await kbPromise;
        const bzR = bzAnalyze({ date, gender });
        const zwR = zwPaipan({ date, gender });
        const meta = { name: p.name || '命主', useTrue: true, lng };
        const text = [
          '【玄机阁 · 综合命书】',
          `${p.name || '命主'} · ${(p.datetime || '').replace('T', ' ')} · ${gender} · 东经${lng}°`,
          '',
          '────────── 八字命书 ──────────',
          bzExportText(bzR, meta),
          '',
          '────────── 紫微命书 ──────────',
          zwExportText(zwR, meta),
        ].join('\n');
        await copyText(text);
        const old = btn.textContent;
        btn.textContent = '已 复 制';
        setTimeout(() => { btn.textContent = old; }, 1600);
      } catch (err) { alert(err.message); }
      return;
    }
    // bazi / ziwei 一键排盘
    try {
      const p = await api(`${API}/${id}`);
      localStorage.setItem('mingli.selectedProfile', JSON.stringify(p));
      location.hash = `#/${act}`;
    } catch (err) { alert(err.message); }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      name: root.querySelector('#pf-name').value.trim(),
      datetime: root.querySelector('#pf-datetime').value,
      gender: root.querySelector('#pf-gender').value,
      longitude: parseFloat(root.querySelector('#pf-lng').value) || 120,
      note: root.querySelector('#pf-note').value.trim(),
    };
    if (!body.name) return;
    try {
      if (EDIT_ID) await api(`${API}/${EDIT_ID}`, { method: 'PUT', body: JSON.stringify(body) });
      else await api(API, { method: 'POST', body: JSON.stringify(body) });
      resetForm();
      await load();
    } catch (err) { alert(err.message); }
  });

  cancelBtn.addEventListener('click', resetForm);

  // ── 备份导出 / 导入 ──
  root.querySelector('#pf-export').addEventListener('click', async () => {
    try {
      const res = await fetch('/api/export');
      if (!res.ok) throw new Error(`导出失败（${res.status}）`);
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `玄机阁-档案备份-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { alert(err.message); }
  });

  root.querySelector('#pf-import').addEventListener('click', () => root.querySelector('#pf-file').click());
  root.querySelector('#pf-file').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const profiles = Array.isArray(data) ? data : (Array.isArray(data.profiles) ? data.profiles : null);
      if (!profiles) throw new Error('无法识别的备份文件（应为 profile 数组或含 profiles 字段）');
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profiles }),
      });
      if (!res.ok) { let m = '导入失败'; try { m = (await res.json()).detail || m; } catch {} throw new Error(m); }
      const r = await res.json();
      alert(`导入完成：新增 ${r.added} 条，跳过（已存在/无效）${r.skipped} 条。`);
      await load();
    } catch (err) { alert('导入失败：' + err.message); }
  });

  load();
}
