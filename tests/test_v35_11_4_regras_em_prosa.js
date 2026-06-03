// tests/test_v35_11_4_regras_em_prosa.js
//
// Suite de testes para v35.11.4 — fix do rulesMatch capturando "regras:" em prosa.
//
// Bug original (#188640): a descrição do requisito contém uma frase tipo
// "2) Validar as regras:" antes do marker estrutural "*CONDIÇÕES/REGRAS*".
// O rulesMatch (case-insensitive) casava em "regras:" da prosa em vez de
// "*CONDIÇÕES/REGRAS*", e o body capturado incluía a sublist sumário
// (* "RNX1":URL, * "RNX2":URL, * "RNX3":URL) entre o falso início e o
// marker real. O split do extractRules quebrava nessas sublist e criava
// uma "regra fantasma" — daí RN extra na caixinha + renumeração off-by-one.
//
// Bug latente correlato (#175029 req #57751): mesma causa.
// Prosa "* Inutilizar  regras:" antes do marker "*Regras*" real fazia o
// rulesMatch pegar a sublist anterior (com "RN18", "RN28", "RN25") e
// criar a regra fantasma "RN18 - 1" (que estava catalogada no expected.json
// como estado bugado da v35.11.2/3).
//
// Fix na v35.11.4 (extractRules + rollbackLinksHandler):
//   Adiciona lookbehind variável "(?<=^|\n)\s*" antes do marker, exigindo
//   que ele venha após newline ou no início. Mesma técnica da v35.11.2
//   (lookbehind no split do dSections, REQUISITO em prosa).
//
// Grupos:
//   A — "regra:"/"regras:" em prosa NÃO casa o marker
//   B — Markers estruturais válidos CONTINUAM casando
//   C — Variações tolerantes (indentação, CR/LF, sem asterisco, etc)
//   D — Ponta-a-ponta com fixtures reais (#188640, #175029)
//   E — Não-regressão de cenários antigos

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

console.log('\n━━━━ v35.11.4 — "regras:" em prosa não casa marker ━━━━\n');

// ========== GRUPO A — Prosa NÃO casa ==========
console.log('GRUPO A — Texto em prosa com "regra:"/"regras:" NÃO inicia bloco\n');

// A.1: Caso real #188640 — "Validar as regras:" antes do marker estrutural.
// Sem o fix, o rulesMatch pegaria a posição de "regras:" e capturaria a sublist
// como regras. Com o fix, ele pula para o "*CONDIÇÕES/REGRAS*" real.
assert(runRules(
  'h3. REQUISITO: 700 - X\n\n' +
  '1) Implementar.\n\n' +
  '2) Validar as regras:\n\n' +
  '* "RN99 - Fantasma":http://example.com/#RN99\n\n' +
  '*CONDIÇÕES/REGRAS*\n\n' +
  '(Criar) "RN1 - Real":http://example.com/#RN1\n' +
  'Prosa da regra real.'
), ['RN1 - Real'], 'A.1 #188640 — "Validar as regras:" + sublist + marker real → só a regra real');

// A.2: Caso real #175029 #57751 — "* Inutilizar  regras:" antes do *Regras*
assert(runRules(
  'h3. Requisito #57751 - Algo\n\n' +
  '* Inutilizar  regras:\n' +
  '* "RN18":http://net1/redmine/issues/57751\n' +
  '* "RN28":http://net1/redmine/issues/57751\n\n' +
  '*Regras*\n' +
  'RN 57751.1 - Espelho da NF\n' +
  'Conteúdo da regra real.'
), ['RN 57751.1 - Espelho da NF'], 'A.2 #175029 — "Inutilizar regras:" + sublist + *Regras* → só a regra real');

// A.3: "regra:" singular no meio de prosa
assert(runRules(
  'h3. REQUISITO: 200 - Y\n\n' +
  'Conforme a regra: descrita acima.\n\n' +
  '*CONDIÇÕES/REGRAS*\n' +
  'RN1 - Verdadeira\n' +
  'Conteúdo.'
), ['RN1 - Verdadeira'], 'A.3 "Conforme a regra:" em prosa não inicia bloco');

// A.4: "regras" sem dois pontos no fim
assert(runRules(
  'h3. REQUISITO: 300 - Z\n\n' +
  'Implementar as regras seguintes na ordem indicada.\n\n' +
  '*CONDIÇÕES/REGRAS*\n' +
  'RN2 - Regra real\n' +
  'Conteúdo.'
), ['RN2 - Regra real'], 'A.4 "Implementar as regras seguintes" em prosa não casa');

// A.5: Caso adversário — "regras:" com newline antes (parece marker mas não está sozinho)
assert(runRules(
  'h3. REQUISITO: 400 - W\n\n' +
  'No texto a seguir:\n' +
  'todas as regras: devem ser seguidas.\n\n' +
  '*CONDIÇÕES/REGRAS*\n' +
  'RN3 - Real\n' +
  'Conteúdo.'
), ['RN3 - Real'], 'A.5 "todas as regras:" no meio de linha não casa (precedido por "todas as ")');

// ========== GRUPO B — Markers válidos casam ==========
console.log('\nGRUPO B — Markers estruturais legítimos continuam funcionando\n');

assert(runRules(
  '*CONDIÇÕES/REGRAS*\n' +
  'RN1 - Regra Alpha\n' +
  'Conteúdo alpha.'
), ['RN1 - Regra Alpha'], 'B.1 *CONDIÇÕES/REGRAS* no início (lookbehind ^ casa)');

