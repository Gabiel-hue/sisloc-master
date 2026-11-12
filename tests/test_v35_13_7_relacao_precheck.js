// v35.13.7 — botão "🔗 Adicionar relação" verifica em SEGUNDO PLANO se a relação já existe.
// Roda o sisloc_master.js INTEIRO (jsdom) na demanda #212039 com fetch mockado. Requisitos no estado real de 12/11/2026
// (#32745/#79 com regra já gravada → card COM-REGRA "chJaTem"; #31059 → card SEM-REGRA "Já registrado").
// Rodar: node tests/test_v35_13_7_relacao_precheck.js   (precisa de jsdom)
'use strict';
const fs = require('fs'), path = require('path'); const { JSDOM } = require('jsdom');
const BM = fs.readFileSync(path.join(__dirname, '..', 'sisloc_master.js'), 'utf8').trim();
const DEM = fs.readFileSync(path.join(__dirname, 'fixtures', '212039.txt'), 'utf8');
const ids = ['32745', '79', '60592', '31468', '31059'];
const REQ = {}; ids.forEach(id => REQ[id] = fs.readFileSync(path.join(__dirname, 'fixtures_req', id + '.txt'), 'utf8'));
let ok = 0, fail = 0; const t = (n, c, i) => { if (c) { ok++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (i !== undefined ? ' — ' + JSON.stringify(i) : '')); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function run(opts) { // opts: {rels:{id:true}, showStatus:200|500, showDelay:ms}
  const S = Object.assign({ '212039': DEM }, REQ), REL = {}, errs = [], calls = [];
  Object.keys(opts.rels || {}).forEach(id => REL[id] = [{ relId: '7' + id, to: '212039' }]);
  const dom = new JSDOM('<html><head><meta name="csrf-token" content="TK"></head><body><div class="subject"><h3>RT0 - Criar campos de FUST e FUNTTEL na NFCom (OUT / 2026)</h3></div></body></html>', { url: 'http://net1/redmine/issues/212039', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  Object.defineProperty(w.HTMLElement.prototype, 'innerText', { get() { return this.textContent; }, set(v) { this.textContent = v; }, configurable: true });
  w.alert = () => {}; w.navigator.clipboard = { writeText: async () => {} };
  const okR = b => ({ ok: true, status: 200, redirected: true, text: async () => b || '<html><body>ok</body></html>' });
  w.fetch = async (url, o) => { url = String(url); const meth = (o && o.method || 'GET').toUpperCase(); calls.push(meth + ' ' + url.replace(/^.*\/redmine/, ''));
    let m;
    if ((m = url.match(/\/issues\/(\d+)\/relations$/)) && meth === 'POST') { const f = {}; o.body.forEach((v, k) => f[k] = v); (REL[m[1]] = REL[m[1]] || []).push({ relId: '8' + m[1], to: f['relation[issue_to_id]'] }); return okR(); }
    if ((m = url.match(/\/relations\/(\d+)$/)) && meth === 'POST') { Object.keys(REL).forEach(k => REL[k] = REL[k].filter(r => r.relId !== m[1])); return okR(); }
    m = url.match(/\/issues\/(\d+)(\/edit)?$/); if (!m || S[m[1]] == null) return { ok: false, status: 404, text: async () => '' };
    if (meth === 'POST') { const f = {}; o.body.forEach((v, k) => f[k] = v); if (f['issue[description]'] != null) S[m[1]] = f['issue[description]']; return okR(); }
    if (m[2]) return okR('<html><head><meta name="csrf-token" content="TK"></head><body><input id="issue_subject" value="Req ' + m[1] + '"><textarea id="issue_description">' + esc(S[m[1]]) + '</textarea></body></html>');
    if (opts.showDelay) await sleep(opts.showDelay);
    if (opts.showStatus === 500) return { ok: false, status: 500, text: async () => 'erro' };
    return okR('<html><head><meta name="csrf-token" content="TK"></head><body><table>' + (REL[m[1]] || []).map(r => '<tr id="relation-' + r.relId + '"><td><input name="ids[]" value="' + r.to + '"></td></tr>').join('') + '</table></body></html>'); };
  w.addEventListener('error', e => errs.push(e.message));
  const onRej = e => errs.push('unhandledRejection: ' + (e && e.message || e)); process.on('unhandledRejection', onRej);
  w.eval('(function(){' + BM.replace(/^javascript:\(function\(\)\{/, '').replace(/\}\)\(\);?$/, '') + '})()');
  const doc = w.document;
  const card = id => { const c = [...doc.querySelectorAll('div')].filter(d => (d.textContent.match(/Requisito #\d+/g) || []).length === 1 && new RegExp('Requisito #' + id + '(?!\\d)').test(d.textContent) && d.querySelector('button')); c.sort((a, b) => b.textContent.length - a.textContent.length); return c[0]; };
  const relBtn = id => { const c = card(id); return c && (c.querySelector('.btn-add-rel-cr') || c.querySelector('.btn-add-rel')); };
  return { w, doc, card, relBtn, errs, calls, REL, S, done: () => process.off('unhandledRejection', onRej) };
}
const st = b => b ? { txt: b.textContent.trim(), dis: b.disabled } : null;

(async () => {
  console.log('\n=== A: estrutural ===');
  t('A1 helper preCheckRel existe 1x', BM.split('function preCheckRel(').length === 2);
  t('A2 chamado no botão do card COM-REGRA', BM.includes('btnAddRelCr.onclick=addRelExtraHandler,preCheckRel(btnAddRelCr,capturedRId)}'));
  t('A3 chamado no botão do card SEM-REGRA "Já registrado"', BM.includes('void(btnAddRel.onclick=addRelHandler,preCheckRel(btnAddRel,r.id))'));
  t('A4 verificação NÃO é aguardada (sem await → não atrasa a caixinha)', !/await preCheckRel/.test(BM));

  console.log('\n=== B: relação JÁ EXISTE → botão cinza e não clicável ===');
  let R = await run({ rels: { '32745': 1, '79': 1, '31468': 1, '31059': 1 } }); await sleep(3500);
  ['32745', '79', '31468', '31059'].forEach(id => { const s = st(R.relBtn(id)); t('B #' + id + ' → "✓ Relação já existe" desabilitado', s && s.txt === '✓ Relação já existe' && s.dis === true, s); });
  const bAntes = JSON.stringify(R.REL); R.relBtn('32745').click(); await sleep(500);
  t('B5 clicar no botão desabilitado não faz nada (nenhuma relação criada/removida)', JSON.stringify(R.REL) === bAntes && !R.calls.some(c => /POST .*relations/.test(c)));
  t('B6 tooltip explica por que está desabilitado', /já existe neste requisito/.test(R.relBtn('79').title));
  t('B7 sem erros JS', !R.errs.length, R.errs); R.done();

  console.log('\n=== C: relação NÃO existe → botão azul clicável (igual hoje) ===');
  R = await run({ rels: {} }); await sleep(3500);
  ['32745', '79', '31468', '31059'].forEach(id => { const s = st(R.relBtn(id)); t('C #' + id + ' → "🔗 Adicionar relação" habilitado', s && s.txt === '🔗 Adicionar relação' && s.dis === false, s); });
  R.relBtn('79').click(); await sleep(1500);
  t('C5 clicar cria a relação (fluxo antigo intacto)', (R.REL['79'] || []).some(r => r.to === '212039'));
  t('C6 botão vira "↩ Desfazer relação"', /Desfazer relação/.test(R.relBtn('79').textContent), st(R.relBtn('79')));
  R.relBtn('79').click(); await sleep(1500);
  t('C7 desfazer remove a relação e volta a "🔗 Adicionar relação"', !(R.REL['79'] || []).length && st(R.relBtn('79')).txt === '🔗 Adicionar relação', [R.REL['79'], st(R.relBtn('79'))]);
  t('C8 sem erros JS', !R.errs.length, R.errs); R.done();

  console.log('\n=== D: verificação FALHA (HTTP 500) → volta ao comportamento de hoje (azul clicável) ===');
  R = await run({ rels: {}, showStatus: 500 }); await sleep(3500);
  ['32745', '31059'].forEach(id => { const s = st(R.relBtn(id)); t('D #' + id + ' → "🔗 Adicionar relação" habilitado', s && s.txt === '🔗 Adicionar relação' && s.dis === false, s); });
  t('D3 sem erros JS', !R.errs.length, R.errs); R.done();

  console.log('\n=== E: verificação LENTA (3s) → caixinha não espera ===');
  R = await run({ rels: { '32745': 1 }, showDelay: 3000 }); await sleep(1800);
  const e1 = st(R.relBtn('32745')), g = R.card('60592') && R.card('60592').querySelector('.btn-gravar');
  t('E1 durante a verificação: "⏳ Verificando relação..." desabilitado', e1 && /Verificando relação/.test(e1.txt) && e1.dis === true, e1);
  t('E2 resto da caixinha já está pronto e usável (Gravar do #60592 habilitado)', g && !g.disabled && /Gravar Regras/.test(g.textContent), g && st(g));
  await sleep(2500);
  t('E3 depois da verificação: "✓ Relação já existe"', st(R.relBtn('32745')).txt === '✓ Relação já existe', st(R.relBtn('32745')));
  t('E4 sem erros JS', !R.errs.length, R.errs); R.done();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nTOTAL: ' + (ok + fail) + '  |  ✓ ' + ok + '  |  ✗ ' + fail + '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(fail ? 1 : 0);
})();
