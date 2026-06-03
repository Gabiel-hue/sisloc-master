// tests/test_v35_11_5_requisito_asterisco.js
//
// Suite de testes para v35.11.5 — fix do padrão "h2. Requisito *#N – Título*"
// (asterisco do negrito Textile entre "Requisito" e o "#").
//
// Bug original (#204289): a descrição do req #95698 começa com
// "h2. Requisito *#95698 – Manter Dados Substituição Rápida...*".
// O asterisco entre "Requisito" e "#" é o início do negrito Textile que
// envolve o título inteiro do header. Os regex de detecção de seção
// (splitSections, getReqIdFromSection, getReqSectionBounds) só permitiam
// "\s*:?\s*" entre "Requisito" e o "#", então o "*" quebrava o match e o
// req #95698 não aparecia na caixinha.
//
// Bug latente correlato descoberto na mesma sessão:
//   O nextM do getReqSectionBounds (delimitador de fim do bloco) só
//   detectava "h3. Requisito" como início de próximo req — não tinha
//   "(?:h\d+\.\s*)?" opcional na 2ª alt como o splitSections já tinha
//   desde v35.11.2. Resultado: o end do #31505 vazava até o fim do arquivo
//   (passando pelo #95698 inteiro). Gravar regras no #31505 sobrescreveria
//   o #95698. Fix do nextM 2ª alt elimina esse vazamento.
//
// Fix na v35.11.5 (7 ajustes em 4 funções):
//   (1) splitSections — "\*?\s*" nas 2 alts (REQUISITO bare e h3. Requisito)
//   (2) getReqIdFromSection — "\*?\s*" antes do #{0,2}
//   (3) getReqSectionBounds — "\*?\s*" em reDetalhe, reAny e nas 2 alts do
//       nextM; bônus "(?:h\d+\.\s*)?" na 2ª alt do nextM
//
// Mesma técnica das v35.11.2 (lookbehind + alt opcional) e v35.11.4
// (lookbehind no rulesMatch).
//
// Grupos:
//   A — Padrão problemático: regex de detecção tolera "*" entre Requisito e #
//   B — getReqSectionBounds: detecção de próximo req h2 (não só h3)
//   C — Ponta-a-ponta com fixture real #204289
//   D — Não-regressão (formato clássico sem asterisco + 14 fixtures)

'use strict';

const fs = require('fs');
const path = require('path');
const { analyze, splitSections, getReqIdFromSection, getReqSectionBounds } = require('./extract_logic');

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

console.log('\n━━━━ v35.11.5 — "h2. Requisito *#N" (asterisco do negrito Textile) ━━━━\n');

// ========== GRUPO A — Padrão problemático tolerado ==========
console.log('GRUPO A — Regex de detecção tolera "*" entre "Requisito" e "#"\n');

// A.1: splitSections separa 2 reqs onde o 2º tem asterisco
{
  const ds = 'h1. Detalhamento de Projeto\n\n' +
             'h2. Requisito #31505 – Definir\nCorpo do req 1.\n\n---\n\n' +
             'h2. Requisito *#95698 – Manter Dados*\nCorpo do req 2.';
  const ids = analyze(ds).map(r => r.id);
  assert(ids, ['31505', '95698'], 'A.1 splitSections separa 2 reqs (2º com h2. Requisito *#N)');
}

// A.2: getReqIdFromSection extrai id de "h2. Requisito *#95698 – Título*"
assert(
  getReqIdFromSection('h2. Requisito *#95698 – Manter Dados Substituição*'),
  '95698',
  'A.2 getReqIdFromSection extrai 95698 mesmo com "*" entre "Requisito" e "#"'
);

// A.3: variação — "h3. Requisito *#N – Título*" (mesma técnica em h3)
assert(
  getReqIdFromSection('h3. Requisito *#42 – Teste*'),
  '42',
  'A.3 getReqIdFromSection extrai id de "h3. Requisito *#N"'
);

