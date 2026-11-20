/* Pink Finance — roteador, ações de interface e inicialização */
'use strict';
const App = {
  tab: 'home', stack: [], homeChart: 'cat', goalsTab: 'metas', billsTab: 'proximas',
  calK: null, calSel: null, budK: null, repMode: 'mensal', repK: null, repY: null,
  f: null,
  go(tab, opts = {}) {
    this.tab = tab; this.stack = [];
    if (opts.gt) this.goalsTab = opts.gt;
    this.render(); window.scrollTo(0, 0);
  },
  open(screen, params = {}) { this.stack.push({ screen, params, scroll: window.scrollY }); histPush(); this.render(); window.scrollTo(0, 0); },
  back(fromPop) { const s = this.stack.pop(); this.render(); if (s) window.scrollTo(0, s.scroll); },
  render() {
    if (!S) return;
    document.documentElement.dataset.theme = S.settings.theme;
    const top = this.stack[this.stack.length - 1];
    const name = top ? top.screen : this.tab;
    const fn = Screens[name] || Screens.home;
    const root = $('#app');
    const focus = document.activeElement && document.activeElement.id === 'txq' ? { pos: document.activeElement.selectionStart } : null;
    try { root.innerHTML = fn(top ? top.params : {}); }
    catch (e) { console.error(e); root.innerHTML = `<div class="screen"><div class="card empty">${ic('alert')}<div>Algo deu errado nesta tela.</div><button class="btn sm mt12" data-a="go" data-tab="home" style="width:auto">Voltar ao início</button></div></div>`; }
    const sub = !!top;
    root.firstElementChild && sub && root.firstElementChild.classList.add('withnav');
    $$('.nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === this.tab));
    const fab = $('.fab'); fab.classList.toggle('hidden', !(['home', 'txs', 'accounts'].includes(name)));
    if (focus) { const q = $('#txq'); if (q) { q.focus(); try { q.setSelectionRange(focus.pos, focus.pos); } catch (e) { } } }
    UI.animate(root);
  }
};

/* ---------- ações (data-a) ---------- */
const A = {
  back: () => App.back(),
  go: d => App.go(d.tab, { gt: d.gt }),
  open: d => App.open(d.s, { id: d.id }),
  goGame: () => { App.goalsTab = 'conquistas'; App.go('goals'); },
  toggleHide: () => { S.settings.hideBalance = !S.settings.hideBalance; save(); App.render(); },
  toggleTheme: () => { S.settings.theme = S.settings.theme === 'dark' ? 'light' : 'dark'; save(); App.render(); setThemeColor(); },
  homeChart: d => { App.homeChart = d.v; App.render(); },
  newTx: d => Act.txForm(Object.assign({ type: d.type || 'despesa' }, d.acc ? { accountId: d.acc, accountIdT: d.acc } : {}, d.method ? { method: d.method } : {}, d.date ? { date: d.date } : {})),
  txDetail: d => { const t = S.tx.find(x => x.id === d.id); if (t) Act.txDetail(t); },
  accountForm: d => Act.accountForm(d.id ? acc(d.id) : null),
  unarchive: d => { const a = acc(d.id); if (a) { a.archived = false; commit('Conta reativada'); } },
  adjust: d => Act.adjust(acc(d.id)),
  import: d => PFsys.importFlow(d.id),
  filterAcc: d => { App.f = defaultFilter(); App.f.mode = 'all'; App.f.accs = [d.id]; App.go('txs'); },
  invoiceOpen: d => { const inv = invoices(d.acc).find(i => i.key === d.key) || currentInvoice(d.acc); if (inv) Act.invoiceDetail(inv); },
  payInvoice: d => { const inv = invoices(d.acc).find(i => i.key === d.key) || currentInvoice(d.acc); if (inv && inv.remaining > 0) Act.payInvoice(inv); },
  billDetail: d => { const b = billById(d.id); if (b) Act.billDetail(b); },
  billForm: () => Act.billForm(null),
  billsTab: d => { App.billsTab = d.v; App.render(); },
  goalForm: d => Act.goalForm(d.id ? goalById(d.id) : null),
  goalMove: d => Act.goalMove(goalById(d.id), !!d.w),
  goalsTab: d => { App.goalsTab = d.v; App.render(); },
  startCh: d => Act.startChallenge(d.v),
  abandonCh: d => Act.abandonChallenge(S.game.challenges.find(c => c.id === d.id)),
  noSpend: () => Act.noSpendDay(),
  achInfo: d => { const a = ACHIEVEMENTS.find(x => x.id === d.id), on = S.game.ach[a.id]; UI.dialog({ title: a.n, msg: a.d + (on ? ` Desbloqueada em ${fmtDate(on)}.` : ' Ainda bloqueada.') + (a.xp ? ` Recompensa: +${a.xp} XP.` : ''), ok: 'Fechar', cancel: null }); },
  invForm: d => Act.invForm(d.id ? invById(d.id) : null),
  invUpdate: d => Act.invUpdate(invById(d.id)),
  invAporte: d => Act.invAporte(invById(d.id)),
  invResgate: d => Act.invResgate(invById(d.id)),
  reviewInv: () => Act.reviewInvestments(),
  reminderForm: d => Act.reminderForm(d.id ? S.invReminders.find(r => r.id === d.id) : null),
  reminderNew: d => { Act.reminderForm(null); setTimeout(() => { const t = $('#f_title'); if (t && d.title) t.value = d.title; }, 50); },
  remDone: d => { const r = S.invReminders.find(x => x.id === d.id); if (r) Act.reminderDone(r); },
  budgetForm: d => Act.budgetForm(d.cat || null),
  budgetFormNew: d => { UI.form({ title: 'Limite · ' + d.cat, fields: [{ k: 'limit', label: 'Limite mensal', type: 'money', req: true }], values: {}, onSubmit: x => { S.budgets[d.cat] = x.limit; checkBudget(d.cat, ym(today())); addXP('orcamento'); commit('Limite salvo'); } }); },
  budMonth: d => { App.budK = ymAdd(App.budK, +d.d); App.render(); },
  calMonth: d => { App.calK = ymAdd(App.calK, +d.d); App.calSel = null; App.render(); },
  calSel: d => { App.calSel = d.d; App.render(); },
  repMode: d => { App.repMode = d.v; App.render(); },
  repNav: d => { if (App.repMode === 'mensal') App.repK = ymAdd(App.repK, +d.d); else App.repY = App.repY + +d.d; App.render(); },
  exportPDF: () => PFsys.exportReportPDF(App.repMode, App.repMode === 'mensal' ? App.repK : App.repY),
  exportXLSX: () => PFsys.exportReportXLSX(App.repMode, App.repMode === 'mensal' ? App.repK : App.repY),
  exportAll: () => PFsys.exportAllXLSX(),
  doBackup: () => PFsys.backup(),
  alerts: () => {
    const al = alertsList();
    UI.sheet({ title: 'Alertas', body: al.length ? `<div class="list">${al.map(x => `<button class="li" ${x.act}><div class="av" style="${x.cls === 'bad' ? 'background:var(--badbg);color:var(--bad)' : x.cls === 'warn' ? 'background:var(--warnbg);color:var(--warn)' : ''}">${ic(x.icon, 'sm')}</div><div class="col grow"><span class="t">${esc(x.text)}</span><span class="s">${esc(x.sub)}</span></div>${ic('chev', 'sm')}</button>`).join('')}</div>` : `<div class="empty">${ic('checkc')}<div>Nenhum alerta. Tudo em ordem.</div></div>`, onMount(api) { api.el.addEventListener('click', e => { if (e.target.closest('[data-a]')) api.close(); }, true); } });
  },
  clearSample: async () => { if (!await UI.confirm('Apagar dados de exemplo?', 'Remove todos os lançamentos, contas a pagar, metas, investimentos, desafios e XP de exemplo. O que você cadastrou continua. As contas Mercado Pago, Nubank e Viacredi ficam com saldo inicial zero para você ajustar.', 'Apagar')) return; clearSampleData(); afterChange(true); App.go('home'); UI.toast('Dados de exemplo apagados. Comece ajustando o saldo de cada conta.'); },
  loadSample: () => { loadSampleData(); processRecurring(); afterChange(true); App.go('home'); UI.toast('Dados de exemplo carregados'); },
  resetAll: async () => { if (!await UI.confirm('Apagar TODOS os dados?', 'Contas, lançamentos, metas, investimentos, configurações e XP serão apagados deste aparelho. Isso não pode ser desfeito. Faça um backup antes, se quiser.', 'Apagar tudo')) return; if (!await PFsys.lock(true)) return; S = defaultState(); S.settings.onboarded = true; save(); App.go('home'); UI.toast('Todos os dados foram apagados'); },
  editName: () => UI.form({ title: 'Seu nome', fields: [{ k: 'name', label: 'Como quer ser chamado?', type: 'text' }], values: { name: S.settings.name }, onSubmit: x => { S.settings.name = x.name; save(); App.render(); } }),
  nonEssential: () => UI.form({ title: 'Gastos não essenciais', note: 'Usado no desafio "7 dias sem compras desnecessárias", na medalha da semana e no registro de dia sem gastos.', fields: [{ k: 'cats', label: 'Categorias', type: 'chips', options: catOpts(CAT_OUT) }], values: { cats: S.settings.nonEssential }, onSubmit: x => { S.settings.nonEssential = x.cats; commit('Preferência salva'); } }),
  setPin: () => PFsys.setPinFlow(),
  removePin: () => PFsys.removePin(),
  toggleBio: () => PFsys.toggleBio(),
  lockAfter: () => UI.form({ title: 'Bloquear após', fields: [{ k: 'm', label: 'Tempo fora do app', type: 'select', options: [['0', 'Imediatamente'], ['1', '1 minuto'], ['5', '5 minutos'], ['15', '15 minutos']] }], values: { m: String(S.settings.lockAfter) }, onSubmit: x => { S.settings.lockAfter = +x.m; save(); App.render(); } }),
  toggleNotif: () => PFsys.toggleNotif(),
  testNotif: () => PFsys.testNotif(),
  notifOffsets: () => UI.form({ title: 'Lembretes padrão', note: 'Usado em novas contas a pagar. Cada conta pode ter os seus.', fields: [{ k: 'o', label: 'Avisar', type: 'chips', options: REM_OPTS.map(([d, l]) => [String(d), l]) }], values: { o: S.settings.notif.offsets.map(String) }, onSubmit: x => { S.settings.notif.offsets = x.o.map(Number).sort((a, b) => b - a); save(); App.render(); } }),
  installApp: () => PFsys.install(),
  txFilters: () => openTxFilters(),
  txType: d => { App.f.type = d.v; App.render(); },
  txMonth: d => { App.f.k = ymAdd(App.f.k, +d.d); App.render(); },
  txClear: () => { const q = App.f.q; App.f = defaultFilter(); App.f.q = q; App.render(); },
  txPeriod: () => UI.form({
    title: 'Período', fields: [{ k: 'mode', type: 'seg', options: [['month', 'Mês'], ['all', 'Tudo'], ['custom', 'Personalizado']] }, { k: 'from', label: 'De', type: 'date', show: x => x.mode === 'custom' }, { k: 'to', label: 'Até', type: 'date', show: x => x.mode === 'custom' }],
    values: { mode: App.f.mode, from: App.f.from || monthStart(ym(today())), to: App.f.to || today() }, submit: 'Aplicar',
    onSubmit: x => { App.f.mode = x.mode; App.f.from = x.from; App.f.to = x.to; App.render(); }
  })
};
function defaultFilter() { return { k: ym(today()), mode: 'month', from: '', to: '', q: '', type: 'all', cats: [], accs: [], methods: [] }; }
function openTxFilters() {
  UI.form({
    title: 'Filtros', submit: 'Aplicar',
    fields: [
      { k: 'cats', label: 'Categorias', type: 'chips', options: catOpts(CAT_OUT.concat(CAT_IN)) },
      { k: 'accs', label: 'Bancos', type: 'chips', options: S.accounts.map(a => [a.id, a.name]) },
      { k: 'methods', label: 'Forma de pagamento', type: 'chips', options: METHODS }
    ],
    values: { cats: App.f.cats, accs: App.f.accs, methods: App.f.methods },
    extra: [{ label: 'Limpar', cls: 'sec', onClick: (x, api) => { App.f.cats = []; App.f.accs = []; App.f.methods = []; api.close(); App.render(); } }],
    onSubmit: x => { Object.assign(App.f, x); App.render(); }
  });
}
function setThemeColor() { const m = $('meta[name="theme-color"]'); if (m) m.content = S.settings.theme === 'dark' ? '#151719' : '#F2F3F2'; }

document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el || el.disabled) return;
  const fn = A[el.dataset.a]; if (!fn) return;
  e.preventDefault();
  try { fn(Object.assign({}, el.dataset), el); } catch (err) { console.error(err); UI.toast('Erro: ' + err.message, 'alert'); }
});
let qTimer;
document.addEventListener('input', e => {
  if (e.target.id === 'txq') { clearTimeout(qTimer); qTimer = setTimeout(() => { App.f.q = e.target.value; const box = $('#txlist'); if (box) { box.innerHTML = txGrouped(filteredTx()); } }, 160); }
});
document.addEventListener('change', e => { if (e.target.id === 'restoreFile' && e.target.files[0]) PFsys.restore(e.target.files[0]); });

