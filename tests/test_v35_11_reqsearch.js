// tests/test_v35_11_reqsearch.js
//
// Suite da v35.11.1 — formato reqsearch
//
// Cobre 7 grupos:
//   A — extractRules detecta padrão reqsearch (dígitos + 5 placeholders RN)
//   B — Atualizar Links substitui URL reqsearch pelo link Redmine novo
//   C — Aspas internas no título reqsearch + ## prefixo (compat v35.10.1)
//   D — Rollback do reqsearch volta byte-a-byte ao original
//   E — Bug do ruleMappings (v35.11 → v35.11.1): _reqsearch tem que ser propagado
//   F — Não-regressão: formatos antigos continuam funcionando
//   G — Falsos-positivos: URL não-reqsearch / link Redmine real / sem trava
//
// Versão: v35.11.1
// Fixture base: tests/fixtures/190033.txt (req #31168 da demanda 190033)

const fs = require('fs');
const path = require('path');
const { extractRules } = require('./extract_logic.js');

// Helper tq() — replica exata do helper do cb3/cb3b do bookmarklet
// (e do tqL local do branch reqsearch do Atualizar Links na v35.11)
const tqL = function (s) {
  let o = '', st = true;
  for (const ch of s) {
    if (ch === '"') { o += (st ? '\u201C' : '\u201D'); st = !st; }
    else o += ch;
  }
  return o;
};

// Replica EXATA do branch reqsearch do Atualizar Links no bookmarklet.
// Recebe o regrasBlock (string), o map.{_reqsearch} (objeto), newRN (string),
// newLink (string Redmine) e retorna { regrasBlock, linkChanges, createdArr }.
function aplicarReqsearch(regrasBlock, map, newRN, newLink) {
  if (!map._reqsearch) return null;
  const escOldId = map._reqsearch.oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const reReqsearch = new RegExp(
    '(^|\\n)(\\s*(?:#{1,2}\\s+)?(?:\\([^)]*\\)\\s*)?)["\\u201C\\u201D]' +
    escOldId + '\\s*[-–]\\s*([^\\n\\r]+?)["\\u201C\\u201D]' +
    ':https?:\\/\\/[^\\s]*reqsearch[^\\s]+',
    'i'
  );
  const linkChanges = [];
  const createdArr = [];
  let fndR = false;
  regrasBlock = regrasBlock.replace(reReqsearch, function (full, lineStart, prefix, titulo) {
    fndR = true;
    const newTitleLine = newRN + ' - ' + titulo.trim();
    const novoTrecho = lineStart + prefix + '"' + tqL(newTitleLine) + '":' + newLink;
    linkChanges.push({ antes: full, depois: novoTrecho });
    return novoTrecho;
  });
  if (fndR) createdArr.push(map._reqsearch.oldId + ' → ' + newRN);
  return { regrasBlock, linkChanges, createdArr, found: fndR };
}

// Replica EXATA do rollbackLinksHandler do bookmarklet
function rollbackLinks(secao, changes) {
  for (let i = changes.length - 1; i >= 0; i--) {
    const c = changes[i];
    if (secao.indexOf(c.depois) === -1) {
      throw new Error('uma das linhas alteradas não foi encontrada (provável edição manual entre o atualizar e o desfazer)');
    }
    secao = secao.replace(c.depois, c.antes);
  }
  return secao;
}

// Simula a parte do bookmarklet que monta ruleMappings (linha ~1404 do bookmarklet,
// patched na v35.11.1 para propagar _reqsearch).
function buildRuleMappings(rules, n) {
  const ruleMappings = [];
  rules.forEach(function (ru, i) {
    const newRN = n + i;
    const newTitle = ru.title.replace(
      /^RN(?:\s?[A-Z0-9]+(?:\.\d+)?|(?=\s+[-–]))/i,
      'RN' + newRN
    );
    // v35.11.1: ⚠️ ESTE CAMPO _reqsearch É CRÍTICO
    // Sem ele, o branch reqsearch do Atualizar Links nunca dispara — bug spot-checado
    // pelo usuário na 190033 antes do fix.
    ruleMappings.push({
      oldTitle: ru.title,
      newTitle: newTitle,
      _reqsearch: ru._reqsearch
    });
  });
  return ruleMappings;
}

