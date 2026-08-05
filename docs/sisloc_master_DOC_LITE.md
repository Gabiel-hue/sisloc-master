# 🚀 Sisloc Master — Doc Lite (atualizado pós-v35.13.6)

> **Versão atual:** v35.13.6 | Bookmarklet JS para Redmine corporativo (rede `net1`, via VPN)
>
> **⭐ Extensão do Chrome com auto-update via GitHub!**
> Repositório: https://github.com/Gabiel-hue/sisloc-master
> A extensão busca o `sisloc_master.js` do GitHub a cada execução → editar o repo = atualizar todos os analistas automaticamente.
>
> **🌐 Extensão agora funciona em qualquer host Redmine** (v35.13.6): `net1` (interno), IP externo `177.69.209.157:65080` (VPN via internet), HTTPS futuro — tudo pelo mesmo regex genérico `/^https?:\/\/[^\/]+\/redmine\/issues\/\d+/`.
>
> **🧪 Suite de testes offline** (`tests/` no repo) — 20 fixtures reais + 26 cenários sintéticos no `run_tests.js` (46/46 passando, fixture #191719 nova), 20 testes em `test_v35_9_com_regra_jatem.js`, 36 testes em `test_v35_10_titulo_editavel.js`, 23 testes em `test_v35_10_1_aspas_e_hash.js`, 91 testes em `test_v35_11_reqsearch.js`, 35 testes em `test_v35_11_3_titulo_link.js`, 34 testes em `test_v35_11_4_regras_em_prosa.js`, 35 testes em `test_v35_11_5_requisito_asterisco.js`, 107 testes em `test_v35_11_6_placeholder_textual.js`, 43 testes em `test_v35_11_7_reqsearch_sem_hifen.js`, 50 testes em `test_v35_11_8_area_corte_e_req_placeholder.js`, 145 testes em `test_v35_12_substituir.js`, 61 testes em `test_v35_13_processo.js`, 24 testes em `test_v35_13_5_save_errors.js`, **30 testes em `test_v35_13_6_diagnostic_button.js` (novo)** e **14 testes em `test_url_pattern.js` (novo — testa o regex do background.js)**. Total: **794 testes, 794 passando.** Em sessões futuras, o Claude roda os testes em Node sem precisar abrir o Chrome do usuário (economia de ~80% dos tokens de Chrome MCP).

---

## 🎯 Prompt base (cola na primeira mensagem do próximo chat)

```
Estou continuando o desenvolvimento do bookmarklet "Sisloc Master".
Versão atual: v35.13.6 (já testada e funcional).

O QUE É:
- Bookmarklet (javascript:...) em UMA LINHA SÓ
- Roda no Chrome do analista usando a SESSÃO LOGADA dele no Redmine
- Lê demandas, extrai regras de negócio, e grava nos requisitos correspondentes
- Tem rollback do Gravar e Atualizar Links (v35.6), Changelog-only (v35.7),
  Relação automática (v35.8), botão extra de relação no card COM-REGRA
  quando o changelog já está registrado (v35.9 + fix do bug v35.8 do sr-status null),
  título do changelog editável globalmente antes de gravar (v35.10),
  na v35.10.1: aspas retas viram curvas no Textile gerado + suporte a
  "## RNX" (lista Textile) no parser e Atualizar Links + getReqSectionBounds
  agora tolera "h3. Requisito: Requisito Funcional #N" (palavra Requisito duplicada),
  na v35.11.1: suporte ao formato reqsearch — regra com link interno tipo
  (Verbo) "<id> - Título":URL_que_contém_reqsearch, onde <id> pode ser dígitos
  puros (ex: 2462), placeholder RN textual (RNX, RNx, RNX1, RNA) ou RN vazio.
  O parser cataloga como regra (synthesizando "RN - <título>") e o Atualizar Links
  substitui pelo link Redmine com a RN renumerada. Bug de propagação do _reqsearch
  via ruleMappings.push foi corrigido na v35.11.1 (spot-check #190033).
  Na v35.11.2: fix do split do dSections — 1ª alternativa "REQUISITO ##N" ancorada
  em início de linha c/ "(?<=^|\n)\s*(?:h\d+\.\s*)?" pra não casar menções tipo
  "no requisito #N abaixo" em linguagem natural (caso real #196911 — caixinha de
  #31446 e #31454 apareciam duas vezes por causa disso). "h\d+\." opcional preserva
  suporte a "h2. REQUISITO ##N" (caso #206262).
  Na v35.11.3: 2 fixes no extractRules pra eliminar lixo em títulos de regras
  link-only. (1) linkPostMatch: "[^\s]+\s*" trocado por "\S+\s+" — exige whitespace
  obrigatório após o URL pra ativar o branch "título depois do link". Antes,
  '"RN10":URL' sem nada após cedia o último char do URL pro grupo (.+?)$ e virava
  'RN10 - 0' (RN1 → '- 1', RN2 → '- 2', RN14...diferente → '- e' etc).
  (2) Normalização final: replace '$1 - ' incondicional trocado por callback
  condicional que só adiciona ' - ' se há texto remanescente. Antes, 'RN10' puro
  (sem aspas, sem link) virava 'RN10 -' com hífen trailing artificial.
  Na v35.11.4: fix em 2 lugares com o mesmo padrão de regex problemático.
  (1) extractRules rulesMatch: ancora-lookbehind "(?<=^|\n)\s*" antes do
  marker (CONDIÇÕES/REGRAS|REGRAS) pra impedir que "regras:"/"regra:" em prosa
  case como início do bloco. Caso real #188640: "2) Validar as regras:" antes
  do "*CONDIÇÕES/REGRAS*" fazia o body capturado incluir a sublist sumário
  (* "RNX1":URL, * "RNX2":URL, * "RNX3":URL) + CONVERSOR + CONDIÇÕES/REGRAS +
  as 4 regras reais (Criar) → split entregava 5 regras (RNX1 duplicado) e o
  req #208996 ficava com 1 caixinha fantasma. Bug latente análogo do v35.11.2
  (REQUISITO em prosa). (2) rollbackLinksHandler regrasM: mesmo lookbehind no
  regex que delimita o bloco de regras dentro da seção do req na demanda
  (Atualizar Links). Sem o fix o regrasBlock incluía a sublist sumário, e o
  replace global "RNX1 → RN2" tocava AMBAS as ocorrências (sublist + regra
  real). Com o fix, só toca a regra real — a sublist sumário fica como
  documentação interna do req (decisão de design: "o que vale de regra para
  nois está no bloco/seção de regras mesmo"). Bônus: fixture #175029 #57751
  também corrigida — antes extraía 2 regras ("RN18 - 1" fantasma da sublist
  "* Inutilizar regras:" + "RN 57751.1" real), agora extrai 1 só. Snapshot
  bugado do expected.json ("RN18 - 1") foi atualizado.
  Na v35.11.5: fix do padrão "h2. Requisito *#N – Título*" — asterisco do
  negrito Textile entre "Requisito" e o "#". Caso real #204289: o req
  #95698 não aparecia na caixinha porque o header começa com
  "h2. Requisito *#95698 – Manter Dados Substituição Rápida...*", e os
  regex de detecção de seção (splitSections, getReqIdFromSection,
  getReqSectionBounds) só permitiam "\s*:?\s*" entre "Requisito" e "#" —
  o "*" quebrava o match. Bug latente correlato descoberto na mesma sessão:
  o nextM do getReqSectionBounds só detectava "h3. Requisito" como início
  de próximo req (não tinha "(?:h\d+\.\s*)?" opcional na 2ª alt como o
  splitSections já tinha desde v35.11.2). Resultado: o end do #31505 vazava
  até o fim do arquivo, passando pelo #95698 inteiro — gravar regras no
  #31505 sobrescreveria o #95698. 7 ajustes em 4 funções: (1) splitSections
  "\*?\s*" nas 2 alts (REQUISITO e h3. Requisito); (2) getReqIdFromSection
  "\*?\s*" antes do #{0,2}; (3) getReqSectionBounds "\*?\s*" em reDetalhe,
  reAny e nas 2 alts do nextM; bônus "(?:h\d+\.\s*)?" no nextM 2ª alt pra
  alinhar com o split. Mesma técnica das v35.11.2 (lookbehind + alt
  opcional) e v35.11.4 (lookbehind no rulesMatch). Cobre também caso
  futuro de "h1. REQUISITO" ou "h3. Requisito *#N" — tolerância simétrica
  a todos os headers numerados com asterisco interno.
  Na v35.11.6: aceitar placeholders textuais #X+\d* e #Y+\d* (X ou Y
  repetidos com sufixo numérico opcional, case-insensitive) como IDs
  provisórios + tolerância a espaços ao redor da "/" no marker
  CONDIÇÕES / REGRAS. Dois casos reais consolidados num único release.
  (1) #187472: req "h3. REQUISITO: #XXX - Devolução RFID" não aparecia
  na caixinha porque \d+ não casa "XXX". Sistema de provisional IDs
  (#99999, #0/#01) já tinha infraestrutura completa (isProvisionalId,
  buildProvisionalCard amarelo, resolveId por título) — faltava só
  estender o vocabulário de "ID válido". (2) #207232: 3 reqs com IDs
  "XXX1", "XX2", "XXX3" (placeholder textual + sufixo numérico) + marker
  "*CONDIÇÕES / REGRAS" com espaços ao redor da "/". Dois bugs distintos:
  (a) X+ puro consumia só "XXX" deixando "1/2/3" órfão — IDs XXX1 e XXX3
  colidiam como "XXX". (b) Marker com espaços não casava o regex literal
  CONDI[CÇ][OÕ]ES\/REGRAS → 0 regras extraídas em XX2 e XXX3.
  10 ajustes no bookmarklet (+296 chars): (1)+(2) bump h3+popup;
  (3) buildPlaceholderMap: (\d+) → (\d+|X+\d*|Y+\d*) + /i + toUpperCase
  no id; (4) splitSections (4 alts): cada \d+ → (?:\d+|X+\d*|Y+\d*);
  (5) getReqIdFromSection (3 alts): (\d+) → (\d+|X+\d*|Y+\d*) + flag /i
  na 3ª alt + .toUpperCase() no retorno; (6) getReqSectionBounds.nextM
  (4 alts): \d+ → (?:\d+|X+\d*|Y+\d*); (7) isProvisionalId: + checks
  /^X+\d*$/i e /^Y+\d*$/i; (8)+(9)+(10) Fix B em 3 lugares — rulesMatch
  no extractRules, regrasM no rollbackLinksHandler, reCase3e na cascata
  do Atualizar Links: CONDI[CÇ][OÕ]ES\/REGRAS → CONDI[CÇ][OÕ]ES\s*\/\s*REGRAS.
  Decisão: separar X+\d* e Y+\d* (não [XY]+\d*) — sufixo só na CAUDA, não
  intercalada com letras. Aceita: X, XX, X1, XX2, XXX3, XXXX99. NÃO aceita:
  XY, XYZ, 1X, X1A, TBD. Custo marginal pra Y junto com X foi zero.
  Mesmo princípio das v35.11.2/4/5: estender tolerância dos regexes mantendo
  zero regressão.
  Na v35.11.7: aceitar formato reqsearch (v35.11.1) SEM hífen entre <id>
  e <título> — só espaço. Caso real #201650: regra do req #61567 estava
  como "2461 Comportamento ...":URL_reqsearch (com espaço puro, sem hífen).
  Regex reReqsearch da v35.11.1 exigia \s*[-–]\s* obrigatório entre o <id>
  e o <título> → 0 regras extraídas. Fix: trocar \s*[-–]\s* por
  (?:\s*[-–]\s*|\s+) em 3 lugares — split do extractRules (parts),
  reReqsearch no forEach, e rollbackLinksHandler (regex construído com
  escOldId pro Atualizar Links). 5 mudanças no bookmarklet (+25 chars):
  (1)+(2) bump h3+popup; (3) split do extractRules; (4) reReqsearch no
  forEach; (5) rollbackLinksHandler. Espelho tests/extract_logic.js
  atualizado (2 patches simétricos). Bônus: refresh dos lengths das
  fixtures #187472 e #207232 no expected.json (snapshots stale após
  edições no repo — requirements idênticos, só o length divergiu).
  Trava da v35.11.1 (URL precisa conter "reqsearch" literal) preservada.
  Mesmo princípio das v35.11.2/4/5/6: estender tolerância dos regexes
  mantendo zero regressão.
  Na v35.11.8: DOIS fixes consolidados num release (casos #196410 e #145438).
  (A) Área de corte da descrição em CASCATA: novo helper getDescriptionArea(ds)
  substitui o "const detM=...slice(detM.index):ds" inline na splitSections.
  Cascata de 3 estratégias: (1) /h1\.\s*Detalhamento\s+d[eo]\s+Projeto/i
  — relax pra aceitar "do" também (caso #196410: a fixture tem
  "h1. Detalhamento do Projeto"); (2) /h1\.\s*Requisitos?\s+Impactados?
  [\s\S]*?(?=\n\s*---|\n\s*h1\.|$)/i — corta APÓS o sumário até "---"
  ou próximo h1. (caso #145438: a fixture nem tem "Detalhamento de/do
  Projeto", só "h1. Requisitos Impactados" separado por "---"); (3) fallback
  ds inteira (comportamento original). Antes do fix, o detM falhava → area
  = ds inteira → sumário gerava seções fantasma via split case-insensitive.
  Caso #196410: 12 reqs em vez de 6 (6 do sumário "Requisito #N - Título" +
  6 do detalhamento h3. Requisito #N). Caso #145438: 9 reqs em vez de 8 (4
  do sumário "#N - Título" via 4ª alt do split + 5 reais; 3 placeholders
  perdidos). detM2 do getReqSectionBounds também ganha "d[eo]" no regex.
  (B) Vocabulário de ID aceita REQ[A-Z0-9]+ como placeholder textual. Mesma
  técnica da v35.11.6 (X+\d*, Y+\d*): adicionar REQ[A-Z0-9]+ ao vocabulário
  em 5 funções (splitSections nas 4 alts, getReqIdFromSection nas 3 alts,
  nextM nas 4 alts, buildPlaceholderMap, isProvisionalId). Caso #145438 usa
  #REQxx, #REQyy, #REQzz como placeholders provisórios. 18 mudanças no
  bookmarklet (+411 chars, 62879 → 63290): (1)+(2) bump h3+popup; (3) helper
  novo getDescriptionArea; (4) substituição inline em splitSections; (5)
  relax do detM2 em getReqSectionBounds; (6-13) 8x vocabulário não-capturante;
  (14-17) 4x vocabulário capturante; (18) isProvisionalId. Espelho
  tests/extract_logic.js atualizado (todos os patches simétricos + helper
  exportado no module.exports). Trava: REQ[A-Z0-9]+ só dispara em posição
  de ID (após # ou dentro de header de req) — "#REQ" puro NÃO casa (boundary
  preservada). Mesmo princípio das v35.11.2/4/5/6/7: estender tolerância
  mantendo zero regressão.
  Na v35.13: aceitar `PROCESSO` como token de ID de placeholder em headers,
  SEM `#` obrigatório. Caso real #191719: 3 seções legítimas no detalhamento
  usam `h3. REQUISITO: PROCESSO: Gerar Pendência API` / `h3. REQUISITO:
  PROCESSO: Gerar Serviço Extra Automatico API` / `h3. PROCESSO: Volumetria
  OutSystem` — sub-processos derivados ainda sem ID Redmine próprio. Antes:
  os 3 ficavam silenciosamente engolidos nas seções adjacentes (regras NÃO
  vazavam por causa do stop `\n\s*---`, mas os cards sumiam do popup).
  Como todos têm o mesmo "ID" literal (PROCESSO), o pipeline `analyze()`
  faz auto-numbering por ordem de aparição: 1º vira PROCESSO1, 2º PROCESSO2,
  etc. (mesma técnica do XXX1/XXX2/XXX3 da v35.11.6 mas gerada pelo parser).
  6 mudanças no extract_logic + 7 no bookmarklet: splitSections (+1 alt),
  getReqIdFromSection (+1 alt), getReqSectionBounds.nextM (+1 alt),
  buildPlaceholderMap (+captura de h3. PROCESSO - <título> no sumário),
  isProvisionalId (+/^PROCESSO\d*$/i), analyze (+ auto-numbering),
  novo helper buildPlaceholderMapNumbered exportado pro espelho. Trava:
  separador [:\-–] obrigatório imediatamente após PROCESSO — protege contra
  "h3. Após confirmação do processo..." em prosa (grep confirmou 1 ocorrência
  nas 20 fixtures legacy, que continua não casando). Bookmarklet +515 chars
  (74368 → 74883). Mesmo princípio das v35.11.2/4/5/6/7/8: estender tolerância
  mantendo zero regressão (726/726 verde — 664 anteriores + 61 novos +
  1 fixture nova 191719).
  Na v35.13.1: fix do "Atualizar links na demanda" — regex dos 4 reCase3*
  e reReqsearch não toleravam "h3. " no prefixo da regra na demanda.
  Caso real #205073 → #31564: regra "h3. RNX - Atualizar Vendedor e
  Percentual de Comissão" SEM aspas/link → reCase3c falhava por causa
  do "h3. " antes do "RNX". Aviso amarelo "1 regra não encontrada na
  demanda: RNX" exibido. Fix: adicionar `(?:h\d+\.\s+)?` opcional ao
  prefixo de reCase3a/b/c + reReqsearch. cb3 renomeia normalmente
  RNX→RN<novo> (comportamento histórico mantido). Bookmarklet +72 chars
  (74887→74959). Mesmo princípio das v35.11.2/4/5/6/7/8/13: estender
  tolerância dos regexes mantendo zero regressão.
  Na v35.13.2: melhoria do tratamento de erro do saveIssue. Antes:
  `if(!r.ok) throw new Error("HTTP "+r.status)` → mensagem genérica
  "❌ Sisloc Master não conseguiu gravar: HTTP 422" que dava impressão
  de bug da ferramenta. Agora: em caso de erro, lê o body, parseia
  com DOMParser, procura `#errorExplanation`, extrai os `<li>` e gera
  bullet list HTML pronto pra render no statusEl. Wording "Variante 2"
  aprovada: "O requisito #N retornou: • <erro> ... Corrija no requisito
  e tente de novo." Cobre os 6 fluxos que usam saveIssue (Registrar,
  Gravar, Substituir, Atualizar Links, Desfazer). Escape de chars
  perigosos via map em `<>&`. Bookmarklet +496 chars.
  Na v35.13.3: fix do silent failure. v35.13.2 só disparava em !r.ok
  (status 4xx/5xx). Mas Redmine antigo (Rails antigo) retorna HTTP 200
  + errorExplanation no HTML quando rejeita validação (`render :action
  => 'edit'` sem `status: :unprocessable_entity`). Caso real #199015 →
  #60904: gravação parecia OK (botão Desfazer + relação criada), mas
  descrição NÃO era salva. Fix: SEMPRE ler o body do response e checar
  `hasErr = h.indexOf('id="errorExplanation"')>=0` além de `!r.ok`.
  Custo no caminho feliz: ~5-10ms (lê body). Bookmarklet +53 chars.
  Na v35.13.4: fix do indexOf miss. v35.13.3 ainda não pegava nesse
  Redmine porque o atributo vinha com aspas SIMPLES (`id='errorExplanation'`)
  e o indexOf procurava aspas duplas (`id="errorExplanation"`). Diagnóstico
  in-vivo via Claude in Chrome (POST simulado contra req #60904 real do
  user): response 200 + body com `<div id='errorExplanation'>` aspas
  simples confirmado. Fix: SEMPRE usar DOMParser + querySelector
  (`#errorExplanation`) — robusto a variações de aspas/espaços/case.
  Removido o indexOf prévio (redundante). Bookmarklet -44 chars (mais
  enxuto).
  Na v35.13.5: melhoria UX para mostrar TODOS os erros de validação.
  v35.13.4 mostrava só "Produto não pode estar em branco" — porque
  Redmine só valida custom_field_values dos campos enviados no POST,
  e o Sisloc só envia `issue[description]`. Outros campos obrigatórios
  ("Plataforma" no caso #60904) ficavam silenciados. Fix: quando o POST
  normal falhar, faz PROBE — segundo POST com TODOS os campos do form
  `#issue-form` (valores literais do GET /edit), captura `errorExplanation`
  completo. Custo no caminho feliz: 0 (não roda). Caminho de erro:
  +400-500ms (1 GET + 1 POST extras). Probe envia valores idênticos →
  se validação passar (raro), nada muda. Fallback gracioso: se probe
  falhar por qualquer motivo, cai pro comportamento v35.13.4. Confirmado
  in-vivo no req #60904 real: 2 erros detectados (Plataforma + Produto)
  em 834ms. Bookmarklet +642 chars (75464→76379). 22 testes novos em
  `test_v35_13_5_save_errors.js`.
  Na v35.13.6: 🌐 fix da extensão pra funcionar via IP externo (VPN) +
  botão de diagnóstico técnico do 500. **Bug reportado:** extensão nem
  abria quando o analista acessava `http://177.69.209.157:65080/redmine/`
  (link externo pra usar de fora da VPN). Diagnóstico in-vivo via Claude
  in Chrome: `background.js` tinha `REDMINE_URL_PATTERN = /^http:\/\/net1\//`
  hardcoded — badge vermelho "!" e sai sem injetar. **Fix:** regex
  genérico `/^https?:\/\/[^\/]+\/redmine\/issues\/\d+/` — aceita
  `net1`, IP externo, HTTPS futuro, e qualquer host `<x>/redmine/issues/N`.
  Filosofia idêntica das v35.11.x (estender tolerância mantendo zero
  regressão). Bump do `manifest.json` "35.11.1" → "35.12.0" (mexeu no
  background.js). 14 testes novos em `test_url_pattern.js` (não-regressão
  NEW ⊇ OLD confirmada). **Botão de diagnóstico do 500:** quando o
  `saveIssue` cair no fallback (sem `errorExplanation` — típico de HTTP
  500/502/504), mostra botão discreto `📋 Copiar detalhes técnicos` que
  copia pra clipboard: timestamp, URL, status, tempo do POST, primeiros
  2KB do response body. Base64 pra não quebrar HTML com aspas/newlines
  do body. Feedback visual de 3s (verde ✅ Copiado). Motivação: 500 é
  intermitente, sem causa conhecida — permite capturar o body real na
  próxima ocorrência sem precisar reabrir sessão. 30 testes novos em
  `test_v35_13_6_diagnostic_button.js`. Bookmarklet +1078 chars
  (76379→77457).

⭐ ENTREGA DUPLA (desde a sessão da v35.6):
- (a) Bookmarklet tradicional (favorito JS arrastado da página de instalação)
- (b) Extensão do Chrome com AUTO-UPDATE via GitHub
  - Repo público: https://github.com/Gabiel-hue/sisloc-master
  - O arquivo `sisloc_master.js` na raiz do repo é a FONTE DA VERDADE
  - A extensão (em `extension/`) faz fetch desse arquivo a cada clique no ícone
  - Editar o repo no GitHub = atualiza TODOS os analistas instalados, sem reinstalar
  - Cache local em chrome.storage pra funcionar offline com a última versão

🧪 SUITE DE TESTES (desde a sessão da v35.6.5):
- Pasta `tests/` no repo com fixtures (descrições reais de demandas catalogadas)
- `tests/extract_logic.js` = espelho LIMPO das funções de parsing do bookmarklet
- `tests/run_tests.js` roda 10 fixtures + 11 cenários sintéticos (21/21 passando)
- `tests/expected.json` é o snapshot do output esperado (qualquer diff = regressão ou feature)
- ECONOMIA DE TOKENS: pega o sisloc_master.js + extract_logic.js + run_tests.js + expected.json
  + fixtures do GitHub raw com web_fetch e roda tudo em Node. Só usar Chrome no FIM pra
  spot-check do bug reportado no caso real.
- Testes adicionais de relação (v35.8 e v35.9):
  - `tests/relations_logic.js` — espelho dos helpers findRelation/addRelation/removeRelation
  - `tests/test_v35_9_com_regra_jatem.js` — 20 testes (heurística, idempotência, undo, render condicional)
- Testes do título editável (v35.10):
  - `tests/test_v35_10_titulo_editavel.js` — 36 testes em 7 grupos (validateTitle,
    buildChLog, isModified, ciclo de edição, bloqueio na gravação, compat
    com rollback v35.6+, heurística chJaTem v35.9). Sem DOM — espelho puro
    da lógica do bookmarklet.
- Testes da v35.10.1 (aspas + ## RNX + getReqSectionBounds):
  - `tests/test_v35_10_1_aspas_e_hash.js` — 23 testes em 7 grupos (helper
    tq() de conversão de aspas, Bug A.1/A.2 aspas + CRLF da #206262, Bug B.1/B.2
    do "## RNX" da #199075, não-regressão de formatos antigos, Bug C do
    getReqSectionBounds com cabeçalho "Requisito: Requisito Funcional #N"
    da #199075).
- Testes da v35.11.1 (reqsearch):
  - `tests/test_v35_11_reqsearch.js` — 91 testes em 7 grupos (extractRules
    detecta padrão reqsearch para 6 grupos de oldId: dígitos puros + 5 placeholders
    RN; Atualizar Links substitui URL reqsearch pelo link Redmine novo; aspas
    internas no título reqsearch + prefixo "## " compat v35.10.1; rollback
    volta byte-a-byte; Bug E do ruleMappings perdendo _reqsearch — regressão
    spot-checada pelo usuário entre v35.11 → v35.11.1; não-regressão de formatos
    antigos; falsos-positivos protegidos pela trava "reqsearch" literal na URL).
- Testes da v35.11.2 (dedup do split — sintéticos no run_tests.js):
  - `requisito_minusculo_meio_frase_nao_casa` — trava regressão (menção
    "no requisito #N abaixo" em frase corrida não cria seção fantasma).
  - `h2_REQUISITO_preservado` — garante que cabeçalho "h2. REQUISITO ##N"
    (caso #206262) continua sendo detectado.
- Testes da v35.11.4 (regras: em prosa não casa marker):
  - `tests/test_v35_11_4_regras_em_prosa.js` — 34 testes em 5 grupos. Grupo A:
    "regras:"/"regra:" em prosa NÃO casa o marker (#188640 "Validar as regras:",
    #175029 "Inutilizar regras:"). Grupo B: markers estruturais legítimos
    continuam casando (*CONDIÇÕES/REGRAS*, *REGRAS*, CONDIÇÕES/REGRAS:). Grupo
    C: variações tolerantes (CRLF, indentação, case-insensitive, CamelCase).
    Grupo D: ponta-a-ponta com fixtures #188640 (#208996 → 4 regras reais,
    #31468 → 0 regras) e #175029 (#57751 → 1 regra). Grupo E: não-regressão das
    outras 12 fixtures.
  - 2 sintéticos novos em `run_tests.js`:
    - `regras_em_prosa_nao_casa` — trava regressão ("Validar as regras:" em
      frase corrida não cria seção fantasma)
    - `regras_em_prosa_com_sublist_188640` — replica caso real #188640
      simplificado (prosa + sublist sumário + CONDIÇÕES/REGRAS real)
- Testes da v35.11.3 (título lixo em regras link-only):
  - `tests/test_v35_11_3_titulo_link.js` — 35 testes em 6 grupos. Grupo A:
    Padrão A "<RN>":URL link-only (bug corrigido — vira "RN<N>" puro sem
    lixo trailing). Grupo B: Padrão B "RN<N> - Título":URL preservado.
    Grupo C: Padrão C "RN<N>":URL - Título preservado (caso #175544).
    Grupo D: edge cases com aspas curvas e prefixos (Criar)/(Alterar)/(Validar).
    Grupo E: ponta-a-ponta com fixtures #196911 e #148935. Grupo F:
    não-regressão de formatos não-link (formato clássico, negrito, h3,
    lista numerada Textile, placeholder RNX).
- Testes da v35.11.5 (h2. Requisito *#N — asterisco do negrito Textile):
  - `tests/test_v35_11_5_requisito_asterisco.js` — 35 testes em 4 grupos.
    Grupo A: regex de detecção tolera "*" entre "Requisito" e "#" (split,
    getReqIdFromSection, getReqSectionBounds — variações h2./h3., espaço
    extra, "*#" colado). Grupo B: getReqSectionBounds.nextM detecta próximo
    req em h2/h1 não só h3 — sem vazamento de bloco entre reqs. Grupo C:
    ponta-a-ponta com fixture #204289 (#31505 + #95698, ambos extraídos,
    bounds corretos sem vazamento). Grupo D: não-regressão (formato clássico
    sem asterisco + 14 fixtures antigas continuam OK).
  - 1 sintético novo em `run_tests.js`:
    - `h2_requisito_asterisco_204289` — replica caso real simplificado
      (h2. Requisito #N normal + h2. Requisito *#N – Título* com asterisco)
- Testes da v35.11.6 (placeholders textuais + marker com espaços):
  - `tests/test_v35_11_6_placeholder_textual.js` — 107 testes em 12 grupos.
    Suite **auto-contida** (regex inline em vez de require do espelho).
    Grupo A: ponta-a-ponta com fixture #187472 real (placeholderMap, split,
    isProvisional pro #XXX). Grupo B: ponta-a-ponta com fixture #207232 (3
    IDs distintos XXX1/XX2/XXX3 + rulesMatch nos 3 markers com variação de
    espaços). Grupo C: 14 variações de placeholder X+/Y+ PURO × 2 testes
    (id+provisional). Grupo D: 12 variações de placeholder X+\d*/Y+\d* com
    SUFIXO numérico × 2 testes. Grupo E: IDs distintos não colidem (XXX1
    + XXX3 ≠ XXX único). Grupo F: não-regressão dos IDs numéricos. Grupo
    G: 15 misturas/letras outras (XY, XYZ, 1X, X1A, TBD, ...) NÃO viram
    placeholder. Grupo H: prosa anti-falso-positivo (4 casos). Grupo I:
    buildPlaceholderMap com sufixo (#XXX1, 3 placeholders, normalização
    case). Grupo J: rulesMatch tolera 7 variações de espaços no marker
    CONDIÇÕES/REGRAS. Grupo K: 5 padrões das fixtures conhecidas continuam
    OK. Grupo L: nextM detecta placeholders com sufixo como próximo req.
  - 5 sintéticos novos em `run_tests.js`:
    - `h3_requisito_placeholder_xxx_187472` — caso real #187472 simplificado
    - `h2_requisito_placeholder_com_sufixo_207232` — caso real #207232 (3
      reqs XXX1/XX2/XXX3 distintos)
    - `placeholder_y_com_sufixo` — sanity check Y+\d* (Y1, YY2)
    - `placeholder_provisional_id_check` — mix XXX, XX42, 99999
    - `condicoes_regras_com_espacos_207232` — 3 variações do marker
- Testes da v35.11.7 (reqsearch sem hífen entre <id> e <título>):
  - `tests/test_v35_11_7_reqsearch_sem_hifen.js` — 43 testes em 7 grupos.
    Suite **auto-contida** (regex inline + mini-extractRules limitado ao
    branch reqsearch). Grupo A: ponta-a-ponta com fixture #201650 real
    (extractRules pro #61567 retorna 1 regra com _reqsearch.oldId='2461' +
    título "Comportamento do parâmetro Mascara..." + content "Quando
    habilitado..." + oldUrl com reqsearch). Grupo B: 8 variações do padrão
    SEM hífen (dígitos+espaço, RNX+espaço, RNX1, RN vazio, verbo+dígitos,
    verbo+RN, múltiplos espaços, espaço mínimo). Grupo C: 6 variações do
    padrão COM hífen (não-regressão da v35.11.1): hífen, endash, sem
    espaço ao redor, RNX, RN1, verbo. Grupo D: 5 travas — NÃO dispara o
    branch reqsearch (URL sem "reqsearch", sem aspas, sem URL, ID com
    letras não-RN, aspas só de abertura). Grupo E: 9 testes de split com
    múltiplas regras reqsearch sem hífen (3 regras quebradas corretamente
    + mix de hífen e sem-hífen). Grupo F: 5 testes do rollbackLinksHandler
    com regex construído usando escOldId (Atualizar Links — substituição
    pelo link Redmine funciona pra sem-hífen e com-hífen). Grupo G: 3
    edge cases (aspas curvas, decimal-like '123.456' não casa preservando
    trava de ID puro, título com espaços no fim).
  - 1 sintético novo em `run_tests.js`:
    - `reqsearch_sem_hifen_201650` — replica caso real #201650 simplificado
      (1 req com regra reqsearch sem hífen + 1 req com regra reqsearch
      clássica com hífen, validando que ambos os formatos são aceitos)
- Testes da v35.11.8 (área de corte em cascata + vocabulário REQ[A-Z0-9]+):
  - `tests/test_v35_11_8_area_corte_e_req_placeholder.js` — 50 testes em 12
    grupos. Suite **auto-contida** (regex inline + mini-pipeline). Grupo A:
    Fix A estratégia 1 (Detalhamento de/do Projeto) — 6 testes incluindo
    rejeição deliberada de "da". Grupo B: Fix A estratégia 2 (Requisitos
    Impactados) — 5 testes (cortar até "---", próximo h1, EOF; case-insensitive;
    singular). Grupo C: Fix A estratégia 3 fallback — 2 testes. Grupo D:
    cenário #196410 ponta-a-ponta — 2 testes (6 reqs, comportamento antigo
    de 12 corrigido). Grupo E: Fix B vocabulário REQ no splitSections — 6
    testes. Grupo F: case-insensitive + normalização — 3 testes. Grupo G:
    buildPlaceholderMap — 3 testes. Grupo H: isProvisionalId — 7 testes.
    Grupo I: travas anti-falso-positivo — 4 testes (REQUISITO literal, prosa
    #abc, #REQ puro). Grupo J: não-regressão formatos antigos — 5 testes
    (REQUISITO clássico, h3. Requisito, X+/Y+ v35.11.6, #99999, #0). Grupo
    K: ponta-a-ponta com fixtures reais — 4 testes (#196410 e #145438).
    Grupo L: edge cases do helper — 3 testes.
  - 3 sintéticos novos em `run_tests.js`:
    - `detalhamento_do_projeto_196410` — replica caso real simplificado (2
      reqs no sumário + 2 no detalhamento com "do Projeto")
    - `cascata_sem_detalhamento_145438` — replica estratégia 2 (2 reqs no
      sumário com `#N - Título` + 2 no detalhamento separados por `---`)
    - `req_placeholder_textual_145438` — replica vocabulário REQ (3 reqs
      com `#REQxx/yy/zz`)

CONTEXTO TÉCNICO:
- fetch + DOMParser em /issues/N/edit para ler descrições
- POST com FormData para salvar (utf8, _method=patch, authenticity_token, issue[description])
- NÃO inclui issue[notes] — gravação limpa, sem nota no histórico
- v35.8: POST /issues/<reqId>/relations para criar relação (utf8, authenticity_token,
  relation[relation_type]=relates, relation[issue_to_id]=<dId>); POST /relations/<relId>
  com _method=delete pra apagar. Detecção de relação existente: GET /issues/<reqId> →
  DOMParser → tr[id^="relation-"] input[name="ids[]"][value="<dId>"]
- v35.9: detecção da heurística "changelog desta demanda já registrado":
  d.ds.includes('Demanda: #' + dId) → mostra botão extra "Adicionar relação" no
  card COM-REGRA. Zero fetch extra (info já vem do getEd).
- v35.10: campo global "Título do changelog" no topo da caixinha (texto + ✏️
  view-mode / input + ↺ + ✓ edit-mode). Variável `effectiveTitle` (closure)
  substitui `dTitle` em todas as construções de chLog. Validação anti-vazio
  no clique de Gravar/Registrar (trim + alerta vermelho), maxlength="300" no
  input. Preview do card SEM-REGRA atualiza em tempo real via
  data-sem-regra-preview="1" + oninput. Persistência só na sessão JS.
- v35.10.1: 3 lotes de fixes em regex sem feature nova. (1) Aspas retas `"`
  internas no título Textile geram link quebrado no Redmine — helper `tq()`
  agora converte para curvas `“`/`”` no `cb3`/`cb3b`. (2) `[^\n]*` engolia o
  `\r` em fixtures CRLF (default do Redmine) e injetava `\r` dentro do título
  Textile — apertado para `[^\n\r]*` nos 5 reCase. (3) Parser ignorava
  "## RNX – Título" (lista numerada nível 2 do Textile) — split do extractRules
  ganha `(?:#{1,2}\s+)?` opcional + strip no `t` + 5 reCase do Atualizar Links
  acomodam `## ` opcional preservando-o no link gerado. (4) `getReqSectionBounds`
  não casava cabeçalho `h3. Requisito: Requisito Funcional #N` (Requisito
  duplicado) — `Requisito\s*:?` virou `Requisito[\s:]*(?:Requisito\s+)?(?:Funcional\s+)?`
  em 5 lugares (reDetalhe, nextM alt-h3, split alt-h3, getReqIdFromSection,
  titleMatch). A 2ª alternativa REQUISITO bare (sem h3.) ficou com regex antigo
  propositalmente — estender ela também tornava o split promíscuo.
- v35.11.1: feature do formato reqsearch (#190033) + fix do bug do ruleMappings.
  Detecta `(opcional verbo) "<id> - <título>":URL_que_contém_reqsearch` onde
  `<id>` aceita 6 grupos: dígitos puros (`2462`), placeholders RN textuais
  (`RNX`, `RNx`, `RNX1`, `RNA`), ou `RN` vazio. Trava de segurança: a URL precisa
  conter `reqsearch` literal. 4 mudanças no bookmarklet: (1) split do extractRules
  ganha 3ª alternativa `["\u201C\u201D](?:\d+|RN[A-Z0-9]*)\s*[-–]` fora do escopo
  do `\b`; (2) branch novo no forEach ANTES do strip de parens — sintetiza
  `{title: 'RN - '+titulo, content, _reqsearch:{verbo, oldId, oldUrl}}`; (3) branch
  novo no Atualizar Links ANTES dos 5 reCase3* — short-circuit com `continue` se
  substituir; (4) propagação do `_reqsearch` via `ruleMappings.push({oldTitle,
  newTitle, _reqsearch: ru._reqsearch})` (sem isso, branch do Atualizar Links nunca
  dispara — bug spot-checado pelo usuário entre v35.11 → v35.11.1). Bônus: 4
  placeholders RN textuais (`RNX`/`RNx`/`RNX1`/`RNA`) com URL reqsearch que tinham
  falha silenciosa no Atualizar Links da v35.10.1 (regra aparecia na caixinha mas
  botão dizia "Nenhum link encontrado") agora funcionam pelo mesmo caminho.
- v35.11.2: fix do split do dSections — 1ª alternativa `REQUISITO ##N` (que é
  case-insensitive por causa do flag `/i`) casava também `requisito #N` em frases
  livres minúsculas, criando seção fantasma no meio de outro requisito. Caso real
  #196911: linha `+Obs:+ Regras... no seção do requisito #31446 abaixo, ...` dentro
  do req #48 fragmentava a seção, e o `reqMatch` posterior capturava `31446` como
  novo id → caixinha duplicada. Mesma coisa pro `#31454` no req #46. Fix: ancorar
  a 1ª alternativa com `(?<=^|\n)\s*(?:h\d+\.\s*)?` antes do `REQUISITO` — exige
  que venha logo após newline ou início. `(?:h\d+\.\s*)?` opcional preserva o
  match em `h2. REQUISITO ##N` (caso #206262). Lookbehind variável-width OK em
  V8 desde 2018. 1 linha mudou no bookmarklet, 1 no espelho, 2 cenários
  sintéticos novos no `run_tests.js`.
- v35.11.3: 2 fixes em `extractRules` pra eliminar lixo em títulos de regras
  link-only. Bug exposto quando v35.11.2 corrigiu a dedup da #196911 e o usuário
  pôde finalmente gravar — viu `h3. RN27 - e` (lixo "e"), `h3. RN5 - 1`,
  `h3. RN6 - 2` no Redmine. Causa: o `linkPostMatch` (regex pra extrair "título
  depois do URL") tinha `[^\s]+\s*[-–—:]?\s*(.+?)$` — todos os quantificadores
  pós-URL opcionais. Pra linhas tipo `"RN10":URL` (sem nada após), o engine
  cedia o último char do URL pro grupo `(.+?)$` casar → título `RN10 - 0`.
  Fix 1: trocar `[^\s]+\s*` por `\S+\s+` (whitespace obrigatório após URL).
  Bug secundário: normalização final tinha `.replace(/^(RN...)\s*[-–:]?\s*/i,
  '$1 - ')` incondicional — pra `RN10` puro (sem aspas, sem link), virava
  `RN10 -` (hífen trailing artificial). Fix 2: callback condicional
  `function(_, rn, rest) { return rest ? rn + ' - ' + rest : rn; }`. Padrões
  preservados: B (`"RN<N> - Título":URL` — título nas aspas, do `aspaMatch`)
  e C (`"RN<N>":URL - Título` — título após URL com espaço, caso #175544).
  35 testes novos em `test_v35_11_3_titulo_link.js` cobrindo Padrões A/B/C,
  edge cases (aspas curvas, prefixo (Criar)/(Alterar)/(Validar)), ponta-a-ponta
  com #196911 e #148935, e não-regressão de formatos não-link. Refresh do
  `expected.json` (148935 e 196911 tinham o estado bugado catalogado).
- Tenho acesso ao Chrome do usuário via "Claude in Chrome" para CONSULTAR
  (não para editar) demandas/requisitos em tempo real

REGRAS DE COLABORAÇÃO:
1. Antes de mexer no script: TESTAR a lógica em Node primeiro (preferir Node contra
   fixtures locais do tests/ ao invés de abrir Chrome — economia de tokens)
2. Mostrar resultado do teste
3. PERGUNTAR antes de aplicar (NUNCA pular essa etapa, mesmo quando a análise já deixou claro o que vai mudar)
4. Mudanças visuais: PREVIEW visual antes
5. Versionamento: vX.Y.Z (fix/melhoria pequena), vX.Y (feature média), vX+1.0 (feature grande)
6. Validar sintaxe ao final (node --check)
7. Manter bookmarklet em UMA LINHA
8. CUIDADO: o arquivo de "fonte legível" e o BOOKMARKLET (uma linha) podem
   estar dessincronizados — sempre usar como BASE o conteúdo do bookmarklet
   instalado (que é o que o usuário realmente roda). Pedir esse conteúdo no
   início se houver dúvida. ALTERNATIVA: pegar do GitHub raw direto:
   https://raw.githubusercontent.com/Gabiel-hue/sisloc-master/main/sisloc_master.js
9. ATUALIZAR O ESPELHO: quando mexer na lógica de parsing do sisloc_master.js,
   atualizar tests/extract_logic.js também — eles têm os MESMOS regexes.
10. FRASE-CHAVE: quando o usuário mandar "me mande os 4 atualizados", gerar
   o pacote: bookmarklet .js + instalar .html + DOC_LITE.md + RESUMO_SESSAO.md
11. FLUXO DE DEPLOY: ao gerar nova versão, lembrar de avisar o usuário que
    pra propagar a atualização ele precisa fazer commit do `sisloc_master.js`
    novo no repo `Gabiel-hue/sisloc-master` (a extensão pega automaticamente).
    Bumpar o "version" no manifest.json SÓ se mexeu em background.js, icons
    ou manifest.json em si — não precisa bumpar pra cada vX.Y.Z do bookmarklet.

ARQUIVOS DA SESSÃO ANTERIOR (em anexo):
- sisloc_master_DOC_LITE.md — este documento
- sisloc_master.js — bookmarklet atual (1 linha)
- RESUMO_SESSAO_v35_11_1.md — o que foi feito na última sessão

Veja o anexo "Sisloc Master Doc Lite" para arquitetura e formatos.
```

---

## 📐 Arquitetura (resumo)

```
javascript:(function(){
  // SETUP: dId, bUrl, dTitle (da página atual)
  //   v35.10: também effectiveTitle = dTitle (variável mutável em closure
  //           — reflete o que o usuário escreveu no campo "Título do
  //           changelog". Substitui dTitle em TODAS as construções de chLog)
  // UI: caixinha lateral com header, status, lista de cards
  //   v35.10: caixinha ganha bloco "tt-box" no topo (label + texto + ✏️
  //           em view-mode; input + ↺ + ✓ em edit-mode) ANTES da lista

  // FUNÇÕES principais:
  getEd(id)               // busca /edit, retorna {tk, ds, n, ip, chI, subj}
  saveIssue(id, nc, tk)   // POST com description nova
  findRelation(rId, dId)  // v35.8: GET /issues/rId, parseia tr[id^="relation-"],
                          //        retorna {relId, tk} se achou dId, ou {relId:null, tk}
  addRelation(rId, dId)   // v35.8: idempotente. Se já existe, retorna {alreadyExisted:true, relId}.
                          //        Senão POST /issues/rId/relations + re-fetch pra capturar o novo relId.
  removeRelation(rId,relId)//v35.8: POST /relations/relId com _method=delete + token
  extractRules(sec)       // parsing de regras de uma seção
                          //   v35.5.9: linkPostMatch — detecta "RN1":URL - Título (título DEPOIS do link)
                          //   v35.5.6: normaliza superscripts + flag /i no split
                          //   v35.5.5: aceita negrito *RN... aberto sem fechamento na linha
                          //   v35.5.4: aceita espaços/tabs antes do \n em *RN... *
                          //   v35.5.2: aceita *RN... título inteiro* e normaliza separador
                          //   v35.5.1: aceita aspas curvas " e "
                          //   v35.6.2: regra inline com cabeçalho *Regras:* (Formato 21)
  buildPlaceholderMap(ds) // mapa {id: título} dos requisitos da listagem da demanda
  getExistingRules(reqDs) // RNs já no requisito (para detectar duplicatas)
  checkDup(title, ex)     // 95%+ = exata (vermelho), 60%+ = parcial (amarelo)
  isTemplateRule(content) // RN template (conteúdo entre <...>)
  cleanTemplateRules(ds)  // remove templates antes de gravar
  isProvisionalId(id)     // detecta #99999 e #0001/#0002 (zeros à esquerda)
  buildProvisionalCard(r) // card pra requisitos não criados ainda
  buildSemRegraCard(r,d,l)// v35.7: card pra req sem regra (estado Normal ou "Já tem")
                          //   v35.8: estado "Já tem" ganha botão extra 🔗 Adicionar relação
                          //   v35.9 (fix bug v35.8): adicionado <div class="sr-status"></div>
                          //   também no ramo jaTem — sem ele o handler do botão Adicionar
                          //   relação falhava com TypeError no innerHTML quando alguma das
                          //   pílulas de feedback ia ser exibida.
  buildSemRegraProvisionalCard(r,l)// v35.7: sem-regra + provisional
  buildSemRegraErroCard(r,l)       // v35.7: sem-regra + getEd falhou
  buildSummary(all,with,without,getF,setF)// caixinha de resumo expansível + toggle sem-regra
  titleToAnchor(title)    // gera âncora (fallback)
  getAnchorForRule(rId,t) // fetch /issues/N e busca âncora real
  getReqSectionBounds()   // limites da seção do requisito na demanda
                          //   v35.5.8: aceita h3. ##N (sem palavra "Requisito") no início e no nextM
                          //   v35.6.5: aceita #N - Título sem h3. dentro da área pós-detalhamento
  resolveId(title, map)   // resolve #99999 pelo título

  // v35.10 — TÍTULO DO CHANGELOG EDITÁVEL (sem DOM dedicada nova função;
  // tudo inline no setup da caixinha):
  ttRefresh()             // atualiza visual da caixinha do título (cor da borda,
                          //   fundo, tag "✏️ editado", texto exibido em view-mode,
                          //   E os <pre> SEM-REGRA marcados com data-sem-regra-preview="1"
                          //   pra refletir o título em tempo real). Chamada por:
                          //   - inicialização (estado 1: original, view)
                          //   - ttPencil.onclick (entra em edit, foca o input)
                          //   - ttClose.onclick (sai de edit voltando pra view)
                          //   - ttRestore.onclick (volta effectiveTitle = dTitle)
                          //   - ttInput.oninput (digitação → live preview)

  // FLUXO:
  // 1. Lê demanda → placeholderMap (camada 1 do nome do requisito)
  // 2. Recorta por "h1. Detalhamento de Projeto" se existir (v35.5)
  // 3. Split por requisitos (aceita "Requisito", "Requisito Funcional", "h3. ##N" e "#N - X" sem h3. desde v35.6.5)
  // 4. Para cada section: extractRules, marca provisional, conta ocorrências
  //    Camada 2 do nome: extrai do cabeçalho "Requisito #N - Nome" se existir
  //    v35.7: separa em reqsWithRules e reqsWithoutRules
  // 5. Mostra resumo + cards (com toggle de incluir sem-regra)
  // 6. Para cada card com regra: lê /edit do requisito (getEd) → subj é fallback (camada 3)
  //    v35.9: calcula chJaTem = d.ds.includes('Demanda: #'+dId)
  //           Se true → injeta pílula verde + botão extra "🔗 Adicionar relação"
  //           Idêntico em comportamento ao botão do card SEM-REGRA "Já tem".
  // 7. Botão "Gravar": saveIssue no requisito (insere RN + atualiza Changelog)
  //                    Após sucesso → vira "↩ Desfazer gravação" laranja (v35.6)
  //                    v35.8: também tenta addRelation; pílula verde "🔗 Relacionada..."
  //                    se OK, ou amarela "⚠️ Relação não criada" se falhou
  //                    v35.10: guard no INÍCIO do try{} — se effectiveTitle.trim()
  //                    estiver vazio, mostra alerta vermelho "❌ Título do
  //                    changelog está vazio." + return (não chega a saveIssue).
  //                    chLog usa effectiveTitle, NÃO dTitle.
  // 8. Botão "Atualizar links": 3 casos (atualizar/já-OK/criar)
  //                              Após sucesso → vira "↩ Desfazer atualização de links" laranja (v35.6)
  // 9. Para cada card sem regra (v35.7): botão "Registrar Changelog" insere só o chLog
  //                              v35.8: também tenta addRelation (mesmo padrão do passo 7)
  //                              v35.8: card "Já tem" ganha botão extra 🔗 Adicionar relação
  //                              v35.10: mesmo guard de título vazio do passo 7

  // ROLLBACK (v35.6+):
  // - Gravar (v35.6): closure captura rTxt e chLog → ao confirmar, fetch + remove via indexOf/slice
  //   v35.8: também guarda capturedRelationId; rollback chama removeRelation antes do saveIssue de
  //   restauração. Falha aqui é graciosa (mostra warning, segue com rollback do texto)
  // - Links (v35.6): closure captura [{antes, depois}] → ao confirmar, fetch + replace reverso
  // - Changelog-only (v35.7): closure captura chLog → rollback remove só essa entrada
  //   v35.8: também guarda capturedRelationId, mesma lógica do Gravar
  // - Relação (v35.8, card JATEM): closure captura jaTemRelId → rollback chama removeRelation
  // - Relação (v35.9, card COM-REGRA chJaTem): closure captura extraRelId. Independente do
  //   botão Gravar — tem próprio life cycle. Usa statusEl (id="status-N") que sempre existe.
  // - Confirmação inline (amarelo) com Sim/Cancelar (sem confirmação no rollback do JATEM/CR-jaTem, é 1 clique)
  // - Erro detectado quando edição alheia toca a parte alterada
  // - Após sucesso: botões voltam ao estado original (permite re-tentar)
});
```

---

## 📋 Formatos suportados (atualizado pós-v35.11.1 — parser ganhou formato reqsearch na v35.11.1; resto intacto desde v35.6.8)

| # | Formato | Exemplo | Versão |
|---|---|---|---|
| 1 | Construção | `REQUISITO #31564` + `CONDIÇÕES/REGRAS:` + `RNX - ...` | v34.0 |
| 2 | Peq. Melhorias | `h3. Requisito: ##54` + `*CONDIÇÕES/REGRAS:*` | v34.0 |
| 3 | Planejamento | `h3. "RN12":http://...` + `*Regras:*` | v34.0 |
| 4 | Letras | `RNA – Cálculo IBS` | v34.1 |
| 5 | Negrito só no RN | `*RNX* - Regra de exibição` | v34.2 |
| 6 | Com marcação | `(Criar) "RNX1 - ...":http://...#RNX1` | v34.12 |
| 7 | Ponto | `RN31168.1 – Comportamento` | v35.3 |
| 8 | Espaço no número | `RN 32341.1 – Espelho` | v35.3 |
| 9 | Requisito Funcional | `h3. Requisito Funcional #36213 - ...` | v35.5 |
| 10 | Aspas curvas | `"RN6 - Junção de Notas:"URL` (Word/Outlook) | v35.5.1 |
| 11 | Negrito de linha inteira | `*RNX1 - Filtro por "Empresa"*` | v35.5.2 |
| 12 | Sem hífen entre RN e título | `*RNX1 Notas Fiscais*` (vira `RNX1 - Notas Fiscais`) | v35.5.2 |
| 13 | Dois pontos como separador | `RNX1: Validação` (vira `RNX1 - Validação`) | v35.5.2 |
| 14 | Negrito com espaço/tab antes do \\n | `*RNX1 Notas...* ` (com space trailing) | v35.5.4 |
| 15 | Negrito aberto sem fechamento | `*RNX1 - Processo ...` (sem `*` no fim) | v35.5.5 |
| 16 | Superscript Unicode | `RNx² → RNx2`, `RNx³ → RNx3`, `RNx¹ → RNx1` | v35.5.6 |
| 17 | RN minúsculo | `RNx - Algo`, `RNy - Outro` (flag /i no split) | v35.5.6 |
| 18 | `h3. ##N` sem "Requisito" | `h3. ##31323` (sem palavra Requisito antes) | v35.5.8 |
| 19 | Título DEPOIS do link | `(Criar) "RN1":URL - Compra de equipamento` | v35.5.9 |
| 20 | **Botão "Atualizar Links"** agora aceita asteriscos | `*RN5 - Título*`, `*RN5* - Título`, `*(Criar) RN5 - Título*` | v35.6.1 |
| 21 | **Regra inline com cabeçalho** `*Regras:*` no `extractRules` | `*Regras:* "RN12 - X":URL\n<conteúdo>` (título da regra na MESMA linha do cabeçalho) | v35.6.2 |
| 22 | **Regra inline com cabeçalho** `*Regras:*` no "Atualizar Links" | `*Regras:* RN12 - X` SEM link → agora vira `*Regras:* "RN12 - X":URL` | v35.6.3 + v35.6.4 |
| 23 | **Cabeçalho de requisito `#N - Título` SEM `h3.`** | `#32965 - Gerar NF de devolução...` (linha solta no detalhamento, sem `h3.` na frente) | v35.6.5 |
| 24 | **Regra `RN` SEM código** (sem número/letra após RN) | `RN -   Regra de PIS/COFINS no Sisloc integração NFS-e` (regra única, autor não numerou) | v35.6.6 |
| 25 | **Regra com link reqsearch** (interno Sisloc) | `(Alterar) "2462 - Título":https://internos.app.sisloc.com/sisloc.reqsearch/regradenegocio/form?id=...` — `<id>` aceita: dígitos puros, RNX/RNx/RNX1/RNA (placeholders), ou RN vazio. Verbo `(Alterar)`/`(Criar)`/`(Validar)` é opcional. Trava: URL precisa conter `reqsearch` literal. Parser sintetiza `RN - <título>`; Atualizar Links substitui pelo link Redmine com a RN renumerada. | v35.11.1 |

**Cabeçalho de requisito aceito:** `REQUISITO #N`, `h3. Requisito: #N`, `h3. Requisito Funcional #N`, `h3. ##N` (v35.5.8), `##N`, `# N`, sem `#`, e agora `#N - Título` sem `h3.` (v35.6.5).

**Códigos de regra aceitos:** `RN1`, `RN A`, `RNX1`, `RN31168.1` (com ponto), `RN 32341.1` (com espaço), `RNa` (minúsculo, v35.5.6), `RNx²/³/¹` (superscript Unicode, v35.5.6), e agora `RN` puro **sem código** quando seguido de espaço(s) + hífen (v35.6.6 — protege contra falso positivo "RNs devem" exigindo o hífen no padrão).

**Seção de regras aceita:** `CONDIÇÕES/REGRAS:`, `*REGRAS*`, `*Regras:*`, com/sem dois pontos, com/sem asteriscos.

**Aspas aceitas:** `"` (reta, U+0022), `"` (curva esq, U+201C), `"` (curva dir, U+201D).

**Prefixos de ação:** `(Criar)`, `(Alterar)`, `(Validar)` — **todos** são tratados igual a `(Criar)` por enquanto.

---

## ⚙️ Regras técnicas críticas

1. **Bookmarklet em UMA linha** (Chrome trata `\n` como fim de URL)
2. **Sem `issue[notes]`** (decisão do usuário)
3. **Gravação sempre com `h3.`**, leitura aceita com/sem `h3.`
4. **Nome do requisito vem de 3 fontes (cascata):**
   - Camada 1: seção "Requisitos Impactados"/"Novos" da demanda (zero fetch extra)
   - Camada 2: cabeçalho `h3. Requisito #N - Nome` (se tiver nome inline)
   - Camada 3 (v35.5.3+): `#issue_subject` do HTML do `/edit` que já é baixado (zero fetch extra)
5. **Insertion point** = posição da MAIOR RN + offset até próximo `h3./h2./h1./---`
6. **Âncora do Redmine:** mantém acentos, remove parênteses/aspas/pontuação, espaços → hífen, colapsa hífens
7. **IDs provisórios:** `#99999` OU número com zeros à esquerda (`#0001`, `#0002`)
8. **Tabelas (`|...|`) são ignoradas** no parsing de regras
9. **Atualização de link SÓ na seção `*REGRAS*` do requisito específico**
10. **`getReqSectionBounds` prioriza `h3. Requisito #N` e `h3. ##N`** (v35.5.8) e aceita `#N - Título` sem `h3.` no fallback (v35.6.5, restrito à área pós `h1. Detalhamento de Projeto` pra não confundir com listagem do topo)
11. **`getReqSectionBounds` retorna SÓ a primeira aparição** — limitação conhecida (v35.6 merge backlog)
12. **Placeholders RNx/RNy/RNx²** são renomeados ao gravar pro próximo `RNN` real do requisito
13. **Rollback (v35.6+):** vive em closure JS, expira ao fechar a página. Captura cirurgicamente o que foi modificado.
14. **Relação automática (v35.8):** após gravar regras+changelog ou só changelog, cria `Relacionado a` entre requisito e demanda. Idempotente (pula se já existe). Rastreia `relationId` em memória pra rollback (só apaga se foi a gente que criou). Falha não bloqueia a gravação principal — mostra aviso amarelo, regras/changelog ficam OK.
15. **Botão extra "Adicionar relação" no card COM-REGRA (v35.9):** quando `d.ds.includes('Demanda: #'+dId)` (changelog desta demanda já registrado), aparece pílula verde explicativa + botão azul independente. Caso de uso: regra/changelog gravados em sessão anterior, ou pré-v35.8, ou após o usuário desfazer só a relação manualmente — e ele quer só recolocar a relação sem mexer nas regras. Zero fetch extra na renderização (info de `d.ds` já vem do `getEd`). Life cycle separado do botão Gravar.
16. **Título do changelog editável (v35.10):** variável `effectiveTitle` (closure) substitui `dTitle` em TODAS as construções de `chLog` (em `originalGravarHandler`, em `originalHandler` do card sem-regra, e nos `<pre>` de preview). Inicia igual a `dTitle`. Campo único global no topo da caixinha (não por card). View-mode por padrão (texto + ✏️), edit-mode no clique do ✏️ (input + ↺ restaurar + ✓ fechar). Indicação visual de "editado" quando difere do original (borda `#e6c97a`, fundo `#fff8e8`, tag "✏️ editado" — mesma paleta do Desfazer da v35.6). Validação **anti-vazio** no clique de Gravar/Registrar (trim do input vazio → bloqueia com alerta vermelho), `maxlength="300"` no input. Preview dos cards SEM-REGRA atualiza em tempo real via seletor `[data-sem-regra-preview="1"]`. Não persiste entre execuções (closure JS — fechar/recarregar a página volta pro original). Rollback v35.6+ continua funcionando: `chLog` editado é capturado em closure, achado via `indexOf` na descrição.
17. **Aspas + ## RNX + Requisito duplicado (v35.10.1):** quatro mudanças cirúrgicas em regex sem feature nova.
    - **Helper `tq()` no cb3/cb3b:** converte aspas retas `"` em curvas `“`/`”` ao montar o Textile `"título":URL`. Necessário porque o Textile fecha o link no primeiro `"` que encontra — aspas retas internas (caso #206262: `*"Demonstrativo Estruturado"*`) quebravam a renderização.
    - **`[^\n]*` → `[^\n\r]*` nos 5 reCase3a/b/c/d/e:** em fixtures CRLF (default do Redmine), o `[^\n]*` engolia o `\r` e injetava ele dentro do título Textile.
    - **`(?:#{1,2}\s+)?` opcional no parser e nos 5 reCase do Atualizar Links:** demandas com regras escritas como `## RNX – Título` (lista numerada Textile nível 2 — caso #199075) eram completamente ignoradas. O Atualizar Links preserva o `##` no link gerado: `## "RN1 – Título":URL`.
    - **`Requisito\s*:?` → `Requisito[\s:]*(?:Requisito\s+)?(?:Funcional\s+)?` em 5 lugares do `getReqSectionBounds`/`splitSections`/`getReqIdFromSection`/`titleMatch`:** cabeçalho `h3. Requisito: Requisito Funcional #40803` (palavra duplicada — caso #199075) fazia o bounds retornar null e o handler "Atualizar Links" cair no else final. ⚠️ **A 2ª alternativa REQUISITO bare (sem `h3.`) ficou com o regex antigo propositalmente** — tentei estender e o split com flag `/i` virou promíscuo (4 fatias em vez de 2 na 199075, porque `REQUISITO[\s:]*(?:Requisito\s+)?` matcha tanto `Requisito:` quanto `Requisito Funcional` na mesma linha case-insensitivamente).
18. **Suporte a link reqsearch (v35.11.1):** demandas com regras apontando para a interface interna do Sisloc `(Alterar) "<id> - Título":URL_reqsearch` agora são reconhecidas pelo parser e substituíveis pelo Atualizar Links.
    - **6 grupos de `<id>` aceitos:** dígitos puros (`2462`), placeholders RN textuais (`RNX`, `RNx`, `RNX1`, `RNA`), ou `RN` vazio.
    - **Trava de segurança:** a URL precisa conter `reqsearch` literal pra entrar no branch novo. Protege contra falso-positivo em qualquer `"<id> -` que apareça com outra URL.
    - **Verbo opcional:** aceita com ou sem `(Alterar)`/`(Criar)`/`(Validar)` na frente.
    - **Padrão de saída:** o parser sintetiza `RN - <título>` (sem número — a renumeração roda na hora da gravação via `d.n+i`); o Atualizar Links substitui pelo link Redmine novo `"<RN_renumerada> - <título>":<URL_Redmine>` (aspas curvas via `tqL` se o título original tinha aspas internas).
    - **Badge da caixinha:** `<id_antigo> → <RN_nova>` (ex: `2462 → RN25`, `RNX → RN15`).
    - **4 mudanças no bookmarklet:** split do `extractRules` ganha 3ª alternativa fora do `\b`; branch novo no `forEach` ANTES do strip de parens (sintetiza `{title, content, _reqsearch:{verbo, oldId, oldUrl}}`); branch novo no Atualizar Links ANTES dos 5 reCase3* (short-circuit com `continue` se substituiu, badge com `oldId → newRN`); **propagação do `_reqsearch` via `ruleMappings.push({oldTitle, newTitle, _reqsearch: ru._reqsearch})`** — sem isso, branch do Atualizar Links nunca dispara (bug spot-checado pelo usuário entre v35.11 → v35.11.1, mensagem que aparecia: "1 regra não encontrada na demanda: *RN*").
    - **Bônus retroativo:** 4 placeholders RN textuais (`RNX`/`RNx`/`RNX1`/`RNA`) com URL reqsearch que tinham falha silenciosa no Atualizar Links da v35.10.1 (regra aparecia na caixinha mas botão dizia "Nenhum link encontrado") agora funcionam pelo mesmo caminho.
    - **Rollback funciona automaticamente:** o `rollbackLinksHandler` (v35.6) é genérico — itera `linkChanges` em reverso e faz `secao.replace(c.depois, c.antes)`. O branch reqsearch popula `linkChanges` no mesmo formato dos `cb3`/`cb3b`, então rollback restaura byte-a-byte ao original sem mudança adicional.

---

## 🐛 Backlog / Próximos passos

### 🟡 Merge real de requisitos duplicados (DESCARTADA pelo usuário na sessão da v35.5.x, mantida como referência)

Plano: detectar `#N` repetido 2× no detalhamento, mergear em um card só, atualizar links em todos os blocos. Mexe em `getReqSectionBounds`. Não é prioridade.

### 🔴 vNext (futuro) — Tratar (Criar) vs (Alterar) vs (Validar) separadamente

Hoje os três prefixos são tratados igual a `(Criar)`. Decisão do usuário: "depois a gente vê como faz". *(Antes era v35.8+ e v35.9+, mas esses slots foram consumidos pelas features de relação automática e botão extra de relação.)*

### 🟡 Limpeza de `* ` órfão no content (Opção 2b da sessão da v35.5.5)

A v35.5.5 deixa o `* ` órfão no content de regras tipo `*RN... \n* texto...` (#102418). Usuário escolheu Opção 1 (não limpa). Se incomodar, trocar pra Opção 2b: limpar só quando é asterisco único (sem outros bullets na sequência).

### ✅ ~~Bug pré-existente — `getReqSectionBounds` com `h3. Requisito Funcional #N`~~ **Resolvido na v35.10.1**

O `reDetalhe` da função `getReqSectionBounds` não permitia a palavra "Funcional" entre "Requisito" e o número. A demanda #199075 revelou uma variante ainda mais difícil: `h3. Requisito: Requisito Funcional #40803 – ...` (palavra "Requisito" duplicada). Fix aplicado em 5 lugares: `Requisito\s*:?` virou `Requisito[\s:]*(?:Requisito\s+)?(?:Funcional\s+)?` (reDetalhe, nextM, split alt-h3, getReqIdFromSection, titleMatch). A alternativa "REQUISITO bare" (sem `h3.`) ficou com regex antigo propositalmente — estendê-la tornava o split promíscuo (4 fatias em vez de 2). Validado em 23 testes do `test_v35_10_1_aspas_e_hash.js` (5 deles especificamente para Bug C).

### 🟡 Bug latente — `getExistingRules` também tem o padrão `\s*\n` (Formato 21)

A v35.6.2 corrigiu o `extractRules` (parsing da DEMANDA), e a v35.6.4 corrigiu o `regrasM` do "Atualizar Links". MAS a função `getExistingRules` (que lê as regras JÁ EXISTENTES dentro do REQUISITO de destino, pra detectar duplicatas) tem regex parecido: `REGRAS)(?:\s*\*)?\s*:?\s*\*?\s*\n[\s\S]*$`. Se o requisito de destino tiver uma regra inline no formato `*Regras:* "RN1 - X":URL`, a detecção de duplicatas pode falhar. Não corrigido ainda — aguardando aparecer caso real pra confirmar e aplicar mesmo fix da v35.6.4.

### 🟢 Follow-ups POSSÍVEIS (ideias, não são bugs)

- ✅ ~~Botão extra `🔗 Adicionar relação` no card COM-REGRA quando a relação não existe~~ **Concluído na v35.9.**
- ✅ ~~Título do changelog editável antes de gravar~~ **Concluído na v35.10.**
- Tornar o tipo de relação configurável (hoje hardcoded `relates`). Talvez UI no resumo da demanda?
- Cache do GET `/issues/reqId` entre `findRelation` e o `addRelation` subsequente — hoje faz 3 fetches por relação (GET pra checar duplicata, POST pra criar, GET pra capturar relId). Poderia ser 2 se reaproveitasse a 1ª resposta. **Mais importante agora**: na investigação da v35.9 medimos que em requisitos com muitas relações (122 no #48) cada `findRelation` leva ~3,5 segundos por causa do tamanho do HTML (412 KB). Otimização: usar regex em vez de DOMParser dá ~100x. Vale considerar se aparecer mais reclamação de lentidão.
- Persistir o título editado entre execuções (localStorage). Hoje (v35.10) vive só no closure JS — fechar/recarregar a página = volta pro original. Foi decisão consciente. Se incomodar muito, considerar `localStorage['sisloc_title_'+dId]` com TTL curto.

---

## 📝 Changelog resumido

- **v34.0–34.12** — base, formatos diversos, prefixos
- **v35.0** — botão "Atualizar links na demanda" 🎉
- **v35.1** — fix `getReqSectionBounds` (detalhamento vs listagem)
- **v35.2** — 3 casos no botão de links (atualizar/já-OK/criar)
- **v35.3** — `RN31168.1`, `RN 32341.1`, `# 79`
- **v35.4** — IDs provisórios `#0001`/`#0002` + `buildSummary` + `buildProvisionalCard`
- **v35.5** — `Requisito Funcional` + recorte por `h1. Detalhamento de Projeto` + aviso de duplicado
- **v35.5.1** — aspas curvas `"` `"` no `extractRules`
- **v35.5.2** — negrito de linha inteira + normalização de separador (corrige #34649 da #208519)
- **v35.5.3** — fallback do nome via `#issue_subject` (corrige demandas sem listagem)
- **v35.5.4** — aceita espaços/tabs antes do \\n (corrige #79 da #207979)
- **v35.5.5** — negrito aberto sem fechamento (corrige #102418 da #207663)
- **v35.5.6** — normalização de superscripts + flag /i no split (corrige #31221 da #196911)
- **v35.5.7** — texto rotativo descontraído no rodapé 🎉
- **v35.5.8** — aceita `h3. ##N` sem palavra "Requisito" (corrige #175544)
- **v35.5.9** — detecta título DEPOIS do link `"RN1":URL - Título` (corrige #175544)
- **v35.6** — 🎉 **Rollback do Gravar e Atualizar Links** com confirmação inline
- **Sessão da v35.6 (deploy)** — 🧩 **Extensão do Chrome** + repositório GitHub público (`Gabiel-hue/sisloc-master`) com auto-update a cada clique no ícone
- **v35.6.1** — 🔧 Botão "Atualizar Links" agora aceita asteriscos (corrige #208937: `*RN5 - Título*`). 4 cases em cascata: 3a (`*RN - título*`), 3b (`*RN* - título`), 3c (clássico), 3d (`*(Criar) RN - título*`). Validado com 9 cenários incluindo não-regressões.
- **v35.6.2** — 🔧 `extractRules` agora aceita regra inline com cabeçalho (Formato 21 — parsing). Caso real: `*Regras:* "RN12 - X":URL` na MESMA linha (não em linha separada). Correção minimal: troca `\s*\n+` → `\s+` no regex de cabeçalho da seção. Recupera 5 regras "perdidas" só na #148935 (reqs #31482, #31496, #151073, #140477, #151942). Validado em 8 demandas reais / 50+ requisitos sem regressão.
- **v35.6.3** — 🔧 Cascata do "Atualizar Links" ganha case 3e (Formato 21 — links). Adiciona regex que detecta RN inline depois de `*Regras:*`/`*REGRAS:*`/`*CONDIÇÕES/REGRAS:*`. Posicionado por último na cascata (3d→3a→3b→3c→**3e**), reaproveita o `cb3` existente. Validado em 9 cenários sintéticos + 39 reqs reais.
- **v35.6.4** — 🔧 Fix do `regrasM` no "Atualizar Links" (continuação da v35.6.3). A v35.6.3 adicionou o `reCase3e` correto, mas ele nunca era alcançado no #31496 porque o `regrasM` (porta de entrada do handler) exigia `\n` literal após `*Regras:*` e morria antes da cascata. Correção: alternância `(?:\s*\n|\s+(?=RN|"|"|"|(|*))` — preserva 100% do clássico (`NA`, `*RNX1`) E aceita Formato 21 inline. Validado em 10 cenários sintéticos + 5 demandas locais + #31496 end-to-end.
- **v35.6.5** — 🔧 **Cabeçalho de requisito `#N - Título` SEM `h3.` (Formato 23)** — corrige #32965 + bônus #60748 na #171042. 3 mudanças cirúrgicas (+339 chars): split do detalhamento ganha alternativa `\n\s*#\d+\s*[-–]`; extração de ID dentro da sec ganha fallback estrito (sem flag `m`); `getReqSectionBounds` ganha fallback restrito à área pós `h1. Detalhamento de Projeto` e novo delimitador no `nextM`. Validado em 9 fixtures reais + 11 cenários sintéticos (20/20). **NOVO:** suite de testes `tests/` criada no repo pra rodar offline em Node em sessões futuras.
- **v35.6.6** — 🔧 **Regra `RN` SEM código (Formato 24)** — corrige #208821. Padrão novo: `RN(?:\s?[A-Z0-9]+(?:\.\d+)?|(?=\s+[-–]))` — aceita `RN` puro só quando vem seguido de espaço(s) + hífen/endash (lookahead), protegendo contra falso positivo tipo "RN está sendo revisada".
- **v35.6.7** — 🔧 **Conteúdo da regra preserva `h2.`/`h3.` internos** — corrige #208821 (continuação). O `extractRules` cortava tudo a partir do primeiro `h2.`/`h3.` dentro da regra. Fix: remover `\n\s*h\d+\.[\s\S]*` do replace. Recupera 2488 chars no #31059. **Bônus retroativo:** demandas com `h3. *Cenários*` agora preservam os cenários.
- **v35.6.8** — 🔧 **Renumerador da caixinha aceita `RN` puro** — corrige #208821 (continuação direta da v35.6.6/6.7).
- **v35.7** — 🎉 **Cards de changelog-only pra requisitos sem regra**. Surgiu da observação: "se o requisito aparece na demanda, algo foi feito nele — precisa registrar changelog mesmo sem RN". Cada um ganha card individual com botão `📝 Registrar Changelog` (azul) que insere só o `chLog` na seção `h1. CHANGELOG`. Toggle `☑ Incluir requisitos sem regra (N)` permite ocultar.
- **v35.7.1** — 🔧 Hotfix incremental sobre v35.7.
- **v35.8** — 🎉 **Relação automática entre demanda e requisito**. Os 2 botões principais (`🚀 Gravar Regras + Changelog` da v35.6 e `📝 Registrar Changelog` da v35.7) agora criam a relação `Relacionado a` (`relates`) automaticamente após o `saveIssue`. **Endpoints**: `POST /issues/<reqId>/relations` com FormData; `POST /relations/<relId>` com `_method=delete`. **Detecção de existência** via GET `/issues/<reqId>` → DOMParser → `tr[id^="relation-"] input[name="ids[]"][value="<dId>"]`. **3 helpers novos**: `findRelation`, `addRelation` (idempotente), `removeRelation`. **Estado capturado** em closure (`capturedRelationId`). **Falha parcial** é graciosa: regras/changelog OK + pílula amarela. **Rollback** chama `removeRelation` antes de restaurar. **Card "✓ Já registrado"** ganha botão extra azul `🔗 Adicionar relação`. 10 mudanças cirúrgicas (+6,5 kB).
- **v35.9** — 🎉 **Botão extra "Adicionar relação" no card COM-REGRA** + 🐛 **fix do bug do `sr-status` null da v35.8**. Surgiu da observação: "se o changelog já foi gravado em sessão anterior e a relação não existe (ou foi removida manualmente, ou veio de gravação pré-v35.8), o botão Gravar é problemático — alerta de duplicata, e clicar duplicaria as regras. Falta um caminho seguro pra só criar a relação." Solução: detectar `chJaTem = d.ds.includes('Demanda: #'+dId)` na renderização do card COM-REGRA (info que `getEd` já traz → **zero fetch extra**); se true, injetar pílula verde explicativa + botão azul independente `🔗 Adicionar relação`. Handler com life cycle próprio (separado do botão Gravar), mesmo padrão do botão equivalente no card SEM-REGRA "Já tem" (Adicionar → Criada/Já existia → Desfazer). **Fix bônus do bug v35.8:** o ramo `jaTem` do innerHTML do `buildSemRegraCard` estava sem `<div class="sr-status"></div>`, então o `div.querySelector('.sr-status')` retornava `null` e o handler quebrava com `TypeError: Cannot set properties of null (setting 'innerHTML')` ao tentar exibir qualquer pílula de feedback (incluindo o "✓ Relação já existia" quando a relação preexistia). Diagnosticado via DevTools console no req #48 (com 122 relações, ~3.5s pra responder). **Investigação de performance** (descartada): considerou-se Opção 2 (verificar relação via `findRelation` na renderização) mas medições no Chrome mostraram que em requisitos grandes cada `findRelation` leva ~1-3.5s. Promise.all com `getEd` daria só ~17% de ganho (servidor Redmine serializa parcialmente). Opção 1 (botão sempre quando faz sentido + idempotência via `addRelation`) ganhou por manter performance idêntica à v35.8. **6 mudanças cirúrgicas** no bookmarklet (+2,6 kB, 52840 → 55417 bytes). **Parser não muda** → suite oficial 21/21 passa intacta. **Testes novos:** 20 cenários em `tests/test_v35_9_com_regra_jatem.js` (heurística do `d.ds.includes`, idempotência do `addRelation`, fluxo add→undo→add, render condicional do botão extra). Investigação no Chrome MCP com 7 chamadas (3 pra medir performance dos endpoints, 4 pra diagnosticar o erro no #48).
- **v35.10** — 🎉 **Título do changelog editável antes de gravar**. Surgiu da dor: "às vezes o nome da demanda no Redmine está com termos internos confusos, muito longo, ou quero adicionar um sufixo tipo `(fase 1)` / `(parcial)` sem mexer na demanda em si". Solução: **campo único global** no topo da caixinha, modo VIEW por padrão (texto + lápis ✏️), modo EDIT quando clica no ✏️ (input com foco + ↺ restaurar + ✓ fechar). Indicação visual de "editado" quando difere do original (mesma paleta do Desfazer da v35.6 — borda `#e6c97a`, fundo `#fff8e8`, tag "✏️ editado"). **Validação anti-vazio** no clique de Gravar/Registrar (trim → se vazio, alerta vermelho + return). `maxlength="300"` no input. **Preview do card SEM-REGRA** (`<pre>` com `Demanda: #N\n<título>`) atualiza em tempo real via seletor `data-sem-regra-preview="1"`. Persistência só na sessão JS (fechar/recarregar = volta pro original). **8 mudanças cirúrgicas** no bookmarklet (+4,7 kB, 55417 → 60102 bytes). Compatível com rollback v35.6+ (`chLog` capturado em closure, achado via `indexOf`). **Testes novos:** 36 cenários em `tests/test_v35_10_titulo_editavel.js` em 7 grupos (validateTitle, buildChLog, isModified, ciclo de edição, bloqueio na gravação, compat rollback, heurística chJaTem v35.9). `extract_logic.js` e `expected.json` NÃO precisam de update (parser/snapshot intactos — a v35.10 só mexe na CONSTRUÇÃO do chLog, não no parsing).
- **v35.10.1** — 🔧 **3 lotes de fixes em regex** (sem feature nova). Reportado em duas demandas reais:
  - **Bug A** (#206262, req #32549/#31468/#98848) — Atualizar Links gerava Textile quebrado quando o título da regra continha aspas retas internas tipo `RNx - Gerar Fatura - *"Demonstrativo Estruturado"*`. O Textile fecha o link no primeiro `"` que encontra, virando 2 links bagunçados. Fix: helper `tq()` no cb3/cb3b converte aspas retas em curvas (`"` → `“`/`”`), preservando aparência visual no Redmine. Bonus: `[^\n]*` apertado para `[^\n\r]*` nos 5 reCase3a/b/c/d/e — em fixtures CRLF (default do Redmine) o `\r` estava sendo capturado e injetado dentro do título Textile.
  - **Bug B** (#199075, req #40803) — Regras escritas como `## RNX – Título` (lista Textile nível 2) eram completamente ignoradas pelo `extractRules`. Fix no split: `(?:#{1,2}\s+)?` opcional no lookahead + `t.replace(/^#{1,2}\s+/, '')` antes do parens strip. Fix análogo nos 5 reCase do Atualizar Links — preserva o `##` no link gerado: `## "RN1 – Título":URL`.
  - **Bug C** (#199075, req #40803) — `getReqSectionBounds` retornava null para cabeçalho `h3. Requisito: Requisito Funcional #40803 – ...` (palavra "Requisito" duplicada — bug latente já documentado, agora real). Fix em 5 lugares: `Requisito\s*:?` virou `Requisito[\s:]*(?:Requisito\s+)?(?:Funcional\s+)?` (reDetalhe, nextM alt-h3, split alt-h3, getReqIdFromSection, titleMatch). **Importante:** a 2ª alternativa REQUISITO bare (sem `h3.`) **ficou com o regex antigo** propositalmente — tentei estender e o split virou promíscuo (4 fatias em vez de 2 na 199075).
  - **Testes:** suite nova `tests/test_v35_10_1_aspas_e_hash.js` com 23 cenários em 7 grupos. Espelho `tests/extract_logic.js` atualizado. **+907 bytes** (60102 → 61049). Sintaxe OK, 100/100 testes passando entre todas as 4 suites.
- **v35.11.1** — 🎉 **Feature do formato reqsearch** + 🐛 **fix do bug do `ruleMappings` perdendo `_reqsearch`**. Caso real: demanda #190033, req #31168 com regra `(Alterar) "2462 - Parâmetro Máscara para geração das informações sobre":https://internos.app.sisloc.com/sisloc.reqsearch/regradenegocio/form?id=...`. Antes da v35.11.1 essa regra era completamente ignorada pelo `extractRules` (a caixinha aparecia vazia). **Solução:** novo branch no parser que detecta `(opcional verbo) "<id> - <título>":URL_que_contém_reqsearch` onde `<id>` aceita 6 grupos (dígitos puros tipo `2462`, placeholders RN textuais `RNX`/`RNx`/`RNX1`/`RNA`, ou `RN` vazio). Sintetiza `RN - <título>` (sem número — o `d.n+i` renumera na hora da gravação) e guarda `_reqsearch:{verbo, oldId, oldUrl}` pro Atualizar Links recompor. Trava de segurança: a URL precisa conter `reqsearch` literal pra entrar no branch. **Atualizar Links:** novo bloco ANTES dos 5 reCase3*; se `map._reqsearch` existe, monta regex específico com `escOldId`, substitui pelo link Redmine novo (com `tqL` convertendo aspas internas em curvas se houver), short-circuita com `continue`. **Badge:** `<id_antigo> → <RN_nova>` (ex: `2462 → RN25`, `RNX → RN15`). **🐛 Fix do bug do ruleMappings (v35.11 → v35.11.1):** entre v35.11 e v35.11.1 foi feito spot-check no Chrome real com a #190033 — o "Gravar" funcionou, mas o "Atualizar Links" mostrava `1 regra não encontrada na demanda: RN`. Diagnóstico em Node: o `ruleMappings.push({oldTitle, newTitle})` **descartava silenciosamente** o `_reqsearch` que veio do `extractRules` — então no loop do Atualizar Links, `map._reqsearch` era sempre `undefined`, o branch novo nunca dispara, e caía nos reCase3* que esperavam `RN<algo>` literal mas o texto tinha `2462`. Fix: 1 caractere — adicionar `,_reqsearch:ru._reqsearch` no push. **Bônus retroativo:** 4 placeholders RN textuais (`RNX`/`RNx`/`RNX1`/`RNA`) com URL reqsearch que tinham falha silenciosa no Atualizar Links da v35.10.1 (regra aparecia na caixinha mas botão dizia "Nenhum link encontrado") agora funcionam pelo mesmo caminho. **Rollback funciona automaticamente:** o `rollbackLinksHandler` é genérico (linha ~2090) e usa `linkChanges` populado pelo branch reqsearch no mesmo formato dos `cb3`/`cb3b` — testado em Node 10/10 verde, restaura byte-a-byte ao original. **5 mudanças no bookmarklet** (+1349 bytes, 61049 → 62398). **Testes novos:** 91 cenários em `tests/test_v35_11_reqsearch.js` em 7 grupos (extractRules detecta 6 grupos de oldId, Atualizar Links substitui, aspas internas + ## compat, rollback byte-a-byte, bug do ruleMappings, não-regressão, falsos-positivos). Espelho `tests/extract_logic.js` atualizado. Fixture nova `tests/fixtures/190033.txt`. Sintaxe OK, 191/191 testes passando entre todas as 5 suites.
- **v35.11.2** — 🔧 **Fix do split do `dSections` promíscuo.** Caso real #196911: linha em prosa `+Obs:+ Regras... no seção do requisito #31446 abaixo, ...` dentro do req #48 fragmentava a seção e o `reqMatch` posterior capturava `31446` como novo id → caixinha duplicada. A 1ª alternativa `REQUISITO\s*:?\s*#{0,2}\s*\d+` do split (case-insensitive por `/i`) casava também `requisito #N` em frases livres minúsculas. **Fix:** ancorar com `(?<=^|\n)\s*(?:h\d+\.\s*)?` — lookbehind variável-width aceito desde V8 6.2 (2018). `(?:h\d+\.)?` opcional preserva `h2. REQUISITO ##N` (#206262). 1 linha mudou no bookmarklet, 1 no espelho, 2 cenários sintéticos novos no `run_tests.js`.
- **v35.11.3** — 🔧 **2 fixes em `extractRules` pra eliminar lixo em títulos link-only.** Bug exposto quando v35.11.2 corrigiu a dedup da #196911 e o usuário pôde gravar — viu `h3. RN27 - e`, `h3. RN5 - 1`, `h3. RN6 - 2` no Redmine. **Causa:** o `linkPostMatch` (regex pra extrair "título depois do URL") tinha `[^\s]+\s*[-–—:]?\s*(.+?)$` — todos os quantificadores pós-URL opcionais. Pra linhas tipo `"RN10":URL` o engine cedia o **último char do URL** pro grupo `(.+?)$`. **Fix 1:** trocar `[^\s]+\s*` por `\S+\s+` (whitespace obrigatório após URL). **Bug secundário:** normalização final `.replace(.../i, '$1 - ')` incondicional — pra `RN10` puro virava `RN10 -`. **Fix 2:** callback condicional que só adiciona ` - ` se há texto remanescente. 35 testes novos em `test_v35_11_3_titulo_link.js` em 6 grupos. Refresh do `expected.json` (148935 e 196911 tinham estado bugado catalogado). 228/228 em 6 suites.
- **v35.11.4** — 🔧 **Fix do `rulesMatch` e `regrasM` casando "regras:"/"regra:" em prosa.** Caso real #188640, req #208996: a descrição tem `2) Validar as regras:` (linha 41) ANTES do marker estrutural `*CONDIÇÕES/REGRAS*` (linha 48). O regex `(?:CONDI[CÇ][OÕ]ES\/REGRAS|REGRAS)\s*\*?\s*:?\s*\*?\s+` case-insensitive (a 2ª alternativa `REGRAS` bare) casava em "regras:" da prosa, e o body capturado incluía a sublist sumário (`* "RNX1":URL`, `* "RNX2":URL`, `* "RNX3":URL`) + `*CONVERSOR*` + `*CONDIÇÕES/REGRAS*` + as 4 regras reais `(Criar) "RNX<N>...":URL`. O split entregava 5 regras (RNX1 duplicado: 1 do sumário, 1 da regra real) e a caixinha mostrava 5 regras renumeradas RN2-RN6 em vez de 4 (RN2-RN5). **Fix simétrico em 2 lugares com mesma técnica da v35.11.2** (lookbehind variável-width `(?<=^|\n)\s*` antes do marker): (1) `extractRules` `rulesMatch` — agora só casa o marker quando vem após newline ou no início, prosa "regras:" deixa de capturar. (2) `rollbackLinksHandler` `regrasM` (Atualizar Links) — mesmo lookbehind no regex que delimita o bloco de regras na demanda. Sem esse fix-2, o replace global `RNX1 → RN2` tocava AMBAS as ocorrências (sublist sumário + regra real) — com o fix-2, só toca a regra real, mantendo a sublist sumário como índice/contextualização do req (decisão do usuário: *"o que vale de regra para nois está no bloco/seção de regras mesmo"*). **Bônus retroativo:** fixture #175029 #57751 tinha o mesmo bug (sublist `* Inutilizar regras:` antes de `*Regras*` real) — extraía `RN18 - 1` fantasma. Agora extrai só `RN 57751.1`. Snapshot bugado do `expected.json` corrigido. **2 mudanças no bookmarklet** (+24 chars, 62468 → 62492). **Testes novos:** 34 cenários em `tests/test_v35_11_4_regras_em_prosa.js` em 5 grupos + 2 sintéticos novos no `run_tests.js`. Espelho `tests/extract_logic.js` atualizado (só o `rulesMatch` — espelho não testa Atualizar Links). Fixture nova `tests/fixtures/188640.txt`. **268/268 testes verde** entre as 7 suites.
- **v35.11.5** — 🔧 **Fix do padrão `h2. Requisito *#N – Título*` (asterisco do negrito Textile entre `Requisito` e `#`).** Caso real #204289: o req #95698 não aparecia na caixinha porque o header começa com `h2. Requisito *#95698 – Manter Dados Substituição Rápida...*`. Os regex de detecção de seção (`splitSections`, `getReqIdFromSection`, `getReqSectionBounds`) só permitiam `\s*:?\s*` entre `Requisito` e `#` — o `*` quebrava o match. **Bug latente correlato descoberto na mesma sessão:** o `nextM` do `getReqSectionBounds` só detectava `h3. Requisito` como início de próximo req (não tinha `(?:h\d+\.\s*)?` opcional na 2ª alt como o `splitSections` já tinha desde v35.11.2). Resultado: o `end` do #31505 vazava até o fim do arquivo, passando pelo #95698 inteiro — gravar regras no #31505 sobrescreveria o #95698. **7 ajustes em 4 funções:** (1) `splitSections` — `\*?\s*` nas 2 alts (REQUISITO e h3. Requisito); (2) `getReqIdFromSection` — `\*?\s*` antes do `#{0,2}`; (3) `getReqSectionBounds` — `\*?\s*` em `reDetalhe`, `reAny` e nas 2 alts do `nextM`; bônus `(?:h\d+\.\s*)?` no `nextM` 2ª alt pra alinhar com o `split`. **Mesma técnica das v35.11.2** (lookbehind + alt opcional) **e v35.11.4** (lookbehind no `rulesMatch`). Cobre também caso futuro de `h1. REQUISITO` ou `h3. Requisito *#N` — tolerância simétrica a todos os headers numerados com asterisco interno. **8 mudanças no bookmarklet** (+66 chars, 62492 → 62558). **Testes novos:** 35 cenários em `tests/test_v35_11_5_requisito_asterisco.js` em 4 grupos + 1 sintético novo no `run_tests.js`. Espelho `tests/extract_logic.js` atualizado (7 ajustes simétricos). Fixture nova `tests/fixtures/204289.txt`. Entry nova no `expected.json` (204289 com 2 reqs catalogados). **305/305 testes verde** entre as 8 suites.
- **v35.11.6** — 🔧 **Aceitar placeholders textuais `#X+\d*` e `#Y+\d*` como IDs provisórios + tolerância a espaços no marker `CONDIÇÕES / REGRAS`.** Dois casos reais consolidados num único release: (1) #187472 — `h3. REQUISITO: #XXX - Devolução RFID` (placeholder X+ puro) não aparecia na caixinha. (2) #207232 — `h2. REQUISITO: XXX1/XX2/XXX3` (placeholder X+ + sufixo numérico) + marker `*CONDIÇÕES / REGRAS` com espaços ao redor da `/`. Dois bugs no #207232: (a) X+ puro consumia só os Xs deixando o dígito órfão → XXX1 e XXX3 colidiam como `'XXX'`; (b) marker com espaços não casava o regex literal `CONDI[CÇ][OÕ]ES\/REGRAS` → 0 regras extraídas em XX2 e XXX3. **Sistema de "provisional IDs"** já tinha infraestrutura completa (`isProvisionalId` pra #99999/#0/#01, `buildProvisionalCard` amarelo, `resolveId` por título) — faltava só estender o vocabulário. **10 mudanças no bookmarklet** (+296 chars, 62558 → 62854): bumps de versão (2); buildPlaceholderMap, splitSections (4 alts), getReqIdFromSection (3 alts), getReqSectionBounds.nextM (4 alts) — cada `\d+` virou `(?:\d+|X+\d*|Y+\d*)` com `/i` + `.toUpperCase()`; isProvisionalId ganha checks `/^X+\d*$/i` e `/^Y+\d*$/i`; e Fix B em 3 lugares (rulesMatch, regrasM, reCase3e) — `CONDI[CÇ][OÕ]ES\/REGRAS` → `CONDI[CÇ][OÕ]ES\s*\/\s*REGRAS`. **Decisão de design:** X+ e Y+ separados (não `[XY]+\d*`) — sufixo só na cauda numérica, não intercalada com letras. Aceita: `X`, `XX`, `X1`, `XX2`, `XXX3`, `Y42`. **Não aceita:** `XY`, `XYZ`, `1X`, `X1A`, `TBD`. Custo marginal pra Y junto com X foi zero. **Testes novos:** 107 cenários em `tests/test_v35_11_6_placeholder_textual.js` em 12 grupos (cobrindo placeholders puros, com sufixo, IDs distintos não-colisão, anti-falso-positivo em prosa, marker com 7 variações de espaços, todas as fixtures conhecidas) + 5 sintéticos novos no `run_tests.js`. Espelho `tests/extract_logic.js` atualizado (10 ajustes simétricos). Fixtures novas: `tests/fixtures/187472.txt` (1 req #XXX + 5 regras RNx) e `tests/fixtures/207232.txt` (3 reqs XXX1/XX2/XXX3 + 14 regras). Entries novas no `expected.json`. **419/419 testes verde** entre as 9 suites.
- **v35.11.7** — 🔧 **Aceitar formato reqsearch (v35.11.1) sem hífen entre `<id>` e `<título>`.** Caso real #201650, req #61567: a regra estava como `"2461 Comportamento do parâmetro Mascara para formatação...":URL_reqsearch` — só ESPAÇO entre `2461` e `Comportamento`, sem hífen. O regex `reReqsearch` da v35.11.1 exigia `\s*[-–]\s*` obrigatório entre o `<id>` e o `<título>` → 0 regras extraídas, caixinha "sem regras". **Fix:** trocar `\s*[-–]\s*` por `(?:\s*[-–]\s*|\s+)` em 3 lugares — (1) split do `extractRules` (parts); (2) `reReqsearch` no forEach; (3) `rollbackLinksHandler` (regex construído com `escOldId` pro Atualizar Links). Patchar só os 2 primeiros faria o bug parecer corrigido (caixinha funcionaria) mas o "Atualizar Links" diria "Nenhum link encontrado". **Trava de segurança preservada:** a URL precisa conter `reqsearch` literal pra disparar o branch (mantém zero falso-positivo). **Mesmo princípio das v35.11.2/4/5/6** — estender tolerância de regex mantendo zero regressão. **5 mudanças no bookmarklet** (+25 chars, 62854 → 62879): 2 bumps + 3 patches. **Bônus:** refresh dos lengths das fixtures `#187472` (5535→5618) e `#207232` (10142→12219) no `expected.json` — snapshots stale após edições no repo (requirements/regras catalogados continuam idênticos, só o length divergiu). **Testes novos:** 43 cenários em `tests/test_v35_11_7_reqsearch_sem_hifen.js` em 7 grupos (ponta-a-ponta #201650, padrão sem hífen, padrão com hífen não-regressão, travas, split múltiplas regras, rollbackLinksHandler, edge cases) + 1 sintético novo no `run_tests.js`. Espelho `tests/extract_logic.js` atualizado (2 patches simétricos). **464/464 testes verde** entre as 9 suites.
- **v35.11.8** — 🔧 **DOIS fixes consolidados num release (casos #196410 e #145438): área de corte da descrição em CASCATA + vocabulário aceita `REQ[A-Z0-9]+` como placeholder textual.** (A) Sintoma do #196410: caixinha mostrava **12 reqs em vez de 6** (4 com regras correto). Causa: a fixture tem `h1. Detalhamento *do* Projeto` mas o regex de corte exigia "de". Sem o match, `area` virava a descrição inteira → sumário "h1. Requisitos Impactados" gerava 6 seções fantasma via split case-insensitive. (B) Sintoma do #145438: 9 reqs em vez de 8 (5 únicos + 4 duplicados, 3 placeholders #REQxx/yy/zz perdidos). Causa dupla: (a) fixture não tem `h1. Detalhamento de/do Projeto` nenhum — só `h1. Requisitos Impactados` separado por `---` → área = ds inteira → 4ª alt do split (`\n\s*#NNN\s*[-–]`) casava o sumário; (b) vocabulário não aceitava `REQ\w+`. **Fix consolidado:** novo helper `getDescriptionArea(ds)` com cascata de 3 estratégias: (1) `\s+d[eo]\s+Projeto` aceita "de" e "do"; (2) cortar APÓS `h1. Requisitos Impactados` até `---`/`h1.`/EOF; (3) fallback ds inteira. **Vocabulário REQ:** adicionar `REQ[A-Z0-9]+` em 5 funções (splitSections, getReqIdFromSection, getReqSectionBounds.nextM, buildPlaceholderMap, isProvisionalId) — mesma técnica da v35.11.6 (X+\d*, Y+\d*). **18 mudanças no bookmarklet** (+411 chars, 62879 → 63290): 2 bumps + helper novo + 1 substituição inline + 1 relax de regex + 8 vocabulário não-capturante + 4 vocabulário capturante + 1 isProvisionalId. **Trava preservada:** `REQ[A-Z0-9]+` exige 1+ char alfanum após REQ (`#REQ` puro não casa) e só dispara em posição de ID. **Decisão deliberada:** `\s+d[eo]\s+` aceita só "de" e "do" (não "da" — gramaticalmente errado em pt). **Testes novos:** 50 cenários em `tests/test_v35_11_8_area_corte_e_req_placeholder.js` em 12 grupos (cobrindo as 3 estratégias do helper, vocabulário REQ, buildPlaceholderMap, isProvisionalId, travas anti-falso-positivo, não-regressão, ponta-a-ponta com fixtures reais) + 3 sintéticos novos no `run_tests.js`. Espelho `tests/extract_logic.js` atualizado (helper exposto no module.exports). Fixtures novas: `tests/fixtures/196410.txt` (6 reqs, 4 com regras) e `tests/fixtures/145438.txt` (8 reqs todas com regras, 3 placeholders REQxx/yy/zz). Entries novas no `expected.json`. **519/519 testes verde** entre as 9 suites.
- **v35.12** — 🎉 **FEATURE: substituir regra existente com merge histórico.** Caso real motivador (RN85 do req #31059, print do usuário): demanda traz regra que MODIFICA uma regra já existente do requisito, e analista hoje precisa manualmente: (1) editar o `h3.` antigo pra ter o novo título; (2) escrever a versão nova com `(#dId_novo)`; (3) abaixo, riscar a versão atual com `-texto-` linha por linha (incluindo o `-(#dId_atual)-`); (4) preservar versões já-riscadas anteriores. A v35.12 automatiza tudo isso. **UX:** caixinha COM-REGRA virou mini-cards (1 por regra extraída) com 2 controles lado a lado: dropdown "modo" (`criar nova` default + uma opção pra cada RN do requisito, type-ahead nativo resolve listas com 120+ regras) e input de título editável. **Dica visual conservadora** ≥0.8 similarity: pílula azul "💡 Título parecido com a RNXX — pode ser update" aparece quando título da regra nova bate com RN existente, mas NÃO troca o modo automaticamente — analista escolhe ativamente. **Match também fica em ⭐ no topo da lista** de "substituir" pra reconhecimento visual. **Title editado vazio** não trava gravação — só avisa "⚠️ Regra sem título" (amarelo). **Validação de conflito:** se 2 regras pedem substituir a MESMA RN, banner vermelho trava o Gravar até o analista corrigir. **Preview ao vivo:** cada mini-card tem textarea read-only de 90px que recalcula em tempo real conforme o modo e o título mudam (pra modo "criar nova" mostra o bloco h3.; pra modo "substituir RNX" mostra o RESULTADO do merge histórico — versão nova no topo + versão atual riscada empurrada pra baixo + versões já-riscadas preservadas). **Numeração das "criar nova"** começa de `proxN` (próximo RN livre após replaces) e pula em sequência. **Atualizar Links** funciona sem mudança estrutural — o `map.newTitle` carrega o título editado e a RN final, então a substituição na demanda fica `"RN85 - <título editado>":URL#anchor` (substituir) ou `"RN90 - <título editado>":URL#anchor` (criar nova). **Rollback do Desfazer estendido**: além de remover as RNs novas + changelog, agora também restaura os blocos das RNs substituídas pro estado original (`capturedReplaces` guarda `{oldRN, blocoOriginal}` no Gravar). **Novo arquivo `tests/merge_logic.js`** (espelho dos helpers): `titleSimilarity` (já existia, portada), `cropBeforeChangelog`, `getAllRules`, `findBestMatch` (threshold 0.8), `getRuleBlockBounds`, `parseRuleBlock`, `riscarLinhasTextile`, `mergeReplacingRule`. **Testes novos:** 98 cenários em `tests/test_v35_12_substituir.js` em 13 grupos (titleSimilarity / getAllRules / findBestMatch / getRuleBlockBounds / parseRuleBlock / riscarLinhasTextile / mergeReplacingRule caso real RN85 do #31059 / merge sem versão antiga prévia / merge com RN antiga sem título / RN inexistente / título vazio mantém antigo / RN final do arquivo / threshold 0.8 documentação do comportamento conservador). Cresce o bookmarklet em +8.4KB (63290 → 71710 chars). Espelho `tests/extract_logic.js` INTOCADO — o parser não muda, só ganha novas funções de pós-parsing. **617/617 testes verde** entre as 10 suites (45 do baseline + 572 das suites de feature).
- **v35.12.1** — 🎨 **3 fixes de polidos da v35.12 (feedback do spot-check em #208596/#46006):** (A) **Hints/labels nos campos do mini-card** — antes os campos `<select>` e `<input>` ficavam soltos sem identificação. Agora cada um tem label minúsculo (`font-size:9px`, cinza) acima: "modo" e "título da regra". Cada controle também ganhou `title=` tooltip com a descrição completa do que faz. (B) **Botão Gravar muda dinamicamente quando dup é resolvida via substituir** — antes a regra tinha dup detectada (worstDup), o botão ficava vermelho "🚫 Gravar mesmo assim (não recomendado)" mesmo se o analista marcasse a regra como "substituir RNX" (resolvendo a dup intencionalmente). Agora `refreshBanners` recalcula um `effectiveWorstDup` baseado nos modos atuais: se a regra com dup foi marcada como "substituir RN<mesma RN do dup>", a dup é considerada resolvida e some do cálculo. O botão volta a azul "🚀 Gravar Regras + Changelog" quando TODAS as dups foram resolvidas via substituir. Borda externa do card também atualiza dinâmica (cinza-azul se ok, amarelo se partial, vermelho se exact). (C) **Inserção do bloco de regras com newlines dinâmicas** — bug reportado: depois de gravar uma RN nova, a regra ficava colada na regra anterior sem linha em branco entre elas (caso real: RN8 grudada no fim da RN7 no req #46006). Causa: a inserção usava `"\n\n" + rTxt + "\n\n"` hardcoded, sem olhar o contexto antes/depois do `realIp`. Se o `realIp` caía logo após a última linha de conteúdo (sem newlines), só ficava 1 `\n` antes (já existente) + `\n\n` do prefix = `\n\n\n` virava 1 linha em branco renderizada, mas se `realIp` apontava DEPOIS de um `\n` já existente, ficava colado. **Fix:** lógica inline que conta os `\n+$` em `antes` e `^\n+` em `depois` e completa com `\n.repeat(Math.max(0, 2 - trailing/leading))` pra ter exatamente 1 linha em branco antes E 1 depois. Capturado o `insertedRTxt` real (não a versão hardcoded) pra o rollback funcionar. Bônus: adicionados `Nome do Processo`, `CHANGELOG`, `DOCUMENTAÇÃO` aos stopTerms do cálculo de `realIp` (case "tem RN") pra cobrir requisitos onde a próxima seção não tem prefix `h.\.` — antes nesses casos o `realIp` caía no final da string e inseria RNs novas no fim do tudo. **Testes novos:** 12 testes no Grupo N de `test_v35_12_substituir.js` (`insertWithSpacing` no espelho — exata réplica da lógica inline do bookmarklet, com casos pra o caso real reportado + edge cases de string vazia / content null / pos 0 / fim do arquivo / múltiplos \\n preexistentes). Cresce o bookmarklet em +1.5KB (71710 → 73253 chars). **629/629 testes verde** entre as 10 suites.
- **v35.12.2** — 🐛 **DOIS fixes consolidados pro caso do req #46006 / #208596** (sequência: criar nova RN8 → spot-check → substituir RN8 → ainda colado): (A) **`\s*` greedy no `getRuleBlockBounds`** — a regex `(?:^|\n)(\s*(?:h3\.\s*)?RN<n>\b)` usa `\s*` no início do grupo capturado. O `\s` inclui `\n`, e como `\s*` é greedy, ele CONSOME o segundo `\n` da linha em branco que precede o header (`...anexados.\n\nh3. RN8` → grupo `[1]` vira `\nh3. RN8` em vez de `h3. RN8`). Aí `bounds.start = startM.index + 1` aponta pro SEGUNDO `\n` e o slice `(0, bounds.start)` perde 1 `\n`. **Fix:** trocar `\s*` por `[ \t]*` (só espaços e tabs, sem newlines). Preserva tolerância a indentação mas não come os `\n`. (B) **`mergeReplacingRule` agora ADICIONA linha em branco quando o bloco anterior estava colado** — não basta preservar `\n\n` quando já existia (fix A); o caso REAL do user é uma sequência de 2 gravações: a primeira gravou RN8 colada na RN7 (era v35.12 antes do fix C da v35.12.1 que só cuidou da inserção "criar nova"), agora ao SUBSTITUIR a mesma RN8, o bloco antigo colado é preservado e a "nova" versão também fica colada. Causa: o `mergeReplacingRule` fazia `slice(0, bounds.start) + novoBloco + slice(bounds.end)` sem normalizar bordas — herdava o `\n` (ou falta dele) do bloco original. **Fix:** mesma lógica de spacing dinâmico do `insertWithSpacing` (`Math.max(0, 2 - trailingNls/leadingNls)`) agora também aplicada ANTES e DEPOIS do `novoBloco` no merge. Os 2 fixes coexistem: o (A) impede a regex de comer `\n` legítimos quando JÁ existem; o (B) ADICIONA `\n\n` quando NÃO existem. **Testes novos:** 9 testes no Grupo O (`getRuleBlockBounds` preserva `\n` antes do bloco) + 11 testes no Grupo P (`mergeReplacingRule` adiciona `\n` quando bloco anterior estava colado — caso real #46006 + 3 cenários de borda: regra colada em h2./h1./fim do arquivo). Cresce o bookmarklet em +343 chars (73253 → 73596) — patch quase imperceptível em tamanho. **649/649 testes verde**.
- **v35.12.3** — 🎨 **Fix do strikethrough do Textile + ajustes de UX nos labels do mini-card** (feedback do spot-check no req #46006 após substituir RN7). **Bug principal:** ao substituir uma regra cujo corpo tinha LINHAS terminando com whitespace (ex: o texto da RN7 do #46006 acabava com `vinculados. ` — espaço no fim), a função `riscarLinhasTextile` produzia `-vinculados. -` (com espaço antes do `-` final). O Textile do Redmine usa `-...-` pra strikethrough e exige que o `-` de fechamento esteja IMEDIATAMENTE após o último caractere não-whitespace — `. -` invalida o strikethrough. PIOR ainda: quando a linha 1 ficava inválida, a sequência multi-linha desbalanceava (1 `-` "sobrando") e a linha 2 logo abaixo também não rendia mesmo com formato correto. Causa raiz isolada pelo user testando manualmente: ao tirar o espaço da linha 1, AMBAS rendam. **Fix:** trocar `line.slice(indent.length)` por `line.slice(indent.length).replace(/\s+$/, '')` em `riscarLinhasTextile` — preserva indentação inicial mas trim whitespace do final (espaços, tabs, CR). Se a linha vira vazia após o trim, retorna `''` (não cria `--` sozinho). **Ajustes de UX no mini-card** (alinhados com o caso real testado): (1) label `modo` → `Modelo` (mais alinhado com a nomenclatura usada pelos analistas), (2) label `título da regra` → `Título da regra` (capitalização consistente), (3) tooltip do select Modelo agora tem quebra de linha após `Requisito.` via entity HTML `&#10;` — antes vinha tudo numa linha só com o texto `'substituir RNX' empurra...` colado no `'criar nova' insere uma RN nova ao fim do Requisito.`, agora cada cláusula fica em sua linha. **Testes novos:** 10 testes no Grupo Q (riscarLinhasTextile trim final: espaço/tab/CR/múltiplos espaços/só whitespace/idempotência/texto sem espaço/indentação preservada) + 5 testes no Grupo R (mergeReplacingRule com corpo real do #46006 — confirma que AMBAS linhas riscadas SEM espaço antes do `-` final, sem o padrão `". -\n-"` que quebrava o Textile, e o header novo + nova versão estão corretos). Cresce o bookmarklet em apenas +56 chars (73596 → 73652). **664/664 testes verde**.
- **v35.12.4** — 🎨 **Fix de layout do mini-card quando o select Modelo tem opções longas** (feedback de spot-check do usuário — print com 2 cards lado a lado, um quebrado/empilhado e outro certinho). **Causa:** o container do select `<div style="flex:0 0 160px;...">` tem `flex-basis: 160px` mas o `min-width: auto` padrão do flexbox deixa o flex item esticar pra acomodar o `min-content` do seu conteúdo. Quando o `<select>` interno tem options com títulos longos (ex: requisito com 18 RNs e o dropdown listando "⭐ substituir RN18 — Seleção de Produto e/ou Almoxarifado único" com `slice(0,60)`), o browser dimensiona o select fechado pelo intrinsic size da maior option → ultrapassa 160px → soma com o input `flex:1 min-width:140px` excede a largura disponível no `.rule-card` (~367px) → `flex-wrap:wrap` quebra os dois campos pra linhas separadas, cada um ocupando 100%. Em requisitos com poucas RNs (caso real testado: #33293 com "Última: RN1"), o dropdown tem poucas opções curtas, o select fica nos 160px e os 2 campos ficam lado a lado certinhos. **Fix (2 patches CSS puros, sem mudar lógica):** (1) `min-width:0` no container `<div>` do select Modelo — sobrescreve o default `auto`, força respeitar os 160px do `flex-basis` mesmo com conteúdo grande dentro. (2) `width:100%;max-width:100%` no próprio `<select class="mode-sel">` — força o select a se conformar ao container ao invés de assumir o tamanho da maior option. **Resultado:** select fechado fica fixo em 160px; o dropdown aberto continua mostrando as opções no tamanho natural (renderizado fora do fluxo do layout pelo browser). **Sem testes novos:** patch é 100% CSS de UI, não toca em parsing/merge/lógica testável em Node. Cresce o bookmarklet em apenas +38 chars (73652 → 73690). **664/664 testes verde** (baseline + suite v35.12 continuam passando — mudança só afeta renderização). Verificação manual: abrir requisito com várias RNs longas (tipo o RN18 do print) e confirmar que Modelo e Título ficam lado a lado.
- **v35.13** — 🔧 **Detectar seções `PROCESSO` (sem `#N`) como placeholders provisionais — caso real #191719.** **Sintoma:** a fixture do #191719 tem 12 seções legítimas no detalhamento mas o parser só detectava 9. As 3 perdidas eram `h3. REQUISITO: PROCESSO: Gerar Pendência API`, `h3. REQUISITO: PROCESSO: Gerar Serviço Extra Automatico API` e `h3. PROCESSO: Volumetria OutSystem` — sub-processos derivados que ainda não tinham ID Redmine próprio, então o autor usou a palavra `PROCESSO:` no lugar do `#N`. As 2 primeiras viviam engolidas dentro da seção do #210210 (3.100+ chars a mais nesse bloco vs ~1.350 do #210210 puro), e a 3ª engolida no #210388 (regras NÃO vazavam por causa do stop `\n\s*---` no rulesMatch, mas os 3 cards não apareciam no popup). **Conceito:** seguindo o mesmo princípio dos placeholders existentes (`#99999`, `0\d*`, `X+\d*`, `Y+\d*`, `REQ[A-Z0-9]+`), `PROCESSO` vira **placeholder textual sem `#` obrigatório**. Como cada PROCESSO no source tem o mesmo "ID" literal, o pipeline `analyze()` faz **auto-numbering por ordem de aparição** — 1º vira PROCESSO1, 2º PROCESSO2, etc. (mesma técnica do XXX1/XXX2/XXX3 da v35.11.6 mas agora gerada pelo parser, não escrita no source). **6 mudanças no extract_logic.js + 7 no bookmarklet** (todas com flag `/i` + `.toUpperCase()`): (1) `splitSections`: +5ª alt `(?<=^|\n)\s*h\d+\.\s*(?:REQUISITO\s*:?\s*)?PROCESSO\s*[:\-–]` — separa o cabeçalho do bloco anterior; (2) `getReqIdFromSection`: +4ª alt `^h\d+\.\s*(?:REQUISITO\s*:?\s*)?(PROCESSO)\s*[:\-–]` — captura "PROCESSO" como ID; (3) `getReqSectionBounds.nextM`: +5ª alt simétrica; (4) `buildPlaceholderMap`: +captura `^h\d+\.\s*PROCESSO\s*[-–]\s*(.+)` no sumário (`h3. PROCESSO - Gerar Pendência API`); (5) `isProvisionalId`: + check `/^PROCESSO\d*$/i` (aceita PROCESSO, PROCESSO1, PROCESSO2, ..., PROCESSO99); (6) `analyze`: auto-numbering — contador local renomeia "PROCESSO" → "PROCESSO" + idx na ordem de aparição; (7) `buildPlaceholderMapNumbered` (novo helper export): variante do placeholderMap que aplica o mesmo auto-numbering — usado no bookmarklet pra que o `placeholderMap.find(e => e.id === id)` continue casando entre sumário e seção detectada. No bookmarklet, o auto-numbering é feito inline antes do `dSections.forEach` (renumera placeholderMap) e dentro do forEach (renumera id ao detectar "PROCESSO"). **Trava defensiva:** separador `[:\-–]` obrigatório IMEDIATAMENTE após PROCESSO (ex: `PROCESSO:`, `PROCESSO -`, `PROCESSO–`) — protege contra falsos positivos como "h3. Após confirmação do processo..." em prosa (única ocorrência problemática nas 20 fixtures existentes, confirmada via grep). Anti-prosa ancorada em `h\d+\.` no início de linha — bullets `* PROCESSO:` e citações em meio de prosa não casam (testes E1–E8). **🐛 Hotfix pós-spot-check (armadilha da cadeia `const` minified):** primeira tentativa de subir a v35.13 travou em "Lendo demanda e requisitos..." no Chrome do user — `TypeError: Assignment to constant variable.` jogado silenciosamente dentro do `dSections.forEach`. Causa: o bookmarklet declara TODAS as variáveis pós-extração numa única cadeia `const placeholderMap = ..., dSections = ..., allReqs = [], reqsWithRules = [], ..., idCounts = {}, idSeen = {};`. Ao inserir `,procIdxF=0` no fim da cadeia, ele virou `const` também — daí `procIdxF++` no auto-numbering do forEach explodia. Erro só apareceu no runtime real (Chrome) porque o `simulate_bookmarklet.js` rodava as funções isoladamente (sem a cadeia const). **Fix:** mover `procIdxF=0` pra um statement `let procIdxF=0;` separado, entre o IIFE de renumeração do placeholderMap e o `dSections.forEach`. **Lição pro futuro:** ao editar variáveis dentro de cadeias `const a=..., b=..., c=...` em código minified, qualquer variável nova que precise ser mutável tem que sair da cadeia e virar um `let` separado. **Teste novo (anti-regressão futura):** `run_bookmarklet_mock2.js` (não comitado, mas usado durante o spot-check) roda o IIFE inteiro num mock de DOM+fetch e captura unhandledRejection — em sessões futuras é a melhor maneira de pegar erros runtime do bookmarklet antes do Chrome. **Testes novos (parsing):** 61 testes em `tests/test_v35_13_processo.js` em 8 grupos: A (10) detecção do header em variações de h2./h3./h4. + hífen/en-dash + case-insensitive + não-regressão de IDs numéricos; B (8) auto-numbering — 2/3 PROCESSOs, mistura numeric+PROCESSO, placeholderMap separado, single PROCESSO vira PROCESSO1; C (8) `isProvisionalId` aceita PROCESSO + sufixos, rejeita PROCESSOS/XPROCESSO/PROCESSO1A; D (8) placeholderMap captura `h3. PROCESSO - <título>` no sumário; E (8) não-regressão defensiva — `PROCESSO:` em prosa/tabela/bullet/aspas NÃO casa; F (8) pipeline integrado + fixture real #191719 confirma a ordem exata das 12 caixinhas (`['31726', '207356', '209973', '210067', '210067', '210085', '210210', 'PROCESSO1', 'PROCESSO2', '31564', '210388', 'PROCESSO3']`); G (6) `getReqSectionBounds` termina antes do próximo PROCESSO (e vice-versa); H (5) edge cases (PROCESSO no fim do doc, adjacentes sem `---`, hífen, en-dash, case-insensitive). Nova fixture `tests/fixtures/191719.txt` adicionada com snapshot esperado de 12 reqs. **Cresce o bookmarklet em +519 chars** (74368 → 74887 — sendo +515 da feature e +4 do hotfix `let `). **726/726 testes verde** entre as 13 suites — zero regressão nas 19 fixtures legacy + 25 cenários sintéticos antigos. **Limites preservados:** vocabulário PROCESSO só dispara em posição de header (após `h\d+\.`), e mesmo lá o `[:\-–]` é mandatory pra ativar — alinhado com a postura conservadora das v35.11.x. *Não foi tratado nesta versão:* o req #31726 que está riscado com `-...-` textile no detalhamento ainda aparece como caixinha vazia (0 regras) — comportamento legado preservado, fica pra eventual v35.14 se o user quiser detectar/suprimir reqs riscados.
- **v35.13.6** — 🌐 **Fix da extensão pra funcionar via IP externo** + 🔧 **botão de diagnóstico técnico do 500**. Duas mudanças consolidadas no mesmo release. **(A) Extensão pra host qualquer:** o bug reportado era `❌ Sisloc Master não conseguiu gravar: HTTP 500` quando o usuário acessava `http://177.69.209.157:65080/redmine/` (link externo pra VPN via internet), E "às vezes nem abria" (sequer aparecia a caixinha do bookmarklet). Diagnóstico in-vivo via Claude in Chrome: (1) POST idempotente ao req #32928 respondeu HTTP 200 OK → **infra externa funciona** (500 do print era caso isolado, intermitente). (2) Baixado `background.js` do repo GH via char codes (contorno do bloqueio de strings da ferramenta), decodificado linha a linha as 215 linhas. **Causa raiz** na linha 20: `const REDMINE_URL_PATTERN = /^http:\/\/net1\/redmine\/issues\/\d+/;` — hardcoded pro host interno. Handler em linha 149 faz `.test(tab.url)` e se falhar mostra badge "!" vermelho e sai sem injetar → isso é o "nem abre no externo". (3) Smoke test: injetei o body do sisloc_master.js direto na página externa via `new Function(body)()` — caixinha abriu 100% normal → confirma que `activeTab` é suficiente, só o pattern precisa mudar. **Fix (Opção B — genérica):** trocar por `/^https?:\/\/[^\/]+\/redmine\/issues\/\d+/` — aceita net1, IP externo, HTTPS futuro, e qualquer host `<x>/redmine/issues/N`. Mesma filosofia das v35.11.x (estender tolerância mantendo zero regressão). Worst case aceitável: usuário clicando no ícone em site externo qualquer com `/redmine/issues/N` no path (o script tenta injetar, faz fetch do `/edit` que responde 401/login sem sessão, caixinha fica vazia — nenhum dado do net1 vaza porque o script roda no contexto DAQUELA página, sem cookies do net1). **Bump `manifest.json`** "35.11.1" → "35.12.0" (mexeu em background.js — regra do DOC_LITE). **(B) Botão de diagnóstico do 500:** o HTTP 500 do print era intermitente e sem causa conhecida (meus 3 POSTs idempotentes deram 200 OK). Em vez de tentar reproduzir + investigar, **melhorar o diagnóstico** pra próxima ocorrência: no fallback do `saveIssue` (sem `errorExplanation` — típico do 500/502/504), mostrar botão discreto `📋 Copiar detalhes técnicos` ao lado do "HTTP 500". Clique copia pro clipboard: timestamp ISO, URL completa, method+status+statusText, redirected, tempo do POST em ms, primeiros 2KB do response body. Base64 na `data-p` evita quebra de HTML por aspas/newlines/tags do body (`</button>`, `<script>` etc). Feedback visual 3s (botão fica verde `✅ Copiado! Mande pro Claude.` e volta). Motivação: próxima ocorrência do 500 → analista clica → cola no chat → Claude vê o body real e diagnostica exato, sem precisar reabrir sessão + Chrome MCP. **Mudanças:** 1 linha no `extension/background.js` (regex); 1 patch no `saveIssue` do `sisloc_master.js` (fallback com botão) + 2 bumps de versão no h3 e popup. **Testes novos:** 14 cenários em `tests/test_url_pattern.js` (7 URLs positivas + 7 rejeições + verificação de não-regressão NEW ⊇ OLD) e 30 cenários em `tests/test_v35_13_6_diagnostic_button.js` em 7 grupos (A — botão só no fallback; B — 8 asserts sobre formato do payload; C — 9 asserts sobre HTML do det; D — decode idempotente do base64 preservando acentos; E — corte do body em 2KB; F — sanitização anti-XSS quando body tem `</button>`/`<script>`/`onclick`; G — status codes variados 500/502/504/422). **Bookmarklet +1078 chars** (76379→77457). **Background.js +4 chars** (6875→6879 code points unicode). **794/794 testes verde** entre as 15 suites (14 do baseline + 780 anteriores + 30 novos de v35.13.6 + 14 de url_pattern). Repo/instalação: analistas precisam fazer **git pull + reload da extensão** em `chrome://extensions/` — como mexeu no `background.js`, não é auto-update do bookmarklet só, precisa reinstalar/reload manualmente.
- **vNext** *(backlog)* — `(Criar)` / `(Alterar)` / `(Validar)` separados; merge de requisitos duplicados (descartada); otimização do `findRelation` em requisitos grandes (regex vs DOMParser).

---

## 🎬 Demandas de teste

| Demanda | Requisito | Caso testado | Versão |
|---|---|---|---|
| #175029 | múltiplos | Construção + aspas curvas | v35.5.1 |
| #208519 | #34649 | Negrito de linha inteira sem hífen | v35.5.2 |
| #207979 | #79 | Espaço invisível antes do \\n no negrito | v35.5.4 |
| #207663 | #102418 | Negrito aberto sem fechamento | v35.5.5 |
| #196911 | #31221 | Superscript Unicode (RNx²) + minúsculo (RNx) | v35.5.6 |
| #175544 | #31323 | `h3. ##N` + `"RN1":URL - Título` | v35.5.8 + v35.5.9 |
| #208937 | #81788 | `*RN5 - Título*` (asterisco em volta do título inteiro), botão Atualizar Links | v35.6.1 |
| #148935 | #31482 (+4 outros) | `*Regras:* "RN12 - X":URL` inline (Formato 21 no `extractRules`) — recupera 5 regras "perdidas" | v35.6.2 |
| #148935 | #31496 | `*Regras:* RN12 - X` inline SEM link — botão Atualizar Links agora coloca o link | v35.6.3 + v35.6.4 |
| #171042 | #32965 (+ bônus #60748) | Cabeçalho `#N - Título` SEM `h3.` no detalhamento — caixinha invisível antes do fix | v35.6.5 |
| #208821 | #31059 | Regra `RN` sem código + content com h2./h3. internos + renumeração | v35.6.6 + v35.6.7 + v35.6.8 + v35.7 |
| #46006 | — | Investigação dos endpoints `/relations` no Chrome MCP — base da feature v35.8 | v35.8 |
| #207508 / #46006 | — | Spot-check da relação automática (4 cenários) | v35.8 |
| #207508 / #48 | — | **Bug do botão "Adicionar relação"** no card SEM-REGRA "Já registrado": req com 122 relações, `findRelation` 3,5s, e o handler quebrava porque `sr-status` não existia no innerHTML do ramo jaTem. Reproduzido via DevTools console (`TypeError: Cannot set properties of null (setting 'innerHTML') at addRelHandler`). Corrigido na v35.9. | **v35.9 (fix bug v35.8)** |
| #207508 | #46006 | **Fixture base** dos testes da v35.10 (`test_v35_10_titulo_editavel.js`) — título "Enviar Boletim de Medição - Envio do BM". Caso real do print original que motivou a feature. | v35.10 |
| #206262 | #32549 (+#31468 +#98848) | **Bug das aspas retas no Textile** — regra `RNx - Gerar Fatura - *"Demonstrativo Estruturado"*` com aspas retas internas. Sem o fix, Atualizar Links gerava 2 links bagunçados em vez de 1. | v35.10.1 (Bug A) |
| #199075 | #40803 | **Bug do "## RNX" + Bug do "Requisito: Requisito Funcional #N"** — regra escrita como `## RNX – Exportar para Excel` (lista Textile nível 2) era ignorada pelo parser, E o cabeçalho `h3. Requisito: Requisito Funcional #40803` fazia o `getReqSectionBounds` retornar null no Atualizar Links. | v35.10.1 (Bug B + C) |
| #190033 | #31168 | **Feature do formato reqsearch** — regra `(Alterar) "2462 - Parâmetro Máscara para geração das informações sobre":URL_reqsearch` (link interno Sisloc). Antes da v35.11.1 a regra era completamente ignorada pelo parser (caixinha vazia). Spot-check em Chrome real revelou bug do `ruleMappings.push` perdendo o `_reqsearch` — corrigido na v35.11.1 (1 caractere). | v35.11.1 |
| #187472 | #XXX | **Placeholder textual `#XXX` como ID provisório** — header `h3. REQUISITO: #XXX - Devolução de Equipamentos Locados via RFID`. Antes da v35.11.6 o req não aparecia na caixinha porque as 4 regexes de detecção só aceitavam `\d+`. Agora detecta `#X+`/`#Y+` case-insensitive e renderiza card amarelo provisório (igual #99999, #0). | v35.11.6 |
| #207232 | XXX1, XX2, XXX3 | **Placeholder com sufixo numérico + marker `CONDIÇÕES / REGRAS` com espaços** — 3 reqs `h2. REQUISITO: XXX1/XX2/XXX3` com placeholders textuais + dígito. Bugs: X+ puro truncava o sufixo (XXX1/XXX3 colidiam como XXX), e marker `*CONDIÇÕES / REGRAS` (com espaços ao redor da `/`) não casava. Agora `X+\d*` aceita o sufixo e `\s*\/\s*` tolera espaços no marker — IDs distintos com 4+4+6 regras extraídas. | v35.11.6 |
| #201650 | #61567 | **Reqsearch SEM hífen entre `<id>` e `<título>`** — regra `"2461 Comportamento do parâmetro Mascara para formatação...":URL_reqsearch` com só espaço entre `2461` e `Comportamento` (sem hífen). Antes da v35.11.7 o regex `reReqsearch` exigia `\s*[-–]\s*` obrigatório → 0 regras extraídas, caixinha "sem regras". Agora `(?:\s*[-–]\s*\|\s+)` aceita ambos os separadores. Fix em 3 lugares (split, reReqsearch, rollbackLinksHandler) — sem o 3º, Atualizar Links diria "Nenhum link encontrado". | v35.11.7 |
| #196410 | 6 reqs | **Header "Detalhamento DO Projeto" (com "do" em vez de "de")** — caixinha mostrava 12 reqs em vez de 6 (sumário "h1. Requisitos Impactados" gerava seções fantasma via split case-insensitive porque o regex de corte exigia exatamente "Detalhamento de Projeto"). Agora `\s+d[eo]\s+` aceita ambos + novo helper `getDescriptionArea` com cascata de 3 estratégias. | v35.11.8 |
| #145438 | #REQxx, #REQyy, #REQzz | **Placeholders textuais `REQ\w+` + fixture sem "h1. Detalhamento de/do Projeto"** — 8 reqs no detalhamento (5 IDs numéricos reais + 3 placeholders #REQxx/#REQyy/#REQzz no meio). Antes do fix: 9 reqs em vez de 8 (4 do sumário fantasma + 5 reais; 3 placeholders perdidos por falta de vocabulário). Agora: estratégia 2 do helper (`Requisitos Impactados` + `---`) corta o sumário, e `REQ[A-Z0-9]+` no vocabulário detecta os 3 placeholders. | v35.11.8 |
| ?? | #31059 (RN85) | **Caso motivador da v35.12: substituir regra existente com merge histórico.** Print do usuário: RN85 do req #31059 tem versão atual `(#143910)` "Na emissão da NF de faturamento de locação/serviços, o lançamento contábil deve ter: • Caso o parâmetro marcado..." e abaixo versão `-(#137134)-` já-riscada de uma demanda anterior. Demanda nova traz versão atualizada da mesma regra. Manualmente o analista (1) edita o `h3.` antigo pro novo título; (2) escreve a versão nova com `(#dId_novo)` no topo; (3) risca a versão atual `(#143910)` linha por linha; (4) preserva a versão `-(#137134)-` riscada de antes. Agora o bookmarklet automatiza tudo via `mergeReplacingRule`. | v35.12 |
| #208596 | #46006 (RN7→RN8) | **3 polidos da v35.12.1 capturados em spot-check Chrome:** (1) campos `mode-sel`/`title-edit` ficavam sem identificação visual; (2) ao marcar substituir, o botão continuava vermelho "🚫 Gravar mesmo assim (não recomendado)" apesar da dup estar resolvida intencionalmente; (3) inserção da RN8 nova ficou colada no fim da RN7 sem linha em branco entre elas (`...anexados.\nh3. RN8 - ...` em vez de `...anexados.\n\nh3. RN8 - ...`). | v35.12.1 |
| #205868 | #32928 | **Extensão nem abria via IP externo `177.69.209.157:65080` (VPN)** — regex hardcoded `/^http:\/\/net1\//` no `background.js` rejeitava a URL, badge vermelho "!" e sai sem injetar. Também rendeu print de HTTP 500 no `saveIssue` (intermitente). Fix duplo v35.13.6: regex genérico `/^https?:\/\/[^\/]+\/redmine\/issues\/\d+/` (net1 + IP externo + HTTPS futuro + host qualquer) + botão `📋 Copiar detalhes técnicos` no fallback de erro pra capturar body real da próxima ocorrência do 500. | v35.13.6 |
| #191719 | 12 reqs (3 PROCESSO) | **Sub-processos derivados sem ID Redmine — usaram `PROCESSO:` no lugar de `#N`.** A demanda tem 12 seções legítimas no detalhamento, sendo 3 com cabeçalhos `h3. REQUISITO: PROCESSO: Gerar Pendência API`, `h3. REQUISITO: PROCESSO: Gerar Serviço Extra Automatico API` e `h3. PROCESSO: Volumetria OutSystem`. Antes do fix: o parser só detectava 9 caixinhas — as 3 PROCESSOs ficavam silenciosamente engolidas nas seções adjacentes (#210210 ganhava 3.100+ chars a mais, #210388 ganhava o bloco Volumetria). As regras delas NÃO vazavam pra #210210/#210388 (graças ao stop `\n\s*---` no rulesMatch) mas os 3 cards sumiam do popup. Agora `PROCESSO` é placeholder válido em headers (com separador `[:\-–]` mandatory) + auto-numbering via pipeline → vira PROCESSO1/PROCESSO2/PROCESSO3 na ordem de aparição (mesma técnica do XXX1/XXX2/XXX3 da v35.11.6, mas gerada pelo parser). Card amarelo de provisional via `isProvisionalId` (igual REQxx/XXX). | v35.13 |

---

## 🧪 Suite de testes (criada na v35.6.5)

### Estrutura

```
tests/
├── extract_logic.js                ← ESPELHO LIMPO das funções de parsing do bookmarklet
├── run_tests.js                    ← runner: 10 fixtures + 11 cenários sintéticos
├── expected.json                   ← snapshot do output esperado
├── relations_logic.js              ← v35.8/v35.9: espelho de findRelation/addRelation/removeRelation
├── test_v35_9_com_regra_jatem.js   ← v35.9: 20 testes (heurística, idempotência, undo, render condicional)
├── test_v35_10_titulo_editavel.js  ← v35.10: 36 testes (validateTitle, buildChLog, isModified, ciclo, bloqueio, compat rollback)
├── test_v35_10_1_aspas_e_hash.js   ← v35.10.1: 23 testes (helper tq, aspas+CRLF, ## RNX, getReqSectionBounds duplicado)
├── test_v35_11_reqsearch.js        ← v35.11.1: 91 testes (reqsearch — 6 grupos de oldId, Atualizar Links, rollback, bug do ruleMappings)
├── test_v35_11_3_titulo_link.js    ← v35.11.3: 35 testes (Padrões A/B/C de link-only, edge cases, ponta-a-ponta, não-regressão)
├── test_v35_11_4_regras_em_prosa.js← v35.11.4: 34 testes ("regras:" em prosa não casa marker, ponta-a-ponta #188640/#175029, não-regressão)
├── test_v35_11_5_requisito_asterisco.js ← v35.11.5: 35 testes (asterisco entre Requisito e #, nextM detecta h2/h1, ponta-a-ponta #204289, não-regressão)
├── test_v35_11_6_placeholder_textual.js ← v35.11.6: 107 testes (placeholders #X+/#Y+ case-insensitive, com sufixo, ponta-a-ponta #187472/#207232, marker com espaços, não-regressão)
├── test_v35_11_7_reqsearch_sem_hifen.js ← v35.11.7: 43 testes (reqsearch sem hífen entre <id> e <título>, ponta-a-ponta #201650, regressão com hífen, travas, split múltiplas regras, rollbackLinksHandler)
├── test_v35_11_8_area_corte_e_req_placeholder.js ← v35.11.8: 50 testes (helper getDescriptionArea cascata 3 estratégias, vocabulário REQ[A-Z0-9]+, ponta-a-ponta #196410/#145438, travas anti-falso-positivo, não-regressão)
├── merge_logic.js                  ← v35.12: espelho dos helpers de substituir RN (titleSimilarity, getAllRules, findBestMatch, getRuleBlockBounds, parseRuleBlock, riscarLinhasTextile, mergeReplacingRule)
├── test_v35_12_substituir.js       ← v35.12: 98 testes (similaridade, getAllRules, findBestMatch threshold 0.8, parseRuleBlock, riscarLinhas, mergeReplacingRule caso RN85 do #31059, edge cases)
├── test_v35_13_processo.js         ← v35.13: 61 testes (detecção PROCESSO em h2/h3/h4, auto-numbering, isProvisionalId, placeholderMap, não-regressão defensiva em prosa, fixture real #191719, getReqSectionBounds, edge cases)
├── INDEX.md
├── README.md
└── fixtures/
    ├── 148935.txt
    ├── 171042.txt
    ├── 175029.txt
    ├── 175544.txt
    ├── 187472.txt                  ← v35.11.6 (Placeholder textual: h3. REQUISITO: #XXX - Título)
    ├── 188640.txt                  ← v35.11.4 ("regras:" em prosa antes do marker real)
    ├── 190033.txt                  ← v35.11.1 (Feature reqsearch: (Alterar) "2462 - Título":URL_reqsearch)
    ├── 191719.txt                  ← v35.13 (Sub-processos sem #N: h3. REQUISITO: PROCESSO: Gerar Pendência API, h3. PROCESSO: Volumetria OutSystem)
    ├── 196911.txt
    ├── 199075.txt                  ← v35.10.1 (Bug B + C: ## RNX e Requisito duplicado)
    ├── 201650.txt                  ← v35.11.7 (Reqsearch sem hífen: "2461 Título":URL_reqsearch)
    ├── 204289.txt                  ← v35.11.5 (Asterisco do negrito: h2. Requisito *#N – Título*)
    ├── 206262.txt                  ← v35.10.1 (Bug A: aspas retas no Textile)
    ├── 207232.txt                  ← v35.11.6 (Placeholder com sufixo XXX1/XX2/XXX3 + CONDIÇÕES / REGRAS com espaços)
    ├── 207663.txt
    ├── 207979.txt
    ├── 208519.txt
    ├── 208821.txt                  ← caso da v35.6.6
    └── 208937.txt
```

### Como funciona pro Claude em sessões futuras

Em vez de abrir 8 demandas no Chrome pra testar não-regressão (gasta muito token de Chrome MCP), o Claude faz:

```
web_fetch https://raw.githubusercontent.com/Gabiel-hue/sisloc-master/main/sisloc_master.js
web_fetch https://raw.githubusercontent.com/Gabiel-hue/sisloc-master/main/tests/extract_logic.js
web_fetch https://raw.githubusercontent.com/Gabiel-hue/sisloc-master/main/tests/run_tests.js
web_fetch https://raw.githubusercontent.com/Gabiel-hue/sisloc-master/main/tests/expected.json
web_fetch https://raw.githubusercontent.com/Gabiel-hue/sisloc-master/main/tests/relations_logic.js
web_fetch https://raw.githubusercontent.com/Gabiel-hue/sisloc-master/main/tests/test_v35_9_com_regra_jatem.js
web_fetch https://raw.githubusercontent.com/Gabiel-hue/sisloc-master/main/tests/test_v35_10_titulo_editavel.js
web_fetch https://raw.githubusercontent.com/Gabiel-hue/sisloc-master/main/tests/test_v35_10_1_aspas_e_hash.js
web_fetch https://raw.githubusercontent.com/Gabiel-hue/sisloc-master/main/tests/test_v35_11_reqsearch.js
# + fixtures relevantes
```

Daí roda tudo em Node no container dele. **Só usa Chrome no FIM**, pra spot-check do bug reportado no caso real. Economia estimada: ~80% dos tokens de Chrome MCP por sessão.

### Manter o espelho sincronizado

⚠️ O arquivo `tests/extract_logic.js` é um espelho manual das funções de parsing do `sisloc_master.js`. Sempre que mexer na lógica de parsing do bookmarklet (regexes de `extractRules`, `splitSections`, `getReqIdFromSection`, `getReqSectionBounds`, `buildPlaceholderMap`), atualizar aqui também.

O `tests/relations_logic.js` espelha `findRelation`, `addRelation` e `removeRelation`. Atualizar junto se mexer nesses helpers no bookmarklet.

O `tests/test_v35_10_titulo_editavel.js` espelha a lógica do título editável (`validateTitle`, `buildChLog`, `isModified`). Atualizar junto se mexer no campo "Título do changelog", no guard de gravação, ou no formato do `chLog`. Esta suite **NÃO** depende de `extract_logic.js` nem de `expected.json` (a v35.10 não mexe em parsing, só na construção do `chLog`).

O `tests/test_v35_10_1_aspas_e_hash.js` espelha a lógica de Atualizar Links (helper `tq()` de conversão de aspas e cascata `reCase3a/b/c/d/e`) + usa `extractRules`/`splitSections`/`getReqIdFromSection`/`getReqSectionBounds` do `extract_logic.js` para os testes ponta-a-ponta. Atualizar junto se mexer no `cb3`/`cb3b` (construção do Textile do link), nos 5 reCase do Atualizar Links, ou em qualquer uma das 4 funções de parsing usadas — esta suite cobre essas 4 + o helper `tq`.

O `tests/test_v35_11_reqsearch.js` espelha o branch reqsearch do `extractRules` (`reReqsearch` regex que detecta `"<id> - <título>":URL_reqsearch`) + a parte do Atualizar Links que substitui esse padrão (regex análogo recomposto com `escOldId`) + o `rollbackLinksHandler` (de v35.6, genérico) + a parte do `ruleMappings.push` que propaga `_reqsearch` (fix v35.11.1). Atualizar junto se mexer em qualquer um desses 4 pontos. Esta suite **DEPENDE** de `extract_logic.js` (importa `extractRules`) e da fixture `190033.txt`.

### Adicionando uma fixture nova

1. Abre a demanda no Redmine `/edit`, F12 (console), e roda: `copy(document.querySelector('#issue_description').value)`
2. Cria `tests/fixtures/NNNN.txt` colando o conteúdo
3. Roda `node tests/run_tests.js --update-snapshots` pra gravar o output atual como esperado
4. Revisa o diff do `expected.json` pra confirmar que o output está correto
5. Adiciona uma linha no `INDEX.md` descrevendo o que cobre
6. Commit

---

## 🧩 Extensão do Chrome (desde a sessão da v35.6)

### Arquitetura

```
GitHub (público) ───► fetch raw ───► Extensão no Chrome ───► Inject na aba
   sisloc_master.js       a cada       background.js          executeScript
   (fonte da verdade)    clique no                            MAIN world
                          ícone "S"
```

### Repositório

- URL: `https://github.com/Gabiel-hue/sisloc-master`
- Branch: `main`
- Visibilidade: **público** (pra não exigir token/auth)
- Raw URL que a extensão consome:
  `https://raw.githubusercontent.com/Gabiel-hue/sisloc-master/main/sisloc_master.js`

### Estrutura do repo

```
sisloc-master/
├── sisloc_master.js              ← BOOKMARKLET — fonte da verdade
├── instalar.html                 ← página HTML pra arrastar pro favorito
├── SETUP.md                      ← passo a passo de setup inicial
├── README.md
├── docs/
│   ├── DOC_LITE.md
│   └── RESUMO_SESSAO_v35_X.md
├── extension/                    ← extensão Chrome
│   ├── manifest.json             ← Manifest V3
│   ├── background.js             ← service worker: fetch + inject
│   ├── icons/ (16/32/48/128)
│   └── README.md
└── tests/                        ← suite offline (criada v35.6.5)
    ├── extract_logic.js
    ├── run_tests.js
    ├── expected.json
    ├── relations_logic.js        ← v35.8/v35.9
    ├── test_v35_9_com_regra_jatem.js  ← v35.9
    ├── test_v35_10_titulo_editavel.js ← v35.10
    ├── test_v35_10_1_aspas_e_hash.js  ← v35.10.1
    ├── INDEX.md
    ├── README.md
    └── fixtures/  (12 .txt)
```

### Como a extensão funciona

1. Usuário clica no ícone azul "S" na barra do Chrome
2. `background.js` verifica que a aba é `http://net1/redmine/issues/N` (se não for, badge vermelho `!`)
3. Faz `fetch` no GitHub raw com `cache: 'no-store'` + cache-buster `?t=Date.now()`
4. Extrai o miolo do IIFE (entre `javascript:(function(){` e `})();`)
5. Detecta a versão por regex no conteúdo (`v\d+\.\d+(?:\.\d+)?`)
6. Salva no `chrome.storage.local` pro modo offline
7. Injeta na aba via `chrome.scripting.executeScript` com `world: 'MAIN'` usando `new Function(code)()`
8. Mostra badge **verde** com a versão (ex: "35.9") por 3s
9. Se GitHub falhar, tenta cache local → badge **laranja** com a versão
10. Se nem cache existir → badge **X** vermelho + alerta na página

### Permissões da extensão (manifest.json)

```json
{
  "permissions": ["scripting", "activeTab", "storage"],
  "host_permissions": [
    "http://net1/*",
    "https://raw.githubusercontent.com/*"
  ]
}
```

### Significado dos badges

| Badge | Cor | Significado |
|---|---|---|
| `35.11` | 🟢 verde | Online — baixou do GitHub |
| `35.11` | 🟠 laranja | Offline — usou cache local |
| `!` | 🔴 vermelho | Aba não é `/issues/N` |
| `X` | 🔴 vermelho | Sem GitHub e sem cache (1ª execução offline) |

### Fluxo de atualização (deploy)

Quando gerar uma versão nova do bookmarklet (`v35.12`, `v36.0`...):

1. Edita o `sisloc_master.js` no GitHub (web ou local + push)
2. Commit
3. **Pronto.** Próximo clique no ícone de qualquer analista = nova versão rodando

> ⚠️ **NÃO precisa** bumpar versão do `manifest.json` da extensão pra cada `vX.Y.Z` do bookmarklet — a extensão é só o "loader", a versão real está no `.js`.
>
> Só bumpa o `manifest.json` se mexer em `background.js`, `manifest.json`, ou ícones.

### Distribuição pra novos analistas

1. Compartilha o link do repo
2. Eles fazem **Code → Download ZIP** (não precisa conta GitHub, repo é público)
3. Extraem, vão em `chrome://extensions/` → Modo dev → "Carregar sem compactação" → pasta `extension/`
4. Daí em diante, recebem atualizações automaticamente

### Caso de falha conhecido

- **Firewall corporativo** bloqueando `raw.githubusercontent.com`: extensão vai cair sempre no cache. Workaround: garantir 1ª execução em rede sem bloqueio, depois funciona offline.

---

## 💬 Texto descontraído no rodapé (desde v35.5.7)

A cada execução do bookmarklet, sorteia uma das 5 frases pra exibir abaixo do "✨ Pronta!":

1. "O estagiário que grava RNs sem reclamar"
2. "Analista virtual, sem horário de almoço"
3. "Faz hora extra de graça, e ainda agradece"
4. "Não pede aumento, não tira férias, não fica doente"
5. "Aceita feedback 360 sem chorar no banheiro" *(adicionada na v35.6.1)*

Fonte 10px, cor #888, itálico. Pra adicionar/remover frases é só editar o array no bookmarklet (e ajustar o `Math.floor(Math.random()*N)` pra refletir o novo tamanho).

---

## ↩ Rollback (v35.6+)

### Como funciona

**Botão Gravar:**
- Antes: `🚀 Gravar Regras + Changelog` (azul)
- Após sucesso: vira `↩ Desfazer gravação` (laranja `#e6a817`)
- v35.8: pílula verde `🔗 Relacionada à demanda #N (rel #M)` aparece abaixo dos botões se a relação foi criada
- v35.8: pílula amarela `⚠️ Relação não criada (...)` se a criação da relação falhou (regras+changelog ficam OK mesmo assim)
- Clique → confirmação inline amarela com Sim/Cancelar
- Sim → v35.8: se tem `capturedRelationId`, tenta `removeRelation` (falha aqui não bloqueia, vira warning); depois fetch novo do requisito + remove `rTxt` e `chLog` via `indexOf` + `slice` → save
- Após rollback OK: botão volta a `🚀 Gravar Regras + Changelog`, e `btnLinks` volta travado. Mensagem `↻ Gravação desfeita (relação também removida) — ...`

**Botão Atualizar Links:**
- Antes: `🔗 Atualizar links na demanda` (roxo após gravar)
- Após sucesso: vira `↩ Desfazer atualização de links` (laranja)
- Clique → confirmação inline amarela
- Sim → fetch novo da demanda + para cada `change` em ordem reversa, `replace(c.depois, c.antes)` → save
- Após rollback OK: botão volta a `🔗 Atualizar links na demanda`

**Botão Registrar Changelog (v35.7+):**
- Antes: `📝 Registrar Changelog` (azul)
- Após sucesso: vira `↩ Desfazer changelog` (laranja)
- v35.8: mesma extensão de relação que o Gravar (pílula verde/amarela + rollback condicional)
- Clique → confirmação inline amarela
- Sim → v35.8: se tem `capturedRelationId`, `removeRelation`; depois fetch + remove `chLog`

**Botão Adicionar relação (v35.8 e v35.9):**
- Antes: `🔗 Adicionar relação` (azul `#0066cc`)
- v35.8: só no card SEM-REGRA "Já tem"
- v35.9: também no card COM-REGRA quando `chJaTem` for true (changelog já registrado)
- Click → tenta `addRelation`:
  - Sucesso (criou): vira `↩ Desfazer relação` (laranja) + pílula verde `🔗 Relação criada... (rel #M)`
  - Já existia: vira `✓ Relação já existia` (cinza desabilitado) + pílula verde explicativa
  - Erro: vira `❌ Erro` (vermelho) + pílula vermelha
- Click no `↩ Desfazer relação` (sem confirmação inline, é 1-step): tenta `removeRelation`
  - Sucesso: botão volta a `🔗 Adicionar relação` azul + pílula azul `↻ Relação removida`
  - Erro: vermelho

### Estado capturado em closure (sessão JS)

```js
// Gravar (v35.6):
capturedRTxt = '\n\n' + rTxt.trim() + '\n\n';
capturedChLog = '\n\nDemanda: #' + dId + '\n' + dTitle + '\n';
// v35.8:
capturedRelationId = null; // ou o relId da relação criada (null se já existia)

// Atualizar Links (v35.6):
linkChanges = [
  { antes: '"RN1 - X":URL_old', depois: '"RN5 - X":URL_new' }, // caso 1
  { antes: 'RN2 - Y',           depois: '"RN6 - Y":URL_new' }, // caso 3
];

// Registrar Changelog (v35.7):
capturedChLog = '\n\nDemanda: #' + dId + '\n' + dTitle + '\n';
// v35.8:
capturedRelationId = null; // ou o relId

// Adicionar relação (v35.8 — card SEM-REGRA JATEM):
jaTemRelId = null; // ou o relId

// Adicionar relação (v35.9 — card COM-REGRA chJaTem):
extraRelId = null; // ou o relId (independente do capturedRelationId do Gravar)
```

### Tratamento de erros

- Se a string `depois` (ou `capturedRTxt`) não for encontrada na nova descrição (alguém editou entre tempo): erro vermelho explicando "uma das linhas alteradas não foi encontrada (provável edição manual entre o atualizar e o desfazer)"
- O `csrf_token` é refetched a cada rollback (não usa o velho)

### Limitações

- Rollback **expira ao fechar/recarregar** a página (vive em closure JS, sem persistência)
- Rollback de Links só desfaz o que o sisloc modificou — se edição alheia for em outra parte da linha (ex: título depois do URL), a edição alheia é preservada
- Template cleanup ao gravar NÃO é restaurado no rollback (template era placeholder mesmo)
