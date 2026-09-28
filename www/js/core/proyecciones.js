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
