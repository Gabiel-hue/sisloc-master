// extract_logic.js — versão LIMPA das funções de parsing do Sisloc Master
// Espelha o bookmarklet sisloc_master.js (raiz do repo) na versão atual.
//
// ⚠️ MANTER SINCRONIZADO COM O BOOKMARKLET:
// Sempre que mudar a lógica de parsing no sisloc_master.js, atualizar este arquivo também.
// Os regexes devem ser IDÊNTICOS aos da versão minificada.
//
// Funções exportadas:
//   - extractRules(sec): [{title, content, _reqsearch?}]
//   - splitSections(ds): string[]  (já aplicando o corte da descrição em cascata)
//   - getReqIdFromSection(sec): string | null
//   - getReqSectionBounds(ds, reqId): {start, end} | null
//   - buildPlaceholderMap(ds): [{id, title}]
//   - isProvisionalId(id): boolean
//   - getDescriptionArea(ds): string  (v35.11.8 — helper de corte em cascata)
//   - analyze(ds): [{id, rules: string[]}]  (pipeline completo)
//
// Versão espelhada: v35.11.8
// Mudanças desde a v35.11.1:
//   v35.11.2 — Fix do split do dSections: 1ª alternativa "REQUISITO ##N" ancorada em
//              início de linha com "(?<=^|\n)\s*(?:h\d+\.\s*)?" pra não casar menções
//              tipo "no requisito #N abaixo" em linguagem natural (caso #196911).
//              "h\d+\." opcional preserva suporte a "h2. REQUISITO ..." (caso #206262).
//   v35.11.3 — 2 fixes no extractRules pra eliminar lixo no título de regras link-only:
//              (1) linkPostMatch: "[^\s]+\s*" trocado por "\S+\s+" — exige whitespace
//                  obrigatório após o URL pra ativar o branch "título depois do link".
//              (2) Normalização final: replace incondicional '$1 - ' trocado por callback
//                  condicional que só adiciona ' - ' se há texto remanescente após o RN.
//   v35.11.4 — Fix no rulesMatch do extractRules: ancora-lookbehind "(?<=^|\n)\s*" antes
//              do marker pra impedir que 'regras:'/'regra:' em prosa case como início
//              do bloco de regras. Caso real #188640 (sublist "regras:" antes do marker
//              real) e #175029 (mesmo padrão).
//   v35.11.5 — Fix do padrão "h2. Requisito *#N – Título*" (asterisco entre "Requisito"
//              e "#" — negrito Textile do título). Caso real #204289 #95698. 7 ajustes
//              em 4 funções: \*?\s* nas 2 alts (REQUISITO e h3. Requisito), \*?\s* no
//              getReqIdFromSection, \*?\s* em reDetalhe/reAny/nextM. Bônus no nextM 2ª
//              alt: (?:h\d+\.\s*)? opcional pra alinhar com o splitSections.
//   v35.11.6 — Aceitar placeholders textuais #X+/#Y+ (com sufixo numérico opcional) como
//              IDs provisórios + tolerância a espaços ao redor da "/" em
//              "CONDIÇÕES / REGRAS". Casos #187472 e #207232. Mudanças (todas com /i +
//              .toUpperCase() pra normalizar case):
//                - splitSections (4 alts): \d+ → (?:\d+|X+\d*|Y+\d*)
//                - getReqIdFromSection (3 alts): (\d+) → (\d+|X+\d*|Y+\d*) + toUpper
//                - getReqSectionBounds.nextM (4 alts): \d+ → (?:\d+|X+\d*|Y+\d*)
//                - buildPlaceholderMap: (\d+) → (\d+|X+\d*|Y+\d*) + /i + toUpper
//                - extractRules.rulesMatch: CONDI[CÇ][OÕ]ES\/REGRAS →
//                                           CONDI[CÇ][OÕ]ES\s*\/\s*REGRAS
//                - isProvisionalId: + checks /^X+\d*$/i e /^Y+\d*$/i
//   v35.11.7 — Aceitar formato reqsearch SEM hífen entre <id> e <título> — só espaço.
//              Caso real #201650. Fix: \s*[-–]\s* → (?:\s*[-–]\s*|\s+) em 3 lugares
//              (split, reReqsearch no forEach, rollbackLinksHandler com escOldId).
//   v35.11.8 — DOIS fixes consolidados num release (casos #196410 e #145438):
//              (A) Área de corte da descrição em CASCATA (helper getDescriptionArea):
//                  Antes: splitSections cortava só por "h1. Detalhamento de Projeto". Se
//                  falhasse, usava a descrição inteira → sumário gerava duplicatas via
//                  1ª/4ª alt do split (case-insensitive). Caso #196410: a fixture tem
//                  "h1. Detalhamento *do* Projeto" (com "do" em vez de "de") → detM falha
//                  → 12 reqs detectados em vez de 6.
//                  Fix: helper novo `getDescriptionArea(ds)` tenta 3 estratégias:
//                    1) /h1\.\s*Detalhamento\s+d[eo]\s+Projeto/i  (relax: "do" também)
//                    2) /h1\.\s*Requisitos?\s+Impactados?[\s\S]*?(?=\n\s*---|\n\s*h1\.|$)/i
//                       → corta APÓS o sumário (até "---" ou próximo h1.)
//                    3) fallback: descrição inteira (comportamento atual)
//                  Caso #145438 não tem "Detalhamento de/do Projeto" — cai na estratégia 2.
//                  getReqSectionBounds.detM2 também ganha "d[eo]" no regex (mantém offset=0
//                  como fallback — semântica equivalente).
//              (B) Vocabulário de ID aceita REQ\w+ como placeholder textual:
//                  Caso #145438 usa #REQxx, #REQyy, #REQzz como placeholders novos (sem
//                  ID Redmine ainda). Mesma técnica da v35.11.6 (X+\d*, Y+\d*): adicionar
//                  REQ[A-Z0-9]+ ao vocabulário em 5 funções:
//                    - splitSections (4 alts): (?:\d+|X+\d*|Y+\d*) → +REQ[A-Z0-9]+
//                    - getReqIdFromSection (3 alts): captura idem
//                    - getReqSectionBounds.nextM (4 alts): idem
//                    - buildPlaceholderMap: idem
//                    - isProvisionalId: + check /^REQ[A-Z0-9]+$/i
//              Trava: REQ[A-Z0-9]+ só dispara em posição de ID (após "#" ou dentro de
//              header de req). Mesma técnica das v35.11.2/4/5/6/7: estender tolerância
//              dos regexes mantendo zero regressão.

