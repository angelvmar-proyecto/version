// ==============================================
// core/ocr_post.js
// Post-procesamiento OCR: homóglifos + diccionario.
// ==============================================

// --- Distancia de Levenshtein ---
function ocrLevenshtein(a, b) {
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

// --- Ratio de similitud 0-1 (1 = idénticos) ---
function ocrSimilitud(a, b) {
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = ocrLevenshtein(a, b);
  return 1 - (dist / maxLen);
}

// --- Homóglifos: reemplaza caracteres visualmente idénticos según contexto ---
// Reglas:
//   4 → A (cuando está entre letras)
//   0 → O (cuando está entre letras)
//   1 → I (cuando está entre letras mayúsculas)
//   l → I (cuando está entre letras mayúsculas o dígitos)
//   5 → S (cuando está al inicio de token alfabético)
//   8 → B (cuando está entre letras)
function ocrHomoglifos(token) {
  if (!token || token.length === 0) return token;

  // Cuenta letras y dígitos
  let letras = 0, digitos = 0;
  for (let i = 0; i < token.length; i++) {
    const c = token[i];
    if (c >= 'A' && c <= 'Z') letras++;
    else if (c >= 'a' && c <= 'z') letras++;
    else if (c >= '0' && c <= '9') digitos++;
  }

  // Si es puramente numérico, no aplicar homóglifos
  if (digitos === token.length) return token;
  // Si es puramente alfabético, no aplicar (los dígitos no aparecen)
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
    // 1 → I solo si está entre letras MAYÚSCULAS
    if (c === '1' && prev >= 'A' && prev <= 'Z' && next >= 'A' && next <= 'Z') { out.push('I'); continue; }
    // l → I si está entre letras mayúsculas o dígitos
    if ((c === 'l' || c === 'L') && (esDigitoPrev || esDigitoNext) && letras > 0) { out.push('I'); continue; }
    // 8 → B solo si está entre letras
    if (c === '8' && esLetraPrev && esLetraNext) { out.push('B'); continue; }
    // 5 → S solo si está al inicio y el resto son letras
    if (c === '5' && i === 0 && token.length > 1 && esLetraNext) { out.push('S'); continue; }

    out.push(c);
  }
  return out.join('');
}

// --- Corrección por diccionario (Levenshtein) ---
// Si el token no está en el diccionario, busca el más cercano.
// Umbral: <= 2 ediciones Y ratio >= 0.65
function ocrCorregirPorDiccionario(token, dict, umbral) {
  if (!token || token.length < 3) return token;
  umbral = umbral || 2;

  // 1. Si ya está en el diccionario, ok
  if (dict.indexOf(token) >= 0) return token;

  // 2. Buscar el más cercano con Levenshtein
  let mejor = null;
  let mejorDist = umbral + 1;
  for (let i = 0; i < dict.length; i++) {
    const cand = dict[i];
    // Filtro rápido por longitud (diferencia > umbral → descartar)
    if (Math.abs(cand.length - token.length) > umbral) continue;
    const d = ocrLevenshtein(token, cand);
    if (d < mejorDist) {
      mejorDist = d;
      mejor = cand;
      if (d === 0) break;
    }
  }

  if (mejor && mejorDist <= umbral) {
    const sim = ocrSimilitud(token, mejor);
    if (sim >= 0.65) return mejor;
  }
  return token;
}

// --- Corrección de un solo token ---
function ocrCorregirToken(token, dict) {
  if (!token) return token;

  // 1. Limpieza mínima: quitar puntuación de bordes
  const limpio = token.replace(/^[.,:;|()\[\]{}]+|[.,:;|()\[\]{}]+$/g, '');
  if (limpio.length === 0) return token;

  // 2. Aplicar homóglifos
  const conHomoglifos = ocrHomoglifos(limpio);

  // 3. Corregir por diccionario (solo si es palabra larga, no código)
  const corregido = ocrCorregirPorDiccionario(conHomoglifos, dict);

  return corregido;
}

// --- Post-procesar el texto completo ---
// Preserva la estructura original (espacios, saltos de línea).
function ocrPostProcesar(texto, opciones) {
  if (!texto) return '';
  opciones = opciones || {};
  const dict = opciones.dict || window.ocrObtenerDiccionarioCompleto();
  const usarDiccionario = opciones.usarDiccionario !== false;
  const usarHomoglifos = opciones.usarHomoglifos !== false;

  // Dividir preservando separadores (espacios, \n, \t)
  const partes = texto.split(/(\s+)/);
  const out = [];
  for (let i = 0; i < partes.length; i++) {
    const p = partes[i];
    if (!p) continue;
    // Si es separador (todo espacios/saltos), lo dejamos tal cual
    if (/^\s+$/.test(p)) { out.push(p); continue; }

    let token = p;
    const limpio = token.replace(/^[.,:;|()\[\]{}]+|[.,:;|()\[\]{}]+$/g, '');
    const sufijo = token.substring(limpio.length + (token.length - limpio.length - (token.length - limpio.length)));
    // Reconstruir prefijo/sufijo después

    let nucleo = limpio;
    if (usarHomoglifos) {
      nucleo = ocrHomoglifos(nucleo);
    }
    if (usarDiccionario) {
      nucleo = ocrCorregirPorDiccionario(nucleo, dict);
    }

    // Preservar prefijo y sufijo de puntuación
    const prefijo = token.match(/^[.,:;|()\[\]{}]+/);
    const sufijoMatch = token.match(/[.,:;|()\[\]{}]+$/);
    const pre = prefijo ? prefijo[0] : '';
    const suf = sufijoMatch ? sufijoMatch[0] : '';
    out.push(pre + nucleo + suf);
  }
  return out.join('');
}

// --- Reconstruir texto usando boundingBox de los elementos (Pilar 3) ---
// Fusiona elementos adyacentes si el gap horizontal es menor al ancho
// promedio de un carácter. Si no, los separa con espacio.
function ocrReconstruirTexto(result) {
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
      // Calcular ancho promedio por carácter en esta línea
      let totalAncho = 0, totalChars = 0;
      for (const el of line.elements) {
        if (el.boundingBox && el.text) {
          const ancho = el.boundingBox.right - el.boundingBox.left;
          totalAncho += ancho;
          totalChars += el.text.length;
        }
      }
      const anchoPromedio = totalChars > 0 ? (totalAncho / totalChars) : 0;
      const umbralGap = anchoPromedio * 0.6;

      let linea = '';
      let prevRight = null;
      for (let i = 0; i < line.elements.length; i++) {
        const el = line.elements[i];
        const txt = el.text || '';
        const currLeft = el.boundingBox ? el.boundingBox.left : null;
        if (i === 0) {
          linea = txt;
        } else if (prevRight !== null && currLeft !== null) {
          const gap = currLeft - prevRight;
          if (gap < umbralGap) {
            linea += txt;
          } else {
            linea += ' ' + txt;
          }
        } else {
          linea += ' ' + txt;
        }
        prevRight = el.boundingBox ? el.boundingBox.right : null;
      }
      lineasOut.push(linea);
    }
    bloquesOut.push(lineasOut.join('\n'));
  }
  return bloquesOut.join('\n\n');
}

window.ocrLevenshtein = ocrLevenshtein;
window.ocrSimilitud = ocrSimilitud;
window.ocrHomoglifos = ocrHomoglifos;
window.ocrCorregirPorDiccionario = ocrCorregirPorDiccionario;
window.ocrCorregirToken = ocrCorregirToken;
window.ocrPostProcesar = ocrPostProcesar;
window.ocrReconstruirTexto = ocrReconstruirTexto;

console.log('core/ocr_post.js cargado');
