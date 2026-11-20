/* Pink Finance — componentes de interface: avisos, folhas, formulários, gráficos */
'use strict';
const UI = {};

/* ---------- avisos ---------- */
UI.toast = (msg, icon = 'check', cls = '') => {
  let box = $('.toasts'); if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div'); t.className = 'toast ' + cls; t.innerHTML = `${ic(icon, 'sm')}<span>${esc(msg)}</span>`;
  box.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 2600);
};
UI.toastXP = (xp, label) => {
  let box = $('.toasts'); if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div'); t.className = 'toast xp'; t.innerHTML = `<span class="x">+${xp} XP</span><span class="muted">${esc(label)}</span>`;
  box.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 2200);
};
UI.achievementToast = a => UI.toast('Conquista desbloqueada: ' + a.n, 'trophy', 'xp');
UI.levelUp = lv => UI.dialog({ title: 'Novo nível: ' + lv.n, html: `<div class="center" style="margin:6px 0 16px">${ic('star', 'lg')}<p class="muted" style="margin:10px 0 0">Você alcançou o nível ${lv.num} com ${lv.xp} XP. Continue registrando e guardando com consistência.</p></div>`, ok: 'Continuar', cancel: null });
UI.celebrate = (title, name) => UI.dialog({ title, html: `<div class="center" style="margin:6px 0 16px"><div class="gimg big" style="margin:0 auto">${ic('trophy', 'lg')}</div><p class="muted" style="margin:12px 0 0">${esc(name)} — objetivo alcançado. +100 XP.</p></div>`, ok: 'Ótimo', cancel: null });

/* ---------- navegação de volta (botão voltar do Android) ---------- */
const layers = [];
let trapped = false, HIST = true;
/* uma única entrada de histórico "captura" o botão Voltar do Android enquanto houver algo para fechar */
function syncTrap() {
  const need = layers.length > 0 || (typeof App !== 'undefined' && App.stack && App.stack.length > 0);
  if (need && !trapped && HIST) { try { history.pushState({ pf: 1 }, ''); trapped = true; } catch (e) { HIST = false; } }
}
const histPush = syncTrap;
function pushLayer(close) { layers.push(close); syncTrap(); }
function removeLayer(fn) { const i = layers.indexOf(fn); if (i >= 0) layers.splice(i, 1); }
window.addEventListener('popstate', () => {
  trapped = false;
  if (layers.length) layers.pop()(true);
  else if (App.stack.length) App.back(true);
  syncTrap();
});

/* ---------- diálogo ---------- */
UI.dialog = ({ title, msg, html, ok = 'OK', cancel = 'Cancelar', danger = false }) => new Promise(res => {
  const ov = document.createElement('div'); ov.className = 'ov center';
  ov.innerHTML = `<div class="dlg"><h3>${esc(title)}</h3>${msg ? `<p>${esc(msg)}</p>` : ''}${html || ''}<div class="btns">${cancel ? `<button class="btn sec" data-r="0">${esc(cancel)}</button>` : ''}<button class="btn ${danger ? 'danger' : ''}" data-r="1">${esc(ok)}</button></div></div>`;
  document.body.appendChild(ov); requestAnimationFrame(() => ov.classList.add('show'));
  let done = false;
  const close = (v, fromPop) => { if (done) return; done = true; ov.classList.remove('show'); setTimeout(() => ov.remove(), 220); if (!fromPop) removeLayer(closer); res(v); };
  const closer = fromPop => close(false, fromPop);
  pushLayer(closer);
  ov.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b) close(b.dataset.r === '1'); else if (e.target === ov) close(false); });
});
UI.confirm = (title, msg, ok = 'Confirmar', danger = true) => UI.dialog({ title, msg, ok, danger });

/* ---------- folha inferior ---------- */
UI.sheet = ({ title, body, footer, onMount, onClose }) => {
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = `<div class="sheet" role="dialog"><div class="grab"></div><div class="hd"><h2>${esc(title)}</h2><button class="ib" data-close>${ic('x')}</button></div><div class="bd">${body}</div>${footer ? `<div class="ft">${footer}</div>` : ''}</div>`;
  document.body.appendChild(ov); requestAnimationFrame(() => ov.classList.add('show'));
  let closed = false;
  const api = {
    el: ov.querySelector('.sheet'),
    close(fromPop) {
      if (closed) return; closed = true;
      ov.classList.remove('show'); setTimeout(() => ov.remove(), 300);
      if (!fromPop) removeLayer(api.close);
      onClose && onClose();
    },
    setBody(html) { ov.querySelector('.bd').innerHTML = html; }
  };
  pushLayer(api.close);
  ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-close]')) api.close(); });
  onMount && onMount(api);
  return api;
};

