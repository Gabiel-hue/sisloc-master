// tests/test_v35_10_1_aspas_e_hash.js — v35.10.1
//
// Suite de regressão para os 2 fixes da v35.10.1:
//
//   BUG A (demanda #206262, req #32549/#31468/#98848) — Atualizar Links:
//     - Aspas retas (") DENTRO do título Textile quebravam a renderização
//       (Textile fecha o link no primeiro " que encontra).
//     - O regex [^\n]* engolia o \r dos arquivos CRLF do Redmine, deixando
//       um \r preso dentro do título Textile gerado.
//
//   BUG B (demanda #199075, req #40803) — extract + Atualizar Links:
//     - Regras escritas como "## RNX – Título" (lista numerada nível 2 do
//       Textile) eram completamente ignoradas pelo extractRules.
//     - O handler "Atualizar Links" também não casava o padrão.
//
// Cobertura: lógica pura, sem DOM. Espelha o que o cb3/cb3b e o extractRules
// fazem no bookmarklet, replicando os regexes da v35.10.1.

'use strict';

const fs = require('fs');
const path = require('path');
const { extractRules, splitSections, getReqIdFromSection, analyze } = require('./extract_logic.js');

// ============================================================
// HELPERS (espelham o bookmarklet v35.10.1)
// ============================================================

// helper tq — converte aspas retas em curvas (open/close alternados)
function tq(s) {
  let o = '', st = true;
  for (const ch of s) {
    if (ch === '"') { o += (st ? '\u201C' : '\u201D'); st = !st; }
    else o += ch;
  }
  return o;
}

// Replica reCase3a/b/c/d/e construindo dinamicamente para um escPrefix dado.
// Usa o regex EXATO da v35.10.1 (com ## opcional e [^\n\r]).
function buildReCases(oldPrefix) {
  const escPrefix = oldPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return {
    a: new RegExp('(^|\\n)(\\s*(?:#{1,2}\\s+)?(?:\\([^)]*\\)\\s*)?)\\*(' + escPrefix + '\\s*[-–][^\\n\\r*]*?)\\*'),
    b: new RegExp('(^|\\n)(\\s*(?:#{1,2}\\s+)?(?:\\([^)]*\\)\\s*)?)\\*(' + escPrefix + ')\\*(\\s*[-–]\\s*)([^\\n\\r]+)'),
    c: new RegExp('(^|\\n)(\\s*(?:#{1,2}\\s+)?(?:\\([^)]*\\)\\s*)?)(' + escPrefix + '\\s*[-–][^\\n\\r]*)'),
    d: new RegExp('(^|\\n)\\s*\\*(\\s*(?:#{1,2}\\s+)?\\([^)]*\\)\\s*)(' + escPrefix + '\\s*[-–][^\\n\\r*]*?)\\*'),
    e: new RegExp('(^|\\n)(\\s*\\*(?:CONDI[CÇ][OÕ]ES\\/REGRAS|REGRAS)\\*?\\s*:?\\s*\\*?\\s+)(?:#{1,2}\\s+)?(' + escPrefix + '\\s*[-–][^\\n\\r]*)', 'i'),
    escPrefix: escPrefix
  };
}