/* ---------- primeira abertura ---------- */
function onboarding() {
  return new Promise(res => {
    const ov = document.createElement('div'); ov.className = 'lock'; ov.style.justifyContent = 'flex-end'; ov.style.paddingBottom = 'calc(32px + var(--safe-b))';
    ov.innerHTML = `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;max-width:380px">${LOGO_SVG}<h1 style="margin:8px 0 6px;font-size:28px;letter-spacing:-.02em">Pink Finance</h1><p class="muted" style="margin:0 0 22px">Controle, disciplina e evolução patrimonial — com níveis, desafios e conquistas.</p>
      <div class="list" style="text-align:left;width:100%">${[['wallet', 'Mercado Pago, Nubank e Viacredi já cadastrados'], ['target', 'Metas com cálculo automático do aporte mensal'], ['trophy', 'XP, níveis e desafios que premiam bons hábitos'], ['lock', 'Dados só no seu aparelho, com PIN e biometria']].map(([i, t]) => `<div class="li"><div class="av ac">${ic(i, 'sm')}</div><span class="small">${t}</span></div>`).join('')}</div></div>
      <div style="width:100%;max-width:380px;display:grid;gap:10px"><button class="btn" data-o="sample">Explorar com dados de exemplo</button><button class="btn sec" data-o="empty">Começar do zero</button></div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { const b = e.target.closest('[data-o]'); if (!b) return; ov.remove(); res(b.dataset.o); });
  });
}

/* ---------- inicialização ---------- */
async function boot() {
  S = loadState();
  const first = !S;
  if (!S) S = defaultState();
  const k = ym(today());
  App.f = defaultFilter(); App.calK = k; App.budK = k; App.repK = k; App.repY = +k.slice(0, 4);
  document.documentElement.dataset.theme = S.settings.theme; setThemeColor();
  document.body.insertAdjacentHTML('beforeend', `<nav class="nav"><div class="in">${[['home', 'home', 'Início'], ['accounts', 'wallet', 'Contas'], ['txs', 'list', 'Movimentações'], ['goals', 'target', 'Metas'], ['profile', 'user', 'Perfil']].map(([t, i, l]) => `<button data-a="go" data-tab="${t}">${ic(i)}<span>${l}</span></button>`).join('')}</div></nav><button class="fab hidden" data-a="newTx" aria-label="Novo lançamento">${ic('plus')}</button>`);
  if (first || !S.settings.onboarded) {
    const choice = await onboarding();
    if (choice === 'sample') loadSampleData();
    S.settings.onboarded = true;
  }
  if (S.settings.pin) await PFsys.lock();
  processRecurring();
  if (!S.game.active.includes(today()) && S.tx.some(t => (t.created || '').slice(0, 10) === today())) markActive();
  afterChange(true);
  App.render();
  PFsys.checkReminders();
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { }
  if ('serviceWorker' in navigator && window.self === window.top && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').then(() => { if (S.settings.notif.enabled) PFsys.registerPeriodic(); }).catch(() => { });
    navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.type === 'shown' && Array.isArray(e.data.keys)) { e.data.keys.forEach(k => S.settings.sent[k] = today()); save(); } });
  }
  try { const q = new URLSearchParams(location.search).get('a'); if (q === 'despesa') setTimeout(() => Act.txForm({ type: 'despesa' }), 300); else if (q === 'bills') App.open('bills'); } catch (e) { }
  setInterval(() => { if (!document.hidden) { if (processRecurring()) { afterChange(true); App.render(); } PFsys.checkReminders(); } }, 5 * 60000);
}
document.addEventListener('DOMContentLoaded', boot);
