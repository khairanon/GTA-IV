/* Pink Finance — operações e formulários */
'use strict';
const Act = {};
const accOptions = (withNone, noneLabel = 'Nenhuma (fora das contas)') => (withNone ? [['', noneLabel]] : []).concat(activeAccounts().map(a => [a.id, a.name]));
const catOpts = arr => arr.map(c => [c, c]);
const firstAcc = () => (activeAccounts()[0] || {}).id || '';
function commit(msg) { afterChange(); App.render(); if (msg) UI.toast(msg); }

/* ---------- orçamento: alertas 70/90/100% ---------- */
function checkBudget(cat, k) {
  const lim = S.budgets[cat]; if (!lim) return;
  const p = catSpent(cat, k) / lim, key = k + '|' + cat, prev = S.budgetAlerts[key] || 0;
  const lvl = p >= 1 ? 100 : p >= .9 ? 90 : p >= .7 ? 70 : 0;
  if (lvl > prev && k === ym(today())) {
    S.budgetAlerts[key] = lvl;
    const msg = lvl === 100 ? `Orçamento de ${cat} ultrapassado (${fmtPct(p)})` : `Você usou ${lvl}% do orçamento de ${cat}`;
    setTimeout(() => UI.toast(msg, 'alert', lvl === 100 ? 'bad' : ''), 400);
    PFsys.notify('Orçamento: ' + cat, msg, 'budget-' + key);
  }
}