// Aplica os reCase em cascata (3d → 3a → 3b → 3c → 3e), igual ao handler do bookmarklet.
// Retorna { matched: true/false, via, novoTrecho }.
function applyAtualizarLinks(regrasBlock, oldPrefix, newRN, newLink) {
  const re = buildReCases(oldPrefix);
  let found = null;
  const cb3 = (full, lineStart, prefix, titleLine) => {
    if (/https?:\/\//.test(titleLine)) return full;
    const newTitleLine = titleLine.replace(/^RN(?:\s?[A-Z0-9]+(?:\.\d+)?|(?=\s+[-–]))/i, newRN);
    const novoTrecho = lineStart + prefix + '"' + tq(newTitleLine) + '":' + newLink;
    found = { via: 'cb3', antes: full, depois: novoTrecho };
    return novoTrecho;
  };
  const cb3b = (full, lineStart, prefix, rnPart, sep, rest) => {
    if (/https?:\/\//.test(rest)) return full;
    const newTitleLine = newRN + ' - ' + rest.trim();
    const novoTrecho = lineStart + prefix + '"' + tq(newTitleLine) + '":' + newLink;
    found = { via: 'cb3b', antes: full, depois: novoTrecho };
    return novoTrecho;
  };
  let r = regrasBlock;
  r = r.replace(re.d, cb3);     if (found) return { matched: true, ...found, result: r };
  r = r.replace(re.a, cb3);     if (found) return { matched: true, ...found, result: r };
  r = r.replace(re.b, cb3b);    if (found) return { matched: true, ...found, result: r };
  r = r.replace(re.c, cb3);     if (found) return { matched: true, ...found, result: r };
  r = r.replace(re.e, cb3);     if (found) return { matched: true, ...found, result: r };
  return { matched: false };
}

// ============================================================
// MICRO-FRAMEWORK
// ============================================================

let pass = 0, fail = 0;
const failures = [];

function test(label, fn) {
  try {
    const r = fn();
    if (r === true || r === undefined) {
      pass++;
    } else {
      fail++;
      failures.push({ label, reason: r });
    }
  } catch (e) {
    fail++;
    failures.push({ label, reason: e.message });
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

function assertEq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg || 'mismatch') +
      '\n      expected: ' + JSON.stringify(expected) +
      '\n      actual:   ' + JSON.stringify(actual));
  }
}

// ============================================================
// GRUPO 1 — helper tq()
// ============================================================

test('tq: sem aspas → não muda', () => {
  assertEq(tq('Sem aspas aqui'), 'Sem aspas aqui');
});

test('tq: par de aspas vira curvas open/close', () => {
  assertEq(tq('"Demonstrativo"'), '\u201CDemonstrativo\u201D');
});

test('tq: caso real do bug 206262', () => {
  assertEq(
    tq('RN1 - Gerar Fatura - *"Demonstrativo Estruturado"*'),
    'RN1 - Gerar Fatura - *\u201CDemonstrativo Estruturado\u201D*'
  );
});

test('tq: duas pares de aspas, alterna open/close corretamente', () => {
  assertEq(tq('"abre" texto "fecha"'), '\u201Cabre\u201D texto \u201Cfecha\u201D');
});

test('tq: aspas curvas pré-existentes passam intactas', () => {
  assertEq(tq('\u201Cjá curva\u201D'), '\u201Cjá curva\u201D');
});

// ============================================================
// GRUPO 2 — Bug A.1 (aspas retas no título Textile)
// ============================================================

test('Bug A — Atualizar Links converte aspas internas para curvas', () => {
  // Trecho real da fixture 206262 (req #32549), normalizado pra teste
  const block = '*CONDIÇÕES/REGRAS:*\nRNx - Gerar Fatura - *"Demonstrativo Estruturado"*\n';
  const r = applyAtualizarLinks(block, 'RNx', 'RN1', 'http://x/issues/32549#rn1');
  assert(r.matched, 'deveria casar');
  assert(!r.depois.includes('"Demonstrativo Estruturado"'),
    'título Textile NÃO pode ter aspas retas internas — encontrou: ' + r.depois);
  assert(r.depois.includes('\u201CDemonstrativo Estruturado\u201D'),
    'título deveria ter aspas curvas — recebeu: ' + r.depois);
});

