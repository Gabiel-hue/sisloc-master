// test_v35_9_com_regra_jatem.js
// Valida:
//   - Heurística "changelog já registrado": d.ds.includes('Demanda: #' + dId)
//   - Idempotência do addRelation (relação preexistente vs nova)
//   - Fluxo do botão extra: add → undo → re-add
//
// Roda standalone:  node tests/test_v35_9_com_regra_jatem.js
// Não depende da suite oficial (parser). Não muta expected.json.

'use strict';

const { JSDOM } = require('jsdom');
const { makeRelations } = require('./relations_logic');

let pass = 0, fail = 0;
function eq(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log('✅', label); }
  else    { fail++; console.log('❌', label, '\n   got=', got, '\n   want=', want); }
}
function truthy(label, got) {
  if (got) { pass++; console.log('✅', label); }
  else { fail++; console.log('❌', label, ' (esperava truthy, veio:', got, ')'); }
}
function throws(label, fn) {
  return fn().then(
    () => { fail++; console.log('❌', label, ' (não lançou)'); },
    () => { pass++; console.log('✅', label); }
  );
}

// ─── helpers ────────────────────────────────────────────────────────────────

function makeShowHtml(reqId, csrf, relations) {
  // relations: [{relId, demId}]
  const trs = relations.map(r =>
    `<tr id="relation-${r.relId}"><td><input name="ids[]" value="${r.demId}"/></td></tr>`
  ).join('');
  return `<!doctype html><html><head>
    <meta name="csrf-token" content="${csrf}"/>
    <title>Req #${reqId}</title>
  </head><body>
    <table id="relations"><tbody>${trs}</tbody></table>
  </body></html>`;
}

function makeMockFetch({ csrf, initialRelations, onPost }) {
  // Estado mutável das relações em memória
  let rels = [...initialRelations];
  let nextRelId = 9000;
  const calls = [];
  async function fetchFn(url, opts) {
    calls.push({ url, opts: opts ? { method: opts.method } : null });
    // GET /issues/<id>  → página show
    const showMatch = url.match(/\/issues\/(\d+)$/);
    if (showMatch && !opts) {
      return { ok: true, status: 200, text: async () => makeShowHtml(showMatch[1], csrf, rels) };
    }
    // POST /issues/<id>/relations → criar relação
    const createMatch = url.match(/\/issues\/(\d+)\/relations$/);
    if (createMatch && opts && opts.method === 'POST') {
      const demId = opts.body.get('relation[issue_to_id]');
      const relId = String(nextRelId++);
      rels.push({ relId, demId });
      if (onPost) onPost({ url, demId, relId });
      return { ok: true, status: 200, text: async () => '' };
    }
    // POST /relations/<relId>  com _method=delete  → apagar relação
    const delMatch = url.match(/\/relations\/(\d+)$/);
    if (delMatch && opts && opts.method === 'POST') {
      const relId = delMatch[1];
      const before = rels.length;
      rels = rels.filter(r => r.relId !== relId);
      if (rels.length === before) return { ok: false, status: 404, text: async () => '' };
      return { ok: true, status: 200, text: async () => '' };
    }
    return { ok: false, status: 404, text: async () => 'unknown ' + url };
  }
  return { fetch: fetchFn, calls, getRels: () => rels.slice() };
}

// jsdom dá DOMParser e FormData globais
const dom = new JSDOM('<!doctype html><html><body></body></html>');
global.DOMParser = dom.window.DOMParser;
global.FormData = dom.window.FormData;

// ─── T1: heurística "changelog já registrado" ──────────────────────────────
(function test_heuristica() {
  const dId = '208596';
  const ds_com   = '... bla ...\n\nh1. CHANGELOG\n\nDemanda: #208596\nTitulo da Demanda\n\n... bla ...';
  const ds_sem   = '... bla ...\n\nh1. CHANGELOG\n\nDemanda: #999999\nOutra demanda\n\n... bla ...';
  const ds_vazio = '... bla ...\n\nh1. CHANGELOG\n\n... bla ...';

  eq('T1a: detecta changelog desta demanda', ds_com.includes('Demanda: #' + dId), true);
  eq('T1b: NÃO detecta quando é outra demanda', ds_sem.includes('Demanda: #' + dId), false);
  eq('T1c: NÃO detecta quando changelog vazio', ds_vazio.includes('Demanda: #' + dId), false);
})();

// ─── T2..T5: comportamento do botão extra ──────────────────────────────────

