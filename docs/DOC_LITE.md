# 🚀 Sisloc Master — Doc Lite (atualizado pós-v35.6)

> **Versão atual:** v35.6 | Bookmarklet JS para Redmine corporativo (rede `net1`, via VPN)

---

## 🎯 Prompt base (cola na primeira mensagem do próximo chat)

```
Estou continuando o desenvolvimento do bookmarklet "Sisloc Master".
Versão atual: v35.6 (já testada e funcional).

O QUE É:
- Bookmarklet (javascript:...) em UMA LINHA SÓ
- Roda no Chrome do analista usando a SESSÃO LOGADA dele no Redmine
- Lê demandas, extrai regras de negócio, e grava nos requisitos correspondentes
- Tem rollback do Gravar e Atualizar Links (v35.6)

CONTEXTO TÉCNICO:
- fetch + DOMParser em /issues/N/edit para ler descrições
- POST com FormData para salvar (utf8, _method=patch, authenticity_token, issue[description])
- NÃO inclui issue[notes] — gravação limpa, sem nota no histórico
- Tenho acesso ao Chrome do usuário via "Claude in Chrome" para CONSULTAR
  (não para editar) demandas/requisitos em tempo real

REGRAS DE COLABORAÇÃO:
1. Antes de mexer no script: TESTAR a lógica em Node primeiro
2. Mostrar resultado do teste
3. PERGUNTAR antes de aplicar (NUNCA pular essa etapa, mesmo quando a análise já deixou claro o que vai mudar)
4. Mudanças visuais: PREVIEW visual antes
5. Versionamento: vX.Y.Z (fix/melhoria pequena), vX.Y (feature média), vX+1.0 (feature grande)
6. Validar sintaxe ao final (node --check)
7. Manter bookmarklet em UMA LINHA
8. CUIDADO: o arquivo de "fonte legível" e o BOOKMARKLET (uma linha) podem
   estar dessincronizados — sempre usar como BASE o conteúdo do bookmarklet
   instalado (que é o que o usuário realmente roda). Pedir esse conteúdo no
   início se houver dúvida.
9. FRASE-CHAVE: quando o usuário mandar "me mande os 4 atualizados", gerar
   o pacote: bookmarklet .js + instalar .html + DOC_LITE.md + RESUMO_SESSAO.md

ARQUIVOS DA SESSÃO ANTERIOR (em anexo):
- sisloc_master_DOC_LITE.md — este documento
- sisloc_master_v35_6.js — bookmarklet atual (1 linha)
- instalar_v35_6.html — página HTML pra arrastar e instalar
- RESUMO_SESSAO_v35_6.md — o que foi feito na última sessão

Veja o anexo "Sisloc Master Doc Lite" para arquitetura e formatos.
```

---

## 📐 Arquitetura (resumo)

