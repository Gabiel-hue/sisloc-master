// tests/test_v35_13_5_save_errors.js
// Testa o saveIssue v35.13.5 — detecção de errorExplanation + probe completo
//
// Cobre os cenários consolidados das v35.13.2/3/4/5:
//   - v35.13.2: extração de errorExplanation com bullet list HTML
//   - v35.13.3: HTTP 200 + errorExplanation (Redmine antigo render :edit)
//   - v35.13.4: querySelector resiliente a aspas simples vs duplas
//   - v35.13.5: probe pra extrair TODOS os erros (não só os do POST mínimo)
//
// Para rodar: cd ~/sm && node tests/test_v35_13_5_save_errors.js

const assert = require('assert');
const { JSDOM } = require('jsdom');

// ============= SETUP =============
// Stubs globais que o saveIssue usa no Chrome
global.DOMParser = new JSDOM().window.DOMParser;
global.FormData = class {
  constructor() { this.d = []; }
  append(k, v) { this.d.push([k, v]); }
  *[Symbol.iterator]() { yield* this.d; }
};

// bUrl: igual o bookmarklet usa
global.bUrl = 'http://net1/redmine/issues/';

// Extrair o saveIssue do bookmarklet
const fs = require('fs');
const path = require('path');
const BOOKMARKLET_PATH = path.join(__dirname, '..', 'sisloc_master.js');
const SRC = fs.readFileSync(BOOKMARKLET_PATH, 'utf8');
const startIdx = SRC.indexOf('async function saveIssue');
if (startIdx < 0) { console.error('❌ saveIssue não encontrado no bookmarklet'); process.exit(1); }
let depth = 0, started = false, i = startIdx;
while (i < SRC.length) {
  if (SRC[i] === '{') { depth++; started = true; }
  else if (SRC[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
  i++;
}
const fnSrc = SRC.slice(startIdx, i);
eval(fnSrc.replace('async function saveIssue', 'global.saveIssue = async function'));

// ============= HELPERS =============
function mockResponse(opts) {
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    url: opts.url ?? 'http://net1/redmine/issues/X',
    redirected: opts.redirected ?? false,
    text: async () => opts.body || ''
  };
}

// Mock de fetch sequencial: passa um array de responses, cada chamada consome 1
function mockFetchSequence(responses) {
  let i = 0;
  return async () => {
    if (i >= responses.length) throw new Error('fetch called more times than expected (' + (i+1) + ' vs ' + responses.length + ')');
    return responses[i++];
  };
}

let passed = 0, failed = 0;
function test(name, fn) {
  return fn().then(() => {
    console.log('  ✓ ' + name);
    passed++;
  }).catch(e => {
    console.log('  ✗ ' + name + ' — ' + (e.message || e));
    failed++;
  });
}

async function expectThrow(promise, msgIncludes) {
  try {
    await promise;
    throw new Error('Expected throw, but resolved');
  } catch (e) {
    if (msgIncludes && !e.message.includes(msgIncludes)) {
      throw new Error('Expected msg to include "' + msgIncludes + '", got: ' + e.message);
    }
    return e;
  }
}

// ============= TESTES =============

(async () => {
  console.log('=== Grupo A: caminho feliz (não-regressão) ===');

  await test('A1: HTTP 200 sem errorExplanation → sucesso silencioso', async () => {
    global.fetch = mockFetchSequence([
      mockResponse({ ok: true, status: 200, body: '<html><body><h2>Issue #1 saved</h2></body></html>' })
    ]);
    await saveIssue('1', 'desc', 'tk');
  });

  await test('A2: HTTP 200 com texto solto "errorExplanation" no body (sem id=) → sucesso', async () => {
    global.fetch = mockFetchSequence([
      mockResponse({ ok: true, status: 200, body: '<html><body>O campo errorExplanation deve ser preenchido.</body></html>' })
    ]);
    await saveIssue('1', 'desc', 'tk');
  });

  console.log('\n=== Grupo B: erros HTTP 4xx/5xx clássicos ===');

  await test('B1: HTTP 500 sem errorExplanation → "HTTP 500"', async () => {
    global.fetch = mockFetchSequence([
      mockResponse({ ok: false, status: 500, body: '<h1>Internal Server Error</h1>' }),
      // probe vai ser chamado também (fallback gracioso — vai falhar pq /edit não responde nada útil)
      mockResponse({ ok: false, status: 500, body: '<h1>500</h1>' })
    ]);
    const e = await expectThrow(saveIssue('1', 'd', 't'), 'HTTP 500');
    assert.ok(e.message === 'HTTP 500', 'msg deveria ser exatamente "HTTP 500", got: ' + e.message);
  });

  await test('B2: HTTP 422 com errorExplanation aspas duplas → formatado', async () => {
    global.fetch = mockFetchSequence([
      mockResponse({ ok: false, status: 422, body: '<div id="errorExplanation"><ul><li>Campo X</li></ul></div>' }),
      // probe (/edit) — sem form#issue-form → cai pra usar erros do POST original
      mockResponse({ ok: true, status: 200, body: '<html><body>nenhum form aqui</body></html>' })
    ]);
    const e = await expectThrow(saveIssue('60904', 'd', 't'));
    assert.ok(e.message.includes('O requisito #60904 retornou'), 'menciona requisito');
    assert.ok(e.message.includes('Campo X'), 'menciona erro');
    assert.ok(e.message.includes('Corrija no requisito'), 'menciona ação');
  });

  console.log('\n=== Grupo C: silent failure (HTTP 200 + errorExplanation) ===');

  await test('C1: HTTP 200 + errorExplanation aspas DUPLAS → detecta', async () => {
    global.fetch = mockFetchSequence([
      mockResponse({ ok: true, status: 200, body: '<html><div id="errorExplanation"><ul><li>Foo</li></ul></div></html>' }),
      mockResponse({ ok: true, status: 200, body: '<html>no form</html>' })
    ]);
    const e = await expectThrow(saveIssue('1', 'd', 't'));
    assert.ok(e.message.includes('Foo'), 'detectou erro');
  });

  await test('C2: HTTP 200 + errorExplanation aspas SIMPLES (Redmine real) → detecta', async () => {
    global.fetch = mockFetchSequence([
      mockResponse({ ok: true, status: 200, body: "<div id='errorExplanation'><ul><li>Plataforma blank</li></ul></div>" }),
      mockResponse({ ok: true, status: 200, body: 'no form' })
    ]);
    const e = await expectThrow(saveIssue('1', 'd', 't'));
    assert.ok(e.message.includes('Plataforma blank'), 'detectou aspas simples');
  });

  await test('C3: HTTP 200 + errorExplanation com espaços extras → detecta', async () => {
    global.fetch = mockFetchSequence([
      mockResponse({ ok: true, status: 200, body: '<div  id = "errorExplanation" ><ul><li>X</li></ul></div>' }),
      mockResponse({ ok: true, status: 200, body: 'no form' })
    ]);
    const e = await expectThrow(saveIssue('1', 'd', 't'));
    assert.ok(e.message.includes('X'), 'detectou com espaços');
  });

  console.log('\n=== Grupo D: probe completo (v35.13.5) ===');

  // HTML do form de edição (mínimo viável pra exercitar o probe)
  const editFormHtml = `<html><body>
    <form id="issue-form" action="/issues/60904" method="post" class="edit_issue">
      <input name="utf8" value="✓"/>
      <input name="_method" value="patch"/>
      <input name="authenticity_token" value="TOK"/>
      <input name="issue[subject]" value="Subject"/>
      <textarea name="issue[description]">desc original</textarea>
      <input name="issue[custom_field_values][2][]" value=""/>
      <input name="issue[custom_field_values][44][]" value=""/>
    </form>
  </body></html>`;

  await test('D1: POST original detecta 1 erro, probe detecta 2 → mostra os 2', async () => {
    global.fetch = mockFetchSequence([
      // POST original: 1 erro
      mockResponse({ ok: true, status: 200, body: "<div id='errorExplanation'><ul><li>Produto não pode estar em branco</li></ul></div>" }),
      // GET /edit: form completo
      mockResponse({ ok: true, status: 200, body: editFormHtml }),
      // POST probe: 2 erros
      mockResponse({ ok: true, status: 200, body: "<div id='errorExplanation'><ul><li>Plataforma não pode estar em branco</li><li>Produto não pode estar em branco</li></ul></div>" })
    ]);
    const e = await expectThrow(saveIssue('60904', 'd', 't'));
    assert.ok(e.message.includes('Plataforma'), 'mostra Plataforma do probe');
    assert.ok(e.message.includes('Produto'), 'mostra Produto');
    // Conta 2 <li>
    const liCount = (e.message.match(/<li>/g) || []).length;
    assert.strictEqual(liCount, 2, '2 <li> esperados, got ' + liCount);
  });

  await test('D2: POST original 1 erro, probe falha (rede) → fallback usa só os do POST', async () => {
    global.fetch = mockFetchSequence([
      mockResponse({ ok: true, status: 200, body: "<div id='errorExplanation'><ul><li>Erro único</li></ul></div>" }),
      mockResponse({ ok: false, status: 500, body: '<h1>down</h1>' }), // GET /edit falha
      mockResponse({ ok: false, status: 500, body: '<h1>down</h1>' })  // probe POST não chega a rodar
    ]);
    const e = await expectThrow(saveIssue('1', 'd', 't'));
    assert.ok(e.message.includes('Erro único'), 'fallback ok');
  });

  await test('D3: POST original 1 erro, probe não acha form#issue-form → fallback', async () => {
    global.fetch = mockFetchSequence([
      mockResponse({ ok: true, status: 200, body: "<div id='errorExplanation'><ul><li>Original</li></ul></div>" }),
      mockResponse({ ok: true, status: 200, body: '<html>página sem form</html>' })
    ]);
    const e = await expectThrow(saveIssue('1', 'd', 't'));
    assert.ok(e.message.includes('Original'), 'fallback para erros do POST original');
  });

  await test('D4: POST original 1 erro, probe sucesso mas sem erros → fallback', async () => {
    global.fetch = mockFetchSequence([
      mockResponse({ ok: true, status: 200, body: "<div id='errorExplanation'><ul><li>Original</li></ul></div>" }),
      mockResponse({ ok: true, status: 200, body: editFormHtml }),
      mockResponse({ ok: true, status: 200, body: '<html>saved</html>' }) // probe passou (caso raro)
    ]);
    const e = await expectThrow(saveIssue('1', 'd', 't'));
    assert.ok(e.message.includes('Original'), 'usa erros do POST original');
  });

  await test('D5: probe encontra MAIS erros que POST original (3 vs 1)', async () => {
    global.fetch = mockFetchSequence([
      mockResponse({ ok: true, status: 200, body: "<div id='errorExplanation'><ul><li>A</li></ul></div>" }),
      mockResponse({ ok: true, status: 200, body: editFormHtml }),
      mockResponse({ ok: true, status: 200, body: "<div id='errorExplanation'><ul><li>A</li><li>B</li><li>C</li></ul></div>" })
    ]);
    const e = await expectThrow(saveIssue('1', 'd', 't'));
    const liCount = (e.message.match(/<li>/g) || []).length;
    assert.strictEqual(liCount, 3, '3 erros do probe');
  });

  console.log('\n=== Grupo E: XSS guard / escape ===');

  await test('E1: chars perigosos no erro são escapados (<, >, &)', async () => {
    global.fetch = mockFetchSequence([
      mockResponse({ ok: false, status: 422, body: "<div id='errorExplanation'><ul><li>Campo &lt;X&gt; &amp; coisa</li></ul></div>" }),
      mockResponse({ ok: true, status: 200, body: 'no form' })
    ]);
    const e = await expectThrow(saveIssue('1', 'd', 't'));
    // Esperado: o & vira &amp; (escape duplo é OK — innerHTML reverte)
    assert.ok(e.message.includes('&amp;'), '& foi escapado: ' + e.message);
  });

  await test('E2: chars normais (acentos, espaços) preservados', async () => {
    global.fetch = mockFetchSequence([
      mockResponse({ ok: false, status: 422, body: "<div id='errorExplanation'><ul><li>Sprint Análise não pode ficar em branco</li></ul></div>" }),
      mockResponse({ ok: true, status: 200, body: 'no form' })
    ]);
    const e = await expectThrow(saveIssue('1', 'd', 't'));
    assert.ok(e.message.includes('Sprint Análise não pode ficar em branco'), 'acentos preservados');
  });

  console.log('\n=== Grupo F: estrutura da mensagem renderizada ===');

  await test('F1: mensagem inclui número do requisito', async () => {
    global.fetch = mockFetchSequence([
      mockResponse({ ok: false, status: 422, body: "<div id='errorExplanation'><ul><li>X</li></ul></div>" }),
      mockResponse({ ok: true, status: 200, body: 'no form' })
    ]);
    const e = await expectThrow(saveIssue('60904', 'd', 't'));
    assert.ok(e.message.includes('#60904'), 'inclui #60904');
  });

  await test('F2: mensagem termina com call-to-action "Corrija no requisito"', async () => {
    global.fetch = mockFetchSequence([
      mockResponse({ ok: false, status: 422, body: "<div id='errorExplanation'><ul><li>X</li></ul></div>" }),
      mockResponse({ ok: true, status: 200, body: 'no form' })
    ]);
    const e = await expectThrow(saveIssue('1', 'd', 't'));
    assert.ok(/Corrija no requisito e tente de novo\.?$/.test(e.message), 'termina com a ação');
  });

  await test('F3: mensagem usa <br> + <ul> + <li> (estrutura HTML)', async () => {
    global.fetch = mockFetchSequence([
      mockResponse({ ok: false, status: 422, body: "<div id='errorExplanation'><ul><li>X</li><li>Y</li></ul></div>" }),
      mockResponse({ ok: true, status: 200, body: 'no form' })
    ]);
    const e = await expectThrow(saveIssue('1', 'd', 't'));
    assert.ok(e.message.startsWith('<br>'), 'começa com <br>');
    assert.ok(e.message.includes('<ul'), 'tem <ul>');
    assert.ok(e.message.includes('<li>X</li><li>Y</li>'), 'tem os <li> corretos');
  });

  await test('F4: errorExplanation sem <li> → cai pro genérico HTTP <status>', async () => {
    global.fetch = mockFetchSequence([
      mockResponse({ ok: false, status: 422, body: "<div id='errorExplanation'><h2>Header só</h2></div>" }),
      mockResponse({ ok: true, status: 200, body: 'no form' })
    ]);
    const e = await expectThrow(saveIssue('1', 'd', 't'));
    assert.ok(e.message === 'HTTP 422', 'genérico se não tem <li>: ' + e.message);
  });

  await test('F5: <li> vazio é filtrado (filter(Boolean))', async () => {
    global.fetch = mockFetchSequence([
      mockResponse({ ok: false, status: 422, body: "<div id='errorExplanation'><ul><li></li><li>Real erro</li><li>   </li></ul></div>" }),
      mockResponse({ ok: true, status: 200, body: 'no form' })
    ]);
    const e = await expectThrow(saveIssue('1', 'd', 't'));
    const liCount = (e.message.match(/<li>/g) || []).length;
    assert.strictEqual(liCount, 1, 'só 1 <li> não vazio');
    assert.ok(e.message.includes('Real erro'), 'pegou o real');
  });

  console.log('\n=== Grupo G: edge cases ===');

  await test('G1: response body vazio em erro → HTTP <status>', async () => {
    global.fetch = mockFetchSequence([
      mockResponse({ ok: false, status: 500, body: '' }),
      mockResponse({ ok: false, status: 500, body: '' })
    ]);
    const e = await expectThrow(saveIssue('1', 'd', 't'));
    assert.ok(e.message === 'HTTP 500', e.message);
  });

  await test('G2: response body com HTML malformado → não quebra (try/catch)', async () => {
    global.fetch = mockFetchSequence([
      mockResponse({ ok: false, status: 500, body: '<div id="errorExplanation"><ul><li>quebrado' }),
      mockResponse({ ok: true, status: 200, body: 'no form' })
    ]);
    // DOMParser é tolerante a HTML malformado, então isso pode até pegar
    // o erro. Mas o importante é não quebrar.
    try { await saveIssue('1', 'd', 't'); throw new Error('Expected throw'); }
    catch (e) { assert.ok(e.message.length > 0, 'tem alguma msg'); }
  });

  await test('G3: probe vai pra URL correta /edit', async () => {
    let editUrl = null;
    let postProbeUrl = null;
    let callIdx = 0;
    global.fetch = async (url, opts) => {
      callIdx++;
      if (callIdx === 1) {
        // POST original
        return mockResponse({ ok: true, status: 200, body: "<div id='errorExplanation'><ul><li>X</li></ul></div>" });
      } else if (callIdx === 2) {
        editUrl = url;
        return mockResponse({ ok: true, status: 200, body: editFormHtml });
      } else if (callIdx === 3) {
        postProbeUrl = url;
        return mockResponse({ ok: true, status: 200, body: "<div id='errorExplanation'><ul><li>X</li><li>Y</li></ul></div>" });
      }
    };
    try { await saveIssue('60904', 'd', 't'); throw new Error('Expected throw'); } catch (_) {}
    assert.ok(editUrl && editUrl.endsWith('/60904/edit'), 'GET probe vai pra /60904/edit, got: ' + editUrl);
    assert.ok(postProbeUrl && postProbeUrl.endsWith('/60904'), 'POST probe vai pra /60904');
  });

  await test('G4: probe NÃO roda no caminho feliz (apenas 1 fetch)', async () => {
    let fetchCount = 0;
    global.fetch = async () => {
      fetchCount++;
      return mockResponse({ ok: true, status: 200, body: '<html>ok</html>' });
    };
    await saveIssue('1', 'd', 't');
    assert.strictEqual(fetchCount, 1, 'apenas 1 fetch no caminho feliz');
  });

  await test('G5: descrição idêntica no POST original (não muda nc passado)', async () => {
    let bodyEnviado = null;
    global.fetch = async (url, opts) => {
      if (!bodyEnviado) {
        // captura o FormData do POST original
        const arr = [...opts.body];
        bodyEnviado = arr.find(([k]) => k === 'issue[description]');
      }
      return mockResponse({ ok: true, status: 200, body: '<html>ok</html>' });
    };
    await saveIssue('1', 'minha descrição original', 'tk');
    assert.strictEqual(bodyEnviado[1], 'minha descrição original', 'desc passada intacta');
  });

  // ============= TOTAL =============
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`TOTAL: ${passed + failed}  |  ✓ ${passed}  |  ✗ ${failed}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(failed ? 1 : 0);
})();
