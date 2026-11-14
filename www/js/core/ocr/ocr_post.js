// ==============================================
// core/ocr/ocr_post.js
// Post-procesamiento OCR: homóglifos + diccionario + Levenshtein.
// Lo usa: runner_texto.js, runner_tiling.js, ocr_corrector_tipos.js
// ==============================================

(function() {
  'use strict';

  // ----------------------------------------------
  // Levenshtein: distancia de edición entre dos strings
  // ----------------------------------------------
  function levenshtein(a, b) {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const m = a.length, n = b.length;
    let prev = new Array(n + 1);
    let curr = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        const costo = (a[i - 1] === b[j - 1]) ? 0 : 1;
        curr[j] = Math.min(
          prev[j] + 1,
          curr[j - 1] + 1,
          prev[j - 1] + costo
        );
      }
      const tmp = prev; prev = curr; curr = tmp;
    }
    return prev[n];
  }

  // ----------------------------------------------
  // Similitud 0-1 (1 = idénticos)
  // ----------------------------------------------
  function similitud(a, b) {
    if (!a || !b) return 0;
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    return 1 - (levenshtein(a, b) / maxLen);
  }

  // ----------------------------------------------
  // Homóglifos: reemplaza caracteres visualmente confundibles
  // según contexto (vecinos letra/dígito).
  // ----------------------------------------------
  function homoglifos(token) {
    if (!token || token.length === 0) return token;

    let letras = 0, digitos = 0;
    for (let i = 0; i < token.length; i++) {
      const c = token[i];
      if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')) letras++;
      else if (c >= '0' && c <= '9') digitos++;
    }

    // Si es puramente numérico o puramente alfabético, no aplicar
    if (digitos === token.length) return token;
    if (letras === token.length) return token;

    const out = [];
    for (let i = 0; i < token.length; i++) {
      const c = token[i];
      const prev = i > 0 ? token[i - 1] : '';
      const next = i < token.length - 1 ? token[i + 1] : '';
      const esLetraPrev = (prev >= 'A' && prev <= 'Z') || (prev >= 'a' && prev <= 'z');
      const esLetraNext = (next >= 'A' && next <= 'Z') || (next >= 'a' && next <= 'z');
      const esDigitoPrev = (prev >= '0' && prev <= '9');
      const esDigitoNext = (next >= '0' && next <= '9');

      // 4 → A solo si está entre letras
      if (c === '4' && esLetraPrev && esLetraNext) { out.push('A'); continue; }
      // 0 → O solo si está entre letras
      if (c === '0' && esLetraPrev && esLetraNext) { out.push('O'); continue; }
      // 1 → I solo si está entre MAYÚSCULAS
      if (c === '1' && prev >= 'A' && prev <= 'Z' && next >= 'A' && next <= 'Z') { out.push('I'); continue; }
      // l/L → I si está entre dígitos y hay letras
      if ((c === 'l' || c === 'L') && (esDigitoPrev || esDigitoNext) && letras > 0) { out.push('I'); continue; }
      // 8 → B solo si está entre letras
      if (c === '8' && esLetraPrev && esLetraNext) { out.push('B'); continue; }
      // 5 → S solo si está al inicio y el resto son letras
      if (c === '5' && i === 0 && token.length > 1 && esLetraNext) { out.push('S'); continue; }

      out.push(c);
    }
    return out.join('');
  }

  // ----------------------------------------------
  // Corrección por diccionario (Levenshtein)
  // Umbral: <= 2 ediciones Y ratio >= 0.65
  // ----------------------------------------------
  function corregirPorDiccionario(token, dict, umbral) {
    if (!token || token.length < 3) return token;
    umbral = umbral || 2;

    if (dict.indexOf(token) >= 0) return token;

    let mejor = null;
    let mejorDist = umbral + 1;
    for (let i = 0; i < dict.length; i++) {
      const cand = dict[i];
      if (Math.abs(cand.length - token.length) > umbral) continue;
      const d = levenshtein(token, cand);
      if (d < mejorDist) {
        mejorDist = d;
        mejor = cand;
        if (d === 0) break;
      }
    }

    if (mejor && mejorDist <= umbral) {
      const sim = similitud(token, mejor);
      if (sim >= 0.65) return mejor;
    }
    return token;
  }

  // ----------------------------------------------
  // Corrección de un solo token
  // ----------------------------------------------
  function corregirToken(token, dict) {
    if (!token) return token;
    const limpio = token.replace(/^[.,:;|()\[\]{}]+|[.,:;|()\[\]{}]+$/g, '');
    if (limpio.length === 0) return token;
    const conHomoglifos = homoglifos(limpio);
    return corregirPorDiccionario(conHomoglifos, dict);
  }

  // ----------------------------------------------
  // Post-procesa el texto completo preservando estructura
  // ----------------------------------------------
  function postProcesar(texto, opciones) {
    if (!texto) return '';
    opciones = opciones || {};
    const dict = opciones.dict || window.ocrObtenerDiccionarioCompleto();
    const usarDiccionario = opciones.usarDiccionario !== false;
    const usarHomoglifos = opciones.usarHomoglifos !== false;

    const partes = texto.split(/(\s+)/);
    const out = [];
    for (let i = 0; i < partes.length; i++) {
      const p = partes[i];
      if (!p) continue;
      if (/^\s+$/.test(p)) { out.push(p); continue; }

      let nucleo = p.replace(/^[.,:;|()\[\]{}]+|[.,:;|()\[\]{}]+$/g, '');
      const prefijoMatch = p.match(/^[.,:;|()\[\]{}]+/);
      const sufijoMatch = p.match(/[.,:;|()\[\]{}]+$/);
      const pre = prefijoMatch ? prefijoMatch[0] : '';
      const suf = sufijoMatch ? sufijoMatch[0] : '';

      if (usarHomoglifos) nucleo = homoglifos(nucleo);
      if (usarDiccionario) nucleo = corregirPorDiccionario(nucleo, dict);

      out.push(pre + nucleo + suf);
    }
    return out.join('');
  }

  // ----------------------------------------------
  // Reconstruir texto desde boundingBox (para tablas)
  // ----------------------------------------------
  function reconstruirTexto(result) {
    if (!result || !result.blocks || result.blocks.length === 0) {
      return (result && result.text) ? result.text : '';
    }
    const bloquesOut = [];
    for (const block of result.blocks) {
      if (!block.lines) continue;
      const lineasOut = [];
      for (const line of block.lines) {
        if (!line.elements || line.elements.length === 0) {
          if (line.text) lineasOut.push(line.text);
          continue;
        }
        const elementos = [];
        for (const el of line.elements) {
          const t = (el.text || '').trim();
          if (t.length === 0) continue;
          elementos.push({ txt: t, bb: el.boundingBox });
        }
        if (elementos.length === 0) {
          if (line.text) lineasOut.push(line.text);
          continue;
        }
        let totalAncho = 0, totalChars = 0;
        for (const el of elementos) {
          if (el.bb) {
            totalAncho += (el.bb.right - el.bb.left);
            totalChars += el.txt.length;
          }
        }
        const anchoPromedio = totalChars > 0 ? (totalAncho / totalChars) : 0;
        const umbralGap = anchoPromedio * 0.8;

        let linea = '';
        let prevRight = null;
        for (let i = 0; i < elementos.length; i++) {
          const el = elementos[i];
          const currLeft = el.bb ? el.bb.left : null;
          if (i === 0) {
            linea = el.txt;
          } else if (prevRight !== null && currLeft !== null) {
            const gap = currLeft - prevRight;
            linea += (gap < umbralGap) ? el.txt : (' ' + el.txt);
          } else {
            linea += ' ' + el.txt;
          }
          prevRight = el.bb ? el.bb.right : null;
        }
        lineasOut.push(linea);
      }
      bloquesOut.push(lineasOut.join('\n'));
    }
    return bloquesOut.join('\n\n');
  }

  // ----------------------------------------------
  // Exportar al window (una sola vez, al final)
  // ----------------------------------------------
  window.ocrLevenshtein = levenshtein;
  window.ocrSimilitud = similitud;
  window.ocrHomoglifos = homoglifos;
  window.ocrCorregirPorDiccionario = corregirPorDiccionario;
  window.ocrCorregirToken = corregirToken;
  window.ocrPostProcesar = postProcesar;
  window.ocrReconstruirTexto = reconstruirTexto;

  console.log('[core/ocr] ocr_post.js cargado');
})();
