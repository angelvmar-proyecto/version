// ==============================================
// core/rescate_zonas.js
// Detecta huecos entre las lineas base y aplica algoritmos
// de rescate SOLO dentro de esas zonas. Acepta solo si
// 2+ algoritmos coinciden.
// ==============================================

/**
 * Detecta huecos en un array de lineas ordenadas.
 * @param {Array<number>} lineas
 * @param {number} distMin
 * @returns {Array<{y0, y1}>} lista de huecos {inicio, fin}
 */
function detectarHuecos(lineas, distMin) {
  const ordenadas = lineas.slice().sort(function(a, b) { return a - b; });
  const huecos = [];
  for (let i = 0; i < ordenadas.length - 1; i++) {
    if (ordenadas[i+1] - ordenadas[i] > distMin) {
      huecos.push({ y0: ordenadas[i], y1: ordenadas[i+1] });
    }
  }
  return huecos;
}

/**
 * Cuenta votos por linea en una zona vertical [y0, y1].
 * Corre cada algoritmo de rescate H limitado a esa banda.
 */
function contarVotosH(brillo, ancho, y0, y1, algos) {
  const votos = {};
  const candPorAlgo = {};

  algos.forEach(function(algo) {
    const cands = [];
    if (algo === 'realce') cands.push.apply(cands, rescateRealceH(brillo, ancho, y0, y1));
    else if (algo === 'continuidad') cands.push.apply(cands, rescateContinuidadH(brillo, ancho, y0, y1));
    else if (algo === 'openv') cands.push.apply(cands, rescateOPENVH(brillo, ancho, y0, y1));
    else if (algo === 'ws') cands.push.apply(cands, rescateWSH(brillo, ancho, y0, y1));
    candPorAlgo[algo] = cands;
  });

  // Votar por buckets de 5px
  const buckets = {};
  Object.keys(candPorAlgo).forEach(function(algo) {
    const vistos = {};
    candPorAlgo[algo].forEach(function(y) {
      const k = Math.round(y / 5) * 5;
      if (vistos[k]) return;
      vistos[k] = true;
      if (!buckets[k]) buckets[k] = { suma: 0, count: 0, algs: {} };
      buckets[k].suma += y;
      buckets[k].count++;
      buckets[k].algs[algo] = true;
    });
  });

  Object.keys(buckets).forEach(function(k) {
    const b = buckets[k];
    const numAlgs = Object.keys(b.algs).length;
    const pos = Math.round(b.suma / b.count);
    votos[pos] = numAlgs;
  });

  return votos;
}

function contarVotosV(brillo, ancho, alto, x0, x1, algos) {
  const votos = {};
  const candPorAlgo = {};

  algos.forEach(function(algo) {
    const cands = [];
    if (algo === 'realce') cands.push.apply(cands, rescateRealceV(brillo, ancho, alto, x0, x1));
    else if (algo === 'continuidad') cands.push.apply(cands, rescateContinuidadV(brillo, ancho, alto, x0, x1));
    else if (algo === 'openv') cands.push.apply(cands, rescateOPENVV(brillo, ancho, alto, x0, x1));
    else if (algo === 'ws') cands.push.apply(cands, rescateWSV(brillo, ancho, alto, x0, x1));
    candPorAlgo[algo] = cands;
  });

  const buckets = {};
  Object.keys(candPorAlgo).forEach(function(algo) {
    const vistos = {};
    candPorAlgo[algo].forEach(function(x) {
      const k = Math.round(x / 5) * 5;
      if (vistos[k]) return;
      vistos[k] = true;
      if (!buckets[k]) buckets[k] = { suma: 0, count: 0, algs: {} };
      buckets[k].suma += x;
      buckets[k].count++;
      buckets[k].algs[algo] = true;
    });
  });

  Object.keys(buckets).forEach(function(k) {
    const b = buckets[k];
    const numAlgs = Object.keys(b.algs).length;
    const pos = Math.round(b.suma / b.count);
    votos[pos] = numAlgs;
  });

  return votos;
}

// ============ Algoritmos H (limitados a banda [y0, y1]) ============

function rescateRealceH(brillo, ancho, y0, y1) {
  const result = [];
  const factor = CONFIG.REALCE_UMBRAL_FACTOR;
  const gapMax = window.CONFIG_ESC.REALCE_GAP_MAX || 20;
  const distMin = window.CONFIG_ESC.REALCE_DISTANCIA_MIN_H || 10;
  const minRun = ancho * CONFIG.REALCE_MIN_RUN_H;
  let ultY = -9999;
  for (let y = y0 + 1; y < y1; y++) {
    if (y - ultY < distMin) continue;
    const fila = brillo[y];
    let min = 255, max = 0;
    for (let x = 0; x < ancho; x++) { const v = fila[x]; if (v < min) min = v; if (v > max) max = v; }
    if (max - min < (window.CONFIG_ESC.REALCE_CONTRASTE_MIN || 30)) continue;
    const umbral = min + (max - min) * factor;
    let run = 0, longest = 0, gap = 0;
    for (let x = 0; x < ancho; x++) {
      if (fila[x] < umbral) { run += gap + 1; gap = 0; if (run > longest) longest = run; }
      else { gap++; if (gap > gapMax) { run = 0; gap = 0; } }
    }
    if (longest >= minRun) { result.push(y); ultY = y; }
  }
  return result;
}

