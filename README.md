# 🚀 Sisloc Master

Bookmarklet + Extensão do Chrome pra automatizar análise de demandas e gravação de regras de negócio no Redmine corporativo.

**Versão atual:** v35.6

---

## 🎯 O que é

Ferramenta interna pra analistas: lê demandas do Redmine, extrai regras de negócio (RN1, RN2…) do detalhamento, e grava nos requisitos correspondentes — com rollback, atualização de links bidirecional, e tudo mais.

Funciona em duas formas:

### 📌 Como bookmarklet
1. Abra [`instalar.html`](./instalar.html) no Chrome (ou direto: [link via GitHub Pages](#) se ativado)
2. Arraste o botão azul pra barra de favoritos
3. Em qualquer demanda do Redmine, clique no favorito

### 🧩 Como extensão do Chrome (auto-update via GitHub)
1. Baixe a pasta [`extension/`](./extension/) deste repo (clone ou Download ZIP)
2. Abra `chrome://extensions/` → ative **Modo do desenvolvedor**
3. Clique em **Carregar sem compactação** → selecione a pasta `extension/`
4. Pronto. A extensão **sempre roda a versão mais recente** deste repositório a cada clique no ícone — sem reinstalar.

Detalhes no [`extension/README.md`](./extension/README.md).

---

## 📁 Estrutura do repositório

```
sisloc-master/
├── sisloc_master.js              ← Bookmarklet (1 linha) — fonte da verdade
├── instalar.html                 ← Página HTML pra instalar o bookmarklet
├── extension/                    ← Extensão Chrome (busca o .js daqui)
│   ├── manifest.json
│   ├── background.js
│   ├── icons/
│   └── README.md
├── docs/
│   ├── DOC_LITE.md               ← Arquitetura + formatos suportados + backlog
│   └── RESUMO_SESSAO_v35_6.md    ← Histórico das mudanças da última sessão
└── README.md                     ← Este arquivo
```

---

## 🔄 Fluxo de desenvolvimento

1. Desenvolve mudanças no bookmarklet (`sisloc_master.js`) normalmente
2. Testa via favorito (mais rápido, sem build)
3. Quando aprovado: `git commit` + `git push`
4. **Todos os analistas com a extensão instalada recebem automaticamente** ao próximo clique no ícone

> A extensão não tem código duplicado do bookmarklet — ela baixa o `sisloc_master.js` deste repositório a cada execução e o injeta. Zero deriva entre os dois.

---

## 🐛 Issues e backlog

Veja [`docs/DOC_LITE.md`](./docs/DOC_LITE.md) → seção "Backlog / Próximos passos".

---

## 📝 Changelog

Veja [`docs/DOC_LITE.md`](./docs/DOC_LITE.md) → seção "Changelog resumido".
