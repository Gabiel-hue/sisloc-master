// Testes da v35.12 — substituir RN existente com merge histórico.
// Suite auto-contida: importa helpers do espelho merge_logic.js e roda em Node.

const M = require('./merge_logic.js');

let pass = 0, fail = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) { pass++; }
  else { fail++; failures.push(msg); }
}
function assertEq(a, b, msg) {
  assert(a === b, msg + ' (esperado: ' + JSON.stringify(b) + ', obtido: ' + JSON.stringify(a) + ')');
}
function assertContains(s, sub, msg) {
  assert(s != null && s.indexOf(sub) !== -1, msg + ' (texto não contém: ' + JSON.stringify(sub) + ')');
}
function assertNotContains(s, sub, msg) {
  assert(s != null && s.indexOf(sub) === -1, msg + ' (texto deveria NÃO conter: ' + JSON.stringify(sub) + ')');
}

console.log('━━━ Grupo A: titleSimilarity ━━━');
{
  // Idêntico
  assert(M.titleSimilarity('Contabilização faturamento NF Serviço', 'Contabilização faturamento NF Serviço') === 1, 'A.1 idêntico = 1');
  // Próximo (mesma família de palavras, ordem diferente)
  assert(M.titleSimilarity('Contabilização faturamento NF Serviço', 'Contabilização faturamento serviço NF') >= 0.9, 'A.2 ordem diferente sim alta');
  // Parcial — "Contabilização faturamento NF" vs "Contabilização venda" tem palavra em comum
  assert(M.titleSimilarity('Contabilização faturamento', 'Contabilização venda') > 0 && M.titleSimilarity('Contabilização faturamento', 'Contabilização venda') < 1, 'A.3 parcial');
  // Sem palavras em comum
  assertEq(M.titleSimilarity('Foo bar baz', 'Hello world test'), 0, 'A.4 zero');
  // Stop-word só (palavras curtas) — devem ser filtradas → 0
  assertEq(M.titleSimilarity('a b c', 'd e f'), 0, 'A.5 palavras curtas filtradas');
  // Vazio
  assertEq(M.titleSimilarity('', 'foo bar'), 0, 'A.6 vazio');
}

console.log('━━━ Grupo B: getAllRules ━━━');
{
  // Caso simples
  const reqSimples = [
    'h2. REGRAS DE NEGÓCIO',
    '',
    'h3. RN1 - Primeira regra',
    '(#100)',
    'corpo da rn1',
    '',
    'h3. RN2 - Segunda regra',
    '(#101)',
    'corpo da rn2',
    '',
    'h3. RN3 - Terceira',
    '(#102)',
    'corpo da rn3'
  ].join('\n');
  const rules = M.getAllRules(reqSimples);
  assertEq(rules.length, 3, 'B.1 3 regras');
  assertEq(rules[0].rn, 'RN1', 'B.2 RN1');
  assertEq(rules[0].title, 'Primeira regra', 'B.3 título RN1');
  assertEq(rules[1].rn, 'RN2', 'B.4 RN2');
  assertEq(rules[2].rn, 'RN3', 'B.5 RN3');
  
  // Caso sem h3.
  const reqSemH3 = [
    'h2. REGRAS DE NEGÓCIO',
    'RN10 - Sem h3 no header',
    '(#200)',
    'corpo',
    'RN11 - Outra',
    '(#201)',
    'corpo'
  ].join('\n');
  const rules2 = M.getAllRules(reqSemH3);
  assertEq(rules2.length, 2, 'B.6 2 regras sem h3.');
  assertEq(rules2[0].rn, 'RN10', 'B.7 RN10');
  
  // Caso com RN sem título
  const reqSemTitulo = [
    'h2. REGRAS DE NEGÓCIO',
    'h3. RN5 - Tem título',
    '(#300)',
    'corpo',
    '',
    'h3. RN6',
    '(#301)',
    'corpo sem título no header'
  ].join('\n');
  const rules3 = M.getAllRules(reqSemTitulo);
  assertEq(rules3.length, 2, 'B.8 inclui RN sem título');
  assertEq(rules3[1].rn, 'RN6', 'B.9 RN6 detectada');
  assertEq(rules3[1].hasTitle, false, 'B.10 hasTitle=false');
  
  // Não pega RNs dentro do CHANGELOG
  const reqComCh = [
    'h3. RN1 - Ativa',
    '(#100)',
    'corpo',
    '',
    'h1. CHANGELOG',
    '',
    'Demanda: #50',
    'RN1 - Aparece em log antigo, não conta'
  ].join('\n');
  const rules4 = M.getAllRules(reqComCh);
  assertEq(rules4.length, 1, 'B.11 ignora CHANGELOG');
  
  // Bloco com versão antiga riscada — só conta a RN uma vez
  const reqComHistorico = [
    'h3. RN85 - Contabilização',
    '(#143910)',
    'corpo novo',
    '',
    '-(#137134)-',
    '-corpo antigo riscado-'
  ].join('\n');
  const rules5 = M.getAllRules(reqComHistorico);
  assertEq(rules5.length, 1, 'B.12 RN com histórico não duplica');
  assertEq(rules5[0].rn, 'RN85', 'B.13 RN85');
}