let pass = 0, fail = 0;
function check(name, got, expected) {
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  if (ok) { console.log('  ✓', name); pass++; }
  else {
    console.log('  ✗', name);
    console.log('    esperado:', JSON.stringify(expected));
    console.log('    obtido:  ', JSON.stringify(got));
    fail++;
  }
}

// ============================================================
// Carrega fixture #190033
// ============================================================
const fixture190033Path = path.join(__dirname, 'fixtures', '190033.txt');
const fixture190033 = fs.readFileSync(fixture190033Path, 'utf8');

console.log('\n========================================');
console.log('  Suite v35.11.1 — reqsearch (#190033)');
console.log('========================================\n');

// ============================================================
// GRUPO A — extractRules detecta padrão reqsearch
// ============================================================
console.log('=== GRUPO A — extractRules detecta padrão reqsearch ===\n');
{
  const rules = extractRules(fixture190033);
  check('A.1 extractRules detecta 1 regra na #190033', rules.length, 1);
  if (rules.length === 1) {
    const r = rules[0];
    check('A.2 title começa com "RN - "', r.title.startsWith('RN - '), true);
    check('A.3 title contém "Parâmetro Máscara"', r.title.includes('Parâmetro Máscara'), true);
    check('A.4 title NÃO contém "2462" (id antigo removido)', r.title.includes('2462'), false);
    check('A.5 _reqsearch.oldId == "2462"', r._reqsearch.oldId, '2462');
    check('A.6 _reqsearch.verbo == "(Alterar)"', r._reqsearch.verbo, '(Alterar)');
    check('A.7 _reqsearch.oldUrl contém "reqsearch"', /reqsearch/.test(r._reqsearch.oldUrl), true);
    check('A.8 content começa com "Em Parâmetros"', r.content.startsWith('Em Parâmetros'), true);
    check('A.9 content preserva "*Ficha Loc -> Fatura*"', r.content.includes('*Ficha Loc -> Fatura*'), true);
    check('A.10 content termina com "número do Pedido de Venda"', r.content.endsWith('número do Pedido de Venda'), true);
  }
}

console.log('\n--- A.bis: 6 grupos de oldId (dígitos + 5 placeholders) ---');
['2462', 'RNX', 'RNx', 'RNX1', 'RNA', 'RN'].forEach(function (ph) {
  const fx = `*REGRAS:*\n\n(Alterar) "${ph} - Parâmetro Máscara":https://internos.app.sisloc.com/sisloc.reqsearch/regradenegocio/form?id=abc\nBody.\n`;
  const rules = extractRules(fx);
  check(`A.bis[${ph}] detecta 1 regra`, rules.length, 1);
  if (rules.length === 1) {
    check(`A.bis[${ph}] _reqsearch.oldId == "${ph}"`, rules[0]._reqsearch.oldId, ph);
    check(`A.bis[${ph}] title == "RN - Parâmetro Máscara"`, rules[0].title, 'RN - Parâmetro Máscara');
  }
});

console.log('\n--- A.ter: sem verbo na frente (Q4 = sim, com ou sem) ---');
{
  const fx = `*REGRAS:*\n\n"1234 - Sem verbo":https://internos.app.sisloc.com/sisloc.reqsearch/regradenegocio/form?id=abc\nBody.\n`;
  const rules = extractRules(fx);
  check('A.ter detecta 1 regra sem (Verbo)', rules.length, 1);
  if (rules.length === 1) {
    check('A.ter verbo vazio', rules[0]._reqsearch.verbo, '');
    check('A.ter oldId == "1234"', rules[0]._reqsearch.oldId, '1234');
  }
}

// ============================================================
// GRUPO B — Atualizar Links substitui URL reqsearch
// ============================================================
console.log('\n=== GRUPO B — Atualizar Links substitui URL reqsearch ===\n');
{
  const rules = extractRules(fixture190033);
  const map = { _reqsearch: rules[0]._reqsearch };
  const res = aplicarReqsearch(fixture190033, map, 'RN25', 'https://net1/redmine/issues/99999');

  check('B.1 substituição ocorreu (linkChanges == 1)', res.linkChanges.length, 1);
  check('B.2 createdArr == ["2462 → RN25"]', res.createdArr, ['2462 → RN25']);
  if (res.linkChanges.length === 1) {
    const depois = res.linkChanges[0].depois;
    check('B.3 "depois" começa com (Alterar)', /^\s*\(Alterar\)\s*/.test(depois.trim()), true);
    check('B.4 "depois" contém "RN25 - Parâmetro"', depois.includes('RN25 - Parâmetro'), true);
    check('B.5 "depois" termina com URL Redmine nova', depois.endsWith('issues/99999'), true);
    check('B.6 "depois" NÃO contém mais "2462 -"', depois.includes('2462 -'), false);
    check('B.7 "depois" NÃO contém mais URL reqsearch', /reqsearch/.test(depois), false);
  }
  check('B.8 bloco resultante preserva "Em Parâmetros..."', res.regrasBlock.includes('Em Parâmetros > aba Nota Fiscal'), true);
  check('B.9 bloco resultante preserva "número do Pedido de Venda"', res.regrasBlock.includes('número do Pedido de Venda'), true);
}

