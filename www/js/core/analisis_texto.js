// ==============================================
// core/analisis_texto.js
// Estimación del tamaño de texto (altura de glifo)
// vía binarización Otsu + proyección horizontal.
// ==============================================

// --- Otsu: encuentra el umbral óptimo de binarización ---
function atOtsu(brillo, ancho, alto) {
  const hist = new Array(256).fill(0);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      hist[brillo[y][x] | 0]++;
    }
  }
  const total = ancho * alto;
  let sumTotal = 0;
  for (let i = 0; i < 256; i++) sumTotal += i * hist[i];

  let sumB = 0, wB = 0, maxVar = 0, umbral = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumTotal - sumB) / wF;
    const entreVar = wB * wF * (mB - mF) * (mB - mF);
    if (entreVar > maxVar) {
      maxVar = entreVar;
      umbral = t;
    }
  }
  return umbral;
}

// --- Estima el tamaño de texto (altura de glifo) ---
// Devuelve { tamTexto, numRenglones, alturas, debug }
function estimarTamanoTexto(brillo, ancho, alto) {
  const debug = {};

  // 1. Binarizar con Otsu (texto oscuro sobre fondo claro)
  const umbral = atOtsu(brillo, ancho, alto);
  debug.umbralOtsu = umbral;

  // Detectar polaridad: ¿texto oscuro o claro?
  let oscuros = 0, claros = 0;
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      if (brillo[y][x] < umbral) oscuros++; else claros++;
    }
  }
  // El texto suele ser la minoría
  const textoOscuro = oscuros < claros;
  debug.polaridad = textoOscuro ? 'oscuro' : 'claro';

  // 2. Proyección horizontal: contar píxeles de texto por fila
  const proy = new Array(alto).fill(0);
  for (let y = 0; y < alto; y++) {
    let count = 0;
    for (let x = 0; x < ancho; x++) {
      const esTexto = textoOscuro ? (brillo[y][x] < umbral) : (brillo[y][x] >= umbral);
      if (esTexto) count++;
    }
    proy[y] = count;
  }

  // 3. Umbral de proyección adaptativo: 15% del máximo
  let maxProy = 0;
  for (let y = 0; y < alto; y++) if (proy[y] > maxProy) maxProy = proy[y];
  const umbralProy = maxProy * 0.15;
  debug.maxProy = maxProy;
  debug.umbralProy = umbralProy;

  // 4. Detectar renglones por transiciones (cruces del umbral)
  const renglones = [];
  let enRenglon = false;
  let inicio = 0;
  const minPixelesFila = 5;  // filtro de ruido

  for (let y = 0; y < alto; y++) {
    const activo = proy[y] >= umbralProy && proy[y] >= minPixelesFila;
    if (activo && !enRenglon) {
      enRenglon = true;
      inicio = y;
    } else if (!activo && enRenglon) {
      enRenglon = false;
      const altura = y - inicio;
      if (altura >= 3 && altura <= alto / 2) {
        renglones.push({ inicio, fin: y - 1, altura });
      }
    }
  }
  // Cerrar el último renglón si quedó abierto
  if (enRenglon) {
    const altura = alto - inicio;
    if (altura >= 3 && altura <= alto / 2) {
      renglones.push({ inicio, fin: alto - 1, altura });
    }
  }

  debug.renglonesDetectados = renglones.length;

  // 5. Sin renglones detectables: fallback 999 (no upscalear)
  if (renglones.length < 3) {
    return { tamTexto: 999, numRenglones: renglones.length, alturas: [], debug };
  }

  // 6. Mediana de las alturas (robusta a outliers)
  const alturas = renglones.map(function(r) { return r.altura; });
  alturas.sort(function(a, b) { return a - b; });
  const mid = Math.floor(alturas.length / 2);
  const mediana = (alturas.length % 2 === 0)
    ? (alturas[mid - 1] + alturas[mid]) / 2
    : alturas[mid];

  debug.alturaMin = alturas[0];
  debug.alturaMax = alturas[alturas.length - 1];

  return {
    tamTexto: mediana,
    numRenglones: renglones.length,
    alturas: alturas,
    debug: debug
  };
}

window.atOtsu = atOtsu;
window.estimarTamanoTexto = estimarTamanoTexto;

console.log('core/analisis_texto.js cargado');