console.log('━━━ Grupo C: findBestMatch ━━━');
{
  const existing = [
    { rn: 'RN1', n: 1, title: 'Contabilização faturamento NF Serviço', hasTitle: true },
    { rn: 'RN2', n: 2, title: 'Cálculo de imposto', hasTitle: true },
    { rn: 'RN3', n: 3, title: 'Geração de boletos', hasTitle: true }
  ];
  // Match alto (≥0.8) com RN1
  const m1 = M.findBestMatch('Contabilização faturamento NF Serviço — ajuste', existing);
  assert(m1 !== null, 'C.1 acha match alto');
  assertEq(m1.rn, 'RN1', 'C.2 retorna RN1');
  // Sem match (similarity baixa)
  const m2 = M.findBestMatch('Tela de impressão de etiqueta', existing);
  assertEq(m2, null, 'C.3 nenhum match');
  // Threshold customizado
  const m3 = M.findBestMatch('Cálculo imposto', existing, 0.5);
  assert(m3 !== null && m3.rn === 'RN2', 'C.4 threshold mais baixo acha');
  // RN sem título não é candidata
  const existing2 = [
    { rn: 'RN10', n: 10, title: null, hasTitle: false },
    { rn: 'RN11', n: 11, title: 'Lançamento contábil de venda', hasTitle: true }
  ];
  const m4 = M.findBestMatch('Lançamento contábil de venda', existing2);
  assert(m4 !== null && m4.rn === 'RN11', 'C.5 ignora RN sem título');
}

console.log('━━━ Grupo D: getRuleBlockBounds ━━━');
{
  const req = [
    'h2. REGRAS DE NEGÓCIO',
    '',
    'h3. RN1 - Primeira',
    '(#100)',
    'corpo 1',
    '',
    'h3. RN2 - Segunda',
    '(#101)',
    'corpo 2',
    'mais corpo 2',
    '',
    'h3. RN3 - Terceira',
    '(#102)',
    'corpo 3',
    '',
    '---'
  ].join('\n');
  
  const b1 = M.getRuleBlockBounds(req, 'RN2');
  assert(b1 !== null, 'D.1 acha RN2');
  const block1 = req.slice(b1.start, b1.end);
  assertContains(block1, 'h3. RN2 - Segunda', 'D.2 começa no header da RN2');
  assertContains(block1, 'corpo 2', 'D.3 inclui corpo');
  assertContains(block1, 'mais corpo 2', 'D.4 inclui linhas seguintes');
  assertNotContains(block1, 'h3. RN3', 'D.5 não inclui RN3');
  
  // Última RN — vai até o ---
  const b2 = M.getRuleBlockBounds(req, 'RN3');
  assert(b2 !== null, 'D.6 acha RN3');
  const block2 = req.slice(b2.start, b2.end);
  assertContains(block2, 'corpo 3', 'D.7 inclui corpo');
  assertNotContains(block2, '---', 'D.8 não inclui ---');
  
  // RN inexistente
  const b3 = M.getRuleBlockBounds(req, 'RN99');
  assertEq(b3, null, 'D.9 RN inexistente retorna null');
  
  // RN85 puro sem h3.
  const reqPuro = [
    'RN84',
    '(#999)',
    'corpo',
    'RN85 - Tem título',
    '(#100)',
    'novo'
  ].join('\n');
  const b4 = M.getRuleBlockBounds(reqPuro, 'RN84');
  assert(b4 !== null, 'D.10 acha RN84 sem h3.');
  const block4 = reqPuro.slice(b4.start, b4.end);
  assertContains(block4, 'RN84', 'D.11 header RN84');
  assertContains(block4, '(#999)', 'D.12 corpo');
  assertNotContains(block4, 'RN85', 'D.13 para na RN85');
}

