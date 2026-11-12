// Roda TODAS as suítes de teste do Sisloc Master e mostra um resumo.
// Uso: node tests/run_all.js      (as suítes com DOM simulado precisam do jsdom: cd tests && npm install)
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');
const dir = __dirname;
const suites = ['run_tests.js', ...fs.readdirSync(dir).filter(f => /^test_.*\.js$/.test(f)).sort()]
  .map(f => [f]).concat([['e2e_212039.js', 'A'], ['e2e_212039.js', 'B']]);
let falhas = 0;
for (const [f, arg] of suites) {
  const r = spawnSync(process.execPath, [path.join(dir, f)].concat(arg ? [arg] : []), { encoding: 'utf8', timeout: 180000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const resumo = (out.match(/(Passou: \d+\s+Falhou: \d+|\d+ passaram, \d+ falharam|Total: \d+ \| ✓ \d+ \| ✗ \d+|TOTAL: \d+\s+\|\s+✓ \d+\s+\|\s+✗ \d+|\d+ testes — \d+ ✓ \/ \d+ ✗|RESULTADO: \d+ OK \/ \d+ FAIL|Todos os \d+ testes passaram|e2e #\d+ cenário \w: TUDO OK|FALHOU \(\d+\))/g) || ['(sem resumo)']).pop();
  const okFlag = r.status === 0;
  if (!okFlag) falhas++;
  console.log((okFlag ? '✅ ' : '❌ ') + (f + (arg ? ' ' + arg : '')).padEnd(52) + resumo);
  if (!okFlag && /Cannot find module 'jsdom'/.test(out)) console.log('   → falta o jsdom: cd tests && npm install');
}
console.log('\n' + (falhas ? '❌ ' + falhas + ' suíte(s) com falha' : '✅ Todas as ' + suites.length + ' execuções passaram'));
process.exit(falhas ? 1 : 0);
