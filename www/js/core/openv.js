// Algoritmo: OPENV - Opening Vertical morfologico
// Detecta columnas con runs largos de pixeles oscuros (opening vertical).
function detectarOPENV(brillo, ancho, alto) {
  const t0 = performance.now();

  // Calcular media global
  let suma = 0, count = 0;
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) { suma += brillo[y][x]; count++; }
  }
  const media = suma / count;
  const umbralDif = (window.CONFIG_ESC.OPENV_UMBRAL_VALLE) || 15;
  const umbralOscuro = media - umbralDif;
  const distMin = window.CONFIG_ESC.OPENV_DISTANCIA_MIN || 10;

  // Perfil V: por cada columna, fraccion de pixeles oscuros
  const perfilV = new Array(ancho).fill(0);
  for (let x = 0; x < ancho; x++) {
    let oscuros = 0;
    for (let y = 0; y < alto; y++) {
      if (brillo[y][x] < umbralOscuro) oscuros++;
    }
    perfilV[x] = oscuros / alto;
  }
  // Perfil H
  const perfilH = new Array(alto).fill(0);
  for (let y = 0; y < alto; y++) {
    let oscuros = 0;
    for (let x = 0; x < ancho; x++) {
      if (brillo[y][x] < umbralOscuro) oscuros++;
    }
    perfilH[y] = oscuros / ancho;
  }

  const pV = suavizar(perfilV, 2);
  const pH = suavizar(perfilH, 2);

  const lineasV = buscarPicos(pV, 0.35, distMin, 3);
  const lineasH = buscarPicos(pH, 0.35, distMin, 3);

  const t1 = performance.now();
  console.log('[OPENV] H=' + lineasH.length + ' V=' + lineasV.length + ' (' + (t1-t0).toFixed(0) + 'ms)');
  return { lineasH, lineasV, tiempo: t1-t0 };
}
console.log('core/openv.js cargado');