console.log('━━━ Grupo E: parseRuleBlock ━━━');
{
  // Bloco simples sem versão antiga
  const block1 = [
    'h3. RN85 - Contabilização',
    '',
    '(#100)',
    'corpo da regra',
    'segunda linha'
  ].join('\n');
  const p1 = M.parseRuleBlock(block1, 'RN85');
  assert(p1 !== null, 'E.1 parseia bloco simples');
  assertEq(p1.headerTitle, 'Contabilização', 'E.2 título');
  assertContains(p1.bodyAtivo, '(#100)', 'E.3 body com dId');
  assertContains(p1.bodyAtivo, 'corpo da regra', 'E.4 body com corpo');
  assertEq(p1.oldVersions, '', 'E.5 sem versões antigas');
  assertEq(p1.hasTitle, true, 'E.6 hasTitle');
  
  // Bloco com versão antiga riscada
  const block2 = [
    'h3. RN85 - Contabilização',
    '',
    '(#143910)',
    'Versão atual',
    '',
    '-(#137134)-',
    '-Versão antiga riscada-',
    '-bullet riscado-'
  ].join('\n');
  const p2 = M.parseRuleBlock(block2, 'RN85');
  assertContains(p2.bodyAtivo, '(#143910)', 'E.7 body com atual');
  assertContains(p2.bodyAtivo, 'Versão atual', 'E.8 corpo atual');
  assertNotContains(p2.bodyAtivo, '(#137134)', 'E.9 versão antiga NÃO no body');
  assertContains(p2.oldVersions, '-(#137134)-', 'E.10 oldVersions com risco');
  
  // Bloco sem título no header (só RN85)
  const block3 = [
    'h3. RN85',
    '',
    '(#100)',
    'corpo sem título'
  ].join('\n');
  const p3 = M.parseRuleBlock(block3, 'RN85');
  assertEq(p3.hasTitle, false, 'E.11 sem título');
  assertEq(p3.headerTitle, null, 'E.12 título null');
  assertContains(p3.bodyAtivo, 'corpo sem título', 'E.13 body OK');
  
  // Bloco sem h3.
  const block4 = [
    'RN84',
    '',
    '(#999)',
    'corpo'
  ].join('\n');
  const p4 = M.parseRuleBlock(block4, 'RN84');
  assert(p4 !== null, 'E.14 parseia sem h3.');
  assertEq(p4.headerLine, 'RN84', 'E.15 header sem h3');
}

console.log('━━━ Grupo F: riscarLinhasTextile ━━━');
{
  assertEq(M.riscarLinhasTextile('Linha única'), '-Linha única-', 'F.1 linha única');
  assertEq(M.riscarLinhasTextile('linha 1\nlinha 2'), '-linha 1-\n-linha 2-', 'F.2 duas linhas');
  // Linhas vazias preservadas
  assertEq(M.riscarLinhasTextile('a\n\nb'), '-a-\n\n-b-', 'F.3 linha vazia entre');
  // Indentação preservada
  assertEq(M.riscarLinhasTextile('  indentada'), '  -indentada-', 'F.4 indentação');
  // Já riscada não duplica
  assertEq(M.riscarLinhasTextile('-já riscada-'), '-já riscada-', 'F.5 idempotente');
  // String vazia
  assertEq(M.riscarLinhasTextile(''), '', 'F.6 vazio');
  // Bullet
  assertEq(M.riscarLinhasTextile('• Item de lista'), '-• Item de lista-', 'F.7 bullet');
}