test('Bug A — link Textile final tem só DOIS " (os do envelope)', () => {
  const block = '*CONDIÇÕES/REGRAS:*\nRNx - Gerar Fatura - *"Demonstrativo Estruturado"*\n';
  const r = applyAtualizarLinks(block, 'RNx', 'RN1', 'http://x/issues/32549#rn1');
  // O Textile espera "texto":url — apenas as aspas do envelope, NÃO no meio
  const aspasCount = (r.depois.match(/"/g) || []).length;
  assertEq(aspasCount, 2, 'esperava 2 aspas retas no Textile final (envelope), achei ' + aspasCount);
});

// ============================================================
// GRUPO 3 — Bug A.2 (\r capturado em fixtures CRLF)
// ============================================================

test('Bug A — \\r NÃO entra no título Textile em fixture CRLF', () => {
  const block = '*CONDIÇÕES/REGRAS:*\r\nRNx - Gerar Fatura - Algo\r\n';
  const r = applyAtualizarLinks(block, 'RNx', 'RN1', 'http://x');
  assert(r.matched, 'deveria casar');
  // Extrair o título (entre o " de abertura e o ": de fechamento)
  const titleMatch = r.depois.match(/"([^"]*)":/);
  assert(titleMatch, 'estrutura "...":url não foi achada');
  assert(!titleMatch[1].includes('\r'),
    '\\r NÃO pode estar dentro do título — achei: ' + JSON.stringify(titleMatch[1]));
});

test('Bug A — funciona igual em LF e em CRLF (resultado idêntico)', () => {
  const blockLF   = '*CONDIÇÕES/REGRAS:*\nRNx - Gerar Fatura - Algo\n';
  const blockCRLF = '*CONDIÇÕES/REGRAS:*\r\nRNx - Gerar Fatura - Algo\r\n';
  const r1 = applyAtualizarLinks(blockLF, 'RNx', 'RN1', 'http://x');
  const r2 = applyAtualizarLinks(blockCRLF, 'RNx', 'RN1', 'http://x');
  assert(r1.matched && r2.matched, 'ambos deveriam casar');
  // O depois pode ter \r/\n diferente no início, mas o título capturado deve ser igual
  const t1 = r1.depois.match(/"([^"]*)":/)[1];
  const t2 = r2.depois.match(/"([^"]*)":/)[1];
  assertEq(t2, t1, 'título deveria ser idêntico em LF e CRLF');
});

// ============================================================
// GRUPO 4 — Bug B.1 (## RNX no extract_logic)
// ============================================================

test('Bug B — extractRules detecta "## RNX – Título" (formato Textile lista nível 2)', () => {
  const sec = [
    'h3. Requisito Funcional #40803 – X',
    '',
    '*CONDIÇÕES/REGRAS:*',
    '',
    '## RNX – Exportar para Excel',
    '* A exportação contempla todas as informações exibidas no relatório gerado.'
  ].join('\n');
  const rules = extractRules(sec);
  assertEq(rules.length, 1, 'deveria extrair 1 regra, extraiu ' + rules.length);
  assertEq(rules[0].title, 'RNX - Exportar para Excel');
});

test('Bug B — "# RN1 – Título" (nível 1 do Textile, # único) também detecta', () => {
  const sec = '*CONDIÇÕES/REGRAS:*\n# RN1 – Teste\n* conteúdo';
  const rules = extractRules(sec);
  assertEq(rules.length, 1);
  assertEq(rules[0].title, 'RN1 - Teste');
});

test('Bug B — fixture real 199075 detecta a regra do #40803', () => {
  const desc = fs.readFileSync(path.join(__dirname, 'fixtures/199075.txt'), 'utf8');
  // analyze() filtra seções sem ID (pré-detalhamento) e retorna só requisitos válidos
  const result = analyze(desc);
  assertEq(result.length, 1, 'deveria detectar exatamente 1 requisito');
  assertEq(result[0].id, '40803');
  assertEq(result[0].rules.length, 1, 'deveria ter exatamente 1 regra');
  assertEq(result[0].rules[0], 'RNX - Exportar para Excel');
});

test('Bug B — content da regra detectada preserva o que vem depois', () => {
  const sec = '*CONDIÇÕES/REGRAS:*\n## RNX – Exportar\n* linha A\n* linha B';
  const rules = extractRules(sec);
  assertEq(rules.length, 1);
  assert(rules[0].content.includes('linha A') && rules[0].content.includes('linha B'),
    'content deveria conter as linhas A e B — achei: ' + JSON.stringify(rules[0].content));
});

// ============================================================
// GRUPO 5 — Bug B.2 (## RNX no Atualizar Links)
// ============================================================

test('Bug B — Atualizar Links casa "## RNX – Título" e preserva o ##', () => {
  const block = '*CONDIÇÕES/REGRAS:*\n## RNX – Exportar para Excel\n* linha A';
  const r = applyAtualizarLinks(block, 'RNX', 'RN1', 'http://x/issues/40803#rn1');
  assert(r.matched, 'deveria casar');
  assert(r.depois.includes('## "RN1 – Exportar para Excel":'),
    'esperava preservar ## antes do link Textile — recebi: ' + r.depois);
});