assert(runRules(
  'h3. REQUISITO: 100 - Q\n\n' +
  '*CONDIÇÕES/REGRAS*\n' +
  'RN1 - Beta\n' +
  'Conteúdo.'
), ['RN1 - Beta'], 'B.2 *CONDIÇÕES/REGRAS* após cabeçalho do req');

assert(runRules(
  '*REGRAS*\n' +
  'RN1 - Gamma\n' +
  'Conteúdo.'
), ['RN1 - Gamma'], 'B.3 *REGRAS* sozinho (sem CONDIÇÕES/)');

assert(runRules(
  '*REGRAS:*\n' +
  'RN1 - Delta\n' +
  'Conteúdo.'
), ['RN1 - Delta'], 'B.4 *REGRAS:* com dois pontos dentro dos asteriscos');

assert(runRules(
  'CONDIÇÕES/REGRAS:\n' +
  'RN1 - Epsilon\n' +
  'Conteúdo.'
), ['RN1 - Epsilon'], 'B.5 CONDIÇÕES/REGRAS: sem asteriscos (legado)');

// ========== GRUPO C — Variações tolerantes ==========
console.log('\nGRUPO C — Variações de whitespace/case/CRLF\n');

assert(runRules(
  'h3. REQUISITO: 500 - V\r\n\r\n' +
  '*CONDIÇÕES/REGRAS*\r\n' +
  'RN1 - Com CRLF\r\n' +
  'Conteúdo CRLF.'
), ['RN1 - Com CRLF'], 'C.1 CRLF (default Redmine) ainda casa');

assert(runRules(
  'h3. REQUISITO: 600 - U\n\n' +
  '  *CONDIÇÕES/REGRAS*\n' +     // indentação
  'RN1 - Indentado\n' +
  'Conteúdo.'
), ['RN1 - Indentado'], 'C.2 marker com indentação (whitespace antes)');

assert(runRules(
  '*condições/regras*\n' +        // minúsculo
  'RN1 - Lowercase\n' +
  'Conteúdo.'
), ['RN1 - Lowercase'], 'C.3 marker em minúsculas (case-insensitive)');

assert(runRules(
  '*Condições/Regras*\n' +
  'RN1 - Mixed\n' +
  'Conteúdo.'
), ['RN1 - Mixed'], 'C.4 marker em CamelCase');

// ========== GRUPO D — Ponta-a-ponta com fixtures reais ==========
console.log('\nGRUPO D — Ponta-a-ponta com fixtures #188640 e #175029\n');

const fixDir = path.join(__dirname, 'fixtures');

// D.1 a D.5: #188640
const fix188640 = fs.readFileSync(path.join(fixDir, '188640.txt'), 'utf8');
const r188640 = analyze(fix188640);
const map188640 = {};
r188640.forEach(req => { map188640[req.id] = req.rules; });

assert(map188640['208996'], [
  'RNX1 - Cálculo para Tributação Integral do IBS e CBS',
  'RNX2 - Cálculo para Redução de Alíquota do IBS e CBS',
  'RNX3 - Cálculo para Diferimento  IBS e CBS',
  'RNX4 - Cálculo para Tributação Regular IBS e CBS'
], 'D.1 #188640 req #208996: 4 regras reais (sumário sublist descartado)');

assert(map188640['31468'] || [], [],
  'D.2 #188640 req #31468: 0 regras (CONDIÇÕES/REGRAS=NA, prosa "regras:" não cria fantasma)');

assert(map188640['60592'] || [], [],
  'D.3 #188640 req #60592: 0 regras (req sem CONDIÇÕES/REGRAS — preservado)');

assert(map188640['79'], ['RNX1 - NFCom - Base de cálculo do IBS e CBS'],
  'D.4 #188640 req #79: 1 regra (não tem prosa "regras:" pra confundir)');

assert(map188640['31059'] || [], [],
  'D.5 #188640 req #31059: 0 regras');

// D.6 a D.7: #175029 — caso latente correlato
const fix175029 = fs.readFileSync(path.join(fixDir, '175029.txt'), 'utf8');
const r175029 = analyze(fix175029);
const map175029 = {};
r175029.forEach(req => { map175029[req.id] = req.rules; });

assert(map175029['57751'], ['RN 57751.1 - Espelho da NF com emissão Terceiros'],
  'D.6 #175029 req #57751: 1 regra (não mais "RN18 - 1" fantasma da sublist)');

// #172681 aparece 2 vezes na fixture (1ª com 5 regras, 2ª vazia). Pegamos pela ordem.
const ocorrencias172681 = r175029.filter(req => req.id === '172681');
assert(ocorrencias172681.length, 2,
  'D.7 #175029 req #172681: 2 ocorrências (duplicada na demanda)');
assert(ocorrencias172681[0].rules.length, 5,
  'D.8 #175029 req #172681 (1ª): 5 regras (não-regressão)');

// ========== GRUPO E — Não-regressão de cenários antigos ==========
console.log('\nGRUPO E — Não-regressão de formatos antigos\n');

// Casos das 12 fixtures que não mudaram
const fixturesNaoMudaram = ['148935', '171042', '175544', '190033', '196911',
                              '199075', '206262', '207663', '207979', '208519',
                              '208821', '208937'];
fixturesNaoMudaram.forEach((id, i) => {
  const ds = fs.readFileSync(path.join(fixDir, id + '.txt'), 'utf8');
  const result = analyze(ds);
  // Só checa que extrai pelo menos 1 req (a comparação detalhada é no expected.json/run_tests)
  assert(result.length > 0, true, 'E.' + (i+1) + ' #' + id + ': não-regressão (extrai >0 reqs)');
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
