// extract_logic.js — versão LIMPA das funções de parsing do Sisloc Master
// Espelha o bookmarklet sisloc_master.js (raiz do repo) na versão atual.
//
// ⚠️ MANTER SINCRONIZADO COM O BOOKMARKLET:
// Sempre que mudar a lógica de parsing no sisloc_master.js, atualizar este arquivo também.
// Os regexes devem ser IDÊNTICOS aos da versão minificada.
//
// Funções exportadas:
//   - extractRules(sec): [{title, content, _reqsearch?}]
//   - splitSections(ds): string[]  (já aplicando o corte por h1. Detalhamento de Projeto)
//   - getReqIdFromSection(sec): string | null
//   - getReqSectionBounds(ds, reqId): {start, end} | null
//   - buildPlaceholderMap(ds): [{id, title}]
//   - analyze(ds): [{id, rules: string[]}]  (pipeline completo)
//
// Versão espelhada: v35.11.3
// Mudanças desde a v35.11.1:
//   v35.11.2 — Fix do split do dSections: 1ª alternativa "REQUISITO ##N" ancorada em
//              início de linha com "(?<=^|\n)\s*(?:h\d+\.\s*)?" pra não casar menções
//              tipo "no requisito #N abaixo" em linguagem natural (caso #196911).
//              "h\d+\." opcional preserva suporte a "h2. REQUISITO ..." (caso #206262).
//   v35.11.3 — 2 fixes no extractRules pra eliminar lixo no título de regras link-only:
//              (1) linkPostMatch: "[^\s]+\s*" trocado por "\S+\s+" — exige whitespace
//                  obrigatório após o URL pra ativar o branch "título depois do link".
//                  Antes, '"RN10":URL' (sem nada após) cedia o último char do URL pro
//                  grupo (.+?)$ e virava "RN10 - 0".
//              (2) Normalização final: replace incondicional '$1 - ' trocado por callback
//                  condicional que só adiciona ' - ' se há texto remanescente após o RN.
//                  Antes, 'RN10' puro virava 'RN10 -' (hífen trailing artificial).

'use strict';

