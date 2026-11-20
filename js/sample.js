/* Pink Finance — dados de EXEMPLO (marcados com sample:true e removíveis) */
'use strict';

function loadSampleData() {
  let seed = 20261119;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const between = (a, b) => Math.round(a + rnd() * (b - a));
  const td = today(), k0 = ym(td);
  const SM = { sample: true };
  const tx = (o) => S.tx.push(Object.assign({ id: uid(), created: new Date().toISOString(), notes: '' }, SM, o));
  const nonEss = S.settings.nonEssential;

  S.accounts.find(a => a.id === 'mp').initial = 60000;
  S.accounts.find(a => a.id === 'nu').initial = 90000;
  S.accounts.find(a => a.id === 'vc').initial = 180000;
  Object.assign(S.accounts.find(a => a.id === 'nu').card, { enabled: true, limit: 350000, closing: 3, due: 10 });
  Object.assign(S.accounts.find(a => a.id === 'mp').card, { enabled: true, limit: 200000, closing: 25, due: 5 });

  const start = ymAdd(k0, -5);
  const places = {
    'Mercado': ['Supermercado Giassi', 'Atacadão', 'Mercado do bairro'],
    'Alimentação': ['iFood', 'Padaria', 'Almoço restaurante', 'Lanche'],
    'Transporte': ['Uber', 'Ônibus'],
    'Combustível': ['Posto Ipiranga', 'Posto Shell'],
    'Lazer': ['Cinema', 'Bar com amigos', 'Ingresso show'],
    'Compras': ['Loja de roupas', 'Shopee', 'Amazon'],
    'Saúde': ['Farmácia', 'Consulta'],
    'Beleza e cuidados': ['Barbearia', 'Perfumaria']
  };
  const plan = { 'Mercado': [3, 7000, 18000], 'Alimentação': [5, 1800, 5500], 'Transporte': [3, 1500, 3500], 'Combustível': [2, 9000, 15000], 'Lazer': [2, 4000, 12000], 'Compras': [1, 6000, 22000], 'Saúde': [1, 2500, 9000], 'Beleza e cuidados': [1, 4000, 6000] };
  const cards = ['nu', 'mp'];

  for (let k = start; k <= k0; k = ymAdd(k, 1)) {
    const maxDay = k === k0 ? +td.slice(8, 10) : lastDay(k);
    const day = d => dateIn(k, d);
    if (k < k0 || maxDay >= 5) tx({ type: 'receita', amount: 320000, desc: 'Salário', category: 'Salário', date: day(5), accountId: 'vc', method: 'ted', recurrence: 'mensal' });
    if (between(0, 1) && (k < k0 || maxDay >= 18)) tx({ type: 'receita', amount: between(20000, 45000), desc: 'Freela fim de semana', category: 'Renda extra', date: day(18), accountId: 'mp', method: 'pix' });
    if (k < k0 || maxDay >= 6) tx({ type: 'transferencia', amount: 60000, desc: 'Reserva para cartão', date: day(6), accountId: 'vc', toAccountId: 'nu', method: 'pix' });
    if (k < k0 || maxDay >= 2) tx({ type: 'despesa', amount: 9990, desc: 'Academia', category: 'Academia', date: day(2), accountId: 'nu', method: 'credito', recurrence: 'mensal' });
    if (k < k0 || maxDay >= 8) tx({ type: 'despesa', amount: 2190, desc: 'Spotify', category: 'Assinaturas', date: day(8), accountId: 'mp', method: 'credito', recurrence: 'mensal' });
    if (k < k0 || maxDay >= 12) tx({ type: 'despesa', amount: 3990, desc: 'Streaming', category: 'Assinaturas', date: day(12), accountId: 'nu', method: 'credito' });
    for (const [cat, [n, a, b]] of Object.entries(plan)) {
      for (let i = 0; i < n; i++) {
        let d = between(1, maxDay);
        const date = day(d);
        // mantém os últimos 4 dias sem gastos não essenciais (para o desafio ativo de exemplo)
        if (nonEss.includes(cat) && daysBetween(date, td) < 4) continue;
        const list = places[cat];
        const credit = rnd() < 0.55;
        tx({ type: 'despesa', amount: between(a, b), desc: list[between(0, list.length - 1)], category: cat, date, accountId: credit ? cards[between(0, 1)] : (rnd() < .5 ? 'nu' : 'mp'), method: credit ? 'credito' : (rnd() < .7 ? 'pix' : 'debito') });
      }
    }
  }

  // contas fixas (histórico pago + mês atual com situações variadas)
  const fixed = [['Aluguel', 85000, 8, 'vc'], ['Energia (Celesc)', 0, 20, 'vc'], ['Internet', 9990, 15, 'nu'], ['Celular', 4990, 12, 'mp']];
  for (let k = start; k < k0; k = ymAdd(k, 1)) {
    for (const [name, amt, d, a] of fixed) {
      const amount = amt || between(11000, 17000), due = dateIn(k, d), paid = addDays(due, -between(0, 3));
      const t = { id: uid(), type: 'despesa', amount, desc: name, category: 'Contas fixas', date: paid, accountId: a, method: 'boleto', created: new Date().toISOString(), sample: true, notes: '' };
      S.tx.push(t);
      S.bills.push({ id: uid(), name, amount, due, day: d, category: 'Contas fixas', accountId: a, recurring: true, reminders: [7, 3, 1, 0], paidAt: paid, paidTxId: t.id, nextCreated: true, sample: true });
    }
  }
  const cur = [['Aluguel', 85000, -11, 'vc', true], ['Energia (Celesc)', 14230, -2, 'vc', false], ['Celular', 4990, 1, 'mp', false], ['Internet', 9990, 5, 'nu', false], ['Plano de saúde', 18900, 12, 'vc', false]];
  for (const [name, amount, off, a, paid] of cur) {
    const due = addDays(td, off), b = { id: uid(), name, amount, due, day: +due.slice(8, 10), category: name === 'Plano de saúde' ? 'Saúde' : 'Contas fixas', accountId: a, recurring: true, reminders: [7, 3, 1, 0], sample: true };
    if (paid) {
      const t = { id: uid(), type: 'despesa', amount, desc: name, category: 'Contas fixas', date: addDays(due, -1), accountId: a, method: 'boleto', created: new Date().toISOString(), sample: true, notes: '' };
      S.tx.push(t); b.paidAt = t.date; b.paidTxId = t.id; b.nextCreated = true;
      S.bills.push({ id: uid(), name, amount, due: addMonths(due, 1), day: b.day, category: 'Contas fixas', accountId: a, recurring: true, reminders: [7, 3, 1, 0], sample: true });
    }
    S.bills.push(b);
  }

  // faturas vencidas pagas
  for (const id of cards) {
    for (const inv of invoices(id)) {
      if (inv.due < td && inv.remaining > 0) tx({ type: 'fatura', amount: inv.remaining, desc: '', date: addDays(inv.due, -1), accountId: id === 'nu' ? 'nu' : 'mp', cardId: id, invoiceKey: inv.key, method: 'pix' });
    }
  }

  // metas
  const g1 = { id: uid(), name: 'Reserva de emergência', target: 1000000, initial: 150000, deadline: addMonths(td, 14), monthly: 30000, aporteDay: 7, category: 'Reserva de emergência', icon: 'shield', image: null, created: monthStart(start), sample: true };
  const g2 = { id: uid(), name: 'Celular novo', target: 400000, initial: 60000, deadline: addMonths(td, 6), monthly: 45000, aporteDay: 10, category: 'Compra', icon: 'phone', image: null, created: monthStart(start), sample: true };
  const g3 = { id: uid(), name: 'Viagem de fim de ano', target: 500000, initial: 0, deadline: addMonths(td, 12), monthly: 25000, aporteDay: 20, category: 'Viagem', icon: 'plane', image: null, created: monthStart(ymAdd(k0, -2)), sample: true };
  const g4 = { id: uid(), name: 'Guardar R$ 1.000', target: 100000, initial: 70000, deadline: addMonths(td, 2), monthly: 15000, aporteDay: 15, category: 'Outro', icon: 'coins', image: null, created: monthStart(ymAdd(k0, -1)), sample: true };
  S.goals.push(g1, g2, g3, g4);
  for (let k = start; k <= k0; k = ymAdd(k, 1)) {
    const d = dateIn(k, 7); if (d > td) continue;
    tx({ type: 'meta', amount: 30000, desc: '', date: d, accountId: 'vc', goalId: g1.id, method: 'pix' });
    if (k > start) tx({ type: 'meta', amount: 35000, desc: '', date: dateIn(k, 10) > td ? d : dateIn(k, 10), accountId: 'nu', goalId: g2.id, method: 'pix' });
    if (k >= ymAdd(k0, -2)) tx({ type: 'meta', amount: 20000, desc: '', date: dateIn(k, 20) > td ? d : dateIn(k, 20), accountId: 'mp', goalId: g3.id, method: 'pix' });
  }
  tx({ type: 'meta', amount: 6000, desc: '', date: addDays(td, -6), accountId: 'mp', goalId: g4.id, method: 'pix' });
  tx({ type: 'meta', amount: 4000, desc: '', date: addDays(td, -1), accountId: 'mp', goalId: g4.id, method: 'pix' });

  // investimentos
  const mkInv = (o, hist) => { const i = Object.assign({ id: uid(), sample: true, history: [] }, o); i.history = hist.map(([d, v]) => ({ date: d, value: v })); i.current = i.history[i.history.length - 1].value; S.investments.push(i); return i; };
  const d1 = dateIn(start, 10);
  const i1 = mkInv({ name: 'CDB Liquidez Diária', type: 'CDB', institution: 'Nubank', principal: 200000, date: d1, rate: '100% do CDI', liquidity: 'Diária', maturity: '', goal: 'Complemento da reserva', accountId: 'nu' },
    [[d1, 200000], [dateIn(ymAdd(start, 1), 10), 202100], [dateIn(ymAdd(start, 2), 10), 204300], [dateIn(ymAdd(start, 3), 10), 206400], [dateIn(ymAdd(start, 4), 10), 208600], [addDays(td, -3), 210900]]);
  const d2 = dateIn(ymAdd(start, 1), 15);
  const i2 = mkInv({ name: 'Tesouro Selic 2029', type: 'Tesouro Direto', institution: 'Viacredi (corretora)', principal: 100000, date: d2, rate: 'Selic + 0,1%', liquidity: 'D+1', maturity: '2029-03-01', goal: 'Longo prazo', accountId: 'vc' },
    [[d2, 100000], [dateIn(ymAdd(start, 3), 15), 102400], [addDays(td, -10), 104600]]);
  const d3 = dateIn(ymAdd(start, 3), 3);
  const i3 = mkInv({ name: 'MXRF11', type: 'Fundo imobiliário', institution: 'Corretora', principal: 60000, date: d3, rate: 'Variável', liquidity: 'D+2', maturity: '', goal: 'Renda mensal', accountId: 'mp' },
    [[d3, 60000], [addDays(td, -15), 58500]]);
  const i4 = mkInv({ name: 'CDB Viacredi prefixado', type: 'CDB', institution: 'Viacredi', principal: 50000, date: dateIn(ymAdd(start, 2), 20), rate: '108% do CDI', liquidity: 'No vencimento', maturity: addDays(td, 24), goal: 'Viagem', accountId: 'vc' },
    [[dateIn(ymAdd(start, 2), 20), 50000], [addDays(td, -5), 51900]]);
  for (const i of [i1, i2, i3, i4]) tx({ type: 'investimento', amount: i.principal, desc: '', date: i.date, accountId: i.accountId, invId: i.id, method: 'ted' });
  S.invReminders.push(
    { id: uid(), title: 'Revisar carteira de investimentos', kind: 'revisar', date: dateIn(ymAdd(k0, 1), 1), freq: 'mensal', sample: true },
    { id: uid(), title: 'Aporte no Tesouro Selic', kind: 'aporte', date: addDays(td, 3), freq: 'mensal', sample: true },
    { id: uid(), title: 'Conferir rendimento dos CDBs', kind: 'rendimento', date: addDays(td, 9), freq: 'mensal', sample: true }
  );

  // recorrências futuras (salário, academia, spotify)
  const rec = (tpl, first) => S.recurring.push({ id: uid(), freq: 'mensal', day: +first.slice(8, 10), next: first > td ? first : addMonths(first, 1), tpl: Object.assign({ notes: '' }, tpl), sample: true });
  rec({ type: 'receita', amount: 320000, desc: 'Salário', category: 'Salário', accountId: 'vc', method: 'ted', recurrence: 'mensal' }, dateIn(k0, 5));
  rec({ type: 'despesa', amount: 9990, desc: 'Academia', category: 'Academia', accountId: 'nu', method: 'credito', recurrence: 'mensal' }, dateIn(k0, 2));
  rec({ type: 'despesa', amount: 2190, desc: 'Spotify', category: 'Assinaturas', accountId: 'mp', method: 'credito', recurrence: 'mensal' }, dateIn(k0, 8));

  // ajusta saldos iniciais para que nenhuma conta fique negativa no exemplo
  for (const a of S.accounts) {
    let low = 0, run = a.initial;
    const evs = S.tx.map(t => [t.date, txEffect(t, a.id)]).filter(e => e[1]).sort((x, y) => x[0].localeCompare(y[0]));
    for (const [, e] of evs) { run += e; low = Math.min(low, run); }
    if (low < 30000) a.initial += 30000 - low + between(4000, 25000);
  }

  // gamificação de exemplo
  S.game.xp = 520;
  S.game.log = [
    { d: new Date(Date.now() - 864e5).toISOString(), xp: 20, label: 'Conta paga antes do vencimento', kind: 'conta_antecipada', sample: true },
    { d: new Date(Date.now() - 2 * 864e5).toISOString(), xp: 10, label: 'Dinheiro guardado em meta', kind: 'guardar', sample: true }
  ];
  for (let i = 1; i <= 5; i++) S.game.active.push(addDays(td, -i));
  S.game.active.sort();
  const c1 = startChallenge('eco100'); c1.start = addDays(td, -4); c1.end = addDays(c1.start, 29); c1.sample = true;
  const c2 = startChallenge('nospend7'); c2.start = addDays(td, -3); c2.end = addDays(c2.start, 6); c2.sample = true;
  S.created = monthStart(start);
  S.settings.sample = true;
  S.tx.sort((a, b) => a.date.localeCompare(b.date));
  checkAchievements(true);
}

function clearSampleData() {
  const keep = x => !x.sample;
  S.tx = S.tx.filter(keep); S.recurring = S.recurring.filter(keep); S.bills = S.bills.filter(keep);
  S.investments = S.investments.filter(keep); S.invReminders = S.invReminders.filter(keep); S.goals = S.goals.filter(keep);
  for (const a of S.accounts) { if (['mp', 'nu', 'vc'].includes(a.id)) { a.initial = 0; if (a.card) a.card.limit = 0; } }
  S.game = defaultState().game;
  S.budgetAlerts = {};
  S.created = today();
  S.settings.sample = false;
  S.settings.sent = {};
}
