// Testes da feature v35.10 — título editável no changelog
// Modela a lógica pura (sem DOM) do que vai entrar no bookmarklet:
//   - getEffectiveTitle(input.value, dTitle)
//   - validateTitle(value)
//   - buildChLog(dId, effectiveTitle)
//   - isModified(currentValue, dTitle)

'use strict';

// ============================================================
// LÓGICA QUE VAI ENTRAR NO BOOKMARKLET (espelho limpo)
// ============================================================

// Sanitiza o valor do input (trim) e retorna { ok, value | error }
function validateTitle(rawValue) {
  if (typeof rawValue !== 'string') return { ok: false, error: 'TITULO_INVALIDO' };
  const trimmed = rawValue.trim();
  if (trimmed.length === 0) return { ok: false, error: 'TITULO_VAZIO' };
  if (trimmed.length > 300) return { ok: false, error: 'TITULO_MUITO_LONGO' };
  return { ok: true, value: trimmed };
}

// Constrói o trecho do changelog que vai ser injetado na descrição do requisito
function buildChLog(dId, effectiveTitle) {
  return '\n\nDemanda: #' + dId + '\n' + effectiveTitle + '\n';
}

// Compara o valor atual do input com o título original (trim em ambos)
function isModified(currentValue, dTitle) {
  return String(currentValue || '').trim() !== String(dTitle || '').trim();
}

// ============================================================
// RUNNER
// ============================================================

let pass = 0, fail = 0;
const failures = [];

function t(name, fn) {
  try {
    fn();
    pass++;
    console.log('  ✓ ' + name);
  } catch (e) {
    fail++;
    failures.push({ name: name, err: e.message });
    console.log('  ✗ ' + name + '\n      ' + e.message);
  }
}

function eq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error((label || '') + ' esperado: ' + JSON.stringify(expected) + ' | recebido: ' + JSON.stringify(actual));
  }
}

function deepEq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error((label || '') + ' esperado: ' + e + ' | recebido: ' + a);
}

// ============================================================
// FIXTURE BASE — caso da imagem (req #46006, demanda fictícia)
// ============================================================

const dId = '207508';
const dTitle = 'Enviar Boletim de Medição - Envio do BM';

console.log('\n=== v35.10 — Título editável no changelog ===\n');

// ------------------------------------------------------------
// GRUPO 1 — validateTitle
// ------------------------------------------------------------
console.log('[1] validateTitle()');

t('título original passa', function() {
  const r = validateTitle(dTitle);
  deepEq(r, { ok: true, value: dTitle });
});

t('título editado normal passa', function() {
  const r = validateTitle('Envio do Boletim de Medição (fase 1)');
  deepEq(r, { ok: true, value: 'Envio do Boletim de Medição (fase 1)' });
});

t('título com espaços nas pontas é trimado', function() {
  const r = validateTitle('  Título com espaços  ');
  deepEq(r, { ok: true, value: 'Título com espaços' });
});

t('título vazio bloqueia (TITULO_VAZIO)', function() {
  const r = validateTitle('');
  deepEq(r, { ok: false, error: 'TITULO_VAZIO' });
});

t('título só de espaços bloqueia (TITULO_VAZIO)', function() {
  const r = validateTitle('     ');
  deepEq(r, { ok: false, error: 'TITULO_VAZIO' });
});

t('título só com \\t \\n bloqueia (TITULO_VAZIO)', function() {
  const r = validateTitle('\t\n  \n\t');
  deepEq(r, { ok: false, error: 'TITULO_VAZIO' });
});

t('título com 300 chars exatos passa', function() {
  const longo = 'A'.repeat(300);
  const r = validateTitle(longo);
  deepEq(r, { ok: true, value: longo });
});

t('título com 301 chars bloqueia (TITULO_MUITO_LONGO)', function() {
  const longo = 'A'.repeat(301);
  const r = validateTitle(longo);
  deepEq(r, { ok: false, error: 'TITULO_MUITO_LONGO' });
});

t('título com 300 chars + espaços nas pontas → trim → 300, passa', function() {
  const r = validateTitle('  ' + 'B'.repeat(300) + '  ');
  deepEq(r, { ok: true, value: 'B'.repeat(300) });
});

t('input null bloqueia (TITULO_INVALIDO)', function() {
  const r = validateTitle(null);
  deepEq(r, { ok: false, error: 'TITULO_INVALIDO' });
});

