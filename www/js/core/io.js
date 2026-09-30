// ==============================================
// core/io.js
// Algoritmo 5: IO (Interseccion Ortogonal)
// Toma H y V candidatas de Optica. Confirma una V si cruza suficientes H (y viceversa).
// ==============================================

function detectarIO(brillo, ancho, alto, opticaH, opticaV) {
  const t0 = performance.now();

  const ventana = window.CONFIG_ESC.IO_VENTANA_CRUCE;
  const umbral = window.CONFIG_ESC.IO_UMBRAL_CRUCE;
  const crucesMin = CONFIG.IO_CRUCES_MIN;

  const scoreV = new Array(opticaV.length).fill(0);
  const scoreH = new Array(opticaH.length).fill(0);

  for (let vi = 0; vi < opticaV.length; vi++) {
    const x = opticaV[vi];
    if (x < ventana || x >= ancho - ventana) continue;

    for (let hi = 0; hi < opticaH.length; hi++) {
      const y = opticaH[hi];
      if (y < ventana || y >= alto - ventana) continue;

      // Centro oscuro
      if (brillo[y][x] > umbral) continue;

      // Vecinos horizontales oscuros
      let horizOk = 0;
      for (let dx = -ventana; dx <= ventana; dx++) {
        if (dx === 0) continue;
        if (brillo[y][x + dx] <= umbral) horizOk++;
      }
      // Vecinos verticales oscuros
      let vertOk = 0;
      for (let dy = -ventana; dy <= ventana; dy++) {
        if (dy === 0) continue;
        if (brillo[y + dy][x] <= umbral) vertOk++;
      }

      if (horizOk >= 2 && vertOk >= 2) {
        scoreV[vi]++;
        scoreH[hi]++;
      }
    }
  }

  const vAceptadas = [];
  for (let vi = 0; vi < opticaV.length; vi++) {
    if (scoreV[vi] >= crucesMin) vAceptadas.push(opticaV[vi]);
  }
  const hAceptadas = [];
  for (let hi = 0; hi < opticaH.length; hi++) {
    if (scoreH[hi] >= crucesMin) hAceptadas.push(opticaH[hi]);
  }

  const t1 = performance.now();
  console.log('[IO] V=' + vAceptadas.length + ' H=' + hAceptadas.length + ' en ' + (t1-t0).toFixed(0) + 'ms');

  return { lineasH: hAceptadas, lineasV: vAceptadas, tiempo: t1-t0 };
}

console.log('core/io.js cargado');