function rescateContinuidadH(brillo, ancho, y0, y1) {
  const result = [];
  const umbral = window.CONFIG_ESC.CONT_UMBRAL_OSCURO_H || 210;
  const ratioMin = CONFIG.CONT_RATIO_MIN_H;
  const runMin = ancho * CONFIG.CONT_RUN_MIN_H;
  const gapMax = window.CONFIG_ESC.CONT_GAP_MAX || 20;
  const distMin = window.CONFIG_ESC.CONT_DISTANCIA_MIN_H || 10;
  let ultY = -9999;
  for (let y = y0 + 1; y < y1; y++) {
    if (y - ultY < distMin) continue;
    const fila = brillo[y];
    let oscuros = 0, run = 0, longest = 0, gap = 0;
    for (let x = 0; x < ancho; x++) {
      if (fila[x] < umbral) { run += gap + 1; gap = 0; oscuros++; if (run > longest) longest = run; }
      else { gap++; if (gap > gapMax) { run = 0; gap = 0; } }
    }
    if (oscuros / ancho >= ratioMin && longest >= runMin) { result.push(y); ultY = y; }
  }
  return result;
}

function rescateOPENVH(brillo, ancho, y0, y1) {
  const result = [];
  const umbral = window.CONFIG_ESC.OPENV_UMBRAL_VALLE || 20;
  // Media local en la banda
  let suma = 0, count = 0;
  for (let y = y0; y < y1; y++) for (let x = 0; x < ancho; x++) { suma += brillo[y][x]; count++; }
  const media = suma / Math.max(1, count);
  const umbralOsc = media - umbral;
  const distMin = window.CONFIG_ESC.OPENV_DISTANCIA_MIN || 10;
  let ultY = -9999;
  for (let y = y0 + 1; y < y1; y++) {
    if (y - ultY < distMin) continue;
    const fila = brillo[y];
    let oscuros = 0;
    for (let x = 0; x < ancho; x++) if (fila[x] < umbralOsc) oscuros++;
    if (oscuros / ancho >= 0.35) { result.push(y); ultY = y; }
  }
  return result;
}

function rescateWSH(brillo, ancho, y0, y1) {
  const result = [];
  let suma = 0, count = 0;
  for (let y = y0; y < y1; y++) for (let x = 0; x < ancho; x++) { suma += brillo[y][x]; count++; }
  const media = suma / Math.max(1, count);
  const umbralBlanco = Math.max(media + 30, 210);
  const distMin = window.CONFIG_ESC.WS_DISTANCIA_MIN || 10;
  let ultY = -9999;
  for (let y = y0 + 1; y < y1; y++) {
    if (y - ultY < distMin) continue;
    const fila = brillo[y];
    let blancos = 0;
    for (let x = 0; x < ancho; x++) if (fila[x] > umbralBlanco) blancos++;
    if (blancos / ancho >= 0.55) { result.push(y); ultY = y; }
  }
  return result;
}

// ============ Algoritmos V (limitados a banda [x0, x1]) ============

function rescateRealceV(brillo, ancho, alto, x0, x1) {
  const result = [];
  const factor = CONFIG.REALCE_UMBRAL_FACTOR;
  const gapMax = window.CONFIG_ESC.REALCE_GAP_MAX || 20;
  const distMin = window.CONFIG_ESC.REALCE_DISTANCIA_MIN_V || 10;
  const minRun = alto * CONFIG.REALCE_MIN_RUN_V;
  let ultX = -9999;
  for (let x = x0 + 1; x < x1; x++) {
    if (x - ultX < distMin) continue;
    let min = 255, max = 0;
    for (let y = 0; y < alto; y++) { const v = brillo[y][x]; if (v < min) min = v; if (v > max) max = v; }
    if (max - min < (window.CONFIG_ESC.REALCE_CONTRASTE_MIN || 30)) continue;
    const umbral = min + (max - min) * factor;
    let run = 0, longest = 0, gap = 0;
    for (let y = 0; y < alto; y++) {
      if (brillo[y][x] < umbral) { run += gap + 1; gap = 0; if (run > longest) longest = run; }
      else { gap++; if (gap > gapMax) { run = 0; gap = 0; } }
    }
    if (longest >= minRun) { result.push(x); ultX = x; }
  }
  return result;
}