'use strict';

function extractRules(sec) {
  sec = sec
    .replace(/\u00B2/g, '2').replace(/\u00B3/g, '3').replace(/\u00B9/g, '1')
    .replace(/\u2070/g, '0').replace(/\u2074/g, '4').replace(/\u2075/g, '5')
    .replace(/\u2076/g, '6').replace(/\u2077/g, '7').replace(/\u2078/g, '8')
    .replace(/\u2079/g, '9');

  // v35.11.6: \s*\/\s* em vez de \/ — tolera "CONDIÇÕES / REGRAS" (espaços ao redor da barra)
  const rulesMatch = sec.match(/(?<=^|\n)\s*(?:\*\s*)?(?:CONDI[CÇ][OÕ]ES\s*\/\s*REGRAS|REGRAS)\s*\*?\s*:?\s*\*?\s+([\s\S]*?)(?=\n\s*\*?(?:REQUISITO|Requisito|h\d+\.\s*Requisito)|\n\s*h3\.\s*#{1,2}\s*\d+|\n\s*---|$)/i);
  if (!rulesMatch) return [];

  const rules = [];
  // v35.6.6: aceita "RN" puro quando vem seguido de espaço(s) + hífen/endash (lookahead)
  // v35.11: 3ª alternativa fora do escopo do \b cobre o padrão reqsearch
  // v35.11.7: (?:\s*[-–]|\s+) — split tolera reqsearch sem hífen (só espaço)
  const parts = rulesMatch[1].split(/\n(?=\s*(?:#{1,2}\s+)?(?:\([^)]*\)\s*)?(?:h\d+\.\s*)?(?:\*?(?:["\u201C\u201D]RN\s?[A-Z0-9]+(?:\.\d+)?|RN(?:\s?[A-Z0-9]+(?:\.\d+)?|(?=\s+[-–])))\*?\b|["\u201C\u201D](?:\d+|RN[A-Z0-9]*)(?:\s*[-–]|\s+)))/i);

  parts.forEach(function (part) {
    let t = part.trim().replace(/^h\d+\.\s*/, '');
    if (!t) return;
    if (t.startsWith('|')) return;
    t = t.replace(/^#{1,2}\s+/, '');

    // v35.11: Branch reqsearch
    // v35.11.7: (?:\s*[-–]\s*|\s+) — tolera sem hífen (só espaço entre <id> e <título>)
    const reReqsearch = /^(\([^)]*\)\s*)?["\u201C\u201D]((?:\d+|RN[A-Z0-9]*))(?:\s*[-–]\s*|\s+)([^\n\r]+?)["\u201C\u201D]:(https?:\/\/[^\s]*reqsearch[^\s]+)/i;
    const mReq = t.match(reReqsearch);
    if (mReq) {
      const verbo = (mReq[1] || '').trim();
      const oldId = mReq[2];
      const titulo = mReq[3].trim();
      const urlReq = mReq[4];
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
    t = t.replace(/^\*(RN(?:\s?[A-Z0-9]+(?:\.\d+)?)?)\*/i, '$1')
         .replace(/^\*(RN(?:\s?[A-Z0-9]+(?:\.\d+)?)?[^\n*]*)\*\s*$/im, '$1')
         .replace(/^\*(RN(?:\s?[A-Z0-9]+(?:\.\d+)?)?[^\n*]*)$/im, '$1');

    if (t.match(/^(?:["\u201C\u201D]RN\s?[A-Z0-9]+(?:\.\d+)?|RN(?:\s?[A-Z0-9]+(?:\.\d+)?|(?=\s+[-–]))\b)/i)) {
      const lines = t.split('\n');
      let rawTitle = lines[0].trim();

      const linkPostMatch = lines[0].match(/^["\u201C\u201D](RN\s?[A-Z0-9]+(?:\.\d+)?)["\u201C\u201D]:https?:\/\/\S+\s+[-–—:]?\s*(.+?)$/i);
      if (linkPostMatch) {
        rawTitle = linkPostMatch[1].trim() + ' - ' + linkPostMatch[2].trim();
      }

      const aspaMatch = rawTitle.match(/^["\u201C\u201D](RN\s?[A-Z0-9]+(?:\.\d+)?[^:\n"\u201C\u201D]*?)(?:["\u201C\u201D]|:|$)/i);
      if (aspaMatch) {
        rawTitle = aspaMatch[1].trim();
      }

      rawTitle = rawTitle.replace(/\*/g, '')
                         .replace(/^(RN(?:\s?[A-Z0-9]+(?:\.\d+)?)?)\s*[-–:]?\s*(.*)$/i,
                                  function (_, rn, rest) { return rest ? rn + ' - ' + rest : rn; })
                         .replace(/:$/, '')
                         .trim();

      let content = lines.slice(1).join('\n').trim();
      content = content.replace(/\n\s*---[\s\S]*$/g, '').trim();

      if (!rawTitle.match(/CEN[AÁ]RIOS/i)) {
        rules.push({ title: rawTitle, content: content });
      }
    }
  });

  return rules;
}

// v35.11.8 — helper de corte da descrição em cascata (3 estratégias)
function getDescriptionArea(ds) {
  // Estratégia 1: h1. Detalhamento de/do Projeto (atual + tolerância d[eo])
  const detM = ds.match(/h1\.\s*Detalhamento\s+d[eo]\s+Projeto/i);
  if (detM) return ds.slice(detM.index);
  // Estratégia 2: cortar APÓS o "h1. Requisitos Impactados" (até --- ou próximo h1.)
  const reqM = ds.match(/h1\.\s*Requisitos?\s+Impactados?[\s\S]*?(?=\n\s*---|\n\s*h1\.|$)/i);
  if (reqM) return ds.slice(reqM.index + reqM[0].length);
  // Fallback: descrição inteira (comportamento original)
  return ds;
}

function splitSections(ds) {
  // v35.11.8: corte em cascata (não só "Detalhamento de Projeto" rígido)
  const area = getDescriptionArea(ds);
  // v35.11.2: 1ª alt ancorada em início de linha (anti-prosa)
  // v35.11.5: \*?\s* tolera asterisco do negrito Textile entre Requisito e #
  // v35.11.6: \d+ → (?:\d+|X+\d*|Y+\d*) aceita placeholders textuais (XXX, XX2, YYY, Y1, etc)
  // v35.11.8: + REQ[A-Z0-9]+ aceita placeholders REQxx, REQyy, REQzz, REQ001, etc
  return area.split(/(?=(?:(?<=^|\n)\s*(?:h\d+\.\s*)?REQUISITO\s*:?\s*\*?\s*#{0,2}\s*(?:\d+|X+\d*|Y+\d*|REQ[A-Z0-9]+)|h3\.\s*Requisito[\s:]*(?:Requisito\s+)?(?:Funcional\s+)?\*?\s*#{0,2}\s*(?:\d+|X+\d*|Y+\d*|REQ[A-Z0-9]+)|h3\.\s*#{1,2}\s*(?:\d+|X+\d*|Y+\d*|REQ[A-Z0-9]+)|\n\s*#(?:\d+|X+\d*|Y+\d*|REQ[A-Z0-9]+)\s*[-–]))/i);
}

function getReqIdFromSection(sec) {
  // v35.11.6: aceita placeholders X+\d* / Y+\d* + flag /i na 3ª alt + .toUpperCase() pra normalizar
  // v35.11.8: + REQ[A-Z0-9]+ no vocabulário das 3 alts
  const m = sec.match(/Requisito[\s:]*(?:Requisito\s+)?(?:Funcional\s+)?\*?\s*#{0,2}\s*(\d+|X+\d*|Y+\d*|REQ[A-Z0-9]+)/i)
         || sec.match(/^h3\.\s*#{1,2}\s*(\d+|X+\d*|Y+\d*|REQ[A-Z0-9]+)/im)
         || sec.match(/^\s*#(\d+|X+\d*|Y+\d*|REQ[A-Z0-9]+)\s*[-–]/i);
  return m ? m[1].toUpperCase() : null;
}

function getReqSectionBounds(ds, reqId) {
  // v35.11.5: \*?\s* em reDetalhe/reAny pra tolerar asterisco do negrito Textile
  const reDetalhe = new RegExp('h3\\.\\s*Requisito[\\s:]*(?:Requisito\\s+)?(?:Funcional\\s+)?\\*?\\s*#{0,2}\\s*' + reqId + '\\b', 'i');
  let startM = ds.match(reDetalhe);
  if (!startM) {
    const reH3Hash = new RegExp('h3\\.\\s*#{1,2}\\s*' + reqId + '\\b', 'i');
    startM = ds.match(reH3Hash);
  }
  if (!startM) {
    // v35.11.8: regex relaxado pra "do" também (estratégia 1 do helper)
    const detM2 = ds.match(/h1\.\s*Detalhamento\s+d[eo]\s+Projeto/i);
    const offset = detM2 ? detM2.index : 0;
    const reHashHeader = new RegExp('(?:^|\\n)\\s*#' + reqId + '\\s*[-–]', '');
    const mH = ds.slice(offset).match(reHashHeader);
    if (mH) startM = { index: offset + mH.index, 0: mH[0] };
  }
  if (!startM) {
    const reAny = new RegExp('(?:REQUISITO|Requisito)\\s*:?\\s*\\*?\\s*#{0,2}\\s*' + reqId + '\\b', 'i');
    startM = ds.match(reAny);
  }
  if (!startM) return null;
  const start = startM.index;
  const afterStart = ds.slice(start + startM[0].length);
  // v35.11.5: \*?\s* em todas as alts + (?:h\d+\.\s*)? na 2ª alt pra alinhar com split
  // v35.11.6: \d+ → (?:\d+|X+\d*|Y+\d*) em todas as 4 alts
  // v35.11.8: + REQ[A-Z0-9]+ em todas as 4 alts
  const nextM = afterStart.match(/(?:\n\s*h3\.\s*Requisito[\s:]*(?:Requisito\s+)?(?:Funcional\s+)?\*?\s*#{0,2}\s*(?:\d+|X+\d*|Y+\d*|REQ[A-Z0-9]+)|\n\s*(?:h\d+\.\s*)?REQUISITO\s*:?\s*\*?\s*#{0,2}\s*(?:\d+|X+\d*|Y+\d*|REQ[A-Z0-9]+)|\n\s*h3\.\s*#{1,2}\s*(?:\d+|X+\d*|Y+\d*|REQ[A-Z0-9]+)|\n\s*#(?:\d+|X+\d*|Y+\d*|REQ[A-Z0-9]+)\s*[-–])/i);
  const end = nextM ? start + startM[0].length + nextM.index : ds.length;
  return { start: start, end: end };
}

function buildPlaceholderMap(ds) {
  const map = [];
  const listSections = ds.match(/h1\.\s*Requisitos?\s*(?:Impactados?|Novos?)([\s\S]*?)(?=\nh1\.|\n---\s*\nh1\.|$)/gi);
  if (!listSections) return map;
  listSections.forEach(function (sec) {
    sec.split('\n').forEach(function (line) {
      // v35.11.6: (\d+) → (\d+|X+\d*|Y+\d*) + flag /i + .toUpperCase() pra normalizar case
      // v35.11.8: + REQ[A-Z0-9]+ aceita placeholders REQxx, REQyy, etc
      const m = line.match(/^#{0,2}\s*(\d+|X+\d*|Y+\d*|REQ[A-Z0-9]+)\s*[-–]\s*(.+)/i);
      if (m) map.push({ id: m[1].toUpperCase(), title: m[2].trim().toLowerCase() });
    });
  });
  return map;
}

// v35.11.6: detecta se id é placeholder provisório
// v35.11.8: + check pra REQ[A-Z0-9]+ (REQxx, REQyy, REQzz, REQ001, etc)
function isProvisionalId(id) {
  if (id === '99999') return true;
  if (/^0\d*$/.test(id)) return true;          // 0, 00, 01, 02, ...
  if (/^X+\d*$/i.test(id)) return true;        // X, XX, XXX, X1, XX2, XXX3, X42, ...
  if (/^Y+\d*$/i.test(id)) return true;        // Y, YY, YYY, Y1, YY2, ...
  if (/^REQ[A-Z0-9]+$/i.test(id)) return true; // REQXX, REQYY, REQZZ, REQ001, ...
  return false;
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
  isProvisionalId: isProvisionalId,
  getDescriptionArea: getDescriptionArea,
  analyze: analyze
};