/* ---------- motor de formulários ---------- */
function fieldHTML(f, v) {
  const id = 'f_' + f.k;
  const lab = f.label ? `<label for="${id}">${esc(f.label)}</label>` : '';
  const hint = f.hint ? `<div class="hint">${esc(f.hint)}</div>` : '';
  let inner = '';
  switch (f.type) {
    case 'money': inner = `<input class="inp money num" id="${id}" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${esc(v === undefined || v === null || v === '' ? '' : centsToInput(v))}">`; break;
    case 'text': inner = `<input class="inp" id="${id}" value="${esc(v || '')}" placeholder="${esc(f.ph || '')}" autocomplete="off" maxlength="80">`; break;
    case 'number': inner = `<input class="inp num" id="${id}" type="number" inputmode="numeric" value="${esc(v ?? '')}" min="${f.min ?? ''}" max="${f.max ?? ''}" step="${f.step || 1}">`; break;
    case 'date': inner = `<input class="inp" id="${id}" type="date" value="${esc(v || '')}">`; break;
    case 'textarea': inner = `<textarea class="inp" id="${id}" placeholder="${esc(f.ph || '')}" maxlength="400">${esc(v || '')}</textarea>`; break;
    case 'select': inner = `<select class="inp" id="${id}">${f.options.map(([val, l]) => `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`; break;
    case 'seg': inner = `<div class="seg" data-seg="${f.k}">${f.options.map(([val, l]) => `<button type="button" data-v="${esc(val)}" class="${String(val) === String(v) ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`; break;
    case 'chips': { const set = new Set(v || []); inner = `<div class="chips" data-chips="${f.k}">${f.options.map(([val, l]) => `<button type="button" class="chip ${set.has(val) ? 'on' : ''}" data-v="${esc(val)}">${esc(l)}</button>`).join('')}</div>`; break; }
    case 'toggle': return `<div class="field" data-k="${f.k}"><div class="tgl"><div class="col"><span>${esc(f.label)}</span>${f.hint ? `<span class="xs faint">${esc(f.hint)}</span>` : ''}</div><button type="button" class="sw ${v ? 'on' : ''}" data-sw="${f.k}" aria-pressed="${!!v}"></button></div></div>`;
    case 'color': inner = `<div class="colors" data-colors="${f.k}">${ACC_COLORS.map(c => `<button type="button" style="background:${c}" data-v="${c}" class="${c === v ? 'on' : ''}"></button>`).join('')}</div>`; break;
    case 'icon': inner = `<div class="icons" data-icons="${f.k}">${GOAL_ICONS.map(n => `<button type="button" data-v="${n}" class="${n === v ? 'on' : ''}">${ic(n)}</button>`).join('')}</div>`; break;
    case 'image': inner = `<div class="imgpick"><div class="prev" data-prev="${f.k}" style="${v ? `background-image:url(${v})` : ''}"></div><div class="col"><label class="btn sm sec" style="width:auto">${ic('image', 'sm')} Escolher imagem<input type="file" accept="image/*" data-img="${f.k}" hidden></label><button type="button" class="link" data-imgclear="${f.k}" style="text-align:left;margin-top:6px">Remover imagem</button></div></div><input type="hidden" data-imgval="${f.k}" value="${esc(v || '')}">`; break;
    case 'html': return `<div class="field" data-k="${f.k}">${f.html}</div>`;
  }
  return `<div class="field" data-k="${f.k}">${lab}${inner}${hint}<div class="errm hidden"></div></div>`;
}
function readForm(root, fields) {
  const o = {};
  for (const f of fields) {
    const id = '#f_' + f.k;
    switch (f.type) {
      case 'money': o[f.k] = parseMoney($(id, root).value); break;
      case 'number': o[f.k] = $(id, root).value === '' ? null : Number($(id, root).value); break;
      case 'text': case 'date': case 'textarea': case 'select': o[f.k] = $(id, root).value.trim(); break;
      case 'seg': { const b = $(`[data-seg="${f.k}"] .on`, root); o[f.k] = b ? b.dataset.v : ''; break; }
      case 'chips': o[f.k] = $$(`[data-chips="${f.k}"] .on`, root).map(b => b.dataset.v); break;
      case 'toggle': o[f.k] = $(`[data-sw="${f.k}"]`, root).classList.contains('on'); break;
      case 'color': { const b = $(`[data-colors="${f.k}"] .on`, root); o[f.k] = b ? b.dataset.v : ACC_COLORS[0]; break; }
      case 'icon': { const b = $(`[data-icons="${f.k}"] .on`, root); o[f.k] = b ? b.dataset.v : 'target'; break; }
      case 'image': o[f.k] = $(`[data-imgval="${f.k}"]`, root).value || null; break;
    }
  }
  return o;
}
function resizeImage(file, max = 360) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', .8)); }; img.onerror = rej; img.src = r.result; };
    r.onerror = rej; r.readAsDataURL(file);
  });
}
/* abre um formulário em folha; onSubmit(vals) retorna true (ok), string (erro geral) ou {campo: erro} */
UI.form = ({ title, fields, values = {}, submit = 'Salvar', onSubmit, extra = [], note = '' }) => {
  const renderFields = vals => fields.map(f => (f.show && !f.show(vals)) ? '' : fieldHTML(f, vals[f.k])).join('');
  const footer = `<div class="btns">${extra.map((b, i) => `<button class="btn ${b.cls || 'sec'}" data-extra="${i}">${b.icon ? ic(b.icon, 'sm') : ''}${esc(b.label)}</button>`).join('')}<button class="btn" data-submit>${esc(submit)}</button></div>`;
  let cur = Object.assign({}, values);
  const sh = UI.sheet({
    title, body: `<form novalidate>${note ? `<div class="banner">${ic('info', 'sm')}<span class="grow">${note}</span></div>` : ''}<div data-fields>${renderFields(cur)}</div></form>`, footer,
    onMount(api) {
      const root = api.el;
      const visible = () => fields.filter(f => !f.show || f.show(cur));
      const sync = () => { cur = Object.assign(cur, readForm(root, visible())); };
      const rerenderIfNeeded = () => {
        const before = visible().map(f => f.k).join();
        sync();
        const after = fields.filter(f => !f.show || f.show(cur)).map(f => f.k).join();
        if (before !== after) { const box = $('[data-fields]', root); box.innerHTML = renderFields(cur); }
        fields.forEach(f => f.onChange && f.onChange(cur, root));
      };
      root.addEventListener('click', e => {
        const seg = e.target.closest('[data-seg] button');
        if (seg) { $$('button', seg.parentNode).forEach(b => b.classList.toggle('on', b === seg)); rerenderIfNeeded(); return; }
        const chip = e.target.closest('[data-chips] .chip'); if (chip) { chip.classList.toggle('on'); rerenderIfNeeded(); return; }
        const sw = e.target.closest('[data-sw]'); if (sw) { sw.classList.toggle('on'); rerenderIfNeeded(); return; }
        const col = e.target.closest('[data-colors] button'); if (col) { $$('button', col.parentNode).forEach(b => b.classList.toggle('on', b === col)); sync(); return; }
        const icb = e.target.closest('[data-icons] button'); if (icb) { $$('button', icb.parentNode).forEach(b => b.classList.toggle('on', b === icb)); sync(); return; }
        const clr = e.target.closest('[data-imgclear]'); if (clr) { const k = clr.dataset.imgclear; $(`[data-imgval="${k}"]`, root).value = ''; $(`[data-prev="${k}"]`, root).style.backgroundImage = ''; sync(); return; }
        const ex = e.target.closest('[data-extra]'); if (ex) { sync(); extra[+ex.dataset.extra].onClick(cur, api); return; }
        if (e.target.closest('[data-submit]')) doSubmit();
      });
      root.addEventListener('change', async e => {
        const fi = e.target.closest('[data-img]');
        if (fi && fi.files[0]) { try { const url = await resizeImage(fi.files[0]); const k = fi.dataset.img; $(`[data-imgval="${k}"]`, root).value = url; $(`[data-prev="${k}"]`, root).style.backgroundImage = `url(${url})`; sync(); } catch (err) { UI.toast('Não foi possível ler a imagem', 'alert'); } return; }
        rerenderIfNeeded();
      });
      root.addEventListener('input', e => { if (e.target.matches('input,textarea')) { const fe = e.target.closest('.field'); if (fe) { fe.classList.remove('err'); const m = $('.errm', fe); m && m.classList.add('hidden'); } } });
      $('form', root).addEventListener('submit', e => { e.preventDefault(); doSubmit(); });
      function doSubmit() {
        sync();
        const vis = visible(); let bad = false;
        for (const f of vis) {
          const v = cur[f.k]; let err = null;
          if (f.req) {
            if (f.type === 'money' && (!(v > 0) || isNaN(v))) err = 'Informe um valor maior que zero';
            else if (f.type !== 'money' && (v === '' || v === null || v === undefined || (Array.isArray(v) && !v.length))) err = 'Campo obrigatório';
          }
          if (!err && f.type === 'money' && isNaN(v)) err = 'Valor inválido';
          if (!err && f.validate) err = f.validate(v, cur);
          if (err) { bad = true; showErr(f.k, err); }
        }
        if (bad) return;
        const r = onSubmit(Object.assign({}, cur), api);
        if (r === true || r === undefined) api.close();
        else if (typeof r === 'string') UI.toast(r, 'alert');
        else if (r && typeof r === 'object') for (const [k, m] of Object.entries(r)) showErr(k, m);
      }
      function showErr(k, m) { const fe = $(`.field[data-k="${k}"]`, root); if (!fe) { UI.toast(m, 'alert'); return; } fe.classList.add('err'); const em = $('.errm', fe); if (em) { em.textContent = m; em.classList.remove('hidden'); } }
    }
  });
  return sh;
};