/* ---------- lançamentos ---------- */
Act.txForm = (preset = {}, existing = null) => {
  const t = existing;
  if (t && !['receita', 'despesa', 'transferencia'].includes(t.type)) return Act.simpleTxForm(t);
  const v = t ? { type: t.type, amount: t.amount, desc: t.desc, catIn: t.type === 'receita' ? t.category : CAT_IN[0], catOut: t.type === 'despesa' ? t.category : CAT_OUT[0], date: t.date, accountId: t.accountId, toAccountId: t.toAccountId || '', method: t.method || 'pix', recurrence: 'none', notes: t.notes || '' }
    : Object.assign({ type: 'despesa', amount: '', desc: '', catIn: CAT_IN[0], catOut: CAT_OUT[0], date: today(), accountId: firstAcc(), toAccountId: (activeAccounts()[1] || {}).id || '', method: 'pix', recurrence: 'none', notes: '' }, preset);
  const isT = x => x.type === 'transferencia';
  const fields = [
    { k: 'type', type: 'seg', options: [['despesa', 'Despesa'], ['receita', 'Receita'], ['transferencia', 'Transferência']] },
    { k: 'amount', label: 'Valor', type: 'money', req: true },
    { k: 'desc', label: 'Descrição', type: 'text', ph: 'Ex.: Mercado da semana' },
    { k: 'catOut', label: 'Categoria', type: 'select', options: catOpts(CAT_OUT), show: x => x.type === 'despesa' },
    { k: 'catIn', label: 'Categoria', type: 'select', options: catOpts(CAT_IN), show: x => x.type === 'receita' },
    { k: 'date', label: 'Data', type: 'date', req: true },
    { k: 'accountId', label: 'Conta', type: 'select', options: accOptions(), req: true, show: x => !isT(x) },
    { k: 'accountIdT', label: 'De', type: 'select', options: accOptions(), show: isT },
    { k: 'toAccountId', label: 'Para', type: 'select', options: accOptions(), show: isT, validate: (val, x) => val === x.accountIdT ? 'Escolha contas diferentes' : null },
    { k: 'method', label: 'Forma de pagamento', type: 'select', options: METHODS, show: x => x.type === 'despesa', validate: (val, x) => val === 'credito' && !hasCard(acc(x.accountId)) ? 'Esta conta não tem cartão de crédito ativo' : null },
    { k: 'methodIn', label: 'Forma de recebimento', type: 'select', options: [['pix', 'Pix'], ['ted', 'Transferência/TED'], ['dinheiro', 'Dinheiro'], ['debito', 'Depósito']], show: x => x.type === 'receita' },
    { k: 'recurrence', label: 'Recorrência', type: 'select', options: RECUR, show: x => !isT(x) && !t, hint: 'Lançamentos recorrentes são criados automaticamente nas próximas datas.' },
    { k: 'notes', label: 'Observações', type: 'textarea', ph: 'Opcional' }
  ];
  v.accountIdT = v.accountId; v.methodIn = v.type === 'receita' ? v.method : 'pix';
  UI.form({
    title: t ? 'Editar lançamento' : 'Novo lançamento', fields, values: v, submit: t ? 'Salvar' : 'Lançar',
    onSubmit(x) {
      const n = t || { id: uid(), created: new Date().toISOString() };
      n.type = x.type; n.amount = x.amount; n.desc = x.desc; n.date = x.date; n.notes = x.notes;
      if (x.type === 'transferencia') { n.accountId = x.accountIdT; n.toAccountId = x.toAccountId; n.category = ''; n.method = 'ted'; }
      else { n.accountId = x.accountId; delete n.toAccountId; n.category = x.type === 'receita' ? x.catIn : x.catOut; n.method = x.type === 'receita' ? x.methodIn : x.method; }
      if (!t) {
        S.tx.push(n);
        if (x.recurrence !== 'none' && x.type !== 'transferencia') {
          const day = +x.date.slice(8, 10), r = { id: uid(), freq: x.recurrence, day, next: nextDate(x.date, x.recurrence, day), tpl: { type: n.type, amount: n.amount, desc: n.desc, category: n.category, accountId: n.accountId, method: n.method, notes: n.notes, recurrence: x.recurrence } };
          S.recurring.push(r); n.recurringId = r.id; n.recurrence = x.recurrence;
          processRecurring();
        }
        if (x.type !== 'transferencia') addXP('registro');
        markActive();
      }
      if (n.type === 'despesa') checkBudget(n.category, ym(n.date));
      commit(t ? 'Lançamento atualizado' : (x.type === 'transferencia' ? 'Transferência registrada' : 'Lançamento registrado'));
    }
  });
};
Act.simpleTxForm = t => {
  UI.form({
    title: 'Editar ' + TX_TYPE_L[t.type].toLowerCase(),
    fields: [
      { k: 'amount', label: t.type === 'ajuste' ? 'Valor do ajuste (use - para reduzir)' : 'Valor', type: t.type === 'ajuste' ? 'text' : 'money', req: true },
      { k: 'date', label: 'Data', type: 'date', req: true },
      { k: 'desc', label: 'Descrição', type: 'text' },
      { k: 'notes', label: 'Observações', type: 'textarea' }
    ],
    values: { amount: t.type === 'ajuste' ? centsToInput(t.amount) : t.amount, date: t.date, desc: t.desc, notes: t.notes },
    note: (t.type === 'investimento' || t.type === 'resgate_inv') ? 'Para mudar o valor de um investimento, use a tela do investimento.' : '',
    onSubmit(x) {
      if (t.type === 'ajuste') { const a = parseMoney(x.amount); if (isNaN(a) || !a) return 'Valor inválido'; t.amount = a; }
      else if (t.type === 'investimento' || t.type === 'resgate_inv') { /* valor preservado */ }
      else t.amount = x.amount;
      t.date = x.date; t.desc = x.desc; t.notes = x.notes;
      commit('Lançamento atualizado');
    }
  });
};
Act.deleteTx = async t => {
  if (!await UI.confirm('Excluir lançamento?', `${txTitle(t)} · ${money(t.amount, { force: true })}. Saldos, gráficos e relatórios serão recalculados.`, 'Excluir')) return false;
  if (t.billId) { const b = billById(t.billId); if (b) { b.paidAt = null; b.paidTxId = null; } }
  if (t.type === 'investimento' && t.invId) { const i = invById(t.invId); if (i) { i.principal = Math.max(0, i.principal - t.amount); i.current = Math.max(0, i.current - t.amount); i.history.push({ date: today(), value: i.current }); } }
  if (t.type === 'resgate_inv' && t.invId) { const i = invById(t.invId); if (i) { i.principal += t.cost || 0; i.current += t.amount; i.closed = false; i.history.push({ date: today(), value: i.current }); } }
  S.tx = S.tx.filter(x => x.id !== t.id);
  commit('Lançamento excluído');
  return true;
};
Act.stopRecurring = async rid => {
  const r = S.recurring.find(x => x.id === rid); if (!r) return;
  if (!await UI.confirm('Encerrar recorrência?', 'Os lançamentos já criados continuam. Nenhum novo será gerado.', 'Encerrar')) return;
  r.stopped = true; commit('Recorrência encerrada');
};
Act.txDetail = t => {
  const a = acc(t.accountId), sign = txSign(t);
  const rows = [
    ['Tipo', TX_TYPE_L[t.type]], ['Valor', money(t.amount, { force: true })], ['Data', fmtDate(t.date) + (t.date > today() ? ' (agendado)' : '')],
    t.category ? ['Categoria', t.category] : null,
    t.type === 'transferencia' ? ['De → Para', `${accName(t.accountId)} → ${accName(t.toAccountId)}`] : (a ? ['Conta', a.name] : ['Conta', 'Fora das contas']),
    t.method ? ['Forma', METHOD_L[t.method] || t.method] : null,
    t.method === 'credito' && a && hasCard(a) ? ['Fatura', monthLabel(invoiceKeyFor(a, t.date))] : null,
    t.recurringId ? ['Recorrência', (RECUR.find(r => r[0] === ((S.recurring.find(r => r.id === t.recurringId) || {}).freq)) || [0, 'Recorrente'])[1] + ((S.recurring.find(r => r.id === t.recurringId) || {}).stopped ? ' (encerrada)' : '')] : null,
    t.billId ? ['Conta a pagar', (billById(t.billId) || {}).name || '—'] : null,
    t.imported ? ['Origem', 'Importado de extrato'] : null,
    t.notes ? ['Observações', t.notes] : null
  ].filter(Boolean);
  const rec = t.recurringId && !(S.recurring.find(r => r.id === t.recurringId) || {}).stopped;
  const sh = UI.sheet({
    title: txTitle(t),
    body: `<div class="center" style="margin:4px 0 14px"><div class="av ac round" style="width:52px;height:52px;margin:0 auto 10px">${ic(txIcon(t), 'lg')}</div><div class="num ${sign > 0 ? 'ok' : ''}" style="font-size:28px;font-weight:650">${sign > 0 ? '+' : sign < 0 ? '−' : ''}${money(Math.abs(t.amount), { force: true })}</div></div>${rows.map(r => `<div class="kv"><span>${esc(r[0])}</span><span>${esc(r[1])}</span></div>`).join('')}`,
    footer: `<div class="btns"><button class="btn danger" data-d>${ic('trash', 'sm')}Excluir</button>${['receita', 'despesa'].includes(t.type) ? `<button class="btn sec" data-dup>Duplicar</button>` : ''}<button class="btn" data-e>${ic('edit', 'sm')}Editar</button></div>${rec ? `<button class="btn ghost mt8" data-stop>${ic('repeat', 'sm')}Encerrar recorrência</button>` : ''}`,
    onMount(api) {
      api.el.addEventListener('click', async e => {
        if (e.target.closest('[data-e]')) { api.close(); setTimeout(() => Act.txForm({}, t), 260); }
        if (e.target.closest('[data-dup]')) { api.close(); setTimeout(() => Act.txForm({ type: t.type, amount: t.amount, desc: t.desc, catIn: t.category, catOut: t.category, accountId: t.accountId, method: t.method, notes: t.notes }), 260); }
        if (e.target.closest('[data-d]')) { api.close(); setTimeout(() => Act.deleteTx(t), 260); }
        if (e.target.closest('[data-stop]')) { api.close(); setTimeout(() => Act.stopRecurring(t.recurringId), 260); }
      });
    }
  });
};

