// tests/test_v35_11_7_reqsearch_sem_hifen.js
//
// Suite v35.11.7 — Formato reqsearch (v35.11.1) sem hífen entre <id> e <título>.
//
// Cobre o fix consolidado na v35.11.7:
//   Aceitar tanto "<id> - <título>" quanto "<id> <título>" (só espaço) no
//   padrão reqsearch literal. Caso real #201650 — a regra do req #61567 é
//
//       "2461 Comportamento do parâmetro Mascara para formatação...":URL_reqsearch
//
//   Sem hífen entre "2461" e "Comportamento" → 0 regras antes do fix.
//   Fix: trocar  \s*[-–]\s*  por  (?:\s*[-–]\s*|\s+)  em 3 lugares:
//     (1) split do extractRules (parts)
//     (2) reReqsearch no forEach do extractRules
//     (3) rollbackLinksHandler do Atualizar Links (regex construído com string)
//
// Rodar com: node tests/test_v35_11_7_reqsearch_sem_hifen.js
//
// === ESPELHO DAS REGEX/FUNÇÕES DO BOOKMARKLET v35.11.7 ===
// (auto-contido — não depende de extract_logic.js)

const fs = require('fs');
const path = require('path');

// ─── REGEX/FUNÇÕES DO BOOKMARKLET ───────────────────────────────────────────

