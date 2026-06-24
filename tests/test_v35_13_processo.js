#!/usr/bin/env node
// test_v35_13_processo.js — Suite de testes para suporte a `PROCESSO` (v35.13)
//
// Cobre:
//   Grupo A (10): detecção do header h3. PROCESSO: / h3. REQUISITO: PROCESSO:
//   Grupo B  (8): auto-numbering — PROCESSO1, PROCESSO2, ... na ordem
//   Grupo C  (8): isProvisionalId — PROCESSO/PROCESSO\d+ tratados como provisional
//   Grupo D  (8): placeholderMap — h3. PROCESSO - <título> no sumário
//   Grupo E  (8): não-regressão defensiva — PROCESSO em prosa NÃO casa
//   Grupo F  (8): pipeline analyze() — fixture-like + ordering
//   Grupo G  (6): bounds — getReqSectionBounds funciona com PROCESSO
//   Grupo H  (5): edge cases — PROCESSO no fim, adjacente, hífen, en-dash, case-insensitive
//
// Total: 61 testes
//
// Uso: node tests/test_v35_13_processo.js

'use strict';

const {
  extractRules,
  splitSections,
  getReqIdFromSection,
  getReqSectionBounds,
  buildPlaceholderMap,
  buildPlaceholderMapNumbered,
  isProvisionalId,
  analyze
} = require('./extract_logic');

let ok = 0, fail = 0;
const failures = [];

function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log('  ✓ ' + label);
    ok++;
  } else {
    console.log('  ✗ ' + label);
    console.log('      esperado: ' + e);
    console.log('      obtido:   ' + a);
    fail++;
    failures.push(label);
  }
}

function group(name) {
  console.log('\n━━━ ' + name + ' ━━━');
}

// ============ GRUPO A — Detecção do header ============
group('A — Detecção do header PROCESSO');

eq(
  getReqIdFromSection('h3. PROCESSO: Gerar Pendência\n\n*REGRAS:*\nRN1 - X'),
  'PROCESSO',
  'A1: h3. PROCESSO: <título> → ID=PROCESSO'
);

eq(
  getReqIdFromSection('h3. REQUISITO: PROCESSO: Gerar Pendência\n\n*REGRAS:*\nRN1 - X'),
  'PROCESSO',
  'A2: h3. REQUISITO: PROCESSO: <título> → ID=PROCESSO'
);

eq(
  getReqIdFromSection('h3. PROCESSO - Volumetria\n\n*REGRAS:*\nRN1 - X'),
  'PROCESSO',
  'A3: h3. PROCESSO - <título> (com hífen) → ID=PROCESSO'
);

eq(
  getReqIdFromSection('h3. PROCESSO – Volumetria\n\n*REGRAS:*\nRN1 - X'),
  'PROCESSO',
  'A4: h3. PROCESSO – <título> (en-dash) → ID=PROCESSO'
);

eq(
  getReqIdFromSection('h2. PROCESSO: X\n\n*REGRAS:*\nRN1 - X'),
  'PROCESSO',
  'A5: h2. PROCESSO: (não só h3.) → ID=PROCESSO'
);

eq(
  getReqIdFromSection('h4. PROCESSO: X\n*REGRAS:*'),
  'PROCESSO',
  'A6: h4. PROCESSO: também detecta'
);

eq(
  getReqIdFromSection('h3. processo: minusculo\n*REGRAS:*'),
  'PROCESSO',
  'A7: case-insensitive — h3. processo: também detecta'
);

eq(
  getReqIdFromSection('h3. REQUISITO: ##42\n*REGRAS:*'),
  '42',
  'A8: não-regressão — REQUISITO ##42 normal continua casando'
);

eq(
  getReqIdFromSection('h3. PROCESSO ATIVO foo\n*REGRAS:*'),
  null,
  'A9: PROCESSO sem separador [:\\-–] NÃO casa (defesa contra prosa)'
);

eq(
  getReqIdFromSection('Algum texto antes\nh3. PROCESSO: X'),
  'PROCESSO',
  'A10: header detectado mesmo com prosa antes (via /m anchor)'
);

// ============ GRUPO B — Auto-numbering ============
group('B — Auto-numbering PROCESSO1, PROCESSO2, ...');

