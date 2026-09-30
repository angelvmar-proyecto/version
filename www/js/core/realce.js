// ==============================================
// core/realce.js
// Algoritmo 7: Realce (umbral adaptativo)
// Inspirado en Black-Hat morfologico pero adaptado:
// cada fila/columna calcula su propio umbral segun su contraste local.
// Captura lineas difusas con intensidad variable.
// ==============================================

function detectarRealce(brillo, ancho, alto) {
  const t0 = performance.now();

  const contrasteMin = window.CONFIG_ESC.REALCE_CONTRASTE_MIN;
  const factor = CONFIG.REALCE_UMBRAL_FACTOR;
  const gapMax = window.CONFIG_ESC.REALCE_GAP_MAX;
  const distMinH = window.CONFIG_ESC.REALCE_DISTANCIA_MIN_H;
  const distMinV = window.CONFIG_ESC.REALCE_DISTANCIA_MIN_V;
  const minRunH = ancho * CONFIG.REALCE_MIN_RUN_H;
  const minRunV = alto * CONFIG.REALCE_MIN_RUN_V;

  // ============ HORIZONTALES ============
  const hCandidatas = [];
  for (let y = 0; y < alto; y++) {
    const fila = brillo[y];
    let min = 255, max = 0;
    for (let x = 0; x < ancho; x++) {
      const v = fila[x];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const contraste = max - min;
    if (contraste < contrasteMin) continue;

    const umbral = min + (max - min) * factor;

    let currentRun = 0;
    let longestRun = 0;
    let gap = 0;
    let oscuros = 0;
    for (let x = 0; x < ancho; x++) {
      if (fila[x] < umbral) {
        currentRun += gap + 1;
        gap = 0;
        oscuros++;
        if (currentRun > longestRun) longestRun = currentRun;
      } else {
        gap++;
        if (gap > gapMax) { currentRun = 0; gap = 0; }
      }
    }
    if (longestRun >= minRunH) {
      const ratio = oscuros / ancho;
      hCandidatas.push({ pos: y, run: longestRun, ratio: ratio, score: ratio + longestRun / ancho });
    }
  }

  // ============ VERTICALES ============
  const vCandidatas = [];
  for (let x = 0; x < ancho; x++) {
    let min = 255, max = 0;
    for (let y = 0; y < alto; y++) {
      const v = brillo[y][x];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const contraste = max - min;
    if (contraste < contrasteMin) continue;

    const umbral = min + (max - min) * factor;

    let currentRun = 0;
    let longestRun = 0;
    let gap = 0;
    let oscuros = 0;
    for (let y = 0; y < alto; y++) {
      if (brillo[y][x] < umbral) {
        currentRun += gap + 1;
        gap = 0;
        oscuros++;
        if (currentRun > longestRun) longestRun = currentRun;
      } else {
        gap++;
        if (gap > gapMax) { currentRun = 0; gap = 0; }
      }
    }
    if (longestRun >= minRunV) {
      const ratio = oscuros / alto;
      vCandidatas.push({ pos: x, run: longestRun, ratio: ratio, score: ratio + longestRun / alto });
    }
  }

  // Filtrar grupos contiguos
  const lineasH = filtrarGruposRealce(hCandidatas, distMinH).map(function(c) { return c.pos; });
  const lineasV = filtrarGruposRealce(vCandidatas, distMinV).map(function(c) { return c.pos; });

  const t1 = performance.now();
  console.log('[Realce] H=' + lineasH.length + ' V=' + lineasV.length + ' (' + (t1-t0).toFixed(0) + 'ms)');

  return { lineasH: lineasH, lineasV: lineasV, tiempo: t1-t0 };
}

function filtrarGruposRealce(candidatas, distMin) {
  if (candidatas.length === 0) return [];
  const ordenadas = candidatas.slice().sort(function(a, b) { return a.pos - b.pos; });

  const grupos = [];
  let grupo = [ordenadas[0]];
  for (let i = 1; i < ordenadas.length; i++) {
    if (ordenadas[i].pos - grupo[grupo.length - 1].pos <= distMin) {
      grupo.push(ordenadas[i]);
    } else {
      grupos.push(grupo);
      grupo = [ordenadas[i]];
    }
  }
  grupos.push(grupo);

  return grupos.map(function(g) {
    return g.reduce(function(best, c) { return c.score > best.score ? c : best; });
  });
}

console.log('core/realce.js cargado');
