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
  const pH_suav = suavizar(pH, window.CONFIG_ESC.OPTICA_SUAVIZADO);
  const pV_suav = suavizar(pV, window.CONFIG_ESC.OPTICA_SUAVIZADO);

  // DIST_MIN adaptativo por imagen
  const distH = calcularDistanciaAdaptativa(pH_suav, CONFIG.OPTICA_UMBRAL_ADAPTATIVO);
  const distV = calcularDistanciaAdaptativa(pV_suav, CONFIG.OPTICA_UMBRAL_ADAPTATIVO);

  // Detectar valles (lineas oscuras)
  const lineasH = buscarValles(pH_suav, distH, CONFIG.OPTICA_UMBRAL_ADAPTATIVO);
  const lineasV = buscarValles(pV_suav, distV, CONFIG.OPTICA_UMBRAL_ADAPTATIVO);

  const t1 = performance.now();
  console.log('[Optica] H=' + lineasH.length + ' V=' + lineasV.length + ' en ' + (t1-t0).toFixed(0) + 'ms');

  const longitudesH = medirLongitudes(lineasH, true, brillo, ancho, alto, window.CONFIG_ESC.CONT_UMBRAL_OSCURO_H);
  const longitudesV = medirLongitudes(lineasV, false, brillo, ancho, alto, window.CONFIG_ESC.CONT_UMBRAL_OSCURO_V);
  return { lineasH, lineasV, longitudesH, longitudesV, pH: pH_suav, pV: pV_suav, tiempo: t1-t0 };
}

console.log('core/optica.js cargado');