/* ---------- contas ---------- */
Act.accountForm = a => {
  const v = a ? { name: a.name, bank: a.bank, short: a.short, color: a.color, initial: a.initial, cardOn: hasCard(a), limit: a.card ? a.card.limit : 0, closing: a.card ? a.card.closing : 1, due: a.card ? a.card.due : 10 }
    : { name: '', bank: '', short: '', color: ACC_COLORS[S.accounts.length % ACC_COLORS.length], initial: '', cardOn: false, limit: '', closing: 1, due: 10 };
  UI.form({
    title: a ? 'Editar conta' : 'Nova conta',
    fields: [
      { k: 'name', label: 'Nome da conta', type: 'text', req: true, ph: 'Ex.: Inter, Caixa, Carteira' },
      { k: 'bank', label: 'Banco / instituição', type: 'text', ph: 'Identificação do banco' },
      { k: 'short', label: 'Sigla (até 3 letras)', type: 'text', ph: 'Ex.: IN' },
      { k: 'color', label: 'Cor de identificação', type: 'color' },
      { k: 'initial', label: 'Saldo inicial', type: 'text', hint: 'Saldo da conta no dia em que começou a usar o app. Pode ser negativo (use -).' },
      { k: 'cardOn', label: 'Tem cartão de crédito', type: 'toggle' },
      { k: 'limit', label: 'Limite do cartão', type: 'money', show: x => x.cardOn },
      { k: 'closing', label: 'Dia de fechamento da fatura', type: 'number', min: 1, max: 31, show: x => x.cardOn, validate: (n, x) => x.cardOn && !(n >= 1 && n <= 31) ? 'Dia entre 1 e 31' : null },
      { k: 'due', label: 'Dia de vencimento da fatura', type: 'number', min: 1, max: 31, show: x => x.cardOn, validate: (n, x) => x.cardOn && !(n >= 1 && n <= 31) ? 'Dia entre 1 e 31' : null }
    ],
    values: Object.assign({}, v, { initial: typeof v.initial === 'number' ? centsToInput(v.initial) || '0' : '' }),
    extra: a ? [{ label: 'Excluir', cls: 'danger', icon: 'trash', onClick: (x, api) => { api.close(); setTimeout(() => Act.deleteAccount(a), 260); } }] : [],
    onSubmit(x) {
      const init = parseMoney(x.initial || '0'); if (isNaN(init)) return { initial: 'Valor inválido' };
      const n = a || { id: uid() };
      n.name = x.name; n.bank = x.bank || x.name; n.short = (x.short || x.name.slice(0, 2)).toUpperCase().slice(0, 3); n.color = x.color; n.initial = init;
      n.card = { enabled: !!x.cardOn, limit: x.limit || 0, closing: x.closing || 1, due: x.due || 10 };
      if (!a) S.accounts.push(n);
      commit(a ? 'Conta atualizada' : 'Conta adicionada');
    }
  });
};
Act.deleteAccount = async a => {
  const used = S.tx.some(t => t.accountId === a.id || t.toAccountId === a.id || t.cardId === a.id);
  if (used) {
    if (!await UI.confirm('Arquivar conta?', 'Esta conta tem movimentações. Ela será arquivada: some das listas e do saldo total, mas o histórico continua nos relatórios.', 'Arquivar')) return;
    a.archived = true;
  } else {
    if (!await UI.confirm('Excluir conta?', `A conta ${a.name} será removida.`, 'Excluir')) return;
    S.accounts = S.accounts.filter(x => x.id !== a.id);
  }
  App.stack = App.stack.filter(s => !(s.screen === 'account' && s.params.id === a.id));
  commit('Conta removida');
};
Act.adjust = a => {
  const cur = balance(a.id);
  UI.form({
    title: 'Ajustar saldo · ' + a.name,
    note: `Saldo no app: <b>${money(cur, { force: true })}</b>. Informe o saldo real do banco; a diferença vira um lançamento de ajuste (não conta como receita ou despesa).`,
    fields: [{ k: 'real', label: 'Saldo real hoje', type: 'text', req: true }],
    values: { real: centsToInput(cur) || '0' },
    onSubmit(x) {
      const real = parseMoney(x.real); if (isNaN(real)) return { real: 'Valor inválido' };
      const diff = real - cur; if (!diff) return true;
      S.tx.push({ id: uid(), type: 'ajuste', amount: diff, desc: 'Ajuste de saldo', date: today(), accountId: a.id, created: new Date().toISOString(), notes: '' });
      commit('Saldo ajustado');
    }
  });
};

