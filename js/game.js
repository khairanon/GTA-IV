/* Pink Finance — gamificação: XP, níveis, conquistas, desafios, sequência */
'use strict';

const LEVELS = [
  { n: 'Iniciante', xp: 0 },
  { n: 'Organizado', xp: 300 },
  { n: 'Economizador', xp: 900 },
  { n: 'Investidor', xp: 2000 },
  { n: 'Mestre das Finanças', xp: 4000 }
];
/* limites diários por tipo de ação: o jogo premia organização, nunca o volume de gastos */
const XP_RULES = {
  registro: { xp: 3, max: 15, label: 'Lançamento registrado' },
  conta_antecipada: { xp: 20, label: 'Conta paga antes do vencimento' },
  conta_no_dia: { xp: 10, label: 'Conta paga no vencimento' },
  conta_atrasada: { xp: 2, label: 'Conta paga (em atraso)' },
  fatura_em_dia: { xp: 20, label: 'Fatura paga em dia' },
  guardar: { xp: 10, max: 20, label: 'Dinheiro guardado em meta' },
  meta_concluida: { xp: 100, label: 'Meta concluída' },
  revisao_inv: { xp: 15, label: 'Investimentos revisados' },
  dia_sem_gastos: { xp: 8, max: 8, label: 'Dia sem gastos não essenciais' },
  orcamento: { xp: 10, max: 10, label: 'Orçamento ajustado' },
  importacao: { xp: 10, max: 10, label: 'Extrato importado' },
  sequencia: { xp: 25, label: 'Sequência de 7 dias' },
  desafio: { xp: 0, label: 'Desafio concluído' },
  conquista: { xp: 0, label: 'Conquista' }
};

function levelInfo(xp = S.game.xp) {
  let i = 0;
  for (let j = 0; j < LEVELS.length; j++) if (xp >= LEVELS[j].xp) i = j;
  const cur = LEVELS[i], nxt = LEVELS[i + 1];
  return { i, n: cur.n, num: i + 1, xp, next: nxt, p: nxt ? (xp - cur.xp) / (nxt.xp - cur.xp) : 1, toNext: nxt ? nxt.xp - xp : 0 };
}

function markActive(d = today()) {
  const g = S.game;
  if (!g.active.includes(d)) { g.active.push(d); g.active.sort(); if (g.active.length > 400) g.active = g.active.slice(-400); }
  const st = streak();
  if (st > 0 && st % 7 === 0 && g.daily['seq:' + d] === undefined) { g.daily['seq:' + d] = 1; addXP('sequencia', null, `Sequência de ${st} dias`); }
}
function streak() {
  const set = new Set(S.game.active); let d = today(), n = 0;
  if (!set.has(d)) d = addDays(d, -1);
  while (set.has(d)) { n++; d = addDays(d, -1); }
  return n;
}
function bestStreak() {
  const a = S.game.active.slice().sort(); let best = 0, cur = 0, prev = null;
  for (const d of a) { cur = prev && daysBetween(prev, d) === 1 ? cur + 1 : 1; best = Math.max(best, cur); prev = d; }
  return best;
}

/* concede XP respeitando limites diários; retorna XP efetivamente ganho */
function addXP(kind, amount, label, quiet) {
  const rule = XP_RULES[kind] || { xp: 0 };
  let xp = amount != null ? amount : rule.xp;
  const d = today();
  if (rule.max) {
    const key = kind + ':' + d, got = S.game.daily[key] || 0;
    xp = Math.min(xp, rule.max - got);
    if (xp <= 0) return 0;
    S.game.daily[key] = got + xp;
  }
  if (xp <= 0) return 0;
  const before = levelInfo().i;
  S.game.xp += xp;
  S.game.log.unshift({ d: new Date().toISOString(), xp, label: label || rule.label, kind });
  if (S.game.log.length > 300) S.game.log.length = 300;
  // limpa contadores diários antigos
  for (const k of Object.keys(S.game.daily)) if (!k.endsWith(d) && k.split(':')[1] < addDays(d, -3)) delete S.game.daily[k];
  if (!quiet) UI.toastXP(xp, label || rule.label);
  const after = levelInfo();
  if (after.i > before && !quiet) setTimeout(() => UI.levelUp(after), 900);
  return xp;
}

