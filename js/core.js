/* Pink Finance — núcleo: utilidades, dados, cálculos */
'use strict';

/* ---------- utilidades ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sum = (arr, f = x => x) => arr.reduce((s, x) => s + (f(x) || 0), 0);

/* ---------- dinheiro (sempre em centavos inteiros) ---------- */
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function money(c, opts = {}) {
  if (!opts.force && S && S.settings && S.settings.hideBalance) return 'R$ ••••';
  const v = BRL.format((c || 0) / 100);
  return opts.sign && c > 0 ? '+' + v : v;
}
function moneyShort(c) {
  if (S && S.settings && S.settings.hideBalance) return '•••';
  const v = Math.abs(c) / 100, s = c < 0 ? '-' : '';
  if (v >= 1e6) return s + (v / 1e6).toFixed(1).replace('.', ',') + ' mi';
  if (v >= 1e3) return s + (v / 1e3).toFixed(v >= 1e4 ? 0 : 1).replace('.', ',') + ' mil';
  return s + Math.round(v);
}
function parseMoney(str) {
  if (typeof str === 'number') return Math.round(str * 100);
  let s = String(str || '').replace(/[R$\s]/g, '').trim();
  if (!s) return 0;
  const neg = /^-/.test(s) || /^\(.*\)$/.test(s);
  s = s.replace(/[()\-+]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  const v = parseFloat(s);
  if (isNaN(v)) return NaN;
  return Math.round(v * 100) * (neg ? -1 : 1);
}
const centsToInput = c => c ? (c / 100).toFixed(2).replace('.', ',') : '';
const pct = (a, b) => b > 0 ? a / b : 0;
const fmtPct = (x, d = 0) => (x * 100).toFixed(d).replace('.', ',') + '%';

/* ---------- datas (strings AAAA-MM-DD, horário local) ---------- */
const pad = n => String(n).padStart(2, '0');
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => toISO(new Date());
const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return toISO(d); };
const lastDay = k => { const [y, m] = k.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const dateIn = (k, day) => `${k}-${pad(Math.min(day, lastDay(k)))}`;
const addMonths = (s, n, prefDay) => { const k = ymAdd(s.slice(0, 7), n); return dateIn(k, prefDay || +s.slice(8, 10)); };
const ym = s => s.slice(0, 7);
const ymAdd = (k, n) => { const [y, m] = k.split('-').map(Number); const t = new Date(y, m - 1 + n, 1); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}`; };
const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
const monthStart = k => k + '-01';
const monthEnd = k => dateIn(k, 31);
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MON = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const fmtDate = s => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '';
const fmtDay = s => `${+s.slice(8, 10)} ${MON[+s.slice(5, 7) - 1]}`;
const monthLabel = k => `${MONTHS[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}`;
const monShort = k => MON[+k.slice(5, 7) - 1];
function relDay(s) {
  const d = daysBetween(today(), s);
  if (d === 0) return 'hoje'; if (d === 1) return 'amanhã'; if (d === -1) return 'ontem';
  if (d > 1 && d < 7) return `em ${d} dias`; if (d < -1 && d > -60) return `há ${-d} dias`;
  return fmtDay(s);
}
function dayHeader(s) {
  const d = daysBetween(today(), s);
  if (d === 0) return 'Hoje'; if (d === -1) return 'Ontem'; if (d === 1) return 'Amanhã';
  return `${WD[parseISO(s).getDay()]}, ${fmtDay(s)}${s.slice(0, 4) !== today().slice(0, 4) ? ' ' + s.slice(0, 4) : ''}`;
}

/* ---------- catálogos ---------- */
const CAT_IN = ['Salário', 'Renda extra', 'Vendas', 'Rendimentos', 'Outros recebimentos'];
const CAT_OUT = ['Alimentação', 'Mercado', 'Transporte', 'Combustível', 'Saúde', 'Beleza e cuidados', 'Academia', 'Lazer', 'Compras', 'Assinaturas', 'Contas fixas', 'Outros'];
const CAT_ICON = {
  'Salário': 'briefcase', 'Renda extra': 'plusc', 'Vendas': 'tag', 'Rendimentos': 'trend', 'Outros recebimentos': 'in',
  'Alimentação': 'food', 'Mercado': 'cart', 'Transporte': 'bus', 'Combustível': 'fuel', 'Saúde': 'heart', 'Beleza e cuidados': 'spark',
  'Academia': 'dumbbell', 'Lazer': 'ticket', 'Compras': 'bag', 'Assinaturas': 'repeat', 'Contas fixas': 'doc', 'Outros': 'dots'
};
const METHODS = [['pix', 'Pix'], ['debito', 'Débito'], ['credito', 'Cartão de crédito'], ['dinheiro', 'Dinheiro'], ['boleto', 'Boleto'], ['ted', 'Transferência/TED']];
const METHOD_L = Object.fromEntries(METHODS);
const RECUR = [['none', 'Não repete'], ['semanal', 'Semanal'], ['mensal', 'Mensal'], ['anual', 'Anual']];
const INV_TYPES = ['Poupança', 'CDB', 'Tesouro Direto', 'Fundo de investimento', 'Ações', 'ETF', 'Fundo imobiliário', 'Outros'];
const LIQ = ['Diária', 'No vencimento', 'D+1', 'D+2', 'D+30', 'Outra'];
const GOAL_CATS = ['Reserva de emergência', 'Compra', 'Viagem', 'Investimento', 'Educação', 'Outro'];
const GOAL_ICONS = ['shield', 'phone', 'plane', 'cart', 'trend', 'home', 'car', 'gift', 'book', 'target', 'bag', 'star'];
const ACC_COLORS = ['#78917F', '#93A99A', '#69747B', '#A7AFB3', '#5C6B61', '#B7A88A', '#8E8578', '#C9CFCB'];
const CHART_COLORS = ['#78917F', '#A7B9AC', '#56685C', '#8E989E', '#C9CFCB', '#69747B', '#3F4A43', '#B7A88A'];
const TX_TYPE_L = { receita: 'Receita', despesa: 'Despesa', transferencia: 'Transferência', fatura: 'Pagamento de fatura', meta: 'Aporte em meta', resgate_meta: 'Resgate de meta', investimento: 'Aplicação', resgate_inv: 'Resgate de investimento', ajuste: 'Ajuste de saldo' };

/* ---------- estado ---------- */
const STORE_KEY = 'pinkfinance.v1';
let S = null;
let storageOK = true;

function defaultState() {
  return {
    v: 1, created: today(),
    settings: {
      name: '', hideBalance: false, theme: 'dark', pin: null, bio: null, lockAfter: 1,
      notif: { enabled: false, offsets: [7, 3, 1, 0], hour: 9 },
      nonEssential: ['Lazer', 'Compras'], sample: false, lastBackup: null, sent: {}, onboarded: false
    },
    accounts: [
      { id: 'mp', name: 'Mercado Pago', bank: 'Mercado Pago', short: 'MP', color: '#93A99A', initial: 0, card: { enabled: true, limit: 0, closing: 25, due: 5 } },
      { id: 'nu', name: 'Nubank', bank: 'Nu Pagamentos', short: 'NU', color: '#78917F', initial: 0, card: { enabled: true, limit: 0, closing: 3, due: 10 } },
      { id: 'vc', name: 'Viacredi', bank: 'Cooperativa Viacredi', short: 'VC', color: '#69747B', initial: 0, card: { enabled: false, limit: 0, closing: 15, due: 22 } }
    ],
    tx: [], recurring: [], bills: [], investments: [], invReminders: [], goals: [],
    budgets: { 'Mercado': 50000, 'Alimentação': 25000, 'Beleza e cuidados': 15000, 'Lazer': 20000, 'Transporte': 30000 },
    budgetAlerts: {},
    game: { xp: 0, log: [], ach: {}, challenges: [], noSpend: [], active: [], lastReview: null, daily: {} }
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) { storageOK = false; }
  return null;
}
function migrate(st) {
  const d = defaultState();
  for (const k of Object.keys(d)) if (st[k] === undefined) st[k] = d[k];
  st.settings = Object.assign({}, d.settings, st.settings);
  st.settings.notif = Object.assign({}, d.settings.notif, st.settings.notif);
  st.game = Object.assign({}, d.game, st.game);
  return st;
}
let saveTimer = null;
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); storageOK = true; }
  catch (e) { storageOK = false; }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { PFsys.syncReminders(); } catch (e) { } }, 800);
}

/* ---------- consultas ---------- */
const acc = id => S.accounts.find(a => a.id === id);
const activeAccounts = () => S.accounts.filter(a => !a.archived);
const accName = id => (acc(id) || {}).name || '—';
const goalById = id => S.goals.find(g => g.id === id);
const invById = id => S.investments.find(i => i.id === id);
const billById = id => S.bills.find(b => b.id === id);
const hasCard = a => a && a.card && a.card.enabled;

/* efeito de um lançamento no saldo de uma conta */
function txEffect(t, id) {
  switch (t.type) {
    case 'receita': return t.accountId === id ? t.amount : 0;
    case 'despesa': return t.accountId === id && t.method !== 'credito' ? -t.amount : 0;
    case 'transferencia': return (t.accountId === id ? -t.amount : 0) + (t.toAccountId === id ? t.amount : 0);
    case 'fatura': case 'meta': case 'investimento': return t.accountId === id ? -t.amount : 0;
    case 'resgate_meta': case 'resgate_inv': return t.accountId === id ? t.amount : 0;
    case 'ajuste': return t.accountId === id ? t.amount : 0;
  }
  return 0;
}
function balance(id, asOf = today()) {
  const a = acc(id); if (!a) return 0;
  let b = a.initial || 0;
  for (const t of S.tx) if (t.date <= asOf) b += txEffect(t, id);
  return b;
}
const totalBalance = (asOf = today()) => sum(activeAccounts(), a => balance(a.id, asOf));

function accMonthFlow(id, k) {
  const from = monthStart(k), to = monthEnd(k);
  let inn = 0, out = 0;
  for (const t of S.tx) {
    if (t.date < from || t.date > to) continue;
    const e = txEffect(t, id);
    if (e > 0) inn += e; else out -= e;
  }
  return { inn, out };
}

/* ---------- cartão de crédito / faturas ---------- */
function invoiceKeyFor(a, date) {
  const d = +date.slice(8, 10), k = ym(date);
  return d < a.card.closing ? k : ymAdd(k, 1);
}
function invoiceDates(a, key) {
  const close = dateIn(key, a.card.closing);
  const due = a.card.due > a.card.closing ? dateIn(key, a.card.due) : dateIn(ymAdd(key, 1), a.card.due);
  return { close, due };
}
function invoices(id) {
  const a = acc(id); if (!hasCard(a)) return [];
  const map = {};
  const mk = k => map[k] || (map[k] = { key: k, accountId: id, total: 0, paid: 0, items: [], payments: [] });
  for (const t of S.tx) {
    if (t.type === 'despesa' && t.method === 'credito' && t.accountId === id) { const inv = mk(invoiceKeyFor(a, t.date)); inv.total += t.amount; inv.items.push(t); }
    if (t.type === 'fatura' && t.cardId === id) { const inv = mk(t.invoiceKey); inv.paid += t.amount; inv.payments.push(t); }
  }
  const td = today();
  return Object.values(map).map(inv => {
    Object.assign(inv, invoiceDates(a, inv.key));
    inv.remaining = Math.max(0, inv.total - inv.paid);
    if (inv.total > 0 && inv.remaining === 0) inv.status = 'paga';
    else if (inv.total === 0) inv.status = 'paga';
    else if (td < inv.close) inv.status = 'aberta';
    else if (td > inv.due) inv.status = 'atrasada';
    else inv.status = 'fechada';
    return inv;
  }).sort((x, y) => x.key.localeCompare(y.key));
}
function cardUsed(id, asOf) {
  let u = 0;
  for (const t of S.tx) {
    if (asOf && t.date > asOf) continue;
    if (t.type === 'despesa' && t.method === 'credito' && t.accountId === id) u += t.amount;
    if (t.type === 'fatura' && t.cardId === id) u -= t.amount;
  }
  return Math.max(0, u);
}
const cardDebtTotal = asOf => sum(S.accounts.filter(hasCard), a => cardUsed(a.id, asOf));
function currentInvoice(id) {
  const a = acc(id); if (!hasCard(a)) return null;
  const k = invoiceKeyFor(a, today());
  return invoices(id).find(i => i.key === k) || Object.assign({ key: k, accountId: id, total: 0, paid: 0, remaining: 0, items: [], payments: [], status: 'aberta' }, invoiceDates(a, k));
}
function openInvoices() {
  const out = [];
  for (const a of activeAccounts()) if (hasCard(a)) for (const inv of invoices(a.id)) if (inv.status !== 'paga') out.push(inv);
  return out.sort((x, y) => x.due.localeCompare(y.due));
}

/* ---------- metas ---------- */
function goalSaved(g, asOf) {
  let s = (!asOf || (g.created || '0000') <= asOf) ? (g.initial || 0) : 0;
  for (const t of S.tx) {
    if (t.goalId !== g.id || (asOf && t.date > asOf)) continue;
    if (t.type === 'meta') s += t.amount; else if (t.type === 'resgate_meta') s -= t.amount;
  }
  return s;
}
const goalsTotal = asOf => sum(S.goals, g => goalSaved(g, asOf));
function monthsUntil(dateStr) {
  const d = daysBetween(today(), dateStr);
  return Math.max(1, Math.ceil(d / 30.44));
}
function goalPlan(g) {
  const saved = goalSaved(g), remaining = Math.max(0, g.target - saved);
  const p = clamp(pct(saved, g.target), 0, 1);
  let need = 0, months = null, eta = null, onTrack = null;
  if (g.deadline && remaining > 0) { months = monthsUntil(g.deadline); need = Math.ceil(remaining / months / 100) * 100; }
  if (g.monthly > 0 && remaining > 0) {
    const m = Math.ceil(remaining / g.monthly);
    eta = addMonths(today(), m);
    if (g.deadline) onTrack = eta <= g.deadline;
  }
  const late = g.deadline && remaining > 0 && g.deadline < today();
  return { saved, remaining, p, need, months, eta, onTrack, late, done: remaining === 0 };
}

/* ---------- investimentos ---------- */
function invValue(i, asOf) {
  if (!asOf || asOf >= today()) return i.current;
  if (i.date > asOf) return 0;
  let v = i.principal;
  for (const h of (i.history || [])) if (h.date <= asOf) v = h.value;
  return v;
}
const investTotal = asOf => sum(S.investments.filter(i => !i.closed), i => invValue(i, asOf));
const investPrincipal = () => sum(S.investments.filter(i => !i.closed), i => i.principal);

/* ---------- patrimônio ---------- */
const netWorth = (asOf = today()) => totalBalance(asOf) + investTotal(asOf) + goalsTotal(asOf) - cardDebtTotal(asOf);
function netWorthSeries(n = 6) {
  const k0 = ym(today()), out = [];
  for (let i = n - 1; i >= 0; i--) {
    const k = ymAdd(k0, -i);
    const d = i === 0 ? today() : monthEnd(k);
    out.push({ k, v: netWorth(d) });
  }
  return out;
}

/* ---------- estatísticas de período ---------- */
function periodStats(from, to) {
  const r = { inc: 0, exp: 0, invested: 0, redeemed: 0, saved: 0, unsaved: 0, byCat: {}, incCat: {}, count: 0 };
  for (const t of S.tx) {
    if (t.date < from || t.date > to) continue;
    r.count++;
    if (t.type === 'receita') { r.inc += t.amount; r.incCat[t.category] = (r.incCat[t.category] || 0) + t.amount; }
    else if (t.type === 'despesa') { r.exp += t.amount; r.byCat[t.category] = (r.byCat[t.category] || 0) + t.amount; }
    else if (t.type === 'investimento') r.invested += t.amount;
    else if (t.type === 'resgate_inv') r.redeemed += t.amount;
    else if (t.type === 'meta') r.saved += t.amount;
    else if (t.type === 'resgate_meta') r.unsaved += t.amount;
  }
  r.net = r.inc - r.exp;
  r.goalsNet = r.saved - r.unsaved;
  r.investNet = r.invested - r.redeemed;
  return r;
}
function monthStats(k, uptoToday = true) {
  const to = uptoToday && k === ym(today()) ? today() : monthEnd(k);
  return periodStats(monthStart(k), to);
}
function catSpent(cat, k) {
  let s = 0; const from = monthStart(k), to = monthEnd(k);
  for (const t of S.tx) if (t.type === 'despesa' && t.category === cat && t.date >= from && t.date <= to) s += t.amount;
  return s;
}
const sortedCats = obj => Object.entries(obj).sort((a, b) => b[1] - a[1]);

/* ---------- contas a pagar ---------- */
function billStatus(b) {
  if (b.paidAt) return 'paga';
  if (b.due < today()) return 'atrasada';
  if (daysBetween(today(), b.due) <= 7) return 'proxima';
  return 'pendente';
}
const BILL_L = { paga: 'Paga', atrasada: 'Atrasada', proxima: 'Vence em breve', pendente: 'Pendente' };
const BILL_C = { paga: 'ok', atrasada: 'bad', proxima: 'warn', pendente: '' };

/* ---------- recorrências ---------- */
function nextDate(d, freq, prefDay) {
  if (freq === 'semanal') return addDays(d, 7);
  if (freq === 'anual') return addMonths(d, 12, prefDay);
  return addMonths(d, 1, prefDay);
}
function processRecurring() {
  const td = today(); let made = 0;
  for (const r of S.recurring) {
    if (r.stopped) continue;
    let guard = 0;
    while (r.next <= td && (!r.until || r.next <= r.until) && guard++ < 400) {
      S.tx.push(Object.assign({}, r.tpl, { id: uid(), date: r.next, recurringId: r.id, sample: r.sample || undefined, created: new Date().toISOString() }));
      r.next = nextDate(r.next, r.freq, r.day);
      made++;
    }
  }
  // contas a pagar recorrentes: garante a próxima ocorrência após o pagamento
  for (const b of S.bills.slice()) {
    if (b.recurring && b.paidAt && !b.nextCreated) {
      S.bills.push({ id: uid(), name: b.name, amount: b.amount, due: addMonths(b.due, 1, b.day || +b.due.slice(8, 10)), day: b.day || +b.due.slice(8, 10), category: b.category, accountId: b.accountId, recurring: true, reminders: b.reminders.slice(), notes: b.notes || '', sample: b.sample });
      b.nextCreated = true; made++;
    }
  }
  return made;
}
/* ocorrências futuras previstas (para calendário) */
function projectedRecurring(from, to) {
  const out = [];
  for (const r of S.recurring) {
    if (r.stopped) continue;
    let d = r.next, g = 0;
    while (d <= to && (!r.until || d <= r.until) && g++ < 200) {
      if (d >= from) out.push(Object.assign({}, r.tpl, { date: d, projected: true, recurringId: r.id }));
      d = nextDate(d, r.freq, r.day);
    }
  }
  return out;
}

/* ---------- utilidades de lançamentos ---------- */
function txTitle(t) {
  if (t.desc) return t.desc;
  if (t.type === 'transferencia') return `${accName(t.accountId)} → ${accName(t.toAccountId)}`;
  if (t.type === 'fatura') return `Fatura ${accName(t.cardId)}`;
  if (t.type === 'meta' || t.type === 'resgate_meta') return (goalById(t.goalId) || {}).name || 'Meta';
  if (t.type === 'investimento' || t.type === 'resgate_inv') return (invById(t.invId) || {}).name || 'Investimento';
  return t.category || TX_TYPE_L[t.type];
}
function txSign(t) {
  if (t.type === 'receita' || t.type === 'resgate_inv' || t.type === 'resgate_meta') return 1;
  if (t.type === 'ajuste') return t.amount >= 0 ? 1 : -1;
  if (t.type === 'transferencia') return 0;
  return -1;
}
function txIcon(t) {
  if (t.type === 'transferencia') return 'swap';
  if (t.type === 'fatura') return 'card';
  if (t.type === 'meta' || t.type === 'resgate_meta') return 'target';
  if (t.type === 'investimento' || t.type === 'resgate_inv') return 'trend';
  if (t.type === 'ajuste') return 'sliders';
  return CAT_ICON[t.category] || 'dots';
}