t('input undefined bloqueia (TITULO_INVALIDO)', function() {
  const r = validateTitle(undefined);
  deepEq(r, { ok: false, error: 'TITULO_INVALIDO' });
});

// ------------------------------------------------------------
// GRUPO 2 — buildChLog
// ------------------------------------------------------------
console.log('\n[2] buildChLog()');

t('chLog com título original bate com o formato atual (v35.9)', function() {
  const ch = buildChLog(dId, dTitle);
  const esperado = '\n\nDemanda: #207508\nEnviar Boletim de Medição - Envio do BM\n';
  eq(ch, esperado, 'chLog original');
});

t('chLog com título editado usa o novo título', function() {
  const ch = buildChLog(dId, 'Envio do Boletim de Medição (fase 1)');
  const esperado = '\n\nDemanda: #207508\nEnvio do Boletim de Medição (fase 1)\n';
  eq(ch, esperado, 'chLog editado');
});

t('chLog mantém prefixo \\n\\n (compatível com indexOf do rollback)', function() {
  const ch = buildChLog(dId, dTitle);
  if (!ch.startsWith('\n\n')) throw new Error('chLog precisa começar com \\n\\n pro rollback achar via indexOf');
});

t('chLog termina com \\n (compatível com slice do rollback)', function() {
  const ch = buildChLog(dId, dTitle);
  if (!ch.endsWith('\n')) throw new Error('chLog precisa terminar com \\n');
});

t('chLog sempre tem 4 linhas no total (vazia, vazia, "Demanda: #N", título)', function() {
  const ch = buildChLog(dId, 'X');
  const linhas = ch.split('\n');
  // ['', '', 'Demanda: #207508', 'X', '']  → 5 elementos (4 \n)
  eq(linhas.length, 5, 'split por \\n');
  eq(linhas[2], 'Demanda: #207508');
  eq(linhas[3], 'X');
});

// ------------------------------------------------------------
// GRUPO 3 — isModified
// ------------------------------------------------------------
console.log('\n[3] isModified()');

t('original vs original → false', function() {
  eq(isModified(dTitle, dTitle), false);
});

t('original + espaços extras vs original → false (trim)', function() {
  eq(isModified('  ' + dTitle + '  ', dTitle), false);
});

t('texto diferente → true', function() {
  eq(isModified('Outro título', dTitle), true);
});

t('vazio quando original tem texto → true (sinaliza editado pra bloqueio depois)', function() {
  eq(isModified('', dTitle), true);
});

t('só espaços vs título com texto → true', function() {
  eq(isModified('   ', dTitle), true);
});

t('null vs original → true', function() {
  eq(isModified(null, dTitle), true);
});

// ------------------------------------------------------------
// GRUPO 4 — integração: ciclo edit → restore → edit
// ------------------------------------------------------------
console.log('\n[4] Ciclo de edição (simulação dos 4 estados)');

t('estado 1: abre com original, não modificado, chLog igual ao atual da v35.9', function() {
  let inputValue = dTitle; // input renderizado com value=dTitle
  eq(isModified(inputValue, dTitle), false);
  const v = validateTitle(inputValue);
  if (!v.ok) throw new Error('deveria passar');
  eq(buildChLog(dId, v.value), '\n\nDemanda: #207508\nEnviar Boletim de Medição - Envio do BM\n');
});

t('estado 2→3: usuário digita, vira modified', function() {
  let inputValue = dTitle;
  // simula digitação
  inputValue = 'Envio do Boletim de Medição (fase 1)';
  eq(isModified(inputValue, dTitle), true);
  const v = validateTitle(inputValue);
  if (!v.ok) throw new Error('deveria passar');
  eq(buildChLog(dId, v.value), '\n\nDemanda: #207508\nEnvio do Boletim de Medição (fase 1)\n');
});

t('estado 3→1: click no ↺ restaura original e zera modified', function() {
  let inputValue = 'Outro texto qualquer';
  // simula click ↺
  inputValue = dTitle;
  eq(isModified(inputValue, dTitle), false);
  const v = validateTitle(inputValue);
  eq(buildChLog(dId, v.value), '\n\nDemanda: #207508\nEnviar Boletim de Medição - Envio do BM\n');
});

t('estado 3→4: usuário fecha edição com ✓, mantém modificado', function() {
  // estado 3: modificado, em edit
  let inputValue = 'Custom';
  let editMode = true;
  // simula click ✓
  editMode = false;
  // texto continua modificado, view mode
  eq(isModified(inputValue, dTitle), true);
  eq(editMode, false);
});