console.log('\n--- B.bis: placeholders RNX/RNx/RNX1/RNA/RN ---');
['RNX', 'RNx', 'RNX1', 'RNA', 'RN'].forEach(function (ph) {
  const fx = `*REGRAS:*\n\n(Alterar) "${ph} - Habilitar":https://internos.app.sisloc.com/sisloc.reqsearch/regradenegocio/form?id=z\nBody.\n`;
  const rules = extractRules(fx);
  const map = { _reqsearch: rules[0]._reqsearch };
  const res = aplicarReqsearch(fx, map, 'RN50', 'https://net1/redmine/issues/500');
  check(`B.bis[${ph}] substituição ocorre`, res.linkChanges.length, 1);
  check(`B.bis[${ph}] badge "${ph} → RN50"`, res.createdArr[0], ph + ' → RN50');
});

// ============================================================
// GRUPO C — Aspas internas no título + prefixo ##
// ============================================================
console.log('\n=== GRUPO C — Aspas internas no título reqsearch + prefixo "## " ===\n');
{
  // Aspas retas internas no título — extractRules deve casar até o ":https...reqsearch"
  // (regex usa [^\n\r]+? ancorado em ":https...reqsearch", não em [^"])
  const fx = `*REGRAS:*\n\n(Alterar) "999 - Habilitar opção "Mostrar tudo"":https://internos.app.sisloc.com/sisloc.reqsearch/regradenegocio/form?id=xyz\nBody.\n`;
  const rules = extractRules(fx);
  check('C.1 detecta 1 regra mesmo com aspas internas', rules.length, 1);
  if (rules.length === 1) {
    check('C.2 título preserva aspas internas', rules[0].title.includes('"Mostrar tudo"'), true);
    check('C.3 título começa com "RN - Habilitar"', rules[0].title.startsWith('RN - Habilitar'), true);
    check('C.4 oldId == "999"', rules[0]._reqsearch.oldId, '999');

    const map = { _reqsearch: rules[0]._reqsearch };
    const res = aplicarReqsearch(fx, map, 'RN10', 'https://net1/redmine/issues/11');
    check('C.5 Atualizar Links substitui', res.linkChanges.length, 1);
    if (res.linkChanges.length === 1) {
      const depois = res.linkChanges[0].depois;
      // Aspas internas do título original viram curvas via tqL
      check('C.6 "depois" tem aspas curvas (porque título original tinha aspas internas)',
        depois.includes('\u201C') && depois.includes('\u201D'), true);
      check('C.7 envelope mantém aspas retas (parser Textile ok)',
        depois.split('"').length === 3, true);
    }
  }
}

console.log('\n--- C.bis: prefixo "## " antes do reqsearch (compat v35.10.1) ---');
{
  const fx = `*REGRAS:*\n\n## (Alterar) "555 - Regra com hash":https://internos.app.sisloc.com/sisloc.reqsearch/regradenegocio/form?id=999\nBody.\n`;
  const rules = extractRules(fx);
  check('C.bis.1 detecta 1 regra com prefixo "## "', rules.length, 1);
  if (rules.length === 1) {
    check('C.bis.2 título == "RN - Regra com hash"', rules[0].title, 'RN - Regra com hash');
    const map = { _reqsearch: rules[0]._reqsearch };
    const res = aplicarReqsearch(fx, map, 'RN20', 'https://net1/redmine/issues/22');
    check('C.bis.3 Atualizar Links preserva "## " no resultado',
      res.linkChanges.length === 1 && res.linkChanges[0].depois.includes('## '), true);
  }
}