/* ---------- faturas ---------- */
Act.payInvoice = inv => {
  const card = acc(inv.accountId);
  UI.form({
    title: 'Pagar fatura · ' + card.name,
    note: `Fatura de ${monthLabel(inv.key)} · vence ${fmtDate(inv.due)} · em aberto <b>${money(inv.remaining, { force: true })}</b>`,
    fields: [
      { k: 'amount', label: 'Valor do pagamento', type: 'money', req: true, validate: v => v > inv.remaining ? 'Maior que o valor em aberto' : null },
      { k: 'accountId', label: 'Pagar com saldo de', type: 'select', options: accOptions(), req: true },
      { k: 'date', label: 'Data', type: 'date', req: true }
    ],
    values: { amount: inv.remaining, accountId: card.id, date: today() },
    onSubmit(x) {
      S.tx.push({ id: uid(), type: 'fatura', amount: x.amount, desc: '', date: x.date, accountId: x.accountId, cardId: card.id, invoiceKey: inv.key, method: 'pix', created: new Date().toISOString(), notes: '' });
      if (x.amount >= inv.remaining && x.date <= inv.due) addXP('fatura_em_dia');
      markActive();
      commit('Pagamento de fatura registrado');
    }
  });
};
Act.invoiceDetail = inv => {
  const card = acc(inv.accountId);
  const st = { aberta: ['Aberta', ''], fechada: ['Fechada', 'warn'], atrasada: ['Atrasada', 'bad'], paga: ['Paga', 'ok'] }[inv.status];
  const items = inv.items.slice().sort((a, b) => b.date.localeCompare(a.date));
  const sh = UI.sheet({
    title: `Fatura ${monthLabel(inv.key)}`,
    body: `<div class="between" style="margin-bottom:8px"><span class="pill ${st[1]}">${st[0]}</span><span class="small muted">${card.name}</span></div>
      <div class="kv"><span>Total</span><span>${money(inv.total, { force: true })}</span></div>
      <div class="kv"><span>Pago</span><span>${money(inv.paid, { force: true })}</span></div>
      <div class="kv"><span>Em aberto</span><span>${money(inv.remaining, { force: true })}</span></div>
      <div class="kv"><span>Fechamento</span><span>${fmtDate(inv.close)}</span></div>
      <div class="kv"><span>Vencimento</span><span>${fmtDate(inv.due)}</span></div>
      <div class="sec-t mt16">Compras (${items.length})</div>
      <div class="list">${items.length ? items.map(t => `<div class="li"><div class="av">${ic(txIcon(t), 'sm')}</div><div class="col grow"><span class="t ell">${esc(txTitle(t))}</span><span class="s">${fmtDay(t.date)} · ${esc(t.category)}</span></div><span class="amt num">${money(t.amount, { force: true })}</span></div>`).join('') : '<div class="empty">Nenhuma compra nesta fatura</div>'}</div>`,
    footer: inv.remaining > 0 ? `<button class="btn" data-pay>${ic('card', 'sm')}Pagar fatura</button>` : '',
    onMount(api) { api.el.addEventListener('click', e => { if (e.target.closest('[data-pay]')) { api.close(); setTimeout(() => Act.payInvoice(inv), 260); } }); }
  });
};