function rescateContinuidadV(brillo, ancho, alto, x0, x1) {
  const result = [];
  const umbral = window.CONFIG_ESC.CONT_UMBRAL_OSCURO_V || 225;
  const ratioMin = CONFIG.CONT_RATIO_MIN_V;
  const runMin = alto * CONFIG.CONT_RUN_MIN_V;
  const gapMax = window.CONFIG_ESC.CONT_GAP_MAX || 20;
  const distMin = window.CONFIG_ESC.CONT_DISTANCIA_MIN_V || 10;
  let ultX = -9999;
  for (let x = x0 + 1; x < x1; x++) {
    if (x - ultX < distMin) continue;
    let oscuros = 0, run = 0, longest = 0, gap = 0;
    for (let y = 0; y < alto; y++) {
      if (brillo[y][x] < umbral) { run += gap + 1; gap = 0; oscuros++; if (run > longest) longest = run; }
      else { gap++; if (gap > gapMax) { run = 0; gap = 0; } }
    }
    if (oscuros / alto >= ratioMin && longest >= runMin) { result.push(x); ultX = x; }
  }
  return result;
}

function rescateOPENVV(brillo, ancho, alto, x0, x1) {
  const result = [];
  const umbral = window.CONFIG_ESC.OPENV_UMBRAL_VALLE || 20;
  let suma = 0, count = 0;
  for (let y = 0; y < alto; y++) for (let x = x0; x < x1; x++) { suma += brillo[y][x]; count++; }
  const media = suma / Math.max(1, count);
  const umbralOsc = media - umbral;
  const distMin = window.CONFIG_ESC.OPENV_DISTANCIA_MIN || 10;
  let ultX = -9999;
  for (let x = x0 + 1; x < x1; x++) {
    if (x - ultX < distMin) continue;
    let oscuros = 0;
    for (let y = 0; y < alto; y++) if (brillo[y][x] < umbralOsc) oscuros++;
    if (oscuros / alto >= 0.35) { result.push(x); ultX = x; }
  }
  return result;
}

function rescateWSV(brillo, ancho, alto, x0, x1) {
  const result = [];
  let suma = 0, count = 0;
  for (let y = 0; y < alto; y++) for (let x = x0; x < x1; x++) { suma += brillo[y][x]; count++; }
  const media = suma / Math.max(1, count);
  const umbralBlanco = Math.max(media + 30, 210);
  const distMin = window.CONFIG_ESC.WS_DISTANCIA_MIN || 10;
  let ultX = -9999;
  for (let x = x0 + 1; x < x1; x++) {
    if (x - ultX < distMin) continue;
    let blancos = 0;
    for (let y = 0; y < alto; y++) if (brillo[y][x] > umbralBlanco) blancos++;
    if (blancos / alto >= 0.55) { result.push(x); ultX = x; }
  }
  return result;
}

// ============ Funcion principal ============

function detectarRescateZonas(brillo, ancho, alto, lineasBaseH, lineasBaseV, opciones) {
  const t0 = performance.now();
  opciones = opciones || {};
  const distHueco = opciones.distHueco || 60;
  const votosMin = opciones.votosMin || 2;
  const algos = opciones.algos || ['realce', 'continuidad', 'openv', 'ws'];

  const huecosH = detectarHuecos(lineasBaseH, distHueco);
  const huecosV = detectarHuecos(lineasBaseV, distHueco);

  console.log('[Zonas] Huecos H=' + huecosH.length + ' V=' + huecosV.length + ' (dist>' + distHueco + 'px)');

  const nuevasH = [];
  const nuevasV = [];

  // Rescatar H en cada hueco horizontal
  for (let i = 0; i < huecosH.length; i++) {
    const h = huecosH[i];
    const votos = contarVotosH(brillo, ancho, h.y0, h.y1, algos);
    Object.keys(votos).forEach(function(y) {
      if (votos[y] >= votosMin) {
        nuevasH.push(parseInt(y));
        console.log('  [Zonas] H rescatada en y=' + y + ' (' + votos[y] + ' algoritmos)');
      }
    });
  }

  // Rescatar V en cada hueco vertical
  for (let i = 0; i < huecosV.length; i++) {
    const h = huecosV[i];
    const votos = contarVotosV(brillo, ancho, alto, h.y0, h.y1, algos);
    Object.keys(votos).forEach(function(x) {
      if (votos[x] >= votosMin) {
        nuevasV.push(parseInt(x));
        console.log('  [Zonas] V rescatada en x=' + x + ' (' + votos[x] + ' algoritmos)');
      }
    });
  }

  const t1 = performance.now();
  console.log('[Zonas] Rescatadas: H=' + nuevasH.length + ' V=' + nuevasV.length + ' (' + (t1-t0).toFixed(0) + 'ms)');

  return { nuevasH: nuevasH, nuevasV: nuevasV, huecosH: huecosH, huecosV: huecosV, tiempo: t1-t0 };
}

console.log('core/rescate_zonas.js cargado');
