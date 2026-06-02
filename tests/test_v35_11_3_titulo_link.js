// tests/test_v35_11_3_titulo_link.js
//
// Suite de testes para v35.11.3 — fix do título com lixo trailing em regras link-only.
//
// Bug original (#196911): regras escritas como '"RN10":URL' (sem título adicional após
// o URL) eram parseadas como 'RN10 - 0' (último char do URL roubado pelo grupo (.+?)$
// do linkPostMatch). Ao gravar, viravam 'h3. RN27 - 0', 'h3. RN5 - 1', etc.
//
// Bug secundário: regras 'RN10' puras (sem aspas, sem link) ainda viravam 'RN10 -'
// (hífen trailing) por causa do replace '$1 - ' incondicional na normalização final.
//
// Fixes na v35.11.3 (extractRules):
//   1. linkPostMatch — [^\s]+\s* trocado por \S+\s+ (whitespace obrigatório após URL)
//   2. Normalização final — '$1 - ' constante trocado por callback condicional
//      que só adiciona ' - ' se há texto restante após o RN
//
// Grupos:
//   A — Padrão A: '"RN<N>":URL' (link-only, sem título adicional) → vira 'RN<N>' puro
//   B — Padrão B: '"RN<N> - Título":URL' (título DENTRO das aspas) → preservado
//   C — Padrão C: '"RN<N>":URL - Título' (título DEPOIS do URL) → preservado [caso #175544]
//   D — Edge cases: variantes de espaçamento, separadores, aspas curvas, prefixo (Criar)
//   E — Ponta-a-ponta com fixtures reais (196911, 148935)
//   F — Não-regressão dos formatos não-link

'use strict';

const fs = require('fs');
const path = require('path');
const { extractRules, analyze } = require('./extract_logic');

let pass = 0, fail = 0;
const failures = [];

function assert(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
    console.log('  ✓', label);
  } else {
    fail++;
    failures.push({ label, expected, actual });
    console.log('  ✗', label);
    console.log('      esperado:', e);
    console.log('      obtido:  ', a);
  }
}

function runRules(sec) {
  return extractRules(sec).map(r => r.title);
}

// Helper: envolver uma regra num bloco "*REGRAS:*" pra extractRules processar
function wrapAsSection(ruleBlock) {
  return '*REGRAS:*\n' + ruleBlock;
}

console.log('\n━━━━ v35.11.3 — Título com link sem título adicional ━━━━\n');

// ========== GRUPO A — Padrão A (bug corrigido) ==========
console.log('GRUPO A — Padrão A: "RN<N>":URL (link-only) vira "RN<N>" puro\n');

assert(runRules(wrapAsSection('"RN10":http://net1/redmine/issues/49#RN10')),
  ['RN10'], 'A.1 RN10 com âncora #RN10 no fim do URL');

assert(runRules(wrapAsSection('"RN1":http://net1/redmine/issues/31446#RN1')),
  ['RN1'], 'A.2 RN1 com âncora #RN1');

assert(runRules(wrapAsSection('"RN2":http://net1/redmine/issues/31446#RN2')),
  ['RN2'], 'A.3 RN2 com âncora #RN2');

assert(runRules(wrapAsSection('"RN14":http://net1/redmine/issues/47#RN14-Liberacao-de-saida-com-data-de-cobranca-diferente')),
  ['RN14'], 'A.4 RN14 com âncora longa terminando em "diferente" (era "RN14 - e")');

assert(runRules(wrapAsSection('"RN99":http://net1/redmine/issues/50#RN99')),
  ['RN99'], 'A.5 RN99 (era "RN99 - 9")');

assert(runRules(wrapAsSection('"RN100":http://net1/redmine/issues/50#RN100')),
  ['RN100'], 'A.6 RN100 (era "RN100 - 0")');

assert(runRules(wrapAsSection('"RN54":http://net1/redmine/issues/31225#RN54')),
  ['RN54'], 'A.7 RN54 (era "RN54 - 4")');

