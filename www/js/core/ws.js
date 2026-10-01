// Algoritmo: WS - Whitespace
// Detecta columnas/filas donde el brillo es muy alto (espacios blancos entre celdas).
function detectarWS(brillo, ancho, alto) {
  const t0 = performance.now();
  const distMin = window.CONFIG_ESC.WS_DISTANCIA_MIN || 8;

  let suma = 0, count = 0;
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) { suma += brillo[y][x]; count++; }
  }
  const media = suma / count;
  const umbralBlanco = Math.max(media + 25, 200);

  const perfilV = new Array(ancho).fill(0);
  for (let x = 0; x < ancho; x++) {
    let blancos = 0;
    for (let y = 0; y < alto; y++) {
      if (brillo[y][x] > umbralBlanco) blancos++;
    }
    perfilV[x] = blancos / alto;
  }
  const perfilH = new Array(alto).fill(0);
  for (let y = 0; y < alto; y++) {
    let blancos = 0;
    for (let x = 0; x < ancho; x++) {
      if (brillo[y][x] > umbralBlanco) blancos++;
    }
    perfilH[y] = blancos / ancho;
  }

  const pV = suavizar(perfilV, 2);
  const pH = suavizar(perfilH, 2);

  const lineasV = buscarPicos(pV, 0.55, distMin, 3);
  const lineasH = buscarPicos(pH, 0.55, distMin, 3);

  const t1 = performance.now();
  console.log('[WS] H=' + lineasH.length + ' V=' + lineasV.length + ' (' + (t1-t0).toFixed(0) + 'ms)');
  return { lineasH, lineasV, tiempo: t1-t0 };
}
console.log('core/ws.js cargado');
