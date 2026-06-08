// tests/test_v35_11_6_placeholder_textual.js
//
// Suite v35.11.6 — placeholder textual #X+/#Y+ (com sufixo numérico opcional) e
// tolerância a espaços no marker "CONDIÇÕES / REGRAS".
//
// Cobre 3 sub-fixes consolidados na v35.11.6:
//   (1) Aceitar #X+ e #Y+ puros como IDs provisórios (caso real #187472).
//   (2) Aceitar #X+\d* e #Y+\d* (com sufixo numérico) — IDs distintos pra
//       placeholders como XXX1, XX2, XXX3 (caso real #207232).
//   (3) Tolerar "*CONDIÇÕES / REGRAS" com espaços ao redor da "/" no marker
//       de regras (caso real #207232 reqs XX2 e XXX3).
//
// Rodar com: node tests/test_v35_11_6_placeholder_textual.js
//
// === ESPELHO DAS REGEX/FUNÇÕES DO BOOKMARKLET v35.11.6 ===
// (auto-contido — não depende de extract_logic.js)

const fs = require('fs');
const path = require('path');

// ─── REGEX/FUNÇÕES DO BOOKMARKLET ───────────────────────────────────────────

// splitSections regex — 4 alts, todas aceitam \d+ | X+\d* | Y+\d*
const splitRegex = /(?=(?:(?<=^|\n)\s*(?:h\d+\.\s*)?REQUISITO\s*:?\s*\*?\s*#{0,2}\s*(?:\d+|X+\d*|Y+\d*)|h3\.\s*Requisito[\s:]*(?:Requisito\s+)?(?:Funcional\s+)?\*?\s*#{0,2}\s*(?:\d+|X+\d*|Y+\d*)|h3\.\s*#{1,2}\s*(?:\d+|X+\d*|Y+\d*)|\n\s*#(?:\d+|X+\d*|Y+\d*)\s*[-–]))/i;

// reqMatch (3 alts) — usado em getReqIdFromSection
const reqRe1 = /Requisito[\s:]*(?:Requisito\s+)?(?:Funcional\s+)?\*?\s*#{0,2}\s*(\d+|X+\d*|Y+\d*)/i;
const reqRe2 = /^h3\.\s*#{1,2}\s*(\d+|X+\d*|Y+\d*)/im;
const reqRe3 = /^\s*#(\d+|X+\d*|Y+\d*)\s*[-–]/i;

function getReqIdFromSection(sec){
  const m = sec.match(reqRe1) || sec.match(reqRe2) || sec.match(reqRe3);
  return m ? m[1].toUpperCase() : null;
}

// buildPlaceholderMap
function buildPlaceholderMap(ds){
  const map = [];
  const listSections = ds.match(/h1\.\s*Requisitos?\s*(?:Impactados?|Novos?)([\s\S]*?)(?=\nh1\.|\n---\s*\nh1\.|$)/gi);
  if(!listSections) return map;
  listSections.forEach(function(sec){
    sec.split('\n').forEach(function(line){
      const m = line.match(/^#{0,2}\s*(\d+|X+\d*|Y+\d*)\s*[-–]\s*(.+)/i);
      if(m) map.push({ id: m[1].toUpperCase(), title: m[2].trim().toLowerCase() });
    });
  });
  return map;
}

// isProvisionalId
function isProvisionalId(id){
  if(id === '99999') return true;
  if(/^0\d*$/.test(id)) return true;
  if(/^X+\d*$/i.test(id)) return true;
  if(/^Y+\d*$/i.test(id)) return true;
  return false;
}

// getReqSectionBounds.nextM (helper pra teste do bloco)
const nextMRegex = /(?:\n\s*h3\.\s*Requisito[\s:]*(?:Requisito\s+)?(?:Funcional\s+)?\*?\s*#{0,2}\s*(?:\d+|X+\d*|Y+\d*)|\n\s*(?:h\d+\.\s*)?REQUISITO\s*:?\s*\*?\s*#{0,2}\s*(?:\d+|X+\d*|Y+\d*)|\n\s*h3\.\s*#{1,2}\s*(?:\d+|X+\d*|Y+\d*)|\n\s*#(?:\d+|X+\d*|Y+\d*)\s*[-–])/i;

// rulesMatch — Fix B: \s*\/\s* tolera "CONDIÇÕES / REGRAS" com espaços
const rulesMatchRegex = /(?<=^|\n)\s*(?:\*\s*)?(?:CONDI[CÇ][OÕ]ES\s*\/\s*REGRAS|REGRAS)\s*\*?\s*:?\s*\*?\s+([\s\S]*?)(?=\n\s*\*?(?:REQUISITO|Requisito|h\d+\.\s*Requisito)|\n\s*h3\.\s*#{1,2}\s*\d+|\n\s*---|$)/i;

// Helper de teste
let pass = 0, fail = 0;
function test(name, got, expected){
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  if(ok){ pass++; console.log('  ✓ ' + name); }
  else  { fail++; console.log('  ✗ ' + name + '\n     got:      ' + JSON.stringify(got) + '\n     expected: ' + JSON.stringify(expected)); }
}

function splitAndGetIds(doc){
  const dM = doc.match(/h1\.\s*Detalhamento(?:\s+de\s+Projeto)?/i);
  const area = dM ? doc.slice(dM.index) : doc;
  return area.split(splitRegex).map(getReqIdFromSection).filter(Boolean);
}

// ─── GRUPO A — Caso real fixture #187472 (X+ puro) ──────────────────────────
console.log('\n━━━ A: fixture #187472 (X+ puro, caso real) ━━━');
const fixturesDir = path.join(__dirname, 'fixtures');
const fixture187472Path = path.join(fixturesDir, '187472.txt');
if(fs.existsSync(fixture187472Path)){
  const f = fs.readFileSync(fixture187472Path, 'utf8');
  test('buildPlaceholderMap captura #XXX',
    buildPlaceholderMap(f),
    [{ id: 'XXX', title: 'devolução de equipamentos locados via rfid' }]);
  test('splitSections detecta #XXX como seção própria', splitAndGetIds(f), ['XXX']);
  test('isProvisional(XXX) = true', isProvisionalId('XXX'), true);
} else {
  console.log('  ⚠ fixture 187472.txt não encontrada — pulando');
}

// ─── GRUPO B — Caso real fixture #207232 (X+ com sufixo + marker com espaços) ─
console.log('\n━━━ B: fixture #207232 (X+ com sufixo + CONDIÇÕES / REGRAS) ━━━');
const fixture207232Path = path.join(fixturesDir, '207232.txt');
if(fs.existsSync(fixture207232Path)){
  const f = fs.readFileSync(fixture207232Path, 'utf8');
  const ids = splitAndGetIds(f);
  test('splitSections detecta 3 reqs distintos (XXX1, XX2, XXX3)',
    ids, ['XXX1', 'XX2', 'XXX3']);
  test('isProvisional(XXX1)=true', isProvisionalId('XXX1'), true);
  test('isProvisional(XX2)=true',  isProvisionalId('XX2'),  true);
  test('isProvisional(XXX3)=true', isProvisionalId('XXX3'), true);

  // Confirma que o rulesMatch casa em todos os 3 reqs (incluindo XX2 e XXX3 com espaços)
  const dM = f.match(/h1\.\s*Detalhamento(?:\s+de\s+Projeto)?/i);
  const area = dM ? f.slice(dM.index) : f;
  const secs = area.split(splitRegex);
  const rulesPerReq = {};
  secs.forEach(sec => {
    const id = getReqIdFromSection(sec);
    if(!id) return;
    const m = sec.match(rulesMatchRegex);
    rulesPerReq[id] = m !== null;
  });
  test('XXX1 tem rulesMatch (CONDIÇÕES/REGRAS sem espaços)', rulesPerReq['XXX1'], true);
  test('XX2  tem rulesMatch (CONDIÇÕES / REGRAS COM espaços)', rulesPerReq['XX2'],  true);
  test('XXX3 tem rulesMatch (CONDIÇÕES / REGRAS* com espaços + *)', rulesPerReq['XXX3'], true);
} else {
  console.log('  ⚠ fixture 207232.txt não encontrada — pulando');
}

// ─── GRUPO C — Placeholders #X+/#Y+ puros (sem sufixo) ──────────────────────
console.log('\n━━━ C: placeholders #X+/#Y+ puros (case-insensitive) ━━━');
['X','XX','XXX','XXXX','x','xx','xxx','Y','YY','YYY','YYYY','y','yy','yyy'].forEach(ph => {
  const doc = 'h1. Detalhamento de Projeto\n\nh3. REQUISITO: #' + ph + ' - Algum Título\n\nFoo bar';
  test('#' + ph + ' detectado', splitAndGetIds(doc), [ph.toUpperCase()]);
  test('#' + ph + ' provisional=true', isProvisionalId(ph.toUpperCase()), true);
});

// ─── GRUPO D — Placeholders com sufixo numérico (X+\d*, Y+\d*) ──────────────
console.log('\n━━━ D: placeholders #X+\\d* / #Y+\\d* (com sufixo numérico) ━━━');
['X1','X42','XX2','XXX1','XXX3','XXXX99','x1','xx99','Y1','YY2','YYY99','y42'].forEach(ph => {
  const doc = 'h1. Detalhamento de Projeto\n\nh3. REQUISITO: #' + ph + ' - Título\n\nFoo';
  test('#' + ph + ' id correto (sem truncar)', splitAndGetIds(doc), [ph.toUpperCase()]);
  test('#' + ph + ' isProvisional', isProvisionalId(ph.toUpperCase()), true);
});

// ─── GRUPO E — Diferenciação importante: XXX1 ≠ XXX3 ────────────────────────
console.log('\n━━━ E: IDs distintos não colidem ━━━');
test('XXX1 + XXX3 viram 2 IDs distintos (não colidem como XXX)',
  splitAndGetIds('h1. Detalhamento\n\nh3. REQUISITO: #XXX1 - A\n\nFoo\n\nh3. REQUISITO: #XXX3 - B\n\nBar'),
  ['XXX1', 'XXX3']);
test('XX2 + XXX2 viram IDs distintos',
  splitAndGetIds('h1. Detalhamento\n\nh3. REQUISITO: #XX2 - A\n\nFoo\n\nh3. REQUISITO: #XXX2 - B\n\nBar'),
  ['XX2', 'XXX2']);

// ─── GRUPO F — Não-regressão de IDs numéricos ───────────────────────────────
console.log('\n━━━ F: não-regressão de IDs numéricos ━━━');
test('formato clássico h3. Requisito #N',
  splitAndGetIds('h1. Detalhamento de Projeto\n\nh3. Requisito #31505 - foo\n\nRN1\n\nh3. Requisito #95698 - bar\n\nRN1'),
  ['31505','95698']);
test('isProvisional(31505)=false', isProvisionalId('31505'), false);
test('isProvisional(99999)=true (preservado)', isProvisionalId('99999'), true);
test('isProvisional(0)=true (preservado)', isProvisionalId('0'), true);
test('isProvisional(01)=true (preservado)', isProvisionalId('01'), true);
test('isProvisional(123)=false', isProvisionalId('123'), false);

// ─── GRUPO G — Misturas/letras outras NÃO viram placeholder ─────────────────
console.log('\n━━━ G: misturas/letras outras NÃO são placeholders ━━━');
// X+\d* aceita X seguido OPCIONALMENTE de dígitos — não aceita letras intercaladas
['XY','XYZ','YX','YXY','Z','A','N','TBD','XXXY','YYYX','1X','1XX','42X','X1A',''].forEach(s => {
  test('isProvisional(' + JSON.stringify(s) + ') = false', isProvisionalId(s), false);
});

// ─── GRUPO H — Prosa com X/Y NÃO cria seção fantasma ────────────────────────
console.log('\n━━━ H: prosa com X/Y NÃO cria seção fantasma ━━━');
[
  { name: 'prosa "no requisito #XXX abaixo"',
    doc: 'h1. Detalhamento de Projeto\n\nh3. Requisito #100 - foo\n\nObs: vide o requisito #XXX abaixo.\n\nRN1',
    exp: ['100'] },
  { name: 'prosa "no requisito #XX2 abaixo"',
    doc: 'h1. Detalhamento de Projeto\n\nh3. Requisito #100 - foo\n\nObs: vide o requisito #XX2 abaixo.\n\nRN1',
    exp: ['100'] },
  { name: '"tela X" e "passo Y" (sem #)',
    doc: 'h1. Detalhamento de Projeto\n\nh3. Requisito #200 - foo\n\nVerificar tela X e passo Y.\n\nRN1',
    exp: ['200'] },
  { name: '"método X()" e "campo Y"',
    doc: 'h1. Detalhamento de Projeto\n\nh3. Requisito #300 - foo\n\nNo método X(), campo Y.\n\nRN1',
    exp: ['300'] },
].forEach(t => test(t.name, splitAndGetIds(t.doc), t.exp));

// ─── GRUPO I — buildPlaceholderMap (X+/Y+ com sufixo) ──────────────────────
console.log('\n━━━ I: buildPlaceholderMap captura X+\\d*/Y+\\d* ━━━');
test('Requisitos Novos com #XXX puro',
  buildPlaceholderMap('h1. Requisitos Novos\n\n#XXX - Devolução\n\nh1. Detalhamento'),
  [{ id: 'XXX', title: 'devolução' }]);
test('Requisitos Novos com #XXX1 (sufixo)',
  buildPlaceholderMap('h1. Requisitos Novos\n\n#XXX1 - Algo\n\nh1. Detalhamento'),
  [{ id: 'XXX1', title: 'algo' }]);
test('Requisitos Novos com 3 placeholders (XXX1, XX2, XXX3)',
  buildPlaceholderMap('h1. Requisitos Novos\n\n#XXX1 - A\n#XX2 - B\n#XXX3 - C\n\nh1. Detalhamento'),
  [{ id: 'XXX1', title: 'a' }, { id: 'XX2', title: 'b' }, { id: 'XXX3', title: 'c' }]);
test('Requisitos Novos com #xxx1 (minúsculo) → normaliza pra XXX1',
  buildPlaceholderMap('h1. Requisitos Novos\n\n#xxx1 - Outro\n\nh1. Detalhamento'),
  [{ id: 'XXX1', title: 'outro' }]);

// ─── GRUPO J — Fix B isolado: marker CONDIÇÕES / REGRAS com espaços ─────────
console.log('\n━━━ J: rulesMatch tolera espaços ao redor da "/" no marker ━━━');
const markerCases = [
  { marker: '*CONDIÇÕES/REGRAS:*',     name: 'sem espaços + : + * final' },
  { marker: '*CONDIÇÕES / REGRAS',     name: 'COM espaços, sem : sem *' },
  { marker: '*CONDIÇÕES / REGRAS*',    name: 'COM espaços + * final' },
  { marker: '*CONDIÇÕES / REGRAS:*',   name: 'COM espaços + : + *' },
  { marker: '*CONDIÇÕES  /  REGRAS',   name: 'COM 2 espaços ao redor da /' },
  { marker: '*CONDIÇÕES /REGRAS',      name: 'espaço só antes da /' },
  { marker: '*CONDIÇÕES/ REGRAS',      name: 'espaço só depois da /' },
];
markerCases.forEach(c => {
  const doc = c.marker + '\n\nRN1 - regra\nProsa.';
  const m = doc.match(rulesMatchRegex);
  test('marker ' + JSON.stringify(c.marker) + ' (' + c.name + ') casa', m !== null, true);
});

// ─── GRUPO K — Fixtures conhecidas (não-regressão) ──────────────────────────
console.log('\n━━━ K: fixtures conhecidas (não-regressão) ━━━');
[
  { n:'h2. REQUISITO ##N (#206262)',
    d:'h1. Detalhamento de Projeto\n\nh2. REQUISITO ##31505 - foo\n\nRN1', e:['31505'] },
  { n:'Requisito: Requisito Funcional #N (#199075)',
    d:'h1. Detalhamento de Projeto\n\nh3. Requisito: Requisito Funcional #100 - foo\n\nRN1', e:['100'] },
  { n:'h2. Requisito *#N – T* (#204289)',
    d:'h1. Detalhamento de Projeto\n\nh2. Requisito *#95698 – foo*\n\nRN1', e:['95698'] },
  { n:'requisito #N abaixo prosa (#196911)',
    d:'h1. Detalhamento de Projeto\n\nh3. Requisito #48 - foo\n\n+Obs:+ no requisito #31446 abaixo, vide.\n\nRN1', e:['48'] },
  { n:'h1. REQUISITO bare',
    d:'h1. Detalhamento de Projeto\n\nh1. REQUISITO #777 - foo\n\nRN1', e:['777'] },
].forEach(t => test(t.n, splitAndGetIds(t.d), t.e));

// ─── GRUPO L — nextM detecta X+/Y+ com sufixo ───────────────────────────────
console.log('\n━━━ L: nextM detecta placeholders X+\\d*/Y+\\d* como próximo req ━━━');
const docNextM = 'h3. Requisito #100 - foo\n\nRN1\n\nh3. REQUISITO: #XX2 - placeholder\n\nRN2';
const nextMatch = docNextM.match(nextMRegex);
test('nextM detecta "h3. REQUISITO: #XX2" como próximo req',
  nextMatch !== null && nextMatch[0].includes('XX2'), true);

const docNextM2 = 'h3. Requisito #200 - foo\n\nRN1\n\nh2. Requisito #YYY3 - placeholder\n\nRN2';
const nextMatch2 = docNextM2.match(nextMRegex);
test('nextM detecta "h2. Requisito #YYY3" como próximo req',
  nextMatch2 !== null && nextMatch2[0].includes('YYY3'), true);

// ─── RESULTADO ──────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`RESULTADO: ${pass} OK / ${fail} FAIL  (total ${pass + fail})`);
console.log('═══════════════════════════════════════════════════════════════');
if(fail > 0) process.exit(1);
