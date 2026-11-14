// ==============================================
// core/sauvola.js
// Preprocesamiento: Sauvola binarization adaptativa.
// Calcula umbral local por píxel basado en media y std.
// Lo usa: diagnostico.js (para imágenes con iluminación desigual)
// Depende de: config.js (CONFIG.SAUVOLA_VENTANA, CONFIG.SAUVOLA_K)
// ==============================================

(function() {
  'use strict';

  // ----------------------------------------------
  // Sauvola: binariza con umbral adaptativo local
  // T = media * (1 + k * (std/R - 1))
  // ----------------------------------------------
  function aplicarSauvola(brillo, ancho, alto) {
    const t0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();

    const ventana = (typeof CONFIG !== 'undefined' && CONFIG.SAUVOLA_VENTANA)
      ? CONFIG.SAUVOLA_VENTANA : 15;
    const k = (typeof CONFIG !== 'undefined' && CONFIG.SAUVOLA_K)
      ? CONFIG.SAUVOLA_K : 0.3;
    const R = 128;

    // Integrales para media y varianza rápidas
    const suma = [];
    const suma2 = [];
    for (let y = 0; y <= alto; y++) {
      suma.push(new Float64Array(ancho + 1));
      suma2.push(new Float64Array(ancho + 1));
    }
    for (let y = 1; y <= alto; y++) {
      let filaSuma = 0;
      let filaSuma2 = 0;
      for (let x = 1; x <= ancho; x++) {
        const v = brillo[y - 1][x - 1];
        filaSuma += v;
        filaSuma2 += v * v;
        suma[y][x] = suma[y - 1][x] + filaSuma;
        suma2[y][x] = suma2[y - 1][x] + filaSuma2;
      }
    }

    const mitad = Math.floor(ventana / 2);
    const resultado = new Array(alto);
    for (let y = 0; y < alto; y++) {
      resultado[y] = new Array(ancho);
      const y0 = Math.max(0, y - mitad);
      const y1 = Math.min(alto - 1, y + mitad);
      for (let x = 0; x < ancho; x++) {
        const x0 = Math.max(0, x - mitad);
        const x1 = Math.min(ancho - 1, x + mitad);
        const area = (y1 - y0 + 1) * (x1 - x0 + 1);
        const s  = suma[y1+1][x1+1]  - suma[y0][x1+1]  - suma[y1+1][x0]  + suma[y0][x0];
        const s2 = suma2[y1+1][x1+1] - suma2[y0][x1+1] - suma2[y1+1][x0] + suma2[y0][x0];
        const media = s / area;
        const varianza = Math.max(0, s2 / area - media * media);
        const std = Math.sqrt(varianza);
        const T = media * (1 + k * (std / R - 1));
        resultado[y][x] = brillo[y][x] < T ? 0 : 255;
      }
    }

    const t1 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    console.log('[Sauvola] aplicado en ' + (t1 - t0).toFixed(0) + 'ms');
    return resultado;
  }

  // ----------------------------------------------
  // Exportar
  // ----------------------------------------------
  window.aplicarSauvola = aplicarSauvola;

  console.log('[core] sauvola.js cargado');
})();
