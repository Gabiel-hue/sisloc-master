# 🗒️ RESUMO_SESSAO_v35_13_7.md

**Data:** 2026-11-12
**Versão entregue:** v35.13.7. São 5 correções motivadas pela demanda **#212039**, testadas em Node, com o bookmarklet inteiro rodando em DOM simulado e no Chrome real pelo usuário.

---

## 🎯 Ponto de partida

Print do usuário na demanda **#212039** ("RT0 - Criar campos de FUST e FUNTTEL na NFCom (OUT / 2026)"). No card do **req #60592**, o botão "📝 Registrar Changelog" deu:

```
❌ Sisloc Master não conseguiu gravar: seção CHANGELOG não encontrada no requisito
```

Ao testar a rotina inteira da demanda (os 5 requisitos: #32745, #79, #60592, #31468, #31059), apareceram mais 3 bugs. O usuário pediu ainda uma melhoria de UX no botão de relação.

---

## 🛠️ As 5 correções

### 1. `h2. CHANGELOG` não era encontrado (#60592)

O req #60592 usa `h2. CHANGELOG`, mas os 5 pontos do bookmarklet só procuravam `/h1\.\s*CHANGELOG/i`.

**Bug latente encontrado junto:** no **Gravar Regras + Changelog**, quando o req usava `h2.`, as regras eram gravadas e o changelog era **pulado sem aviso**.

**Fix:** helper único `findChM(s)`:

```js
function findChM(s){return s.match(/h1\.\s*CHANGELOG/i)||s.match(/(?:^|\n)[ \t]*h[2-6]\.\s*CHANGELOG\b/i)}
```

- `h1.` tem prioridade, com o mesmo regex de antes, então a posição é idêntica nos reqs que já funcionavam.
- O fallback `h2.`–`h6.` exige início de linha. Prosa, `CHANGELOGS` e `h7.` não casam.
- Usado em: `getEd`, `getAllRules`, Registrar Changelog e Gravar (2×). Espelho `merge_logic.js` (`cropBeforeChangelog`) atualizado.

### 2. Marker `*REGRAS/CONDIÇÕES*` invertido (#60592 e #31468 apareciam "sem regras")

Os 3 regexes de marker só aceitavam `CONDIÇÕES/REGRAS` ou `REGRAS`. A alternativa `REGRAS\s*\/\s*CONDI[CÇ][OÕ]ES` foi adicionada em:

- `extractRules.rulesMatch` (parser);
- `regrasM` (porta de entrada do Atualizar Links);
- `reCase3e` (string do `new RegExp`).

O espelho `extract_logic.js` foi atualizado. Nenhuma fixture legada usava o formato invertido, então nenhum snapshot antigo mudou.

**Limite pré-existente mantido:** `h3.` antes do marker nunca foi suportado, nem na ordem normal. Há um teste de paridade para isso.

### 3. Desfazer gravação apagava changelog PRÉ-EXISTENTE

Quando o req já tinha `Demanda: #dId` (chJaTem), o Gravar corretamente **não** inseria o changelog de novo. Mas o compute devolvia `chLog:chLogLocal` mesmo assim, e o Desfazer fazia `indexOf(capturedChLog)` e removia a entrada que **já existia antes**.

O bug é pré-existente. Não aparecia porque o #31468 era tratado como "sem regras".

**Fix:** a variável `let chIns=!1;` fica num statement separado (fora da cadeia `const`, lição da v35.13). `chIns=!0` só é marcado no ramo que insere, e o retorno passa a ser `chLog:chIns?chLogLocal:""`. Com `""`, o rollback faz `indexOf("")=0` e remove nada.

### 4. "Maior RN" contava sub-numeração `RN94774-1` (#31468)

O req #31468 tem `h3. RN94774-1` e `h3. RN94774-2`. O regex `RN(\d+)\b` casava 94774, então a regra nova virava **RN94775** e era inserida **no meio do req**, entre RN94774-1 e -2, já que o ponto de inserção também vem da "maior RN".

**Fix:** `RN(\d+)\b(?!-\d)` nos 3 cálculos de maior RN (getEd, compute do Gravar, caso com regra-template). Agora sai **RN102**, logo após a RN101.

Não-regressão conferida nos reqs reais #60592, #79, #31059 e #32745: maior RN idêntica à da v35.13.6.

### 5. Botão "🔗 Adicionar relação" clicável mesmo com relação existente (pedido de UX)

Antes, o botão só descobria a relação existente depois do clique. Na v35.9 tinha sido decidido não checar a relação na renderização, por desempenho: `findRelation` leva de 1 a 3,5 s em reqs grandes.

**Fix:** helper `preCheckRel(btn, reqId)`, chamado **sem `await`**, roda em segundo plano e não atrasa a caixinha. Estados do botão:

| Situação | Botão |
|---|---|
| Durante a verificação | `⏳ Verificando relação...` (desabilitado) |
| Relação existe | `✓ Relação já existe` (cinza `#b0b0b0`, desabilitado, tooltip explicativo) |
| Relação não existe | `🔗 Adicionar relação` (azul, fluxo antigo intacto) |
| Verificação falha | volta ao azul clicável (seguro: `addRelation` é idempotente) |

Aplicado nos dois botões: `.btn-add-rel-cr` (card COM-REGRA chJaTem) e `.btn-add-rel` (card SEM-REGRA "Já registrado").

---

## 🧪 Testes

### Suítes novas

- **`test_v35_13_7_changelog_h2.js`** (106 testes), em 9 grupos:
  - A: estrutural;
  - B: `h1.` prioritário, não-regressão;
  - C: fallback `h2.`–`h6.`;
  - D: caso real #60592;
  - E: `getAllRules`;
  - F: `getEd` extraído do bookmarklet;
  - G: REGRAS/CONDIÇÕES;
  - H: desfazer;
  - I: maior RN.

  As funções são **extraídas do próprio `sisloc_master.js`**, não do espelho.
- **`test_v35_13_7_relacao_precheck.js`** (26 testes): bookmarklet inteiro em jsdom, em 4 situações (relação existe, não existe, verificação com HTTP 500, verificação lenta de 3 s com o resto da caixinha já usável).
- **`e2e_212039.js`**: sessão completa na #212039, com os textos reais dos requisitos, em dois cenários:
  - **A:** estado real de 12/11, com relações já existentes;
  - **B:** reqs "do zero".

  A rotina é Gravar/Registrar → Atualizar links em todos os cards, depois **Desfazer tudo**. A suíte confere que demanda e reqs voltam byte a byte ao original (com CRLF normalizado) e que as relações voltam ao estado inicial.
- **Validação do próprio teste:** rodado contra a v35.13.6 e contra as versões intermediárias, ele acusa cada bug na versão em que ele existia.

### Outros

- **Fixture nova** `tests/fixtures/212039.txt` + snapshot no `expected.json` (só inserção; os 22 snapshots antigos ficaram intactos).
- **Pasta nova `tests/fixtures_req/`**, só com descrições de REQUISITOS: 60592, 31468, 31059 e 79 vêm do Redmine real. O 32745 é uma **réplica estrutural** (mesmos cabeçalhos RN1–RN84, `{{collapse}}`, CHANGELOG dentro do collapse).
- **Fix de teste:** 3 asserts da `test_v35_13_5_save_errors.js` falhavam desde a v35.13.6, porque esperavam a mensagem exatamente `"HTTP 500"`, mas a v35.13.6 passou a anexar o botão de diagnóstico. Trocados por regex `^HTTP 500(<br>|$)`.
- **Infra de testes:**
  - `tests/run_all.js` roda tudo de uma vez;
  - `tests/package.json` traz o `jsdom` como devDependency, que já era exigido por `test_v35_9` e `test_v35_13_5` mas não estava documentado;
  - `tests/.gitignore` ignora o `node_modules/`.

### Resultado

**927 testes + 2 cenários e2e, tudo verde.**

**Não-regressão byte a byte:** nos reqs com `h1. CHANGELOG` + `CONDIÇÕES/REGRAS`, o texto gravado é idêntico ao da v35.13.6 no Gravar Regras (#32745, #79) e no Registrar Changelog (#31059).

---

## 📦 Arquivos

- `sisloc_master.js`: v35.13.7, 78.236 bytes, 1 linha (+779 em relação aos 77.457 da v35.13.6). **O manifest não muda** (não mexeu em `background.js`).
- `tests/extract_logic.js`, `tests/merge_logic.js`, `tests/expected.json`, `tests/test_v35_13_5_save_errors.js`: atualizados.
- `tests/test_v35_13_7_changelog_h2.js`, `tests/test_v35_13_7_relacao_precheck.js`, `tests/e2e_212039.js`, `tests/run_all.js`, `tests/package.json`, `tests/.gitignore`: novos.
- `tests/fixtures/212039.txt` e `tests/fixtures_req/` (5 txt + README): novos.
- `tests/README.md` e `tests/INDEX.md`: atualizados.
- `docs/sisloc_master_DOC_LITE.md`: atualizado.
- `docs/RESUMO_SESSAO_v35_13_7.md`: este arquivo.

---

## 🔎 Observações para o futuro (não corrigidas)

- **Posição da RN nova em reqs "migrados para o ReqSearch":** com `{{toc}}` / aviso de migração / `{{collapse}}` entre a última RN e o CHANGELOG (ex.: #60592), a RN nova vai para depois do `{{collapse}}`. É comportamento antigo. Está no backlog do DOC_LITE.
- **Lição do simulador:** o `<textarea>` normaliza CRLF para LF. Qualquer gravação pelo bookmarklet sai em LF, igual no Chrome real. Na comparação de "voltou ao original", normalize CRLF.

---

## 💡 Prompt base pro próximo chat

```
Estou continuando o desenvolvimento do bookmarklet "Sisloc Master".
Versão atual: v35.13.7 (testada no Chrome real; 927 testes + 2 e2e verdes).

A v35.13.7 (demanda #212039) fez 5 correções:
(1) findChM — aceita h2.–h6. CHANGELOG (h1. prioritário);
(2) marker invertido *REGRAS/CONDIÇÕES* reconhecido (parser + Atualizar Links);
(3) Desfazer gravação não apaga mais changelog pré-existente (chLog:"" quando não inseriu);
(4) maior RN ignora sub-numeração RN<n>-<d> (RN94774-1 → próxima é RN102, não RN94775);
(5) botão "Adicionar relação" verifica em segundo plano e fica
    "✓ Relação já existe" desabilitado quando a relação já existe.

Rodar testes: cd tests && npm install && node run_all.js
(e2e com o bookmarklet inteiro: node tests/e2e_212039.js A|B)

Regras do projeto: testar em Node primeiro, perguntar antes de aplicar,
manter bookmarklet em 1 linha, atualizar tests/extract_logic.js junto
se mexer em parsing, variável mutável nova = let separado (nunca dentro
de cadeia const minificada). Repo: Gabiel-hue/sisloc-master.

[continuar com a próxima dúvida/feature]
```