```
javascript:(function(){
  // SETUP: dId, bUrl, dTitle (da página atual)
  // UI: caixinha lateral com header, status, lista de cards

  // FUNÇÕES principais:
  getEd(id)               // busca /edit, retorna {tk, ds, n, ip, chI, subj}
  saveIssue(id, nc, tk)   // POST com description nova
  extractRules(sec)       // parsing de regras de uma seção
                          //   v35.5.9: linkPostMatch — detecta "RN1":URL - Título (título DEPOIS do link)
                          //   v35.5.6: normaliza superscripts + flag /i no split
                          //   v35.5.5: aceita negrito *RN... aberto sem fechamento na linha
                          //   v35.5.4: aceita espaços/tabs antes do \n em *RN... *
                          //   v35.5.2: aceita *RN... título inteiro* e normaliza separador
                          //   v35.5.1: aceita aspas curvas " e "
  buildPlaceholderMap(ds) // mapa {id: título} dos requisitos da listagem da demanda
  getExistingRules(reqDs) // RNs já no requisito (para detectar duplicatas)
  checkDup(title, ex)     // 95%+ = exata (vermelho), 60%+ = parcial (amarelo)
  isTemplateRule(content) // RN template (conteúdo entre <...>)
  cleanTemplateRules(ds)  // remove templates antes de gravar
  isProvisionalId(id)     // detecta #99999 e #0001/#0002 (zeros à esquerda)
  buildProvisionalCard(r) // card pra requisitos não criados ainda
  buildSummary(all,with)  // caixinha de resumo expansível
  titleToAnchor(title)    // gera âncora (fallback)
  getAnchorForRule(rId,t) // fetch /issues/N e busca âncora real
  getReqSectionBounds()   // limites da seção do requisito na demanda
                          //   v35.5.8: aceita h3. ##N (sem palavra "Requisito") no início e no nextM
  resolveId(title, map)   // resolve #99999 pelo título

  // FLUXO:
  // 1. Lê demanda → placeholderMap (camada 1 do nome do requisito)
  // 2. Recorta por "h1. Detalhamento de Projeto" se existir (v35.5)
  // 3. Split por requisitos (aceita "Requisito", "Requisito Funcional" e "h3. ##N" desde v35.5.8)
  // 4. Para cada section: extractRules, marca provisional, conta ocorrências
  //    Camada 2 do nome: extrai do cabeçalho "Requisito #N - Nome" se existir
  // 5. Mostra resumo + cards
  // 6. Para cada card real: lê /edit do requisito (getEd) → subj é fallback (camada 3)
  // 7. Botão "Gravar": saveIssue no requisito (insere RN + atualiza Changelog)
  //                    Após sucesso → vira "↩ Desfazer gravação" laranja (v35.6)
  // 8. Botão "Atualizar links": 3 casos (atualizar/já-OK/criar)
  //                              Após sucesso → vira "↩ Desfazer atualização de links" laranja (v35.6)

  // ROLLBACK (v35.6):
  // - Gravar: closure captura rTxt e chLog → ao confirmar, fetch + remove via indexOf/slice
  // - Links: closure captura [{antes, depois}] → ao confirmar, fetch + replace reverso
  // - Confirmação inline (amarelo) com Sim/Cancelar
  // - Erro detectado quando edição alheia toca a parte alterada
  // - Após sucesso: botões voltam ao estado original (permite re-tentar)
});
```

---

## 📋 Formatos suportados (atualizado pós-v35.6)

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
| 18 | `h3. ##N` sem "Requisito" | `h3. ##31323` (sem palavra Requisito antes) | **v35.5.8** |
| 19 | Título DEPOIS do link | `(Criar) "RN1":URL - Compra de equipamento` | **v35.5.9** |

**Cabeçalho de requisito aceito:** `REQUISITO #N`, `h3. Requisito: #N`, `h3. Requisito Funcional #N`, `h3. ##N` (v35.5.8), `##N`, `# N`, sem `#`.

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
10. **`getReqSectionBounds` prioriza `h3. Requisito #N` e `h3. ##N`** (v35.5.8)
11. **`getReqSectionBounds` retorna SÓ a primeira aparição** — limitação conhecida (v35.6 merge backlog)
12. **Placeholders RNx/RNy/RNx²** são renomeados ao gravar pro próximo `RNN` real do requisito
13. **Rollback (v35.6):** vive em closure JS, expira ao fechar a página. Captura cirurgicamente o que foi modificado.

---

## 🐛 Backlog / Próximos passos

### 🟡 Merge real de requisitos duplicados (DESCARTADA pelo usuário na sessão da v35.5.x, mantida como referência)

Plano: detectar `#N` repetido 2× no detalhamento, mergear em um card só, atualizar links em todos os blocos. Mexe em `getReqSectionBounds`. Não é prioridade.

### 🔴 v35.7+ (futuro) — Tratar (Criar) vs (Alterar) vs (Validar) separadamente

Hoje os três prefixos são tratados igual a `(Criar)`. Decisão do usuário: "depois a gente vê como faz".

### 🟡 Limpeza de `* ` órfão no content (Opção 2b da sessão da v35.5.5)

