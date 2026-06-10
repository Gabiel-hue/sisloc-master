#!/usr/bin/env node
// test_v35_11_8_area_corte_e_req_placeholder.js — Suite v35.11.8
//
// Cobre os dois fixes consolidados da v35.11.8:
//   Fix A — Área de corte da descrição em CASCATA (helper getDescriptionArea):
//     Estratégia 1: /h1\.\s*Detalhamento\s+d[eo]\s+Projeto/i  (relax: "do" também)
//     Estratégia 2: /h1\.\s*Requisitos?\s+Impactados?[\s\S]*?(?=\n\s*---|\n\s*h1\.|$)/i
//     Estratégia 3: fallback descrição inteira (comportamento original)
//   Fix B — Vocabulário de ID aceita REQ[A-Z0-9]+ como placeholder textual.
//
// Caso real #196410: tem "h1. Detalhamento *do* Projeto" → cai na estratégia 1 do helper.
// Caso real #145438: não tem "Detalhamento de/do Projeto" → cai na estratégia 2 + tem 3
//                    placeholders #REQxx/yy/zz.
//
// Suite AUTO-CONTIDA — regexes inline + mini-pipeline pra reproduzir splitSections,
// getReqIdFromSection, getDescriptionArea, buildPlaceholderMap, isProvisionalId.

'use strict';

const assert = require('assert');

let pass = 0, fail = 0;
function test(name, fn) {
  try {
    fn();
    console.log('✅', name);
    pass++;
  } catch (e) {
    console.log('❌', name);
    console.log('   ', e.message);
    fail++;
  }
}

// ─── Espelho INLINE da lógica v35.11.8 ───────────────────────────────────────

function getDescriptionArea(ds) {
  const detM = ds.match(/h1\.\s*Detalhamento\s+d[eo]\s+Projeto/i);
  if (detM) return ds.slice(detM.index);
  const reqM = ds.match(/h1\.\s*Requisitos?\s+Impactados?[\s\S]*?(?=\n\s*---|\n\s*h1\.|$)/i);
  if (reqM) return ds.slice(reqM.index + reqM[0].length);
  return ds;
}

