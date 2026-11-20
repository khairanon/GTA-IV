/* Pink Finance — sistema: segurança, notificações, arquivos (PDF, XLSX, CSV/OFX, backup) */
'use strict';
const PFsys = {};

/* ======================= arquivos ======================= */
PFsys.saveFile = async (name, data, mime) => {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
  if (window.self !== window.top && window.claude && typeof window.claude.use === 'function') {
    try {
      const d = await window.claude.use('downloads');
      if (d) { await d.save({ filename: name, data: blob }); UI.toast('Arquivo pronto: ' + name, 'download'); return true; }
    } catch (e) { if (e && e.code === 'declined') return false; }
  }
  try {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    UI.toast('Arquivo salvo em Downloads: ' + name, 'download');
    return true;
  } catch (e) { UI.toast('Não foi possível salvar o arquivo aqui', 'alert'); return false; }
};
PFsys.readFile = file => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => {
    const buf = new Uint8Array(r.result);
    let txt = new TextDecoder('utf-8').decode(buf);
    if (txt.includes('�')) txt = new TextDecoder('windows-1252').decode(buf);
    res(txt.replace(/^﻿/, ''));
  };
  r.onerror = rej; r.readAsArrayBuffer(file);
});

/* ---------- backup ---------- */
PFsys.backup = async () => {
  const name = `pinkfinance-backup-${today()}.json`;
  const ok = await PFsys.saveFile(name, JSON.stringify(S, null, 1), 'application/json');
  if (ok) { S.settings.lastBackup = today(); save(); App.render(); }
};
PFsys.restore = async file => {
  try {
    const obj = JSON.parse(await PFsys.readFile(file));
    if (!obj || !Array.isArray(obj.accounts) || !Array.isArray(obj.tx)) throw new Error('formato');
    const ok = await UI.confirm('Restaurar backup?', `Arquivo com ${obj.tx.length} lançamentos e ${obj.accounts.length} contas. Os dados atuais serão substituídos.`, 'Restaurar');
    if (!ok) return;
    const keepSec = { pin: S.settings.pin, salt: S.settings.salt, pinLen: S.settings.pinLen, bio: S.settings.bio };
    S = migrate(obj);
    if (!S.settings.pin && keepSec.pin) Object.assign(S.settings, keepSec);
    processRecurring(); afterChange(true); App.go('home'); UI.toast('Backup restaurado');
  } catch (e) { UI.toast('Arquivo de backup inválido', 'alert'); }
};

