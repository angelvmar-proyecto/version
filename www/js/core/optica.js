// ==============================================
// core/optica.js
// Algoritmo 1: Optica (proyeccion de brillo con suavizado)
// Detecta valles en los perfiles H y V.
// ==============================================

function detectarOptica(brillo, ancho, alto) {
  const t0 = performance.now();

  // Perfiles base
  const pH = perfilH(brillo, alto, ancho);
  const pV = perfilV(brillo, alto, ancho);

  // Suavizado
  const pH_suav = suavizar(pH, CONFIG_ESC.OPTICA_SUAVIZADO);
  const pV_suav = suavizar(pV, CONFIG_ESC.OPTICA_SUAVIZADO);

  // Detectar valles (lineas oscuras)
  const lineasH = buscarValles(pH_suav, CONFIG_ESC.OPTICA_DISTANCIA_MIN_H, CONFIG.OPTICA_UMBRAL_ADAPTATIVO);
  const lineasV = buscarValles(pV_suav, CONFIG_ESC.OPTICA_DISTANCIA_MIN_V, CONFIG.OPTICA_UMBRAL_ADAPTATIVO);

  const t1 = performance.now();
  console.log('[Optica] H=' + lineasH.length + ' V=' + lineasV.length + ' en ' + (t1-t0).toFixed(0) + 'ms');

  return { lineasH, lineasV, pH: pH_suav, pV: pV_suav, tiempo: t1-t0 };
}

console.log('core/optica.js cargado');