/* ---------- contas a pagar ---------- */
const REM_OPTS = [[15, '15 dias'], [7, '7 dias'], [3, '3 dias'], [2, '2 dias'], [1, '1 dia'], [0, 'No dia']];
Act.billForm = b => {
  const v = b ? { name: b.name, amount: b.amount, due: b.due, category: b.category, accountId: b.accountId, recurring: b.recurring, reminders: b.reminders.map(String), notes: b.notes || '' }
    : { name: '', amount: '', due: addDays(today(), 7), category: 'Contas fixas', accountId: firstAcc(), recurring: true, reminders: S.settings.notif.offsets.map(String), notes: '' };
  UI.form({
    title: b ? 'Editar conta a pagar' : 'Nova conta a pagar',
    fields: [
      { k: 'name', label: 'Nome da conta', type: 'text', req: true, ph: 'Ex.: Energia, Internet, Aluguel' },
      { k: 'amount', label: 'Valor', type: 'money', req: true },
      { k: 'due', label: 'Vencimento', type: 'date', req: true },
      { k: 'category', label: 'Categoria', type: 'select', options: catOpts(CAT_OUT) },
      { k: 'accountId', label: 'Banco para pagamento', type: 'select', options: accOptions() },
      { k: 'recurring', label: 'Repetir todo mês', type: 'toggle', hint: 'Ao pagar, a próxima é criada automaticamente.' },
      { k: 'reminders', label: 'Lembrar antes do vencimento', type: 'chips', options: REM_OPTS.map(([d, l]) => [String(d), l]) },
      { k: 'notes', label: 'Observações', type: 'textarea' }
    ],
    values: v,
    extra: b ? [{ label: 'Excluir', cls: 'danger', icon: 'trash', onClick: async (x, api) => { api.close(); if (await UI.confirm('Excluir conta a pagar?', b.paidTxId ? 'O lançamento de pagamento continua nas movimentações.' : b.name, 'Excluir')) { S.bills = S.bills.filter(y => y.id !== b.id); commit('Conta excluída'); } } }] : [],
    onSubmit(x) {
      const n = b || { id: uid() };
      Object.assign(n, { name: x.name, amount: x.amount, due: x.due, day: +x.due.slice(8, 10), category: x.category, accountId: x.accountId, recurring: x.recurring, reminders: x.reminders.map(Number).sort((p, q) => q - p), notes: x.notes });
      if (!b) { S.bills.push(n); markActive(); }
      commit(b ? 'Conta atualizada' : 'Conta a pagar adicionada');
    }
  });
};
Act.payBill = b => {
  UI.form({
    title: 'Pagar · ' + b.name,
    note: `Vencimento ${fmtDate(b.due)} (${relDay(b.due)})`,
    fields: [
      { k: 'amount', label: 'Valor pago', type: 'money', req: true },
      { k: 'accountId', label: 'Conta usada', type: 'select', options: accOptions(), req: true },
      { k: 'method', label: 'Forma de pagamento', type: 'select', options: METHODS, validate: (val, x) => val === 'credito' && !hasCard(acc(x.accountId)) ? 'Esta conta não tem cartão ativo' : null },
      { k: 'date', label: 'Data do pagamento', type: 'date', req: true }
    ],
    values: { amount: b.amount, accountId: b.accountId || firstAcc(), method: 'boleto', date: today() },
    onSubmit(x) {
      const t = { id: uid(), type: 'despesa', amount: x.amount, desc: b.name, category: b.category, date: x.date, accountId: x.accountId, method: x.method, billId: b.id, created: new Date().toISOString(), notes: '' };
      S.tx.push(t); b.paidAt = x.date; b.paidTxId = t.id;
      const d = daysBetween(x.date, b.due);
      if (d > 0) addXP('conta_antecipada'); else if (d === 0) addXP('conta_no_dia'); else addXP('conta_atrasada');
      markActive(); processRecurring(); checkBudget(b.category, ym(x.date));
      commit('Conta paga');
    }
  });
};
Act.unpayBill = async b => {
  if (!await UI.confirm('Desfazer pagamento?', 'O lançamento do pagamento será excluído e a conta volta a ficar pendente.', 'Desfazer')) return;
  S.tx = S.tx.filter(t => t.id !== b.paidTxId); b.paidAt = null; b.paidTxId = null; commit('Pagamento desfeito');
};
Act.billDetail = b => {
  const st = billStatus(b);
  UI.sheet({
    title: b.name,
    body: `<div class="between" style="margin-bottom:6px"><span class="pill ${BILL_C[st]}">${BILL_L[st]}</span><span class="num" style="font-size:22px;font-weight:650">${money(b.amount, { force: true })}</span></div>
      <div class="kv"><span>Vencimento</span><span>${fmtDate(b.due)} · ${relDay(b.due)}</span></div>
      <div class="kv"><span>Categoria</span><span>${esc(b.category)}</span></div>
      <div class="kv"><span>Banco</span><span>${esc(accName(b.accountId))}</span></div>
      <div class="kv"><span>Recorrência</span><span>${b.recurring ? 'Mensal' : 'Única'}</span></div>
      <div class="kv"><span>Lembretes</span><span>${b.reminders.length ? b.reminders.map(d => d ? d + 'd' : 'no dia').join(', ') : 'Nenhum'}</span></div>
      ${b.paidAt ? `<div class="kv"><span>Paga em</span><span>${fmtDate(b.paidAt)}</span></div>` : ''}
      ${b.notes ? `<div class="kv"><span>Observações</span><span>${esc(b.notes)}</span></div>` : ''}`,
    footer: `<div class="btns"><button class="btn sec" data-e>${ic('edit', 'sm')}Editar</button>${b.paidAt ? `<button class="btn ghost" data-u>Desfazer pagamento</button>` : `<button class="btn" data-p>${ic('check', 'sm')}Marcar como paga</button>`}</div>`,
    onMount(api) {
      api.el.addEventListener('click', e => {
        if (e.target.closest('[data-e]')) { api.close(); setTimeout(() => Act.billForm(b), 260); }
        if (e.target.closest('[data-p]')) { api.close(); setTimeout(() => Act.payBill(b), 260); }
        if (e.target.closest('[data-u]')) { api.close(); setTimeout(() => Act.unpayBill(b), 260); }
      });
    }
  });
};