console.log('━━━ Grupo G: mergeReplacingRule — caso real RN85 ━━━');
{
  // Cenário: requisito que tem RN85 com versão atual #143910 e versão antiga #137134 já riscada
  // (igual ao print que o usuário mandou). Nova demanda #200000 traz versão atualizada.
  const reqAtual = [
    'h1. REGRAS DE NEGÓCIO',
    '',
    'h3. RN84 - Outra regra',
    '(#117864)',
    'corpo da rn84',
    '',
    'h3. RN85 - Contabilização faturamento',
    '',
    '(#143910)',
    'Na emissão da NF de faturamento de locação/serviços, o lançamento contábil deve ter:',
    '• Caso o parâmetro marcado como "Sim", busca no centro de resultado.',
    '• Caso o parâmetro marcado como "Não", busca no Grupo contábil.',
    '',
    '-(#137134)-',
    '-Na emissão da nota fiscal de faturamento de locação, o lançamento contábil...-',
    '',
    'h3. RN86 - Outra regra',
    '(#100)',
    'corpo rn86',
    '',
    '---'
  ].join('\n');
  
  const novaDs = M.mergeReplacingRule(
    reqAtual,
    'RN85',
    'Contabilização faturamento NF Serviço atualizado',
    'Quando o módulo de movimentações contábeis estiver habilitado, o lançamento contábil deve seguir nova regra:\n• Item A novo\n• Item B novo',
    '200000'
  );
  
  assert(novaDs !== null, 'G.1 merge não retornou null');
  
  // Versão nova no topo, com novo título e (#200000)
  assertContains(novaDs, 'h3. RN85 - Contabilização faturamento NF Serviço atualizado', 'G.2 novo header com novo título');
  assertContains(novaDs, '(#200000)', 'G.3 dId nova versão');
  assertContains(novaDs, 'Quando o módulo de movimentações contábeis', 'G.4 corpo nova versão');
  
  // Versão atual (#143910) deve estar riscada agora
  assertContains(novaDs, '-(#143910)-', 'G.5 #143910 riscada');
  assertContains(novaDs, '-Na emissão da NF de faturamento de locação/serviços, o lançamento contábil deve ter:-', 'G.6 corpo da atual riscado');
  assertContains(novaDs, '-• Caso o parâmetro marcado como "Sim", busca no centro de resultado.-', 'G.7 bullet riscado');
  
  // Versão #137134 que já estava riscada deve continuar lá
  assertContains(novaDs, '-(#137134)-', 'G.8 #137134 preservada');
  assertContains(novaDs, '-Na emissão da nota fiscal de faturamento de locação, o lançamento contábil...-', 'G.9 corpo #137134 preservado');
  
  // RN84 e RN86 não devem ser tocadas
  assertContains(novaDs, 'h3. RN84 - Outra regra', 'G.10 RN84 intacta');
  assertContains(novaDs, '(#117864)', 'G.11 corpo RN84 intacto');
  assertContains(novaDs, 'h3. RN86 - Outra regra', 'G.12 RN86 intacta');
  
  // Ordem: nova no topo, atual riscada no meio, antiga riscada no fim
  const idxNova = novaDs.indexOf('(#200000)');
  const idx143910 = novaDs.indexOf('-(#143910)-');
  const idx137134 = novaDs.indexOf('-(#137134)-');
  assert(idxNova < idx143910, 'G.13 nova antes da 143910');
  assert(idx143910 < idx137134, 'G.14 143910 antes da 137134');
}

console.log('━━━ Grupo H: mergeReplacingRule — sem versão antiga prévia ━━━');
{
  // RN sem histórico — primeira substituição
  const reqAtual = [
    'h3. RN10 - Regra original',
    '(#500)',
    'corpo original',
    '',
    'h3. RN11 - Outra',
    '(#501)',
    'corpo'
  ].join('\n');
  
  const novaDs = M.mergeReplacingRule(reqAtual, 'RN10', 'Regra ajustada', 'corpo novo da regra', '700');
  
  assert(novaDs !== null, 'H.1 merge ok');
  assertContains(novaDs, 'h3. RN10 - Regra ajustada', 'H.2 título novo');
  assertContains(novaDs, '(#700)', 'H.3 dId nova');
  assertContains(novaDs, 'corpo novo da regra', 'H.4 corpo novo');
  assertContains(novaDs, '-(#500)-', 'H.5 dId antiga riscada');
  assertContains(novaDs, '-corpo original-', 'H.6 corpo antigo riscado');
  assertContains(novaDs, 'h3. RN11 - Outra', 'H.7 RN11 intacta');
  // RN10 antigo NÃO deve mais existir como header ativo
  const rn10ActiveCount = (novaDs.match(/(?:^|\n)\s*(?:h3\.\s*)?RN10\s*[-–]\s*Regra original/g) || []).length;
  assertEq(rn10ActiveCount, 0, 'H.8 título antigo removido');
}

console.log('━━━ Grupo I: mergeReplacingRule — RN antiga sem título ━━━');
{
  // RN sem título no header — usa o título novo (upgrade)
  const reqAtual = [
    'h3. RN5',
    '(#100)',
    'corpo apenas, sem título no header',
    '',
    'h3. RN6 - Outra'
  ].join('\n');
  
  const novaDs = M.mergeReplacingRule(reqAtual, 'RN5', 'Título inferido novo', 'corpo novo', '999');
  assertContains(novaDs, 'h3. RN5 - Título inferido novo', 'I.1 upgrade pra com título');
  assertContains(novaDs, '(#999)', 'I.2 dId nova');
  assertContains(novaDs, '-(#100)-', 'I.3 dId antiga riscada');
  assertContains(novaDs, '-corpo apenas, sem título no header-', 'I.4 corpo antigo riscado');
}

console.log('━━━ Grupo J: mergeReplacingRule — RN não encontrada ━━━');
{
  const req = 'h3. RN1 - Algo\n(#100)\ncorpo';
  const r = M.mergeReplacingRule(req, 'RN99', 'Título', 'corpo', '500');
  assertEq(r, null, 'J.1 retorna null se RN inexistente');
}

