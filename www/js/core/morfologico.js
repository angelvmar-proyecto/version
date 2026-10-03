// ==============================================
// core/morfologico.js
// Detector morfologico 2D de lineas de tabla.
// Usa apertura morfologica con integral images para O(ancho*alto).
// ==============================================

/**
 * Binariza la imagen con umbral Otsu.
 * Devuelve matriz bin[y][x]: 1 = oscuro (linea), 0 = claro (fondo).
 */
function binarizarOtsu(brillo, ancho, alto) {
  const hist = new Array(256).fill(0);
  for (let y = 0; y < alto; y++) {
    const fila = brillo[y];
    for (let x = 0; x < ancho; x++) hist[fila[x] | 0]++;
  }

  const total = ancho * alto;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];

  let sumB = 0, wB = 0, maxVar = 0, umbral = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) * (mB - mF);
    if (varBetween > maxVar) { maxVar = varBetween; umbral = t; }
  }

  const bin = new Array(alto);
  for (let y = 0; y < alto; y++) {
    const filaB = new Array(ancho);
    const filaG = brillo[y];
    for (let x = 0; x < ancho; x++) filaB[x] = filaG[x] < umbral ? 1 : 0;
    bin[y] = filaB;
  }
  return { bin, umbral };
}

/**
 * Apertura morfologica horizontal: erosion + dilatacion con kernel [1, L].
 * Un pixel queda activo si TODOS los L pixeles horizontales a su izquierda
 * (incluyendolo) son 1 (erosion), y luego si AL MENOS UNO de los L pixeles
 * en la ventana es 1 (dilatacion).
 * Usa integral horizontal para O(1) por pixel.
 */
function aperturaHorizontal(bin, ancho, alto, L) {
  const mitad = Math.floor(L / 2);
  // Integral por fila: suma acumulada
  const integ = new Array(alto);
  for (let y = 0; y < alto; y++) {
    const fila = bin[y];
    const acum = new Array(ancho + 1);
    acum[0] = 0;
    for (let x = 0; x < ancho; x++) acum[x + 1] = acum[x] + fila[x];
    integ[y] = acum;
  }

  // Erosion: todos los L pixeles de la ventana son 1
  const ero = new Array(alto);
  for (let y = 0; y < alto; y++) {
    const acum = integ[y];
    const filaE = new Array(ancho).fill(0);
    for (let x = mitad; x < ancho - mitad; x++) {
      const suma = acum[x + mitad + 1] - acum[x - mitad];
      if (suma >= L * 0.80) filaE[x] = 1;
    }
    ero[y] = filaE;
  }

  // Dilatacion: al menos 1 pixel activo en la ventana
  const dil = new Array(alto);
  for (let y = 0; y < alto; y++) {
    const filaE = ero[y];
    const acum = new Array(ancho + 1);
    acum[0] = 0;
    for (let x = 0; x < ancho; x++) acum[x + 1] = acum[x] + filaE[x];
    const filaD = new Array(ancho).fill(0);
    for (let x = 0; x < ancho; x++) {
      const ini = Math.max(0, x - mitad);
      const fin = Math.min(ancho - 1, x + mitad);
      const suma = acum[fin + 1] - acum[ini];
      if (suma > 0) filaD[x] = 1;
    }
    dil[y] = filaD;
  }
  return dil;
}

/**
 * Apertura morfologica vertical (analogo a horizontal, sobre columnas).
 */
