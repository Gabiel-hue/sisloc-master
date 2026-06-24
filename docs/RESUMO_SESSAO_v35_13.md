# 🗒️ RESUMO_SESSAO_v35_13.md

**Data:** 2026-06-23
**Versão entregue:** v35.13 — Detectar `PROCESSO` (sem `#N`) como placeholder provisional

---

## 🎯 O que mudou em relação à v35.12.4

### Feature principal — aceitar `PROCESSO` como token de placeholder no header

**Cenário reportado pelo user** (fixture #191719 anexa): demanda com 12 seções legítimas no detalhamento, mas o parser só pegava 9. As 3 perdidas eram:

```
h3. REQUISITO: PROCESSO: Gerar Pendência API
h3. REQUISITO: PROCESSO: Gerar Serviço Extra Automatico API
h3. PROCESSO: Volumetria OutSystem
```

Sub-processos derivados que ainda não tinham ID Redmine próprio → autor usou a palavra `PROCESSO:` no lugar do `#N`. As 2 primeiras ficavam engolidas dentro da seção #210210 (3.100+ chars a mais nesse bloco vs ~1.350 do #210210 puro); a 3ª engolida no #210388.

**Comportamento OK preservado:** as regras dessas PROCESSOs NÃO vazavam pras seções engulfantes — o stop `\n\s*---` no rulesMatch já bloqueava isso. O sintoma era os 3 cards SUMINDO do popup.

**Conceito do fix:** estender o vocabulário de placeholders (`#99999`, `0\d*`, `X+\d*`, `Y+\d*`, `REQ[A-Z0-9]+`) com `PROCESSO`, mas com 2 diferenças:
1. **Sem `#` obrigatório** — único token onde isso é assim
2. **Separador `[:\-–]` mandatory IMEDIATAMENTE após** — protege contra falsos positivos em prosa ("Após confirmação do processo")

Como cada PROCESSO no source tem o mesmo "ID" literal, o pipeline `analyze()` faz **auto-numbering por ordem de aparição** — 1º vira PROCESSO1, 2º PROCESSO2, 3º PROCESSO3 (mesma técnica do XXX1/XXX2/XXX3 da v35.11.6, mas dessa vez gerada pelo parser, não escrita no source).

### As 7 mudanças (6 no extract_logic + 1 helper novo no module.exports)

1. **`splitSections`** — +5ª alt: `(?<=^|\n)\s*h\d+\.\s*(?:REQUISITO\s*:?\s*)?PROCESSO\s*[:\-–]`
2. **`getReqIdFromSection`** — +4ª alt: `^h\d+\.\s*(?:REQUISITO\s*:?\s*)?(PROCESSO)\s*[:\-–]`
3. **`getReqSectionBounds.nextM`** — +5ª alt simétrica (mesma estrutura do splitSections)
4. **`buildPlaceholderMap`** — +captura de `^h\d+\.\s*PROCESSO\s*[-–]\s*(.+)` por linha no sumário "Requisitos Novos" (caso real: `h3. PROCESSO - Gerar Pendência API`)
5. **`isProvisionalId`** — +check `/^PROCESSO\d*$/i` (aceita PROCESSO, PROCESSO1, PROCESSO99)
6. **`analyze`** — auto-numbering inline: contador local renomeia ID `PROCESSO` → `PROCESSO` + idx
7. **`buildPlaceholderMapNumbered`** (novo helper exportado) — variante do placeholderMap que aplica o mesmo auto-numbering pra que o bookmarklet possa fazer `find(e => e.id === id)` casando entre sumário e seção detectada

### No bookmarklet — auto-numbering inline

O bookmarklet replica o pipeline com 2 trechos novos:

```js
// Antes do dSections.forEach — renumera placeholderMap
(function(){let i=0;placeholderMap.forEach(function(e){if("PROCESSO"===e.id){i++;e.id="PROCESSO"+i}})})();

// Dentro do dSections.forEach — antes do "99999"===id check
if("PROCESSO"===id){procIdxF++;id="PROCESSO"+procIdxF}
```

E mais 5 regex bumps (mesma estrutura do extract_logic) + 2 bumps de versão no popup.

---

## 📁 Arquivos atualizados

**5 arquivos pra subir no repo `Gabiel-hue/sisloc-master`:**

1. **`sisloc_master.js`** — v35.13, 74.887 chars (+519 vs v35.12.4 — sendo +515 da feature e +4 do hotfix abaixo)
2. **`tests/extract_logic.js`** — versão espelhada v35.13, com `buildPlaceholderMapNumbered` exposto no module.exports
3. **`tests/test_v35_13_processo.js`** — 61 testes novos em 8 grupos:
   - **A (10)** detecção do header em h2/h3/h4, hífen/en-dash, case-insensitive, não-regressão de IDs numéricos, defesa contra `PROCESSO ATIVO` sem separador
   - **B (8)** auto-numbering — 2/3 PROCESSOs, mistura numeric+PROCESSO, single PROCESSO vira PROCESSO1, placeholderMap vs buildPlaceholderMapNumbered separados
   - **C (8)** `isProvisionalId` aceita PROCESSO/PROCESSO1/PROCESSO99/case-insensitive, rejeita PROCESSOS (plural)/XPROCESSO/PROCESSO1A
   - **D (8)** placeholderMap captura `h3. PROCESSO - <título>` no sumário com hífen, en-dash, espaços extras, case-insensitive, mistura com `#N`
   - **E (8)** não-regressão defensiva — `PROCESSO:` em prosa/tabela/bullet/aspas/"do processo" NÃO casa
   - **F (8)** pipeline `analyze()` integrado + fixture real #191719 confirma a ordem exata das 12 caixinhas
   - **G (6)** `getReqSectionBounds` termina antes do próximo PROCESSO (e vice-versa — PROCESSO antes de #N)
   - **H (5)** edge cases (PROCESSO no fim do doc, adjacentes sem `---`, hífen, en-dash, case-insensitive)
4. **`tests/fixtures/191719.txt`** — fixture nova (27.101 chars)
5. **`tests/expected.json`** — entry nova pro #191719 com 12 caixinhas:
   ```
   ['31726', '207356', '209973', '210067', '210067', '210085', '210210',
    'PROCESSO1', 'PROCESSO2', '31564', '210388', 'PROCESSO3']
   ```
6. **`sisloc_master_DOC_LITE.md`** — bump + entrada nova no histórico + entry nova na tabela de demandas de teste + adição na árvore de fixtures

**Não mexemos em:**
- `tests/merge_logic.js`, `tests/relations_logic.js`, `tests/run_tests.js` — baseline continua intacto
- Demais arquivos de testes (10 suites) — todos continuam passando sem alteração
- Manifest da extensão

---

## ✅ Resultados de teste

- **46/46** no `run_tests.js` (45 originais + 1 fixture nova #191719) ✅
- **726/726 totais** entre as 13 suites (era 664) ✅
- Sintaxe do bookmarklet OK, 1-linha confirmada, 74.883 chars
- Simulação do pipeline do bookmarklet contra fixture #191719 retorna paridade com o extract_logic.js

| Arquivo | Status | Testes |
|---|---|---|
| run_tests.js | ✅ | 46/46 |
| test_v35_9_com_regra_jatem.js | ✅ | 20/20 |
| test_v35_10_titulo_editavel.js | ✅ | 36/36 |
| test_v35_10_1_aspas_e_hash.js | ✅ | 23/23 |
| test_v35_11_reqsearch.js | ✅ | 91/91 |
| test_v35_11_3_titulo_link.js | ✅ | 35/35 |
| test_v35_11_4_regras_em_prosa.js | ✅ | 34/34 |
| test_v35_11_5_requisito_asterisco.js | ✅ | 35/35 |
| test_v35_11_6_placeholder_textual.js | ✅ | 107/107 |
| test_v35_11_7_reqsearch_sem_hifen.js | ✅ | 43/43 |
| test_v35_11_8_area_corte_e_req_placeholder.js | ✅ | 50/50 |
| test_v35_12_substituir.js | ✅ | 145/145 |
| **test_v35_13_processo.js** (novo) | ✅ | **61/61** |

---

## ⚠️ Discussão de design — limites e trade-offs

### 🐛 Hotfix pós-spot-check — armadilha da cadeia `const` minified

**Sintoma reportado pelo user no primeiro spot-check da v35.13:** abriu o req #191719 no Chrome e a caixinha do bookmarklet ficou travada em "⏳ Lendo demanda e requisitos..." indefinidamente. Print enviado.

**Causa raiz isolada em mock de Node (DOM/fetch stubbed):** `TypeError: Assignment to constant variable.` jogado dentro do `dSections.forEach` da primeira chamada de `procIdxF++`. O bookmarklet declara TODAS as variáveis pós-extração numa única cadeia `const`:

```js
const placeholderMap = function(ds){...}(dText)
    , dSections = function(ds){...}(dText).split(...)
    , allReqs=[], reqsWithRules=[], reqsWithoutRules=[]
    , idCounts={}, idSeen={};
```

Quando inseri o counter `procIdxF=0` no FIM dessa cadeia (achando que era um statement separado), ele herdou o `const` da declaração lá no início. Daí `procIdxF++` no auto-numbering do forEach explodia. O `simulate_bookmarklet.js` original não pegou porque rodava as funções isoladamente (sem a cadeia const).

**Fix:** mover `procIdxF=0` pra um statement `let procIdxF=0;` separado, entre o IIFE de renumeração do placeholderMap e o `dSections.forEach`:

```js
// ANTES (bug):
...,idCounts={},idSeen={},procIdxF=0;(function(){...})();dSections.forEach(...)

// DEPOIS (correto):
...,idCounts={},idSeen={};(function(){...})();let procIdxF=0;dSections.forEach(...)
```

**Lição pro futuro (importante anotar):** ao editar variáveis em código minified que tem cadeia `const a=..., b=..., c=...`, qualquer variável NOVA que precise ser **mutável** tem que sair da cadeia e virar `let` separado. O `let procIdxF=0` foi adicionado depois do `;` da cadeia const.

**Diagnóstico em sessões futuras:** criei `run_bookmarklet_mock2.js` (não comitado) que roda o IIFE completo do bookmarklet num mock DOM/fetch e captura `unhandledRejection`. Em qualquer mudança grande no bookmarklet vale a pena rodar esse mock antes do Chrome real — pega erros silenciosos do async.

---

### Por que separador `[:\-–]` obrigatório

O regex pode parecer over-cautious, mas é necessário pra não casar prosa:
- ❌ Falsa: `h3. Após confirmação do processo o sistema...` (real, em 187472.txt)
- ❌ Falsa: `h3. Processos do sistema`
- ❌ Falsa: `h3. Processo de cadastro`
- ✅ Real: `h3. PROCESSO: Gerar Pendência API`
- ✅ Real: `h3. PROCESSO - Volumetria`
- ✅ Real: `h3. REQUISITO: PROCESSO: Foo`

A âncora dupla (`h\d+\.` no início + `[:\-–]` depois de PROCESSO) garante 100% precisão nas 20 fixtures legacy testadas.

### Por que auto-numbering no pipeline (não no source)

Alternativa considerada: capturar `PROCESSO` como ID literal e deduplicar via título. Rejeitada porque:
1. Quebrava o snapshot do expected.json (todos os PROCESSOs viriam com mesmo ID)
2. Confusão visual no UI (3 cards "#PROCESSO" indistinguíveis)
3. Auto-numbering posicional é determinístico e bate com o que o usuário "vê" no source

A correspondência entre sumário (`buildPlaceholderMap`) e detalhamento (`analyze` forEach) funciona porque AMBOS aplicam o mesmo auto-numbering na mesma ordem de aparição. O `find(e => e.id === id)` casa entre os dois.

### O que NÃO foi tratado nesta versão

**Req #31726 riscado:** o req #31726 da fixture aparece como caixinha vazia (0 regras, "sem título no sumário") porque tá com o bloco INTEIRO wrapped em `-...-` (textile strikethrough). O autor claramente "deletou" esse req, mas o parser ainda detecta o ID. A caixinha vazia é ruído visual.

Foi perguntado ao user e ele NÃO respondeu a essa pergunta especificamente (só respondeu a do PROCESSO). Comportamento legado preservado. Se quiser tratar, fica pra eventual v35.14:
- (a) Detectar `-h3...-` no início da seção e suprimir
- (b) Renderizar como card cinza/riscado pra visualização
- (c) Detectar strikethrough no rulesMatch e gerar 0 cards

---

## 🎬 Próximos passos sugeridos

1. **Subir os 5 arquivos no repo `Gabiel-hue/sisloc-master`:**
   - `sisloc_master.js` (raiz)
   - `tests/extract_logic.js`
   - `tests/test_v35_13_processo.js`
   - `tests/fixtures/191719.txt`
   - `tests/expected.json`
   - `sisloc_master_DOC_LITE.md`
2. **Spot-check no Chrome em real:** abrir o req #191719 e confirmar que aparecem 12 caixinhas, sendo 3 amarelas (PROCESSO1/2/3) com label "ID provisório"
3. Se quiser, decidir sobre o tratamento do #31726 riscado (perguntado mas não respondido)
4. Backlog `vNext` (se quiser explorar): separar `(Criar)/(Alterar)/(Validar)`, otimizar `findRelation`

---

## 🤖 Prompt pra próximo chat

```
Estou continuando o desenvolvimento do bookmarklet "Sisloc Master".
Versão atual: v35.13 (já testada e funcional, 726/726 testes verde).

A v35.12 implementou "substituir regra existente com merge histórico".
v35.12.1/2/3/4 ajustaram polidos do spot-check.
v35.13 adicionou suporte ao token `PROCESSO` como placeholder de header
(sem # obrigatório) com auto-numbering por ordem de aparição — caso
real #191719 onde 3 sub-processos derivados (`h3. REQUISITO: PROCESSO:
Gerar Pendência API`, `h3. REQUISITO: PROCESSO: Gerar Serviço Extra
Automatico API`, `h3. PROCESSO: Volumetria OutSystem`) ficavam
silenciosamente engolidos nas seções adjacentes. Agora viram
PROCESSO1/2/3 com card amarelo de provisional.

Caminho de teste: `cd ~/sm && node tests/run_tests.js` (baseline 46) +
`node tests/test_v35_13_processo.js` (v35.13, 61 testes).

Regras do projeto: testar em Node primeiro contra fixtures, perguntar
antes de aplicar, manter bookmarklet em 1 linha, atualizar
`tests/extract_logic.js` em paralelo com o sisloc_master.js,
adicionar testes em `test_v35_<X>.js` quando mexer em parsing/pós-parsing.
Repo: Gabiel-hue/sisloc-master.

[continuar com a próxima dúvida/feature]
```
