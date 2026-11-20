/* Pink Finance — telas: Início, Contas, Movimentações, Metas */
'use strict';
const Screens = {};

/* ---------- helpers de layout ---------- */
function topBar(title, { back = false, actions = '', sub = '' } = {}) {
  return `<div class="top">${back ? `<button class="ib" data-a="back" aria-label="Voltar">${ic('back')}</button>` : ''}<div class="grow col">${back ? `<h2>${esc(title)}</h2>` : `<h1>${esc(title)}</h1>`}${sub ? `<span class="sub-t">${sub}</span>` : ''}</div>${actions}</div>`;
}
const eyeBtn = () => `<button class="ib" data-a="toggleHide" aria-label="Mostrar ou ocultar saldos">${ic(S.settings.hideBalance ? 'eyeoff' : 'eye')}</button>`;
function txRow(t, opt = {}) {
  const s = txSign(t), a = acc(t.accountId);
  let sub = [];
  if (t.type === 'transferencia') sub.push(`${accName(t.accountId)} → ${accName(t.toAccountId)}`);
  else { sub.push(t.category || TX_TYPE_L[t.type]); sub.push(a ? a.name : 'Fora das contas'); }
  if (t.method === 'credito') sub.push('Crédito');
  if (opt.date) sub.unshift(fmtDay(t.date));
  const cls = s > 0 ? 'ok' : '';
  const tags = (t.date > today() ? '<span class="tag">agendado</span> ' : '') + (t.recurringId ? ic('repeat', 'sm') : '');
  return `<button class="li" data-a="txDetail" data-id="${t.id}"><div class="av">${ic(txIcon(t), 'sm')}</div><div class="col grow"><span class="t ell">${esc(txTitle(t))}</span><span class="s ell">${esc(sub.join(' · '))}</span></div><div class="col" style="align-items:flex-end"><span class="amt num ${cls}">${s > 0 ? '+' : s < 0 ? '−' : ''}${money(Math.abs(t.amount))}</span><span class="faint xs row" style="gap:4px">${tags}</span></div></button>`;
}
function txGrouped(list, limit = 200) {
  if (!list.length) return `<div class="empty">${ic('list')}<div>Nenhuma movimentação encontrada</div></div>`;
  const sorted = list.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.created || '').localeCompare(a.created || '')).slice(0, limit);
  let html = '', cur = null, buf = '';
  for (const t of sorted) {
    if (t.date !== cur) { if (buf) html += `<div class="list">${buf}</div>`; buf = ''; cur = t.date; html += `<div class="day-h">${dayHeader(t.date)}</div>`; }
    buf += txRow(t);
  }
  if (buf) html += `<div class="list">${buf}</div>`;
  if (list.length > limit) html += `<div class="empty small">Mostrando ${limit} de ${list.length}. Use os filtros para refinar.</div>`;
  return html;
}
const statTile = (l, v, icn, cls = '') => `<div class="stat"><div class="l">${ic(icn, 'sm')}${esc(l)}</div><div class="v num ${cls}">${v}</div></div>`;
function accAvatar(a, size = 38) { return `<div class="av" style="width:${size}px;height:${size}px;background:${a.color}22;color:${a.color};border:1px solid ${a.color}55">${esc(a.short || a.name.slice(0, 2).toUpperCase())}</div>`; }

