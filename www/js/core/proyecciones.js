// ==============================================
// core/proyecciones.js
// Perfiles H y V base para los algoritmos de deteccion.
// ==============================================

/**
 * Perfil horizontal: promedio de brillo por cada fila.
 * Resultado: array[alto] con valores 0-255.
 */
function perfilH(brillo, alto, ancho) {
  const perfil = new Array(alto);
  for (let y = 0; y < alto; y++) {
    let suma = 0;
    for (let x = 0; x < ancho; x++) suma += brillo[y][x];
    perfil[y] = suma / ancho;
  }
  return perfil;
}

/**
 * Perfil vertical: promedio de brillo por cada columna.
 * Resultado: array[ancho] con valores 0-255.
 */
function perfilV(brillo, alto, ancho) {
  const perfil = new Array(ancho);
  for (let x = 0; x < ancho; x++) {
    let suma = 0;
    for (let y = 0; y < alto; y++) suma += brillo[y][x];
    perfil[x] = suma / alto;
  }
  return perfil;
}

/**
 * Suavizado con media movil sobre un array 1D.
 */
function suavizar(perfil, radio) {
  if (!radio || radio < 1) return perfil.slice();
  const n = perfil.length;
  const salida = new Array(n);
  for (let i = 0; i < n; i++) {
    let suma = 0, count = 0;
    const ini = Math.max(0, i - radio);
    const fin = Math.min(n - 1, i + radio);
    for (let j = ini; j <= fin; j++) { suma += perfil[j]; count++; }
    salida[i] = suma / count;
  }
  return salida;
}

console.log('core/proyecciones.js cargado');


/**
 * Encuentra valles (minimos locales) en un perfil.
 * Usado por Optica: las lineas son mas oscuras que el fondo.
 */
function buscarValles(perfil, distanciaMin, factorUmbral) {
  const valles = [];
  for (let i = 2; i < perfil.length - 2; i++) {
    if (perfil[i] < perfil[i-1] && perfil[i] < perfil[i+1] &&
        perfil[i] < perfil[i-2] && perfil[i] < perfil[i+2]) {
      valles.push({ pos: i, valor: perfil[i] });
    }
  }
  if (valles.length === 0) return [];

  // Umbral adaptativo: mediana de los 30 valles mas fuertes
  const valores = valles.map(function(v) { return v.valor; }).sort(function(a, b) { return a - b; });
  const N = Math.min(30, valores.length);
  const topN = valores.slice(0, N);
  const mediana = topN[Math.floor(topN.length / 2)];
  const umbral = mediana * (1 + factorUmbral);

  // Filtrar por umbral
  const aceptados = valles.filter(function(v) { return v.valor <= umbral; });

  // Aplicar distancia minima
  const resultado = [];
  let ultPos = -99999;
  for (const v of aceptados) {
    if (v.pos - ultPos >= distanciaMin) {
      resultado.push(v.pos);
      ultPos = v.pos;
    }
  }
  return resultado;
}

/**
 * Encuentra picos (maximos locales) con verificacion de pico real.
 * Usado por Eco: cambio de brillo alto = linea.
 */
function buscarPicos(perfil, umbral, distanciaMin, rangoPico) {
  const resultado = [];
  let ultPos = -99999;
  for (let i = 0; i < perfil.length; i++) {
    if (perfil[i] > umbral && i - ultPos >= distanciaMin) {
      // Buscar pico maximo local en +-rangoPico
      let iPico = i;
      let maxVal = perfil[i];
      for (let j = Math.max(0, i - rangoPico); j <= Math.min(perfil.length - 1, i + rangoPico); j++) {
        if (perfil[j] > maxVal) { maxVal = perfil[j]; iPico = j; }
      }
      resultado.push(iPico);
      ultPos = iPico;
    }
  }
  return resultado;
}