/* ======================= ZIP + XLSX ======================= */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipStore(files) {
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  for (const f of files) {
    const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, 0, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
    h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), name);
    off += 30 + name.length + data.length;
  }
  const csize = central.reduce((s, x) => s + x.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
const xmlEsc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
const colName = i => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
const excelDate = iso => (Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 864e5;
/* células: string | number | {v, t:'money'|'date'|'pct'|'b'|'bmoney'} */
PFsys.xlsx = sheets => {
  const STY = { b: 1, money: 2, date: 3, pct: 4, bmoney: 5, title: 6 };
  const sheetXml = sh => {
    const rows = sh.rows.map((r, ri) => `<row r="${ri + 1}">${r.map((c, ci) => {
      if (c === null || c === undefined || c === '') return '';
      const ref = colName(ci) + (ri + 1);
      if (typeof c === 'number') return `<c r="${ref}"><v>${c}</v></c>`;
      if (typeof c === 'string') return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(c)}</t></is></c>`;
      const s = STY[c.t] || 0;
      if (c.t === 'money' || c.t === 'bmoney') return `<c r="${ref}" s="${s}"><v>${(c.v / 100).toFixed(2)}</v></c>`;
      if (c.t === 'date') return `<c r="${ref}" s="3"><v>${excelDate(c.v)}</v></c>`;
      if (c.t === 'pct') return `<c r="${ref}" s="4"><v>${c.v}</v></c>`;
      return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(c.v)}</t></is></c>`;
    }).join('')}</row>`).join('');
    const cols = sh.widths ? `<cols>${sh.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0">${sh.freeze ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' : ''}</sheetView></sheetViews>${cols}<sheetData>${rows}</sheetData></worksheet>`;
  };
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00;[Red]-&quot;R$&quot; #,##0.00"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFF2F3F2"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF252A2E"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="1" fillId="2" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const files = [
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xmlEsc(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', data: styles },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) }))
  ];
  return zipStore(files);
};
const H = arr => arr.map(v => ({ v, t: 'b' }));
const M = c => ({ v: c, t: 'money' });
const D = d => d ? { v: d, t: 'date' } : '';
function txSheetRows(txs) {
  return [H(['Data', 'Tipo', 'Descrição', 'Categoria', 'Conta', 'Conta destino', 'Forma', 'Valor', 'Efeito no resultado', 'Observações'])].concat(
    txs.map(t => [D(t.date), TX_TYPE_L[t.type], txTitle(t), t.category || '', accName(t.accountId), t.toAccountId ? accName(t.toAccountId) : '', METHOD_L[t.method] || '', M(t.amount), M(t.type === 'receita' ? t.amount : t.type === 'despesa' ? -t.amount : 0), t.notes || '']));
}
PFsys.exportReportXLSX = async (mode, key) => {
  const R = reportData(mode, key), st = R.st;
  const resumo = [[{ v: 'Pink Finance — ' + (mode === 'mensal' ? 'Relatório mensal' : 'Relatório anual'), t: 'title' }], [R.label], [],
    H(['Indicador', 'Valor']), ['Recebido', M(st.inc)], ['Gasto', M(st.exp)], ['Economizado (recebido − gasto)', M(st.net)], ['Taxa de economia', { v: st.inc ? +(st.net / st.inc).toFixed(4) : 0, t: 'pct' }],
    ['Guardado em metas (líquido)', M(st.goalsNet)], ['Investido (líquido)', M(st.investNet)], ['Saldo total atual', M(totalBalance())], ['Patrimônio líquido atual', M(netWorth())], [], ['Gerado em ' + fmtDate(today())]];
  const cats = [H(['Categoria', 'Gasto', '% do total'])].concat(sortedCats(st.byCat).map(([c, v]) => [c, M(v), { v: +(v / (st.exp || 1)).toFixed(4), t: 'pct' }]));
  const meses = [H(['Mês', 'Entradas', 'Saídas', 'Resultado', 'Guardado em metas', 'Investido', 'Patrimônio'])].concat(R.months.map((m, i) => [monthLabel(m.k), M(m.inc), M(m.exp), M(m.net), M(m.goalsNet), M(m.investNet), M(R.nw[i].v)]));
  const name = `pinkfinance-${mode}-${key}.xlsx`;
  await PFsys.saveFile(name, PFsys.xlsx([
    { name: 'Resumo', rows: resumo, widths: [36, 18] },
    { name: 'Categorias', rows: cats, widths: [24, 16, 12], freeze: true },
    { name: 'Comparação mensal', rows: meses, widths: [20, 15, 15, 15, 18, 15, 16], freeze: true },
    { name: 'Lançamentos', rows: txSheetRows(R.txs), widths: [12, 18, 30, 18, 16, 16, 18, 14, 16, 30], freeze: true }
  ]));
};
PFsys.exportAllXLSX = async () => {
  const txs = S.tx.slice().sort((a, b) => a.date.localeCompare(b.date));
  const contas = [H(['Conta', 'Banco', 'Saldo atual', 'Cartão', 'Limite', 'Usado no cartão', 'Fechamento', 'Vencimento'])].concat(S.accounts.map(a => [a.name + (a.archived ? ' (arquivada)' : ''), a.bank, M(balance(a.id)), hasCard(a) ? 'Sim' : 'Não', hasCard(a) ? M(a.card.limit) : '', hasCard(a) ? M(cardUsed(a.id)) : '', hasCard(a) ? a.card.closing : '', hasCard(a) ? a.card.due : '']));
  const bills = [H(['Conta', 'Valor', 'Vencimento', 'Categoria', 'Banco', 'Situação', 'Paga em', 'Recorrente'])].concat(S.bills.map(b => [b.name, M(b.amount), D(b.due), b.category, accName(b.accountId), BILL_L[billStatus(b)], D(b.paidAt), b.recurring ? 'Sim' : 'Não']));
  const metas = [H(['Meta', 'Categoria', 'Valor desejado', 'Acumulado', 'Falta', 'Prazo', 'Necessário/mês', 'Contribuição desejada'])].concat(S.goals.map(g => { const p = goalPlan(g); return [g.name, g.category, M(g.target), M(p.saved), M(p.remaining), D(g.deadline), M(p.need), M(g.monthly || 0)]; }));
  const invs = [H(['Investimento', 'Tipo', 'Instituição', 'Aplicado', 'Valor atual', 'Rendimento', 'Rentab. contratada', 'Liquidez', 'Aplicação', 'Vencimento', 'Objetivo'])].concat(S.investments.map(i => [i.name, i.type, i.institution, M(i.principal), M(i.current), M(i.current - i.principal), i.rate, i.liquidity, D(i.date), D(i.maturity), i.goal]));
  const bud = [H(['Categoria', 'Limite mensal', 'Gasto no mês atual'])].concat(Object.entries(S.budgets).map(([c, l]) => [c, M(l), M(catSpent(c, ym(today())))]));
  await PFsys.saveFile(`pinkfinance-completo-${today()}.xlsx`, PFsys.xlsx([
    { name: 'Lançamentos', rows: txSheetRows(txs), widths: [12, 18, 30, 18, 16, 16, 18, 14, 16, 30], freeze: true },
    { name: 'Contas', rows: contas, widths: [22, 22, 15, 8, 14, 15, 11, 11], freeze: true },
    { name: 'Contas a pagar', rows: bills, widths: [24, 14, 12, 16, 16, 14, 12, 11], freeze: true },
    { name: 'Metas', rows: metas, widths: [26, 20, 15, 15, 15, 12, 15, 18], freeze: true },
    { name: 'Investimentos', rows: invs, widths: [24, 18, 18, 14, 14, 14, 18, 14, 12, 12, 22], freeze: true },
    { name: 'Orçamento', rows: bud, widths: [22, 15, 18], freeze: true }
  ]));
};

/* ======================= PDF (gerador próprio, Helvetica/WinAnsi) ======================= */
const WIN = { 8364: 128, 8230: 133, 8211: 150, 8212: 151, 8226: 149, 8220: 147, 8221: 148, 8216: 145, 8217: 146, 9650: 94, 9660: 118, 8722: 45 };
const pdfStr = s => { let o = ''; for (const ch of String(s)) { let c = ch.codePointAt(0); if (WIN[c]) c = WIN[c]; else if (c > 255 || (c >= 128 && c < 160)) c = 63; const x = String.fromCharCode(c); o += (x === '(' || x === ')' || x === '\\') ? '\\' + x : x; } return o; };
function charW(ch) { if (/[0-9$]/.test(ch)) return 556; if (/[.,:;'!| ]/.test(ch)) return 278; if (/[il]/.test(ch)) return 222; if (/[mM]/.test(ch)) return 833; if (/[wW]/.test(ch)) return 722; if (ch === '-') return 333; if (/[A-Z]/.test(ch)) return 667; return 530; }
const textW = (s, size, bold) => [...String(s)].reduce((w, c) => w + charW(c), 0) * size / 1000 * (bold ? 1.06 : 1);
class PDFDoc {
  constructor() { this.pages = []; this.add(); }
  add() { this.ops = []; this.pages.push(this.ops); this.y = 60; }
  col(c) { const h = c.replace('#', ''); return [0, 2, 4].map(i => (parseInt(h.substr(i, 2), 16) / 255).toFixed(3)).join(' '); }
  rect(x, y, w, h, color) { this.ops.push(`${this.col(color)} rg ${x.toFixed(1)} ${(842 - y - h).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f`); }
  line(x1, y1, x2, y2, color = '#DCE0DE', w = .6) { this.ops.push(`${this.col(color)} RG ${w} w ${x1} ${842 - y1} m ${x2} ${842 - y2} l S`); }
  text(x, y, s, { size = 10, bold = false, color = '#151719', align = 'left', maxW } = {}) {
    let str = String(s);
    if (maxW) while (str.length > 1 && textW(str, size, bold) > maxW) str = str.slice(0, -2) + '…';
    let xx = x; const w = textW(str, size, bold);
    if (align === 'right') xx = x - w; else if (align === 'center') xx = x - w / 2;
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${this.col(color)} rg ${xx.toFixed(1)} ${(842 - y).toFixed(1)} Td (${pdfStr(str)}) Tj ET`);
  }
  ensure(h) { if (this.y + h > 800) { this.add(); return true; } return false; }
  build() {
    const objs = [], n = this.pages.length;
    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objs[2] = `<< /Type /Pages /Kids [${this.pages.map((_, i) => `${5 + i * 2} 0 R`).join(' ')}] /Count ${n} >>`;
    objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    this.pages.forEach((ops, i) => {
      const c = ops.join('\n');
      objs[5 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`;
      objs[6 + i * 2] = `<< /Length ${c.length} >>\nstream\n${c}\nendstream`;
    });
    let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'; const offs = [];
    for (let i = 1; i < objs.length; i++) { offs[i] = out.length; out += `${i} 0 obj\n${objs[i]}\nendobj\n`; }
    const xref = out.length;
    out += `xref\n0 ${objs.length}\n0000000000 65535 f \n` + offs.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
    out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const bytes = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
    return new Blob([bytes], { type: 'application/pdf' });
  }
}
PFsys.exportReportPDF = async (mode, key) => {
  const R = reportData(mode, key), st = R.st, P = new PDFDoc(), L = 40, RR = 555;
  const fm = c => money(c, { force: true });
  const header = (first) => {
    P.rect(0, 0, 595, first ? 92 : 46, '#151719');
    P.text(L, 30, 'Pink Finance', { size: first ? 16 : 11, bold: true, color: '#F2F3F2' });
    P.text(RR, 30, 'Gerado em ' + fmtDate(today()), { size: 8.5, color: '#69747B', align: 'right' });
    if (first) { P.text(L, 58, mode === 'mensal' ? 'Relatório mensal' : 'Relatório anual', { size: 10, color: '#78917F', bold: true }); P.text(L, 78, R.label, { size: 18, bold: true, color: '#F2F3F2' }); P.y = 118; }
    else P.y = 72;
  };
  header(true);
  // indicadores
  const boxes = [['Recebi', st.inc], ['Gastei', st.exp], ['Economizei', st.net], ['Guardei em metas', st.goalsNet], ['Investi (líquido)', st.investNet], ['Patrimônio atual', netWorth()]];
  const bw = (RR - L - 20) / 3;
  boxes.forEach(([l, v], i) => {
    const x = L + (i % 3) * (bw + 10), y = P.y + Math.floor(i / 3) * 58;
    P.rect(x, y, bw, 48, '#F2F3F2'); P.rect(x, y, 3, 48, i === 2 && v < 0 ? '#C07A66' : '#78917F');
    P.text(x + 12, y + 18, l, { size: 8.5, color: '#69747B' }); P.text(x + 12, y + 36, fm(v), { size: 13, bold: true, color: v < 0 ? '#A55C48' : '#151719' });
  });
  P.y += 128;
  if (st.inc) { P.text(L, P.y, `Taxa de economia: ${fmtPct(R.savingRate, 1)} da renda`, { size: 9.5, color: '#454C51' }); P.y += 22; }
  // categorias
  const sec = t => { P.ensure(40); P.text(L, P.y, t.toUpperCase(), { size: 9, bold: true, color: '#56685C' }); P.line(L, P.y + 6, RR, P.y + 6, '#C9CFCB'); P.y += 22; };
  sec('Categorias em que mais gastei');
  const cats = sortedCats(st.byCat); const mx = cats.length ? cats[0][1] : 1;
  if (!cats.length) { P.text(L, P.y, 'Sem gastos no período.', { size: 9.5, color: '#69747B' }); P.y += 18; }
  cats.slice(0, 10).forEach(([c, v]) => {
    P.ensure(20); P.text(L, P.y, c, { size: 9.5, maxW: 130 });
    P.rect(L + 140, P.y - 8, 260, 8, '#ECEEED'); P.rect(L + 140, P.y - 8, Math.max(2, 260 * v / mx), 8, '#78917F');
    P.text(RR - 50, P.y, fm(v), { size: 9.5, align: 'right' }); P.text(RR, P.y, fmtPct(pct(v, st.exp)), { size: 8.5, color: '#69747B', align: 'right' }); P.y += 19;
  });
  P.y += 10;
  // comparação mensal
  sec(mode === 'mensal' ? 'Comparação com os meses anteriores' : 'Comparação entre os meses');
  const cx = [L, L + 150, L + 250, L + 350, RR];
  ['Mês', 'Entradas', 'Saídas', 'Resultado', 'Patrimônio'].forEach((h, i) => P.text(i ? cx[i] + (i === 4 ? 0 : 80) : cx[0], P.y, h, { size: 8.5, bold: true, color: '#69747B', align: i ? 'right' : 'left' }));
  P.y += 14;
  R.months.forEach((m, i) => {
    P.ensure(18); if (i % 2 === 0) P.rect(L - 4, P.y - 11, RR - L + 8, 16, '#F6F7F6');
    P.text(cx[0], P.y, monthLabel(m.k), { size: 9.5 }); P.text(cx[1] + 80, P.y, fm(m.inc), { size: 9.5, align: 'right', color: '#4F6356' }); P.text(cx[2] + 80, P.y, fm(m.exp), { size: 9.5, align: 'right' });
    P.text(cx[3] + 80, P.y, fm(m.net), { size: 9.5, align: 'right', color: m.net < 0 ? '#A55C48' : '#151719' }); P.text(cx[4], P.y, m.k <= ym(today()) ? fm(R.nw[i].v) : '—', { size: 9.5, align: 'right' }); P.y += 16;
  });
  P.y += 12;
  // lançamentos
  sec(`Lançamentos (${R.txs.length})`);
  const tx = [L, L + 52, L + 230, L + 340, RR];
  const th = () => { ['Data', 'Descrição', 'Categoria', 'Conta', 'Valor'].forEach((h, i) => P.text(tx[i], P.y, h, { size: 8.5, bold: true, color: '#69747B', align: i === 4 ? 'right' : 'left' })); P.y += 14; };
  th();
  R.txs.forEach((t, i) => {
    if (P.ensure(16)) { header(false); th(); }
    if (i % 2 === 0) P.rect(L - 4, P.y - 10, RR - L + 8, 14, '#F6F7F6');
    const s = txSign(t);
    P.text(tx[0], P.y, fmtDate(t.date).slice(0, 5), { size: 8.5 }); P.text(tx[1], P.y, txTitle(t), { size: 8.5, maxW: 170 }); P.text(tx[2], P.y, t.category || TX_TYPE_L[t.type], { size: 8.5, maxW: 104, color: '#454C51' });
    P.text(tx[3], P.y, t.type === 'transferencia' ? accName(t.accountId) + ' > ' + accName(t.toAccountId) : accName(t.accountId), { size: 8.5, maxW: 120, color: '#454C51' });
    P.text(tx[4], P.y, (s > 0 ? '+' : s < 0 ? '-' : '') + fm(Math.abs(t.amount)), { size: 8.5, align: 'right', color: s > 0 ? '#4F6356' : '#151719' }); P.y += 14;
  });
  P.pages.forEach((ops, i) => { P.ops = ops; P.text(297, 825, `Página ${i + 1} de ${P.pages.length}  ·  Pink Finance`, { size: 7.5, color: '#9AA3A9', align: 'center' }); });
  await PFsys.saveFile(`pinkfinance-${mode}-${key}.pdf`, P.build());
};

/* ======================= importação CSV / OFX ======================= */
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim()).slice(0, 20);
  const cnt = ch => lines.reduce((s, l) => s + (l.split(ch).length - 1), 0);
  const dl = [';', ',', '\t'].sort((a, b) => cnt(b) - cnt(a))[0];
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true; else if (c === dl) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); if (row.some(x => x.trim())) rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  row.push(cell); if (row.some(x => x.trim())) rows.push(row);
  return rows.map(r => r.map(x => x.trim()));
}
function parseAnyDate(s) {
  s = String(s || '').trim(); let m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/))) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${pad(+m[2])}-${pad(+m[1])}`; }
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}
function parseAmountLoose(s) {
  s = String(s || '').replace(/[R$\s]/g, '');
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = s.replace(',', '.');
  const v = parseFloat(s.replace(/[^0-9.\-]/g, ''));
  return isNaN(v) ? NaN : Math.round(v * 100) * (/^\(.*\)$/.test(s) ? -1 : 1);
}
function parseOFX(text) {
  const out = [], re = /<STMTTRN>([\s\S]*?)(<\/STMTTRN>|(?=<STMTTRN>)|<\/BANKTRANLIST>)/gi; let m;
  const f = (b, n) => { const r = new RegExp('<' + n + '>([^<\\r\\n]*)', 'i').exec(b); return r ? r[1].trim() : ''; };
  while ((m = re.exec(text))) {
    const b = m[1], date = parseAnyDate(f(b, 'DTPOSTED')), amt = parseAmountLoose(f(b, 'TRNAMT'));
    if (date && !isNaN(amt)) out.push({ date, amount: amt, desc: f(b, 'MEMO') || f(b, 'NAME') || 'Lançamento', fitid: f(b, 'FITID') });
  }
  return out;
}
function rowsFromCSV(rows) {
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  let hi = -1, cD = -1, cA = -1, cS = -1;
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const r = rows[i].map(norm);
    const d = r.findIndex(x => /^(data|date|dt)\b|release_date|data_lancamento|data lancamento|data da compra/.test(x));
    const a = r.findIndex(x => /valor|amount|value|net_amount|montante|quantia/.test(x));
    if (d >= 0 && a >= 0) { hi = i; cD = d; cA = a; cS = [r.findIndex(x => /descri|title|titulo|historico|estabelecimento|memo/.test(x)), r.findIndex(x => /identificador|transaction_type|tipo|lancamento/.test(x))].find(x => x >= 0 && x !== d && x !== a) ?? -1; break; }
  }
  const out = [];
  if (hi >= 0) {
    for (const r of rows.slice(hi + 1)) { const date = parseAnyDate(r[cD]), amt = parseAmountLoose(r[cA]); if (date && !isNaN(amt) && amt !== 0) out.push({ date, amount: amt, desc: (cS >= 0 ? r[cS] : '') || 'Lançamento' }); }
    return out;
  }
  for (const r of rows) {
    const di = r.findIndex(x => parseAnyDate(x)); if (di < 0) continue;
    let ai = -1; for (let j = r.length - 1; j >= 0; j--) if (j !== di && /^-?\(?R?\$?\s?-?[\d.,]+\)?$/.test(r[j].replace(/\s/g, '')) && /[.,]\d{2}\)?$/.test(r[j])) { ai = j; break; }
    if (ai < 0) continue;
    const desc = r.filter((x, j) => j !== di && j !== ai && x && !/^[-\d.,\s]+$/.test(x)).sort((a, b) => b.length - a.length)[0] || 'Lançamento';
    out.push({ date: parseAnyDate(r[di]), amount: parseAmountLoose(r[ai]), desc });
  }
  return out;
}
const AUTO_CAT = [
  [/supermerc|mercado|atacad|giassi|angeloni|carrefour|assai|hortifruti|fort atacad/i, 'Mercado'],
  [/ifood|restaur|lanch|padaria|pizza|burger|cafe|cafeteria|subway|mc ?donald|bk |rappi|sorvet/i, 'Alimentação'],
  [/uber|99 ?app|99pop|onibus|ônibus|metro|estacionament|pedagio|pedágio|blablacar/i, 'Transporte'],
  [/posto|combust|shell|ipiranga|petrobras|br mania|gasolina|etanol/i, 'Combustível'],
  [/farm|drog|raia|panvel|clinic|hospital|laborat|medic|odonto|dentist|unimed/i, 'Saúde'],
  [/barbear|salao|salão|cabeleir|perfum|boticario|boticário|natura|cosmet/i, 'Beleza e cuidados'],
  [/academia|smart ?fit|gym|crossfit|bodytech/i, 'Academia'],
  [/netflix|spotify|prime|disney|hbo|max\b|youtube|apple\.com|google one|deezer|globoplay|assinatura|icloud|chatgpt|claude/i, 'Assinaturas'],
  [/cinema|ingresso|show|bar |cervej|steam|playstation|xbox|nintendo|parque|teatro/i, 'Lazer'],
  [/energia|celesc|copel|cemig|agua|água|samae|casan|sabesp|internet|vivo|claro|tim\b|oi\b|aluguel|condom|gas |iptu|ipva/i, 'Contas fixas'],
  [/shopee|amazon|mercado ?livre|magalu|magazine|americanas|shein|aliexpress|renner|riachuelo|c&a|centauro|loja/i, 'Compras']
];
function autoCategory(desc, income) {
  if (income) { if (/sal[aá]rio|folha|pagamento de sal|proventos/i.test(desc)) return 'Salário'; if (/rend|juros|dividend|jcp|cashback/i.test(desc)) return 'Rendimentos'; if (/venda|vendas/i.test(desc)) return 'Vendas'; return 'Outros recebimentos'; }
  for (const [re, c] of AUTO_CAT) if (re.test(desc)) return c;
  return 'Outros';
}
PFsys.importFlow = (accId) => {
  const st = { acc: accId || firstAcc(), mode: 'conta', rows: [], file: '' };
  const step1 = () => `<div class="field"><label>Conta de destino</label><select class="inp" id="imAcc">${activeAccounts().map(a => `<option value="${a.id}" ${a.id === st.acc ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>
    <div class="field"><label>Tipo de extrato</label><div class="seg" id="imMode"><button type="button" data-v="conta" class="${st.mode === 'conta' ? 'on' : ''}">Extrato da conta</button><button type="button" data-v="cartao" class="${st.mode === 'cartao' ? 'on' : ''}">Fatura do cartão</button></div><div class="hint">Na fatura, valores positivos são compras no crédito; pagamentos e estornos são ignorados.</div></div>
    <label class="btn" style="margin-top:6px">${ic('upload', 'sm')}Escolher arquivo CSV ou OFX<input type="file" id="imFile" accept=".csv,.ofx,.qfx,.txt,text/csv" hidden></label>
    <div class="card flat xs faint mt12">O arquivo é lido apenas neste aparelho. Lançamentos repetidos (mesma data, valor e descrição) são detectados e desmarcados.</div>`;
  const step2 = () => {
    const sel = st.rows.filter(r => r.on).length;
    return `<div class="between small" style="margin-bottom:8px"><span class="muted">${esc(st.file)} · ${st.rows.length} linhas</span><button class="link" id="imAll">${sel === st.rows.length ? 'Desmarcar' : 'Marcar'} todas</button></div>
    <div class="list">${st.rows.map((r, i) => `<div class="li" style="align-items:flex-start"><button class="sw ${r.on ? 'on' : ''}" data-row="${i}" style="transform:scale(.8);margin-top:4px"></button><div class="col grow"><span class="t ell" style="font-size:14px">${esc(r.desc)}</span><span class="s">${fmtDate(r.date)}${r.dup ? ' · <span class="warn">possível duplicado</span>' : ''}</span><select class="inp" data-cat="${i}" style="height:34px;font-size:13px;margin-top:6px;padding:0 30px 0 10px">${(r.income ? CAT_IN : CAT_OUT).map(c => `<option ${c === r.cat ? 'selected' : ''}>${c}</option>`).join('')}</select></div><span class="amt num ${r.income ? 'ok' : ''}">${r.income ? '+' : '−'}${money(Math.abs(r.amount), { force: true })}</span></div>`).join('')}</div>`;
  };
  const sh = UI.sheet({
    title: 'Importar extrato', body: step1(), footer: '<button class="btn" id="imGo" disabled>Importar</button>',
    onMount(api) {
      const el = api.el;
      el.addEventListener('click', e => {
        const m = e.target.closest('#imMode button'); if (m) { st.mode = m.dataset.v; $$('#imMode button', el).forEach(b => b.classList.toggle('on', b === m)); if (st.mode === 'cartao' && !hasCard(acc($('#imAcc', el).value))) UI.toast('Esta conta não tem cartão ativo. Ative em Editar conta.', 'info'); }
        const sw = e.target.closest('[data-row]'); if (sw) { const r = st.rows[+sw.dataset.row]; r.on = !r.on; sw.classList.toggle('on', r.on); upd(); }
        if (e.target.closest('#imAll')) { const all = st.rows.every(r => r.on); st.rows.forEach(r => r.on = !all); api.setBody(step2()); upd(); }
        if (e.target.closest('#imGo')) doImport();
      });
      el.addEventListener('change', async e => {
        if (e.target.id === 'imAcc') st.acc = e.target.value;
        if (e.target.dataset.cat !== undefined) st.rows[+e.target.dataset.cat].cat = e.target.value;
        if (e.target.id === 'imFile' && e.target.files[0]) {
          const file = e.target.files[0]; st.file = file.name; st.acc = $('#imAcc', el).value;
          if (st.mode === 'cartao' && !hasCard(acc(st.acc))) { UI.toast('Ative o cartão desta conta antes de importar a fatura', 'alert'); return; }
          try {
            const text = await PFsys.readFile(file);
            let raw = /<OFX>|<STMTTRN>/i.test(text) ? parseOFX(text) : rowsFromCSV(parseCSV(text));
            if (!raw.length) { UI.toast('Não encontrei lançamentos neste arquivo', 'alert'); return; }
            if (st.mode === 'cartao') {
              const positives = raw.filter(r => r.amount > 0).length, negatives = raw.length - positives;
              if (negatives > positives) raw = raw.map(r => Object.assign(r, { amount: -r.amount }));
              raw = raw.filter(r => r.amount > 0 && !/pagamento recebido|pagamento de fatura|estorno/i.test(r.desc)).map(r => Object.assign(r, { income: false }));
            } else raw = raw.map(r => Object.assign(r, { income: r.amount > 0 }));
            const exist = S.tx.filter(t => t.accountId === st.acc);
            st.rows = raw.map(r => {
              const abs = Math.abs(r.amount), dk = r.desc.toLowerCase().slice(0, 18);
              const dup = exist.some(t => (r.fitid && t.fitid === r.fitid) || (t.date === r.date && t.amount === abs && (t.desc || '').toLowerCase().slice(0, 18) === dk));
              return { date: r.date, amount: abs, desc: r.desc.replace(/\s+/g, ' ').slice(0, 80), income: r.income, fitid: r.fitid, cat: autoCategory(r.desc, r.income), dup, on: !dup };
            }).sort((a, b) => b.date.localeCompare(a.date));
            api.setBody(step2()); upd();
          } catch (err) { UI.toast('Não foi possível ler o arquivo', 'alert'); }
        }
      });
      const upd = () => { const n = st.rows.filter(r => r.on).length, b = $('#imGo', el); b.disabled = !n; b.textContent = n ? `Importar ${n} lançamento(s)` : 'Importar'; };
      const doImport = () => {
        const sel = st.rows.filter(r => r.on); if (!sel.length) return;
        const cats = new Set();
        for (const r of sel) {
          S.tx.push({ id: uid(), type: r.income ? 'receita' : 'despesa', amount: r.amount, desc: r.desc, category: r.cat, date: r.date, accountId: st.acc, method: st.mode === 'cartao' ? 'credito' : (r.income ? 'pix' : 'debito'), imported: true, fitid: r.fitid || undefined, created: new Date().toISOString(), notes: '' });
          if (!r.income) cats.add(r.cat + '|' + ym(r.date));
        }
        cats.forEach(x => { const [c, k] = x.split('|'); checkBudget(c, k); });
        addXP('importacao'); markActive(); api.close(); commit(`${sel.length} lançamentos importados`);
      };
    }
  });
};

/* ======================= segurança ======================= */
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
PFsys.cryptoOK = () => !!(window.crypto && crypto.subtle);
PFsys.hashPin = async (pin, saltB64) => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: unb64(saltB64), iterations: 120000, hash: 'SHA-256' }, key, 256);
  return b64(bits);
};
PFsys.setPinFlow = () => {
  if (!PFsys.cryptoOK()) { UI.toast('Bloqueio indisponível: abra o app por HTTPS', 'alert'); return; }
  const has = !!S.settings.pin;
  const body = `${has ? '<div class="field"><label>PIN atual</label><input class="inp num" id="p0" type="password" inputmode="numeric" maxlength="6" autocomplete="off"></div>' : ''}
    <div class="field"><label>Novo PIN (4 a 6 dígitos)</label><input class="inp num" id="p1" type="password" inputmode="numeric" maxlength="6" autocomplete="off"></div>
    <div class="field"><label>Confirme o novo PIN</label><input class="inp num" id="p2" type="password" inputmode="numeric" maxlength="6" autocomplete="off"></div>`;
  UI.sheet({
    title: has ? 'Alterar PIN' : 'Criar PIN', body, footer: '<button class="btn" id="pOk">Salvar PIN</button>',
    onMount(api) {
      $('#pOk', api.el).addEventListener('click', async () => {
        const p0 = has ? $('#p0', api.el).value : '', p1 = $('#p1', api.el).value, p2 = $('#p2', api.el).value;
        if (has && await PFsys.hashPin(p0, S.settings.salt) !== S.settings.pin) { UI.toast('PIN atual incorreto', 'alert'); return; }
        if (!/^\d{4,6}$/.test(p1)) { UI.toast('O PIN deve ter de 4 a 6 números', 'alert'); return; }
        if (p1 !== p2) { UI.toast('Os PINs não conferem', 'alert'); return; }
        const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
        S.settings.salt = salt; S.settings.pin = await PFsys.hashPin(p1, salt); S.settings.pinLen = p1.length;
        save(); api.close(); App.render(); UI.toast('PIN salvo');
      });
    }
  });
};
PFsys.removePin = async () => {
  if (!await UI.confirm('Remover bloqueio?', 'O app vai abrir sem pedir PIN ou biometria.', 'Remover')) return;
  const ok = await PFsys.lock(true); if (!ok) return;
  S.settings.pin = null; S.settings.salt = null; S.settings.bio = null; save(); App.render(); UI.toast('Bloqueio removido');
};
PFsys.bioAvailable = async () => { try { return !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch (e) { return false; } };
PFsys.toggleBio = async () => {
  if (S.settings.bio) { S.settings.bio = null; save(); App.render(); UI.toast('Biometria desativada'); return; }
  if (!await PFsys.bioAvailable()) { UI.toast('Biometria indisponível neste navegador/ambiente', 'alert'); return; }
  try {
    const cred = await navigator.credentials.create({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { name: 'Pink Finance' }, user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'pinkfinance', displayName: 'Pink Finance' }, pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' }, timeout: 60000, attestation: 'none' } });
    S.settings.bio = b64(cred.rawId); save(); App.render(); UI.toast('Biometria ativada');
  } catch (e) { UI.toast('Biometria não foi ativada', 'alert'); }
};
PFsys.bioUnlock = async () => {
  try { await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: 'public-key', id: unb64(S.settings.bio) }], userVerification: 'required', timeout: 60000 } }); return true; }
  catch (e) { return false; }
};
/* tela de bloqueio; confirmOnly=true só valida (para ações sensíveis) */
PFsys.lock = (confirmOnly) => new Promise(res => {
  if (!S.settings.pin) return res(true);
  if ($('.lock')) return res(false);
  const len = S.settings.pinLen || 4; let val = '';
  const el = document.createElement('div'); el.className = 'lock';
  el.innerHTML = `${LOGO_SVG}<b style="font-size:18px">${confirmOnly ? 'Confirme seu PIN' : 'Pink Finance'}</b><span class="small muted mt8">Digite seu PIN</span><div class="pins">${'<i></i>'.repeat(len)}</div>
    <div class="kp">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-k="${n}">${n}</button>`).join('')}<button class="n" data-k="bio">${S.settings.bio ? ic('finger', 'lg') : ''}</button><button data-k="0">0</button><button class="n" data-k="del">${ic('back', 'lg')}</button></div>
    ${confirmOnly ? '<button class="link mt16" data-k="cancel">Cancelar</button>' : ''}`;
  document.body.appendChild(el);
  const dots = () => $$('.pins i', el).forEach((d, i) => d.classList.toggle('f', i < val.length));
  const done = ok => { el.remove(); if (!confirmOnly) PFsys.lastUnlock = Date.now(); res(ok); };
  const tryBio = async () => { if (S.settings.bio && await PFsys.bioUnlock()) done(true); };
  el.addEventListener('click', async e => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    const k = b.dataset.k;
    if (k === 'cancel') return done(false);
    if (k === 'bio') return tryBio();
    if (k === 'del') { val = val.slice(0, -1); dots(); return; }
    if (val.length >= len) return;
    val += k; dots();
    if (val.length === len) {
      const h = await PFsys.hashPin(val, S.settings.salt);
      if (h === S.settings.pin) done(true);
      else { const p = $('.pins', el); p.classList.add('shake'); if (navigator.vibrate) navigator.vibrate(80); setTimeout(() => { p.classList.remove('shake'); val = ''; dots(); }, 420); }
    }
  });
  if (S.settings.bio && !confirmOnly) setTimeout(tryBio, 350);
});
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (!S) return;
  if (document.hidden) hiddenAt = Date.now();
  else {
    if (S.settings.pin && hiddenAt && Date.now() - hiddenAt >= (S.settings.lockAfter || 0) * 60000) PFsys.lock();
    if (processRecurring()) afterChange(true);
    PFsys.checkReminders(); App.render();
  }
});

/* ======================= notificações ======================= */
PFsys.notifPermission = () => !('Notification' in window) ? 'unsupported' : Notification.permission;
PFsys.toggleNotif = async () => {
  const n = S.settings.notif;
  if (n.enabled && PFsys.notifPermission() === 'granted') { n.enabled = false; save(); App.render(); UI.toast('Notificações desativadas'); return; }
  if (PFsys.notifPermission() === 'unsupported') { UI.toast('Este navegador não suporta notificações. Instale o app pelo Chrome.', 'alert'); return; }
  let p = Notification.permission;
  try { if (p === 'default') p = await Notification.requestPermission(); } catch (e) { p = 'denied'; }
  if (p !== 'granted') { UI.toast('Permissão negada. Libere em Configurações → Apps → Chrome → Notificações.', 'alert'); App.render(); return; }
  n.enabled = true; save(); await PFsys.registerPeriodic(); PFsys.syncReminders(); App.render(); UI.toast('Notificações ativadas');
};
PFsys.notify = async (title, body, tag) => {
  if (!S.settings.notif.enabled || PFsys.notifPermission() !== 'granted') return false;
  const opt = { body, tag: tag || 'pf', icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', vibrate: [60, 40, 60], data: { url: './' } };
  try { const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); if (reg) { await reg.showNotification(title, opt); return true; } new Notification(title, opt); return true; } catch (e) { return false; }
};
PFsys.testNotif = async () => {
  if (!S.settings.notif.enabled || PFsys.notifPermission() !== 'granted') { UI.toast('Ative as notificações primeiro', 'info'); return; }
  const ok = await PFsys.notify('Pink Finance', 'Notificações funcionando. Você será lembrado dos vencimentos.', 'pf-test');
  UI.toast(ok ? 'Notificação enviada' : 'Não foi possível enviar aqui', ok ? 'check' : 'alert');
};
/* lista de lembretes por data (usada no app e no service worker) */
PFsys.reminderItems = (horizon = 45) => {
  const td = today(), lim = addDays(td, horizon), out = [];
  const add = (key, date, title, body) => { if (date <= lim) out.push({ key, date, title, body }); };
  for (const b of S.bills) {
    if (b.paidAt) continue;
    for (const o of b.reminders || []) add(`bill:${b.id}:${b.due}:${o}`, addDays(b.due, -o), o ? `${b.name} vence em ${o} dia${o > 1 ? 's' : ''}` : `${b.name} vence hoje`, `${money(b.amount, { force: true })} · ${fmtDate(b.due)} · ${accName(b.accountId)}`);
    if (b.due < td) add(`bill:${b.id}:${b.due}:late`, addDays(b.due, 1), `${b.name} está atrasada`, `Venceu em ${fmtDate(b.due)} · ${money(b.amount, { force: true })}`);
  }
  for (const inv of openInvoices()) if (inv.remaining > 0) for (const o of [3, 0]) add(`inv:${inv.accountId}:${inv.key}:${o}`, addDays(inv.due, -o), `Fatura ${accName(inv.accountId)} ${o ? 'vence em 3 dias' : 'vence hoje'}`, `${money(inv.remaining, { force: true })} · ${fmtDate(inv.due)}`);
  for (const r of S.invReminders) add(`rem:${r.id}:${r.date}`, r.date, r.title, 'Lembrete de investimento');
  for (const i of S.investments) if (!i.closed && i.maturity && i.maturity >= td) for (const o of [7, 0]) add(`mat:${i.id}:${o}`, addDays(i.maturity, -o), `${i.name} ${o ? 'vence em 7 dias' : 'vence hoje'}`, `Valor atual ${money(i.current, { force: true })}`);
  for (const g of S.goals) if (!g.completedAt && g.aporteDay) for (const k of [ym(td), ymAdd(ym(td), 1)]) { const d = dateIn(k, g.aporteDay); if (d <= g.deadline) add(`apt:${g.id}:${d}`, d, `Aporte programado: ${g.name}`, g.monthly ? `Sugestão: ${money(g.monthly, { force: true })}` : 'Hora de guardar'); }
  return out.sort((a, b) => a.date.localeCompare(b.date));
};
PFsys.checkReminders = () => {
  if (!S) return;
  const td = today(), sent = S.settings.sent, items = PFsys.reminderItems(0);
  // agrupa por objeto (ex.: a mesma conta) e envia só o lembrete mais recente vencido de cada um
  const latest = {};
  for (const it of items) { if (it.date > td || sent[it.key]) continue; const base = it.key.split(':').slice(0, 3).join(':'); if (!latest[base] || it.date >= latest[base].date) latest[base] = it; }
  for (const it of items) if (it.date <= td && !sent[it.key]) { const base = it.key.split(':').slice(0, 3).join(':'); if (latest[base] !== it) sent[it.key] = td; }
  const send = Object.values(latest).filter(it => daysBetween(it.date, td) <= 3);
  for (const it of Object.values(latest)) sent[it.key] = td;
  for (const k of Object.keys(sent)) if (daysBetween(sent[k], td) > 90) delete sent[k];
  save();
  if (S.settings.notif.enabled) send.slice(0, 5).forEach((it, i) => setTimeout(() => PFsys.notify(it.title, it.body, it.key), i * 400));
  try { const n = S.bills.filter(b => !b.paidAt && b.due <= td).length; if (navigator.setAppBadge) n ? navigator.setAppBadge(n) : navigator.clearAppBadge(); } catch (e) { }
};
PFsys.syncReminders = async () => {
  if (!S || !('caches' in window)) return;
  try {
    const c = await caches.open('pf-meta');
    await c.put('pf-reminders.json', new Response(JSON.stringify({ enabled: !!S.settings.notif.enabled, hour: S.settings.notif.hour || 9, items: PFsys.reminderItems(45).filter(i => !S.settings.sent[i.key]) }), { headers: { 'Content-Type': 'application/json' } }));
  } catch (e) { }
};
PFsys.registerPeriodic = async () => {
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!reg.periodicSync) return;
    const st = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (st.state === 'granted') await reg.periodicSync.register('pf-reminders', { minInterval: 12 * 3600 * 1000 });
  } catch (e) { }
};

/* ======================= instalação ======================= */
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
PFsys.canInstall = () => !!installEvt;
PFsys.isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
PFsys.install = async () => { if (!installEvt) return; installEvt.prompt(); try { await installEvt.userChoice; } catch (e) { } installEvt = null; App.render(); };