const dsB1 = 'h1. Detalhamento de Projeto\n\nh3. PROCESSO: A\n\n*REGRAS:*\nRN1 - r\n\n---\n\nh3. PROCESSO: B\n\n*REGRAS:*\nRN1 - s';
eq(
  analyze(dsB1).map(r => r.id),
  ['PROCESSO1', 'PROCESSO2'],
  'B1: 2 PROCESSOs → PROCESSO1, PROCESSO2 na ordem'
);

const dsB2 = 'h1. Detalhamento de Projeto\n\nh3. PROCESSO: A\n*REGRAS:*\nRN1 - r\n\n---\n\nh3. PROCESSO: B\n*REGRAS:*\nRN1 - s\n\n---\n\nh3. PROCESSO: C\n*REGRAS:*\nRN1 - t';
eq(
  analyze(dsB2).map(r => r.id),
  ['PROCESSO1', 'PROCESSO2', 'PROCESSO3'],
  'B2: 3 PROCESSOs → PROCESSO1/2/3 na ordem'
);

const dsB3 = 'h1. Detalhamento de Projeto\n\nh3. REQUISITO: ##100\n*REGRAS:*\nRN1 - r\n\n---\n\nh3. PROCESSO: Foo\n*REGRAS:*\nRN1 - s\n\n---\n\nh3. REQUISITO: ##200\n*REGRAS:*\nRN1 - t\n\n---\n\nh3. PROCESSO: Bar\n*REGRAS:*\nRN1 - u';
eq(
  analyze(dsB3).map(r => r.id),
  ['100', 'PROCESSO1', '200', 'PROCESSO2'],
  'B3: mistura numeric + PROCESSO — contador só pra PROCESSO'
);

const dsB4 = 'h1. Detalhamento de Projeto\n\nh3. REQUISITO: ##100\n*REGRAS:*\nRN1 - r';
eq(
  analyze(dsB4).map(r => r.id),
  ['100'],
  'B4: sem PROCESSOs — comportamento original preservado'
);

const dsB5 = 'h1. Detalhamento de Projeto\n\nh3. PROCESSO: A\n*REGRAS:*\nRN1 - r';
eq(
  analyze(dsB5).map(r => r.id),
  ['PROCESSO1'],
  'B5: 1 PROCESSO sozinho vira PROCESSO1 (não PROCESSO)'
);

const dsB6 = 'h1. Detalhamento de Projeto\n\nh3. PROCESSO: PrimeiroNoArquivo\n*REGRAS:*\n\n---\n\nh3. REQUISITO: ##50\n*REGRAS:*\n\n---\n\nh3. PROCESSO: TerceiroNoArquivo\n*REGRAS:*';
eq(
  analyze(dsB6).map(r => r.id),
  ['PROCESSO1', '50', 'PROCESSO2'],
  'B6: PROCESSO antes e depois de numeric — numeração separada do numeric'
);

const dsB7 = 'h1. Requisitos Novos\n\nh3. PROCESSO - A\nh3. PROCESSO - B\n\nh1. Detalhamento de Projeto\n\nh3. PROCESSO: A\n*REGRAS:*';
eq(
  buildPlaceholderMapNumbered(dsB7).map(e => e.id),
  ['PROCESSO1', 'PROCESSO2'],
  'B7: placeholderMapNumbered auto-numera no sumário'
);

eq(
  buildPlaceholderMap(dsB7).map(e => e.id),
  ['PROCESSO', 'PROCESSO'],
  'B8: buildPlaceholderMap (sem numbered) preserva ID literal PROCESSO'
);

// ============ GRUPO C — isProvisionalId ============
group('C — isProvisionalId aceita PROCESSO + sufixos');

eq(isProvisionalId('PROCESSO'),   true,  'C1: PROCESSO puro → provisional');
eq(isProvisionalId('PROCESSO1'),  true,  'C2: PROCESSO1 → provisional');
eq(isProvisionalId('PROCESSO99'), true,  'C3: PROCESSO99 → provisional');
eq(isProvisionalId('processo'),   true,  'C4: case-insensitive minúsculo');
eq(isProvisionalId('PROCESSO1A'), false, 'C5: PROCESSO1A (letra após dígito) NÃO casa');
eq(isProvisionalId('XPROCESSO'),  false, 'C6: XPROCESSO (prefixado) NÃO casa');
eq(isProvisionalId('PROCESSOS'),  false, 'C7: PROCESSOS (plural) NÃO casa');
eq(isProvisionalId('99999'),      true,  'C8: não-regressão — 99999 ainda funciona');

