// ==============================================
// core/continuidad.js
// Algoritmo 6: Continuidad
// Detecta lineas por píxeles oscuros CONSECUTIVOS.
// Una linea real tiene >80% de píxeles oscuros en toda la fila/columna.
// Un texto tiene espacios blancos entre palabras -> NO pasa el filtro.
// ==============================================

function detectarContinuidad(brillo, ancho, alto) {
  const t0 = performance.now();

  const gapMax = window.CONFIG_ESC.CONT_GAP_MAX;

  // H: parametros H
  const umbralH = window.CONFIG_ESC.CONT_UMBRAL_OSCURO_H;
  const ratioMinH = CONFIG.CONT_RATIO_MIN_H;
  const runMinH = ancho * CONFIG.CONT_RUN_MIN_H;
  const distMinH = window.CONFIG_ESC.CONT_DISTANCIA_MIN_H;

  // V: parametros V
  const umbralV = window.CONFIG_ESC.CONT_UMBRAL_OSCURO_V;
  const ratioMinV = CONFIG.CONT_RATIO_MIN_V;
  const runMinV = alto * CONFIG.CONT_RUN_MIN_V;
  const distMinV = window.CONFIG_ESC.CONT_DISTANCIA_MIN_V;

  // ============ HORIZONTALES ============
  const hCandidatas = [];
  for (let y = 0; y < alto; y++) {
    let oscuros = 0;
    let runActual = 0;
    let runMax = 0;
    let gap = 0;
    const fila = brillo[y];
    for (let x = 0; x < ancho; x++) {
      if (fila[x] < umbralH) {
        runActual += gap + 1;
        gap = 0;
        oscuros++;
        if (runActual > runMax) runMax = runActual;
      } else {
        gap++;
        if (gap > gapMax) { runActual = 0; gap = 0; }
      }
    }
    const ratio = oscuros / ancho;
    if (ratio >= ratioMinH && runMax >= runMinH) {
      hCandidatas.push({ pos: y, ratio: ratio, run: runMax, score: ratio + runMax / ancho });
    }
  }

  // ============ VERTICALES ============
  const vCandidatas = [];
  for (let x = 0; x < ancho; x++) {
    let oscuros = 0;
    let runActual = 0;
    let runMax = 0;
    let gap = 0;
    for (let y = 0; y < alto; y++) {
      if (brillo[y][x] < umbralV) {
        runActual += gap + 1;
        gap = 0;
        oscuros++;
        if (runActual > runMax) runMax = runActual;
      } else {
        gap++;
        if (gap > gapMax) { runActual = 0; gap = 0; }
      }
    }
    const ratio = oscuros / alto;
    if (ratio >= ratioMinV && runMax >= runMinV) {
      vCandidatas.push({ pos: x, ratio: ratio, run: runMax, score: ratio + runMax / alto });
    }
  }

  // Filtrar grupos contiguos (líneas gruesas = 2-3 filas juntas)
  const lineasH = filtrarGruposContiguos(hCandidatas, distMinH).map(function(c) { return c.pos; });
  const lineasV = filtrarGruposContiguos(vCandidatas, distMinV).map(function(c) { return c.pos; });

  const t1 = performance.now();
  console.log('[Continuidad] H=' + lineasH.length + ' V=' + lineasV.length + ' (' + (t1-t0).toFixed(0) + 'ms)');

  return { lineasH: lineasH, lineasV: lineasV, tiempo: t1-t0 };
}

function filtrarGruposContiguos(candidatas, distMin) {
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

  // De cada grupo, elegir el de mayor score
  return grupos.map(function(g) {
    return g.reduce(function(best, c) { return c.score > best.score ? c : best; });
  });
}

console.log('core/continuidad.js cargado');
