// ==============================================
// core/metricas_imagen.js
// Métricas objetivas de calidad visual de imagen.
// Base del diagnóstico selectivo (diagnostico.js).
// Depende de: nada
// ==============================================

(function() {
  'use strict';

  // ----------------------------------------------
  // Nitidez: varianza del Laplaciano. Mayor = más nítida.
  // Umbral práctico: < 100 = desenfoque
  // ----------------------------------------------
  function metricaNitidez(brillo, ancho, alto) {
    let suma = 0, sumaCuad = 0, n = 0;
    for (let y = 1; y < alto - 1; y++) {
      for (let x = 1; x < ancho - 1; x++) {
        const lap =
          -1 * brillo[y-1][x] - 1 * brillo[y+1][x]
          - 1 * brillo[y][x-1] - 1 * brillo[y][x+1]
          + 4 * brillo[y][x];
        suma += lap;
        sumaCuad += lap * lap;
        n++;
      }
    }
    if (n === 0) return 0;
    const media = suma / n;
    return (sumaCuad / n) - (media * media);
  }

  // ----------------------------------------------
  // Contraste RMS. Mayor = más contraste.
  // Umbral práctico: < 40 = bajo contraste
  // ----------------------------------------------
  function metricaContrasteRMS(brillo, ancho, alto) {
    let suma = 0, sumaCuad = 0, n = 0;
    for (let y = 0; y < alto; y++) {
      for (let x = 0; x < ancho; x++) {
        const v = brillo[y][x];
        suma += v;
        sumaCuad += v * v;
        n++;
      }
    }
    if (n === 0) return 0;
    const media = suma / n;
    return Math.sqrt((sumaCuad / n) - (media * media));
  }

  // ----------------------------------------------
  // Ruido: desviación estándar en zonas planas.
  // Umbral práctico: > 15 = hay ruido (JPEG/WhatsApp)
  // ----------------------------------------------
  function metricaRuido(brillo, ancho, alto) {
    const umbralGradiente = 10;
    let suma = 0, sumaCuad = 0, n = 0;
    for (let y = 1; y < alto - 1; y++) {
      for (let x = 1; x < ancho - 1; x++) {
        const gx = Math.abs(brillo[y][x+1] - brillo[y][x-1]);
        const gy = Math.abs(brillo[y+1][x] - brillo[y-1][x]);
        if ((gx + gy) < umbralGradiente) {
          const v = brillo[y][x];
          suma += v;
          sumaCuad += v * v;
          n++;
        }
      }
    }
    if (n < 100) return 0;
    const media = suma / n;
    return Math.sqrt((sumaCuad / n) - (media * media));
  }

  // ----------------------------------------------
  // Entropía de Shannon del histograma. Mayor = más información.
  // Útil para saber si la imagen está "vacía" o tiene detalle.
  // ----------------------------------------------
  function metricaEntropia(brillo, ancho, alto) {
    const hist = new Array(256).fill(0);
    for (let y = 0; y < alto; y++) {
      for (let x = 0; x < ancho; x++) hist[brillo[y][x] | 0]++;
    }
    const total = ancho * alto;
    let H = 0;
    for (let i = 0; i < 256; i++) {
      if (hist[i] > 0) {
        const p = hist[i] / total;
        H -= p * Math.log2(p);
      }
    }
    return H;
  }

  // ----------------------------------------------
  // Score combinado para OCR (orientado a texto legible).
  // Premia nitidez, contraste y entropía; penaliza ruido.
  // ----------------------------------------------
  function metricaCalidadOCR(brillo, ancho, alto) {
    const nitidez = metricaNitidez(brillo, ancho, alto);
    const contraste = metricaContrasteRMS(brillo, ancho, alto);
    const ruido = metricaRuido(brillo, ancho, alto);
    const entropia = metricaEntropia(brillo, ancho, alto);

    const nitidezNorm = Math.min(1, nitidez / 500);
    const contrasteNorm = Math.min(1, contraste / 80);
    const ruidoNorm = Math.min(1, ruido / 20);
    const entropiaNorm = Math.min(1, entropia / 8);

    const score = nitidezNorm * 0.3 + contrasteNorm * 0.3
                + entropiaNorm * 0.3 - ruidoNorm * 0.1;

    return {
      nitidez: nitidez,
      contraste: contraste,
      ruido: ruido,
      entropia: entropia,
      score: score
    };
  }

  // ----------------------------------------------
  // NUEVA: Iluminación desigual.
  // Estima el fondo con muestreo en bloques grandes y mide
  // la desviación estándar del fondo. Alta = sombras/gradiente.
  // Umbral práctico: > 25-30 = iluminación no uniforme
  // ----------------------------------------------
  function metricaIluminacionDesigual(brillo, ancho, alto) {
    const bloque = 64;
    const fondos = [];

    for (let by = 0; by < alto; by += bloque) {
      for (let bx = 0; bx < ancho; bx += bloque) {
        let maxV = 0;
        const y1 = Math.min(alto, by + bloque);
        const x1 = Math.min(ancho, bx + bloque);
        for (let y = by; y < y1; y += 4) {
          for (let x = bx; x < x1; x += 4) {
            if (brillo[y][x] > maxV) maxV = brillo[y][x];
          }
        }
        if (maxV > 0) fondos.push(maxV);
      }
    }

    if (fondos.length < 4) return 0;

    let suma = 0;
    for (const v of fondos) suma += v;
    const media = suma / fondos.length;

    let sumaCuad = 0;
    for (const v of fondos) sumaCuad += (v - media) * (v - media);

    return Math.sqrt(sumaCuad / fondos.length);
  }

  // ----------------------------------------------
  // NUEVA: Saturación media (para saber si la imagen tiene color).
  // 0 = blanco y negro puro, 1 = totalmente saturado.
  // ----------------------------------------------
  function metricaSaturacion(imageData) {
    const data = imageData.data;
    const total = imageData.width * imageData.height;
    if (total === 0) return 0;
    let suma = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      suma += (max === 0) ? 0 : (max - min) / max;
    }
    return suma / total;
  }

  // ----------------------------------------------
  // Exportar
  // ----------------------------------------------
  window.metricaNitidez = metricaNitidez;
  window.metricaContrasteRMS = metricaContrasteRMS;
  window.metricaRuido = metricaRuido;
  window.metricaEntropia = metricaEntropia;
  window.metricaCalidadOCR = metricaCalidadOCR;
  window.metricaIluminacionDesigual = metricaIluminacionDesigual;
  window.metricaSaturacion = metricaSaturacion;

  console.log('[core] metricas_imagen.js cargado');
})();
