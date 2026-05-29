#!/usr/bin/env node
// extract_fixtures_from_json.js
//
// Utilitário: pega um arquivo `sisloc_fixtures.json` (gerado pelo Chrome
// na primeira coleta) e explode em N arquivos .txt individuais na pasta
// tests/fixtures/.
//
// Uso:
//   node tests/extract_fixtures_from_json.js sisloc_fixtures.json
//
// O arquivo de entrada deve ser um JSON no formato:
//   { "171042": "h3. ...", "148935": "...", ... }

const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2];
if (!inputFile) {
  console.error('Uso: node extract_fixtures_from_json.js <arquivo.json>');
  process.exit(1);
}

const fixtures = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
const outDir = path.join(__dirname, 'fixtures');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

let count = 0;
for (const [id, ds] of Object.entries(fixtures)) {
  if (typeof ds !== 'string') continue;
  const outPath = path.join(outDir, id + '.txt');
  fs.writeFileSync(outPath, ds);
  console.log('  ✅ ' + outPath + ' (' + ds.length + ' chars)');
  count++;
}
console.log('\n' + count + ' fixtures extraídas em ' + outDir);
