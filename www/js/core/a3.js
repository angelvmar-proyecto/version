// ==============================================
// core/a3.js
// Algoritmo 3: A3 (Sobel ortogonal)
// Detecta lineas con alta ortogonalidad al gradiente.
// ==============================================

function detectarA3(brillo, ancho, alto) {
  const t0 = performance.now();

  // Perfiles de magnitud ortogonal
  const perfilH = new Array(alto).fill(0);  // gradiente vertical alto = linea H
  const perfilV = new Array(ancho).fill(0); // gradiente horizontal alto = linea V

  for (let y = 1; y < alto - 1; y++) {
    for (let x = 1; x < ancho - 1; x++) {
      // Sobel X
      const gx =
        -1 * brillo[y-1][x-1] + 1 * brillo[y-1][x+1] +
        -2 * brillo[y][x-1]   + 2 * brillo[y][x+1] +
        -1 * brillo[y+1][x-1] + 1 * brillo[y+1][x+1];
      // Sobel Y
      const gy =
        -1 * brillo[y-1][x-1] - 2 * brillo[y-1][x] - 1 * brillo[y-1][x+1] +
         1 * brillo[y+1][x-1] + 2 * brillo[y+1][x] + 1 * brillo[y+1][x+1];

      const mag = Math.sqrt(gx*gx + gy*gy);
      if (mag < window.CONFIG_ESC.A3_UMBRAL_MAGNITUD) continue;

      const suma = Math.abs(gx) + Math.abs(gy) + 0.001;
      const ortV = Math.abs(gx) / suma; // ortogonal a gradiente horizontal
      const ortH = Math.abs(gy) / suma; // ortogonal a gradiente vertical

      if (ortV > CONFIG.A3_UMBRAL_ORTOGONALIDAD) perfilV[x] += mag * ortV;
      if (ortH > CONFIG.A3_UMBRAL_ORTOGONALIDAD) perfilH[y] += mag * ortH;
    }
  }

  // Normalizar
  for (let y = 0; y < alto; y++) perfilH[y] /= ancho;
  for (let x = 0; x < ancho; x++) perfilV[x] /= alto;

  // Suavizar
  const pH = suavizar(perfilH, 3);
  const pV = suavizar(perfilV, 3);

  // Umbrales adaptativos (top 30)
  const umbralH = medianaTop30(pH) * 0.5;
  const umbralV = medianaTop30(pV) * 0.5;

  // Buscar picos
  const lineasH = buscarPicos(pH, umbralH, window.CONFIG_ESC.A3_DISTANCIA_MIN, 3);
  const lineasV = buscarPicos(pV, umbralV, window.CONFIG_ESC.A3_DISTANCIA_MIN, 3);

  const t1 = performance.now();
  console.log('[A3] H=' + lineasH.length + ' V=' + lineasV.length + ' en ' + (t1-t0).toFixed(0) + 'ms');

  return { lineasH, lineasV, tiempo: t1-t0 };
}

function medianaTop30(perfil) {
  const copia = perfil.slice().sort(function(a, b) { return b - a; });
  const N = Math.min(30, copia.length);
  const top = copia.slice(0, N);
  return top[Math.floor(top.length / 2)];
}

console.log('core/a3.js cargado');
