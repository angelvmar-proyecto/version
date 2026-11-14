// ==============================================
// core/ocr/ocr_fidelidad.js
// Medidor de fidelidad OCR contra CSV de referencia.
// Métrica: F1 = 2·P·R / (P+R)
// Depende de: csv_parser.js (csvParsearConHeaders, csvExtraerTokens),
//             ocr_post.js (ocrSimilitud)
// Lo usa: runner_tiling.js, runner_tabla_v2.js
// ==============================================

(function() {
  'use strict';

  // ----------------------------------------------
  // Caché de tokens de referencia por archivo
  // ----------------------------------------------
  const REF_CACHE = {};

  // ----------------------------------------------
  // Carga un CSV de referencia y extrae sus tokens únicos
  // ----------------------------------------------
  async function cargarReferencia(rutaCsv) {
    if (REF_CACHE[rutaCsv]) return REF_CACHE[rutaCsv];
    try {
      const resp = await fetch(rutaCsv);
      if (!resp.ok) return null;
      const texto = await resp.text();
      const objetos = window.csvParsearConHeaders(texto);
      const tokens = window.csvExtraerTokens(objetos, { minLen: 3, incluirNumeros: false });
      REF_CACHE[rutaCsv] = tokens;
      console.log('[FID] Referencia ' + rutaCsv + ': ' + tokens.length + ' tokens únicos');
      return tokens;
    } catch (e) {
      console.log('[FID] Error cargando ' + rutaCsv + ': ' + e.message);
      return null;
    }
  }

  // ----------------------------------------------
  // Cuenta cuántos tokens de `fuente` aparecen (con similitud)
  // en `destino`. Devuelve { matches, total }.
  // ----------------------------------------------
  function contarMatches(tokensFuente, tokensDestino, umbral) {
    umbral = umbral || 0.8;
    const setDestino = new Set(tokensDestino);
    let matches = 0;

    for (const t of tokensFuente) {
      // Match exacto rápido
      if (setDestino.has(t)) { matches++; continue; }

      // Match difuso (solo para tokens de 4+ caracteres)
      if (t.length < 4) continue;

      let encontrado = false;
      for (const d of tokensDestino) {
        if (Math.abs(d.length - t.length) > 2) continue;
        if (typeof window.ocrSimilitud !== 'function') continue;
        const sim = window.ocrSimilitud(t, d);
        if (sim >= umbral) { encontrado = true; break; }
      }
      if (encontrado) matches++;
    }

    return { matches, total: tokensFuente.length };
  }

  // ----------------------------------------------
  // Calcula fidelidad F1 del texto OCR contra una referencia cargada
  // ----------------------------------------------
  function calcularFidelidad(textoOcr, tokensReferencia) {
    if (!tokensReferencia || tokensReferencia.length === 0) {
      return {
        f1: 0, precision: 0, recall: 0,
        matchesOcr: 0, matchesRef: 0,
        totalOcr: 0, totalRef: 0
      };
    }

    const tokensOcr = window.textoExtraerTokens(textoOcr, { minLen: 3, incluirNumeros: false });
    if (tokensOcr.length === 0) {
      return {
        f1: 0, precision: 0, recall: 0,
        matchesOcr: 0, matchesRef: 0,
        totalOcr: 0, totalRef: tokensReferencia.length
      };
    }

    // Recall: cuántos tokens de referencia capturó el OCR
    const refEnOcr = contarMatches(tokensReferencia, tokensOcr, 0.8);
    const recall = refEnOcr.total > 0 ? (refEnOcr.matches / refEnOcr.total) : 0;

    // Precision: cuántos tokens del OCR son "reales"
    const ocrEnRef = contarMatches(tokensOcr, tokensReferencia, 0.8);
    const precision = ocrEnRef.total > 0 ? (ocrEnRef.matches / ocrEnRef.total) : 0;

    const f1 = (precision + recall) > 0
      ? (2 * precision * recall / (precision + recall))
      : 0;

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

  // ----------------------------------------------
  // Exportar
  // ----------------------------------------------
  window.OCR_REF_CACHE = REF_CACHE;
  window.ocrCargarReferencia = cargarReferencia;
  window.ocrCalcularFidelidad = calcularFidelidad;
  window.ocrContarMatches = contarMatches;

  console.log('[core/ocr] ocr_fidelidad.js cargado');
})();