// Múltiplas regras link-only seguidas (cenário real da #196911 #31446)
assert(runRules(wrapAsSection(
  '"RN1":http://net1/redmine/issues/31446#RN1\nConteúdo da RN1.\n\n"RN2":http://net1/redmine/issues/31446#RN2\nConteúdo da RN2.'
)), ['RN1', 'RN2'], 'A.8 Duas regras link-only seguidas com conteúdo');

// ========== GRUPO B — Padrão B (preservado) ==========
console.log('\nGRUPO B — Padrão B: "RN<N> - Título":URL (título DENTRO das aspas) preservado\n');

assert(runRules(wrapAsSection('"RN39 - Atividade Rotas":http://net1/redmine/issues/48#RN39')),
  ['RN39 - Atividade Rotas'], 'B.1 Título dentro das aspas, link com âncora');

assert(runRules(wrapAsSection('"RN2 - Atividade no Rotas":http://net1/redmine/issues/151937#RN2')),
  ['RN2 - Atividade no Rotas'], 'B.2 Título dentro das aspas com espaço/preposição');

assert(runRules(wrapAsSection('"RN5 - Arquivos da Remessa/Devolução com descrição":http://net1/redmine/issues/81788#RN5-Arquivos')),
  ['RN5 - Arquivos da Remessa/Devolução com descrição'], 'B.3 Título com /, acento e espaços (208937)');

assert(runRules(wrapAsSection('"RN12 - Atividade no Rotas":http://net1/redmine/issues/31482#RN12')),
  ['RN12 - Atividade no Rotas'], 'B.4 RN2 dígitos + título');

// ========== GRUPO C — Padrão C (preservado — caso #175544) ==========
console.log('\nGRUPO C — Padrão C: "RN<N>":URL - Título (título DEPOIS do URL) preservado\n');

assert(runRules(wrapAsSection('(Criar) "RN1":http://net1/redmine/issues/31323/RN1 - Compra de equipamento sublocado')),
  ['RN1 - Compra de equipamento sublocado'], 'C.1 Padrão C com prefixo (Criar) — caso #175544');

assert(runRules(wrapAsSection('"RN1":http://net1/redmine/issues/31323/RN1 - Compra de equipamento sublocado')),
  ['RN1 - Compra de equipamento sublocado'], 'C.2 Padrão C sem prefixo');

assert(runRules(wrapAsSection('"RN5":http://example.com/page – Em-dash separador')),
  ['RN5 - Em-dash separador'], 'C.3 Padrão C com em-dash');

assert(runRules(wrapAsSection('"RN3":http://example.com/page : Separador dois-pontos')),
  ['RN3 - Separador dois-pontos'], 'C.4 Padrão C com : separador');

// ========== GRUPO D — Edge cases ==========
console.log('\nGRUPO D — Edge cases (aspas curvas, prefixo, múltiplos espaços)\n');

assert(runRules(wrapAsSection('\u201CRN7\u201D:http://example.com/page#RN7')),
  ['RN7'], 'D.1 Aspas curvas “” no Padrão A');

assert(runRules(wrapAsSection('\u201CRN8 - Título com curvas\u201D:http://example.com/page#RN8')),
  ['RN8 - Título com curvas'], 'D.2 Aspas curvas no Padrão B');

assert(runRules(wrapAsSection('(Alterar) "RN15":http://example.com/page#RN15')),
  ['RN15'], 'D.3 Prefixo (Alterar) + Padrão A vira só "RN15"');

assert(runRules(wrapAsSection('(Validar) "RN20 - Verificar X":http://example.com/page')),
  ['RN20 - Verificar X'], 'D.4 Prefixo (Validar) + Padrão B preservado');

// ========== GRUPO E — Ponta-a-ponta com fixtures reais ==========
console.log('\nGRUPO E — Ponta-a-ponta com fixtures reais\n');