console.log('━━━ Grupo K: getAllRules + findBestMatch integrados ━━━');
{
  const req = [
    'h2. REGRAS DE NEGÓCIO',
    '',
    'h3. RN80 - Geração de relatório de vendas mensal',
    '(#100)',
    'corpo',
    '',
    'h3. RN85 - Contabilização faturamento de Nota Fiscal Serviço',
    '(#143910)',
    'corpo',
    '',
    'h3. RN90 - Importação de clientes via API',
    '(#200)',
    'corpo'
  ].join('\n');
  
  const all = M.getAllRules(req);
  assertEq(all.length, 3, 'K.1 três regras');
  
  // Match alto deve achar RN85 (título "limpo", sem suplementos)
  const match = M.findBestMatch('Contabilização faturamento NF Serviço', all);
  assert(match !== null, 'K.2 match achado');
  assertEq(match.rn, 'RN85', 'K.3 match RN85');
  assert(match.sim >= 0.8, 'K.4 sim >= 0.8');
  
  // Match baixo não deve achar
  const semMatch = M.findBestMatch('Cadastro de fornecedor estrangeiro', all);
  assertEq(semMatch, null, 'K.5 sem match');
  
  // K.6 — Documenta comportamento: título com sufixo grande NÃO dispara (threshold 0.8 conservador)
  // Esse caso o usuário precisa marcar manualmente no dropdown
  const matchSufixoGrande = M.findBestMatch('Contabilização faturamento NF Serviço — ajuste tributário 2026 regional', all);
  assertEq(matchSufixoGrande, null, 'K.6 sufixo grande NÃO dispara dica (precisa marcar manualmente)');
}

console.log('━━━ Grupo L: edge case — substituir RN85 mantendo título antigo ━━━');
{
  // Cenário: usuário NÃO editou o título. Passa string vazia.
  // O bookmarklet deve usar o título antigo do header (que estava lá).
  const req = [
    'h3. RN85 - Título original que fica',
    '(#100)',
    'corpo original'
  ].join('\n');
  
  const novaDs = M.mergeReplacingRule(req, 'RN85', '', 'corpo novo', '300');
  // Como passou título vazio, mantém o original
  assertContains(novaDs, 'h3. RN85 - Título original que fica', 'L.1 título antigo preservado se novo vazio');
  assertContains(novaDs, '(#300)', 'L.2 nova versão');
  assertContains(novaDs, '-(#100)-', 'L.3 antiga riscada');
}

console.log('━━━ Grupo M: bloco da RN final do arquivo ━━━');
{
  // RN no fim do arquivo (sem próxima seção)
  const req = [
    'h3. RN1 - Primeira',
    '(#100)',
    'corpo 1',
    '',
    'h3. RN2 - Última',
    '(#101)',
    'corpo 2'
  ].join('\n');
  
  const novaDs = M.mergeReplacingRule(req, 'RN2', 'Última ajustada', 'corpo novo', '500');
  assertContains(novaDs, 'h3. RN2 - Última ajustada', 'M.1 header novo');
  assertContains(novaDs, '-corpo 2-', 'M.2 corpo antigo riscado');
  assertContains(novaDs, 'h3. RN1 - Primeira', 'M.3 RN1 intacta');
}