// ============================================================
// GRUPO D — Rollback volta byte-a-byte ao original
// ============================================================
console.log('\n=== GRUPO D — Rollback do reqsearch volta byte-a-byte ===\n');
{
  const original = fixture190033;
  const rules = extractRules(original);
  const map = { _reqsearch: rules[0]._reqsearch };
  const res = aplicarReqsearch(original, map, 'RN25', 'https://net1/redmine/issues/99999');

  check('D.1 Atualizar registrou 1 change', res.linkChanges.length, 1);
  check('D.2 Após Atualizar: bloco NÃO tem mais "2462 -"', res.regrasBlock.includes('2462 -'), false);
  check('D.3 Após Atualizar: bloco tem RN25', res.regrasBlock.includes('RN25 - Parâmetro'), true);

  const restaurado = rollbackLinks(res.regrasBlock, res.linkChanges);
  check('D.4 Rollback volta "2462 -"', restaurado.includes('2462 -'), true);
  check('D.5 Rollback volta URL reqsearch', /reqsearch/.test(restaurado), true);
  check('D.6 Rollback === original (byte-a-byte)', restaurado === original, true);
}

console.log('\n--- D.bis: rollback do placeholder RNX ---');
{
  const original = `*REGRAS:*\n\n(Alterar) "RNX - Habilitar":https://internos.app.sisloc.com/sisloc.reqsearch/regradenegocio/form?id=z\nBody.\n`;
  const rules = extractRules(original);
  const map = { _reqsearch: rules[0]._reqsearch };
  const res = aplicarReqsearch(original, map, 'RN15', 'https://net1/redmine/issues/77');
  const restaurado = rollbackLinks(res.regrasBlock, res.linkChanges);
  check('D.bis rollback === original (RNX)', restaurado === original, true);
}

console.log('\n--- D.ter: rollback falha gracefully com edição manual no meio ---');
{
  const original = `*REGRAS:*\n\n(Alterar) "2462 - Algo":https://internos.app.sisloc.com/sisloc.reqsearch/regradenegocio/form?id=a\nBody.\n`;
  const rules = extractRules(original);
  const map = { _reqsearch: rules[0]._reqsearch };
  const res = aplicarReqsearch(original, map, 'RN10', 'https://net1/redmine/issues/1');
  const editadoNoMeio = res.regrasBlock.replace('RN10 -', 'RN999 -');
  let errMsg = null;
  try { rollbackLinks(editadoNoMeio, res.linkChanges); }
  catch (e) { errMsg = e.message; }
  check('D.ter Rollback dá throw com mensagem clara',
    /não encontrado|não foi encontrada/.test(errMsg || ''), true);
}

// ============================================================
// GRUPO E — Bug do ruleMappings (regressão v35.11 → v35.11.1)
// ============================================================
console.log('\n=== GRUPO E — Bug do ruleMappings perdendo _reqsearch (v35.11.1) ===\n');
{
  // Cenário: extractRules retorna {title, content, _reqsearch}
  // ruleMappings.push deve propagar _reqsearch ou o branch do Atualizar Links nunca dispara.
  // Bug spot-checado pelo usuário: na v35.11 (sem o fix), o Atualizar Links cai no else
  // dos reCase3*, mensagem vira "1 regra não encontrada na demanda: RN".
  const rules = extractRules(fixture190033);
  const mappings = buildRuleMappings(rules, 25);
  check('E.1 mappings tem 1 entrada', mappings.length, 1);
  if (mappings.length === 1) {
    const map = mappings[0];
    check('E.2 map.oldTitle preservado', map.oldTitle, rules[0].title);
    check('E.3 map.newTitle renumerado', map.newTitle, 'RN25 - Parâmetro Máscara para geração das informações sobre');
    // ⚠️ ESTE É O FIX DA v35.11.1
    check('E.4 map._reqsearch propagado (FIX v35.11.1)', !!map._reqsearch, true);
    if (map._reqsearch) {
      check('E.5 map._reqsearch.oldId == "2462"', map._reqsearch.oldId, '2462');
    }
  }

  // E ponta a ponta: com o fix, o branch do Atualizar Links é alcançado
  const res = aplicarReqsearch(fixture190033, mappings[0], mappings[0].newTitle.match(/^RN\d+/)[0], 'https://net1/redmine/issues/99999');
  check('E.6 Atualizar Links via map.+_reqsearch dispara', res && res.found, true);
  if (res && res.found) {
    check('E.7 substituição ocorre', res.linkChanges.length, 1);
    check('E.8 badge "2462 → RN25"', res.createdArr[0], '2462 → RN25');
  }
}

