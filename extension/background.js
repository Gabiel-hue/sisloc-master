/*
 * Sisloc Master — background service worker (auto-update via GitHub)
 *
 * Ao clicar no ícone:
 *   1. Verifica se a aba é uma demanda do Redmine (/issues/N)
 *   2. Faz fetch do bookmarklet mais recente no GitHub raw
 *   3. Extrai o corpo do IIFE (entre javascript:(function(){ ... })();)
 *   4. Injeta na aba via chrome.scripting.executeScript
 *   5. Em caso de falha de rede: usa a última versão cacheada no chrome.storage
 *
 * O .js no GitHub é a MESMA fonte que serve o bookmarklet — assim a extensão
 * sempre roda a versão idêntica à do favorito (zero deriva entre os dois).
 */

// ============================================================================
// CONFIGURAÇÃO — ajustar se o repositório mudar
// ============================================================================
const GITHUB_RAW_URL =
  "https://raw.githubusercontent.com/Gabiel-hue/sisloc-master/main/sisloc_master.js";

const REDMINE_URL_PATTERN = /^http:\/\/net1\/redmine\/issues\/\d+/;

// Chaves no chrome.storage.local
const CACHE_KEY = "sisloc_cached_body";
const CACHE_VERSION_KEY = "sisloc_cached_version";
const CACHE_TIMESTAMP_KEY = "sisloc_cached_at";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Extrai o corpo do IIFE de um bookmarklet.
 * Entrada:  "javascript:(function(){ ...código... })();"
 * Saída:    "...código..."
 */
function extractBookmarkletBody(text) {
  const trimmed = text.trim();
  const PREFIX = "javascript:(function(){";
  const SUFFIX = "})();";
  if (!trimmed.startsWith(PREFIX) || !trimmed.endsWith(SUFFIX)) {
    throw new Error(
      "Formato inesperado do bookmarklet (precisa começar com 'javascript:(function(){' e terminar com '})();')"
    );
  }
  return trimmed.slice(PREFIX.length, trimmed.length - SUFFIX.length);
}

/**
 * Tenta extrair o número da versão do bookmarklet (pra exibir no badge).
 * Procura por "v35.6" ou similar dentro do código.
 */
function extractVersion(body) {
  const m = body.match(/v\d+\.\d+(?:\.\d+)?/);
  return m ? m[0] : "?";
}

/**
 * Mostra um badge temporário no ícone (3s).
 */
function flashBadge(tabId, text, color) {
  chrome.action.setBadgeText({ text, tabId });
  chrome.action.setBadgeBackgroundColor({ color, tabId });
  setTimeout(() => {
    chrome.action.setBadgeText({ text: "", tabId });
  }, 3000);
}

/**
 * Busca o bookmarklet no GitHub e extrai o corpo.
 * Retorna { body, version, source } ou lança erro.
 */
async function fetchFromGitHub() {
  // Cache-buster pra evitar cache do navegador/CDN
  const url = GITHUB_RAW_URL + "?t=" + Date.now();
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("HTTP " + res.status + " ao buscar no GitHub");
  }
  const text = await res.text();
  const body = extractBookmarkletBody(text);
  const version = extractVersion(body);
  return { body, version, source: "github" };
}

/**
 * Tenta o cache local. Retorna { body, version, source: 'cache' } ou null.
 */
async function loadFromCache() {
  const data = await chrome.storage.local.get([
    CACHE_KEY,
    CACHE_VERSION_KEY,
    CACHE_TIMESTAMP_KEY,
  ]);
  if (!data[CACHE_KEY]) return null;
  return {
    body: data[CACHE_KEY],
    version: data[CACHE_VERSION_KEY] || "?",
    source: "cache",
    cachedAt: data[CACHE_TIMESTAMP_KEY] || null,
  };
}

/**
 * Salva no cache local.
 */
async function saveToCache(body, version) {
  await chrome.storage.local.set({
    [CACHE_KEY]: body,
    [CACHE_VERSION_KEY]: version,
    [CACHE_TIMESTAMP_KEY]: Date.now(),
  });
}

/**
 * Injeta o corpo do bookmarklet na aba como uma IIFE.
 * Usa a forma `func` + `args` do executeScript: o `body` viaja como string
 * e é executado via new Function() dentro do MAIN world (mesmo contexto da página).
 */
async function injectIntoTab(tabId, body) {
  await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: (code) => {
      // Executa o código no escopo isolado de uma função (igual o bookmarklet)
      try {
        new Function(code)();
      } catch (e) {
        console.error("[Sisloc Master] Erro ao executar:", e);
        alert("[Sisloc Master] Erro ao executar o script: " + e.message);
      }
    },
    args: [body],
  });
}

// ============================================================================
// Fluxo principal
// ============================================================================

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id || !tab.url) return;

  // 1. Valida que é uma página de demanda do Redmine
  if (!REDMINE_URL_PATTERN.test(tab.url)) {
    flashBadge(tab.id, "!", "#dc3545");
    return;
  }

  // 2. Tenta baixar do GitHub; se falhar, tenta cache
  let payload = null;
  let fetchError = null;

  try {
    payload = await fetchFromGitHub();
    // Sucesso: atualiza o cache
    await saveToCache(payload.body, payload.version);
  } catch (err) {
    fetchError = err;
    console.warn(
      "[Sisloc Master] Falha ao buscar no GitHub, tentando cache local:",
      err.message
    );
    payload = await loadFromCache();
  }

  // 3. Se nem GitHub nem cache funcionou, erro
  if (!payload) {
    flashBadge(tab.id, "X", "#dc3545");
    chrome.scripting
      .executeScript({
        target: { tabId: tab.id },
        func: (msg) => alert("[Sisloc Master] " + msg),
        args: [
          "Não foi possível baixar o script do GitHub e não há cópia em cache.\n\nDetalhe: " +
            (fetchError ? fetchError.message : "erro desconhecido") +
            "\n\nVerifique sua conexão com a internet e tente de novo.",
        ],
      })
      .catch(() => {});
    return;
  }

  // 4. Injeta e mostra badge com a versão
  try {
    await injectIntoTab(tab.id, payload.body);
    flashBadge(
      tab.id,
      payload.version.replace(/^v/, ""),
      payload.source === "github" ? "#28a745" : "#e6a817"
    );
    // verde = pegou do GitHub (online)
    // laranja = usou cache local (modo offline)
  } catch (err) {
    console.error("[Sisloc Master] Falha ao injetar:", err);
    flashBadge(tab.id, "X", "#dc3545");
  }
});

// ============================================================================
// Log de instalação
// ============================================================================
chrome.runtime.onInstalled.addListener((details) => {
  console.log(
    "[Sisloc Master] Extensão instalada/atualizada:",
    details.reason,
    "→ vai buscar o script de:",
    GITHUB_RAW_URL
  );
});