/* ---------- metas ---------- */
Act.goalForm = g => {
  const v = g ? { name: g.name, target: g.target, initial: g.initial, deadline: g.deadline, monthly: g.monthly, aporteDay: g.aporteDay || '', category: g.category, icon: g.icon, image: g.image }
    : { name: '', target: '', initial: '', deadline: addMonths(today(), 6), monthly: '', aporteDay: 5, category: GOAL_CATS[0], icon: 'target', image: null };
  UI.form({
    title: g ? 'Editar meta' : 'Nova meta',
    fields: [
      { k: 'name', label: 'Nome da meta', type: 'text', req: true, ph: 'Ex.: Comprar um celular' },
      { k: 'target', label: 'Valor desejado', type: 'money', req: true },
      { k: 'initial', label: 'Valor já acumulado', type: 'money', hint: 'Quanto você já tem guardado para esta meta (fora dos aportes registrados aqui).' },
      { k: 'deadline', label: 'Prazo final', type: 'date', req: true, validate: d => !g && d <= today() ? 'O prazo precisa ser no futuro' : null },
      { k: 'monthly', label: 'Contribuição mensal desejada', type: 'money', hint: 'Opcional. O app calcula também o valor necessário para cumprir o prazo.' },
      { k: 'aporteDay', label: 'Dia do aporte programado', type: 'number', min: 1, max: 31, hint: 'Aparece no calendário e gera lembrete.' },
      { k: 'category', label: 'Categoria', type: 'select', options: catOpts(GOAL_CATS) },
      { k: 'icon', label: 'Ícone', type: 'icon' },
      { k: 'image', label: 'Imagem personalizada', type: 'image' }
    ],
    values: v,
    extra: g ? [{ label: 'Excluir', cls: 'danger', icon: 'trash', onClick: (x, api) => { api.close(); setTimeout(() => Act.deleteGoal(g), 260); } }] : [],
    onSubmit(x) {
      const n = g || { id: uid(), created: today() };
      Object.assign(n, { name: x.name, target: x.target, initial: x.initial || 0, deadline: x.deadline, monthly: x.monthly || 0, aporteDay: x.aporteDay ? clamp(x.aporteDay, 1, 31) : null, category: x.category, icon: x.icon, image: x.image });
      if (g && goalSaved(n) < n.target) n.completedAt = null;
      if (!g) { S.goals.push(n); markActive(); }
      commit(g ? 'Meta atualizada' : 'Meta criada');
    }
  });
};
Act.deleteGoal = async g => {
  const n = S.tx.filter(t => t.goalId === g.id).length;
  if (!await UI.confirm('Excluir meta?', n ? `Os ${n} aportes/resgates desta meta também serão excluídos e o dinheiro volta ao saldo das contas.` : g.name, 'Excluir')) return;
  S.tx = S.tx.filter(t => t.goalId !== g.id); S.goals = S.goals.filter(x => x.id !== g.id);
  App.stack = App.stack.filter(s => !(s.screen === 'goal' && s.params.id === g.id));
  commit('Meta excluída');
};
Act.goalMove = (g, withdraw) => {
  const saved = goalSaved(g), plan = goalPlan(g);
  UI.form({
    title: (withdraw ? 'Resgatar de ' : 'Guardar em ') + g.name,
    note: withdraw ? `Acumulado: <b>${money(saved, { force: true })}</b>` : `Faltam <b>${money(plan.remaining, { force: true })}</b>${plan.need ? ` · ideal ${money(plan.need, { force: true })}/mês` : ''}`,
    fields: [
      { k: 'amount', label: 'Valor', type: 'money', req: true, validate: v => withdraw && v > saved ? 'Maior que o valor acumulado' : null },
      { k: 'accountId', label: withdraw ? 'Devolver para' : 'Sair de', type: 'select', options: accOptions(true, withdraw ? 'Nenhuma conta' : 'Dinheiro fora das contas') },
      { k: 'date', label: 'Data', type: 'date', req: true }
    ],
    values: { amount: withdraw ? '' : (g.monthly || ''), accountId: firstAcc(), date: today() },
    onSubmit(x) {
      S.tx.push({ id: uid(), type: withdraw ? 'resgate_meta' : 'meta', amount: x.amount, desc: '', date: x.date, accountId: x.accountId, goalId: g.id, method: 'pix', created: new Date().toISOString(), notes: '' });
      if (!withdraw) addXP('guardar');
      markActive();
      commit(withdraw ? 'Resgate registrado' : 'Valor guardado');
    }
  });
};