/* ---------- conquistas ---------- */
function nonEssentialOn(d) {
  return S.tx.some(t => t.type === 'despesa' && t.date === d && S.settings.nonEssential.includes(t.category));
}
function anyMonthWithinBudget() {
  const cats = Object.keys(S.budgets).filter(c => S.budgets[c] > 0);
  if (!cats.length) return false;
  const first = ym(S.created), cur = ym(today());
  for (let k = first; k < cur; k = ymAdd(k, 1)) {
    const st = monthStats(k, false);
    if (st.exp === 0) continue;
    if (cats.every(c => catSpent(c, k) <= S.budgets[c])) return true;
  }
  return false;
}
const ACHIEVEMENTS = [
  { id: 'primeiro_lanc', n: 'Primeiro registro', d: 'Registrou o primeiro lançamento.', ic: 'pen', xp: 10, test: () => S.tx.some(t => t.type === 'receita' || t.type === 'despesa') },
  { id: 'primeira_meta', n: 'Primeira meta concluída', d: 'Concluiu uma meta financeira.', ic: 'target', xp: 50, test: () => S.goals.some(g => g.completedAt) },
  { id: 'primeiros_100', n: 'Primeiros R$ 100 guardados', d: 'Acumulou R$ 100 em metas.', ic: 'coins', xp: 30, test: () => goalsTotal() >= 10000 },
  { id: 'semana_limpa', n: 'Uma semana sem gastos desnecessários', d: '7 dias seguidos sem gastos em categorias não essenciais.', ic: 'leaf', xp: 50,
    test: () => { const t = today(); if (daysBetween(S.created, t) < 7) return false; for (let i = 1; i <= 7; i++) if (nonEssentialOn(addDays(t, -i))) return false; return true; } },
  { id: 'mes_orcamento', n: 'Um mês dentro do orçamento', d: 'Fechou um mês com todas as categorias dentro do limite.', ic: 'gauge', xp: 60, test: anyMonthWithinBudget },
  { id: 'contas_em_dia', n: 'Todas as contas pagas em dia', d: '5 contas pagas em dia, sem nenhuma atrasada.', ic: 'check', xp: 50,
    test: () => { const paid = S.bills.filter(b => b.paidAt); return paid.length >= 5 && paid.every(b => b.paidAt <= b.due) && !S.bills.some(b => billStatus(b) === 'atrasada'); } },
  { id: 'primeiro_inv', n: 'Primeiro investimento', d: 'Cadastrou o primeiro investimento.', ic: 'trend', xp: 20, test: () => S.investments.length > 0 },
  { id: 'reserva', n: 'Reserva de emergência iniciada', d: 'Começou a montar a reserva de emergência.', ic: 'shield', xp: 30, test: () => S.goals.some(g => g.category === 'Reserva de emergência' && goalSaved(g) > 0) },
  { id: 'sequencia7', n: 'Sequência de 7 dias', d: 'Usou o app por 7 dias seguidos.', ic: 'flame', xp: 30, test: () => bestStreak() >= 7 },
  { id: 'desafio1', n: 'Primeiro desafio vencido', d: 'Concluiu um desafio financeiro.', ic: 'flag', xp: 30, test: () => S.game.challenges.some(c => c.status === 'concluido') },
  { id: 'orcamento_def', n: 'Orçamento definido', d: 'Definiu limites para 3 categorias ou mais.', ic: 'sliders', xp: 15, test: () => Object.values(S.budgets).filter(v => v > 0).length >= 3 },
  { id: 'nivel3', n: 'Economizador', d: 'Chegou ao nível Economizador.', ic: 'star', xp: 0, test: () => S.game.xp >= LEVELS[2].xp }
];
function checkAchievements(quiet) {
  const got = [];
  for (const a of ACHIEVEMENTS) {
    if (S.game.ach[a.id]) continue;
    let ok = false; try { ok = a.test(); } catch (e) { }
    if (ok) { S.game.ach[a.id] = today(); got.push(a); if (a.xp) addXP('conquista', a.xp, 'Conquista: ' + a.n, true); }
  }
  if (got.length && !quiet) got.forEach((a, i) => setTimeout(() => UI.achievementToast(a), 600 + i * 1400));
  return got;
}

