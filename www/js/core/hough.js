// ==============================================
// core/hough.js
// Algoritmo 13: Transformada de Hough probabilistica
// Detecta lineas rectas aunque esten rotas en trozos.
// ==============================================

function detectarHough(brillo, ancho, alto) {
  const t0 = performance.now();

  // 1. Calcular bordes con Sobel simple
  const borde = [];
  for (let y = 0; y < alto; y++) {
    borde.push(new Uint8Array(ancho));
  }
  const umbralBorde = window.CONFIG_ESC.HOUGH_UMBRAL_BORDE || 60;
  for (let y = 1; y < alto - 1; y++) {
    for (let x = 1; x < ancho - 1; x++) {
      const gx = -brillo[y-1][x-1] + brillo[y-1][x+1]
                -2*brillo[y][x-1] + 2*brillo[y][x+1]
                -brillo[y+1][x-1] + brillo[y+1][x+1];
      const gy = -brillo[y-1][x-1] - 2*brillo[y-1][x] - brillo[y-1][x+1]
                +brillo[y+1][x-1] + 2*brillo[y+1][x] + brillo[y+1][x+1];
      const mag = Math.sqrt(gx*gx + gy*gy);
      if (mag > umbralBorde) borde[y][x] = 1;
    }
  }

  // 2. Hough simplificado: solo H (angulo=0) y V (angulo=90)
  const acumH = new Int32Array(alto);
  const acumV = new Int32Array(ancho);

  for (let y = 0; y < alto; y++) {
    let sumaFila = 0;
    for (let x = 0; x < ancho; x++) sumaFila += borde[y][x];
    acumH[y] = sumaFila;
  }
  for (let x = 0; x < ancho; x++) {
    let sumaCol = 0;
    for (let y = 0; y < alto; y++) sumaCol += borde[y][x];
    acumV[x] = sumaCol;
  }

  // 3. Filtrar picos con umbral adaptativo
  const umbralH = Math.round(ancho * (CONFIG.HOUGH_UMBRAL_H || 0.15));
  const umbralV = Math.round(alto * (CONFIG.HOUGH_UMBRAL_V || 0.15));
  const distH = window.CONFIG_ESC.HOUGH_DISTANCIA_H || 15;
  const distV = window.CONFIG_ESC.HOUGH_DISTANCIA_V || 15;

  const lineasH = [];
  let ultH = -9999;
  for (let y = 2; y < alto - 2; y++) {
    if (acumH[y] >= umbralH && acumH[y] > acumH[y-1] && acumH[y] >= acumH[y+1] && y - ultH >= distH) {
      lineasH.push(y);
      ultH = y;
    }
  }
  const lineasV = [];
  let ultV = -9999;
  for (let x = 2; x < ancho - 2; x++) {
    if (acumV[x] >= umbralV && acumV[x] > acumV[x-1] && acumV[x] >= acumV[x+1] && x - ultV >= distV) {
      lineasV.push(x);
      ultV = x;
    }
  }

  const t1 = performance.now();
  console.log('[Hough] H=' + lineasH.length + ' V=' + lineasV.length + ' (' + (t1-t0).toFixed(0) + 'ms)');
  return { lineasH, lineasV, tiempo: t1-t0 };
}

console.log('core/hough.js cargado');