// ============ GRUPO D — placeholderMap (sumário) ============
group('D — placeholderMap captura h3. PROCESSO - <título>');

const dsD1 = 'h1. Requisitos Novos\n\nh3. PROCESSO - Foo\n\nh1. Detalhamento de Projeto';
eq(
  buildPlaceholderMap(dsD1),
  [{ id: 'PROCESSO', title: 'foo' }],
  'D1: h3. PROCESSO - Foo → entry com title=foo'
);

const dsD2 = 'h1. Requisitos Novos\n\nh3. PROCESSO - Foo\nh3. PROCESSO - Bar\nh3. PROCESSO - Baz\n\nh1. Detalhamento de Projeto';
eq(
  buildPlaceholderMap(dsD2).length,
  3,
  'D2: 3 entries no sumário'
);

const dsD3 = 'h1. Requisitos Novos\n\n#100 - Foo\nh3. PROCESSO - Bar\n\nh1. Detalhamento de Projeto';
eq(
  buildPlaceholderMap(dsD3),
  [{ id: '100', title: 'foo' }, { id: 'PROCESSO', title: 'bar' }],
  'D3: mistura — #100 e PROCESSO coexistem'
);

const dsD4 = 'h1. Requisitos Novos\n\nh3. PROCESSO – Foo\n\nh1. Detalhamento de Projeto';
eq(
  buildPlaceholderMap(dsD4),
  [{ id: 'PROCESSO', title: 'foo' }],
  'D4: en-dash funciona igual hífen'
);

const dsD5 = 'h1. Requisitos Novos\n\nh2. PROCESSO - Foo\n\nh1. Detalhamento de Projeto';
eq(
  buildPlaceholderMap(dsD5),
  [{ id: 'PROCESSO', title: 'foo' }],
  'D5: h2. (não só h3.) também casa'
);

const dsD6 = 'h1. Requisitos Novos\n\nh3. PROCESSO  -  Foo Bar Baz\n\nh1. Detalhamento de Projeto';
eq(
  buildPlaceholderMap(dsD6),
  [{ id: 'PROCESSO', title: 'foo bar baz' }],
  'D6: espaços extras ao redor do hífen são absorvidos'
);

const dsD7 = 'h1. Requisitos Novos\n\nh3. processo - foo\n\nh1. Detalhamento';
eq(
  buildPlaceholderMap(dsD7),
  [{ id: 'PROCESSO', title: 'foo' }],
  'D7: case-insensitive — id sempre uppercase'
);

const dsD8 = 'h1. Requisitos Novos\n\n#100 - Sem hífen depois\n\nh1. Detalhamento';
eq(
  buildPlaceholderMap(dsD8),
  [{ id: '100', title: 'sem hífen depois' }],
  'D8: não-regressão — #N do sumário continua casando'
);

// ============ GRUPO E — Não-regressão defensiva ============
group('E — PROCESSO em prosa NÃO casa');

eq(
  getReqIdFromSection('h3. REQUISITO: ##100\n\nAlgum texto antes do processo:\nFazer X.'),
  '100',
  'E1: "antes do processo:" em prosa não interfere'
);

eq(
  splitSections('h1. Detalhamento de Projeto\n\nh3. REQUISITO: ##100\n\nO processo de validação:\nFazer X.').length >= 1,
  true,
  'E2: "O processo:" em prosa não cria seção fantasma'
);

const dsE3 = 'h1. Detalhamento de Projeto\n\nh3. REQUISITO: ##100\n\nVer "h3. PROCESSO:" como exemplo';
eq(
  analyze(dsE3).map(r => r.id),
  ['100'],
  'E3: "h3. PROCESSO:" dentro de aspas em prosa não cria seção (ancorado por linha)'
);

const dsE4 = 'h1. Detalhamento de Projeto\n\nh3. REQUISITO: ##100\n\nh3. Processos do sistema\n\nLista bla bla.';
eq(
  analyze(dsE4).map(r => r.id),
  ['100'],
  'E4: "h3. Processos" (plural sem separador) NÃO casa'
);

const dsE5 = 'h1. Detalhamento de Projeto\n\nh3. REQUISITO: ##100\n\nh3. Processo de cadastro\n\nbla.';
eq(
  analyze(dsE5).map(r => r.id),
  ['100'],
  'E5: "h3. Processo de" (sem separador [:\\-–] após PROCESSO) NÃO casa'
);