/* ---------- desafios ---------- */
const CH_TPL = {
  eco100: { n: 'Economizar R$ 100 em 30 dias', d: 'Guarde R$ 100 em suas metas dentro de 30 dias.', days: 30, xp: 100, ic: 'coins' },
  nospend7: { n: '7 dias sem compras desnecessárias', d: 'Nenhum gasto nas categorias não essenciais por 7 dias seguidos.', days: 7, xp: 80, ic: 'leaf' },
  weekly: { n: 'Guardar toda semana', d: 'Guarde o valor escolhido em cada uma das próximas 4 semanas.', days: 28, xp: 120, ic: 'calendar' },
  reduce: { n: 'Reduzir gastos em uma categoria', d: 'Gaste menos que no mês anterior em uma categoria escolhida.', days: 0, xp: 100, ic: 'down' }
};
function savedBetween(from, to) {
  let s = 0;
  for (const t of S.tx) if (t.date >= from && t.date <= to) { if (t.type === 'meta') s += t.amount; else if (t.type === 'resgate_meta') s -= t.amount; }
  return s;
}
function startChallenge(tpl, params = {}) {
  const t = CH_TPL[tpl], td = today();
  const c = { id: uid(), tpl, start: td, status: 'ativo', params };
  if (tpl === 'reduce') {
    const k = ym(td), prev = catSpent(params.cat, ymAdd(k, -1));
    c.start = monthStart(k); c.end = monthEnd(k);
    c.params.base = prev; c.params.target = Math.round(prev * (1 - params.pct / 100));
  } else {
    if (tpl === 'nospend7' && nonEssentialOn(td)) c.start = addDays(td, 1);
    c.end = addDays(c.start, t.days - 1);
  }
  if (tpl === 'eco100') c.params.target = 10000;
  S.game.challenges.unshift(c);
  return c;
}
function evalChallenge(c) {
  const td = today(), t = CH_TPL[c.tpl];
  const upto = td < c.end ? td : c.end;
  const r = { p: 0, label: '', days: [], status: c.status };
  const eachDay = fn => { for (let d = c.start; d <= c.end; d = addDays(d, 1)) r.days.push({ d, s: d > td ? 'f' : fn(d) }); };
  if (c.tpl === 'eco100') {
    const s = savedBetween(c.start, upto);
    r.p = clamp(s / c.params.target, 0, 1); r.label = `${money(Math.max(0, s), { force: true })} de ${money(c.params.target, { force: true })}`;
    eachDay(d => savedBetween(d, d) > 0 ? 'ok' : 'n');
    if (s >= c.params.target) r.status = 'concluido'; else if (td > c.end) r.status = 'falhou';
  } else if (c.tpl === 'nospend7') {
    let bad = false, good = 0;
    eachDay(d => { if (nonEssentialOn(d)) { bad = true; return 'bad'; } if (d < td) { good++; return 'ok'; } return 'n'; });
    r.p = clamp(good / 7, 0, 1); r.label = `${good} de 7 dias`;
    if (bad) r.status = 'falhou'; else if (td > c.end) r.status = 'concluido';
  } else if (c.tpl === 'weekly') {
    let ok = 0, failed = false; const weeks = [];
    for (let w = 0; w < 4; w++) {
      const a = addDays(c.start, w * 7), b = addDays(a, 6);
      const s = a > td ? 0 : savedBetween(a, b < td ? b : td);
      const hit = s >= c.params.amount; if (hit) ok++; else if (b < td) failed = true;
      weeks.push({ a, b, s, hit });
    }
    r.weeks = weeks; r.p = ok / 4; r.label = `${ok} de 4 semanas`;
    eachDay(d => { const w = weeks[Math.floor(daysBetween(c.start, d) / 7)]; return w.hit ? 'ok' : (savedBetween(d, d) > 0 ? 'ok' : 'n'); });
    if (ok === 4) r.status = 'concluido'; else if (failed) r.status = 'falhou';
  } else if (c.tpl === 'reduce') {
    const spent = catSpent(c.params.cat, ym(c.start));
    r.spent = spent;
    r.p = c.params.target > 0 ? clamp(1 - spent / c.params.target, 0, 1) : 0;
    r.label = `${money(spent, { force: true })} de ${money(c.params.target, { force: true })} em ${c.params.cat}`;
    eachDay(d => S.tx.some(x => x.type === 'despesa' && x.category === c.params.cat && x.date === d) ? 'bad' : 'ok');
    if (spent > c.params.target) r.status = 'falhou'; else if (td > c.end) r.status = 'concluido';
  }
  if (c.status !== 'ativo') r.status = c.status;
  r.tplInfo = t;
  return r;
}
function updateChallenges(quiet) {
  for (const c of S.game.challenges) {
    if (c.status !== 'ativo') continue;
    const r = evalChallenge(c);
    if (r.status !== 'ativo') {
      c.status = r.status; c.doneAt = today();
      if (r.status === 'concluido') {
        addXP('desafio', CH_TPL[c.tpl].xp, 'Desafio: ' + CH_TPL[c.tpl].n, quiet);
        if (!quiet) UI.toast('Desafio concluído: ' + CH_TPL[c.tpl].n, 'flag');
      }
    }
  }
}
function checkGoals(quiet) {
  for (const g of S.goals) {
    if (!g.completedAt && g.target > 0 && goalSaved(g) >= g.target) {
      g.completedAt = today();
      addXP('meta_concluida', null, 'Meta concluída: ' + g.name, quiet);
      if (!quiet) setTimeout(() => UI.celebrate('Meta concluída', g.name), 300);
    }
  }
}
/* rotina chamada após qualquer alteração */
function afterChange(quiet) {
  checkGoals(quiet);
  updateChallenges(quiet);
  checkAchievements(quiet);
  save();
}