/* itens a vencer: contas, faturas, lembretes */
function upcomingItems(days = 10) {
  const td = today(), lim = addDays(td, days), out = [];
  for (const b of S.bills) { if (b.paidAt) continue; if (b.due <= lim) out.push({ kind: 'bill', date: b.due, title: b.name, amount: b.amount, st: billStatus(b), id: b.id }); }
  for (const inv of openInvoices()) if (inv.due <= lim && inv.remaining > 0 && inv.status !== 'aberta') out.push({ kind: 'inv', date: inv.due, title: 'Fatura ' + accName(inv.accountId), amount: inv.remaining, st: inv.status === 'atrasada' ? 'atrasada' : 'proxima', inv });
  for (const inv of openInvoices()) if (inv.status === 'aberta' && inv.due <= lim && inv.remaining > 0) out.push({ kind: 'inv', date: inv.due, title: 'Fatura ' + accName(inv.accountId) + ' (aberta)', amount: inv.remaining, st: 'proxima', inv });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
function alertsList() {
  const out = [];
  for (const it of upcomingItems(7)) out.push({ icon: it.kind === 'bill' ? 'doc' : 'card', cls: it.st === 'atrasada' ? 'bad' : 'warn', text: `${it.title} · ${money(it.amount, { force: true })}`, sub: it.st === 'atrasada' ? `Venceu ${relDay(it.date)}` : `Vence ${relDay(it.date)}`, act: it.kind === 'bill' ? `data-a="billDetail" data-id="${it.id}"` : `data-a="invoiceOpen" data-acc="${it.inv.accountId}" data-key="${it.inv.key}"` });
  const k = ym(today());
  for (const [cat, lim] of Object.entries(S.budgets)) { if (!lim) continue; const p = catSpent(cat, k) / lim; if (p >= .7) out.push({ icon: 'gauge', cls: p >= 1 ? 'bad' : 'warn', text: `Orçamento de ${cat}: ${fmtPct(p)}`, sub: p >= 1 ? `Excedeu ${money(catSpent(cat, k) - lim, { force: true })}` : `Resta ${money(lim - catSpent(cat, k), { force: true })}`, act: 'data-a="open" data-s="budget"' }); }
  for (const r of S.invReminders) if (r.date <= today()) out.push({ icon: 'trend', cls: '', text: r.title, sub: 'Lembrete de investimento', act: 'data-a="open" data-s="investments"' });
  for (const i of S.investments) if (!i.closed && i.maturity && i.maturity >= today() && daysBetween(today(), i.maturity) <= 7) out.push({ icon: 'clock', cls: 'warn', text: `${i.name} vence ${relDay(i.maturity)}`, sub: 'Vencimento de investimento', act: `data-a="open" data-s="inv" data-id="${i.id}"` });
  for (const g of S.goals) if (!g.completedAt && g.aporteDay && +today().slice(8, 10) === Math.min(g.aporteDay, lastDay(ym(today())))) out.push({ icon: 'target', cls: '', text: `Aporte programado: ${g.name}`, sub: g.monthly ? money(g.monthly, { force: true }) : 'Hoje', act: `data-a="open" data-s="goal" data-id="${g.id}"` });
  return out;
}

/* ---------- INÍCIO ---------- */
Screens.home = () => {
  const k = ym(today()), ms = monthStats(k), lv = levelInfo(), alerts = alertsList();
  const debt = cardDebtTotal(), inv = investTotal(), gs = goalsTotal();
  const up = upcomingItems(10).slice(0, 4);
  const goals = S.goals.filter(g => !g.completedAt).slice(0, 3);
  const bTot = sum(Object.values(S.budgets)), bSpent = sum(Object.keys(S.budgets), c => catSpent(c, k));
  const active = S.game.challenges.filter(c => c.status === 'ativo');
  const hour = new Date().getHours(), hi = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  return `<div class="screen">
  <div class="top"><div class="grow col"><span class="sub-t">${hi}${S.settings.name ? ', ' + esc(S.settings.name) : ''}</span><button class="lvl" data-a="goGame" style="align-self:flex-start;margin-top:4px"><i>${lv.num}</i>${esc(lv.n)} · ${lv.xp} XP</button></div>
    <button class="ib" data-a="open" data-s="calendar" aria-label="Calendário">${ic('calendar')}</button>
    <button class="ib" data-a="alerts" aria-label="Alertas">${ic('bell')}${alerts.length ? `<span class="dot">${alerts.length}</span>` : ''}</button></div>
  ${S.settings.sample ? `<div class="banner">${ic('info', 'sm')}<span class="grow"><b>Dados de exemplo.</b> Explore à vontade e apague quando quiser começar.</span><button class="link" data-a="clearSample">Apagar</button></div>` : ''}
  ${!S.settings.sample && !S.tx.length ? `<div class="banner">${ic('info', 'sm')}<span class="grow"><b>Primeiros passos:</b> ajuste o saldo de cada conta e cadastre suas contas a pagar.</span><button class="link" data-a="go" data-tab="accounts">Contas</button></div>` : ''}
  ${!storageOK ? `<div class="banner warn">${ic('alert', 'sm')}<span class="grow">Este navegador não está salvando os dados. Instale o app ou faça backup antes de sair.</span></div>` : ''}
  <div class="hero">
    <div class="lbl">Saldo total disponível ${eyeBtn().replace('class="ib"', 'class="ib" style="width:28px;height:28px"')}</div>
    <div class="big num">${money(totalBalance())}</div>
    <div class="small" style="color:var(--tx2)">em ${activeAccounts().length} contas</div>
    <div class="meta"><div><span style="color:var(--tx2)">Patrimônio líquido</span><b class="num">${money(netWorth())}</b></div><div><span style="color:var(--tx2)">Cartões a pagar</span><b class="num">${money(debt)}</b></div></div>
  </div>
  <div class="grid2">
    ${statTile('Recebido no mês', money(ms.inc), 'in', 'ok')}
    ${statTile('Gasto no mês', money(ms.exp), 'bag')}
    ${statTile('Total investido', money(inv), 'trend')}
    ${statTile('Guardado em metas', money(gs), 'target')}
  </div>
  <div class="qa mt12">
    <button data-a="newTx" data-type="despesa"><span class="ic">${ic('bag')}</span>Despesa</button>
    <button data-a="newTx" data-type="receita"><span class="ic">${ic('in')}</span>Receita</button>
    <button data-a="newTx" data-type="transferencia"><span class="ic">${ic('swap')}</span>Transferir</button>
    <button data-a="open" data-s="bills"><span class="ic">${ic('doc')}</span>A pagar</button>
  </div>

  <div class="sec"><span class="sec-t">Próximos vencimentos</span><button class="link" data-a="open" data-s="bills">Ver todas</button></div>
  <div class="list">${up.length ? up.map(it => `<button class="li" ${it.kind === 'bill' ? `data-a="billDetail" data-id="${it.id}"` : `data-a="invoiceOpen" data-acc="${it.inv.accountId}" data-key="${it.inv.key}"`}><div class="av">${ic(it.kind === 'bill' ? 'doc' : 'card', 'sm')}</div><div class="col grow"><span class="t ell">${esc(it.title)}</span><span class="s">${fmtDate(it.date)} · ${relDay(it.date)}</span></div><div class="col" style="align-items:flex-end;gap:4px"><span class="amt num">${money(it.amount)}</span><span class="pill ${BILL_C[it.st]}">${BILL_L[it.st]}</span></div></button>`).join('') : `<div class="empty">${ic('checkc')}<div>Nada vencendo nos próximos 10 dias</div></div>`}</div>

  ${goals.length ? `<div class="sec"><span class="sec-t">Metas</span><button class="link" data-a="go" data-tab="goals">Ver todas</button></div>
  <div class="card">${goals.map((g, i) => { const p = goalPlan(g); return `<button data-a="open" data-s="goal" data-id="${g.id}" style="display:block;width:100%;text-align:left;${i ? 'margin-top:14px' : ''}"><div class="between small"><span class="row" style="gap:8px">${ic(g.icon || 'target', 'sm')}<b style="font-weight:550">${esc(g.name)}</b></span><span class="num muted">${fmtPct(p.p)}</span></div><div class="mt8">${UI.progress(p.p)}</div><div class="between xs faint mt8"><span class="num">${money(p.saved)} de ${money(g.target)}</span><span>${p.need ? money(p.need) + '/mês' : ''}</span></div></button>`; }).join('')}</div>` : ''}

  ${bTot ? `<button class="card" data-a="open" data-s="budget" style="display:block;width:100%;text-align:left"><div class="between"><span class="sec-t" style="margin:0">Orçamento de ${MONTHS[+k.slice(5) - 1].toLowerCase()}</span><span class="num small ${bSpent > bTot ? 'bad' : 'muted'}">${fmtPct(pct(bSpent, bTot))}</span></div><div class="mt12">${UI.progress(pct(bSpent, bTot), bSpent > bTot ? 'bad' : pct(bSpent, bTot) >= .9 ? 'warn' : '')}</div><div class="between small mt8"><span class="num">${money(bSpent)} de ${money(bTot)}</span><span class="${bSpent > bTot ? 'bad' : 'muted'}">${bSpent > bTot ? 'Excedido' : 'Resta ' + money(bTot - bSpent)}</span></div></button>` : ''}

  <div class="sec"><span class="sec-t">Análises</span></div>
  <div class="card">
    <div class="seg" style="margin-bottom:16px">${[['cat', 'Categorias'], ['io', 'Entradas × saídas'], ['nw', 'Patrimônio'], ['month', 'Gastos mensais'], ['banks', 'Bancos']].map(([v, l]) => `<button data-a="homeChart" data-v="${v}" class="${App.homeChart === v ? 'on' : ''}">${l}</button>`).join('')}</div>
    ${homeChart(App.homeChart)}
  </div>

  <button class="card row" data-a="goGame" style="width:100%;text-align:left">
    ${UI.ring(lv.p, 54, lv.num)}
    <div class="col grow"><b style="font-weight:600">${esc(lv.n)}</b><span class="small muted">${lv.next ? `${lv.toNext} XP para ${lv.next.n}` : 'Nível máximo'}</span><span class="xs faint">${active.length} desafio(s) ativo(s)</span></div>
    <span class="flame">${ic('flame', 'sm')}${streak()}</span>
  </button>
  </div>`;
};
function homeChart(v) {
  const k0 = ym(today());
  if (v === 'cat') return UI.catDonut(monthStats(k0).byCat, monthLabel(k0).split(' ')[0].toLowerCase());
  if (v === 'io') { const ks = [...Array(6)].map((_, i) => ymAdd(k0, i - 5)); const st = ks.map(k => monthStats(k)); return UI.bars({ labels: ks.map(monShort), series: [{ n: 'Entradas', c: '#78917F', values: st.map(s => s.inc) }, { n: 'Saídas', c: '#69747B', values: st.map(s => s.exp) }] }); }
  if (v === 'nw') { const ser = netWorthSeries(6); const d = ser[5].v - ser[0].v; return `<div class="between small" style="margin-bottom:6px"><span class="muted">Últimos 6 meses</span><span class="num ${d >= 0 ? 'ok' : 'bad'}">${d >= 0 ? '+' : ''}${money(d)}</span></div>` + UI.line({ labels: ser.map(x => monShort(x.k)), values: ser.map(x => x.v) }); }
  if (v === 'month') { const ks = [...Array(6)].map((_, i) => ymAdd(k0, i - 5)); return UI.bars({ labels: ks.map(monShort), series: [{ n: 'Gastos', c: '#78917F', values: ks.map(k => monthStats(k).exp) }] }); }
  if (v === 'banks') { const items = activeAccounts().map(a => ({ l: a.name, v: balance(a.id), c: a.color })); return UI.hbars(items); }
  return '';
}

/* ---------- CONTAS ---------- */
Screens.accounts = () => {
  const list = activeAccounts(), k = ym(today()), arch = S.accounts.filter(a => a.archived);
  return `<div class="screen">${topBar('Minhas contas', { actions: eyeBtn() + `<button class="ib" data-a="accountForm" aria-label="Adicionar conta">${ic('plus')}</button>` })}
  <div class="hero"><div class="lbl">Saldo total somando todas as contas</div><div class="big num">${money(totalBalance())}</div>
  <div class="meta"><div><span style="color:var(--tx2)">Limite disponível</span><b class="num">${money(sum(list.filter(hasCard), a => Math.max(0, a.card.limit - cardUsed(a.id))))}</b></div><div><span style="color:var(--tx2)">Faturas em aberto</span><b class="num">${money(cardDebtTotal())}</b></div></div></div>
  ${list.map(a => {
    const f = accMonthFlow(a.id, k), inv = hasCard(a) ? currentInvoice(a.id) : null, used = hasCard(a) ? cardUsed(a.id) : 0;
    return `<button class="acard" data-a="open" data-s="account" data-id="${a.id}"><span class="stripe" style="background:${a.color}"></span>
      <div class="row">${accAvatar(a)}<div class="col grow"><b style="font-weight:600">${esc(a.name)}</b><span class="xs faint">${esc(a.bank)}</span></div>${ic('chev', 'sm')}</div>
      <div class="bal num">${money(balance(a.id))}</div>
      <div class="mini"><span>${ic('in', 'sm')} ${money(f.inn)}</span><span>${ic('upload', 'sm')} ${money(f.out)}</span><span class="faint">no mês</span></div>
      ${inv ? `<div class="divider"></div><div class="between small"><span class="row" style="gap:6px">${ic('card', 'sm')}Fatura ${monShort(inv.key)}: <b class="num">${money(inv.remaining)}</b></span><span class="faint xs">vence ${fmtDay(inv.due)}</span></div><div class="mt8">${UI.progress(pct(used, a.card.limit), pct(used, a.card.limit) > .9 ? 'bad' : pct(used, a.card.limit) > .7 ? 'warn' : '')}</div><div class="between xs faint mt8"><span>Usado ${money(used)}</span><span>Limite ${money(a.card.limit)}</span></div>` : ''}
    </button>`;
  }).join('')}
  <div class="btns mt12"><button class="btn sec" data-a="newTx" data-type="transferencia">${ic('swap', 'sm')}Transferir</button><button class="btn sec" data-a="import">${ic('upload', 'sm')}Importar extrato</button></div>
  <div class="sec"><span class="sec-t">Distribuição entre bancos</span></div>
  <div class="card">${UI.hbars(list.map(a => ({ l: a.name, v: balance(a.id), c: a.color })))}</div>
  ${arch.length ? `<div class="sec"><span class="sec-t">Arquivadas</span></div><div class="list">${arch.map(a => `<div class="li">${accAvatar(a, 32)}<div class="col grow"><span class="t">${esc(a.name)}</span><span class="s num">Saldo ${money(balance(a.id))}</span></div><button class="link" data-a="unarchive" data-id="${a.id}">Reativar</button></div>`).join('')}</div>` : ''}
  <div class="card flat small muted row" style="gap:10px;align-items:flex-start">${ic('shield', 'sm')}<span>O app nunca pede senha de banco. Os saldos vêm dos seus lançamentos e extratos importados. <button class="link" data-a="open" data-s="openfinance">Sobre integração bancária</button></span></div>
  </div>`;
};
Screens.account = ({ id }) => {
  const a = acc(id); if (!a) return Screens.accounts();
  const k = ym(today()), f = accMonthFlow(id, k);
  const txs = S.tx.filter(t => t.accountId === id || t.toAccountId === id);
  let card = '';
  if (hasCard(a)) {
    const invs = invoices(id), cur = currentInvoice(id), used = cardUsed(id);
    const pending = invs.filter(i => i.status !== 'paga' && i.key !== cur.key);
    const stL = { aberta: ['Aberta', ''], fechada: ['Fechada', 'warn'], atrasada: ['Atrasada', 'bad'], paga: ['Paga', 'ok'] };
    const invRow = i => `<button class="li" data-a="invoiceOpen" data-acc="${id}" data-key="${i.key}"><div class="av">${ic('card', 'sm')}</div><div class="col grow"><span class="t">${monthLabel(i.key)}</span><span class="s">Fecha ${fmtDay(i.close)} · vence ${fmtDay(i.due)}</span></div><div class="col" style="align-items:flex-end;gap:4px"><span class="amt num">${money(i.status === 'paga' ? i.total : i.remaining)}</span><span class="pill ${stL[i.status][1]}">${stL[i.status][0]}</span></div></button>`;
    card = `<div class="sec"><span class="sec-t">Cartão de crédito</span></div>
    <div class="card">
      <div class="between"><span class="small muted">Fatura atual · ${monthLabel(cur.key)}</span><span class="pill ${stL[cur.status][1]}">${stL[cur.status][0]}</span></div>
      <div class="num" style="font-size:26px;font-weight:650;margin:6px 0">${money(cur.remaining)}</div>
      <div class="small muted">Fecha ${fmtDate(cur.close)} · vence ${fmtDate(cur.due)}</div>
      <div class="mt12">${UI.progress(pct(used, a.card.limit), pct(used, a.card.limit) > .9 ? 'bad' : '')}</div>
      <div class="between xs faint mt8"><span>Usado ${money(used)}</span><span>Disponível ${money(Math.max(0, a.card.limit - used))} de ${money(a.card.limit)}</span></div>
      <div class="btns mt12"><button class="btn sec sm" data-a="newTx" data-type="despesa" data-acc="${id}" data-method="credito">${ic('plus', 'sm')}Nova compra</button>${cur.remaining > 0 ? `<button class="btn sm" data-a="payInvoice" data-acc="${id}" data-key="${cur.key}">Pagar fatura</button>` : ''}</div>
    </div>
    ${pending.length ? `<div class="sec-t" style="margin:14px 2px 8px">Faturas abertas</div><div class="list">${pending.map(invRow).join('')}</div>` : ''}
    ${invs.filter(i => i.status === 'paga').length ? `<div class="sec-t" style="margin:14px 2px 8px">Faturas pagas</div><div class="list">${invs.filter(i => i.status === 'paga').slice(-3).reverse().map(invRow).join('')}</div>` : ''}`;
  }
  return `<div class="screen sub">${topBar(a.name, { back: true, sub: esc(a.bank), actions: eyeBtn() + `<button class="ib" data-a="accountForm" data-id="${id}" aria-label="Editar conta">${ic('edit')}</button>` })}
  <div class="hero"><div class="lbl">Saldo atual</div><div class="big num">${money(balance(id))}</div>
  <div class="meta"><div><span style="color:var(--tx2)">Entradas no mês</span><b class="num">${money(f.inn)}</b></div><div><span style="color:var(--tx2)">Saídas no mês</span><b class="num">${money(f.out)}</b></div></div></div>
  <div class="qa">
    <button data-a="newTx" data-type="despesa" data-acc="${id}"><span class="ic">${ic('plus')}</span>Lançar</button>
    <button data-a="newTx" data-type="transferencia" data-acc="${id}"><span class="ic">${ic('swap')}</span>Transferir</button>
    <button data-a="adjust" data-id="${id}"><span class="ic">${ic('sliders')}</span>Ajustar saldo</button>
    <button data-a="import" data-id="${id}"><span class="ic">${ic('upload')}</span>Importar</button>
  </div>
  ${card}
  <div class="sec"><span class="sec-t">Histórico de movimentações</span><button class="link" data-a="filterAcc" data-id="${id}">Filtrar</button></div>
  ${txGrouped(txs, 60)}
  </div>`;
};

/* ---------- MOVIMENTAÇÕES ---------- */
function filteredTx() {
  const f = App.f; let from = '0000', to = '9999';
  if (f.mode === 'month') { from = monthStart(f.k); to = monthEnd(f.k); }
  else if (f.mode === 'custom') { from = f.from || '0000'; to = f.to || '9999'; }
  const q = f.q.trim().toLowerCase();
  return S.tx.filter(t => {
    if (t.date < from || t.date > to) return false;
    if (f.type === 'receita' && t.type !== 'receita') return false;
    if (f.type === 'despesa' && t.type !== 'despesa') return false;
    if (f.type === 'transferencia' && t.type !== 'transferencia') return false;
    if (f.type === 'outras' && ['receita', 'despesa', 'transferencia'].includes(t.type)) return false;
    if (f.cats.length && !f.cats.includes(t.category)) return false;
    if (f.accs.length && !f.accs.includes(t.accountId) && !f.accs.includes(t.toAccountId)) return false;
    if (f.methods.length && !f.methods.includes(t.method)) return false;
    if (q) { const hay = [txTitle(t), t.category, t.notes, accName(t.accountId), String(t.amount / 100).replace('.', ',')].join(' ').toLowerCase(); if (!hay.includes(q)) return false; }
    return true;
  });
}
Screens.txs = () => {
  const f = App.f, list = filteredTx();
  const inc = sum(list.filter(t => t.type === 'receita'), t => t.amount), exp = sum(list.filter(t => t.type === 'despesa'), t => t.amount);
  const nf = f.cats.length + f.accs.length + f.methods.length + (f.mode === 'custom' ? 1 : 0);
  const period = f.mode === 'month' ? monthLabel(f.k) : f.mode === 'all' ? 'Todo o período' : `${fmtDate(f.from) || '…'} – ${fmtDate(f.to) || '…'}`;
  return `<div class="screen">${topBar('Movimentações', { actions: eyeBtn() + `<button class="ib" data-a="txFilters" aria-label="Filtros">${ic('filter')}${nf ? `<span class="dot">${nf}</span>` : ''}</button>` })}
  <div class="searchbox">${ic('search', 'sm')}<input class="inp" id="txq" placeholder="Pesquisar descrição, categoria, valor…" value="${esc(f.q)}" autocomplete="off"></div>
  <div class="between mt12"><button class="ib" data-a="txMonth" data-d="-1" ${f.mode !== 'month' ? 'disabled style="opacity:.3"' : ''}>${ic('back', 'sm')}</button><button class="small" data-a="txPeriod" style="font-weight:600">${period} ${ic('chevd', 'sm')}</button><button class="ib" data-a="txMonth" data-d="1" ${f.mode !== 'month' ? 'disabled style="opacity:.3"' : ''}>${ic('chev', 'sm')}</button></div>
  <div class="hscroll mt8">${[['all', 'Todas'], ['despesa', 'Despesas'], ['receita', 'Receitas'], ['transferencia', 'Transferências'], ['outras', 'Faturas, metas e investimentos']].map(([v, l]) => `<button class="chip ${f.type === v ? 'on' : ''}" data-a="txType" data-v="${v}">${l}</button>`).join('')}</div>
  <div class="grid3 mt12">
    <div class="stat"><div class="l">Entradas</div><div class="v num ok" style="font-size:15px">${money(inc)}</div></div>
    <div class="stat"><div class="l">Saídas</div><div class="v num" style="font-size:15px">${money(exp)}</div></div>
    <div class="stat"><div class="l">Resultado</div><div class="v num ${inc - exp < 0 ? 'bad' : ''}" style="font-size:15px">${money(inc - exp)}</div></div>
  </div>
  ${nf ? `<div class="row mt12 small"><span class="muted grow">${nf} filtro(s) ativo(s) · ${list.length} lançamentos</span><button class="link" data-a="txClear">Limpar</button></div>` : ''}
  <div id="txlist">${txGrouped(list)}</div>
  </div>`;
};

/* ---------- METAS / DESAFIOS / CONQUISTAS ---------- */
Screens.goals = () => {
  const tab = App.goalsTab;
  const seg = `<div class="seg" style="margin-bottom:14px">${[['metas', 'Metas'], ['desafios', 'Desafios'], ['conquistas', 'Conquistas']].map(([v, l]) => `<button data-a="goalsTab" data-v="${v}" class="${tab === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  let body = '';
  if (tab === 'metas') body = goalsBody(); else if (tab === 'desafios') body = challengesBody(); else body = achievementsBody();
  return `<div class="screen">${topBar('Metas', { actions: tab === 'metas' ? `<button class="ib" data-a="goalForm" aria-label="Nova meta">${ic('plus')}</button>` : '' })}${seg}${body}</div>`;
};
function goalImg(g, big) { return g.image ? `<div class="gimg ${big ? 'big' : ''}" style="background-image:url(${g.image})"></div>` : `<div class="gimg ${big ? 'big' : ''}">${ic(g.icon || 'target', big ? 'lg' : '')}</div>`; }
function goalsBody() {
  const open = S.goals.filter(g => !g.completedAt), done = S.goals.filter(g => g.completedAt);
  const tot = sum(S.goals, g => goalSaved(g)), tgt = sum(open, g => g.target) + sum(done, g => g.target);
  const needAll = sum(open, g => goalPlan(g).need);
  const card = g => { const p = goalPlan(g); return `<button class="gcard" data-a="open" data-s="goal" data-id="${g.id}"><div class="row">${goalImg(g)}<div class="col grow"><b class="ell" style="font-weight:600">${esc(g.name)}</b><span class="xs faint">${esc(g.category)} · até ${fmtDate(g.deadline)}</span></div><span class="num" style="font-weight:650">${fmtPct(p.p)}</span></div>
    <div class="mt12">${UI.progress(p.p, p.late ? 'bad' : '', true)}</div>
    <div class="between small mt8"><span class="num">${money(p.saved)} <span class="faint">de ${money(g.target)}</span></span>${p.done ? '<span class="pill ok">Concluída</span>' : p.late ? '<span class="pill bad">Prazo vencido</span>' : `<span class="muted num">${money(p.need)}/mês</span>`}</div></button>`; };
  return `<div class="card row">${UI.ring(pct(tot, tgt), 70, fmtPct(pct(tot, tgt)))}<div class="col grow"><span class="small muted">Total guardado nas metas</span><b class="num" style="font-size:22px;font-weight:650">${money(tot)}</b><span class="xs faint num">Para cumprir todos os prazos: ${money(needAll)}/mês</span></div></div>
  ${open.length ? open.map(card).join('') : `<div class="card empty">${ic('target')}<div>Nenhuma meta ativa</div><button class="btn sm mt12" data-a="goalForm" style="width:auto">${ic('plus', 'sm')}Criar meta</button></div>`}
  ${done.length ? `<div class="sec"><span class="sec-t">Concluídas</span></div>${done.map(card).join('')}` : ''}
  <button class="btn ghost mt8" data-a="goalForm">${ic('plus', 'sm')}Nova meta</button>`;
}
Screens.goal = ({ id }) => {
  const g = goalById(id); if (!g) return Screens.goals();
  const p = goalPlan(g);
  const moves = S.tx.filter(t => t.goalId === id).sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="screen sub">${topBar(g.name, { back: true, sub: esc(g.category), actions: `<button class="ib" data-a="goalForm" data-id="${id}" aria-label="Editar">${ic('edit')}</button>` })}
  <div class="card center">${g.image ? `<div class="gimg big" style="margin:0 auto 14px;background-image:url(${g.image});width:100%;height:150px;border-radius:14px"></div>` : ''}
    <div style="display:flex;justify-content:center">${UI.ring(p.p, 132, fmtPct(p.p))}</div>
    <div class="num" style="font-size:24px;font-weight:650;margin-top:12px">${money(p.saved)}</div><div class="small muted">de ${money(g.target)}</div>
    ${p.done ? '<div class="pill ok mt12">Meta concluída</div>' : ''}
  </div>
  <div class="btns"><button class="btn" data-a="goalMove" data-id="${id}">${ic('plus', 'sm')}Guardar</button><button class="btn sec" data-a="goalMove" data-id="${id}" data-w="1">${ic('download', 'sm')}Resgatar</button></div>
  <div class="card mt12">
    <div class="kv"><span>Falta</span><span class="num">${money(p.remaining)}</span></div>
    <div class="kv"><span>Prazo final</span><span>${fmtDate(g.deadline)}${p.months && !p.done ? ` · ${p.months} ${p.months === 1 ? 'mês' : 'meses'}` : ''}</span></div>
    <div class="kv"><span>Necessário por mês para o prazo</span><span class="num ${p.late ? 'bad' : ''}">${p.done ? '—' : p.late ? 'Prazo vencido' : money(p.need)}</span></div>
    <div class="kv"><span>Contribuição mensal desejada</span><span class="num">${g.monthly ? money(g.monthly) : '—'}</span></div>
    ${p.eta ? `<div class="kv"><span>Previsão no seu ritmo</span><span>${monthLabel(ym(p.eta))} ${p.onTrack === null ? '' : p.onTrack ? '<span class="pill ok">no prazo</span>' : '<span class="pill warn">atrasa</span>'}</span></div>` : ''}
    <div class="kv"><span>Aporte programado</span><span>${g.aporteDay ? 'todo dia ' + g.aporteDay : '—'}</span></div>
    <div class="kv"><span>Valor inicial</span><span class="num">${money(g.initial || 0)}</span></div>
  </div>
  <div class="sec"><span class="sec-t">Aportes e resgates</span></div>
  ${moves.length ? `<div class="list">${moves.map(t => txRow(t, { date: true })).join('')}</div>` : `<div class="card empty">Nenhum aporte ainda. Cada aporte rende +10 XP.</div>`}
  </div>`;
};
function challengesBody() {
  const act = S.game.challenges.filter(c => c.status === 'ativo'), hist = S.game.challenges.filter(c => c.status !== 'ativo');
  const st = streak(), td = today(), marked = S.game.noSpend.includes(td), blocked = nonEssentialOn(td);
  const chCard = c => { const r = evalChallenge(c), t = CH_TPL[c.tpl]; return `<button class="gcard" data-a="open" data-s="challenge" data-id="${c.id}"><div class="row"><div class="gimg">${ic(t.ic)}</div><div class="col grow"><b style="font-weight:600" class="ell">${esc(t.n)}</b><span class="xs faint">${fmtDay(c.start)} – ${fmtDay(c.end)} · +${t.xp} XP</span></div></div><div class="mt12">${UI.progress(r.p)}</div><div class="between small mt8"><span class="muted">${esc(r.label)}</span><span class="faint xs">${c.end >= td ? `${daysBetween(td, c.end) + 1} dia(s) restantes` : ''}</span></div></button>`; };
  return `<div class="card"><div class="row"><div class="gimg">${ic('flame')}</div><div class="col grow"><b class="num" style="font-size:20px;font-weight:650">${st} ${st === 1 ? 'dia' : 'dias'}</b><span class="small muted">Sequência atual · recorde ${bestStreak()}</span></div></div>
    <div class="small muted mt12">Registre algo, pague uma conta, guarde dinheiro ou marque um dia sem gastos não essenciais para manter a sequência.</div>
    <button class="btn ${marked || blocked ? 'sec' : ''} mt12" data-a="noSpend" ${marked || blocked ? 'disabled' : ''}>${ic('leaf', 'sm')}${marked ? 'Dia sem gastos registrado' : blocked ? 'Hoje teve gasto não essencial' : 'Hoje não tive gastos não essenciais (+8 XP)'}</button></div>
  <div class="sec"><span class="sec-t">Calendário de ${MONTHS[+td.slice(5, 7) - 1].toLowerCase()}</span></div>
  <div class="card">${activityCalendar(ym(td))}<div class="row xs faint mt12" style="gap:14px;flex-wrap:wrap"><span class="row" style="gap:5px"><i style="width:9px;height:9px;border-radius:3px;background:var(--ac)"></i>dia ativo</span><span class="row" style="gap:5px"><i style="width:9px;height:9px;border-radius:3px;background:var(--bad)"></i>gasto não essencial</span><span class="row" style="gap:5px"><i style="width:6px;height:6px;border-radius:50%;background:#B7A88A"></i>início/fim de desafio</span></div></div>
  <div class="sec"><span class="sec-t">Desafios ativos</span></div>
  ${act.length ? act.map(chCard).join('') : `<div class="card empty">Nenhum desafio ativo. Escolha um abaixo.</div>`}
  <div class="sec"><span class="sec-t">Novos desafios</span></div>
  <div class="list">${Object.entries(CH_TPL).map(([k, t]) => { const on = act.some(c => c.tpl === k); return `<div class="li"><div class="av ac">${ic(t.ic, 'sm')}</div><div class="col grow"><span class="t">${esc(t.n)}</span><span class="s">${esc(t.d)} +${t.xp} XP</span></div>${on ? '<span class="pill ok">Ativo</span>' : `<button class="btn sm" data-a="startCh" data-v="${k}">Começar</button>`}</div>`; }).join('')}</div>
  ${hist.length ? `<div class="sec"><span class="sec-t">Histórico</span></div><div class="list">${hist.slice(0, 12).map(c => `<button class="li" data-a="open" data-s="challenge" data-id="${c.id}"><div class="av">${ic(CH_TPL[c.tpl].ic, 'sm')}</div><div class="col grow"><span class="t ell">${esc(CH_TPL[c.tpl].n)}</span><span class="s">${fmtDate(c.start)} – ${fmtDate(c.end)}</span></div><span class="pill ${c.status === 'concluido' ? 'ok' : 'bad'}">${c.status === 'concluido' ? 'Concluído' : 'Não concluído'}</span></button>`).join('')}</div>` : ''}
  <div class="card flat xs faint">O jogo premia organização e disciplina. Gastar mais ou investir em produtos arriscados nunca rende pontos.</div>`;
}
function activityCalendar(k) {
  const first = parseISO(monthStart(k)).getDay(), n = lastDay(k), td = today(), act = new Set(S.game.active);
  const chDays = new Set(); S.game.challenges.forEach(c => { chDays.add(c.start); chDays.add(c.end); });
  let h = WD.map(w => `<div class="wd">${w[0].toUpperCase()}</div>`).join('');
  for (let i = 0; i < first; i++) h += '<div></div>';
  for (let d = 1; d <= n; d++) {
    const ds = dateIn(k, d), bad = nonEssentialOn(ds), on = act.has(ds);
    const bg = bad ? 'background:var(--badbg);color:var(--bad)' : on ? 'background:var(--acbg);color:var(--ac2)' : '';
    h += `<div class="d ${ds === td ? 't' : ''}" style="${bg};aspect-ratio:1">${d}${chDays.has(ds) ? '<span style="position:absolute;bottom:4px;width:4px;height:4px;border-radius:50%;background:#B7A88A"></span>' : ''}</div>`;
  }
  return `<div class="cal">${h}</div>`;
}
Screens.challenge = ({ id }) => {
  const c = S.game.challenges.find(x => x.id === id); if (!c) return Screens.goals();
  const r = evalChallenge(c), t = CH_TPL[c.tpl], td = today();
  const stl = { ativo: ['Em andamento', ''], concluido: ['Concluído', 'ok'], falhou: ['Não concluído', 'bad'] }[c.status];
  return `<div class="screen sub">${topBar(t.n, { back: true, sub: `${fmtDate(c.start)} – ${fmtDate(c.end)}` })}
  <div class="card center"><div style="display:flex;justify-content:center">${UI.ring(r.p, 120, fmtPct(r.p))}</div><div class="mt12"><span class="pill ${stl[1]}">${stl[0]}</span></div><div class="small muted mt8">${esc(r.label)}</div><div class="xs faint mt8">${esc(t.d)} Recompensa: +${t.xp} XP</div></div>
  <div class="sec"><span class="sec-t">Calendário do desafio</span></div>
  <div class="card"><div class="dg">${r.days.map(x => `<i class="${x.s === 'ok' ? 'ok' : x.s === 'bad' ? 'bad' : x.s === 'f' ? '' : 'n'} ${x.d === td ? 'now' : ''}" title="${fmtDate(x.d)}">${+x.d.slice(8, 10)}</i>`).join('')}</div>
  <div class="row xs faint mt12" style="gap:14px"><span>verde: dia cumprido</span><span>vermelho: falhou</span><span>contorno: hoje</span></div></div>
  ${r.weeks ? `<div class="list">${r.weeks.map((w, i) => `<div class="li"><div class="av ${w.hit ? 'ac' : ''}">${w.hit ? ic('check', 'sm') : i + 1}</div><div class="col grow"><span class="t">Semana ${i + 1}</span><span class="s">${fmtDay(w.a)} – ${fmtDay(w.b)}</span></div><span class="num small">${money(Math.max(0, w.s), { force: true })} / ${money(c.params.amount, { force: true })}</span></div>`).join('')}</div>` : ''}
  ${c.tpl === 'reduce' ? `<div class="card"><div class="kv"><span>Mês anterior</span><span class="num">${money(c.params.base, { force: true })}</span></div><div class="kv"><span>Meta (−${c.params.pct}%)</span><span class="num">${money(c.params.target, { force: true })}</span></div><div class="kv"><span>Gasto até agora</span><span class="num">${money(r.spent, { force: true })}</span></div></div>` : ''}
  ${c.status === 'ativo' ? `<div class="btns mt12">${['eco100', 'weekly'].includes(c.tpl) ? `<button class="btn" data-a="go" data-tab="goals" data-gt="metas">${ic('target', 'sm')}Guardar em uma meta</button>` : ''}<button class="btn ghost" data-a="abandonCh" data-id="${c.id}">Desistir</button></div>` : ''}
  </div>`;
};
function achievementsBody() {
  const lv = levelInfo();
  return `<div class="card"><div class="row">${UI.ring(lv.p, 76, lv.num)}<div class="col grow"><span class="small muted">Nível ${lv.num}</span><b style="font-size:20px;font-weight:650">${esc(lv.n)}</b><span class="small muted num">${lv.xp} XP${lv.next ? ` · faltam ${lv.toNext} para ${lv.next.n}` : ''}</span></div></div>
    <div class="mt16" style="display:grid;gap:8px">${LEVELS.map((l, i) => `<div class="between small"><span class="row" style="gap:8px;${i > lv.i ? 'color:var(--tx3)' : ''}">${i <= lv.i ? ic('checkc', 'sm') : ic('lock', 'sm')}${esc(l.n)}</span><span class="faint num">${l.xp} XP</span></div>`).join('')}</div></div>
  <div class="sec"><span class="sec-t">Medalhas · ${Object.keys(S.game.ach).length}/${ACHIEVEMENTS.length}</span></div>
  <div class="ach">${ACHIEVEMENTS.map(a => { const on = S.game.ach[a.id]; return `<button class="a ${on ? 'on' : ''}" data-a="achInfo" data-id="${a.id}"><div class="m">${ic(on ? a.ic : 'lock')}</div><div class="n">${esc(a.n)}</div>${on ? `<span class="xs faint">${fmtDate(on)}</span>` : ''}</button>`; }).join('')}</div>
  <div class="sec"><span class="sec-t">Como ganhar XP</span></div>
  <div class="card small">${[['Registrar receita ou despesa', '+3 (até 15/dia)'], ['Pagar conta antes do vencimento', '+20'], ['Pagar fatura em dia', '+20'], ['Guardar dinheiro em meta', '+10 (até 20/dia)'], ['Concluir meta', '+100'], ['Revisar investimentos', '+15/semana'], ['Dia sem gastos não essenciais', '+8'], ['Sequência de 7 dias', '+25'], ['Concluir desafios', '+80 a +120']].map(([a, b]) => `<div class="kv"><span>${a}</span><span class="ok">${b}</span></div>`).join('')}</div>
  <div class="sec"><span class="sec-t">Histórico de XP</span></div>
  <div class="list">${S.game.log.length ? S.game.log.slice(0, 25).map(l => `<div class="li"><div class="col grow"><span class="t ell" style="font-size:14px">${esc(l.label)}</span><span class="s">${fmtDate(l.d.slice(0, 10))}</span></div><span class="ok num small" style="font-weight:650">+${l.xp}</span></div>`).join('') : '<div class="empty">Ainda sem pontos</div>'}</div>`;
}