// Split do extractRules — 3 alternativas:
//   (1) "RN[\s?A-Z0-9...]" entre aspas
//   (2) "RN" solto seguido de hífen
//   (3) Reqsearch literal: "<dígitos|RN[A-Z0-9]*>" + separador (hífen OU espaço puro — v35.11.7)
const splitRegex = /\n(?=\s*(?:#{1,2}\s+)?(?:\([^)]*\)\s*)?(?:h\d+\.\s*)?(?:\*?(?:["\u201C\u201D]RN\s?[A-Z0-9]+(?:\.\d+)?|RN(?:\s?[A-Z0-9]+(?:\.\d+)?|(?=\s+[-–])))\*?\b|["\u201C\u201D](?:\d+|RN[A-Z0-9]*)(?:\s*[-–]|\s+)))/i;

// reReqsearch — captura {verbo, oldId, título, oldUrl} do padrão reqsearch
// v35.11.7: (?:\s*[-–]\s*|\s+) — aceita hífen ou espaço puro entre <id> e <título>
const reReqsearch = /^(\([^)]*\)\s*)?["\u201C\u201D]((?:\d+|RN[A-Z0-9]*))(?:\s*[-–]\s*|\s+)([^\n\r]+?)["\u201C\u201D]:(https?:\/\/[^\s]*reqsearch[^\s]+)/i;

// rulesMatch — captura o bloco *CONDIÇÕES/REGRAS:* (v35.11.6: tolera espaços ao redor da "/")
const rulesMatchRegex = /(?<=^|\n)\s*(?:\*\s*)?(?:CONDI[CÇ][OÕ]ES\s*\/\s*REGRAS|REGRAS)\s*\*?\s*:?\s*\*?\s+([\s\S]*?)(?=\n\s*\*?(?:REQUISITO|Requisito|h\d+\.\s*Requisito)|\n\s*h3\.\s*#{1,2}\s*\d+|\n\s*---|$)/i;

// Mini-extractRules — espelho do forEach do bookmarklet limitado ao branch reqsearch
function extractRulesReqsearch(sec){
  // normaliza superscripts (igual bookmarklet)
  sec = sec.replace(/\u00B2/g,'2').replace(/\u00B3/g,'3').replace(/\u00B9/g,'1')
           .replace(/\u2070/g,'0').replace(/\u2074/g,'4').replace(/\u2075/g,'5')
           .replace(/\u2076/g,'6').replace(/\u2077/g,'7').replace(/\u2078/g,'8')
           .replace(/\u2079/g,'9');
  const m = sec.match(rulesMatchRegex);
  if(!m) return [];
  const parts = m[1].split(splitRegex);
  const rules = [];
  parts.forEach(function(part){
    let t = part.trim().replace(/^h\d+\.\s*/,'');
    if(!t) return;
    if(t.startsWith('|')) return;
    t = t.replace(/^#{1,2}\s+/,'');
    const mReq = t.match(reReqsearch);
    if(mReq){
      const verbo = (mReq[1] || '').trim();
      const oldId = mReq[2];
      const titulo = mReq[3].trim();
      const urlReq = mReq[4];
      const lines = t.split('\n');
      let content = lines.slice(1).join('\n').trim();
      content = content.replace(/\n\s*---[\s\S]*$/g,'').trim();
      rules.push({ title: 'RN - ' + titulo, content: content,
                   _reqsearch: { verbo: verbo, oldId: oldId, oldUrl: urlReq } });
      return;
    }
    // sem reqsearch — não conta pros testes desta suite
  });
  return rules;
}

// rollbackLinksHandler — regex construído com escOldId (v35.11.7)
function buildRollbackRegex(oldId){
  const escOldId = oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    '(^|\\n)(\\s*(?:#{1,2}\\s+)?(?:\\([^)]*\\)\\s*)?)["\\u201C\\u201D]' + escOldId +
    '(?:\\s*[-–]\\s*|\\s+)([^\\n\\r]+?)["\\u201C\\u201D]:https?:\\/\\/[^\\s]*reqsearch[^\\s]+',
    'i'
  );
}

// ─── Helper de teste ─────────────────────────────────────────────────────────
let pass = 0, fail = 0;
function test(name, got, expected){
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  if(ok){ pass++; console.log('  ✓ ' + name); }
  else  { fail++; console.log('  ✗ ' + name + '\n     got:      ' + JSON.stringify(got) + '\n     expected: ' + JSON.stringify(expected)); }
}

// Helper — extrair só {oldId, title} da 1ª regra capturada
function firstReqsearchOf(body){
  const sec = '*CONDIÇÕES/REGRAS:*\n' + body;
  const rs = extractRulesReqsearch(sec);
  if(rs.length === 0) return null;
  const r = rs[0];
  return r._reqsearch ? { oldId: r._reqsearch.oldId, title: r.title } : null;
}

// ─── GRUPO A — Caso real fixture #201650 ─────────────────────────────────────
console.log('\n━━━ A: fixture #201650 (caso real) ━━━');
const fixturesDir = path.join(__dirname, 'fixtures');
const fixture201650Path = path.join(fixturesDir, '201650.txt');
if(fs.existsSync(fixture201650Path)){
  const f = fs.readFileSync(fixture201650Path, 'utf8');

  // Extrair seção do #61567 manualmente (entre "h2. REQUISITO: #61567" e o "---" seguinte)
  const start = f.indexOf('h2. REQUISITO: #61567');
  const end = f.indexOf('h2. REQUISITO: #56191');
  const sec61567 = f.slice(start, end);

  const rs = extractRulesReqsearch(sec61567);
  test('extractRules pro #61567 retorna 1 regra', rs.length, 1);
  if(rs.length){
    test('regra do #61567 tem _reqsearch.oldId="2461"', rs[0]._reqsearch.oldId, '2461');
    test('regra do #61567 título sintetizado com prefixo "RN - "',
      rs[0].title.startsWith('RN - '), true);
    test('regra do #61567 título contém "Comportamento do parâmetro Mascara"',
      rs[0].title.includes('Comportamento do parâmetro Mascara'), true);
    test('regra do #61567 oldUrl contém "reqsearch"',
      rs[0]._reqsearch.oldUrl.includes('reqsearch'), true);
    test('regra do #61567 content inclui prosa "Quando habilitado"',
      rs[0].content.startsWith('Quando habilitado'), true);
  }
} else {
  console.log('  ⚠ fixture 201650.txt não encontrada — pulando');
}

// ─── GRUPO B — Padrão SEM hífen (caso novo v35.11.7) ────────────────────────
console.log('\n━━━ B: reqsearch SEM hífen (espaço puro) ━━━');

[
  { n:'dígitos puros + espaço',
    body:'"2461 Comportamento do parâmetro":https://x.com/reqsearch/y?id=abc',
    e:{ oldId:'2461', title:'RN - Comportamento do parâmetro' } },
  { n:'RNX + espaço',
    body:'"RNX Título sem hífen":https://x.com/reqsearch/y',
    e:{ oldId:'RNX', title:'RN - Título sem hífen' } },
  { n:'RNX1 + espaço',
    body:'"RNX1 Outro título":https://x.com/reqsearch/y',
    e:{ oldId:'RNX1', title:'RN - Outro título' } },
  { n:'RN vazio + espaço',
    body:'"RN Algum título":https://x.com/reqsearch/y',
    e:{ oldId:'RN', title:'RN - Algum título' } },
  { n:'verbo "(Criar)" + dígitos + espaço',
    body:'(Criar) "789 Título":https://x.com/reqsearch/y',
    e:{ oldId:'789', title:'RN - Título' } },
  { n:'verbo "(Validar)" + dígitos + espaço',
    body:'(Validar) "100 Validação X":https://x.com/sisloc.reqsearch/foo',
    e:{ oldId:'100', title:'RN - Validação X' } },
  { n:'múltiplos espaços entre id e título',
    body:'"2461   Comportamento":https://x.com/reqsearch/y',
    e:{ oldId:'2461', title:'RN - Comportamento' } },
  { n:'1 espaço só (mínimo)',
    body:'"42 X":https://x.com/reqsearch/y',
    e:{ oldId:'42', title:'RN - X' } },
].forEach(t => test(t.n, firstReqsearchOf(t.body), t.e));

// ─── GRUPO C — Padrão COM hífen (não-regressão da v35.11.1) ─────────────────
console.log('\n━━━ C: reqsearch COM hífen (não-regressão) ━━━');

[
  { n:'dígitos + hífen + título',
    body:'"123 - Título Original":https://x.com/reqsearch/y',
    e:{ oldId:'123', title:'RN - Título Original' } },
  { n:'dígitos + endash + título',
    body:'"123 – Título Endash":https://x.com/reqsearch/y',
    e:{ oldId:'123', title:'RN - Título Endash' } },
  { n:'sem espaço ao redor do hífen',
    body:'"123-Sem Espaços":https://x.com/reqsearch/y',
    e:{ oldId:'123', title:'RN - Sem Espaços' } },
  { n:'RNX + hífen',
    body:'"RNX - Algum Título":https://x.com/reqsearch/y',
    e:{ oldId:'RNX', title:'RN - Algum Título' } },
  { n:'RN1 + hífen',
    body:'"RN1 - Título":https://x.com/reqsearch/y',
    e:{ oldId:'RN1', title:'RN - Título' } },
  { n:'verbo + hífen',
    body:'(Alterar) "RNA - Alterado":https://x.com/reqsearch/y',
    e:{ oldId:'RNA', title:'RN - Alterado' } },
].forEach(t => test(t.n, firstReqsearchOf(t.body), t.e));

// ─── GRUPO D — Travas de segurança (NÃO casam o branch) ─────────────────────
console.log('\n━━━ D: travas — NÃO dispara reqsearch ━━━');

[
  { n:'URL sem "reqsearch" literal — não casa',
    body:'"2461 Algo":https://x.com/issues/123' },
  { n:'sem aspas em volta — não casa',
    body:'2461 Algo qualquer:https://x.com/reqsearch/y' },
  { n:'sem URL após — não casa',
    body:'"2461 Algo título"' },
  { n:'ID com letras maiúsculas (não RN) — não casa',
    body:'"AB123 Título":https://x.com/reqsearch/y' },
  { n:'aspas só de abertura — não casa',
    body:'"2461 Algo:https://x.com/reqsearch/y' },
].forEach(t => test(t.n, firstReqsearchOf(t.body), null));

// ─── GRUPO E — Múltiplas regras (split sem hífen) ──────────────────────────
console.log('\n━━━ E: split com múltiplas regras reqsearch sem hífen ━━━');

const multBody =
  '"2461 Primeira regra":https://x.com/reqsearch/a?id=1\n' +
  '"3500 Segunda regra":https://x.com/reqsearch/b?id=2\n' +
  '"RNX Terceira":https://x.com/reqsearch/c?id=3';
const multSec = '*CONDIÇÕES/REGRAS:*\n' + multBody;
const multRs = extractRulesReqsearch(multSec);
test('split quebra 3 regras reqsearch sem hífen', multRs.length, 3);
if(multRs.length === 3){
  test('1ª regra oldId="2461"', multRs[0]._reqsearch.oldId, '2461');
  test('2ª regra oldId="3500"', multRs[1]._reqsearch.oldId, '3500');
  test('3ª regra oldId="RNX"',  multRs[2]._reqsearch.oldId, 'RNX');
  test('1ª regra título "Primeira regra"', multRs[0].title, 'RN - Primeira regra');
  test('2ª regra título "Segunda regra"',  multRs[1].title, 'RN - Segunda regra');
  test('3ª regra título "Terceira"',       multRs[2].title, 'RN - Terceira');
}

// Misto: 1 com hífen + 1 sem hífen
const mistoBody =
  '"100 - Com hífen":https://x.com/reqsearch/a?id=1\n' +
  '"200 Sem hífen":https://x.com/reqsearch/b?id=2';
const mistoSec = '*CONDIÇÕES/REGRAS:*\n' + mistoBody;
const mistoRs = extractRulesReqsearch(mistoSec);
test('split quebra mix de regras com e sem hífen', mistoRs.length, 2);
if(mistoRs.length === 2){
  test('mix: 1ª oldId="100"', mistoRs[0]._reqsearch.oldId, '100');
  test('mix: 2ª oldId="200"', mistoRs[1]._reqsearch.oldId, '200');
}

// ─── GRUPO F — rollbackLinksHandler (Atualizar Links) ──────────────────────
console.log('\n━━━ F: rollbackLinksHandler — regex construído com escOldId ━━━');

const blockA = '"2461 Comportamento do parâmetro Mascara":https://internos.app.sisloc.com/sisloc.reqsearch/regradenegocio/form?id=abc';
const reA = buildRollbackRegex('2461');
const mA = blockA.match(reA);
test('regex casa linha sem hífen (dígitos)', mA !== null, true);
if(mA) test('título capturado preserva o texto após o ID',
  mA[3], 'Comportamento do parâmetro Mascara');

const blockB = '"2461 - Título Clássico":https://x.com/reqsearch/y';
const reB = buildRollbackRegex('2461');
const mB = blockB.match(reB);
test('regex casa linha com hífen (não-regressão)', mB !== null, true);

const blockC = '"RNX Título sem hífen":https://x.com/reqsearch/y';
const reC = buildRollbackRegex('RNX');
const mC = blockC.match(reC);
test('regex casa oldId RNX sem hífen', mC !== null, true);

// Substituição completa (replace) com title novo
const blockD = '"2461 Comportamento":https://x.com/reqsearch/y?id=foo';
const reD = buildRollbackRegex('2461');
const replaced = blockD.replace(reD, '$1$2"RN5 - Comportamento":https://x.com/issues/61567');
test('replace substitui linha sem hífen pelo link Redmine novo',
  replaced.endsWith('"RN5 - Comportamento":https://x.com/issues/61567'), true);

// ─── GRUPO G — Edge cases adicionais ───────────────────────────────────────
console.log('\n━━━ G: edge cases ━━━');

// Aspas curvas + sem hífen
const aspasCurvas = '\u201C2461 Aspas Curvas\u201D:https://x.com/reqsearch/y';
test('aspas curvas + sem hífen casa', firstReqsearchOf(aspasCurvas), { oldId:'2461', title:'RN - Aspas Curvas' });

// Sufixo numérico decimal-like NÃO confunde — ID precisa ser dígitos puros
const decimalLike = '"123.456 Não casa como dígito puro":https://x.com/reqsearch/y';
test('"123.456 ..." não casa como reqsearch (ID com "." quebra a trava)',
  firstReqsearchOf(decimalLike), null);

// Espaço em branco antes da URL com `:` — não confunde
const espacoCompleto = '"2461 Título completo aqui   ":https://x.com/reqsearch/y';
const ercRs = firstReqsearchOf(espacoCompleto);
test('título com espaços no fim ainda é capturado', ercRs && ercRs.oldId, '2461');

// ─── RESULTADO ──────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`RESULTADO: ${pass} OK / ${fail} FAIL  (total ${pass + fail})`);
console.log('═══════════════════════════════════════════════════════════════');
if(fail > 0) process.exit(1);
