# 🧪 Testes do Sisloc Master

Suite de testes offline pra validar mudanças no bookmarklet sem precisar abrir o Redmine.

## Como rodar

```bash
node tests/run_tests.js                     # roda fixtures + sintéticos
node tests/run_tests.js fixtures            # só demandas reais catalogadas
node tests/run_tests.js synthetic           # só cenários sintéticos
node tests/run_tests.js --update-snapshots  # regrava expected.json (use com cuidado)
```

Saída esperada:
```
━━━ FIXTURES (demandas reais catalogadas) ━━━
✅ 148935
✅ 171042
✅ 175029
...

━━━ CENÁRIOS SINTÉTICOS ━━━
✅ sintetico/dois_h3_hash
✅ sintetico/hash_sem_h3_171042
...

Passou: 20   Falhou: 0
```

Pré-requisito: Node.js 16+ (testado em 22). Zero dependências externas — só stdlib.

## Estrutura

```
tests/
├── README.md            ← este arquivo
├── INDEX.md             ← catálogo das fixtures (o que cada uma testa)
├── extract_logic.js     ← espelho LIMPO das funções de parsing do bookmarklet
├── run_tests.js         ← orquestrador
├── expected.json        ← snapshot do output esperado por fixture
└── fixtures/
    ├── 148935.txt       ← textile cru de cada demanda real catalogada
    ├── 171042.txt
    └── ...
```

## Fluxo de trabalho

### 1. Quando você descobre um bug numa demanda nova

a. Adiciona a fixture: `tests/fixtures/NNNN.txt` com o textile cru
b. Roda os testes: `node tests/run_tests.js`
c. O teste vai falhar (output atual ≠ output desejado) OU vai passar com output errado
d. Trabalha no fix no `sisloc_master.js` (raiz do repo)
e. Atualiza `extract_logic.js` espelhando a mudança
f. Roda de novo até passar
g. Quando tudo passa E o output em `expected.json` reflete a correção: commit

### 2. Quando você melhora algo intencionalmente

a. Faz a mudança no `sisloc_master.js`
b. Atualiza `extract_logic.js`
c. Roda `node tests/run_tests.js`
d. Se algumas fixtures falharem (output mudou pra melhor): `node tests/run_tests.js --update-snapshots`
e. Revisa o diff do `expected.json` (`git diff expected.json`) pra confirmar que as mudanças são intencionais
f. Commit

### 3. Quando o Claude vai trabalhar numa próxima sessão

O Claude vai:
1. Puxar o `sisloc_master.js` atual do repo (1 `web_fetch`)
2. Puxar o `extract_logic.js` + `run_tests.js` + as fixtures relevantes do repo
3. Rodar tudo localmente no container — **zero token de Chrome**
4. Só usar o Chrome no FIM pra spot-check no caso reportado de verdade

Economia estimada: ~80% dos tokens de Chrome MCP por sessão.

## Mantendo o espelho sincronizado

⚠️ O arquivo `extract_logic.js` é um espelho **manual** das funções de parsing do `sisloc_master.js` (raiz do repo). Sempre que mudar a lógica no bookmarklet, atualize aqui também.

Funções espelhadas:
- `extractRules(sec)`
- `splitSections(ds)`
- `getReqIdFromSection(sec)`
- `getReqSectionBounds(ds, reqId)`
- `buildPlaceholderMap(ds)`

Versão atual espelhada: **v35.6.5**

## Adicionando uma fixture nova (passo a passo)

```bash
# 1. Abre a demanda no Redmine /edit, F12 (console), e roda:
#    copy(document.querySelector('#issue_description').value)
# 2. Cria o arquivo da fixture
echo "(cole aqui)" > tests/fixtures/12345.txt

# 3. Atualiza o snapshot
node tests/run_tests.js --update-snapshots

# 4. Confere o diff
git diff tests/expected.json

# 5. Adiciona uma linha no INDEX.md descrevendo o que ela cobre

# 6. Commit
git add tests/fixtures/12345.txt tests/expected.json tests/INDEX.md
git commit -m "test: fixture #12345 (descrição do que cobre)"
```