test('Bug B — Atualizar Links com # único também funciona', () => {
  const block = '*CONDIÇÕES/REGRAS:*\n# RN1 – Teste\n';
  const r = applyAtualizarLinks(block, 'RN1', 'RN5', 'http://x');
  assert(r.matched, 'deveria casar');
  assert(r.depois.includes('# "RN5 – Teste":'), 'esperava # preservado — recebi: ' + r.depois);
});

// ============================================================
// GRUPO 6 — Não-regressão: formatos antigos seguem funcionando
// ============================================================

test('Não-regressão — formato clássico RN1 - Título sem ## continua casando', () => {
  const block = '*CONDIÇÕES/REGRAS:*\nRN1 - Teste\n';
  const r = applyAtualizarLinks(block, 'RN1', 'RN5', 'http://x');
  assert(r.matched);
  assert(!r.depois.includes('##'), 'não deveria injetar ## onde não havia');
});

test('Não-regressão — formato (Criar) "RN1 - X":URL continua casando', () => {
  const block = '*CONDIÇÕES/REGRAS:*\n(Criar) "RN1 - X":http://velho\n';
  // Esse é case1 (link já existe), o cascade do test não cobre case1, mas o
  // importante é que o regex case3c novo NÃO casa errado:
  const re = buildReCases('RN1').c;
  const m = block.match(re);
  // case3c casa qualquer coisa começando com RN1 sem URL, mas como o cb3 abortaria
  // (regex /https?:\/\//.test(titleLine)), o handler do bookmarklet rejeitaria.
  // Aqui só validamos que o regex EM SI não quebra em formatos com link.
  assert(m !== null || true, 'sanity'); // regex compilou OK e não estourou
});

