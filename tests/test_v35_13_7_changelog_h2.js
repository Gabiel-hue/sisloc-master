// v35.13.7 — (1) "seção CHANGELOG não encontrada no requisito" quando o requisito usa h2. CHANGELOG.
//            (2) marker invertido *REGRAS/CONDIÇÕES* não era reconhecido (req caía como "sem regras").
//            (3) Desfazer gravação removia entrada de changelog PRÉ-EXISTENTE (quando o Gravar não a inseriu).
//            (4) "maior RN" contava sub-numeração RN94774-1 → próxima virava RN94775 e era inserida no meio.
// Caso real: demanda #212039 → req #60592 (header "h2. CHANGELOG" em vez de "h1. CHANGELOG").
// Fix: helper findChM — h1. tem prioridade (comportamento antigo intacto); fallback h2.–h6. ancorado em início de linha.
// As funções são EXTRAÍDAS DO PRÓPRIO sisloc_master.js (não de espelho) — testa o código que roda no Chrome.
// Para rodar: cd ~/sm && node tests/test_v35_13_7_changelog_h2.js   (precisa de jsdom pro grupo D)
'use strict';
const fs = require('fs');
const path = require('path');
const BM = fs.readFileSync(path.join(__dirname, '..', 'sisloc_master.js'), 'utf8');
const FIX = fs.readFileSync(path.join(__dirname, 'fixtures_req', '60592.txt'), 'utf8');
const merge = require('./merge_logic');

let ok = 0, fail = 0;
function t(name, cond, info) { if (cond) { ok++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (info !== undefined ? ' — ' + JSON.stringify(info) : '')); } }

// Extrai uma função top-level do bookmarklet por balanceamento de chaves.
function extractFn(src, header) {
  const i = src.indexOf(header);
  if (i < 0) throw new Error('não achei ' + header);
  let j = src.indexOf('{', i), depth = 0, k = j;
  for (; k < src.length; k++) { if (src[k] === '{') depth++; else if (src[k] === '}') { depth--; if (depth === 0) break; } }
  return src.slice(i, k + 1);
}
const findChM = new Function(extractFn(BM, 'function findChM(') + '; return findChM;')();
const getAllRules = new Function(extractFn(BM, 'function findChM(') + extractFn(BM, 'function getAllRules(') + '; return getAllRules;')();

// Réplica exata do trecho do handler "Registrar Changelog" (card SEM-REGRA).
function registrar(ds, dId, title) {
  if (ds.includes('Demanda: #' + dId)) throw new Error('changelog já registrado');
  const chM2 = findChM(ds), realChI = chM2 ? chM2.index + chM2[0].length : -1;
  if (realChI === -1) throw new Error('seção CHANGELOG não encontrada no requisito');
  const chLog = '\n\nDemanda: #' + dId + '\n' + title + '\n';
  return ds.slice(0, realChI) + chLog + ds.slice(realChI);
}