// A.4: variação — espaço extra antes do "*"
assert(
  getReqIdFromSection('h2. Requisito  *#777 – Algo*'),
  '777',
  'A.4 espaço extra entre "Requisito" e "*" ainda casa'
);

// A.5: variação — sem espaço entre "*" e "#" (caso real é assim)
assert(
  getReqIdFromSection('h2. Requisito *#888 – Algo*'),
  '888',
  'A.5 "*#" colado (sem espaço) — caso real da #204289'
);

// A.6: getReqSectionBounds encontra req com asterisco no header
{
  const ds = 'h1. Detalhamento de Projeto\n\n' +
             'h2. Requisito *#95698 – Manter Dados*\n\nCorpo.';
  const b = getReqSectionBounds(ds, '95698');
  assert(
    b !== null,
    true,
    'A.6 getReqSectionBounds(#95698) acha a seção apesar do "*"'
  );
}

// ========== GRUPO B — nextM detecta próximo req h2/h1 (não só h3) ==========
console.log('\nGRUPO B — getReqSectionBounds.nextM detecta próximo req em h2/h1\n');

// B.1: bloco do req anterior PARA antes do próximo h2. Requisito (sem vazar)
{
  const ds = 'h1. Detalhamento de Projeto\n\n' +
             'h2. Requisito #31505 – Definir\nCorpo do 1.\n\n---\n\n' +
             'h2. Requisito *#95698 – Manter*\nCorpo do 2.';
  const b1 = getReqSectionBounds(ds, '31505');
  const b2 = getReqSectionBounds(ds, '95698');
  assert(
    b1.end <= b2.start,
    true,
    'B.1 end(#31505) ≤ start(#95698) — sem vazamento de bloco'
  );
}

// B.2: nextM detecta h1. REQUISITO (caso teórico)
{
  const ds = 'h1. Detalhamento de Projeto\n\n' +
             'h2. Requisito #100 – Primeiro\nCorpo do 100.\n\n' +
             'h1. REQUISITO #200 – Segundo\nCorpo do 200.';
  const b = getReqSectionBounds(ds, '100');
  assert(
    b.end < ds.length,
    true,
    'B.2 nextM detecta h1. REQUISITO como fim do bloco anterior'
  );
}

// B.3: clássico h3. Requisito continua sendo detectado pelo nextM
{
  const ds = 'h1. Detalhamento de Projeto\n\n' +
             'h2. Requisito #100 – Primeiro\nCorpo do 100.\n\n' +
             'h3. Requisito #200 – Segundo\nCorpo do 200.';
  const b = getReqSectionBounds(ds, '100');
  assert(
    b.end < ds.length,
    true,
    'B.3 nextM detecta h3. Requisito clássico (não-regressão)'
  );
}

// B.4: req do meio com asterisco — bounds preservam ambos os vizinhos
{
  const ds = 'h1. Detalhamento de Projeto\n\n' +
             'h2. Requisito #100 – A\nCorpo A.\n\n---\n\n' +
             'h2. Requisito *#200 – B*\nCorpo B.\n\n---\n\n' +
             'h2. Requisito #300 – C\nCorpo C.';
  const b1 = getReqSectionBounds(ds, '100');
  const b2 = getReqSectionBounds(ds, '200');
  const b3 = getReqSectionBounds(ds, '300');
  assert(b1.end <= b2.start, true, 'B.4a #100 termina antes de #200 (com asterisco)');
  assert(b2.end <= b3.start, true, 'B.4b #200 (com asterisco) termina antes de #300');
}

// ========== GRUPO C — Ponta-a-ponta com fixture #204289 ==========
console.log('\nGRUPO C — Ponta-a-ponta com fixture real #204289\n');

const fixDir = path.join(__dirname, 'fixtures');
const ds204289 = fs.readFileSync(path.join(fixDir, '204289.txt'), 'utf8');
const result204289 = analyze(ds204289);

