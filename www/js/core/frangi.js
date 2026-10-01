// Algoritmo: Frangi - Vesselness Filter
// Filtro de vasculatura para detectar lineas finas/rotas.
function gaussianBlur2D(brillo, ancho, alto, sigma) {
  const radio = Math.max(1, Math.ceil(sigma * 3));
  const kernel = [];
  let suma = 0;
  for (let i = -radio; i <= radio; i++) {
    const v = Math.exp(-i*i / (2*sigma*sigma));
    kernel.push(v); suma += v;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= suma;

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
  const res = new Array(alto);
  for (let y = 0; y < alto; y++) {
    res[y] = new Array(ancho);
    for (let x = 0; x < ancho; x++) {
      let s = 0;
      for (let k = -radio; k <= radio; k++) {
        const yy = Math.max(0, Math.min(alto - 1, y + k));
        s += temp[yy][x] * kernel[k + radio];
      }
      res[y][x] = s;
    }
  }
  return res;
}

function detectarFrangi(brillo, ancho, alto) {
  const t0 = performance.now();
  const sigma = CONFIG.FRANGI_SIGMA || 2.5;
  const beta = CONFIG.FRANGI_BETA || 0.5;
  const beta2 = 2 * beta * beta;
  const distMin = window.CONFIG_ESC.FRANGI_DISTANCIA_MIN || 10;

  const suave = gaussianBlur2D(brillo, ancho, alto, sigma);

  const perfilH = new Array(alto).fill(0);
  const perfilV = new Array(ancho).fill(0);

  // Primera pasada: max S
  let maxS = 1;
  const Ss = [];
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

  const c = maxS * (CONFIG.FRANGI_C_FACTOR || 0.5);
  const c2 = 2 * c * c;

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
      if (l2 <= 0) continue;

      const absL1 = Math.abs(l1);
      const absL2 = Math.abs(l2);
      if (absL2 < 1) continue;

      const Rb = absL1 / absL2;
      const v = Math.exp(-Rb*Rb / beta2) * (1 - Math.exp(-S*S / c2));
      if (v < 0.05) continue;

      let vx, vy;
      if (Math.abs(gxy) > 1e-6) { vx = -gxy; vy = gxx - l1; }
      else { if (Math.abs(gxx - l1) < Math.abs(gyy - l1)) { vx = 1; vy = 0; } else { vx = 0; vy = 1; } }
      const norm = Math.sqrt(vx*vx + vy*vy);
      if (norm < 1e-6) continue;
      vx /= norm; vy /= norm;

      const peso = v * absL2;
      if (Math.abs(vy) > Math.abs(vx)) perfilV[x] += peso;
      else perfilH[y] += peso;
    }
  }

  for (let y = 0; y < alto; y++) perfilH[y] /= ancho;
  for (let x = 0; x < ancho; x++) perfilV[x] /= alto;

  const pH = suavizar(perfilH, 2);
  const pV = suavizar(perfilV, 2);

  const umbralH = medianaTop30(pH) * 0.4;
  const umbralV = medianaTop30(pV) * 0.4;

  const lineasH = buscarPicos(pH, umbralH, distMin, 3);
  const lineasV = buscarPicos(pV, umbralV, distMin, 3);

  const t1 = performance.now();
  console.log('[Frangi] H=' + lineasH.length + ' V=' + lineasV.length + ' (' + (t1-t0).toFixed(0) + 'ms)');
  return { lineasH, lineasV, tiempo: t1-t0 };
}

function medianaTop30(perfil) {
  const c = perfil.slice().sort(function(a, b) { return b - a; });
  const N = Math.min(30, c.length);
  const top = c.slice(0, N);
  return top[Math.floor(top.length / 2)] || 1;
}
console.log('core/frangi.js cargado');