function aperturaVertical(bin, ancho, alto, L) {
  const mitad = Math.floor(L / 2);
  // Integral por columna
  const integ = new Array(ancho);
  for (let x = 0; x < ancho; x++) {
    const acum = new Array(alto + 1);
    acum[0] = 0;
    for (let y = 0; y < alto; y++) acum[y + 1] = acum[y] + bin[y][x];
    integ[x] = acum;
  }

  // Erosion
  const ero = new Array(alto);
  for (let y = 0; y < alto; y++) ero[y] = new Array(ancho).fill(0);
  for (let x = 0; x < ancho; x++) {
    const acum = integ[x];
    for (let y = mitad; y < alto - mitad; y++) {
      const suma = acum[y + mitad + 1] - acum[y - mitad];
      if (suma >= L * 0.80) ero[y][x] = 1;
    }
  }

  // Dilatacion
  const dil = new Array(alto);
  for (let y = 0; y < alto; y++) dil[y] = new Array(ancho).fill(0);
  const integEro = new Array(ancho);
  for (let x = 0; x < ancho; x++) {
    const acum = new Array(alto + 1);
    acum[0] = 0;
    for (let y = 0; y < alto; y++) acum[y + 1] = acum[y] + ero[y][x];
    integEro[x] = acum;
  }
  for (let x = 0; x < ancho; x++) {
    const acum = integEro[x];
    for (let y = 0; y < alto; y++) {
      const ini = Math.max(0, y - mitad);
      const fin = Math.min(alto - 1, y + mitad);
      const suma = acum[fin + 1] - acum[ini];
      if (suma > 0) dil[y][x] = 1;
    }
  }
  return dil;
}

/**
 * Extrae lineas desde una mascara morfologica.
 * esH = true: la mascara tiene lineas HORIZONTALES, se proyecta por fila.
 * esH = false: la mascara tiene lineas VERTICALES, se proyecta por columna.
 * umbralFila: fraccion minima de la dimension que debe estar activa.
 * Devuelve array de { pos, longitud, cobertura }.
 */
function extraerLineasDeMascara(mask, esH, ancho, alto, umbralFila) {
  const resultado = [];
  const dimLargo = esH ? ancho : alto;
  const dimCorto = esH ? alto : ancho;
  const minActivos = Math.ceil(dimLargo * umbralFila);

  for (let i = 0; i < dimCorto; i++) {
    let activos = 0;
    let runMax = 0, runActual = 0;
    for (let j = 0; j < dimLargo; j++) {
      const v = esH ? mask[i][j] : mask[j][i];
      if (v) {
        activos++;
        runActual++;
        if (runActual > runMax) runMax = runActual;
      } else {
        runActual = 0;
      }
    }
    if (activos >= minActivos && (activos / dimLargo) >= 0.50) {
      resultado.push({
        pos: i,
        longitud: runMax,
        cobertura: activos / dimLargo
      });
    }
  }
  return resultado;
}

/**
 * Detector morfologico principal.
 * Devuelve lineasH y lineasV como arrays de OBJETOS { pos, longitud, cobertura }.
 */
function detectarMorfologico(brillo, ancho, alto) {
  const t0 = performance.now();

  const { bin, umbral } = binarizarOtsu(brillo, ancho, alto);

  const L_H = Math.max(15, Math.round(ancho * 0.10));
  const L_V = Math.max(15, Math.round(alto * 0.10));

  const maskH = aperturaHorizontal(bin, ancho, alto, L_H);
  const maskV = aperturaVertical(bin, ancho, alto, L_V);

  const UMBRAL_FILA = 0.30;
  const lineasH = extraerLineasDeMascara(maskH, true, ancho, alto, UMBRAL_FILA);
  const lineasV = extraerLineasDeMascara(maskV, false, ancho, alto, UMBRAL_FILA);

  const t1 = performance.now();
  if (typeof log === 'function') log('[Morfo] H=' + lineasH.length + ' V=' + lineasV.length + ' (L_H=' + L_H + ' L_V=' + L_V + ' otsu=' + umbral + ') en ' + (t1 - t0).toFixed(0) + 'ms');

  // Compatibilidad: extraer solo posiciones para quien las use como numeros
  const posH = lineasH.map(function(l) { return l.pos; });
  const posV = lineasV.map(function(l) { return l.pos; });

  return {
    lineasH: posH,
    lineasV: posV,
    metaH: lineasH,
    metaV: lineasV,
    tiempo: t1 - t0,
    umbral: umbral
  };
}

console.log('core/morfologico.js cargado');