console.log('\n=== A: estrutural no bookmarklet ===');
t('A1 helper findChM existe 1x', BM.split('function findChM(').length === 2);
t('A2 nenhum /h1\\.\\s*CHANGELOG/i fora do helper', BM.split('/h1\\.\\s*CHANGELOG/i').length === 2);
t('A3 5 call sites usam findChM(', (BM.match(/findChM\(/g) || []).length === 6);
t('A4 versão bumpada v35.13.7 (3x) e nenhuma v35.13.6', (BM.match(/v35\.13\.7/g) || []).length === 3 && !BM.includes('v35.13.6'));
t('A5 bookmarklet em 1 linha', BM.trim().split('\n').length === 1);
let syntaxOk = true; try { new Function(BM.replace(/^javascript:/, '')); } catch (e) { syntaxOk = false; }
t('A6 sintaxe válida', syntaxOk);

console.log('\n=== B: findChM — h1 continua prioridade (não-regressão) ===');
const h1 = 'RN1 - X\n\nh1. CHANGELOG\n\nDemanda: #1\nA\n';
t('B1 h1. CHANGELOG casa no mesmo índice do regex antigo', findChM(h1).index === h1.match(/h1\.\s*CHANGELOG/i).index);
t('B2 h1. CHANGELOG — mesmo match[0]', findChM(h1)[0] === h1.match(/h1\.\s*CHANGELOG/i)[0]);
t('B3 h1. changelog minúsculo', !!findChM('x\nh1. changelog\n'));
t('B4 h1.CHANGELOG sem espaço', !!findChM('x\nh1.CHANGELOG\n'));
const both = 'h3. RN1\n\nh2. CHANGELOG antigo\n\nh1. CHANGELOG\n\nDemanda: #9\n';
t('B5 h1 e h2 no mesmo doc → escolhe h1 (igual ao antigo)', findChM(both).index === both.indexOf('h1. CHANGELOG'));
const h1meio = 'h1. REGRAS\n\nh1. CHANGELOG\nxx';
t('B6 posição de inserção idêntica à versão antiga', (findChM(h1meio).index + findChM(h1meio)[0].length) === (h1meio.match(/h1\.\s*CHANGELOG/i).index + h1meio.match(/h1\.\s*CHANGELOG/i)[0].length));

console.log('\n=== C: fallback h2.–h6. ===');
t('C1 h2. CHANGELOG', !!findChM('a\n\nh2. CHANGELOG\n\nDemanda: #1'));
t('C2 h3. Changelog', !!findChM('a\n\nh3. Changelog\n'));
t('C3 h2. CHANGELOG no início do texto', !!findChM('h2. CHANGELOG\nDemanda: #1'));
t('C4 indentado com espaço/tab', !!findChM('a\n \th2. CHANGELOG\n'));
t('C5 CRLF', !!findChM('a\r\n\r\nh2. CHANGELOG\r\n\r\nDemanda: #1'));
const c6 = 'a\n\nh2. CHANGELOG\n\nDemanda: #1';
t('C6 realChI aponta logo após "CHANGELOG"', c6.slice(0, findChM(c6).index + findChM(c6)[0].length).endsWith('h2. CHANGELOG'));
t('C7 sem changelog → null (mantém erro claro)', findChM('h1. REGRAS\n\nh3. RN1\n') === null);
t('C8 h2 em prosa no meio da linha NÃO casa', findChM('ver o h2. CHANGELOG do outro req') === null);
t('C9 h2. CHANGELOGS (palavra maior) NÃO casa', findChM('a\nh2. CHANGELOGS\n') === null);
t('C10 h7. CHANGELOG NÃO casa (Textile só tem h1–h6)', findChM('a\nh7. CHANGELOG\n') === null);

console.log('\n=== D: caso real req #60592 / demanda #212039 ===');
const dId = '212039', title = 'RT0 - Criar campos de FUST e FUNTTEL na NFCom (OUT / 2026)';
let out = null, err = null;
try { out = registrar(FIX, dId, title); } catch (e) { err = e.message; }
t('D1 Registrar não lança erro', err === null, err);
t('D2 entrada nova logo abaixo de "h2. CHANGELOG"', out && out.includes('h2. CHANGELOG\n\nDemanda: #212039\n' + title + '\n\n\nDemanda: #204561'));
t('D3 entradas antigas preservadas', out && ['Demanda: #204561', 'Demanda #80636', 'Demanda #79269'].every(x => out.includes(x)));
t('D4 nada acima do CHANGELOG mudou', out && out.slice(0, FIX.indexOf('h2. CHANGELOG')) === FIX.slice(0, FIX.indexOf('h2. CHANGELOG')));
t('D5 só o chLog foi adicionado (diff exato)', out && out.length === FIX.length + ('\n\nDemanda: #' + dId + '\n' + title + '\n').length);
// rollback do Desfazer (indexOf + slice do chLog)
const chLog = '\n\nDemanda: #' + dId + '\n' + title + '\n';
const back = out ? out.slice(0, out.indexOf(chLog)) + out.slice(out.indexOf(chLog) + chLog.length) : null;
t('D6 Desfazer volta byte-a-byte ao original', back === FIX);
let err2 = null; try { registrar(out, dId, title); } catch (e) { err2 = e.message; }
t('D7 2º clique → "já registrado" (idempotência)', /já registrado/.test(err2 || ''));
let errOld = null; try { const m = FIX.match(/h1\.\s*CHANGELOG/i); if (!m) throw new Error('seção CHANGELOG não encontrada no requisito'); } catch (e) { errOld = e.message; }
t('D8 confirma o bug: regex antigo falhava nessa fixture', /não encontrada/.test(errOld || ''));

console.log('\n=== E: getAllRules (dropdown "Modelo") não lê o CHANGELOG h2 ===');
const rules = getAllRules(FIX);
t('E1 4 regras RN1..RN4', rules.map(r => r.rn).join(',') === 'RN1,RN2,RN3,RN4', rules.map(r => r.rn));
t('E2 espelho merge_logic.getAllRules igual ao bookmarklet', JSON.stringify(merge.getAllRules(FIX).map(r => r.rn)) === JSON.stringify(rules.map(r => r.rn)));
t('E3 cropBeforeChangelog corta no h2. CHANGELOG', !merge.cropBeforeChangelog(FIX).includes('Demanda: #204561'));
t('E4 cropBeforeChangelog com h1 igual ao antigo', merge.cropBeforeChangelog(h1) === h1.slice(0, h1.match(/h1\.\s*CHANGELOG/i).index));

console.log('\n=== G: marker invertido REGRAS/CONDIÇÕES (#212039 → #60592/#31468) ===');
const EL = require('./extract_logic');
// regexes extraídas DO BOOKMARKLET (literal), pra garantir que o que roda no Chrome é o testado
const rmSrc = BM.match(/\.match\((\/\(\?<=\^\|\\n\)\\s\*\(\?:\\\*\\s\*\)\?\(\?:CONDI[^]*?\$\)\/i)\);if\(!rulesMatch\)/);
t('G0 rulesMatch localizado no bookmarklet', !!rmSrc);
const RULES_RE = rmSrc ? eval(rmSrc[1]) : /$^/;
const rgSrc = BM.match(/regrasM=secao\.match\((\/[^]*?\/i)\);if\(regrasM\)/);
t('G0b regrasM localizado no bookmarklet', !!rgSrc);
const REGRAS_RE = rgSrc ? eval(rgSrc[1]) : /$^/;
const elSrc = fs.readFileSync(path.join(__dirname, 'extract_logic.js'), 'utf8');
t('G1 espelho extract_logic tem o MESMO rulesMatch do bookmarklet', rmSrc && elSrc.includes(rmSrc[1]));
t('G2 3 regexes do bookmarklet ganharam a alternativa invertida',
  (BM.match(/REGRAS\\s\*\\\/\\s\*CONDI\[CÇ\]\[OÕ\]ES/g) || []).length === 2 &&
  (BM.match(/REGRAS\\\\s\*\\\\\/\\\\s\*CONDI\[CÇ\]\[OÕ\]ES/g) || []).length === 1);
const sec = (marker, body) => 'h3. ##1\n\n*O QUE DEVE SER FEITO*\n1) x\n\n*CONVERSOR*\nNA\n\n' + marker + '\n' + (body || 'RNX1 – Título A\nConteúdo A.') + '\n\n---\n';
const pos = ['*REGRAS/CONDIÇÕES*', '*REGRAS/CONDIÇÕES:*', 'REGRAS/CONDIÇÕES:', '*REGRAS / CONDIÇÕES*', '*Regras/Condições*', '*REGRAS/CONDICOES*', '  *REGRAS/CONDIÇÕES*'];
// limite PRÉ-EXISTENTE: 'h3.' antes do marker nunca foi suportado (nem CONDIÇÕES/REGRAS) — invertido segue a mesma regra
t('G3.h paridade: "h3. REGRAS/CONDIÇÕES" e "h3. CONDIÇÕES/REGRAS" têm o mesmo resultado', EL.extractRules(sec('h3. REGRAS/CONDIÇÕES')).length === EL.extractRules(sec('h3. CONDIÇÕES/REGRAS')).length);
pos.forEach((m, i) => { const r = EL.extractRules(sec(m)); t('G3.' + (i + 1) + ' extrai regra com marker ' + JSON.stringify(m), r.length === 1 && /^RNX1 - Título A$/.test(r[0].title), r.map(x => x.title)); });
pos.forEach((m, i) => t('G4.' + (i + 1) + ' rulesMatch DO BOOKMARKLET casa ' + JSON.stringify(m), RULES_RE.test(sec(m))));
pos.forEach((m, i) => t('G5.' + (i + 1) + ' regrasM (Atualizar Links) DO BOOKMARKLET casa ' + JSON.stringify(m), REGRAS_RE.test(sec(m))));
// não-regressão dos markers antigos — mesmo resultado que a versão anterior do espelho
const OLD_RULES_RE = /(?<=^|\n)\s*(?:\*\s*)?(?:CONDI[CÇ][OÕ]ES\s*\/\s*REGRAS|REGRAS)\s*\*?\s*:?\s*\*?\s+([\s\S]*?)(?=\n\s*\*?(?:REQUISITO|Requisito|h\d+\.\s*Requisito)|\n\s*h3\.\s*#{1,2}\s*\d+|\n\s*---|$)/i;
['*CONDIÇÕES/REGRAS:*', '*CONDIÇÕES / REGRAS*', 'CONDIÇÕES/REGRAS:', '*REGRAS*', '*Regras:*', 'REGRAS:', '*REGRAS:* '].forEach((m, i) => {
  const a = OLD_RULES_RE.exec(sec(m)), b = RULES_RE.exec(sec(m));
  t('G6.' + (i + 1) + ' marker antigo ' + JSON.stringify(m) + ' → captura idêntica à v35.13.6', a && b && a.index === b.index && a[1] === b[1]);
});
// travas: prosa / outras combinações não viram marker
const neg = ['Validar as regras/condições do cliente:', 'conforme REGRAS/CONDIÇÕES abaixo', '*REGRAS/CONDIÇÃO*'];
neg.forEach((m, i) => t('G7.' + (i + 1) + ' NÃO casa marker em ' + JSON.stringify(m), EL.extractRules('h3. ##1\n\n' + m + '\nRNX1 – Título A\nConteúdo.\n\n---\n').length === 0));
// todas as fixtures legadas: nenhuma tinha o formato invertido → saída idêntica (o run_tests confirma via snapshot)
const fxDir = path.join(__dirname, 'fixtures');
const legacy = fs.readdirSync(fxDir).filter(f => f.endsWith('.txt') && f !== '212039.txt');
t('G8 nenhuma fixture legada usa REGRAS/CONDIÇÕES (mudança não afeta snapshots antigos)', legacy.every(f => !/REGRAS\s*\/\s*CONDI/i.test(fs.readFileSync(path.join(fxDir, f), 'utf8'))), legacy.length);
// ponta-a-ponta: demanda real #212039
const dem = fs.readFileSync(path.join(fxDir, '212039.txt'), 'utf8');
const an = EL.analyze(dem), byId = {}; an.forEach(q => byId[q.id] = q.rules);
t('G9 #212039: 5 requisitos', an.length === 5, an.map(q => q.id));
t('G10 #60592 → 1 regra "RNX1 - Abas FUST e FUNTTEL"', JSON.stringify(byId['60592']) === '["RNX1 - Abas FUST e FUNTTEL"]', byId['60592']);
t('G11 #31468 → 1 regra "RNX1 - Cálculo do FUST e FUNTTEL"', JSON.stringify(byId['31468']) === '["RNX1 - Cálculo do FUST e FUNTTEL"]', byId['31468']);
t('G12 #31059 (REGRAS/CONDIÇÕES = NA) → 0 regras', byId['31059'] && byId['31059'].length === 0);
t('G13 #32745 e #79 inalterados', JSON.stringify(byId['32745']) === '["RN84 - Exibição dos campos FUST e FUNTELL"]' && JSON.stringify(byId['79']) === '["RN96 - Abas FUST e FUNTTEL"]');
const s31468 = EL.splitSections ? null : null;
const r31468 = EL.extractRules(dem.slice(dem.indexOf('h3. ##31468'), dem.indexOf('h3. ##31059')));
t('G14 conteúdo do #31468 traz as fórmulas completas', r31468.length === 1 && /FUNTTEL = BC x %definido/.test(r31468[0].content) && /BC = Valor da operação/.test(r31468[0].content), r31468[0] && r31468[0].content);
t('G15 conteúdo do #31468 NÃO vaza pro #31059', r31468.length === 1 && !/Estruturar o XML/.test(r31468[0].content));

console.log('\n=== F: getEd (extraído do bookmarklet) com fetch mockado ===');
let JSDOM = null; try { JSDOM = require('jsdom').JSDOM; } catch (e) {}
if (!JSDOM) { console.log('  (jsdom ausente — grupo F pulado)'); }
else {
  const run = async function () {
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const mkHtml = ds => '<html><head><meta name="csrf-token" content="TK"></head><body><input id="issue_subject" value="Abrir Dados NFS-E NOTA FISCAL"><textarea id="issue_description">' + esc(ds) + '</textarea></body></html>';
    const dom = new JSDOM('');
    const env = { DOMParser: dom.window.DOMParser, bUrl: 'http://net1/redmine', fetch: null };
    const src = extractFn(BM, 'function findChM(') + 'async ' + extractFn(BM, 'function getEd(') + '; return getEd;';
    const mk = ds => new Function('DOMParser', 'bUrl', 'fetch', src)(env.DOMParser, env.bUrl, async () => ({ ok: true, text: async () => mkHtml(ds) }));
    const d = await mk(FIX)(60592);
    t('F1 getEd lê a descrição', d && d.ds === FIX);
    t('F2 getEd.chI != -1 com h2. CHANGELOG', d && d.chI === FIX.indexOf('h2. CHANGELOG') - 1 + '\nh2. CHANGELOG'.length);
    t('F3 getEd.n = 5 (próxima RN)', d && d.n === 5);
    t('F4 getEd.ip antes do CHANGELOG', d && d.ip < FIX.indexOf('h2. CHANGELOG'));
    const d1 = await mk(h1)(1);
    t('F5 getEd com h1 → chI igual ao antigo', d1 && d1.chI === h1.match(/h1\.\s*CHANGELOG/i).index + 'h1. CHANGELOG'.length);

  // ====== H: Desfazer gravação não remove changelog pré-existente ======
  console.log('\n=== H: Desfazer gravação — só remove o changelog que o próprio Gravar inseriu ===');
  t('H1 compute devolve chLog vazio quando não inseriu', BM.includes('chLog:chIns?chLogLocal:""'));
  t('H2 chIns é let separado (fora de cadeia const — lição v35.13)', /\}let chIns=!1;if\(-1!==realChI&&!nDs\.includes\("Demanda: #"\+dId\)\)/.test(BM));
  t('H3 chIns=!0 só no ramo que insere', /nDs=nDs\.slice\(0,chINovo\)\+chLogLocal\+nDs\.slice\(chINovo\),chIns=!0\}/.test(BM));
  // réplica do trecho do rollback (idxChLog) do bookmarklet
  const rb = (ds, cap) => { const i = ds.indexOf(cap); return -1 !== i ? ds.slice(0, i) + ds.slice(i + cap.length) : ds; };
  const preDs = 'h3. RN1\n\nx\n\nh1. CHANGELOG\n\nDemanda: #212039\nT\n\n\nDemanda: #1\nY\n';
  t('H4 rollback com chLog "" mantém changelog pré-existente', rb(preDs, '') === preDs);
  const orig5 = 'a\nh1. CHANGELOG\n\nDemanda: #1\nY', ch5 = '\n\nDemanda: #9\nZ\n', ins5 = orig5.replace('h1. CHANGELOG', 'h1. CHANGELOG' + ch5);
  t('H5 rollback com chLog real remove só a entrada inserida (volta ao original)', rb(ins5, ch5) === orig5);
  t('H6 rollback do Registrar Changelog (card sem-regra) intocado', BM.includes('const idx=fresh.ds.indexOf(capturedChLog);if(-1===idx)throw new Error("entrada do changelog não encontrada (provável edição manual)")'));

  // ====== I: maior RN ignora sub-numeração RN<n>-<d> ======
  console.log('\n=== I: cálculo da próxima RN ignora RN94774-1 / RN94774-2 ===');
  t('I1 os 3 cálculos de "maior RN" usam (?!-\\d)', (BM.match(/RN\(\\d\+\)\\b\(\?!-\\d\)\/g/g) || []).length === 3);
  t('I2 nenhum cálculo de maior RN sem a trava', !/RN\(\\d\+\)\\b\/g/.test(BM));
  const NEW_RE = /(?:^|\n)\s*(?:h3\.\s*)?RN(\d+)\b(?!-\d)/g, OLD_RE = /(?:^|\n)\s*(?:h3\.\s*)?RN(\d+)\b/g;
  const maxRN = (ds, re) => { let m, mx = 0; re.lastIndex = 0; const a = ds.split(/h\d\.\s*CHANGELOG/i)[0]; while ((m = re.exec(a))) mx = Math.max(mx, +m[1]); return mx; };
  const R31468 = fs.readFileSync(path.join(__dirname, 'fixtures_req', '31468.txt'), 'utf8');
  t('I3 #31468 real: antes 94774, agora 101', maxRN(R31468, OLD_RE) === 94774 && maxRN(R31468, NEW_RE) === 101, [maxRN(R31468, OLD_RE), maxRN(R31468, NEW_RE)]);
  ['60592', '79', '31059', '32745'].forEach((id, i) => { const ds = fs.readFileSync(path.join(__dirname, 'fixtures_req', id + '.txt'), 'utf8');
    t('I4.' + (i + 1) + ' #' + id + ' real: maior RN idêntica à v35.13.6 (' + maxRN(ds, OLD_RE) + ')', maxRN(ds, OLD_RE) === maxRN(ds, NEW_RE)); });
  [['h3. RN5 - Título', 5], ['h3. RN5-Título', 5], ['h3. RN5 -1 algo', 5], ['h3. RN2.1', 2], ['RN7', 7], ['h3. RN12-3', 0], ['h3. RN12-3\n\nh3. RN4', 4]].forEach(([d, e], i) =>
    t('I5.' + (i + 1) + ' ' + JSON.stringify(d) + ' → maior RN ' + e, maxRN('\n' + d + '\n', NEW_RE) === e, maxRN('\n' + d + '\n', NEW_RE)));
  const geSrc = extractFn(BM, 'function findChM(') + 'async ' + extractFn(BM, 'function getEd(') + '; return getEd;';
  const d31468 = await new Function('DOMParser', 'bUrl', 'fetch', geSrc)(dom.window.DOMParser, 'http://net1/redmine', async () => ({ ok: true, text: async () => '<html><head><meta name="csrf-token" content="TK"></head><body><input id="issue_subject" value="x"><textarea id="issue_description">' + R31468.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</textarea></body></html>' }))(31468);
  const ip = d31468.ip, txt = d31468.ds;
  t('I6 getEd #31468: n = 102', d31468.n === 102, d31468.n);
  t('I7 getEd #31468: ponto de inserção DEPOIS da RN101 e ANTES do CHANGELOG', ip > txt.indexOf('h3. RN101') && ip < txt.indexOf('h1. CHANGELOG'), [ip, txt.indexOf('h3. RN101'), txt.indexOf('h1. CHANGELOG')]);
  t('I8 getEd #31468: ponto de inserção NÃO fica entre RN94774-1 e RN94774-2', !(ip > txt.indexOf('h3. RN94774-1') && ip < txt.indexOf('h3. RN94774-2')));
  };
  run().then(fim).catch(e => { fail++; console.log('  ✗ F crash: ' + e.stack); fim(); });
}
function fim() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TOTAL: ' + (ok + fail) + '  |  ✓ ' + ok + '  |  ✗ ' + fail);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exitCode = fail ? 1 : 0;
}
if (!JSDOM) fim();