function splitSections(ds) {
  const area = getDescriptionArea(ds);
  return area.split(/(?=(?:(?<=^|\n)\s*(?:h\d+\.\s*)?REQUISITO\s*:?\s*\*?\s*#{0,2}\s*(?:\d+|X+\d*|Y+\d*|REQ[A-Z0-9]+)|h3\.\s*Requisito[\s:]*(?:Requisito\s+)?(?:Funcional\s+)?\*?\s*#{0,2}\s*(?:\d+|X+\d*|Y+\d*|REQ[A-Z0-9]+)|h3\.\s*#{1,2}\s*(?:\d+|X+\d*|Y+\d*|REQ[A-Z0-9]+)|\n\s*#(?:\d+|X+\d*|Y+\d*|REQ[A-Z0-9]+)\s*[-–]))/i);
}

function getReqIdFromSection(sec) {
  const m = sec.match(/Requisito[\s:]*(?:Requisito\s+)?(?:Funcional\s+)?\*?\s*#{0,2}\s*(\d+|X+\d*|Y+\d*|REQ[A-Z0-9]+)/i)
         || sec.match(/^h3\.\s*#{1,2}\s*(\d+|X+\d*|Y+\d*|REQ[A-Z0-9]+)/im)
         || sec.match(/^\s*#(\d+|X+\d*|Y+\d*|REQ[A-Z0-9]+)\s*[-–]/i);
  return m ? m[1].toUpperCase() : null;
}

function buildPlaceholderMap(ds) {
  const map = [];
  const listSections = ds.match(/h1\.\s*Requisitos?\s*(?:Impactados?|Novos?)([\s\S]*?)(?=\nh1\.|\n---\s*\nh1\.|$)/gi);
  if (!listSections) return map;
  listSections.forEach(function (sec) {
    sec.split('\n').forEach(function (line) {
      const m = line.match(/^#{0,2}\s*(\d+|X+\d*|Y+\d*|REQ[A-Z0-9]+)\s*[-–]\s*(.+)/i);
      if (m) map.push({ id: m[1].toUpperCase(), title: m[2].trim().toLowerCase() });
    });
  });
  return map;
}

function isProvisionalId(id) {
  if (id === '99999') return true;
  if (/^0\d*$/.test(id)) return true;
  if (/^X+\d*$/i.test(id)) return true;
  if (/^Y+\d*$/i.test(id)) return true;
  if (/^REQ[A-Z0-9]+$/i.test(id)) return true;
  return false;
}

function analyzeIds(ds) {
  const secs = splitSections(ds);
  const ids = [];
  secs.forEach(s => {
    const id = getReqIdFromSection(s);
    if (id) ids.push(id);
  });
  return ids;
}

// ─── Grupo A: Fix A — getDescriptionArea estratégia 1 (Detalhamento de/do Projeto) ──

test('A1: estratégia 1 casa "Detalhamento de Projeto" (comportamento original)', () => {
  const ds = 'h1. Requisitos\n#100 - Foo\n\nh1. Detalhamento de Projeto\n\nh3. Requisito #100\n';
  const area = getDescriptionArea(ds);
  assert.ok(area.startsWith('h1. Detalhamento de Projeto'), `Esperava começar em "h1. Detalhamento de Projeto", veio "${area.slice(0,40)}"`);
});

test('A2: estratégia 1 casa "Detalhamento DO Projeto" (NOVO v35.11.8)', () => {
  const ds = 'h1. Requisitos\n#100 - Foo\n\nh1. Detalhamento do Projeto\n\nh3. Requisito #100\n';
  const area = getDescriptionArea(ds);
  assert.ok(area.startsWith('h1. Detalhamento do Projeto'), 'Estratégia 1 deve aceitar "do"');
});

test('A3: estratégia 1 case-insensitive — "DETALHAMENTO DE PROJETO"', () => {
  const ds = 'h1. Requisitos\n#100 - Foo\n\nh1. DETALHAMENTO DE PROJETO\n\n#200\n';
  const area = getDescriptionArea(ds);
  assert.ok(area.startsWith('h1. DETALHAMENTO DE PROJETO'));
});

test('A4: estratégia 1 case-insensitive — "Detalhamento Do Projeto"', () => {
  const ds = 'h1. Detalhamento Do Projeto\n';
  const area = getDescriptionArea(ds);
  assert.ok(area.startsWith('h1. Detalhamento Do Projeto'));
});

test('A5: estratégia 1 não aceita "Detalhamento DA Projeto" (gramática errada)', () => {
  // Garante que a tolerância é mínima: só de/do. Cairia na estratégia 2 ou 3.
  const ds = 'h1. Detalhamento da Projeto\n';
  const detM = ds.match(/h1\.\s*Detalhamento\s+d[eo]\s+Projeto/i);
  assert.strictEqual(detM, null, '"da" não deve casar — só "de" e "do"');
});

test('A6: estratégia 1 tolera múltiplos espaços', () => {
  const ds = 'h1.   Detalhamento   do   Projeto\n#100 - Foo';
  const area = getDescriptionArea(ds);
  assert.ok(area.startsWith('h1.'));
});

// ─── Grupo B: Fix A — estratégia 2 (Requisitos Impactados) ─────────────────

test('B1: estratégia 2 dispara quando estratégia 1 falha (#145438 simplificado)', () => {
  const ds = 'h3. Objetivo\n\nh1. Requisitos Impactados\n\n#100 - Foo\n#200 - Bar\n\n---\n\nRequisito: #100 - Foo\n\n*Regras*\nNA';
  const area = getDescriptionArea(ds);
  // Deve cortar APÓS o bloco "h1. Requisitos Impactados" até "---"
  assert.ok(!area.includes('#100 - Foo\n#200'), 'Sumário NÃO deve estar na área');
  assert.ok(area.includes('Requisito: #100 - Foo'), 'Detalhamento DEVE estar na área');
});

test('B2: estratégia 2 corta até "---" (não até EOF)', () => {
  const ds = 'h1. Requisitos Impactados\n\n#100 - Foo\n\n---\n\nh3. Requisito #100\n*Regras*\nNA';
  const area = getDescriptionArea(ds);
  assert.ok(area.startsWith('\n\n---'), `Deve começar logo após "h1. Requisitos Impactados...", veio "${area.slice(0,30)}"`);
});

test('B3: estratégia 2 corta até próximo h1 se não houver "---"', () => {
  const ds = 'h1. Requisitos Impactados\n\n#100 - Foo\n\nh1. Outra Seção\n\nconteúdo';
  const area = getDescriptionArea(ds);
  assert.ok(area.includes('h1. Outra Seção'), 'Próximo h1. deve estar na área');
  assert.ok(!area.startsWith('h1. Requisitos'), 'Sumário não deve estar no início');
});

test('B4: estratégia 2 aceita variação "Requisito Impactado" (singular)', () => {
  const ds = 'h1. Requisito Impactado\n\n#100 - Foo\n\n---\n\nRequisito: #100';
  const area = getDescriptionArea(ds);
  assert.ok(!area.includes('#100 - Foo'), 'Singular também deve cortar');
});

test('B5: estratégia 2 case-insensitive', () => {
  const ds = 'h1. REQUISITOS IMPACTADOS\n\n#100 - Foo\n\n---\n\nh3. Requisito #100';
  const area = getDescriptionArea(ds);
  assert.ok(!area.includes('#100 - Foo\n'), 'Case-insensitive funciona');
});

// ─── Grupo C: Fix A — estratégia 3 (fallback descrição inteira) ────────────

test('C1: fallback retorna descrição inteira se nenhum marker presente', () => {
  const ds = 'h3. Requisito #100\n\n*Regras*\nNA';
  const area = getDescriptionArea(ds);
  assert.strictEqual(area, ds, 'Sem markers, retorna ds inteira');
});

test('C2: fallback preserva semântica antiga pra descrições sem h1', () => {
  const ds = 'REQUISITO #100\n\n*Regras*\nNA\n\n---\n\nREQUISITO #200\n\n*Regras*\nNA';
  const area = getDescriptionArea(ds);
  assert.strictEqual(area, ds);
});

// ─── Grupo D: Cenário #196410 simplificado (ponta-a-ponta) ─────────────────

test('D1: #196410 simplificado: sumário NÃO duplica reqs (6 únicos, não 12)', () => {
  const ds = `h1. Requisitos Impactados

Requisito #31243 - Manter dados Pessoa
Requisito #75 - Manter dados Produto
Requisito #31225 - Manter dados Pedido
Requisito #32827 - Gerar NF
Requisito #31452 - Totalizar Pedido
Requisito #79 - Manter dados NF

h1. Detalhamento do Projeto

h3. Requisito #31243 - Manter dados Pessoa
*Regras*
"RN1":url - Algo

h3. Requisito #75 - Manter dados Produto
*Regras*
NA

h3. Requisito #31225 - Manter dados Pedido
*Regras*
NA

h3. Requisito #32827 - Gerar NF
*Regras*
"RN2":url - Foo

h3. Requisito #31452 - Totalizar Pedido
*Regras*
NA

h3. Requisito #79 - Manter dados NF
*Regras*
NA
`;
  const ids = analyzeIds(ds);
  assert.strictEqual(ids.length, 6, `Esperava 6 reqs, veio ${ids.length}: ${JSON.stringify(ids)}`);
  assert.deepStrictEqual(ids, ['31243', '75', '31225', '32827', '31452', '79']);
});

test('D2: #196410 — comportamento antes era 12 (regressão evitada)', () => {
  // Sem o fix (regex antigo "de" só), o resultado seria 12 reqs.
  // Esse teste confirma que o helper resolve.
  const ds = `h1. Requisitos Impactados

Requisito #100 - Foo
Requisito #200 - Bar

h1. Detalhamento do Projeto

h3. Requisito #100 - Foo
*Regras*
NA

h3. Requisito #200 - Bar
*Regras*
NA`;
  const ids = analyzeIds(ds);
  assert.strictEqual(ids.length, 2, `Esperava 2, veio ${ids.length}`);
});

// ─── Grupo E: Fix B — vocabulário REQ[A-Z0-9]+ no splitSections ────────────

test('E1: splitSections detecta "Requisito: #REQxx - Foo"', () => {
  const sections = splitSections('Requisito: #REQxx - Foo\n*Regras*\nNA');
  const ids = sections.map(getReqIdFromSection).filter(Boolean);
  assert.deepStrictEqual(ids, ['REQXX']);
});

test('E2: splitSections detecta "h3. Requisito #REQyy"', () => {
  const sections = splitSections('h3. Requisito #REQyy - Bar\n*Regras*\nNA');
  const ids = sections.map(getReqIdFromSection).filter(Boolean);
  assert.deepStrictEqual(ids, ['REQYY']);
});

test('E3: splitSections detecta REQUISITO #REQzz', () => {
  const sections = splitSections('REQUISITO #REQzz - Baz\n*Regras*\nNA');
  const ids = sections.map(getReqIdFromSection).filter(Boolean);
  assert.deepStrictEqual(ids, ['REQZZ']);
});

test('E4: splitSections detecta REQ001 (mix letras+dígitos)', () => {
  const sections = splitSections('Requisito: #REQ001 - Foo\n*Regras*\nNA');
  const ids = sections.map(getReqIdFromSection).filter(Boolean);
  assert.deepStrictEqual(ids, ['REQ001']);
});

test('E5: splitSections detecta REQ_ABC fica como REQ (alfanumérico só)', () => {
  // REQ_ABC → o "_" quebra o vocabulário [A-Z0-9]+ — só pega "REQ" + nada → fail
  // Como pelo menos 1 char é exigido depois de REQ, vai falhar e não casar
  const sections = splitSections('Requisito: #REQ_ABC - Foo');
  const ids = sections.map(getReqIdFromSection).filter(Boolean);
  assert.deepStrictEqual(ids, [], 'REQ_ABC não deve casar (underscore não está em [A-Z0-9])');
});

test('E6: splitSections detecta REQ no formato "#REQxx - Título" no início de linha', () => {
  const sections = splitSections('h1. Detalhamento de Projeto\n\n#REQxx - Foo\n*Regras*\nNA');
  const ids = sections.map(getReqIdFromSection).filter(Boolean);
  assert.deepStrictEqual(ids, ['REQXX']);
});

// ─── Grupo F: Fix B — case-insensitive + normalização ──────────────────────

test('F1: REQxx vira REQXX no retorno (toUpperCase)', () => {
  const ds = 'Requisito: #REQxx - Foo';
  const id = getReqIdFromSection(ds.match(/Requisito.*$/)[0]);
  assert.strictEqual(id, 'REQXX');
});

test('F2: REQyy, ReqYY, reqYY — todos normalizam pra REQYY', () => {
  for (const variant of ['REQyy', 'ReqYY', 'reqYY', 'reqyy']) {
    const id = getReqIdFromSection('Requisito: #' + variant + ' - Foo');
    assert.strictEqual(id, 'REQYY', `Variante "${variant}" deveria normalizar pra REQYY`);
  }
});

test('F3: REQabc (minúsculas) também aceito', () => {
  const id = getReqIdFromSection('Requisito: #REQabc');
  assert.strictEqual(id, 'REQABC');
});

// ─── Grupo G: Fix B — buildPlaceholderMap ──────────────────────────────────

test('G1: buildPlaceholderMap cataloga #REQxx do sumário', () => {
  const ds = 'h1. Requisitos Impactados\n\n#REQxx - Foo\n#REQyy - Bar\n\nh1. Outra';
  const map = buildPlaceholderMap(ds);
  assert.strictEqual(map.length, 2);
  assert.deepStrictEqual(map.map(x => x.id), ['REQXX', 'REQYY']);
});

test('G2: buildPlaceholderMap normaliza case', () => {
  const ds = 'h1. Requisitos Impactados\n\n#reqxx - foo\n\nh1. Outra';
  const map = buildPlaceholderMap(ds);
  assert.strictEqual(map[0].id, 'REQXX');
});

test('G3: buildPlaceholderMap convive com IDs numéricos e X+/Y+', () => {
  const ds = 'h1. Requisitos Impactados\n\n#100 - foo\n#REQxx - bar\n#XX - baz\n\nh1. Outra';
  const map = buildPlaceholderMap(ds);
  assert.deepStrictEqual(map.map(x => x.id), ['100', 'REQXX', 'XX']);
});

// ─── Grupo H: Fix B — isProvisionalId ──────────────────────────────────────

test('H1: isProvisionalId(REQXX) = true', () => {
  assert.strictEqual(isProvisionalId('REQXX'), true);
});

test('H2: isProvisionalId(REQYY) = true', () => {
  assert.strictEqual(isProvisionalId('REQYY'), true);
});

test('H3: isProvisionalId(REQ001) = true (mix letras+dígitos)', () => {
  assert.strictEqual(isProvisionalId('REQ001'), true);
});

test('H4: isProvisionalId aceita case-insensitive', () => {
  assert.strictEqual(isProvisionalId('REQxx'), true);
  assert.strictEqual(isProvisionalId('reqyy'), true);
});

test('H5: isProvisionalId(31243) = false (ID numérico real)', () => {
  assert.strictEqual(isProvisionalId('31243'), false);
});

test('H6: isProvisionalId(REQ) = false (precisa de pelo menos 1 char após REQ)', () => {
  assert.strictEqual(isProvisionalId('REQ'), false);
});

test('H7: isProvisionalId(XEROX) = false (não começa exatamente com REQ)', () => {
  assert.strictEqual(isProvisionalId('XEROX'), false);
});

// ─── Grupo I: travas — REQ NÃO casa fora de posição de ID ──────────────────

test('I1: "REQUISITO" literal não vira ID por causa do REQ\\w+', () => {
  // A 1ª alt do split é "REQUISITO" literal seguido de :?\s* + #{0,2} + ID.
  // Só o que vem depois do # casa como ID. Nunca o "REQUISITO" inteiro.
  const sections = splitSections('REQUISITO #100 - foo');
  const ids = sections.map(getReqIdFromSection).filter(Boolean);
  assert.deepStrictEqual(ids, ['100']);
});

test('I2: "Requisito #REQUEST - foo" também extrai REQUEST como ID', () => {
  // REQUEST começa com REQ → casa REQ[A-Z0-9]+. É um placeholder válido teoricamente.
  // Isso é o comportamento esperado (e raro na prática).
  const id = getReqIdFromSection('Requisito #REQUEST - foo');
  assert.strictEqual(id, 'REQUEST');
});

test('I3: prosa "no requisito #abc abaixo" não cria seção fantasma (case-insensitive bug evitado)', () => {
  // REQ[A-Z0-9]+ exige pelo menos 1 char alfanum após REQ — "abc" sozinho não tem REQ
  const ds = 'h3. Requisito #100\n*Regras*\nNA\n\nObs: ver no requisito #abc abaixo';
  const sections = splitSections(ds);
  const ids = sections.map(getReqIdFromSection).filter(Boolean);
  assert.deepStrictEqual(ids, ['100'], '"#abc" sozinho não casa o vocabulário REQ');
});

test('I4: "#REQ" puro (sem sufixo) não casa', () => {
  // REQ[A-Z0-9]+ exige 1+ char depois de REQ, então "#REQ" sozinho não casa
  const sections = splitSections('Requisito: #REQ');
  const ids = sections.map(getReqIdFromSection).filter(Boolean);
  assert.deepStrictEqual(ids, []);
});

// ─── Grupo J: Não-regressão — formatos antigos continuam ───────────────────

test('J1: REQUISITO #N clássico ainda funciona', () => {
  const ds = 'h1. Detalhamento de Projeto\n\nREQUISITO #500 - Foo\n*Regras*\nNA';
  const ids = analyzeIds(ds);
  assert.deepStrictEqual(ids, ['500']);
});

test('J2: h3. Requisito #N ainda funciona', () => {
  const ds = 'h1. Detalhamento de Projeto\n\nh3. Requisito #700 - Foo\n*Regras*\nNA';
  const ids = analyzeIds(ds);
  assert.deepStrictEqual(ids, ['700']);
});

test('J3: placeholders X+\\d* e Y+\\d* (v35.11.6) continuam funcionando', () => {
  const ds = 'h1. Detalhamento de Projeto\n\nh3. REQUISITO: #XXX - Foo\n*Regras*\nNA\n\nh3. REQUISITO: #YY1 - Bar\n*Regras*\nNA';
  const ids = analyzeIds(ds);
  assert.deepStrictEqual(ids, ['XXX', 'YY1']);
});

test('J4: placeholder #99999 (v35.10.x) continua funcionando', () => {
  assert.strictEqual(isProvisionalId('99999'), true);
});

test('J5: placeholder #0/#01 continua funcionando', () => {
  assert.strictEqual(isProvisionalId('0'), true);
  assert.strictEqual(isProvisionalId('01'), true);
});

// ─── Grupo K: ponta-a-ponta com fixtures reais ─────────────────────────────

test('K1: fixture #196410 retorna exatamente 6 reqs (não 12)', () => {
  const fs = require('fs');
  const path = require('path');
  const fxPath = path.join(__dirname, 'fixtures', '196410.txt');
  if (!fs.existsSync(fxPath)) {
    console.log('   (fixture não encontrada, skip)');
    return;
  }
  const ds = fs.readFileSync(fxPath, 'utf8');
  const ids = analyzeIds(ds);
  assert.strictEqual(ids.length, 6, `Esperava 6, veio ${ids.length}`);
  assert.deepStrictEqual(ids, ['31243', '75', '31225', '32827', '31452', '79']);
});

test('K2: fixture #145438 retorna 8 reqs com REQXX/REQYY/REQZZ no meio', () => {
  const fs = require('fs');
  const path = require('path');
  const fxPath = path.join(__dirname, 'fixtures', '145438.txt');
  if (!fs.existsSync(fxPath)) {
    console.log('   (fixture não encontrada, skip)');
    return;
  }
  const ds = fs.readFileSync(fxPath, 'utf8');
  const ids = analyzeIds(ds);
  assert.strictEqual(ids.length, 8, `Esperava 8, veio ${ids.length}: ${JSON.stringify(ids)}`);
  assert.deepStrictEqual(ids, ['31243', '146823', 'REQXX', 'REQYY', 'REQZZ', '50', '31726', '31157']);
});

test('K3: fixture #196410 — estratégia usada do helper é a 1 (h1. Detalhamento do Projeto)', () => {
  const fs = require('fs');
  const path = require('path');
  const fxPath = path.join(__dirname, 'fixtures', '196410.txt');
  if (!fs.existsSync(fxPath)) return;
  const ds = fs.readFileSync(fxPath, 'utf8');
  const detM = ds.match(/h1\.\s*Detalhamento\s+d[eo]\s+Projeto/i);
  assert.ok(detM, 'detM deve casar (estratégia 1)');
  assert.ok(detM[0].includes('do'), `Deve casar "do", veio "${detM[0]}"`);
});

test('K4: fixture #145438 — estratégia usada do helper é a 2 (Requisitos Impactados)', () => {
  const fs = require('fs');
  const path = require('path');
  const fxPath = path.join(__dirname, 'fixtures', '145438.txt');
  if (!fs.existsSync(fxPath)) return;
  const ds = fs.readFileSync(fxPath, 'utf8');
  const detM = ds.match(/h1\.\s*Detalhamento\s+d[eo]\s+Projeto/i);
  assert.strictEqual(detM, null, 'estratégia 1 deve falhar (fixture não tem)');
  const reqM = ds.match(/h1\.\s*Requisitos?\s+Impactados?[\s\S]*?(?=\n\s*---|\n\s*h1\.|$)/i);
  assert.ok(reqM, 'estratégia 2 deve casar');
});

// ─── Grupo L: edge cases do helper ─────────────────────────────────────────

test('L1: helper retorna ds completa se string vazia', () => {
  assert.strictEqual(getDescriptionArea(''), '');
});

test('L2: helper preserva conteúdo após o corte', () => {
  const ds = 'h1. Detalhamento do Projeto\n\nh3. Requisito #100\nconteúdo';
  const area = getDescriptionArea(ds);
  assert.ok(area.endsWith('conteúdo'));
});

test('L3: helper estratégia 2 — sem "---" depois, corta até EOF', () => {
  const ds = 'h1. Requisitos Impactados\n\n#100 - foo\n#200 - bar';
  const area = getDescriptionArea(ds);
  // Lookahead vê "---" ou "h1." ou "$" — sem nenhum, corta até EOF
  // (área retornada vai começar logo após "h1. Requisitos Impactados ...")
  assert.ok(area.length < ds.length, 'Área deve ser menor que ds');
});

// ─── Resultado ─────────────────────────────────────────────────────────────

console.log();
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`Passou: ${pass}   Falhou: ${fail}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

process.exit(fail > 0 ? 1 : 0);