A v35.5.5 deixa o `* ` órfão no content de regras tipo `*RN... \n* texto...` (#102418). Usuário escolheu Opção 1 (não limpa). Se incomodar, trocar pra Opção 2b: limpar só quando é asterisco único (sem outros bullets na sequência).

### 🟡 Bug pré-existente — `getReqSectionBounds` com `h3. Requisito Funcional #N`

O `reDetalhe` da função `getReqSectionBounds` não permite a palavra "Funcional" entre "Requisito" e o número. Cai no fallback `reAny` que é genérico e pode casar com a listagem do topo em vez do detalhamento. Fix futuro de 2 linhas (trocar `Requisito\s*:?` por `Requisito(?:\s+Funcional)?\s*:?` em ambos os regex). Aguardando demanda real pra testar.

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
- **v35.5.8** — **aceita `h3. ##N` sem palavra "Requisito"** (corrige #175544)
- **v35.5.9** — **detecta título DEPOIS do link `"RN1":URL - Título`** (corrige #175544)
- **v35.6** — 🎉 **Rollback do Gravar e Atualizar Links** com confirmação inline
- **v35.7+** *(backlog)* — `(Criar)` / `(Alterar)` / `(Validar)` separados
- **Backlog** — merge de requisitos duplicados (descartada) + fix `Requisito Funcional` em `getReqSectionBounds`

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

---

## 💬 Texto descontraído no rodapé (desde v35.5.7)

A cada execução do bookmarklet, sorteia uma das 4 frases pra exibir abaixo do "✨ Pronta!":

1. "O estagiário que grava RNs sem reclamar"
2. "Analista virtual, sem horário de almoço"
3. "Faz hora extra de graça, e ainda agradece"
4. "Não pede aumento, não tira férias, não fica doente"

Fonte 10px, cor #888, itálico. Pra adicionar/remover frases é só editar o array no bookmarklet.

---

## ↩ Rollback (v35.6)

### Como funciona

**Botão Gravar:**
- Antes: `🚀 Gravar Regras + Changelog` (azul)
- Após sucesso: vira `↩ Desfazer gravação` (laranja `#e6a817`)
- Clique → confirmação inline amarela com Sim/Cancelar
- Sim → fetch novo do requisito + remove `rTxt` e `chLog` via `indexOf` + `slice` → save
- Após rollback OK: botão volta a `🚀 Gravar Regras + Changelog`, e `btnLinks` volta travado

**Botão Atualizar Links:**
- Antes: `🔗 Atualizar links na demanda` (roxo após gravar)
- Após sucesso: vira `↩ Desfazer atualização de links` (laranja)
- Clique → confirmação inline amarela
- Sim → fetch novo da demanda + para cada `change` em ordem reversa, `replace(c.depois, c.antes)` → save
- Após rollback OK: botão volta a `🔗 Atualizar links na demanda`

### Estado capturado em closure (sessão JS)

```js
// Gravar:
capturedRTxt = '\n\n' + rTxt.trim() + '\n\n';
capturedChLog = '\n\nDemanda: #' + dId + '\n' + dTitle + '\n';

// Atualizar Links:
linkChanges = [
  { antes: '"RN1 - X":URL_old', depois: '"RN5 - X":URL_new' }, // caso 1
  { antes: 'RN2 - Y',           depois: '"RN6 - Y":URL_new' }, // caso 3
];
```

### Tratamento de erros

- Se a string `depois` (ou `capturedRTxt`) não for encontrada na nova descrição (alguém editou entre tempo): erro vermelho explicando "uma das linhas alteradas não foi encontrada (provável edição manual entre o atualizar e o desfazer)"
- O `csrf_token` é refetched a cada rollback (não usa o velho)

### Limitações

- Rollback **expira ao fechar/recarregar** a página (vive em closure JS, sem persistência)
- Rollback de Links só desfaz o que o sisloc modificou — se edição alheia for em outra parte da linha (ex: título depois do URL), a edição alheia é preservada
- Template cleanup ao gravar NÃO é restaurado no rollback (template era placeholder mesmo)