console.log('━━━ Grupo N: insertWithSpacing (v35.12.1) ━━━');
{
  // Caso reportado pelo user: RN nova ficou colada na RN anterior sem linha em branco
  const baseReal = [
    'h3. RN7 - Envio de BM´s com mesmo cliente e contato',
    '',
    '(#174180)',
    'Quando dois ou mais BMs ...',
    '',
    'Cada número de ficha ... anexados.'
  ].join('\n');
  const rTxt = 'h3. RN8 - Nome do arquivo pdf\n\n(#208596)\nO nome gerado ...';
  const r1 = M.insertWithSpacing(baseReal, baseReal.length, rTxt);
  assert(r1.endsWith('\n'), 'N.1 termina com newline');
  assertContains(r1, 'anexados.\n\nh3. RN8', 'N.2 1 linha em branco antes da RN nova');
  assertNotContains(r1, 'anexados.\n\n\nh3. RN8', 'N.3 NÃO tem 2+ linhas em branco antes');
  assertNotContains(r1, 'anexados.\nh3. RN8', 'N.4 NÃO está colado (caso reportado)');

  // (a) já tem 1 linha em branco antes e depois → não muda
  const r2 = M.insertWithSpacing('AAA\n\nBBB', 5, 'NEW');
  assertEq(r2, 'AAA\n\nNEW\n\nBBB', 'N.5 já tinha 1 linha em branco → mantém');

  // (b) sem newlines, posição no meio → adiciona \n\n nos dois lados
  const r3 = M.insertWithSpacing('AAABBB', 3, 'NEW');
  assertEq(r3, 'AAA\n\nNEW\n\nBBB', 'N.6 sem newlines → adiciona \\n\\n nos 2 lados');

  // (c) só 1 \n antes, sem \n depois → completa pra ter 2 antes e 2 depois
  const r4 = M.insertWithSpacing('AAA\nBBB', 4, 'NEW');
  assertEq(r4, 'AAA\n\nNEW\n\nBBB', 'N.7 só 1 \\n antes → completa pra 2');

  // (d) já tem 3 \n antes → não adiciona mais nem força reducao
  const r5 = M.insertWithSpacing('AAA\n\n\nBBB', 6, 'NEW');
  assertEq(r5, 'AAA\n\n\nNEW\n\nBBB', 'N.8 3 \\n antes → não adiciona mais');

  // (e) inserção no início (pos 0) — antes vazio
  const r6 = M.insertWithSpacing('BBB', 0, 'NEW');
  assertEq(r6, '\n\nNEW\n\nBBB', 'N.9 pos 0 → adiciona \\n\\n antes');

  // (f) inserção em string vazia
  const r7 = M.insertWithSpacing('', 0, 'NEW');
  assertEq(r7, '\n\nNEW\n', 'N.10 string vazia → \\n\\n antes + 1 \\n no fim');

  // (g) conteúdo vazio → não muda
  const r8 = M.insertWithSpacing('AAA', 0, '');
  assertEq(r8, 'AAA', 'N.11 content vazio → não muda');
  const r9 = M.insertWithSpacing('AAA', 0, null);
  assertEq(r9, 'AAA', 'N.12 content null → não muda');
}

console.log('━━━ Grupo O: getRuleBlockBounds preserva \\n antes do bloco (v35.12.2) ━━━');
{
  // Bug reportado pelo user (req #46006 / #208596 com 2 gravações): após substituir RN8,
  // a regra acima ficou colada na nova h3. RN8 sem linha em branco. Causa: \s* greedy no grupo
  // consumia o \n da linha em branco anterior. Fix: usar [ \t]* (sem newlines).
  
  // Caso reproduzível: req com linha em branco antes da RN a ser substituída
  const req = [
    'h3. RN7 - Outra regra',
    '(#100)',
    'corpo da rn7',
    '',  // linha em branco antes da RN8
    'h3. RN8 - Regra a substituir',
    '(#200)',
    'corpo da rn8',
    '',  // linha em branco depois do bloco da RN8
    'h2. Próxima seção'
  ].join('\n');
  
  const b = M.getRuleBlockBounds(req, 'RN8');
  assert(b !== null, 'O.1 acha RN8');
  
  // O bounds.start deve apontar pro `h` do `h3. RN8`, preservando o \n\n anterior
  const slicePre = req.slice(0, b.start);
  assert(slicePre.endsWith('\n\n'), 'O.2 slice pré-bloco termina com \\n\\n (linha em branco preservada)');
  assertEq(req[b.start], 'h', 'O.3 bounds.start aponta pro h do h3.');
  
  // O bloco em si deve começar com `h3.`, não com `\n`
  const block = req.slice(b.start, b.end);
  assert(block.startsWith('h3. RN8'), 'O.4 bloco começa com h3. RN8');
  
  // Após mergeReplacingRule, o \n\n antes do header deve persistir
  const merged = M.mergeReplacingRule(req, 'RN8', 'Nova regra', 'corpo novo', '999');
  assertContains(merged, 'corpo da rn7\n\nh3. RN8 - Nova regra', 'O.5 merge preserva \\n\\n antes do header (caso reportado)');
  assertNotContains(merged, 'corpo da rn7\nh3. RN8', 'O.6 merge NÃO cola a regra anterior no novo header');
  
  // Caso EXATO do user: 2 gravações na sequência (criar nova → substituir mesma RN)
  // Em uma gravação só já cobre, mas testar a sequência por completude
  const req2 = [
    'h3. RN7 - Outra regra',
    '(#100)',
    'corpo da rn7',
    '',
    'h3. RN8 - Primeira versão',
    '',
    '(#200)',
    'corpo primeira versão',
    '',
    'h2. Próxima seção'
  ].join('\n');
  
  const merged2 = M.mergeReplacingRule(req2, 'RN8', 'Segunda versão', 'corpo segunda versão', '300');
  assertContains(merged2, 'corpo da rn7\n\nh3. RN8', 'O.7 segunda gravação (substituir) preserva \\n\\n antes');
  assertContains(merged2, '(#300)', 'O.8 nova versão tem novo dId');
  assertContains(merged2, '-(#200)-', 'O.9 versão anterior riscada');
}