async function test_botao_extra() {
  const REQ_ID = '46006';
  const DEM_ID = '208596';
  const CSRF = 'abc123' + 'x'.repeat(82); // simula token longo

  // ── T2: card sem relação preexistente → clicar cria nova ───────────────
  {
    const mock = makeMockFetch({
      csrf: CSRF,
      initialRelations: [
        { relId: '6348', demId: '39869' },  // outras demandas relacionadas
        { relId: '7569', demId: '48094' }
      ]
    });
    const { findRelation, addRelation, removeRelation } = makeRelations({
      fetch: mock.fetch, DOMParser: global.DOMParser, bUrl: '/redmine/issues/'
    });

    const before = await findRelation(REQ_ID, DEM_ID);
    eq('T2a: findRelation antes de criar → relId=null', before && before.relId, null);

    const res = await addRelation(REQ_ID, DEM_ID);
    eq('T2b: addRelation cria nova → alreadyExisted=false', res.alreadyExisted, false);
    truthy('T2c: addRelation retorna relId numérico', /^\d+$/.test(res.relId));
    eq('T2d: relação foi persistida no estado mock', mock.getRels().some(r => r.demId === DEM_ID), true);

    // Agora desfaz
    await removeRelation(REQ_ID, res.relId);
    eq('T2e: removeRelation tira a relação', mock.getRels().some(r => r.demId === DEM_ID), false);
  }

  // ── T3: card COM relação preexistente → addRelation é idempotente ──────
  {
    const mock = makeMockFetch({
      csrf: CSRF,
      initialRelations: [
        { relId: '6348', demId: '39869' },
        { relId: '8888', demId: DEM_ID }   // já existe!
      ]
    });
    const { addRelation } = makeRelations({
      fetch: mock.fetch, DOMParser: global.DOMParser, bUrl: '/redmine/issues/'
    });

    const res = await addRelation(REQ_ID, DEM_ID);
    eq('T3a: addRelation idempotente → alreadyExisted=true', res.alreadyExisted, true);
    eq('T3b: retorna o relId preexistente', res.relId, '8888');

    // Conta quantos POSTs foram feitos. Idempotente = NENHUM POST de criação.
    const posts = mock.calls.filter(c => c.opts && c.opts.method === 'POST').length;
    eq('T3c: idempotência NÃO faz POST de criação', posts, 0);
  }

  // ── T4: erro de HTTP ao criar relação ───────────────────────────────────
  {
    const mock = makeMockFetch({ csrf: CSRF, initialRelations: [] });
    // Sobrescreve o POST pra falhar
    const origFetch = mock.fetch;
    const fetchFail = async (url, opts) => {
      if (url.endsWith('/relations') && opts && opts.method === 'POST') {
        return { ok: false, status: 422, text: async () => 'erro de validação' };
      }
      return origFetch(url, opts);
    };
    const { addRelation } = makeRelations({
      fetch: fetchFail, DOMParser: global.DOMParser, bUrl: '/redmine/issues/'
    });

    await throws('T4: addRelation propaga erro quando POST falha (HTTP 422)',
      () => addRelation(REQ_ID, DEM_ID));
  }

  // ── T5: fluxo add → undo → add de novo ──────────────────────────────────
  {
    const mock = makeMockFetch({ csrf: CSRF, initialRelations: [] });
    const { addRelation, removeRelation } = makeRelations({
      fetch: mock.fetch, DOMParser: global.DOMParser, bUrl: '/redmine/issues/'
    });
    const r1 = await addRelation(REQ_ID, DEM_ID);
    eq('T5a: 1ª criação → alreadyExisted=false', r1.alreadyExisted, false);

    await removeRelation(REQ_ID, r1.relId);
    eq('T5b: estado após undo → relação removida',
      mock.getRels().some(r => r.demId === DEM_ID), false);

    const r2 = await addRelation(REQ_ID, DEM_ID);
    eq('T5c: 2ª criação → alreadyExisted=false (nova)', r2.alreadyExisted, false);
    eq('T5d: 2ª criação gera relId diferente', r2.relId !== r1.relId, true);
  }
}

// ─── T6: simulação do builder do card COM-REGRA (renderização condicional) ─
async function test_render_condicional() {
  // Mini-builder que simula só a parte nova: "deve incluir botão extra?".
  // Espelha exatamente o critério que vamos plantar no bookmarklet.
  function shouldShowExtraButton(d_ds, dId) {
    return d_ds.includes('Demanda: #' + dId);
  }

  const dId = '208596';
  // Caso A — changelog DESTA demanda já gravado (sessão anterior, ou fora-do-bookmarklet)
  eq('T6a: changelog da demanda atual presente → MOSTRA botão extra',
    shouldShowExtraButton('h1. CHANGELOG\n\nDemanda: #208596\nTítulo\n', dId), true);

  // Caso B — changelog de OUTRA demanda → não mostra
  eq('T6b: changelog de outra demanda → NÃO mostra botão extra',
    shouldShowExtraButton('h1. CHANGELOG\n\nDemanda: #777777\nOutro\n', dId), false);

  // Caso C — nenhum changelog → não mostra
  eq('T6c: nenhum changelog → NÃO mostra botão extra',
    shouldShowExtraButton('h1. CHANGELOG\n\n(vazio)\n', dId), false);

  // Caso D — múltiplos changelogs incluindo esta demanda → mostra
  eq('T6d: changelogs múltiplos incluindo esta demanda → MOSTRA',
    shouldShowExtraButton('h1. CHANGELOG\n\nDemanda: #111\n\nDemanda: #208596\nTítulo\n', dId), true);
}

// ─── runner ────────────────────────────────────────────────────────────────
(async () => {
  await test_botao_extra();
  await test_render_condicional();
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Passou: ${pass}   Falhou: ${fail}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(fail > 0 ? 1 : 0);
})();