// C.1: 2 reqs detectados
assert(
  result204289.map(r => r.id),
  ['31505', '95698'],
  'C.1 #204289 detecta ambos os reqs (#31505 + #95698)'
);

// C.2: #31505 tem a regra esperada
{
  const r = result204289.find(r => r.id === '31505');
  assert(
    r.rules,
    ['RNXX - Permitir substituição pelo mesmo equipamento na Devolução'],
    'C.2 #31505 → RNXX da Devolução'
  );
}

// C.3: #95698 tem a regra esperada
{
  const r = result204289.find(r => r.id === '95698');
  assert(
    r.rules,
    ['RNXX - Permitir substituição pelo mesmo equipamento na Substituição Rápida'],
    'C.3 #95698 → RNXX da Substituição Rápida'
  );
}

// C.4: bounds do #95698 capturam só o bloco dele (sem vazar nem ser engolido)
{
  const b1 = getReqSectionBounds(ds204289, '31505');
  const b2 = getReqSectionBounds(ds204289, '95698');
  assert(b1 !== null && b2 !== null, true, 'C.4a bounds não-null para ambos os reqs');
  assert(b1.end <= b2.start, true, 'C.4b end(#31505) ≤ start(#95698) na fixture real');
}

// ========== GRUPO D — Não-regressão ==========
console.log('\nGRUPO D — Não-regressão (formato clássico + 14 fixtures)\n');

// D.1: clássico "h3. Requisito #N - Título" SEM asterisco continua funcionando
assert(
  getReqIdFromSection('h3. Requisito #123 - Algo'),
  '123',
  'D.1 clássico "h3. Requisito #N" sem asterisco'
);

// D.2: clássico "h2. REQUISITO ##N" maiúsculo (caso #206262) preservado
assert(
  getReqIdFromSection('h2. REQUISITO ##456'),
  '456',
  'D.2 "h2. REQUISITO ##N" caps continua casando'
);

// D.3: formato "Requisito: Requisito Funcional #N" (caso #199075) preservado
assert(
  getReqIdFromSection('h3. Requisito: Requisito Funcional #789'),
  '789',
  'D.3 "Requisito: Requisito Funcional #N" continua casando'
);

// D.4: split clássico de 2 reqs SEM asterisco
{
  const ds = 'h1. Detalhamento de Projeto\n\n' +
             'h3. REQUISITO: 100 - A\n\n*REGRAS*\nNA\n\n---\n\n' +
             'h3. REQUISITO: 200 - B\n\n*REGRAS*\nNA';
  assert(
    analyze(ds).map(r => r.id),
    ['100', '200'],
    'D.4 split clássico h3. REQUISITO sem asterisco'
  );
}

// D.5: prosa "no requisito #N abaixo" ainda NÃO cria seção fantasma (v35.11.2)
{
  const ds = 'h1. Detalhamento de Projeto\n\n' +
             'h3. REQUISITO: 100 - A\n\nVer no requisito #200 abaixo.\n\n*REGRAS*\nNA\n\n---\n\n' +
             'h3. REQUISITO: 200 - B\n\n*REGRAS*\nNA';
  assert(
    analyze(ds).map(r => r.id),
    ['100', '200'],
    'D.5 "no requisito #N abaixo" em prosa não cria fantasma (v35.11.2 preservada)'
  );
}

// D.6: 14 fixtures catalogadas continuam extraindo >0 reqs
const fixturesAntigas = ['148935', '171042', '175029', '175544', '188640', '190033',
                         '196911', '199075', '206262', '207663', '207979', '208519',
                         '208821', '208937'];
fixturesAntigas.forEach((id, i) => {
  const ds = fs.readFileSync(path.join(fixDir, id + '.txt'), 'utf8');
  const result = analyze(ds);
  assert(result.length > 0, true, 'D.' + (7+i) + ' #' + id + ': não-regressão (extrai >0 reqs)');
});

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
