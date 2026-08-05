// Testar o novo REDMINE_URL_PATTERN vs o antigo
const OLD = /^http:\/\/net1\/redmine\/issues\/\d+/;
const NEW = /^https?:\/\/[^\/]+\/redmine\/issues\/\d+/;

const cases = [
  // [url, oldExpected, newExpected, comentário]
  ["http://net1/redmine/issues/205868", true, true, "interno clássico"],
  ["http://net1/redmine/issues/205868/edit", true, true, "interno com sub-path"],
  ["http://net1/redmine/issues/205868#relations", true, true, "interno com anchor"],
  ["http://177.69.209.157:65080/redmine/issues/205868", false, true, "externo IP+porta — bug reportado"],
  ["http://177.69.209.157:65080/redmine/issues/32928/edit", false, true, "externo com edit"],
  ["https://net1/redmine/issues/205868", false, true, "hipotético HTTPS futuro"],
  ["https://redmine.empresa.com.br/redmine/issues/12345", false, true, "hipotético domínio novo"],
  ["http://net1/redmine/projects/foo", false, false, "não é /issues/N — deve rejeitar"],
  ["http://net1/redmine/issues/", false, false, "issues/ sem número — deve rejeitar"],
  ["http://net1/redmine/issues/abc", false, false, "issues/texto — deve rejeitar"],
  ["http://net1/", false, false, "só root — deve rejeitar"],
  ["https://github.com/redmine/issues/1", false, true, "! genérico bate site externo qualquer — worst case aceitável"],
  ["chrome://newtab/", false, false, "chrome:// interna — deve rejeitar"],
  ["about:blank", false, false, "about:blank — deve rejeitar"],
];

let pass = 0, fail = 0;
console.log("\n=== Testando novo REDMINE_URL_PATTERN ===\n");
for (const [url, oldExp, newExp, comment] of cases) {
  const oldGot = OLD.test(url);
  const newGot = NEW.test(url);
  const oldOK = oldGot === oldExp;
  const newOK = newGot === newExp;
  const status = newOK ? "✅" : "❌";
  if (newOK) pass++; else fail++;
  console.log(`${status} ${comment}`);
  console.log(`   URL: ${url}`);
  console.log(`   OLD regex: ${oldGot} (esp: ${oldExp}) ${oldOK ? "" : "⚠️"}`);
  console.log(`   NEW regex: ${newGot} (esp: ${newExp}) ${newOK ? "" : "⚠️"}`);
}

console.log(`\n=== Resultado: ${pass} passaram, ${fail} falharam ===\n`);

// Verificar não-regressão específica: TODA URL que o OLD aceita, o NEW também aceita
console.log("=== Verificação de não-regressão: NEW ⊇ OLD ===");
const oldPass = cases.filter(c => OLD.test(c[0]));
let regression = false;
for (const [url] of oldPass) {
  if (!NEW.test(url)) {
    console.log(`❌ REGRESSÃO: OLD aceita mas NEW rejeita: ${url}`);
    regression = true;
  }
}
if (!regression) console.log("✅ Nenhuma regressão — NEW aceita todas as URLs que OLD aceitava");

process.exit(fail > 0 ? 1 : 0);
