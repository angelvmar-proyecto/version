// ==============================================
// MAR Caribe v12.0 - Emulación Retinal
// Basado en el modelo bioinspirado de Kern & Cubillos 2024
// Versión simplificada, opcional, sin dependencias
// ==============================================

// Config por defecto (se puede sobrescribir desde CONFIG)
const RETINA_DEFAULTS = {
  RETINA_ACTIVO: false,
  RETINA_RADIO: 15,              // Radio de la ventana de contraste local
  RETINA_FUERZA_CONTRASTE: 1.5,  // Cuánto amplifica el contraste local
  RETINA_FUERZA_BORDES: 0.5,     // Cuánto enfatiza los bordes
  RETINA_UMBRAL_APLICAR: 60      // Densidad de contraste mínima para aplicar
};

// ============================================
// CALCULAR DENSIDAD DE CONTRASTE
// Devuelve 0-255. Valores bajos = imagen plana. Altos = mucho contraste.
// ============================================
function calcularDensidadContraste(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const datos = imageData.data;
  const w = canvas.width, h = canvas.height;

  let sumaVar = 0, count = 0;
  // Muestreo cada 4 píxeles para velocidad
  for (let y = 2; y < h - 2; y += 4) {
    for (let x = 2; x < w - 2; x += 4) {
      const idx = (y * w + x) * 4;
      const brillo = (datos[idx] + datos[idx + 1] + datos[idx + 2]) / 3;

      const idxDer = (y * w + (x + 2)) * 4;
      const brilloDer = (datos[idxDer] + datos[idxDer + 1] + datos[idxDer + 2]) / 3;

      const dif = Math.abs(brillo - brilloDer);
      sumaVar += dif;
      count++;
    }
  }

  return count > 0 ? sumaVar / count : 0;
}

// ============================================
// AJUSTE DE CONTRASTE LOCAL
// Emula las células horizontales: cada píxel se ajusta contra su entorno
// ============================================
function ajusteContrasteLocal(canvas, radio, fuerza) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const datos = imageData.data;
  const w = canvas.width, h = canvas.height;
  const salida = new Uint8ClampedArray(datos.length);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const brillo = (datos[idx] + datos[idx + 1] + datos[idx + 2]) / 3;

      // Calcular promedio local
      let suma = 0, count = 0;
      const x0 = Math.max(0, x - radio);
      const x1 = Math.min(w - 1, x + radio);
      const y0 = Math.max(0, y - radio);
      const y1 = Math.min(h - 1, y + radio);

      // Muestreo cada 3 píxeles para velocidad
      for (let yy = y0; yy <= y1; yy += 3) {
        for (let xx = x0; xx <= x1; xx += 3) {
          const nIdx = (yy * w + xx) * 4;
          suma += (datos[nIdx] + datos[nIdx + 1] + datos[nIdx + 2]) / 3;
          count++;
        }
      }
      const promedioLocal = suma / count;

      // Ajustar: si el píxel es más oscuro que su entorno, oscurecerlo más.
      // Si es más claro, aclararlo más.
      const dif = brillo - promedioLocal;
      const ajustado = clamp(brillo + dif * fuerza, 0, 255);

      salida[idx] = ajustado;
      salida[idx + 1] = ajustado;
      salida[idx + 2] = ajustado;
      salida[idx + 3] = 255;
    }
  }

  ctx.putImageData(new ImageData(salida, w, h), 0, 0);
  return canvas;
}

// ============================================
// REALCE DE BORDES
// Emula células parvocelulares: enfatiza los contornos del texto
// ============================================
function realzarBordes(canvas, fuerza) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const datos = imageData.data;
  const w = canvas.width, h = canvas.height;
  const salida = new Uint8ClampedArray(datos.length);

  // Kernel de enfoque: [ 0 -1 0 ]
  //                   [-1  5 -1 ]
  //                   [ 0 -1 0 ]
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;

      // Borde: copiar sin cambio
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
        salida[idx] = datos[idx];
        salida[idx + 1] = datos[idx + 1];
        salida[idx + 2] = datos[idx + 2];
        salida[idx + 3] = datos[idx + 3];
        continue;
      }

      const idxArriba = ((y - 1) * w + x) * 4;
      const idxAbajo = ((y + 1) * w + x) * 4;
      const idxIzq = (y * w + (x - 1)) * 4;
      const idxDer = (y * w + (x + 1)) * 4;

      // Aplicar kernel 5 * centro - 4 vecinos
      const v = datos[idx] * 5
        - datos[idxArriba]
        - datos[idxAbajo]
        - datos[idxIzq]
        - datos[idxDer];

      // Mezclar con el original según fuerza
      const mezclado = datos[idx] * (1 - fuerza) + v * fuerza;

      salida[idx] = clamp(mezclado, 0, 255);
      salida[idx + 1] = clamp(mezclado, 0, 255);
      salida[idx + 2] = clamp(mezclado, 0, 255);
      salida[idx + 3] = 255;
    }
  }

  ctx.putImageData(new ImageData(salida, w, h), 0, 0);
  return canvas;
}

// ============================================
// APLICAR RETINA (función principal, opcional)
// ============================================
function aplicarRetina(canvasOriginal) {
  // Leer config con fallback a defaults
  const activo = CONFIG.RETINA_ACTIVO !== undefined ? CONFIG.RETINA_ACTIVO : RETINA_DEFAULTS.RETINA_ACTIVO;
  if (!activo) return canvasOriginal;

  const radio = CONFIG.RETINA_RADIO || RETINA_DEFAULTS.RETINA_RADIO;
  const fContraste = CONFIG.RETINA_FUERZA_CONTRASTE || RETINA_DEFAULTS.RETINA_FUERZA_CONTRASTE;
  const fBordes = CONFIG.RETINA_FUERZA_BORDES || RETINA_DEFAULTS.RETINA_FUERZA_BORDES;
  const umbralAplicar = CONFIG.RETINA_UMBRAL_APLICAR || RETINA_DEFAULTS.RETINA_UMBRAL_APLICAR;

  // Medir contraste: si ya es alto, no aplicar (ahorra tiempo)
  const densidad = calcularDensidadContraste(canvasOriginal);
  if (densidad > umbralAplicar) {
    return canvasOriginal;
  }

  // Aplicar contraste local + realce de bordes
  let canvas = canvasOriginal;
  canvas = ajusteContrasteLocal(canvas, radio, fContraste);
  canvas = realzarBordes(canvas, fBordes);
  return canvas;
}

console.log('✅ Retina (emulación bioinspirada) cargada');
