// relations_logic.js — espelho das funções de relação do bookmarklet
// (findRelation, addRelation, removeRelation) com fetch injetável para testes Node.
//
// Mesma assinatura do código no sisloc_master.js. NÃO importe nada do bookmarklet
// — copie e cole quando atualizar. Manter idêntico aos regexes/seletores.

'use strict';

function makeRelations(deps) {
  const fetch = deps.fetch;                  // (url, opts) => Promise<{ok, status, text(): Promise<string>}>
  const DOMParser = deps.DOMParser;          // construtor
  const bUrl = deps.bUrl || '/redmine/issues/';

  async function findRelation(reqId, demId) {
    try {
      const r = await fetch(bUrl + reqId);
      if (!r.ok) return null;
      const t = await r.text();
      const d = new DOMParser().parseFromString(t, 'text/html');
      const meta = d.querySelector('meta[name="csrf-token"]');
      const tk = meta ? meta.content : null;
      const trs = d.querySelectorAll('tr[id^="relation-"]');
      for (const tr of trs) {
        const cb = tr.querySelector('input[name="ids[]"]');
        if (cb && cb.value === String(demId)) {
          return { relId: tr.id.replace('relation-', ''), tk: tk };
        }
      }
      return { relId: null, tk: tk };
    } catch (e) {
      return null;
    }
  }

  async function addRelation(reqId, demId) {
    const ex = await findRelation(reqId, demId);
    if (!ex || !ex.tk) throw new Error('falha ao ler página do requisito');
    if (ex.relId) return { alreadyExisted: true, relId: ex.relId };
    const fd = new FormData();
    fd.append('utf8', '✓');
    fd.append('authenticity_token', ex.tk);
    fd.append('relation[relation_type]', 'relates');
    fd.append('relation[issue_to_id]', String(demId));
    const r = await fetch(bUrl + reqId + '/relations', { method: 'POST', body: fd });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const after = await findRelation(reqId, demId);
    if (!after || !after.relId) throw new Error('relação criada mas relId não encontrado');
    return { alreadyExisted: false, relId: after.relId };
  }

  async function removeRelation(reqId, relId) {
    const ex = await findRelation(reqId, 0);
    if (!ex || !ex.tk) throw new Error('falha ao ler página do requisito');
    const fd = new FormData();
    fd.append('_method', 'delete');
    fd.append('authenticity_token', ex.tk);
    const relBase = bUrl.replace('/issues/', '/relations/');
    const r = await fetch(relBase + relId, { method: 'POST', body: fd });
    if (!r.ok) throw new Error('HTTP ' + r.status);
  }

  return { findRelation, addRelation, removeRelation };
}

module.exports = { makeRelations };
