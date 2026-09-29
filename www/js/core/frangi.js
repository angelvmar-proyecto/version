// ==============================================
// core/frangi.js
// Algoritmo 6: Frangi Vesselness Filter
// Detecta lineas tenues/rotas usando matriz Hessiana multiescala.
// Inspirado en deteccion de vasos sanguineos en microscopia.
// ==============================================

/**
 * Gaussian blur 2D separable (para suavizar antes de derivadas).
 */
function gaussianBlur2D(brillo, ancho, alto, sigma) {
  const radio = Math.max(1, Math.ceil(sigma * 3));
  const kernel = [];
  let suma = 0;
  for (let i = -radio; i <= radio; i++) {
    const v = Math.exp(-i * i / (2 * sigma * sigma));
    kernel.push(v);
    suma += v;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= suma;

  // Horizontal
  const temp = new Array(alto);
  for (let y = 0; y < alto; y++) {
    temp[y] = new Array(ancho);
    for (let x = 0; x < ancho; x++) {
      let s = 0;
      for (let k = -radio; k <= radio; k++) {
        const xx = Math.max(0, Math.min(ancho - 1, x + k));
        s += brillo[y][xx] * kernel[k + radio];
      }
      temp[y][x] = s;
    }
  }

  // Vertical
  const resultado = new Array(alto);
  for (let y = 0; y < alto; y++) {
    resultado[y] = new Array(ancho);
    for (let x = 0; x < ancho; x++) {
      let s = 0;
      for (let k = -radio; k <= radio; k++) {
        const yy = Math.max(0, Math.min(alto - 1, y + k));
        s += temp[yy][x] * kernel[k + radio];
      }
      resultado[y][x] = s;
    }
  }
  return resultado;
}

function detectarFrangi(brillo, ancho, alto) {
  const t0 = performance.now();

  const sigma = CONFIG.FRANGI_SIGMA;
  const beta = CONFIG.FRANGI_BETA;
  const beta2 = 2 * beta * beta;

  // Suavizar imagen (Gaussiana)
  const suave = gaussianBlur2D(brillo, ancho, alto, sigma);

  // Acumuladores (perfil H y V con "cuanto aporta cada fila/columna")
  const perfilH = new Array(alto).fill(0);
  const perfilV = new Array(ancho).fill(0);

  // Primera pasada: calcular estructura maxima S para normalizar
  let maxS = 1;
  const Ss = new Array((alto - 2) * (ancho - 2));
  let idx = 0;

  for (let y = 1; y < alto - 1; y++) {
    for (let x = 1; x < ancho - 1; x++) {
      const gxx = suave[y][x-1] - 2*suave[y][x] + suave[y][x+1];
      const gyy = suave[y-1][x] - 2*suave[y][x] + suave[y+1][x];
      const gxy = (suave[y-1][x-1] - suave[y-1][x+1] - suave[y+1][x-1] + suave[y+1][x+1]) / 4;

      const trace = gxx + gyy;
      const det = gxx * gyy - gxy * gxy;
      const disc2 = trace*trace/4 - det;
      if (disc2 < 0) { Ss[idx++] = 0; continue; }
      const disc = Math.sqrt(disc2);

      let l1 = trace/2 - disc;
      let l2 = trace/2 + disc;
      if (Math.abs(l1) > Math.abs(l2)) { const tmp = l1; l1 = l2; l2 = tmp; }

      const S = Math.sqrt(l1*l1 + l2*l2);
      Ss[idx++] = S;
      if (S > maxS) maxS = S;
    }
  }

  const c = maxS * CONFIG.FRANGI_C_FACTOR;
  const c2 = 2 * c * c;

  // Segunda pasada: calcular vesselness y acumular
  idx = 0;
  for (let y = 1; y < alto - 1; y++) {
    for (let x = 1; x < ancho - 1; x++) {
      const S = Ss[idx++];
      if (S < 1) continue;

      const gxx = suave[y][x-1] - 2*suave[y][x] + suave[y][x+1];
      const gyy = suave[y-1][x] - 2*suave[y][x] + suave[y+1][x];
      const gxy = (suave[y-1][x-1] - suave[y-1][x+1] - suave[y+1][x-1] + suave[y+1][x+1]) / 4;

      const trace = gxx + gyy;
      const det = gxx * gyy - gxy * gxy;
      const disc2 = trace*trace/4 - det;
      if (disc2 < 0) continue;
      const disc = Math.sqrt(disc2);

      let l1 = trace/2 - disc;
      let l2 = trace/2 + disc;
      if (Math.abs(l1) > Math.abs(l2)) { const tmp = l1; l1 = l2; l2 = tmp; }

      // Para linea oscura sobre fondo claro: l2 > 0 (minimo en direccion perpendicular)
      if (l2 <= 0) continue;

      const absL1 = Math.abs(l1);
      const absL2 = Math.abs(l2);
      if (absL2 < 1) continue;

      const Rb = absL1 / absL2;
      const Rb2 = Rb * Rb;

      // Vesselness Frangi
      const v = Math.exp(-Rb2 / beta2) * (1 - Math.exp(-S*S / c2));
      if (v < 0.05) continue;

      // Direccion del eigenvector asociado a l1 (linea larga, direccion de la cresta)
      let vx, vy;
      if (Math.abs(gxy) > 1e-6) {
        vx = -gxy;
        vy = gxx - l1;
      } else {
        if (Math.abs(gxx - l1) < Math.abs(gyy - l1)) { vx = 1; vy = 0; }
        else { vx = 0; vy = 1; }
      }
      const norm = Math.sqrt(vx*vx + vy*vy);
      if (norm < 1e-6) continue;
      vx /= norm; vy /= norm;

      // |vy| > |vx| → linea vertical → aporta a perfilV en columna x
      // |vx| > |vy| → linea horizontal → aporta a perfilH en fila y
      const peso = v * absL2;
      if (Math.abs(vy) > Math.abs(vx)) {
        perfilV[x] += peso;
      } else {
        perfilH[y] += peso;
      }
    }
  }

  // Normalizar
  for (let y = 0; y < alto; y++) perfilH[y] /= ancho;
  for (let x = 0; x < ancho; x++) perfilV[x] /= alto;

  // Suavizar
  const pH = suavizar(perfilH, 2);
  const pV = suavizar(perfilV, 2);

  // Umbrales adaptativos
  const umbralH = medianaTop30(pH) * 0.4;
  const umbralV = medianaTop30(pV) * 0.4;

  // Buscar picos
  const lineasH = buscarPicos(pH, umbralH, window.CONFIG_ESC.FRANGI_DISTANCIA_MIN, 3);
  const lineasV = buscarPicos(pV, umbralV, window.CONFIG_ESC.FRANGI_DISTANCIA_MIN, 3);

  const t1 = performance.now();
  console.log('[Frangi] H=' + lineasH.length + ' V=' + lineasV.length + ' en ' + (t1-t0).toFixed(0) + 'ms');

  return { lineasH, lineasV, tiempo: t1-t0 };
}

console.log('core/frangi.js cargado');