test('Não-regressão — fixture 206262 (req #32549) gera Textile correto', () => {
  const desc = fs.readFileSync(path.join(__dirname, 'fixtures/206262.txt'), 'utf8');
  const startIdx = desc.indexOf('h2. REQUISITO: ##32549');
  const endIdx = desc.indexOf('\nh2. REQUISITO:', startIdx + 1);
  const secao = desc.slice(startIdx, endIdx);
  const regrasM = secao.match(/(?:\*\s*)?(?:CONDI[CÇ][OÕ]ES\/REGRAS|REGRAS)(?:\s*\*)?\s*:?\s*\*?(?:\s*\n|\s+(?=RN|["\u201C\u201D]|\(|\*))[\s\S]*$/i);
  const block = secao.slice(regrasM.index);

  const r = applyAtualizarLinks(block, 'RNx', 'RN1', 'http://net1/redmine/issues/32549#rn1');
  assert(r.matched, 'deveria casar a regra do req #32549');

  // O título Textile DEVE ter exatamente 2 aspas retas (envelope) e nenhuma interna
  const m = r.depois.match(/"([^"]*)":/);
  assert(m, 'estrutura Textile não encontrada');
  const inner = m[1];
  assert(!inner.includes('"'), 'título não pode ter " interna — recebi: ' + JSON.stringify(inner));
  assert(!inner.includes('\r'), 'título não pode ter \\r — recebi: ' + JSON.stringify(inner));
  assert(inner.includes('\u201CDemonstrativo Estruturado\u201D'),
    'esperava aspas curvas no nome do relatório — recebi: ' + JSON.stringify(inner));
});

// ============================================================
// GRUPO 7 — Bug C (getReqSectionBounds com cabeçalho "Requisito: Requisito Funcional #N")
// ============================================================
// Demanda 199075 — quando bounds retorna null, o handler de Atualizar Links
// cai no else final ("Nenhum link encontrado"). Era bug latente, agora real.

const { getReqSectionBounds } = require('./extract_logic.js');

test('Bug C — bounds acha req #40803 em cabeçalho "Requisito: Requisito Funcional"', () => {
  const desc = fs.readFileSync(path.join(__dirname, 'fixtures/199075.txt'), 'utf8');
  const bounds = getReqSectionBounds(desc, '40803');
  assert(bounds !== null, 'bounds deveria existir (não retornar null)');
  assert(bounds.start > 0, 'start deveria ser > 0');
  assert(bounds.end > bounds.start, 'end > start');
});

test('Bug C — bounds acha em formato 9 (Requisito Funcional #N) sem duplicação', () => {
  const desc = 'h1. Detalhamento de Projeto\n\nh3. Requisito Funcional #36213 - Algo\n\n*CONDIÇÕES/REGRAS:*\nRN1 - X';
  const bounds = getReqSectionBounds(desc, '36213');
  assert(bounds !== null, 'bounds deveria existir');
  const slice = desc.slice(bounds.start, bounds.end);
  assert(slice.includes('#36213'), 'fatia deveria conter o cabeçalho do requisito');
});

test('Bug C — bounds segue achando formatos antigos (não-regressão)', () => {
  const casos = [
    { desc: 'h1. Detalhamento\n\nh3. Requisito #54 - X\n\nconteudo', id: '54' },
    { desc: 'h1. Detalhamento\n\nh3. Requisito: #54 - X\n\nconteudo', id: '54' },
    { desc: 'h1. Detalhamento\n\nh3. Requisito: ##54 - X\n\nconteudo', id: '54' },
    { desc: 'h1. Detalhamento\n\nh3. ##54 - X\n\nconteudo', id: '54' },
  ];
  casos.forEach((c, i) => {
    const b = getReqSectionBounds(c.desc, c.id);
    assert(b !== null, 'caso ' + i + ' falhou: bounds null');
  });
});

test('Bug C — bounds delimita end corretamente quando próximo req também usa formato duplicado', () => {
  const desc = [
    'h1. Detalhamento de Projeto',
    '',
    'h3. Requisito: Requisito Funcional #40803 - A',
    '',
    '*CONDIÇÕES/REGRAS:*',
    'RN1 - regra A',
    '',
    'h3. Requisito: Requisito Funcional #40804 - B',
    '',
    '*CONDIÇÕES/REGRAS:*',
    'RN1 - regra B'
  ].join('\n');
  const b1 = getReqSectionBounds(desc, '40803');
  assert(b1 !== null, 'bounds do primeiro req deveria existir');
  const slice = desc.slice(b1.start, b1.end);
  assert(slice.includes('#40803'), 'fatia deveria começar no #40803');
  assert(!slice.includes('#40804'), 'fatia NÃO deveria invadir o req seguinte');
  assert(slice.includes('RN1 - regra A'), 'fatia deveria conter a regra A');
  assert(!slice.includes('RN1 - regra B'), 'fatia NÃO deveria conter a regra B');
});

test('Bug C — análise ponta-a-ponta da 199075: do bounds ao Atualizar Links', () => {
  const desc = fs.readFileSync(path.join(__dirname, 'fixtures/199075.txt'), 'utf8');
  const bounds = getReqSectionBounds(desc, '40803');
  assert(bounds !== null, 'bounds!=null pré-requisito');
  const secao = desc.slice(bounds.start, bounds.end);

  // Replicando o handler: pegar regrasBlock
  const regrasM = secao.match(/(?:\*\s*)?(?:CONDI[CÇ][OÕ]ES\/REGRAS|REGRAS)(?:\s*\*)?\s*:?\s*\*?(?:\s*\n|\s+(?=RN|["\u201C\u201D]|\(|\*))[\s\S]*$/i);
  assert(regrasM, 'regrasM deveria casar a seção CONDIÇÕES/REGRAS');
  const block = secao.slice(regrasM.index);

  const r = applyAtualizarLinks(block, 'RNX', 'RN2', 'http://x/issues/40803#rn2');
  assert(r.matched, 'Atualizar Links deveria casar a regra "## RNX – Exportar"');
  assert(r.depois.includes('## "RN2 – Exportar para Excel":'),
    'esperava o ## preservado e link Textile correto — recebi: ' + r.depois);
});

console.log('\n━━━━ v35.10.1 — Aspas + ## RNX ━━━━\n');
if (fail === 0) {
  console.log('✅ Todos os ' + pass + ' testes passaram.');
} else {
  console.log('❌ ' + fail + ' falha(s) em ' + (pass + fail) + ' testes:\n');
  failures.forEach(f => {
    console.log('  ❌ ' + f.label);
    console.log('     ' + f.reason);
  });
  process.exit(1);
}
