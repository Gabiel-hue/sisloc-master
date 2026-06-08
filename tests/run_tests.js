#!/usr/bin/env node
// run_tests.js — roda fixtures + cenários sintéticos contra a lógica do bookmarklet
//
// Uso:
//   node tests/run_tests.js                    # roda tudo e mostra diff
//   node tests/run_tests.js --update-snapshots # regrava expected.json (use com CUIDADO)
//   node tests/run_tests.js fixtures           # só fixtures
//   node tests/run_tests.js synthetic          # só cenários sintéticos

'use strict';

const fs = require('fs');
const path = require('path');
const { analyze, splitSections, getReqIdFromSection } = require('./extract_logic');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const EXPECTED_PATH = path.join(__dirname, 'expected.json');

const args = process.argv.slice(2);
const updateSnapshots = args.includes('--update-snapshots');
const filter = args.filter(a => !a.startsWith('--'))[0]; // 'fixtures' | 'synthetic' | undefined

// ─── Cenários sintéticos ─────────────────────────────────────────────────────
const SYNTHETIC = [
  {
    nome: 'sintetico/dois_h3_hash',
    descricao: 'dois requisitos com h3.# (não-regressão básica)',
    texto: 'h3. #100 - Aaa\n\n*Regras*\nNA\n\n---\n\nh3. #200 - Bbb\n\n*Regras*\nNA',
    esperado_ids: ['100', '200']
  },
  {
    nome: 'sintetico/hash_sem_h3_171042',
    descricao: 'caso real #171042: cabeçalho #N - Título sem h3. (v35.6.5)',
    texto: 'h1. Detalhamento de Projeto\n\nh3. #32963 - Remessa\n\n*Regras*\nNA\n\n---\n\n#32965 - Devolução\n\n*Regras*\n"RNX1":url - Algo',
    esperado_ids: ['32963', '32965']
  },
  {
    nome: 'sintetico/requisito_classico',
    descricao: 'REQUISITO #N clássico + h3. ##N (v34.0 e v35.5.8)',
    texto: 'REQUISITO #500 - X\n\n*Regras*\nNA\n\n---\n\nh3. ##600 - Y\n\n*Regras*\nNA',
    esperado_ids: ['500', '600']
  },
  {
    nome: 'sintetico/requisito_funcional',
    descricao: 'Requisito Funcional (v35.5)',
    texto: 'h3. Requisito Funcional #700\n\n*Regras*\nNA\n\n---\n\nh3. Requisito Funcional #800\n\n*Regras*\nNA',
    esperado_ids: ['700', '800']
  },
  {
    nome: 'sintetico/misturado',
    descricao: 'cabeçalhos misturados: h3.#, #N e h3.# de novo',
    texto: 'h3. #11 - A\n\n*Regras*\nNA\n\n---\n\n#22 - B\n\n*Regras*\nNA\n\n---\n\nh3. #33 - C\n\n*Regras*\nNA',
    esperado_ids: ['11', '22', '33']
  },
  {
    nome: 'sintetico/bullet_nao_casa',
    descricao: 'bullet "* #N" no meio de conteúdo NÃO deve ser confundido com cabeçalho',
    texto: 'h3. #50 - A\n\n* #1234 - bullet de referência\n\n*Regras*\nNA',
    esperado_ids: ['50']
  },
  {
    nome: 'sintetico/hifen_vs_endash',
    descricao: 'hífen (-) e en-dash (–) ambos aceitos como separador',
    texto: 'h3. #1 - A\n\n*Regras*\nNA\n\n---\n\n#2 – B\n\n*Regras*\nNA',
    esperado_ids: ['1', '2']
  },
  {
    nome: 'sintetico/ver_demanda_nao_casa',
    descricao: 'referência inline "Ver demanda #1234" NÃO deve ser confundida',
    texto: 'h3. #100 - A\n\nVer demanda #1234 para mais info\n\n*Regras*\nNA',
    esperado_ids: ['100']
  },
  {
    nome: 'sintetico/listagem_topo_filtrada',
    descricao: 'listagem do topo é filtrada por h1. Detalhamento de Projeto',
    texto: 'h1. Requisitos Impactados\n#48 - Aaa\n#46 - Bbb\n#50 - Ccc\n\n---\n\nh1. Detalhamento de Projeto\n\nh3. Requisito: #48 - Aaa\n*Regras*\nNA',
    esperado_ids: ['48']
  },
  {
    nome: 'sintetico/numero_sem_traco_nao_casa',
    descricao: 'linha começando com #N SEM traço (não é cabeçalho)',
    texto: 'h3. #100 - A\n\n#1234 simplesmente um número\n\n*Regras*\nNA',
    esperado_ids: ['100']
  },
  {
    nome: 'sintetico/link_textile_nao_casa',
    descricao: 'link textile [#1234] não deve casar',
    texto: 'h3. #100 - A\n\nVer [#1234] - relacionado\n\n*Regras*\nNA',
    esperado_ids: ['100']
  },
  {
    nome: 'sintetico/requisito_minusculo_meio_frase_nao_casa',
    descricao: 'v35.11.2: "no requisito #N abaixo" em linguagem natural NÃO deve criar seção fantasma',
    texto: 'h1. Detalhamento de Projeto\n\nh3. REQUISITO: ##48\n\n*O QUE DEVE SER FEITO:*\nVer regras no seção do requisito #31446 abaixo, responsável.\n\n*REGRAS:*\nNA\n\n---\n\nh3. REQUISITO: ##31446\n\n*REGRAS:*\nNA',
    esperado_ids: ['48', '31446']
  },
  {
    nome: 'sintetico/h2_REQUISITO_preservado',
    descricao: 'v35.11.2: cabeçalho h2. REQUISITO ##N (caso #206262) ainda detectado',
    texto: 'h1. Detalhamento de Projeto\n\nh2. REQUISITO: ##400\n\n*REGRAS:*\nNA\n\n---\n\nh2. REQUISITO: ##500\n\n*REGRAS:*\nNA',
    esperado_ids: ['400', '500']
  },
  {
    nome: 'sintetico/regras_em_prosa_nao_casa',
    descricao: 'v35.11.4: "regras:"/"regra:" em prosa NÃO casa o marker (caso #188640: "Validar as regras:")',
    // Sem o lookbehind, o rulesMatch pegava "regras:" da prosa e o split criava "RN10 -" da sublist
    texto: 'h1. Detalhamento de Projeto\n\nh3. REQUISITO: 700 - Algo\n\n2) Validar as regras:\n\n* "RN99 - Fantasma":http://example.com/#RN99\n\n*CONDIÇÕES/REGRAS*\n\nRN1 - Real\nProsa da regra real.',
    esperado_ids: ['700']
  },
  {
    nome: 'sintetico/regras_em_prosa_com_sublist_188640',
    descricao: 'v35.11.4: caso real #188640 simplificado — prosa "regras:" + sublist sumário + CONDIÇÕES/REGRAS real',
    // Antes da v35.11.4: 2 "RN" extraídas (a sublist fantasma + a real). Depois: só 1.
    texto: 'h1. Detalhamento de Projeto\n\nh3. REQUISITO: 800 - Obter Dados\n\n*O QUE DEVE SER FEITO:*\n\n1) Implementar.\n\n2) Validar as regras:\n\n* "RNX1 - Sumário":http://example.com/#RNX1\n\n*CONVERSOR*\nNA\n\n*CONDIÇÕES/REGRAS*\n\n(Criar) "RNX1 - Real":http://example.com/#RNX1\nProsa da regra real.',
    esperado_ids: ['800']
  },
  {
    nome: 'sintetico/h2_requisito_asterisco_204289',
    descricao: 'v35.11.5: "h2. Requisito *#N – Título*" (asterisco do negrito Textile entre Requisito e #) — caso #204289 req #95698',
    // Antes da v35.11.5, o "*" entre "Requisito" e "#" quebrava todos os regex de detecção
    // de seção (split, getReqId, getReqSectionBounds). Resultado: req #95698 não aparecia
    // na caixinha. Bônus testado pelo run_tests: o nextM agora detecta h2. (não só h3.),
    // então o bloco do #31505 termina ANTES do #95698 (sem vazamento de gravação).
    texto: 'h1. Detalhamento de Projeto\n\nh2. Requisito #31505 – Definir\n\n*CONDIÇÕES/REGRAS:*\n*RN1: Regra A*\nProsa A.\n\n---\n\nh2. Requisito *#95698 – Manter Dados*\n\n*CONDIÇÕES/REGRAS:*\n*RN1: Regra B*\nProsa B.',
    esperado_ids: ['31505', '95698']
  },
  {
    nome: 'sintetico/h3_requisito_placeholder_xxx_187472',
    descricao: 'v35.11.6: placeholder textual #XXX como ID provisório — caso #187472 req #XXX',
    // Antes da v35.11.6, header "h3. REQUISITO: #XXX - Devolução RFID" não aparecia
    // porque \d+ não casa "XXX". Sistema de provisional IDs (#99999, #0) já tinha
    // infraestrutura — faltava só estender o vocabulário (X+ puro).
    texto: 'h1. Requisitos Novos\n\n#XXX - Devolução RFID\n\nh1. Detalhamento de Projeto\n\nh3. REQUISITO: #XXX - Devolução RFID\n\n*CONDIÇÕES/REGRAS:*\n\nRN1 - regra um\nconteúdo da regra um.',
    esperado_ids: ['XXX']
  },
  {
    nome: 'sintetico/h2_requisito_placeholder_com_sufixo_207232',
    descricao: 'v35.11.6: placeholders X+ com sufixo numérico (XXX1, XX2, XXX3) — caso #207232',
    // Antes da v35.11.6, X+ puro consumia só "XXX" e deixava "1" órfão.
    // Resultado: XXX1 e XXX3 viravam ambos id "XXX" (colisão).
    // Agora X+\d* aceita o sufixo numérico opcional — IDs ficam distintos.
    texto: 'h1. Detalhamento de Projeto\n\nh2. REQUISITO: XXX1 - Exibir CSAT\n\n*CONDIÇÕES/REGRAS:*\n*RNX1 – Regra A*\nProsa.\n\n---\n\nh2. REQUISITO: XX2 - Pesquisa CSAT\n\n*CONDIÇÕES/REGRAS:*\n*RNX1 – Regra B*\nProsa.\n\n---\n\nh2. REQUISITO: XXX3 - Manter dados\n\n*CONDIÇÕES/REGRAS:*\n*RNX1 – Regra C*\nProsa.',
    esperado_ids: ['XXX1', 'XX2', 'XXX3']
  },
  {
    nome: 'sintetico/placeholder_y_com_sufixo',
    descricao: 'v35.11.6: simetria — placeholder Y+ com sufixo numérico (Y1, YY2, YYY) funciona igual X+',
    texto: 'h1. Detalhamento de Projeto\n\nh2. REQUISITO: Y1 - Algo Y\n\n*REGRAS:*\nRN1 - regra\n\n---\n\nh2. REQUISITO: YY2 - Outro Y\n\n*REGRAS:*\nRN1 - regra',
    esperado_ids: ['Y1', 'YY2']
  },
  {
    nome: 'sintetico/placeholder_provisional_id_check',
    descricao: 'v35.11.6: isProvisionalId aceita X+\\d* / Y+\\d* além de 99999 e 0\\d*',
    // Esse sintético testa o isProvisionalId indiretamente — todos os IDs aqui são provisórios.
    texto: 'h1. Detalhamento de Projeto\n\nh3. REQUISITO: #XXX - Provisório puro\n\n*REGRAS:*\nRN1 - r\n\n---\n\nh3. REQUISITO: #XX42 - Provisório com sufixo\n\n*REGRAS:*\nRN1 - r\n\n---\n\nh3. REQUISITO: #99999 - Provisional clássico\n\n*REGRAS:*\nRN1 - r',
    esperado_ids: ['XXX', 'XX42', '99999']
  },
  {
    nome: 'sintetico/condicoes_regras_com_espacos_207232',
    descricao: 'v35.11.6: marker "*CONDIÇÕES / REGRAS" com espaços ao redor da "/" agora casa (caso #207232 req XX2)',
    // Antes da v35.11.6, o regex literal "CONDI[CÇ][OÕ]ES\/REGRAS" exigia barra sem espaços.
    // No #207232, dois dos 3 reqs usavam "*CONDIÇÕES / REGRAS" (com espaços) → 0 regras extraídas.
    // Agora \s*\/\s* tolera ambos os formatos.
    texto: 'h1. Detalhamento de Projeto\n\nh3. REQUISITO: 100 - Marker sem espaços\n\n*CONDIÇÕES/REGRAS:*\n\nRN1 - regra 1\n\n---\n\nh3. REQUISITO: 200 - Marker com espaços\n\n*CONDIÇÕES / REGRAS\n\nRN1 - regra 2\n\n---\n\nh3. REQUISITO: 300 - Marker com asterisco e espaços\n\n*CONDIÇÕES / REGRAS*\n\nRN1 - regra 3',
    esperado_ids: ['100', '200', '300']
  }
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function listFixtures() {
  return fs.readdirSync(FIXTURES_DIR)
    .filter(f => f.endsWith('.txt'))
    .map(f => ({
      id: f.replace(/\.txt$/, ''),
      path: path.join(FIXTURES_DIR, f),
      ds: fs.readFileSync(path.join(FIXTURES_DIR, f), 'utf8')
    }));
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function diffSummary(esperado, obtido) {
  const lines = [];
  if (esperado.length !== obtido.length) {
    lines.push('  ⚠ qtd reqs: esperado=' + esperado.length + ' obtido=' + obtido.length);
  }
  const idsEsperados = esperado.map(r => r.id);
  const idsObtidos = obtido.map(r => r.id);
  const ganhos = idsObtidos.filter(id => !idsEsperados.includes(id));
  const perdas = idsEsperados.filter(id => !idsObtidos.includes(id));
  if (ganhos.length) lines.push('  + ids novos: ' + ganhos.join(', '));
  if (perdas.length) lines.push('  - ids sumidos: ' + perdas.join(', '));

  // diff de regras por req comum
  esperado.forEach((esp, i) => {
    const obt = obtido[i];
    if (!obt || obt.id !== esp.id) return;
    if (!deepEqual(esp.rules, obt.rules)) {
      const esperadas = new Set(esp.rules);
      const obtidas = new Set(obt.rules);
      const novas = obt.rules.filter(r => !esperadas.has(r));
      const perdidas = esp.rules.filter(r => !obtidas.has(r));
      lines.push('  ~ #' + esp.id + ' regras divergem:');
      novas.forEach(r => lines.push('     + ' + r));
      perdidas.forEach(r => lines.push('     - ' + r));
    }
  });
  return lines;
}

// ─── Runner ──────────────────────────────────────────────────────────────────
let passou = 0, falhou = 0;
const results = {};

if (filter !== 'synthetic') {
  console.log('\n━━━ FIXTURES (demandas reais catalogadas) ━━━\n');
  const expected = JSON.parse(fs.readFileSync(EXPECTED_PATH, 'utf8'));
  const fixtures = listFixtures();

  if (fixtures.length === 0) {
    console.log('⚠ Nenhuma fixture encontrada em ' + FIXTURES_DIR);
    console.log('  Adicione arquivos .txt (uma descrição de demanda por arquivo, nome = ID).');
  }

  fixtures.forEach(fx => {
    const exp = expected[fx.id];
    if (!exp) {
      console.log('⚠ ' + fx.id + ' — sem expected.json (rode com --update-snapshots pra gravar)');
      if (updateSnapshots) {
        expected[fx.id] = { length: fx.ds.length, requirements: analyze(fx.ds) };
        results[fx.id] = 'snapshot novo';
      }
      return;
    }
    const obtido = analyze(fx.ds);
    const lengthOk = Math.abs(fx.ds.length - exp.length) <= 5; // tolera diferença minúscula (newline final, etc)
    if (deepEqual(obtido, exp.requirements) && lengthOk) {
      console.log('✅ ' + fx.id);
      passou++;
    } else {
      console.log('❌ ' + fx.id);
      if (!lengthOk) {
        console.log('  ⚠ tamanho do arquivo mudou: esperado=' + exp.length + ' atual=' + fx.ds.length);
      }
      diffSummary(exp.requirements, obtido).forEach(l => console.log(l));
      falhou++;
      if (updateSnapshots) {
        expected[fx.id] = { length: fx.ds.length, requirements: obtido };
      }
    }
  });

  if (updateSnapshots) {
    fs.writeFileSync(EXPECTED_PATH, JSON.stringify(expected, null, 2) + '\n');
    console.log('\n💾 expected.json regravado');
  }
}

if (filter !== 'fixtures') {
  console.log('\n━━━ CENÁRIOS SINTÉTICOS ━━━\n');
  SYNTHETIC.forEach(c => {
    const secs = splitSections(c.texto);
    const ids = secs.map(getReqIdFromSection).filter(Boolean);
    if (deepEqual(ids, c.esperado_ids)) {
      console.log('✅ ' + c.nome);
      passou++;
    } else {
      console.log('❌ ' + c.nome + '  (' + c.descricao + ')');
      console.log('   esperado: [' + c.esperado_ids.join(', ') + ']');
      console.log('   obtido:   [' + ids.join(', ') + ']');
      falhou++;
    }
  });
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Passou: ' + passou + '   Falhou: ' + falhou);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
process.exit(falhou > 0 ? 1 : 0);