function extractRules(sec) {
  sec = sec
    .replace(/\u00B2/g, '2').replace(/\u00B3/g, '3').replace(/\u00B9/g, '1')
    .replace(/\u2070/g, '0').replace(/\u2074/g, '4').replace(/\u2075/g, '5')
    .replace(/\u2076/g, '6').replace(/\u2077/g, '7').replace(/\u2078/g, '8')
    .replace(/\u2079/g, '9');

  const rulesMatch = sec.match(/(?:\*\s*)?(?:CONDI[CÇ][OÕ]ES\/REGRAS|REGRAS)\s*\*?\s*:?\s*\*?\s+([\s\S]*?)(?=\n\s*\*?(?:REQUISITO|Requisito|h\d+\.\s*Requisito)|\n\s*h3\.\s*#{1,2}\s*\d+|\n\s*---|$)/i);
  if (!rulesMatch) return [];

  const rules = [];
  // v35.6.6: aceita "RN" puro quando vem seguido de espaço(s) + hífen/endash (lookahead)
  // v35.11: 3ª alternativa fora do escopo do \b cobre o padrão reqsearch
  //         ["\u201C\u201D](?:\d+|RN[A-Z0-9]*)\s*[-–]
  //         (dígitos puros, RN-placeholder, ou RN vazio seguido de hífen)
  //         A trava de URL reqsearch fica no forEach (regex completo abaixo).
  const parts = rulesMatch[1].split(/\n(?=\s*(?:#{1,2}\s+)?(?:\([^)]*\)\s*)?(?:h\d+\.\s*)?(?:\*?(?:["\u201C\u201D]RN\s?[A-Z0-9]+(?:\.\d+)?|RN(?:\s?[A-Z0-9]+(?:\.\d+)?|(?=\s+[-–])))\*?\b|["\u201C\u201D](?:\d+|RN[A-Z0-9]*)\s*[-–]))/i);

  parts.forEach(function (part) {
    let t = part.trim().replace(/^h\d+\.\s*/, '');
    if (!t) return;
    if (t.startsWith('|')) return;
    t = t.replace(/^#{1,2}\s+/, '');

    // v35.11: Branch reqsearch — ANTES do strip de parênteses (o "(Verbo)" é parte
    // do que vamos guardar em _reqsearch.verbo pro Atualizar Links recompor).
    // Aceita 3 grupos de identificador antigo (antes do " - "):
    //   - dígitos puros: "2462"
    //   - RN-placeholder: "RNX", "RNx", "RNX1", "RNA", "RN5", etc.
    //   - RN vazio: só "RN"
    // Trava de segurança: a URL precisa conter "reqsearch" literal pra entrar no branch.
    const reReqsearch = /^(\([^)]*\)\s*)?["\u201C\u201D]((?:\d+|RN[A-Z0-9]*))\s*[-–]\s*([^\n\r]+?)["\u201C\u201D]:(https?:\/\/[^\s]*reqsearch[^\s]+)/i;
    const mReq = t.match(reReqsearch);
    if (mReq) {
      const verbo = (mReq[1] || '').trim();    // ex: "(Alterar)" ou ""
      const oldId = mReq[2];                    // ex: "2462" ou "RNX" ou "RN"
      const titulo = mReq[3].trim();            // ex: "Parâmetro Máscara..."
      const urlReq = mReq[4];                   // URL reqsearch original
      const lines = t.split('\n');
      let content = lines.slice(1).join('\n').trim();
      content = content.replace(/\n\s*---[\s\S]*$/g, '').trim();
      rules.push({
        title: 'RN - ' + titulo,
        content: content,
        _reqsearch: { verbo: verbo, oldId: oldId, oldUrl: urlReq }
      });
      return;
    }

    t = t.replace(/^\([^)]*\)\s*/, '');
    // v35.6.6: strip de markdown também aceita RN puro (sem código)
    t = t.replace(/^\*(RN(?:\s?[A-Z0-9]+(?:\.\d+)?)?)\*/i, '$1')
         .replace(/^\*(RN(?:\s?[A-Z0-9]+(?:\.\d+)?)?[^\n*]*)\*\s*$/im, '$1')
         .replace(/^\*(RN(?:\s?[A-Z0-9]+(?:\.\d+)?)?[^\n*]*)$/im, '$1');

    // v35.6.6: verificação de início de regra também aceita RN puro + hífen
    if (t.match(/^(?:["\u201C\u201D]RN\s?[A-Z0-9]+(?:\.\d+)?|RN(?:\s?[A-Z0-9]+(?:\.\d+)?|(?=\s+[-–]))\b)/i)) {
      const lines = t.split('\n');
      let rawTitle = lines[0].trim();

      // v35.5.9 — título DEPOIS do link: "RN1":URL - Título
      // v35.11.2 — \s+ obrigatório após URL (era \s*). Antes, com [^\s]+\s*[-–—:]?\s*(.+?)$
      //            o regex disparava errado em "RN10":URL (sem título) porque o engine
      //            cedia o último char do URL pro grupo (.+?) — virava "RN10 - 0".
      const linkPostMatch = lines[0].match(/^["\u201C\u201D](RN\s?[A-Z0-9]+(?:\.\d+)?)["\u201C\u201D]:https?:\/\/\S+\s+[-–—:]?\s*(.+?)$/i);
      if (linkPostMatch) {
        rawTitle = linkPostMatch[1].trim() + ' - ' + linkPostMatch[2].trim();
      }

      // aspas curvas / retas com título dentro
      const aspaMatch = rawTitle.match(/^["\u201C\u201D](RN\s?[A-Z0-9]+(?:\.\d+)?[^:\n"\u201C\u201D]*?)(?:["\u201C\u201D]|:|$)/i);
      if (aspaMatch) {
        rawTitle = aspaMatch[1].trim();
      }

      rawTitle = rawTitle.replace(/\*/g, '')
                         // v35.6.6: normalização do título aceita RN puro
                         // v35.11.2: " - " só é adicionado quando HÁ texto após o RN.
                         //           Antes, '$1 - ' incondicional virava "RN10" → "RN10 -"
                         //           (com hífen trailing feio mesmo sem título adicional).
                         .replace(/^(RN(?:\s?[A-Z0-9]+(?:\.\d+)?)?)\s*[-–:]?\s*(.*)$/i,
                                  function (_, rn, rest) { return rest ? rn + ' - ' + rest : rn; })
                         .replace(/:$/, '')
                         .trim();

      let content = lines.slice(1).join('\n').trim();
      // v35.6.7: corta só por --- (não mais por \n\s*h\d+\.) — preserva h2/h3 internos da regra
      content = content.replace(/\n\s*---[\s\S]*$/g, '').trim();

      if (!rawTitle.match(/CEN[AÁ]RIOS/i)) {
        rules.push({ title: rawTitle, content: content });
      }
    }
  });

  return rules;
}

function splitSections(ds) {
  const detM = ds.match(/h1\.\s*Detalhamento\s+de\s+Projeto/i);
  const area = detM ? ds.slice(detM.index) : ds;
  // v35.6.5: nova alternativa "\n\s*#\d+\s*[-–]" cobre cabeçalhos #N - Título sem h3.
  // v35.11.2: 1ª alternativa ancorada em início de linha c/ "(?<=^|\n)\s*(?:h\d+\.\s*)?"
  //           pra não casar menções tipo "no requisito #N abaixo" em linguagem natural.
  //           "h\d+\.\s*" opcional preserva suporte a "h2. REQUISITO ..." (fixture 206262).
  return area.split(/(?=(?:(?<=^|\n)\s*(?:h\d+\.\s*)?REQUISITO\s*:?\s*#{0,2}\s*\d+|h3\.\s*Requisito[\s:]*(?:Requisito\s+)?(?:Funcional\s+)?#{0,2}\s*\d+|h3\.\s*#{1,2}\s*\d+|\n\s*#\d+\s*[-–]))/i);
}

function getReqIdFromSection(sec) {
  const m = sec.match(/Requisito[\s:]*(?:Requisito\s+)?(?:Funcional\s+)?#{0,2}\s*(\d+)/i)
         || sec.match(/^h3\.\s*#{1,2}\s*(\d+)/im)
         || sec.match(/^\s*#(\d+)\s*[-–]/);  // v35.6.5: fallback estrito (sem flag m)
  return m ? m[1] : null;
}

function getReqSectionBounds(ds, reqId) {
  const reDetalhe = new RegExp('h3\\.\\s*Requisito[\\s:]*(?:Requisito\\s+)?(?:Funcional\\s+)?#{0,2}\\s*' + reqId + '\\b', 'i');
  let startM = ds.match(reDetalhe);
  if (!startM) {
    const reH3Hash = new RegExp('h3\\.\\s*#{1,2}\\s*' + reqId + '\\b', 'i');
    startM = ds.match(reH3Hash);
  }
  if (!startM) {
    // v35.6.5: fallback de #N - X só DENTRO da área pós-detalhamento (pra não pegar listagem do topo)
    const detM2 = ds.match(/h1\.\s*Detalhamento\s+de\s+Projeto/i);
    const offset = detM2 ? detM2.index : 0;
    const reHashHeader = new RegExp('(?:^|\\n)\\s*#' + reqId + '\\s*[-–]', '');
    const mH = ds.slice(offset).match(reHashHeader);
    if (mH) startM = { index: offset + mH.index, 0: mH[0] };
  }
  if (!startM) {
    const reAny = new RegExp('(?:REQUISITO|Requisito)\\s*:?\\s*#{0,2}\\s*' + reqId + '\\b', 'i');
    startM = ds.match(reAny);
  }
  if (!startM) return null;
  const start = startM.index;
  const afterStart = ds.slice(start + startM[0].length);
  // v35.6.5: nextM também aceita "\n\s*#\d+\s*[-–]" como delimitador de fim
  const nextM = afterStart.match(/(?:\n\s*h3\.\s*Requisito[\s:]*(?:Requisito\s+)?(?:Funcional\s+)?#{0,2}\s*\d+|\n\s*REQUISITO\s*:?\s*#{0,2}\s*\d+|\n\s*h3\.\s*#{1,2}\s*\d+|\n\s*#\d+\s*[-–])/i);
  const end = nextM ? start + startM[0].length + nextM.index : ds.length;
  return { start: start, end: end };
}

function buildPlaceholderMap(ds) {
  const map = [];
  const listSections = ds.match(/h1\.\s*Requisitos?\s*(?:Impactados?|Novos?)([\s\S]*?)(?=\nh1\.|\n---\s*\nh1\.|$)/gi);
  if (!listSections) return map;
  listSections.forEach(function (sec) {
    sec.split('\n').forEach(function (line) {
      const m = line.match(/^#{0,2}\s*(\d+)\s*[-–]\s*(.+)/);
      if (m) map.push({ id: m[1], title: m[2].trim().toLowerCase() });
    });
  });
  return map;
}

// Pipeline completo — usado pelo run_tests.js
function analyze(ds) {
  const secs = splitSections(ds);
  const reqs = [];
  secs.forEach(function (sec) {
    const id = getReqIdFromSection(sec);
    if (id) {
      const rules = extractRules(sec).map(function (r) { return r.title; });
      reqs.push({ id: id, rules: rules });
    }
  });
  return reqs;
}

module.exports = {
  extractRules: extractRules,
  splitSections: splitSections,
  getReqIdFromSection: getReqIdFromSection,
  getReqSectionBounds: getReqSectionBounds,
  buildPlaceholderMap: buildPlaceholderMap,
  analyze: analyze
};
