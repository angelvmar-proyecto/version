// ==============================================
// core/ocr_fidelidad.js
// Medidor de fidelidad OCR contra CSV de referencia.
// Métrica: F1 = 2·P·R / (P+R)
// ==============================================

// Caché de tokens de referencia por archivo
window.OCR_REF_CACHE = {};

// Carga un CSV de referencia y extrae sus tokens únicos
async function ocrCargarReferencia(rutaCsv) {
  if (window.OCR_REF_CACHE[rutaCsv]) return window.OCR_REF_CACHE[rutaCsv];
  try {
    const resp = await fetch(rutaCsv);
    if (!resp.ok) return null;
    const texto = await resp.text();
    const objetos = csvParsearConHeaders(texto);
    const tokens = csvExtraerTokens(objetos, { minLen: 3, incluirNumeros: false });
    window.OCR_REF_CACHE[rutaCsv] = tokens;
    console.log('[FID] Referencia ' + rutaCsv + ': ' + tokens.length + ' tokens únicos');
    return tokens;
  } catch(e) {
    console.log('[FID] Error cargando ' + rutaCsv + ': ' + e.message);
    return null;
  }
}

// Cuenta cuántos tokens de `fuente` aparecen (con similitud) en `destino`
// Devuelve { matches, total } — matches es la cantidad de tokens con match
function ocrContarMatches(tokensFuente, tokensDestino, umbral) {
  umbral = umbral || 0.8;
  const setDestino = new Set(tokensDestino);
  let matches = 0;
  for (const t of tokensFuente) {
    // Match exacto rápido
    if (setDestino.has(t)) { matches++; continue; }
    // Match difuso con Levenshtein (solo si el token es >= 4 chars)
    if (t.length < 4) continue;
    let encontrado = false;
    for (const d of tokensDestino) {
      if (Math.abs(d.length - t.length) > 2) continue;
      let sim = 0;
      if (typeof ocrSimilitud === 'function') {
        sim = ocrSimilitud(t, d);
      } else {
        continue;
      }
      if (sim >= umbral) { encontrado = true; break; }
    }
    if (encontrado) matches++;
  }
  return { matches, total: tokensFuente.length };
}

// Calcula fidelidad F1 del texto OCR contra una referencia cargada
function ocrCalcularFidelidad(textoOcr, tokensReferencia) {
  if (!tokensReferencia || tokensReferencia.length === 0) {
    return { f1: 0, precision: 0, recall: 0, matchesOcr: 0, matchesRef: 0, totalOcr: 0, totalRef: 0 };
  }
  const tokensOcr = textoExtraerTokens(textoOcr, { minLen: 3, incluirNumeros: false });
  if (tokensOcr.length === 0) {
    return { f1: 0, precision: 0, recall: 0, matchesOcr: 0, matchesRef: 0, totalOcr: 0, totalRef: tokensReferencia.length };
  }

  // Recall: cuántos tokens de referencia capturó el OCR
  const refEnOcr = ocrContarMatches(tokensReferencia, tokensOcr, 0.8);
  const recall = refEnOcr.total > 0 ? (refEnOcr.matches / refEnOcr.total) : 0;

  // Precision: cuántos tokens del OCR son "reales" (aparecen en referencia)
  const ocrEnRef = ocrContarMatches(tokensOcr, tokensReferencia, 0.8);
  const precision = ocrEnRef.total > 0 ? (ocrEnRef.matches / ocrEnRef.total) : 0;

  const f1 = (precision + recall) > 0 ? (2 * precision * recall / (precision + recall)) : 0;

  return {
    f1: f1,
    precision: precision,
    recall: recall,
    matchesOcr: ocrEnRef.matches,
    matchesRef: refEnOcr.matches,
    totalOcr: ocrEnRef.total,
    totalRef: refEnOcr.total
  };
}

window.ocrCargarReferencia = ocrCargarReferencia;
window.ocrCalcularFidelidad = ocrCalcularFidelidad;
window.ocrContarMatches = ocrContarMatches;

console.log('core/ocr_fidelidad.js cargado');