/* ---------- gráficos SVG ---------- */
UI.donut = (items, size = 132, center = '') => {
  const total = sum(items, x => x.v); const r = 52, cx = 66, cy = 66, w = 14, C = 2 * Math.PI * r;
  let off = 0;
  const segs = total > 0 ? items.map((x, i) => {
    const len = x.v / total * C, gap = items.length > 1 ? Math.min(2, len / 3) : 0;
    const s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${x.c}" stroke-width="${w}" stroke-dasharray="${Math.max(0, len - gap)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 ${cx} ${cy})"/>`;
    off += len; return s;
  }).join('') : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--line2)" stroke-width="${w}"/>`;
  return `<svg viewBox="0 0 132 132" width="${size}" height="${size}" style="flex:none">${segs}<text x="66" y="62" text-anchor="middle" style="fill:var(--tx2);font-size:10px">${esc(center)}</text><text x="66" y="78" text-anchor="middle" style="fill:var(--tx);font-size:13px;font-weight:650">${esc(total ? moneyShort(total) : '—')}</text></svg>`;
};
UI.legend = (items, total) => `<div class="legend">${items.map(x => `<div class="lg"><i style="background:${x.c}"></i><span class="ell">${esc(x.l)}</span><span class="num small">${money(x.v)}</span>${total ? `<span class="faint xs num" style="width:34px;text-align:right">${fmtPct(pct(x.v, total))}</span>` : ''}</div>`).join('')}</div>`;
UI.catDonut = (byCat, label = 'gastos', max = 5) => {
  const ent = sortedCats(byCat);
  const top = ent.slice(0, max).map(([l, v], i) => ({ l, v, c: CHART_COLORS[i] }));
  const rest = sum(ent.slice(max), e => e[1]);
  if (rest > 0) top.push({ l: 'Outras', v: rest, c: CHART_COLORS[max] });
  if (!top.length) return `<div class="empty">${ic('pie')}<div>Sem gastos no período</div></div>`;
  return `<div class="donutwrap">${UI.donut(top, 128, label)}${UI.legend(top, sum(top, x => x.v))}</div>`;
};
UI.bars = ({ labels, series, h = 160 }) => {
  const W = 320, H = h, pl = 42, pb = 20, pt = 8;
  const max = Math.max(1, ...series.flatMap(s => s.values));
  const nice = niceMax(max);
  const n = labels.length, gw = (W - pl) / n, bw = Math.min(14, (gw - 8) / series.length);
  let g = '';
  for (let i = 0; i <= 3; i++) { const y = pt + (H - pb - pt) * (1 - i / 3); g += `<line x1="${pl}" x2="${W}" y1="${y}" y2="${y}" stroke="var(--line)"/><text x="${pl - 6}" y="${y + 3}" text-anchor="end">${moneyShort(nice * i / 3)}</text>`; }
  labels.forEach((l, i) => {
    const x0 = pl + gw * i + (gw - bw * series.length - 2 * (series.length - 1)) / 2;
    series.forEach((s, j) => {
      const v = s.values[i] || 0, bh = (H - pb - pt) * v / nice, x = x0 + j * (bw + 2), y = H - pb - bh;
      g += `<rect x="${x}" y="${y}" width="${bw}" height="${Math.max(0, bh)}" rx="3" fill="${s.c}"><title>${esc(s.n)}: ${money(v, { force: true })}</title></rect>`;
    });
    g += `<text x="${pl + gw * i + gw / 2}" y="${H - 5}" text-anchor="middle">${esc(l)}</text>`;
  });
  const leg = series.length > 1 ? `<div class="row small muted" style="gap:14px;margin-top:6px">${series.map(s => `<span class="row" style="gap:6px"><i style="width:8px;height:8px;border-radius:2px;background:${s.c};display:inline-block"></i>${esc(s.n)}</span>`).join('')}</div>` : '';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${g}</svg>${leg}`;
};
UI.line = ({ labels, values, h = 150 }) => {
  const W = 320, H = h, pl = 46, pb = 20, pt = 10;
  const mn = Math.min(...values), mx = Math.max(...values);
  const lo = mn >= 0 ? Math.max(0, mn - (mx - mn) * .3) : mn - (mx - mn) * .2, hi = mx + (mx - mn || Math.abs(mx) || 1) * .12;
  const X = i => pl + 6 + (W - pl - 22) * (values.length === 1 ? .5 : i / (values.length - 1));
  const span = (hi - lo) / 100, fmtAx = v => { if (S.settings.hideBalance) return '•••'; const r = v / 100; if (Math.abs(r) < 1000) return String(Math.round(r)); const dec = span < 300 ? 2 : span < 3000 ? 1 : 0; return (r / 1000).toFixed(dec).replace('.', ',') + ' mil'; };
  const Y = v => pt + (H - pb - pt) * (1 - (v - lo) / ((hi - lo) || 1));
  let g = '';
  for (let i = 0; i <= 3; i++) { const v = lo + (hi - lo) * i / 3, y = Y(v); g += `<line x1="${pl}" x2="${W}" y1="${y}" y2="${y}" stroke="var(--line)"/><text x="${pl - 6}" y="${y + 3}" text-anchor="end">${fmtAx(v)}</text>`; }
  const pts = values.map((v, i) => `${X(i)},${Y(v)}`).join(' ');
  g += `<defs><linearGradient id="lg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#78917F" stop-opacity=".35"/><stop offset="1" stop-color="#78917F" stop-opacity="0"/></linearGradient></defs>`;
  g += `<polygon points="${X(0)},${H - pb} ${pts} ${X(values.length - 1)},${H - pb}" fill="url(#lg1)"/>`;
  g += `<polyline points="${pts}" fill="none" stroke="#78917F" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
  values.forEach((v, i) => { g += `<circle cx="${X(i)}" cy="${Y(v)}" r="${i === values.length - 1 ? 4 : 2.5}" fill="${i === values.length - 1 ? '#93A99A' : 'var(--s1)'}" stroke="#78917F" stroke-width="1.6"><title>${esc(labels[i])}: ${money(v, { force: true })}</title></circle>`; g += `<text x="${X(i)}" y="${H - 5}" text-anchor="${i === values.length - 1 && values.length > 1 ? 'end' : i === 0 && values.length > 1 ? 'start' : 'middle'}">${esc(labels[i])}</text>`; });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${g}</svg>`;
};
UI.hbars = items => {
  const max = Math.max(1, ...items.map(x => Math.abs(x.v)));
  return `<div style="display:grid;gap:12px">${items.map((x, i) => `<div><div class="between small"><span class="row" style="gap:8px"><i style="width:8px;height:8px;border-radius:2px;background:${x.c || CHART_COLORS[i]};display:inline-block"></i>${esc(x.l)}</span><span class="num">${money(x.v)}</span></div><div class="bar mt8"><i data-pw="${clamp(Math.abs(x.v) / max * 100, 0, 100)}" style="background:${x.c || CHART_COLORS[i]}"></i></div></div>`).join('')}</div>`;
};
function niceMax(v) { const p = Math.pow(10, Math.floor(Math.log10(v))); const m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; }
UI.progress = (p, cls = '', thick = false) => `<div class="bar ${cls} ${thick ? 'thick' : ''}"><i data-pw="${clamp(p * 100, 0, 100)}"></i></div>`;
UI.ring = (p, size = 64, label = '') => {
  const r = size / 2 - 5, C = 2 * Math.PI * r;
  return `<div class="ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--line2)" stroke-width="5"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--ac)" stroke-width="5" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-ring="${C * (1 - clamp(p, 0, 1))}" style="transition:stroke-dashoffset 1s var(--ease)"/></svg><div class="c" style="font-size:${size / 4.6}px">${label}</div></div>`;
};
/* anima barras e anéis após renderizar */
UI.animate = root => requestAnimationFrame(() => requestAnimationFrame(() => {
  $$('[data-pw]', root).forEach(el => el.style.width = el.dataset.pw + '%');
  $$('[data-ring]', root).forEach(el => el.style.strokeDashoffset = el.dataset.ring);
}));