const fixDir = path.join(__dirname, 'fixtures');

// #196911 — todos os Padrão A da fixture real
const fix196911 = fs.readFileSync(path.join(fixDir, '196911.txt'), 'utf8');
const r196911 = analyze(fix196911);
const map196911 = {};
r196911.forEach(req => { map196911[req.id] = req.rules; });

assert(map196911['49'], ['RN10'], 'E.1 #196911 req #49: RN10 (era "RN10 - 0")');
assert(map196911['31446'], ['RN1', 'RN2'], 'E.2 #196911 req #31446: RN1, RN2 (era "RN1 - 1", "RN2 - 2")');
assert(map196911['47'], ['RN14'], 'E.3 #196911 req #47: RN14 (era "RN14 - e")');
assert(map196911['31454'], ['RN1', 'RN2'], 'E.4 #196911 req #31454: RN1, RN2 (era "RN1 - 1", "RN2 - 2")');
assert(r196911.length, 8, 'E.5 #196911 total: 8 reqs (não 10 — deduplicação v35.11.2)');

// #148935 — mix de Padrão A e Padrão B
const fix148935 = fs.readFileSync(path.join(fixDir, '148935.txt'), 'utf8');
const r148935 = analyze(fix148935);
const map148935 = {};
r148935.forEach(req => { map148935[req.id] = req.rules; });

assert(map148935['48'], ['RN39 - Atividade Rotas', 'RN40 - Atividade Rotas'],
  'E.6 #148935 req #48: Padrão B preservado');
assert(map148935['151937'], ['RN1', 'RN2 - Atividade no Rotas'],
  'E.7 #148935 req #151937: mix Padrão A + B');
assert(map148935['50'], ['RN99', 'RN100'],
  'E.8 #148935 req #50: Padrão A em série (era "RN99 - 9", "RN100 - 0")');
assert(map148935['31225'], ['RN54', 'RN55 - Atividade Rotas'],
  'E.9 #148935 req #31225: mix Padrão A + B (era "RN54 - 4", ...)');

// ========== GRUPO F — Não-regressão de formatos não-link ==========
console.log('\nGRUPO F — Não-regressão de formatos não-link\n');

assert(runRules(wrapAsSection('RN5 - Algum título qualquer\nConteúdo aqui.')),
  ['RN5 - Algum título qualquer'], 'F.1 Formato clássico "RN<N> - Título"');

assert(runRules(wrapAsSection('*RN3 - Negrito*\nConteúdo.')),
  ['RN3 - Negrito'], 'F.2 Negrito Textile envolvendo título');

assert(runRules(wrapAsSection('RN10\nSó RN sem título adicional.')),
  ['RN10'], 'F.3 RN puro sem aspas, sem hífen (era "RN10 -")');

assert(runRules(wrapAsSection('h3. RN7 - Com cabeçalho h3\nConteúdo.')),
  ['RN7 - Com cabeçalho h3'], 'F.4 Cabeçalho h3. antes da regra');

assert(runRules(wrapAsSection('## RN9 - Lista numerada Textile\nConteúdo.')),
  ['RN9 - Lista numerada Textile'], 'F.5 Lista numerada "## RN<N>" (v35.10.1)');

assert(runRules(wrapAsSection('RNX - Placeholder textual\nConteúdo.')),
  ['RNX - Placeholder textual'], 'F.6 Placeholder RNX (sem código numérico)');

// ========== SUMÁRIO ==========
console.log('\n' + '═'.repeat(60));
console.log(`  ${pass + fail} testes — ${pass} ✓ / ${fail} ✗`);
console.log('═'.repeat(60));

if (fail) {
  console.log('\nFalhas detalhadas:');
  failures.forEach(f => {
    console.log(`  ${f.label}`);
    console.log(`    esperado: ${JSON.stringify(f.expected)}`);
    console.log(`    obtido:   ${JSON.stringify(f.actual)}`);
  });
  process.exit(1);
}
