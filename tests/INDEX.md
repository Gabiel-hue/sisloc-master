# 📋 Catálogo de Fixtures

Cada arquivo `.txt` em `fixtures/` é o conteúdo bruto (textile) da descrição de uma demanda real do Redmine. O nome do arquivo é o ID da demanda. São snapshots imutáveis: nunca edite o conteúdo, só adicione novos.

## Fixtures atuais

| Demanda | Tipo | O que testa | Versão que corrigiu |
|---|---|---|---|
| 148935 | Planejamento | Formato 21 — regra inline `*Regras:* "RN12 - X":URL` + cascata "Atualizar Links" com case 3e | v35.6.2 / v35.6.3 / v35.6.4 |
| 171042 | Construção | Cabeçalho `#N - Título` SEM `h3.` — caso novo descoberto | **v35.6.5** |
| 175029 | Construção | IDs provisórios com zeros à esquerda (`#0001`, `#0002`) + `buildSummary` + `buildProvisionalCard` | v35.5.4 |
| 175544 | Construção | `h3. ##N` sem palavra "Requisito" + título DEPOIS do link `"RN1":URL - Título` | v35.5.8 / v35.5.9 |
| 196911 | Construção | Superscript Unicode (`RNx² → RNx2`) + RN minúsculo (`RNx`, `RNy`) | v35.5.6 |
| 207663 | Pequenas Melhorias | Negrito aberto sem fechamento `*RNX1 - Processo` (sem `*` no fim) | v35.5.5 |
| 207979 | Pequenas Melhorias | Espaços/tabs antes do `\n` no negrito `*RNX1 Notas...*  ` | v35.5.4 |
| 208519 | Pequenas Melhorias | Negrito de linha inteira sem hífen `*RNX1 - Filtro por "Empresa"*` | v35.5.2 |
| 208937 | Pequenas Melhorias | Botão "Atualizar Links" com asteriscos (`*RN5 - Título*`, `*RN5* - Título`) — 4 cases | v35.6.1 |

## Como adicionar uma fixture nova

1. Abre a demanda no `/edit` no Redmine
2. Copia o conteúdo da textarea de descrição (Ctrl+A, Ctrl+C)
3. Cria `tests/fixtures/NNNN.txt` com o conteúdo colado
4. Roda `node tests/run_tests.js --update-snapshots` pra gravar o output atual como esperado
5. Inspeciona o `expected.json` modificado pra confirmar que o output está correto
6. Adiciona uma linha aqui no INDEX.md descrevendo o que ela cobre
7. Commit no repo

## Princípios

- **Imutabilidade**: fixtures nunca mudam. Se a demanda real for editada no Redmine, isso não afeta o snapshot.
- **Cobertura por versão**: cada fixture deve testar um cenário que motivou um fix de versão específica. Manter mapeamento na tabela acima.
- **Sem PII**: se a descrição contiver dados sensíveis (nomes, CPF, CNPJ reais), anonimizar antes de commitar.
