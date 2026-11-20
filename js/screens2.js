/* Pink Finance — telas: Perfil, Investimentos, Contas a pagar, Calendário, Orçamento, Relatórios, Configurações */
'use strict';

const menuItem = (icon, title, sub, attrs, right = ic('chev', 'sm')) => `<button class="li" ${attrs}><div class="av">${ic(icon, 'sm')}</div><div class="col grow"><span class="t">${title}</span>${sub ? `<span class="s">${sub}</span>` : ''}</div>${right}</button>`;

/* ---------- PERFIL ---------- */
Screens.profile = () => {
  const lv = levelInfo(), nb = S.bills.filter(b => !b.paidAt && (billStatus(b) === 'atrasada' || billStatus(b) === 'proxima')).length;
  return `<div class="screen">${topBar('Perfil')}
  <button class="card row" data-a="editName" style="width:100%;text-align:left">${UI.ring(lv.p, 64, lv.num)}<div class="col grow"><b style="font-size:18px;font-weight:650">${esc(S.settings.name || 'Seu nome')}</b><span class="small muted">${esc(lv.n)} · ${lv.xp} XP</span><span class="xs faint">${Object.keys(S.game.ach).length} medalhas · sequência ${streak()} dias</span></div>${ic('edit', 'sm')}</button>
  <div class="sec-t" style="margin:18px 2px 8px">Finanças</div>
  <div class="list">
    ${menuItem('trend', 'Investimentos', `${money(investTotal())} em ${S.investments.filter(i => !i.closed).length} ativos`, 'data-a="open" data-s="investments"')}
    ${menuItem('doc', 'Contas a pagar', nb ? `${nb} precisando de atenção` : 'Tudo em dia', 'data-a="open" data-s="bills"')}
    ${menuItem('calendar', 'Calendário financeiro', 'Recebimentos, vencimentos e aportes', 'data-a="open" data-s="calendar"')}
    ${menuItem('gauge', 'Orçamento mensal', 'Limites por categoria', 'data-a="open" data-s="budget"')}
    ${menuItem('chart', 'Relatórios', 'Mensal e anual · PDF e Excel', 'data-a="open" data-s="reports"')}
  </div>
  <div class="sec-t" style="margin:18px 2px 8px">Dados</div>
  <div class="list">
    ${menuItem('upload', 'Importar extrato', 'CSV ou OFX do seu banco', 'data-a="import"')}
    ${menuItem('cloud', 'Backup e restauração', S.settings.lastBackup ? 'Último backup em ' + fmtDate(S.settings.lastBackup) : 'Nenhum backup feito ainda', 'data-a="open" data-s="backup"')}
    ${menuItem('info', 'Dados de exemplo', S.settings.sample ? 'Ativos — toque para apagar' : 'Desativados', 'data-a="open" data-s="data"')}
  </div>
  <div class="sec-t" style="margin:18px 2px 8px">Preferências</div>
  <div class="list">
    ${menuItem('lock', 'Segurança', S.settings.pin ? (S.settings.bio ? 'PIN e biometria ativos' : 'PIN ativo') : 'Sem bloqueio', 'data-a="open" data-s="security"')}
    ${menuItem('bell', 'Notificações e lembretes', S.settings.notif.enabled ? 'Ativadas' : 'Desativadas', 'data-a="open" data-s="notifications"')}
    ${menuItem('moon', 'Tema escuro', '', 'data-a="toggleTheme"', `<span class="sw ${S.settings.theme === 'dark' ? 'on' : ''}"></span>`)}
    ${menuItem('eyeoff', 'Ocultar saldos', '', 'data-a="toggleHide"', `<span class="sw ${S.settings.hideBalance ? 'on' : ''}"></span>`)}
    ${menuItem('leaf', 'Gastos não essenciais', esc(S.settings.nonEssential.join(', ') || 'Nenhuma categoria'), 'data-a="nonEssential"')}
  </div>
  <div class="sec-t" style="margin:18px 2px 8px">Sobre</div>
  <div class="list">
    ${menuItem('phone', 'Instalar no celular', 'Galaxy S26 · Chrome', 'data-a="open" data-s="install"')}
    ${menuItem('link', 'Integração bancária', 'Open Finance e segurança', 'data-a="open" data-s="openfinance"')}
  </div>
  <div class="center xs faint mt16">Pink Finance 1.0 · seus dados ficam só neste aparelho</div>
  </div>`;
};