// ============================================================
// GRUPO F — Não-regressão: formatos antigos continuam funcionando
// ============================================================
console.log('\n=== GRUPO F — Não-regressão de formatos antigos ===\n');
{
  // Formato 19 — título DEPOIS do link (v35.5.9)
  const fx1 = `*REGRAS:*\n\n(Criar) "RN1":https://net1/redmine/issues/12345 - Título da regra\nBody.\n`;
  const rules1 = extractRules(fx1);
  check('F.1 (Criar) "RN1":URL - Título: detecta 1', rules1.length, 1);
  check('F.2 não confunde com reqsearch (_reqsearch ausente)', !!rules1[0]._reqsearch, false);
  check('F.3 título preserva RN1', rules1[0].title.startsWith('RN1'), true);
}
{
  // Formato 5 — negrito só no RN (v34.2)
  const fx2 = `*REGRAS:*\n\n*RNX* - Regra de exibição\nBody.\n`;
  const rules2 = extractRules(fx2);
  check('F.4 *RNX* - Título: detecta 1', rules2.length, 1);
  check('F.5 não confunde com reqsearch', !!rules2[0]._reqsearch, false);
}
{
  // Formato 24 — RN sem código (v35.6.6)
  const fx3 = `*REGRAS:*\n\nRN -   Regra única\nBody.\n`;
  const rules3 = extractRules(fx3);
  check('F.6 "RN - Título" sem código: detecta 1', rules3.length, 1);
  check('F.7 não confunde com reqsearch (URL não tem reqsearch)', !!rules3[0]._reqsearch, false);
}
{
  // Mistura: 1 regra reqsearch + 1 regra normal (mesmo bloco)
  const fx4 = `*REGRAS:*\n\n(Alterar) "2462 - Param":https://internos.app.sisloc.com/sisloc.reqsearch/regradenegocio/form?id=a\nBody 1.\n\nRN1 – Outra normal\nBody 2.\n`;
  const rules4 = extractRules(fx4);
  check('F.8 mistura: detecta 2 regras', rules4.length, 2);
  if (rules4.length === 2) {
    check('F.9 1ª é reqsearch', !!rules4[0]._reqsearch, true);
    check('F.10 2ª NÃO é reqsearch', !!rules4[1]._reqsearch, false);
    check('F.11 2ª tem RN1 no título', rules4[1].title.startsWith('RN1'), true);
  }
}

// ============================================================
// GRUPO G — Falsos-positivos: trava da URL reqsearch
// ============================================================
console.log('\n=== GRUPO G — Falsos-positivos protegidos pela trava "reqsearch" ===\n');
{
  // URL não-reqsearch — não deveria casar no branch reqsearch (e cai fora do parser regular
  // porque não começa com RN<algo>)
  const fx1 = `*REGRAS:*\n\n"9999 - Algo aleatório":https://example.com/qualquer\nNão deveria casar.\n`;
  const rules1 = extractRules(fx1);
  check('G.1 URL não-reqsearch ignorada (não casa em reqsearch nem em RN)', rules1.length, 0);
}
{
  // Link Redmine real com RN1 — caminho normal, NÃO entra em reqsearch
  const fx2 = `*REGRAS:*\n\n(Criar) "RN1 - Título":https://net1/redmine/issues/12345\nBody.\n`;
  const rules2 = extractRules(fx2);
  check('G.2 RN1+link Redmine real: detecta como regra normal', rules2.length, 1);
  if (rules2.length === 1) {
    check('G.3   sem metadata _reqsearch', !!rules2[0]._reqsearch, false);
  }
}
{
  // URL com palavra "reqsearch" no path SEM ser o formato que queremos (sem ID antes do " - ")
  // Esse caso simplesmente não vai casar — porque o split não tem ponto de entrada.
  const fx3 = `*REGRAS:*\n\nAlguma linha qualquer https://exemplo.com/reqsearch/coisa\nNão tem padrão de regra.\n`;
  const rules3 = extractRules(fx3);
  check('G.4 URL reqsearch solta no meio do texto: não vira regra', rules3.length, 0);
}

// ============================================================
// TOTAL
// ============================================================
console.log('\n========================================');
console.log(`  ${pass + fail} testes — ${pass} ✓ / ${fail} ✗`);
console.log('========================================');
process.exit(fail ? 1 : 0);
