// ==============================================
// MAR Caribe v12.0 - UTILIDADES COMPARTIDAS
// Funciones usadas por múltiples módulos
// ==============================================

// ============================================
// SUAVIZAR ARRAY (media móvil)
// ============================================
function suavizar(arr, ventana) {
  if (ventana < 1) return arr;
  const resultado = new Array(arr.length);
  const mitad = Math.floor(ventana / 2);
  for (let i = 0; i < arr.length; i++) {
    let suma = 0, count = 0;
    for (let j = -mitad; j <= mitad; j++) {
      const idx = i + j;
      if (idx >= 0 && idx < arr.length) {
        suma += arr[idx];
        count++;
      }
    }
    resultado[i] = suma / count;
  }
  return resultado;
}

// ============================================
// CALCULAR BRILLO desde ImageData
// ============================================
function calcularBrillo(imageData) {
  const datos = imageData.data;
  const ancho = imageData.width;
  const alto = imageData.height;
  const brillo = [];

  for (let y = 0; y < alto; y++) {
    brillo[y] = new Array(ancho);
    for (let x = 0; x < ancho; x++) {
      const i = (y * ancho + x) * 4;
      brillo[y][x] = Math.round((datos[i] + datos[i + 1] + datos[i + 2]) / 3);
    }
  }
  return brillo;
}

// ============================================
// AJUSTE LOCAL DE LÍNEA HORIZONTAL
// Busca el centro real (mínimo brillo) cerca de y
// ============================================
function ajustarLineaH(y, brillo, alto, ancho, rango) {
  const y0 = Math.max(0, y - rango);
  const y1 = Math.min(alto - 1, y + rango);
  let mejorY = y;
  let mejorBrillo = Infinity;

  for (let yy = y0; yy <= y1; yy++) {
    let suma = 0;
    for (let x = 0; x < ancho; x++) {
      suma += brillo[yy][x];
    }
    const prom = suma / ancho;
    if (prom < mejorBrillo) {
      mejorBrillo = prom;
      mejorY = yy;
    }
  }
  return mejorY;
}

// ============================================
// AJUSTE LOCAL DE LÍNEA VERTICAL
// ============================================
function ajustarLineaV(x, brillo, alto, ancho, rango) {
  const x0 = Math.max(0, x - rango);
  const x1 = Math.min(ancho - 1, x + rango);
  let mejorX = x;
  let mejorBrillo = Infinity;

  for (let xx = x0; xx <= x1; xx++) {
    let suma = 0;
    for (let y = 0; y < alto; y++) {
      suma += brillo[y][xx];
    }
    const prom = suma / alto;
    if (prom < mejorBrillo) {
      mejorBrillo = prom;
      mejorX = xx;
    }
  }
  return mejorX;
}

// ============================================
// APLICAR AJUSTE LOCAL A TODAS LAS LÍNEAS
// ============================================
function aplicarAjusteLocal(lineasH, lineasV, brillo, alto, ancho) {
  const lineasHAjustadas = lineasH.map(y =>
    ajustarLineaH(y, brillo, alto, ancho, CONFIG_ESC.RANGO_AJUSTE)
  );
  const lineasVAjustadas = lineasV.map(x =>
    ajustarLineaV(x, brillo, alto, ancho, CONFIG_ESC.RANGO_AJUSTE)
  );
  return { lineasH: lineasHAjustadas, lineasV: lineasVAjustadas };
}

// ============================================
// FILTRAR LÍNEAS CERCANAS
// Mantiene la primera de cada grupo cercano
// ============================================
function filtrarLineasCercanas(lineas, distanciaMin) {
  if (lineas.length === 0) return [];
  const ordenadas = [...lineas].sort((a, b) => a - b);
  const resultado = [ordenadas[0]];

  for (let i = 1; i < ordenadas.length; i++) {
    if (ordenadas[i] - resultado[resultado.length - 1] >= distanciaMin) {
      resultado.push(ordenadas[i]);
    }
  }
  return resultado;
}

// ============================================
// MEDIR ECO EN UNA LÍNEA HORIZONTAL
// Promedio del máximo cambio de brillo en ventana vertical
// ============================================
function medirEcoLineaH(y, brillo, alto, ancho, ventana) {
  let sumaEco = 0;
  const v0 = Math.max(0, y - ventana);
  const v1 = Math.min(alto - 1, y + ventana);

  for (let x = 0; x < ancho; x++) {
    let maxDif = 0;
    for (let yy = v0; yy <= v1; yy++) {
      const dif = Math.abs(brillo[y][x] - brillo[yy][x]);
      if (dif > maxDif) maxDif = dif;
    }
    sumaEco += maxDif;
  }
  return sumaEco / ancho;
}

// ============================================
// MEDIR ECO EN UNA LÍNEA VERTICAL
// ============================================
function medirEcoLineaV(x, brillo, alto, ancho, ventana) {
  let sumaEco = 0;
  const h0 = Math.max(0, x - ventana);
  const h1 = Math.min(ancho - 1, x + ventana);

  for (let y = 0; y < alto; y++) {
    let maxDif = 0;
    for (let xx = h0; xx <= h1; xx++) {
      const dif = Math.abs(brillo[y][x] - brillo[y][xx]);
      if (dif > maxDif) maxDif = dif;
    }
    sumaEco += maxDif;
  }
  return sumaEco / alto;
}

// ============================================
// MAX SEGURO (evita stack overflow con arrays grandes)
// ============================================
function maxSeguro(arr) {
  let m = -Infinity;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > m) m = arr[i];
  }
  return m;
}

// ============================================
// MIN SEGURO
// ============================================
function minSeguro(arr) {
  let m = Infinity;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] < m) m = arr[i];
  }
  return m;
}

// ============================================
// CLAMP: limita un valor entre min y max
// ============================================
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// ============================================
// FORMATEAR BYTES para mostrar al usuario
// ============================================
function formatearBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

console.log('✅ Utilidades cargadas');