/* ---------- investimentos ---------- */
Act.invForm = i => {
  const v = i ? { name: i.name, type: i.type, institution: i.institution, date: i.date, rate: i.rate, liquidity: i.liquidity, maturity: i.maturity, goal: i.goal }
    : { name: '', type: 'CDB', institution: '', principal: '', date: today(), rate: '', liquidity: 'Diária', maturity: '', goal: '', debit: true, accountId: firstAcc() };
  const fields = [
    { k: 'name', label: 'Nome', type: 'text', req: true, ph: 'Ex.: CDB 110% CDI' },
    { k: 'type', label: 'Tipo de investimento', type: 'select', options: catOpts(INV_TYPES) },
    { k: 'institution', label: 'Instituição', type: 'text', ph: 'Banco ou corretora' }
  ];
  if (!i) fields.push({ k: 'principal', label: 'Valor investido', type: 'money', req: true });
  fields.push(
    { k: 'date', label: 'Data da aplicação', type: 'date', req: true },
    { k: 'rate', label: 'Rentabilidade contratada', type: 'text', ph: 'Ex.: 110% do CDI, IPCA + 6%, variável' },
    { k: 'liquidity', label: 'Liquidez', type: 'select', options: catOpts(LIQ) },
    { k: 'maturity', label: 'Data de vencimento (se houver)', type: 'date' },
    { k: 'goal', label: 'Objetivo deste investimento', type: 'text', ph: 'Ex.: Reserva, aposentadoria' }
  );
  if (!i) fields.push({ k: 'debit', label: 'Debitar o valor de uma conta', type: 'toggle', hint: 'Desligue se o dinheiro já estava investido antes.' }, { k: 'accountId', label: 'Conta de origem', type: 'select', options: accOptions(), show: x => x.debit });
  UI.form({
    title: i ? 'Editar investimento' : 'Novo investimento', fields, values: v,
    note: i ? '' : 'O app organiza e acompanha seus investimentos. Ele não faz recomendações nem promete rentabilidade.',
    extra: i ? [{ label: 'Excluir', cls: 'danger', icon: 'trash', onClick: (x, api) => { api.close(); setTimeout(() => Act.deleteInv(i), 260); } }] : [],
    onSubmit(x) {
      if (i) { Object.assign(i, { name: x.name, type: x.type, institution: x.institution, date: x.date, rate: x.rate, liquidity: x.liquidity, maturity: x.maturity, goal: x.goal }); commit('Investimento atualizado'); return; }
      const n = { id: uid(), name: x.name, type: x.type, institution: x.institution, principal: x.principal, current: x.principal, date: x.date, rate: x.rate, liquidity: x.liquidity, maturity: x.maturity, goal: x.goal, accountId: x.debit ? x.accountId : '', history: [{ date: x.date, value: x.principal }] };
      S.investments.push(n);
      S.tx.push({ id: uid(), type: 'investimento', amount: x.principal, desc: '', date: x.date, accountId: x.debit ? x.accountId : '', invId: n.id, method: 'ted', created: new Date().toISOString(), notes: '' });
      markActive();
      commit('Investimento cadastrado');
    }
  });
};
Act.deleteInv = async i => {
  if (!await UI.confirm('Excluir investimento?', 'As aplicações e resgates ligados a ele também serão excluídos e os saldos das contas recalculados.', 'Excluir')) return;
  S.tx = S.tx.filter(t => t.invId !== i.id); S.investments = S.investments.filter(x => x.id !== i.id);
  App.stack = App.stack.filter(s => !(s.screen === 'inv' && s.params.id === i.id));
  commit('Investimento excluído');
};
Act.invUpdate = i => UI.form({
  title: 'Atualizar valor · ' + i.name,
  note: `Investido: <b>${money(i.principal, { force: true })}</b> · valor atual registrado: <b>${money(i.current, { force: true })}</b>`,
  fields: [{ k: 'value', label: 'Valor atual (saldo bruto)', type: 'money', req: true }, { k: 'date', label: 'Data da consulta', type: 'date', req: true }],
  values: { value: i.current, date: today() },
  onSubmit(x) { i.current = x.value; i.history.push({ date: x.date, value: x.value }); i.history.sort((a, b) => a.date.localeCompare(b.date)); markActive(); commit('Valor atualizado'); }
});
Act.invAporte = i => UI.form({
  title: 'Novo aporte · ' + i.name,
  fields: [{ k: 'amount', label: 'Valor do aporte', type: 'money', req: true }, { k: 'accountId', label: 'Sair de', type: 'select', options: accOptions(true, 'Nenhuma conta') }, { k: 'date', label: 'Data', type: 'date', req: true }],
  values: { amount: '', accountId: i.accountId || firstAcc(), date: today() },
  onSubmit(x) {
    i.principal += x.amount; i.current += x.amount; i.closed = false; i.history.push({ date: x.date, value: i.current });
    S.tx.push({ id: uid(), type: 'investimento', amount: x.amount, desc: '', date: x.date, accountId: x.accountId, invId: i.id, method: 'ted', created: new Date().toISOString(), notes: '' });
    markActive(); commit('Aporte registrado');
  }
});
Act.invResgate = i => UI.form({
  title: 'Resgatar · ' + i.name,
  note: `Valor atual: <b>${money(i.current, { force: true })}</b>`,
  fields: [{ k: 'amount', label: 'Valor do resgate', type: 'money', req: true, validate: v => v > i.current ? 'Maior que o valor atual' : null }, { k: 'accountId', label: 'Creditar em', type: 'select', options: accOptions(true, 'Nenhuma conta') }, { k: 'date', label: 'Data', type: 'date', req: true }],
  values: { amount: i.current, accountId: i.accountId || firstAcc(), date: today() },
  onSubmit(x) {
    const cost = i.current > 0 ? Math.round(i.principal * x.amount / i.current) : 0;
    i.principal = Math.max(0, i.principal - cost); i.current -= x.amount; if (i.current <= 0) { i.current = 0; i.closed = true; }
    i.history.push({ date: x.date, value: i.current });
    S.tx.push({ id: uid(), type: 'resgate_inv', amount: x.amount, cost, desc: '', date: x.date, accountId: x.accountId, invId: i.id, method: 'ted', created: new Date().toISOString(), notes: '' });
    markActive(); commit('Resgate registrado');
  }
});
Act.reviewInvestments = () => {
  if (S.game.lastReview && daysBetween(S.game.lastReview, today()) < 7) { UI.toast(`Revisão já feita em ${fmtDate(S.game.lastReview)}. Próxima em ${7 - daysBetween(S.game.lastReview, today())} dia(s).`, 'info'); return; }
  S.game.lastReview = today();
  for (const r of S.invReminders) if (r.kind === 'revisar' && r.date <= today()) advanceReminder(r);
  addXP('revisao_inv'); markActive(); commit();
};
function advanceReminder(r) {
  if (r.freq === 'none') { S.invReminders = S.invReminders.filter(x => x !== r); return; }
  let g = 0; do { r.date = r.freq === 'semanal' ? addDays(r.date, 7) : addMonths(r.date, r.freq === 'anual' ? 12 : 1); } while (r.date <= today() && g++ < 100);
}
Act.reminderDone = r => { advanceReminder(r); markActive(); commit('Lembrete concluído'); };
Act.reminderForm = r => UI.form({
  title: r ? 'Editar lembrete' : 'Novo lembrete de investimento',
  fields: [
    { k: 'kind', label: 'Tipo', type: 'select', options: [['revisar', 'Revisar investimentos'], ['vencimento', 'Conferir vencimento'], ['aporte', 'Fazer novo aporte'], ['rendimento', 'Acompanhar rendimentos']] },
    { k: 'title', label: 'Título', type: 'text', req: true },
    { k: 'date', label: 'Data', type: 'date', req: true },
    { k: 'freq', label: 'Repetir', type: 'select', options: [['none', 'Não repete'], ['semanal', 'Semanal'], ['mensal', 'Mensal'], ['anual', 'Anual']] }
  ],
  values: r ? { kind: r.kind, title: r.title, date: r.date, freq: r.freq } : { kind: 'revisar', title: 'Revisar investimentos', date: addDays(today(), 7), freq: 'mensal' },
  extra: r ? [{ label: 'Excluir', cls: 'danger', icon: 'trash', onClick: (x, api) => { S.invReminders = S.invReminders.filter(y => y !== r); api.close(); commit('Lembrete excluído'); } }] : [],
  onSubmit(x) { const n = r || { id: uid() }; Object.assign(n, x); if (!r) S.invReminders.push(n); commit('Lembrete salvo'); }
});