console.log('━━━ Grupo P: mergeReplacingRule ADICIONA \\n quando bloco anterior estava colado (caso real #46006) ━━━');
{
  // Caso EXATO reportado: req tem regra anterior COLADA no bloco da RN a substituir
  // (sem linha em branco entre elas, herança de gravação anterior buguada).
  // Após merge, deve aparecer 1 linha em branco entre.
  const reqColado = [
    'h3. RN7 - Envio de BMs com mesmo cliente',
    '(#174180)',
    'Quando dois ou mais BMs...',
    'Cada número de ficha... anexados.',
    'h3. RN8 - Nome do arquivo pdf',  // COLADO sem linha em branco
    '(#208596)',
    'O nome gerado para o pdf...',
    'h2. Nome do Processo'  // COLADO no fim do bloco da RN8 também
  ].join('\n');
  const merged = M.mergeReplacingRule(reqColado, 'RN8', 'Nome do arquivo pdf', 'O nome gerado para o pdf atualizado', '300000');
  
  // 1 linha em branco antes do novo h3. RN8
  assertContains(merged, 'anexados.\n\nh3. RN8', 'P.1 ADICIONA \\n\\n antes do header da RN substituída');
  assertNotContains(merged, 'anexados.\nh3. RN8', 'P.2 NÃO deixa colado (bug do user)');
  
  // 1 linha em branco depois do bloco da RN8 (antes de h2.)
  // Os blocos podem ter "(#dId)-" ou conteúdo no final — checar pelo último componente do bloco antes do h2.
  // Pra ser flexível, conferir que tem \n\n antes do h2.
  const idxH2 = merged.indexOf('h2. Nome do Processo');
  const sliceBeforeH2 = merged.slice(Math.max(0, idxH2 - 5), idxH2);
  assert(sliceBeforeH2.endsWith('\n\n'), 'P.3 \\n\\n antes do h2. seguinte (esperado: termina com \\n\\n, obtido: ' + JSON.stringify(sliceBeforeH2) + ')');
  
  // Conteúdo do bloco merged está correto
  assertContains(merged, '(#300000)', 'P.4 nova versão tem novo dId');
  assertContains(merged, '-(#208596)-', 'P.5 versão anterior riscada');
  assertContains(merged, '-O nome gerado para o pdf...-', 'P.6 corpo anterior riscado');
  
  // RN7 não foi tocada
  assertContains(merged, 'h3. RN7 - Envio de BMs com mesmo cliente', 'P.7 RN7 intacta');
  
  // Caso de borda: regra a substituir está colada com h1. CHANGELOG no fim (fim das regras)
  const reqBordaFim = [
    'h3. RN1 - Regra 1',
    '(#100)',
    'corpo 1',
    'h3. RN2 - Regra a substituir',  // colada na RN1
    '(#200)',
    'corpo 2',
    'h1. CHANGELOG'  // colada no fim do bloco da RN2
  ].join('\n');
  const merged2 = M.mergeReplacingRule(reqBordaFim, 'RN2', 'Regra 2 ajustada', 'corpo novo', '500');
  assertContains(merged2, 'corpo 1\n\nh3. RN2', 'P.8 ADICIONA \\n\\n antes (caso de borda)');
  const idxCh = merged2.indexOf('h1. CHANGELOG');
  const sliceBeforeCh = merged2.slice(Math.max(0, idxCh - 5), idxCh);
  assert(sliceBeforeCh.endsWith('\n\n'), 'P.9 \\n\\n antes do h1. CHANGELOG (esperado terminar com \\n\\n, obtido: ' + JSON.stringify(sliceBeforeCh) + ')');
  
  // Caso de borda: RN é a ÚLTIMA seção do arquivo (sem depois)
  const reqFimArq = [
    'h3. RN1 - Regra 1',
    '(#100)',
    'corpo 1',
    'h3. RN2 - Última'  // colada e é a última
  ].join('\n');
  const merged3 = M.mergeReplacingRule(reqFimArq, 'RN2', 'Última ajustada', 'corpo novo', '500');
  assertContains(merged3, 'corpo 1\n\nh3. RN2', 'P.10 ADICIONA \\n\\n antes mesmo na última do arquivo');
  assert(merged3.endsWith('\n'), 'P.11 termina com \\n no fim do arquivo (não \\n\\n excessivo)');
}

