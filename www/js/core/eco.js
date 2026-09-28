// ==============================================
// core/eco.js
// Algoritmo 2: Eco (cambio de brillo)
// Mide la diferencia maxima de brillo en ventana V.
// Usa busqueda de pico real (no primer cruce).
// ==============================================

function detectarEco(brillo, ancho, alto) {
  const t0 = performance.now();
  const V = CONFIG.ECO_VENTANA;

  // Perfil eco H: para cada y, cambio maximo vertical promedio
  const ecoH = new Array(alto).fill(0);
  for (let y = 0; y < alto; y++) {
    let suma = 0;
    const v0 = Math.max(0, y - V);
    const v1 = Math.min(alto - 1, y + V);
    for (let x = 0; x < ancho; x++) {
      let maxDif = 0;
      for (let yy = v0; yy <= v1; yy++) {
        const dif = Math.abs(brillo[y][x] - brillo[yy][x]);
        if (dif > maxDif) maxDif = dif;
      }
      suma += maxDif;
    }
    ecoH[y] = suma / ancho;
  }

  // Perfil eco V: para cada x, cambio maximo horizontal promedio
  const ecoV = new Array(ancho).fill(0);
  for (let x = 0; x < ancho; x++) {
    let suma = 0;
    const h0 = Math.max(0, x - V);
    const h1 = Math.min(ancho - 1, x + V);
    for (let y = 0; y < alto; y++) {
      let maxDif = 0;
      for (let xx = h0; xx <= h1; xx++) {
        const dif = Math.abs(brillo[y][x] - brillo[y][xx]);
        if (dif > maxDif) maxDif = dif;
      }
      suma += maxDif;
    }
    ecoV[x] = suma / alto;
  }

  // Suavizar los perfiles eco
  const ecoH_suav = suavizar(ecoH, V);
  const ecoV_suav = suavizar(ecoV, V);

  // Buscar picos (lineas = cambio de brillo alto)
  const rangoPico = Math.max(2, V);
  const lineasH = buscarPicos(ecoH_suav, CONFIG.ECO_UMBRAL_H, window.CONFIG_ESC.ECO_DISTANCIA_MIN_H, rangoPico);
  const lineasV = buscarPicos(ecoV_suav, CONFIG.ECO_UMBRAL_V, window.CONFIG_ESC.ECO_DISTANCIA_MIN_V, rangoPico);

  const t1 = performance.now();
  console.log('[Eco] H=' + lineasH.length + ' V=' + lineasV.length + ' en ' + (t1-t0).toFixed(0) + 'ms');

  return { lineasH, lineasV, ecoH: ecoH_suav, ecoV: ecoV_suav, tiempo: t1-t0 };
}

console.log('core/eco.js cargado');
