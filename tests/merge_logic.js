// Espelho dos helpers da v35.12 (substituir RN existente com merge histórico).
// Funções puras, testáveis em Node. Devem ser idênticas às do bookmarklet.

// Similaridade entre dois títulos (já existe no bookmarklet como tal).
function titleSimilarity(a, b) {
  const norm = function(s) {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  };
  const wa = new Set(norm(a).split(' ').filter(function(w) { return w.length > 2; }));
  const wb = new Set(norm(b).split(' ').filter(function(w) { return w.length > 2; }));
  if (wa.size === 0 || wb.size === 0) return 0;
  let c = 0;
  wa.forEach(function(w) { if (wb.has(w)) c++; });
  return c / Math.min(wa.size, wb.size);
}

// Corta a descrição até o CHANGELOG (não procurar RNs no histórico).
function cropBeforeChangelog(reqDs) {
  const m = reqDs.match(/h1\.\s*CHANGELOG/i);
  return m ? reqDs.slice(0, m.index) : reqDs;
}

// Lista TODAS as RNs do requisito (com ou sem título), retornando ordem de aparição.
// Útil pra alimentar o dropdown de modo.
function getAllRules(reqDs) {
  const area = cropBeforeChangelog(reqDs);
  const rules = [];
  const re = /(?:^|\n)\s*(?:h3\.\s*)?RN(\d+)(?:\s*[-–]\s*([^\n\r]*))?/gi;
  let m;
  while ((m = re.exec(area)) !== null) {
    const titleRaw = m[2] ? m[2].trim().replace(/[.:]+$/, '').trim() : null;
    // Linhas riscadas (versões antigas) começam com `-` — ignorar como "RN ativa"
    const isStrikethrough = titleRaw && /^-.+-$/.test(titleRaw);
    if (isStrikethrough) continue;
    rules.push({
      rn: 'RN' + m[1],
      n: parseInt(m[1]),
      title: titleRaw,
      hasTitle: !!titleRaw,
      position: m.index
    });
  }
  // Dedup: a mesma RN pode aparecer em versões antigas dentro do próprio bloco — fica só a primeira (a ativa).
  const seen = {};
  return rules.filter(function(r) {
    if (seen[r.rn]) return false;
    seen[r.rn] = true;
    return true;
  });
}

// Acha a RN existente mais parecida com o título da regra nova. Retorna null se nenhuma chega no threshold.
function findBestMatch(newTitle, existingRules, threshold) {
  if (!newTitle || !existingRules || existingRules.length === 0) return null;
  threshold = threshold == null ? 0.8 : threshold;
  // Tira o prefixo "RN" / "RN <N>" do título novo antes de comparar — só interessa o conteúdo.
  const cleanNew = newTitle.replace(/^RN(?:\s?[A-Z0-9]+(?:\.\d+)?)?\s*[-–]\s*/i, '').trim();
  if (!cleanNew) return null;
  let best = null;
  for (const r of existingRules) {
    if (!r.hasTitle) continue;
    const sim = titleSimilarity(cleanNew, r.title);
    if (sim >= threshold && (!best || sim > best.sim)) {
      best = { rn: r.rn, n: r.n, title: r.title, sim: sim };
    }
  }
  return best;
}

// Acha os limites do bloco da RN<rn> no requisito (do início do header até a próxima seção).
// Retorna {start, end} ou null se não achou.
// O bloco inclui versões antigas riscadas que já estavam ali.
function getRuleBlockBounds(reqDs, rn) {
  const num = String(rn).replace(/^RN/i, '');
  // OBS: usar [ \t]* (não \s*) no início do grupo pra não consumir o \n da linha em branco anterior
  const reStart = new RegExp('(?:^|\\n)([ \\t]*(?:h3\\.\\s*)?RN' + num + '\\b)', 'i');
  const startM = reqDs.match(reStart);
  if (!startM) return null;
  const startIdx = startM.index + (startM[0].startsWith('\n') ? 1 : 0);
  const after = reqDs.slice(startIdx + startM[1].length);
  const reNext = /\n\s*(?:h3\.\s*)?RN\d+\b|\n\s*h[12]\.\s|\n\s*---/i;
  const nextM = after.match(reNext);
  let end;
  if (nextM) {
    end = startIdx + startM[1].length + nextM.index;
  } else {
    end = reqDs.length;
  }
  return { start: startIdx, end: end };
}

// Parse um bloco de RN em três partes:
//   - header: linha do `h3. RN<X> - <título>` (ou só `RN<X>` se sem título)
//   - bodyAtivo: corpo da versão atual (incluindo `(#dId)`) — NÃO riscado
//   - oldVersions: tudo que já estava riscado abaixo (preservado como está)
function parseRuleBlock(block, rn) {
  const num = String(rn).replace(/^RN/i, '');
  const lines = block.split('\n');
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (new RegExp('^\\s*(?:h3\\.\\s*)?RN' + num + '\\b', 'i').test(lines[i])) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return null;
  const headerLine = lines[headerIdx];
  // headerHasTitle: tem "- <texto>" depois do RN<X>
  const titleMatch = headerLine.match(new RegExp('^\\s*(?:h3\\.\\s*)?RN' + num + '\\s*[-–]\\s*(.+)$', 'i'));
  const headerTitle = titleMatch ? titleMatch[1].trim() : null;
  // Procurar a primeira linha riscada de versão antiga: padrão `-(#<dId>)-`
  let firstOldIdx = -1;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (/^\s*-\(#\d+\)-\s*$/.test(lines[i])) {
      firstOldIdx = i;
      break;
    }
  }
  let bodyLines, oldLines;
  if (firstOldIdx === -1) {
    bodyLines = lines.slice(headerIdx + 1);
    oldLines = [];
  } else {
    bodyLines = lines.slice(headerIdx + 1, firstOldIdx);
    oldLines = lines.slice(firstOldIdx);
  }
  // Tirar linhas em branco do final do body pra normalizar
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === '') bodyLines.pop();
  return {
    headerLine: headerLine,
    headerTitle: headerTitle,
    hasTitle: headerTitle !== null,
    bodyAtivo: bodyLines.join('\n'),
    oldVersions: oldLines.join('\n')
  };
}

