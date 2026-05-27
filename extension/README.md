# 🧩 Sisloc Master — Extensão do Chrome

Esta extensão é um **carregador**: ela não tem o código do Sisloc Master embutido. A cada clique no ícone, ela busca o arquivo `sisloc_master.js` mais recente do GitHub e injeta na página.

Resultado: **você atualiza o repositório, todos os analistas recebem instantaneamente**, sem reinstalar.

---

## 📦 O que tem aqui

```
extension/
├── manifest.json     ← declara a extensão (Manifest V3)
├── background.js     ← service worker: fetch GitHub + injeta na aba
├── icons/            ← ícones 16/32/48/128
└── README.md         ← este arquivo
```

**Nenhum arquivo aqui tem código de regra de negócio.** Toda a lógica está em `../sisloc_master.js` (ou no GitHub raw).

---

## 🛠️ Como instalar (1ª vez)

1. **Baixe esta pasta** (`extension/`) pro seu HD:
   - Opção 1: `git clone https://github.com/Gabiel-hue/sisloc-master.git`
   - Opção 2: Botão verde **Code** → **Download ZIP** no GitHub, depois extrair

2. **Abra `chrome://extensions/`** no Chrome

3. **Ligue o "Modo do desenvolvedor"** (toggle no canto superior direito)

4. **Clique em "Carregar sem compactação"** → selecione a pasta `extension/`
   - ⚠️ É a pasta `extension/`, não a pasta raiz do repositório
   - ⚠️ A pasta precisa ter o `manifest.json` dentro

5. **Alfinete o ícone** na barra do Chrome (clique no 🧩 quebra-cabeças → ícone de alfinete ao lado do "Sisloc Master")

Pronto. Não precisa configurar mais nada.

---

## ▶️ Como usar

1. Abra uma demanda do Redmine: `http://net1/redmine/issues/XXXXXX`
2. Clique no ícone azul "S" na barra do Chrome
3. O painel do Sisloc Master abre — **idêntico ao bookmarklet**

### Significado dos badges no ícone

| Badge | Cor | Significado |
|---|---|---|
| `35.6` (ou versão atual) | 🟢 verde | Baixou do GitHub com sucesso (modo online) |
| `35.6` (ou versão atual) | 🟠 laranja | GitHub indisponível, usou cópia do cache local |
| `!` | 🔴 vermelho | Você clicou fora de uma página `/issues/N` |
| `X` | 🔴 vermelho | Falha total: sem GitHub e sem cache. Vai aparecer um alerta explicando |

O badge some sozinho em 3 segundos.

---

## 🔄 Atualização automática (a mágica)

Não tem botão "verificar atualização" nem nada. Funciona assim:

1. Você desenvolve uma nova versão do bookmarklet
2. Faz commit + push pro GitHub
3. Próxima vez que **qualquer analista** clicar no ícone, ele recebe a versão nova

Se o GitHub estiver fora do ar (ou sem internet), a extensão usa a última versão que conseguiu baixar (cache local) — então mesmo offline, ela funciona com a versão mais recente que você já viu rodar.

---

## 🔒 Permissões

A extensão pede:
- `http://net1/*` — pra rodar nas páginas do Redmine corporativo
- `https://raw.githubusercontent.com/*` — pra baixar o bookmarklet atualizado
- `scripting` + `activeTab` — pra injetar o código na aba ativa
- `storage` — pra guardar o cache offline

**Não tem permissão pra ler outras abas, histórico, cookies, nada disso.**

---

## 🐛 Troubleshooting

### "Aparece um alerta dizendo que não conseguiu baixar"
- Sem internet? Tente abrir [`https://raw.githubusercontent.com/Gabiel-hue/sisloc-master/main/sisloc_master.js`](https://raw.githubusercontent.com/Gabiel-hue/sisloc-master/main/sisloc_master.js) no navegador — se carregar, é problema na extensão; se não carregar, é problema de rede/proxy
- Primeira vez que usa? Não tem cache ainda. Conecte na internet pelo menos uma vez

### "Clico no ícone e não acontece nada"
- Conferir se está numa URL `/issues/N` válida
- Abrir o Console do service worker pra ver erros:
  - `chrome://extensions/` → encontrar Sisloc Master → clicar em **service worker** (link em azul)
  - Procurar mensagens com prefixo `[Sisloc Master]`

### "Quero forçar a buscar versão nova agora (não usar cache)"
- A extensão sempre tenta o GitHub primeiro. Cache só é usado se GitHub falhar.
- Se quer ter certeza, abre `chrome://extensions/` → Sisloc Master → **service worker** → no Console digita:
  ```js
  chrome.storage.local.clear()
  ```

### "Quero saber a versão atual em cache"
- `chrome://extensions/` → service worker → Console:
  ```js
  chrome.storage.local.get(null, console.log)
  ```

---

## 📌 Versão da extensão

A extensão em si é **versão 35.6**, mas isso é só o número do manifest. O que importa é a versão do `sisloc_master.js` que ela baixa — essa sempre será a mais recente do GitHub.

Você só precisa atualizar o `manifest.json` (e reinstalar) se mudarmos:
- O endereço do GitHub
- Permissões da extensão
- Funcionalidade do `background.js`

Atualizações do **bookmarklet em si** não precisam de reinstalação.
