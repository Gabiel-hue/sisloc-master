# 📋 Setup inicial — passo a passo

Este arquivo te guia desde "tenho conta GitHub criada" até "extensão funcionando e auto-atualizando".

> ✅ **Já configurado para o usuário `Gabiel-hue`.** As URLs nos arquivos já apontam pro repositório `https://github.com/Gabiel-hue/sisloc-master`.

---

## 🪜 Passo 1 — Criar o repositório no GitHub

1. Logado na sua conta `Gabiel-hue`, clique no **+** no canto superior direito → **New repository**
2. Preencha:
   - **Owner:** Gabiel-hue (selecionado por padrão)
   - **Repository name:** `sisloc-master` (exatamente assim, com hífen, tudo minúsculo)
   - **Description:** "Bookmarklet + extensão Chrome pra automatizar análise de demandas no Redmine"
   - **Public** ✅
   - ❌ NÃO marca "Add a README file" (vamos subir os nossos)
   - ❌ NÃO adiciona .gitignore nem licença
3. Clique em **Create repository**

Vai abrir uma página com instruções. **Não feche essa aba** — vai precisar dela no Passo 2.

> ⚠️ **Importante:** o nome do repositório precisa ser **exatamente `sisloc-master`**. Se você criar com outro nome (ex: `Sisloc-Master`, `sisloc_master`), os arquivos da extensão não vão achar o GitHub. Se errar, dá pra renomear depois em Settings → General → Repository name.

---

## 🪜 Passo 2 — Subir os arquivos pro GitHub

### Jeito A — Via interface web (sem instalar Git, recomendado)
1. Na página do repo recém-criado, clique no link **uploading an existing file** (perto do topo)
2. **Arraste TODOS os arquivos e pastas** desta pasta (`sisloc-master/`) pra área de upload
   - ⚠️ Mantém a estrutura de pastas: precisa ter `extension/` e `docs/` como subpastas
   - ⚠️ NÃO arraste a pasta `sisloc-master` em si — arrasta o **conteúdo** dela
3. Lá embaixo, em **Commit changes**, escreve "Setup inicial do Sisloc Master v35.6"
4. Clica **Commit changes** (botão verde)

Vai demorar 30s-2min pra fazer upload de tudo.

### Jeito B — Via Git (se já souber usar)
```bash
cd sisloc-master/
git init
git add .
git commit -m "Setup inicial do Sisloc Master v35.6"
git branch -M main
git remote add origin https://github.com/Gabiel-hue/sisloc-master.git
git push -u origin main
```

---

## 🪜 Passo 3 — Verificar que o GitHub raw funciona

Abre este link no navegador:

```
https://raw.githubusercontent.com/Gabiel-hue/sisloc-master/main/sisloc_master.js
```

Você deve ver o código do bookmarklet (começa com `javascript:(function(){`).

**Se aparecer "404 Not Found":**
- Confere o nome do repositório (precisa ser **exatamente** `sisloc-master`)
- Confere se a branch é `main` (não `master`) — o GitHub usa `main` por padrão agora, mas confere
- Confere se o arquivo `sisloc_master.js` está na **raiz** do repo (não dentro de alguma subpasta)

Se aparecer outra coisa estranha, me chama que a gente investiga.

---

## 🪜 Passo 4 — Instalar a extensão no Chrome

1. Abre `chrome://extensions/`
2. Liga **Modo do desenvolvedor** (toggle no canto superior direito)
3. Clica **Carregar sem compactação**
4. Seleciona a pasta `extension/` (a que tem o `manifest.json` dentro)
   - ⚠️ É a subpasta `extension/`, NÃO a pasta raiz `sisloc-master/`
5. Aparece o ícone azul "S" — clica no 🧩 quebra-cabeças e alfineta na barra

---

## 🪜 Passo 5 — Testar!

1. Abre uma demanda: `http://net1/redmine/issues/175544` (ou qualquer outra)
2. Clica no ícone "S"
3. **Esperado:**
   - ✅ Painel do Sisloc Master abre no canto direito (igual o bookmarklet)
   - ✅ Aparece um badge **verde** com "35.6" no canto do ícone por 3 segundos
4. Faz uma operação qualquer (gravar ou atualizar links) pra ter certeza que funciona idêntico ao bookmarklet

---

## 🎉 Pronto — fluxo de manutenção daqui pra frente

Quando quiser fazer uma atualização (v35.7, v35.8, etc.):

### Caminho 1 — Edita direto no GitHub (rápido pra ajustes pequenos)
1. Abre `https://github.com/Gabiel-hue/sisloc-master/blob/main/sisloc_master.js`
2. Clica no ícone de **lápis** (canto superior direito do arquivo)
3. Cola a nova versão
4. Scroll até o fim → **Commit changes**

### Caminho 2 — Edita localmente e dá push (pra mudanças maiores)
1. Edita o arquivo no seu PC
2. `git commit -am "v35.7 — descrição"` + `git push`

Em ambos os casos, **todos os analistas com a extensão instalada recebem a atualização automaticamente no próximo clique** no ícone.

**Não precisa reinstalar nada nunca mais** — exceto se mudar o `background.js`, `manifest.json` ou ícones (raros).

---

## 🆘 Se algo der errado

### A extensão mostra badge laranja em vez de verde
- Significa "modo offline" — usou cache em vez do GitHub
- Confere se a URL do GitHub raw abre no navegador
- Pode ser firewall corporativo bloqueando `raw.githubusercontent.com` (ver com TI)

### A extensão mostra badge "X" vermelho
- Falha total: sem GitHub e sem cache (primeira execução offline)
- Conecte na internet pelo menos uma vez pra popular o cache

### Não tenho certeza se atualizou
- Cada vez que aparece um badge **verde** com o número da versão, significa que baixou do GitHub
- Confere a versão exibida vs a que tá no GitHub

### Service worker tá com erro
- `chrome://extensions/` → encontrar Sisloc Master → clicar em **service worker** (link em azul)
- Procurar mensagens com prefixo `[Sisloc Master]` no Console
- Erros comuns: domínio bloqueado, repositório errado, branch errada

### Quero distribuir pra outros analistas
- Cada um precisa baixar/clonar o repositório e instalar a extensão (Passo 4)
- Depois disso, recebem atualizações automaticamente sem precisar fazer mais nada
- Eles **não** precisam ter conta GitHub (o repo é público)