console.log('━━━ Grupo Q: riscarLinhasTextile trim do final (v35.12.3 — caso real #46006 linha 2 não riscou) ━━━');
{
  // Caso reportado pelo user: linha terminando com espaço (`. `) ficava `-...vinculados. -`
  // — o espaço antes do `-` final invalida o strikethrough do Textile.
  // E pior, desbalanceia a sequência multi-linha derrubando outras linhas próximas.
  const linha1 = 'Quando dois ou mais BMs ... vinculados. ';
  const linha2 = 'Cada número de ficha ... anexados.';
  const r1 = M.riscarLinhasTextile(linha1);
  assertEq(r1, '-Quando dois ou mais BMs ... vinculados.-', 'Q.1 espaço final removido antes do -');
  assertNotContains(r1, '. -', 'Q.2 NÃO termina com ". -" (bug do Textile)');
  
  // Caso multi-linha como o reportado
  const multi = linha1 + '\n' + linha2;
  const rMulti = M.riscarLinhasTextile(multi);
  assertEq(rMulti, '-Quando dois ou mais BMs ... vinculados.-\n-Cada número de ficha ... anexados.-', 'Q.3 multi-linha sem espaço antes do -');
  
  // Tab e CR no fim também
  assertEq(M.riscarLinhasTextile('texto com tab\t'), '-texto com tab-', 'Q.4 trim tab final');
  assertEq(M.riscarLinhasTextile('texto com cr\r'), '-texto com cr-', 'Q.5 trim CR final');
  assertEq(M.riscarLinhasTextile('múltiplos espaços   '), '-múltiplos espaços-', 'Q.6 trim múltiplos espaços');
  
  // Indentação inicial preservada, trailing trimado
  assertEq(M.riscarLinhasTextile('  texto indentado  '), '  -texto indentado-', 'Q.7 indent preservado, trailing trimado');
  
  // Linha com SÓ whitespace: vira vazia (não cria "--" sozinho)
  assertEq(M.riscarLinhasTextile('   '), '', 'Q.8 linha só com whitespace → vazia');
  
  // Texto curto sem espaço final continua igual
  assertEq(M.riscarLinhasTextile('texto.'), '-texto.-', 'Q.9 texto sem espaço final continua igual');
  
  // Idempotência (linha já riscada com -...-)
  assertEq(M.riscarLinhasTextile('-já riscado-'), '-já riscado-', 'Q.10 idempotente');
}

console.log('━━━ Grupo R: mergeReplacingRule com corpo real do #46006 (linhas com espaço final) ━━━');
{
  // Reproduzir o caso EXATO do user: RN7 com linha terminando em espaço
  const reqAtual = [
    'h3. RN6 - Outra',
    '(#100)',
    'corpo rn6',
    '',
    'h3. RN7 - Envio de BMs com mesmo cliente e contato',
    '(#174180)',
    'Quando dois ou mais BMs de diferentes fichas, porém com o mesmo cliente e contato, forem enviados simultaneamente, no corpo do e-mail deverão ser exibidos os números de todas as fichas ([FICHA]) referentes aos BMs vinculados. ',
    'Cada número de ficha e suas informações ( [ENDERECO_ENTREGA], [PERIODO_FAT] e [DATA_BASE] ) devem ser exibidos em parágrafos distintos no corpo do email, seguindo a ordem dos arquivos de BM anexados.',
    '',
    'h2. Nome do Processo'
  ].join('\n');
  
  const merged = M.mergeReplacingRule(
    reqAtual,
    'RN7',
    'Nome do arquivo pdf',
    "O nome gerado para o arquivo pdf é composto pela 'Origem' seguido do 'Codigo NF' separados por hifen.",
    '208596'
  );
  
  // AMBAS linhas riscadas SEM espaço antes do `-` final
  assertContains(merged, "-Quando dois ou mais BMs de diferentes fichas, porém com o mesmo cliente e contato, forem enviados simultaneamente, no corpo do e-mail deverão ser exibidos os números de todas as fichas ([FICHA]) referentes aos BMs vinculados.-", 'R.1 linha 1 riscada sem espaço antes do -');
  assertContains(merged, "-Cada número de ficha e suas informações ( [ENDERECO_ENTREGA], [PERIODO_FAT] e [DATA_BASE] ) devem ser exibidos em parágrafos distintos no corpo do email, seguindo a ordem dos arquivos de BM anexados.-", 'R.2 linha 2 riscada igualmente');
  assertNotContains(merged, '. -\n-Cada', 'R.3 NÃO tem ". -\\n-" (bug que quebrava strikethrough no Textile)');
  
  // Nova versão no topo
  assertContains(merged, 'h3. RN7 - Nome do arquivo pdf', 'R.4 novo header');
  assertContains(merged, '(#208596)', 'R.5 nova versão');
}

console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Passou: ' + pass + '   Falhou: ' + fail);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (fail > 0) {
  console.log('');
  console.log('FALHAS:');
  failures.forEach(function(f) { console.log('  ❌ ' + f); });
  process.exit(1);
}