// Risca cada linha não-vazia envolvendo com `-...-`. Linhas vazias permanecem vazias.
// v35.12.3: trim whitespace do FINAL da linha antes de fechar com `-`, senão o textile não
// renderiza strikethrough quando a linha termina com espaço (ex: "vinculados. -" não rendea).
function riscarLinhasTextile(texto) {
  if (!texto) return '';
  return texto.split('\n').map(function(line) {
    const t = line.trim();
    if (t === '') return '';
    // Se a linha já começa e termina com `-`, é caso degenerado — não duplicar
    if (/^-.*-$/.test(t) && t.length > 2) return line;
    // Preservar indentação inicial mas trim trailing whitespace
    const indent = line.match(/^(\s*)/)[0];
    const content = line.slice(indent.length).replace(/\s+$/, '');
    if (content === '') return '';
    return indent + '-' + content + '-';
  }).join('\n');
}

// Faz o merge histórico: substitui o bloco da RN<oldRN> empurrando a versão atual pra baixo riscada
// e colocando a versão nova no topo. Preserva versões antigas que já estavam riscadas.
// Garante 1 linha em branco antes e depois do bloco (v35.12.2).
// Retorna o novo `reqDs` (ou null se não achou a RN).
function mergeReplacingRule(reqDs, oldRN, newTitle, newContent, newDId) {
  const bounds = getRuleBlockBounds(reqDs, oldRN);
  if (!bounds) return null;
  const block = reqDs.slice(bounds.start, bounds.end);
  const parsed = parseRuleBlock(block, oldRN);
  if (!parsed) return null;

  const num = String(oldRN).replace(/^RN/i, '');
  const finalTitle = newTitle && newTitle.trim() ? newTitle.trim() : (parsed.headerTitle || '');
  const newHeader = finalTitle
    ? 'h3. RN' + num + ' - ' + finalTitle
    : 'h3. RN' + num;
  let oldRiscado = '';
  if (parsed.bodyAtivo.trim() !== '') {
    oldRiscado = riscarLinhasTextile(parsed.bodyAtivo);
  }
  const partes = [];
  partes.push(newHeader);
  partes.push('');
  partes.push('(#' + newDId + ')');
  if (newContent && newContent.trim() !== '') partes.push(newContent.trim());
  if (oldRiscado) {
    partes.push('');
    partes.push(oldRiscado);
  }
  if (parsed.oldVersions && parsed.oldVersions.trim() !== '') {
    partes.push('');
    partes.push(parsed.oldVersions);
  }
  // Garantir bloco sem \n nas bordas pro cálculo de spacing
  const novoBloco = partes.join('\n').replace(/^\n+|\n+$/g, '');
  // Spacing dinâmico: 1 linha em branco antes e depois (combina com o que já tem)
  const antesText = reqDs.slice(0, bounds.start);
  const depoisText = reqDs.slice(bounds.end);
  const trailingNls = (antesText.match(/\n+$/) || [""])[0].length;
  const leadingNls = (depoisText.match(/^\n+/) || [""])[0].length;
  const prefix = "\n".repeat(Math.max(0, 2 - trailingNls));
  let suffix = "\n".repeat(Math.max(0, 2 - leadingNls));
  if (depoisText === "") suffix = "\n";
  return antesText + prefix + novoBloco + suffix + depoisText;
}

// Insere `content` em `text` na posição `pos`, garantindo exatamente 1 linha em branco
// antes e 1 depois (não adiciona excesso se já tem newlines, não deixa zero).
// Se a posição é o fim do arquivo, usa apenas 1 \n no final.
function insertWithSpacing(text, pos, content) {
  if (content === "" || content == null) return text;
  const antes = text.slice(0, pos);
  const depois = text.slice(pos);
  const trailingNls = (antes.match(/\n+$/) || [""])[0].length;
  const leadingNls = (depois.match(/^\n+/) || [""])[0].length;
  const prefix = "\n".repeat(Math.max(0, 2 - trailingNls));
  let suffix = "\n".repeat(Math.max(0, 2 - leadingNls));
  if (depois === "") suffix = "\n";
  return antes + prefix + content + suffix + depois;
}

module.exports = {
  titleSimilarity: titleSimilarity,
  cropBeforeChangelog: cropBeforeChangelog,
  getAllRules: getAllRules,
  findBestMatch: findBestMatch,
  getRuleBlockBounds: getRuleBlockBounds,
  parseRuleBlock: parseRuleBlock,
  riscarLinhasTextile: riscarLinhasTextile,
  mergeReplacingRule: mergeReplacingRule,
  insertWithSpacing: insertWithSpacing
};