t('estado 4→2: click no ✏️ reabre edit mantendo o texto', function() {
  let inputValue = 'Custom';
  let editMode = false;
  // click ✏️
  editMode = true;
  // valor preservado
  eq(inputValue, 'Custom');
  eq(editMode, true);
  eq(isModified(inputValue, dTitle), true);
});

// ------------------------------------------------------------
// GRUPO 5 — bloqueio na hora de gravar
// ------------------------------------------------------------
console.log('\n[5] Bloqueio ao clicar Gravar com título vazio');

function trySave(inputValue, dId) {
  const v = validateTitle(inputValue);
  if (!v.ok) {
    return { saved: false, reason: v.error };
  }
  return { saved: true, chLog: buildChLog(dId, v.value) };
}

t('Gravar com título original → OK', function() {
  const r = trySave(dTitle, dId);
  eq(r.saved, true);
  eq(r.chLog, '\n\nDemanda: #207508\nEnviar Boletim de Medição - Envio do BM\n');
});

t('Gravar com título editado válido → OK', function() {
  const r = trySave('Novo título', dId);
  eq(r.saved, true);
  eq(r.chLog, '\n\nDemanda: #207508\nNovo título\n');
});

t('Gravar com título vazio → bloqueado (TITULO_VAZIO)', function() {
  const r = trySave('', dId);
  eq(r.saved, false);
  eq(r.reason, 'TITULO_VAZIO');
});

t('Gravar com título só espaços → bloqueado (TITULO_VAZIO)', function() {
  const r = trySave('   ', dId);
  eq(r.saved, false);
  eq(r.reason, 'TITULO_VAZIO');
});

t('Gravar com título de 301 chars → bloqueado (TITULO_MUITO_LONGO)', function() {
  const r = trySave('A'.repeat(301), dId);
  eq(r.saved, false);
  eq(r.reason, 'TITULO_MUITO_LONGO');
});

// ------------------------------------------------------------
// GRUPO 6 — Compatibilidade com rollback existente
// ------------------------------------------------------------
console.log('\n[6] Compatibilidade com rollback (v35.6+)');

t('rollback acha o chLog editado via indexOf', function() {
  const chLog = buildChLog(dId, 'Título customizado');
  // simula descrição do requisito depois de gravar
  const descricaoApos = 'h3. CHANGELOG\n\nDemanda: #99999\nOutra coisa\n\nDemanda: #' + dId + '\nTítulo customizado\n\n--- FIM';
  const idx = descricaoApos.indexOf(chLog);
  if (idx === -1) throw new Error('chLog não foi achado na descrição para rollback');
});

t('chLogs com títulos diferentes não colidem no indexOf', function() {
  const chLog1 = buildChLog(dId, 'A');
  const chLog2 = buildChLog(dId, 'B');
  if (chLog1 === chLog2) throw new Error('chLogs deveriam ser diferentes');
  if (chLog1.includes(chLog2) || chLog2.includes(chLog1)) {
    throw new Error('chLogs não podem ser substring um do outro');
  }
});

// ------------------------------------------------------------
// GRUPO 7 — Detecção do "chJaTem" (v35.9) continua funcionando
// ------------------------------------------------------------
console.log('\n[7] Heurística chJaTem (v35.9) é INDEPENDENTE do título');

t('chJaTem detecta independente do título usado (foi editado em sessão passada)', function() {
  // simula req gravado com título editado em sessão anterior
  const reqDs = 'CONDIÇÕES/REGRAS:\n\nRN1 - X\n\nh1. CHANGELOG\n\nDemanda: #' + dId + '\nQualquer Título Que Foi Editado\n';
  const chJaTem = reqDs.includes('Demanda: #' + dId);
  eq(chJaTem, true, 'heurística detecta por id, não por título');
});

t('chJaTem detecta com título original também', function() {
  const reqDs = 'h1. CHANGELOG\n\nDemanda: #' + dId + '\n' + dTitle + '\n';
  eq(reqDs.includes('Demanda: #' + dId), true);
});

// ============================================================
// SUMÁRIO
// ============================================================
console.log('\n========================================');
console.log('Total: ' + (pass + fail) + ' | ✓ ' + pass + ' | ✗ ' + fail);
console.log('========================================');
if (fail > 0) {
  console.log('\nFALHAS:');
  failures.forEach(function(f) { console.log('  - ' + f.name + ': ' + f.err); });
  process.exit(1);
}
process.exit(0);
