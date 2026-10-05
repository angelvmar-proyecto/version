// ==============================================
// core/metricas_imagen.js
// Metricas objetivas de calidad visual de imagen.
// ==============================================

// Varianza del Laplaciano (nitidez). Mayor = mas nitida.
function metricaNitidez(brillo, ancho, alto) {
  let suma = 0, sumaCuad = 0, n = 0;
  for (let y = 1; y < alto - 1; y++) {
    for (let x = 1; x < ancho - 1; x++) {
      // Kernel Laplaciano 3x3
      const lap =
        -1 * brillo[y-1][x] - 1 * brillo[y+1][x] - 1 * brillo[y][x-1] - 1 * brillo[y][x+1]
        + 4 * brillo[y][x];
      suma += lap;
      sumaCuad += lap * lap;
      n++;
    }
  }
  const media = suma / n;
  const varianza = (sumaCuad / n) - (media * media);
  return varianza;
}

// Contraste RMS. Mayor = mas contraste.
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
  const media = suma / n;
  const varianza = (sumaCuad / n) - (media * media);
  return Math.sqrt(varianza);
}

// Ruido estimado: desviacion estandar en zonas planas (bajo gradiente).
function metricaRuido(brillo, ancho, alto) {
  // Calcular gradiente
  const umbralGradiente = 10;
  let suma = 0, sumaCuad = 0, n = 0;
  for (let y = 1; y < alto - 1; y++) {
    for (let x = 1; x < ancho - 1; x++) {
      const gx = Math.abs(brillo[y][x+1] - brillo[y][x-1]);
      const gy = Math.abs(brillo[y+1][x] - brillo[y-1][x]);
      const grad = gx + gy;
      if (grad < umbralGradiente) {
        // Zona plana
        const v = brillo[y][x];
        suma += v;
        sumaCuad += v * v;
        n++;
      }
    }
  }
  if (n < 100) return 0;
  const media = suma / n;
  const varianza = (sumaCuad / n) - (media * media);
  return Math.sqrt(varianza);
}

// Entropia de Shannon del histograma. Mayor = mas informacion.
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

// Score combinado para OCR (orientado a texto legible).
// Premia nitidez, contraste y entropia; penaliza ruido.
function metricaCalidadOCR(brillo, ancho, alto) {
  const nitidez = metricaNitidez(brillo, ancho, alto);
  const contraste = metricaContrasteRMS(brillo, ancho, alto);
  const ruido = metricaRuido(brillo, ancho, alto);
  const entropia = metricaEntropia(brillo, ancho, alto);

  // Normalizar (escalas tipicas)
  const nitidezNorm = Math.min(1, nitidez / 500);
  const contrasteNorm = Math.min(1, contraste / 80);
  const ruidoNorm = Math.min(1, ruido / 20);
  const entropiaNorm = Math.min(1, entropia / 8);

  // Score: cuanto mas alto mejor
  const score = nitidezNorm * 0.3 + contrasteNorm * 0.3 + entropiaNorm * 0.3 - ruidoNorm * 0.1;
  return {
    nitidez: nitidez,
    contraste: contraste,
    ruido: ruido,
    entropia: entropia,
    score: score
  };
}

console.log('core/metricas_imagen.js cargado');

// Exportar explicitamente a window
window.metricaNitidez = metricaNitidez;
window.metricaContrasteRMS = metricaContrasteRMS;
window.metricaRuido = metricaRuido;
window.metricaEntropia = metricaEntropia;
window.metricaCalidadOCR = metricaCalidadOCR;