/* ---------- orçamento ---------- */
Act.budgetForm = cat => {
  const opts = cat ? [[cat, cat]] : CAT_OUT.filter(c => !S.budgets[c]).map(c => [c, c]);
  if (!opts.length) { UI.toast('Todas as categorias já têm limite', 'info'); return; }
  UI.form({
    title: cat ? 'Limite · ' + cat : 'Novo limite',
    fields: [{ k: 'cat', label: 'Categoria', type: 'select', options: opts }, { k: 'limit', label: 'Limite mensal', type: 'money', req: true }],
    values: { cat: cat || opts[0][0], limit: cat ? S.budgets[cat] : '' },
    extra: cat ? [{ label: 'Remover', cls: 'danger', icon: 'trash', onClick: (x, api) => { delete S.budgets[cat]; api.close(); commit('Limite removido'); } }] : [],
    onSubmit(x) {
      S.budgets[x.cat] = x.limit;
      const k = ym(today()); delete S.budgetAlerts[k + '|' + x.cat]; checkBudget(x.cat, k);
      addXP('orcamento'); markActive(); commit('Limite salvo');
    }
  });
};

/* ---------- desafios ---------- */
Act.startChallenge = tpl => {
  if (S.game.challenges.some(c => c.tpl === tpl && c.status === 'ativo')) { UI.toast('Este desafio já está ativo', 'info'); return; }
  const go = params => { const c = startChallenge(tpl, params); markActive(); commit(c.start > today() ? 'Hoje já teve gasto não essencial: o desafio começa amanhã' : 'Desafio iniciado'); App.open('challenge', { id: c.id }); };
  if (tpl === 'weekly') return UI.form({ title: CH_TPL.weekly.n, fields: [{ k: 'amount', label: 'Valor por semana', type: 'money', req: true }], values: { amount: 5000 }, submit: 'Começar', onSubmit: x => { go({ amount: x.amount }); } });
  if (tpl === 'reduce') {
    const prevK = ymAdd(ym(today()), -1);
    const cats = CAT_OUT.filter(c => catSpent(c, prevK) > 0);
    if (!cats.length) { UI.toast('Sem gastos no mês anterior para comparar', 'info'); return; }
    return UI.form({
      title: CH_TPL.reduce.n, note: `Base: gastos de ${monthLabel(prevK)}. O desafio vale até o fim deste mês.`,
      fields: [{ k: 'cat', label: 'Categoria', type: 'select', options: cats.map(c => [c, `${c} — ${money(catSpent(c, prevK), { force: true })}`]) }, { k: 'pct', label: 'Reduzir em', type: 'seg', options: [['10', '10%'], ['20', '20%'], ['30', '30%']] }],
      values: { cat: cats[0], pct: '20' }, submit: 'Começar',
      onSubmit: x => { if (catSpent(x.cat, ym(today())) > Math.round(catSpent(x.cat, prevK) * (1 - x.pct / 100))) return 'Você já passou desse limite neste mês. Escolha outra categoria ou porcentagem.'; go({ cat: x.cat, pct: +x.pct }); }
    });
  }
  go({});
};
Act.abandonChallenge = async c => {
  if (!await UI.confirm('Desistir do desafio?', 'Ele vai para o histórico como não concluído.', 'Desistir')) return;
  c.status = 'falhou'; c.doneAt = today(); App.back(); commit();
};
Act.noSpendDay = () => {
  const d = today();
  if (nonEssentialOn(d)) { UI.toast('Hoje já tem gasto em categoria não essencial', 'info'); return; }
  if (S.game.noSpend.includes(d)) { UI.toast('Dia já registrado. Volte amanhã.', 'info'); return; }
  S.game.noSpend.push(d); addXP('dia_sem_gastos'); markActive(); commit();
};