const dsE6 = 'h1. Detalhamento de Projeto\n\nh3. REQUISITO: ##100\n\n*Tabela*: PROCESSO: campo';
eq(
  analyze(dsE6).map(r => r.id),
  ['100'],
  'E6: "PROCESSO:" em conteúdo de tabela/prosa não cria seção'
);

const dsE7 = 'h1. Detalhamento de Projeto\n\nh3. REQUISITO: ##100\n\n* PROCESSO: bullet';
eq(
  analyze(dsE7).map(r => r.id),
  ['100'],
  'E7: PROCESSO em bullet "*" NÃO casa (anchor exige h\\d+\\.)'
);

const dsE8 = 'h1. Detalhamento de Projeto\n\nh3. REQUISITO: ##100\n\nAprovação do processo - bla bla.';
eq(
  analyze(dsE8).map(r => r.id),
  ['100'],
  'E8: "Aprovação do processo - bla" em prosa NÃO casa'
);

// ============ GRUPO F — Pipeline analyze() ============
group('F — Pipeline analyze() integrado');

const dsF1 = 'h1. Requisitos Novos\n\n#100 - Foo\n#200 - Bar\nh3. PROCESSO - Baz\nh3. PROCESSO - Qux\n\nh1. Detalhamento de Projeto\n\nh3. REQUISITO: ##100\n*REGRAS:*\nRN1 - regra A\n\n---\n\nh3. REQUISITO: ##200\n*REGRAS:*\nRN1 - regra B\n\n---\n\nh3. PROCESSO: Baz\n*REGRAS:*\nRN1 - regra C\n\n---\n\nh3. PROCESSO: Qux\n*REGRAS:*\nRN1 - regra D';

eq(
  analyze(dsF1).map(r => r.id),
  ['100', '200', 'PROCESSO1', 'PROCESSO2'],
  'F1: 4 entries — 2 numeric + 2 PROCESSO autonumbered'
);

eq(
  analyze(dsF1)[2].rules,
  ['RN1 - regra C'],
  'F2: PROCESSO1 mantém suas próprias regras'
);

eq(
  analyze(dsF1)[3].rules,
  ['RN1 - regra D'],
  'F3: PROCESSO2 mantém suas próprias regras'
);

// 191719-like: PROCESSO entre #N e PROCESSO
const dsF4 = 'h1. Detalhamento de Projeto\n\nh3. REQUISITO: ##210210\n*REGRAS:*\nRN1 - inativação\n\n---\n\nh3. REQUISITO: PROCESSO: Gerar Pendência\n*REGRAS:*\nRNX - pendência\n\n---\n\nh3. REQUISITO: PROCESSO: Gerar Serviço Extra\n*REGRAS:*\nRNY - serviço extra';

eq(
  analyze(dsF4).map(r => r.id),
  ['210210', 'PROCESSO1', 'PROCESSO2'],
  'F4: simulação 191719 — #210210 não engloba os 2 PROCESSOs adjacentes'
);

eq(
  analyze(dsF4)[0].rules,
  ['RN1 - inativação'],
  'F5: regras de #210210 não vazam pra PROCESSO (ainda corta no ---)'
);

eq(
  analyze(dsF4)[1].rules,
  ['RNX - pendência'],
  'F6: PROCESSO1 tem sua própria regra (RNX) extraída'
);

const dsF7 = 'h1. Detalhamento de Projeto';
eq(
  analyze(dsF7),
  [],
  'F7: descrição sem reqs → array vazio'
);

// análise inteira da fixture real 191719
const fs = require('fs');
const path = require('path');
const fixture191719Path = path.join(__dirname, 'fixtures', '191719.txt');
if (fs.existsSync(fixture191719Path)) {
  const ds191719 = fs.readFileSync(fixture191719Path, 'utf8');
  const result191719 = analyze(ds191719);
  const ids191719 = result191719.map(r => r.id);
  eq(
    ids191719,
    ['31726', '207356', '209973', '210067', '210067', '210085', '210210', 'PROCESSO1', 'PROCESSO2', '31564', '210388', 'PROCESSO3'],
    'F8: fixture real 191719 — 12 caixinhas na ordem do source'
  );
} else {
  console.log('  ⚠ F8 pulado — fixture 191719.txt não encontrada');
}