/* ---------- INVESTIMENTOS ---------- */
Screens.investments = () => {
  const list = S.investments.filter(i => !i.closed), closed = S.investments.filter(i => i.closed);
  const cur = sum(list, i => i.current), pr = sum(list, i => i.principal), rend = cur - pr;
  const byType = {}; list.forEach(i => byType[i.type] = (byType[i.type] || 0) + i.current);
  const rems = S.invReminders.slice().sort((a, b) => a.date.localeCompare(b.date));
  const mats = list.filter(i => i.maturity).sort((a, b) => a.maturity.localeCompare(b.maturity));
  const rv = S.game.lastReview;
  return `<div class="screen sub">${topBar('Investimentos', { back: true, actions: eyeBtn() + `<button class="ib" data-a="invForm" aria-label="Novo investimento">${ic('plus')}</button>` })}
  <div class="hero"><div class="lbl">Valor atual da carteira</div><div class="big num">${money(cur)}</div>
  <div class="meta"><div><span style="color:var(--tx2)">Total aplicado</span><b class="num">${money(pr)}</b></div><div><span style="color:var(--tx2)">Rendimento</span><b class="num ${rend < 0 ? 'bad' : ''}">${money(rend, { sign: true })} <span class="xs">(${fmtPct(pct(rend, pr), 1)})</span></b></div></div></div>
  <button class="btn ${rv && daysBetween(rv, today()) < 7 ? 'sec' : ''}" data-a="reviewInv">${ic('checkc', 'sm')}${rv && daysBetween(rv, today()) < 7 ? 'Revisado em ' + fmtDate(rv) : 'Marcar revisão da carteira (+15 XP)'}</button>
  ${list.length ? `<div class="sec"><span class="sec-t">Distribuição por tipo</span></div><div class="card">${UI.catDonut(byType, 'carteira', 6)}</div>` : ''}
  <div class="sec"><span class="sec-t">Ativos</span><button class="link" data-a="invForm">Adicionar</button></div>
  ${list.length ? `<div class="list">${list.map(i => { const r = i.current - i.principal; return `<button class="li" data-a="open" data-s="inv" data-id="${i.id}"><div class="av ac">${ic('trend', 'sm')}</div><div class="col grow"><span class="t ell">${esc(i.name)}</span><span class="s ell">${esc(i.type)} · ${esc(i.institution || '—')} · ${esc(i.liquidity)}</span></div><div class="col" style="align-items:flex-end"><span class="amt num">${money(i.current)}</span><span class="xs num ${r < 0 ? 'bad' : 'ok'}">${r >= 0 ? '+' : ''}${fmtPct(pct(r, i.principal), 1)}</span></div></button>`; }).join('')}</div>` : `<div class="card empty">${ic('trend')}<div>Nenhum investimento cadastrado</div></div>`}
  <div class="sec"><span class="sec-t">Lembretes</span><button class="link" data-a="reminderForm">Novo</button></div>
  <div class="list">${rems.length ? rems.map(r => `<div class="li"><div class="av ${r.date <= today() ? 'ac' : ''}">${ic({ revisar: 'checkc', vencimento: 'clock', aporte: 'plusc', rendimento: 'chart' }[r.kind] || 'bell', 'sm')}</div><button class="col grow" data-a="reminderForm" data-id="${r.id}" style="text-align:left"><span class="t">${esc(r.title)}</span><span class="s">${fmtDate(r.date)} · ${relDay(r.date)}${r.freq !== 'none' ? ' · ' + r.freq : ''}</span></button>${r.date <= today() ? `<button class="btn sm" data-a="remDone" data-id="${r.id}">Feito</button>` : ''}</div>`).join('') : '<div class="empty">Sem lembretes</div>'}</div>
  ${mats.length ? `<div class="sec"><span class="sec-t">Vencimentos</span></div><div class="list">${mats.map(i => `<button class="li" data-a="open" data-s="inv" data-id="${i.id}"><div class="av">${ic('clock', 'sm')}</div><div class="col grow"><span class="t">${esc(i.name)}</span><span class="s">${fmtDate(i.maturity)} · ${relDay(i.maturity)}</span></div><span class="num small">${money(i.current)}</span></button>`).join('')}</div>` : ''}
  ${closed.length ? `<div class="sec"><span class="sec-t">Resgatados</span></div><div class="list">${closed.map(i => `<button class="li" data-a="open" data-s="inv" data-id="${i.id}"><div class="av">${ic('trend', 'sm')}</div><div class="col grow"><span class="t">${esc(i.name)}</span><span class="s">${esc(i.type)}</span></div><span class="pill">Encerrado</span></button>`).join('')}</div>` : ''}
  <div class="card flat xs faint">O Pink Finance é um organizador: não recomenda produtos nem promete rentabilidade. Valores atuais são os que você informa.</div>
  </div>`;
};
Screens.inv = ({ id }) => {
  const i = invById(id); if (!i) return Screens.investments();
  const r = i.current - i.principal, h = (i.history || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const moves = S.tx.filter(t => t.invId === id).sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="screen sub">${topBar(i.name, { back: true, sub: esc(i.type), actions: `<button class="ib" data-a="invForm" data-id="${id}" aria-label="Editar">${ic('edit')}</button>` })}
  <div class="hero"><div class="lbl">Valor atual</div><div class="big num">${money(i.current)}</div><div class="meta"><div><span style="color:var(--tx2)">Aplicado</span><b class="num">${money(i.principal)}</b></div><div><span style="color:var(--tx2)">Rendimento</span><b class="num ${r < 0 ? 'bad' : ''}">${money(r, { sign: true })} (${fmtPct(pct(r, i.principal), 2)})</b></div></div></div>
  <div class="qa"><button data-a="invUpdate" data-id="${id}"><span class="ic">${ic('sliders')}</span>Atualizar</button><button data-a="invAporte" data-id="${id}"><span class="ic">${ic('plus')}</span>Aporte</button><button data-a="invResgate" data-id="${id}"><span class="ic">${ic('download')}</span>Resgatar</button><button data-a="reminderNew" data-title="${esc('Revisar ' + i.name)}"><span class="ic">${ic('bell')}</span>Lembrete</button></div>
  ${h.length > 1 ? `<div class="card">${UI.line({ labels: h.map(x => fmtDay(x.date).replace(' ', '/')), values: h.map(x => x.value) })}</div>` : ''}
  <div class="card">
    <div class="kv"><span>Tipo</span><span>${esc(i.type)}</span></div>
    <div class="kv"><span>Instituição</span><span>${esc(i.institution || '—')}</span></div>
    <div class="kv"><span>Data da aplicação</span><span>${fmtDate(i.date)}</span></div>
    <div class="kv"><span>Rentabilidade contratada</span><span>${esc(i.rate || '—')}</span></div>
    <div class="kv"><span>Liquidez</span><span>${esc(i.liquidity)}</span></div>
    <div class="kv"><span>Vencimento</span><span>${i.maturity ? fmtDate(i.maturity) : '—'}</span></div>
    <div class="kv"><span>Objetivo</span><span>${esc(i.goal || '—')}</span></div>
  </div>
  <div class="sec"><span class="sec-t">Aplicações e resgates</span></div>
  <div class="list">${moves.map(t => txRow(t, { date: true })).join('') || '<div class="empty">—</div>'}</div>
  </div>`;
};

/* ---------- CONTAS A PAGAR ---------- */
Screens.bills = () => {
  const f = App.billsTab, all = S.bills.slice();
  const by = { proximas: all.filter(b => !b.paidAt && b.due >= today()).sort((a, b) => a.due.localeCompare(b.due)), atrasadas: all.filter(b => billStatus(b) === 'atrasada').sort((a, b) => a.due.localeCompare(b.due)), pagas: all.filter(b => b.paidAt).sort((a, b) => b.paidAt.localeCompare(a.paidAt)) };
  const k = ym(today()), monthDue = all.filter(b => ym(b.due) === k), toPay = sum(monthDue.filter(b => !b.paidAt), b => b.amount), paid = sum(monthDue.filter(b => b.paidAt), b => b.amount);
  const list = f === 'todas' ? all.sort((a, b) => b.due.localeCompare(a.due)) : by[f];
  const invs = openInvoices().filter(i => i.remaining > 0);
  const row = b => { const st = billStatus(b); return `<button class="li" data-a="billDetail" data-id="${b.id}"><div class="av" style="${st === 'atrasada' ? 'background:var(--badbg);color:var(--bad)' : st === 'proxima' ? 'background:var(--warnbg);color:var(--warn)' : st === 'paga' ? 'background:var(--acbg);color:var(--ac2)' : ''}">${ic(st === 'paga' ? 'check' : 'doc', 'sm')}</div><div class="col grow"><span class="t ell">${esc(b.name)}${b.recurring ? ' ' + ic('repeat', 'sm') : ''}</span><span class="s">${b.paidAt ? 'Paga em ' + fmtDate(b.paidAt) : 'Vence ' + fmtDate(b.due) + ' · ' + relDay(b.due)}</span></div><div class="col" style="align-items:flex-end;gap:4px"><span class="amt num">${money(b.amount)}</span><span class="pill ${BILL_C[st]}">${BILL_L[st]}</span></div></button>`; };
  return `<div class="screen sub">${topBar('Contas a pagar', { back: true, actions: `<button class="ib" data-a="billForm" aria-label="Nova conta">${ic('plus')}</button>` })}
  <div class="grid3"><div class="stat"><div class="l">A pagar no mês</div><div class="v num" style="font-size:15px">${money(toPay)}</div></div><div class="stat"><div class="l">Pago no mês</div><div class="v num ok" style="font-size:15px">${money(paid)}</div></div><div class="stat"><div class="l">Atrasadas</div><div class="v num ${by.atrasadas.length ? 'bad' : ''}" style="font-size:15px">${by.atrasadas.length}</div></div></div>
  <div class="seg mt12">${[['proximas', 'Próximas'], ['atrasadas', 'Atrasadas'], ['pagas', 'Pagas'], ['todas', 'Todas']].map(([v, l]) => `<button data-a="billsTab" data-v="${v}" class="${f === v ? 'on' : ''}">${l}${v !== 'todas' && by[v].length ? ` · ${by[v].length}` : ''}</button>`).join('')}</div>
  <div class="mt12">${list.length ? `<div class="list">${list.map(row).join('')}</div>` : `<div class="card empty">${ic('checkc')}<div>Nada por aqui</div></div>`}</div>
  ${f === 'proximas' && invs.length ? `<div class="sec"><span class="sec-t">Faturas de cartão</span></div><div class="list">${invs.map(i => `<button class="li" data-a="invoiceOpen" data-acc="${i.accountId}" data-key="${i.key}"><div class="av">${ic('card', 'sm')}</div><div class="col grow"><span class="t">${esc(accName(i.accountId))} · ${monthLabel(i.key)}</span><span class="s">Vence ${fmtDate(i.due)} · ${relDay(i.due)}</span></div><div class="col" style="align-items:flex-end;gap:4px"><span class="amt num">${money(i.remaining)}</span><span class="pill ${i.status === 'atrasada' ? 'bad' : i.status === 'fechada' ? 'warn' : ''}">${{ aberta: 'Aberta', fechada: 'Fechada', atrasada: 'Atrasada' }[i.status]}</span></div></button>`).join('')}</div>` : ''}
  <button class="btn ghost mt12" data-a="billForm">${ic('plus', 'sm')}Nova conta a pagar</button>
  <div class="row xs faint mt12" style="gap:12px;flex-wrap:wrap"><span class="pill bad">Atrasada</span><span class="pill warn">Vence em até 7 dias</span><span class="pill">Pendente</span><span class="pill ok">Paga</span></div>
  </div>`;
};

/* ---------- CALENDÁRIO ---------- */
const EV_KIND = { receb: ['Recebimento', '#78917F'], pagar: ['Conta a pagar', '#C2A36B'], atraso: ['Conta atrasada', '#C07A66'], fatura: ['Fatura de cartão', '#A7AFB3'], invest: ['Investimento', '#8E989E'], aporte: ['Aporte programado', '#C9CFCB'], meta: ['Prazo de meta', '#F2F3F2'], desafio: ['Desafio', '#B7A88A'] };
function calendarEvents(k) {
  const from = monthStart(k), to = monthEnd(k), ev = {};
  const add = (d, kind, title, amount, act) => { if (d < from || d > to) return; (ev[d] = ev[d] || []).push({ kind, title, amount, act }); };
  for (const t of S.tx) if (t.type === 'receita' && t.date >= from && t.date <= to) add(t.date, 'receb', txTitle(t), t.amount, `data-a="txDetail" data-id="${t.id}"`);
  for (const t of projectedRecurring(addDays(today(), 1) > from ? addDays(today(), 1) : from, to)) if (t.type === 'receita') add(t.date, 'receb', (t.desc || t.category) + ' (previsto)', t.amount, '');
  for (const b of S.bills) add(b.due, billStatus(b) === 'atrasada' ? 'atraso' : 'pagar', b.name + (b.paidAt ? ' (paga)' : ''), b.amount, `data-a="billDetail" data-id="${b.id}"`);
  for (const a of activeAccounts()) if (hasCard(a)) {
    const seen = new Set();
    for (const i of invoices(a.id)) { seen.add(i.key); add(i.due, 'fatura', `Fatura ${a.name}${i.status === 'paga' ? ' (paga)' : ''}`, i.status === 'paga' ? i.total : i.remaining, `data-a="invoiceOpen" data-acc="${a.id}" data-key="${i.key}"`); }
    for (const key of [ymAdd(k, -1), k]) if (!seen.has(key)) { const d = invoiceDates(a, key); add(d.due, 'fatura', `Vencimento fatura ${a.name}`, 0, ''); }
  }
  for (const i of S.investments) { if (i.maturity) add(i.maturity, 'invest', 'Vencimento: ' + i.name, i.current, `data-a="open" data-s="inv" data-id="${i.id}"`); add(i.date, 'invest', 'Aplicação: ' + i.name, i.principal, `data-a="open" data-s="inv" data-id="${i.id}"`); }
  for (const r of S.invReminders) { let d = r.date, g = 0; while (d <= to && g++ < 60) { add(d, 'invest', r.title, null, 'data-a="open" data-s="investments"'); if (r.freq === 'none') break; d = r.freq === 'semanal' ? addDays(d, 7) : addMonths(d, r.freq === 'anual' ? 12 : 1); } }
  for (const g of S.goals) {
    add(g.deadline, 'meta', 'Prazo: ' + g.name, g.target, `data-a="open" data-s="goal" data-id="${g.id}"`);
    if (g.aporteDay && !g.completedAt && monthEnd(k) >= (g.created || '') && from <= g.deadline) add(dateIn(k, g.aporteDay), 'aporte', 'Aporte: ' + g.name, g.monthly || goalPlan(g).need, `data-a="open" data-s="goal" data-id="${g.id}"`);
  }
  for (const c of S.game.challenges) { add(c.start, 'desafio', 'Início: ' + CH_TPL[c.tpl].n, null, `data-a="open" data-s="challenge" data-id="${c.id}"`); add(c.end, 'desafio', 'Fim: ' + CH_TPL[c.tpl].n, null, `data-a="open" data-s="challenge" data-id="${c.id}"`); }
  return ev;
}
Screens.calendar = () => {
  const k = App.calK, ev = calendarEvents(k), td = today(), sel = App.calSel && ym(App.calSel) === k ? App.calSel : (ym(td) === k ? td : monthStart(k));
  const first = parseISO(monthStart(k)).getDay(), n = lastDay(k);
  let g = WD.map(w => `<div class="wd">${w.slice(0, 3)}</div>`).join('');
  for (let i = 0; i < first; i++) g += '<div></div>';
  for (let d = 1; d <= n; d++) {
    const ds = dateIn(k, d), e = ev[ds] || [], kinds = [...new Set(e.map(x => x.kind))];
    g += `<button class="d ${ds === td ? 't' : ''} ${ds === sel ? 'sel' : ''}" data-a="calSel" data-d="${ds}">${d}<span class="dots">${kinds.slice(0, 4).map(kd => `<i style="background:${EV_KIND[kd][1]}"></i>`).join('')}</span></button>`;
  }
  const items = ev[sel] || [];
  const tot = (kind) => sum(Object.values(ev).flat().filter(x => x.kind === kind && x.amount), x => x.amount);
  return `<div class="screen sub">${topBar('Calendário financeiro', { back: true })}
  <div class="between"><button class="ib" data-a="calMonth" data-d="-1">${ic('back')}</button><b>${monthLabel(k)}</b><button class="ib" data-a="calMonth" data-d="1">${ic('chev')}</button></div>
  <div class="card mt8"><div class="cal">${g}</div></div>
  <div class="hscroll">${Object.entries(EV_KIND).map(([kk, [l, c]]) => `<span class="pill" style="flex:none"><i style="width:7px;height:7px;border-radius:50%;background:${c};display:inline-block"></i>${l}</span>`).join('')}</div>
  <div class="sec"><span class="sec-t">${dayHeader(sel)}</span><button class="link" data-a="newTx" data-type="despesa" data-date="${sel}">Lançar nesta data</button></div>
  ${items.length ? `<div class="list">${items.map(x => `<button class="li" ${x.act || ''}><div class="av" style="color:${EV_KIND[x.kind][1]}">${ic({ receb: 'in', pagar: 'doc', atraso: 'alert', fatura: 'card', invest: 'trend', aporte: 'plusc', meta: 'target', desafio: 'flag' }[x.kind], 'sm')}</div><div class="col grow"><span class="t ell">${esc(x.title)}</span><span class="s">${EV_KIND[x.kind][0]}</span></div>${x.amount ? `<span class="amt num">${money(x.amount)}</span>` : ''}</button>`).join('')}</div>` : `<div class="card empty">Nenhum compromisso neste dia</div>`}
  <div class="card mt12"><div class="kv"><span>Recebimentos do mês</span><span class="num ok">${money(tot('receb'))}</span></div><div class="kv"><span>Contas do mês</span><span class="num">${money(tot('pagar') + tot('atraso'))}</span></div><div class="kv"><span>Faturas do mês</span><span class="num">${money(tot('fatura'))}</span></div><div class="kv"><span>Aportes programados</span><span class="num">${money(tot('aporte'))}</span></div></div>
  </div>`;
};

/* ---------- ORÇAMENTO ---------- */
Screens.budget = () => {
  const k = App.budK, cats = Object.keys(S.budgets).filter(c => S.budgets[c] > 0);
  const rows = cats.map(c => ({ c, lim: S.budgets[c], sp: catSpent(c, k) })).sort((a, b) => b.sp / b.lim - a.sp / a.lim);
  const totL = sum(rows, r => r.lim), totS = sum(rows, r => r.sp);
  const others = CAT_OUT.filter(c => !S.budgets[c]).map(c => [c, catSpent(c, k)]).filter(x => x[1] > 0);
  const isCur = k === ym(today()), daysLeft = isCur ? lastDay(k) - +today().slice(8, 10) + 1 : 0;
  return `<div class="screen sub">${topBar('Orçamento mensal', { back: true, actions: `<button class="ib" data-a="budgetForm" aria-label="Novo limite">${ic('plus')}</button>` })}
  <div class="between"><button class="ib" data-a="budMonth" data-d="-1">${ic('back')}</button><b>${monthLabel(k)}</b><button class="ib" data-a="budMonth" data-d="1">${ic('chev')}</button></div>
  <div class="card mt8"><div class="between"><span class="small muted">Gasto nas categorias com limite</span><span class="num small ${totS > totL ? 'bad' : 'muted'}">${fmtPct(pct(totS, totL))}</span></div>
    <div class="num" style="font-size:24px;font-weight:650;margin:6px 0">${money(totS)} <span class="small faint">de ${money(totL)}</span></div>
    ${UI.progress(pct(totS, totL), totS > totL ? 'bad' : pct(totS, totL) >= .9 ? 'warn' : pct(totS, totL) >= .7 ? 'warn' : '', true)}
    <div class="between small mt8"><span class="${totS > totL ? 'bad' : 'ok'}">${totS > totL ? 'Excedeu ' + money(totS - totL) : 'Ainda pode gastar ' + money(totL - totS)}</span>${isCur && totL > totS ? `<span class="faint xs">≈ ${money(Math.floor((totL - totS) / daysLeft))}/dia</span>` : ''}</div></div>
  ${rows.length ? `<div class="list">${rows.map(r => { const p = pct(r.sp, r.lim), cls = p >= 1 ? 'bad' : p >= .7 ? 'warn' : ''; return `<button class="li" data-a="budgetForm" data-cat="${esc(r.c)}" style="flex-direction:column;align-items:stretch;gap:8px"><div class="row"><div class="av">${ic(CAT_ICON[r.c] || 'dots', 'sm')}</div><div class="col grow"><span class="t">${esc(r.c)}</span><span class="s num">${money(r.sp)} de ${money(r.lim)}</span></div><div class="col" style="align-items:flex-end"><span class="num small ${cls}" style="font-weight:650">${fmtPct(p)}</span><span class="xs ${p >= 1 ? 'bad' : 'faint'}">${p >= 1 ? 'Excedeu ' + money(r.sp - r.lim) : 'Resta ' + money(r.lim - r.sp)}</span></div></div>${UI.progress(p, cls)}</button>`; }).join('')}</div>` : `<div class="card empty">Nenhum limite definido</div>`}
  <button class="btn ghost" data-a="budgetForm">${ic('plus', 'sm')}Adicionar limite</button>
  ${others.length ? `<div class="sec"><span class="sec-t">Sem limite definido</span></div><div class="list">${others.map(([c, v]) => `<button class="li" data-a="budgetFormNew" data-cat="${esc(c)}"><div class="av">${ic(CAT_ICON[c] || 'dots', 'sm')}</div><div class="col grow"><span class="t">${esc(c)}</span><span class="s">Toque para definir um limite</span></div><span class="amt num">${money(v)}</span></button>`).join('')}</div>` : ''}
  <div class="card flat xs faint">Alertas automáticos ao atingir 70%, 90% e 100% de cada limite. Compras no crédito contam na data da compra.</div>
  </div>`;
};

/* ---------- RELATÓRIOS ---------- */
function reportData(mode, key) {
  let from, to, prevFrom, prevTo, label, cols;
  if (mode === 'mensal') {
    from = monthStart(key); to = monthEnd(key); label = monthLabel(key);
    const pk = ymAdd(key, -1); prevFrom = monthStart(pk); prevTo = monthEnd(pk);
    cols = [...Array(6)].map((_, i) => ymAdd(key, i - 5));
  } else {
    from = key + '-01-01'; to = key + '-12-31'; label = 'Ano ' + key;
    prevFrom = (key - 1) + '-01-01'; prevTo = (key - 1) + '-12-31';
    cols = [...Array(12)].map((_, i) => `${key}-${pad(i + 1)}`);
  }
  const st = periodStats(from, to), prev = periodStats(prevFrom, prevTo);
  const months = cols.map(k => ({ k, ...periodStats(monthStart(k), monthEnd(k)) }));
  const nw = cols.map(k => ({ k, v: netWorth(k === ym(today()) ? today() : (monthEnd(k) > today() ? today() : monthEnd(k))) }));
  const txs = S.tx.filter(t => t.date >= from && t.date <= to).sort((a, b) => a.date.localeCompare(b.date));
  return { mode, key, from, to, label, st, prev, months, nw, txs, savingRate: pct(st.inc - st.exp, st.inc) };
}
Screens.reports = () => {
  const mode = App.repMode, key = mode === 'mensal' ? App.repK : App.repY;
  const R = reportData(mode, key), st = R.st, pv = R.prev;
  const delta = (a, b, inv) => { if (!b) return '<span class="faint xs">—</span>'; const d = (a - b) / b, good = inv ? d <= 0 : d >= 0; return `<span class="xs ${good ? 'ok' : 'bad'}">${d >= 0 ? '▲' : '▼'} ${fmtPct(Math.abs(d))}</span>`; };
  const top = sortedCats(st.byCat).slice(0, 6).map(([l, v], i) => ({ l, v, c: CHART_COLORS[i] }));
  const nwShown = R.nw.filter(x => x.k <= ym(today()));
  return `<div class="screen sub">${topBar('Relatórios', { back: true })}
  <div class="seg">${[['mensal', 'Mensal'], ['anual', 'Anual']].map(([v, l]) => `<button data-a="repMode" data-v="${v}" class="${mode === v ? 'on' : ''}">${l}</button>`).join('')}</div>
  <div class="between mt8"><button class="ib" data-a="repNav" data-d="-1">${ic('back')}</button><b>${R.label}</b><button class="ib" data-a="repNav" data-d="1">${ic('chev')}</button></div>
  <div class="card mt8">
    <div class="kv"><span>Quanto recebi</span><span class="num ok">${money(st.inc)} ${delta(st.inc, pv.inc)}</span></div>
    <div class="kv"><span>Quanto gastei</span><span class="num">${money(st.exp)} ${delta(st.exp, pv.exp, true)}</span></div>
    <div class="kv"><span>Quanto economizei</span><span class="num ${st.net < 0 ? 'bad' : ''}">${money(st.net)} ${delta(st.net, pv.net)}</span></div>
    <div class="kv"><span>Taxa de economia</span><span class="num">${st.inc ? fmtPct(R.savingRate) : '—'}</span></div>
    <div class="kv"><span>Guardado em metas</span><span class="num">${money(st.goalsNet)}</span></div>
    <div class="kv"><span>Quanto investi (líquido)</span><span class="num">${money(st.investNet)}</span></div>
    <div class="kv"><span>Patrimônio no fim do período</span><span class="num">${money(nwShown.length ? nwShown[nwShown.length - 1].v : 0)}</span></div>
  </div>
  <div class="btns"><button class="btn sec" data-a="exportPDF">${ic('file', 'sm')}Exportar PDF</button><button class="btn sec" data-a="exportXLSX">${ic('download', 'sm')}Exportar Excel</button></div>
  <div class="sec"><span class="sec-t">Categorias em que mais gastei</span></div>
  <div class="card">${top.length ? UI.hbars(top) : '<div class="empty">Sem gastos</div>'}</div>
  <div class="sec"><span class="sec-t">Entradas × saídas ${mode === 'mensal' ? '(6 meses)' : ''}</span></div>
  <div class="card">${UI.bars({ labels: R.months.map(m => monShort(m.k)), series: [{ n: 'Entradas', c: '#78917F', values: R.months.map(m => m.inc) }, { n: 'Saídas', c: '#69747B', values: R.months.map(m => m.exp) }] })}</div>
  <div class="sec"><span class="sec-t">Evolução do patrimônio</span></div>
  <div class="card">${nwShown.length ? UI.line({ labels: nwShown.map(x => monShort(x.k)), values: nwShown.map(x => x.v) }) : '<div class="empty">Sem dados</div>'}</div>
  <div class="sec"><span class="sec-t">Comparação entre meses</span></div>
  <div class="card" style="padding:8px 12px;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px" class="num"><tr style="color:var(--tx3)"><th style="text-align:left;padding:6px 4px;font-weight:600">Mês</th><th style="text-align:right;font-weight:600">Entradas</th><th style="text-align:right;font-weight:600">Saídas</th><th style="text-align:right;font-weight:600">Saldo</th></tr>${R.months.filter(m => m.k <= ym(today())).reverse().map(m => `<tr style="border-top:1px solid var(--line)"><td style="padding:8px 4px">${monShort(m.k)}/${m.k.slice(2, 4)}</td><td style="text-align:right" class="ok">${moneyShort(m.inc)}</td><td style="text-align:right">${moneyShort(m.exp)}</td><td style="text-align:right" class="${m.net < 0 ? 'bad' : ''}">${moneyShort(m.net)}</td></tr>`).join('')}</table></div>
  </div>`;
};

/* ---------- CONFIGURAÇÕES ---------- */
Screens.security = () => {
  const s = S.settings;
  return `<div class="screen sub">${topBar('Segurança', { back: true })}
  <div class="list">
    ${menuItem('lock', s.pin ? 'Alterar PIN' : 'Criar PIN de acesso', s.pin ? 'PIN de 4 a 6 dígitos ativo' : 'Protege o app ao abrir', 'data-a="setPin"')}
    ${s.pin ? menuItem('finger', 'Desbloqueio por biometria', s.bio ? 'Ativo neste aparelho' : 'Use a digital ou o rosto do Galaxy', 'data-a="toggleBio"', `<span class="sw ${s.bio ? 'on' : ''}"></span>`) : ''}
    ${s.pin ? menuItem('clock', 'Bloquear após', s.lockAfter === 0 ? 'Imediatamente ao sair' : `${s.lockAfter} min fora do app`, 'data-a="lockAfter"') : ''}
    ${s.pin ? menuItem('x', 'Remover bloqueio', '', 'data-a="removePin"') : ''}
  </div>
  <div class="card small muted" style="line-height:1.55">
    <b style="color:var(--tx)">Como seus dados são protegidos</b><br>
    • Tudo fica armazenado apenas neste aparelho, no armazenamento do app. Nada é enviado para servidores.<br>
    • O PIN é guardado como hash (PBKDF2-SHA256 com 120 mil iterações), nunca em texto.<br>
    • A biometria usa o sensor do próprio Android (WebAuthn); o app só recebe "aprovado" ou "negado".<br>
    • O app nunca pede nem guarda senhas de banco.<br>
    • O bloqueio protege o acesso pela tela do app. Para proteção total, mantenha também o bloqueio de tela do celular ativo.
  </div></div>`;
};
Screens.notifications = () => {
  const n = S.settings.notif, perm = PFsys.notifPermission();
  return `<div class="screen sub">${topBar('Notificações e lembretes', { back: true })}
  <div class="list">${menuItem('bell', 'Notificações no celular', perm === 'denied' ? 'Bloqueadas nas configurações do Android' : perm === 'unsupported' ? 'Indisponível neste navegador' : n.enabled ? 'Ativadas' : 'Desativadas', 'data-a="toggleNotif"', `<span class="sw ${n.enabled && perm === 'granted' ? 'on' : ''}"></span>`)}
  ${menuItem('clock', 'Lembretes padrão de contas', n.offsets.map(d => d ? d + ' dias antes' : 'no dia').join(', '), 'data-a="notifOffsets"')}
  ${menuItem('bell', 'Enviar notificação de teste', '', 'data-a="testNotif"')}</div>
  <div class="card small muted" style="line-height:1.55"><b style="color:var(--tx)">Você recebe lembretes de:</b><br>• Contas a pagar: 7, 3, 1 dia antes e no dia (personalizável por conta)<br>• Faturas de cartão: 3 dias antes e no vencimento<br>• Orçamento: ao atingir 70%, 90% e 100%<br>• Investimentos: revisões, aportes, rendimentos e vencimentos<br>• Aportes programados das metas</div>
  <div class="card small muted" style="line-height:1.55"><b style="color:var(--tx)">Como funcionam no Android</b><br>Com o app instalado, os lembretes são verificados sempre que você abre o app e também em segundo plano pelo Chrome (sincronização periódica). O Chrome decide a frequência da verificação em segundo plano (no máximo a cada ~12 horas, conforme o uso do app), então um lembrete pode chegar algumas horas depois do horário ideal. Para garantir, deixe o Chrome sem restrição de bateria em Configurações → Aplicativos → Chrome → Bateria.</div></div>`;
};
Screens.backup = () => `<div class="screen sub">${topBar('Backup e restauração', { back: true })}
  <div class="card"><div class="row"><div class="av ac">${ic('cloud', 'sm')}</div><div class="col grow"><b style="font-weight:600">Fazer backup agora</b><span class="small muted">${S.settings.lastBackup ? 'Último: ' + fmtDate(S.settings.lastBackup) : 'Nenhum backup ainda'}</span></div></div>
  <p class="small muted">Gera um arquivo .json com todos os seus dados. Guarde no Google Drive, e-mail ou no próprio celular.</p>
  <button class="btn" data-a="doBackup">${ic('download', 'sm')}Baixar backup</button></div>
  <div class="card"><div class="row"><div class="av">${ic('upload', 'sm')}</div><div class="col grow"><b style="font-weight:600">Restaurar backup</b><span class="small muted">Substitui os dados atuais pelos do arquivo</span></div></div>
  <label class="btn sec mt12">${ic('upload', 'sm')}Escolher arquivo .json<input type="file" accept=".json,application/json" id="restoreFile" hidden></label></div>
  <div class="card"><div class="row"><div class="av">${ic('download', 'sm')}</div><div class="col grow"><b style="font-weight:600">Exportar planilha completa</b><span class="small muted">Todos os lançamentos, contas, metas e investimentos em Excel</span></div></div>
  <button class="btn sec mt12" data-a="exportAll">${ic('download', 'sm')}Exportar Excel</button></div>
  <div class="card flat xs faint">Os dados ficam só neste aparelho. Se você limpar os dados do Chrome ou trocar de celular sem backup, eles serão perdidos.</div></div>`;
Screens.data = () => `<div class="screen sub">${topBar('Dados de exemplo', { back: true })}
  <div class="card small muted" style="line-height:1.55">${S.settings.sample ? 'O app está com <b style="color:var(--tx)">dados fictícios</b> (lançamentos, contas, metas, investimentos, desafios e XP) para você ver tudo funcionando. Apagar remove apenas o que é exemplo: o que você cadastrou continua.' : 'Os dados de exemplo estão desativados. Você pode carregá-los de novo para explorar — eles ficam marcados e podem ser apagados depois.'}</div>
  ${S.settings.sample ? `<button class="btn danger" data-a="clearSample">${ic('trash', 'sm')}Apagar dados de exemplo</button>` : `<button class="btn sec" data-a="loadSample">Carregar dados de exemplo</button>`}
  <div class="sec"><span class="sec-t">Zona de risco</span></div>
  <button class="btn ghost" data-a="resetAll">${ic('trash', 'sm')}Apagar todos os dados do app</button></div>`;
Screens.openfinance = () => `<div class="screen sub">${topBar('Integração bancária', { back: true })}
  <div class="card small muted" style="line-height:1.6"><b style="color:var(--tx)">Como o app obtém seus saldos</b><br>Hoje os valores vêm dos seus lançamentos manuais e de extratos importados (CSV ou OFX). Mercado Pago, Nubank e Viacredi permitem exportar extratos pelo app ou internet banking.</div>
  <button class="btn" data-a="import">${ic('upload', 'sm')}Importar extrato agora</button>
  <div class="card small muted mt12" style="line-height:1.6"><b style="color:var(--tx)">Sobre o Open Finance</b><br>A sincronização automática no Brasil só é permitida por instituições autorizadas pelo Banco Central, por meio de provedores (agregadores) contratados, com consentimento dado dentro do app do seu banco. Isso exige um servidor e um contrato com o provedor, por isso não está ativo nesta versão que roda só no seu aparelho.<br><br>O que o Pink Finance nunca faz: pedir senha de banco, guardar credenciais ou acessar sua conta por "raspagem" de tela.</div>
  <div class="card small muted" style="line-height:1.6"><b style="color:var(--tx)">Como exportar seus extratos</b><br>No app ou internet banking do Mercado Pago, Nubank ou Viacredi, procure a opção de exportar/baixar o extrato da conta ou a fatura do cartão em <b>CSV</b> ou <b>OFX</b>. Depois use "Importar extrato": o Pink Finance reconhece data, descrição e valor, sugere categorias e ignora lançamentos repetidos.</div></div>`;
Screens.install = () => `<div class="screen sub">${topBar('Instalar no Galaxy S26', { back: true })}
  ${PFsys.isStandalone() ? `<div class="banner">${ic('checkc', 'sm')}<span class="grow"><b>App instalado.</b> Você está usando a versão instalada.</span></div>` : ''}
  ${PFsys.canInstall() ? `<button class="btn" data-a="installApp">${ic('download', 'sm')}Instalar agora</button>` : ''}
  <div class="card small muted" style="line-height:1.65"><b style="color:var(--tx)">Passo a passo</b><br>1. Abra o endereço do Pink Finance no <b>Chrome</b> do Galaxy.<br>2. Toque nos três pontos (⋮) no canto superior.<br>3. Toque em <b>Adicionar à tela inicial</b> → <b>Instalar</b>.<br>4. O ícone aparece na tela inicial e na gaveta de apps. O app abre em tela cheia, funciona sem internet e envia notificações.<br><br>No Samsung Internet: menu (≡) → <b>Adicionar página a</b> → <b>Tela inicial</b>.</div>
  <div class="card small muted" style="line-height:1.6"><b style="color:var(--tx)">Limites de um app web instalado (PWA)</b><br>• Notificações em segundo plano dependem do agendamento do Android/Chrome e podem atrasar algumas horas.<br>• Integração bancária automática exige servidor e provedor autorizado (veja Integração bancária).<br>• Os dados ficam no armazenamento do Chrome: faça backup periódico.</div></div>`;
