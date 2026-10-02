// ==============================================
// core/brillo.js
// Convierte un canvas/ImageData a matriz de brillo.
// ==============================================

/**
 * Calcula matriz de brillo (0-255) desde ImageData.
 * @param {ImageData} imageData
 * @returns {Array<Array<number>>} matriz [alto][ancho]
 */
function calcularBrillo(imageData) {
  const ancho = imageData.width;
  const alto = imageData.height;
  const data = imageData.data;
  const brillo = new Array(alto);

  for (let y = 0; y < alto; y++) {
    const fila = new Array(ancho);
    const offset = y * ancho * 4;
    for (let x = 0; x < ancho; x++) {
      const i = offset + x * 4;
      // Luminancia estandar: 0.299 R + 0.587 G + 0.114 B
      fila[x] = Math.round(0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
    }
    brillo[y] = fila;
  }
  return brillo;
}

console.log('core/brillo.js cargado');


function calcularBrilloColorAgnostico(imageData) {
  const ancho = imageData.width;
  const alto = imageData.height;
  const data = imageData.data;
  const brillo = new Array(alto);
  for (let y = 0; y < alto; y++) {
    const fila = new Array(ancho);
    const offset = y * ancho * 4;
    for (let x = 0; x < ancho; x++) {
      const i = offset + x * 4;
      fila[x] = Math.max(data[i], data[i+1], data[i+2]);
    }
    brillo[y] = fila;
  }
  return brillo;
}
console.log("core/brillo.js: calcularBrilloColorAgnostico disponible");


/**
 * Calcula la saturacion media de la imagen (0-1).
 * 0 = blanco y negro puro.
 * 1 = totalmente saturado.
 * Util para decidir si Optica es fiable o no.
 */
function calcularSaturacionMedia(imageData) {
  const data = imageData.data;
  const total = imageData.width * imageData.height;
  let suma = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    suma += sat;
  }
  return suma / total;
}

console.log('core/brillo.js: calcularSaturacionMedia disponible');