// ============ GRUPO G — getReqSectionBounds ============
group('G — getReqSectionBounds termina antes do próximo PROCESSO');

const dsG = 'pre\n\nh3. REQUISITO: ##100\n*O QUE*\n\nbla\n\n*CONDIÇÕES/REGRAS:*\nRN1 - a\n\nh3. PROCESSO: Foo\n*O QUE*\nbla\n\n*CONDIÇÕES/REGRAS:*\nRN1 - b';

const boundsG1 = getReqSectionBounds(dsG, '100');
eq(
  !!boundsG1,
  true,
  'G1: bounds do #100 retorna não-null'
);

const sec100 = dsG.slice(boundsG1.start, boundsG1.end);
eq(
  sec100.indexOf('PROCESSO') === -1,
  true,
  'G2: section do #100 NÃO inclui o "PROCESSO" do próximo bloco'
);

eq(
  sec100.indexOf('RN1 - a') >= 0,
  true,
  'G3: section do #100 contém a regra "RN1 - a"'
);

eq(
  sec100.indexOf('RN1 - b') === -1,
  true,
  'G4: section do #100 NÃO contém a regra "RN1 - b" do PROCESSO seguinte'
);

// caso reverso — PROCESSO antes de #N
const dsG5 = 'pre\n\nh3. PROCESSO: Foo\n*CONDIÇÕES/REGRAS:*\nRN1 - a\n\nh3. REQUISITO: ##200\n*CONDIÇÕES/REGRAS:*\nRN1 - b';
const boundsG5 = getReqSectionBounds(dsG5, '200');
eq(
  !!boundsG5,
  true,
  'G5: bounds do #200 (depois de PROCESSO) retorna não-null'
);

const sec200 = dsG5.slice(boundsG5.start, boundsG5.end);
eq(
  sec200.indexOf('PROCESSO') === -1,
  true,
  'G6: section do #200 NÃO inclui o PROCESSO anterior'
);

// ============ GRUPO H — Edge cases ============
group('H — Edge cases');

const dsH1 = 'h1. Detalhamento de Projeto\n\nh3. REQUISITO: ##100\n*REGRAS:*\nRN1 - x\n\n---\n\nh3. PROCESSO: Foo\n*REGRAS:*\nRN1 - y';
eq(
  analyze(dsH1).map(r => r.id),
  ['100', 'PROCESSO1'],
  'H1: PROCESSO no fim do documento'
);

const dsH2 = 'h1. Detalhamento de Projeto\n\nh3. PROCESSO: Foo\n*REGRAS:*\nRN1 - x\n\n---\n\nh3. PROCESSO: Bar\n*REGRAS:*\nRN1 - y';
eq(
  analyze(dsH2).map(r => r.id),
  ['PROCESSO1', 'PROCESSO2'],
  'H2: 2 PROCESSOs sem nenhum numérico'
);

// SEM "---" entre as 2 PROCESSOs — split ainda deve separar pelo header
const dsH3 = 'h1. Detalhamento de Projeto\n\nh3. PROCESSO: Foo\n*REGRAS:*\nRN1 - x\n\nh3. PROCESSO: Bar\n*REGRAS:*\nRN1 - y';
eq(
  analyze(dsH3).map(r => r.id),
  ['PROCESSO1', 'PROCESSO2'],
  'H3: 2 PROCESSOs SEM "---" entre eles — split ainda separa'
);

// PROCESSO usando hífen no header
const dsH4 = 'h1. Detalhamento de Projeto\n\nh3. PROCESSO - Foo\n*REGRAS:*\nRN1 - x';
eq(
  analyze(dsH4).map(r => r.id),
  ['PROCESSO1'],
  'H4: header com hífen (h3. PROCESSO - Foo) detecta'
);

// PROCESSO usando en-dash
const dsH5 = 'h1. Detalhamento de Projeto\n\nh3. PROCESSO – Foo\n*REGRAS:*\nRN1 - x';
eq(
  analyze(dsH5).map(r => r.id),
  ['PROCESSO1'],
  'H5: header com en-dash (h3. PROCESSO – Foo) detecta'
);

// ============ SUMÁRIO ============
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TOTAL: ' + (ok + fail) + '  |  ✓ ' + ok + '  |  ✗ ' + fail);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (fail > 0) {
  console.log('\nFalhas:');
  failures.forEach(f => console.log('  - ' + f));
}
process.exit(fail > 0 ? 1 : 0);
