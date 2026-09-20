// ==============================================
// MAR Caribe v12.0 - PREPROCESAMIENTO
// CRR + BS + Detección de ruido y color
// ==============================================

// ============================================
// CRR - COSMIC RAY REJECTION
// Elimina píxeles anómalos comparando con vecinos
// ============================================
function aplicarCRR(imageData, umbral) {
  umbral = umbral || CONFIG.CRR_UMBRAL;
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  const dst = new Uint8ClampedArray(src.length);

  // Copia inicial
  for (let i = 0; i < src.length; i++) dst[i] = src[i];

  // Recorre cada píxel (excepto bordes)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;

      // Promedio de 8 vecinos
      let sumaR = 0, sumaG = 0, sumaB = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nIdx = ((y + dy) * w + (x + dx)) * 4;
          sumaR += src[nIdx];
          sumaG += src[nIdx + 1];
          sumaB += src[nIdx + 2];
        }
      }
      const promR = sumaR / 8;
      const promG = sumaG / 8;
      const promB = sumaB / 8;

      // Diferencia promedio del píxel con sus vecinos
      const difTotal = (Math.abs(src[idx] - promR) +
                        Math.abs(src[idx + 1] - promG) +
                        Math.abs(src[idx + 2] - promB)) / 3;

      // Si es muy anómalo, reemplazar por el promedio
      if (difTotal > umbral) {
        dst[idx] = promR;
        dst[idx + 1] = promG;
        dst[idx + 2] = promB;
      }
    }
  }
  return new ImageData(dst, w, h);
}

// ============================================
// BS - BACKGROUND SUBTRACTION
// Elimina el color de fondo de cada bloque
// ============================================
function aplicarBS(imageData, tamanioBloque) {
  tamanioBloque = tamanioBloque || CONFIG.BS_TAMANIO_BLOQUE;
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  const dst = new Uint8ClampedArray(src.length);

  const numBloquesX = Math.ceil(w / tamanioBloque);
  const numBloquesY = Math.ceil(h / tamanioBloque);
  const fondos = [];

  // Estimar el color de fondo de cada bloque
  for (let by = 0; by < numBloquesY; by++) {
    for (let bx = 0; bx < numBloquesX; bx++) {
      const x0 = bx * tamanioBloque;
      const y0 = by * tamanioBloque;
      const x1 = Math.min(w, x0 + tamanioBloque);
      const y1 = Math.min(h, y0 + tamanioBloque);

      const valores = [];
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = (y * w + x) * 4;
          const b = (src[idx] + src[idx + 1] + src[idx + 2]) / 3;
          valores.push({ r: src[idx], g: src[idx + 1], b: src[idx + 2], brillo: b });
        }
      }

      // El "fondo" es el 25% más brillante del bloque
      valores.sort((a, b) => b.brillo - a.brillo);
      const fondo = valores[Math.floor(valores.length * 0.25)];
      fondos.push({ bx, by, fondo });
    }
  }

  // Restar el fondo a cada píxel y normalizar
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const bx = Math.floor(x / tamanioBloque);
      const by = Math.floor(y / tamanioBloque);
      const idx = (y * w + x) * 4;
      const fondo = fondos[by * numBloquesX + bx].fondo;

      // Sumar 128 para que el fondo quede gris medio
      dst[idx] = clamp(src[idx] - fondo.r + 128, 0, 255);
      dst[idx + 1] = clamp(src[idx + 1] - fondo.g + 128, 0, 255);
      dst[idx + 2] = clamp(src[idx + 2] - fondo.b + 128, 0, 255);
      dst[idx + 3] = 255;
    }
  }
  return new ImageData(dst, w, h);
}

// ============================================
// DETECTAR SI NECESITA CRR (¿hay ruido real?)
// ============================================
function necesitaCRR(imageData) {
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;

  let anomalos = 0, total = 0;

  // Muestreo cada 3 píxeles para velocidad
  for (let y = 1; y < h - 1; y += 3) {
    for (let x = 1; x < w - 1; x += 3) {
      const idx = (y * w + x) * 4;
      let suma = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nIdx = ((y + dy) * w + (x + dx)) * 4;
          suma += src[nIdx];
        }
      }
      const prom = suma / 8;
      if (Math.abs(src[idx] - prom) > 80) anomalos++;
      total++;
    }
  }
  // >5% de píxeles anómalos → hay ruido
  return (anomalos / total) > 0.05;
}

// ============================================
// DETECTAR SI TIENE COLORES FUERTES
// ============================================
function tieneColoresFuertes(imageData) {
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;

  let zonasColoridas = 0, totalZonas = 0;

  // Analizar bloques de 30×30 con muestreo
  for (let by = 0; by < h - 30; by += 30) {
    for (let bx = 0; bx < w - 30; bx += 30) {
      let sumSat = 0, count = 0;
      for (let y = by; y < by + 30; y += 3) {
        for (let x = bx; x < bx + 30; x += 3) {
          const idx = (y * w + x) * 4;
          const r = src[idx], g = src[idx + 1], b = src[idx + 2];
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          // Saturación HSV simplificada
          const sat = max === 0 ? 0 : (max - min) / max;
          sumSat += sat;
          count++;
        }
      }
      if ((sumSat / count) > CONFIG.BS_UMBRAL_SATURACION) zonasColoridas++;
      totalZonas++;
    }
  }
  // >20% de zonas con color → la imagen tiene colores fuertes
  return (zonasColoridas / totalZonas) > 0.20;
}

// ============================================
// PIPELINE DE PREPROCESAMIENTO
// Aplica CRR y BS según lo que detecte
// ============================================
function preprocesarImagen(imageData) {
  const resultado = {
    imageData: imageData,
    aplicoCRR: false,
    aplicoBS: false,
    tieneColor: false,
    tieneRuido: false
  };

  // Detección previa
  resultado.tieneRuido = necesitaCRR(imageData);
  resultado.tieneColor = tieneColoresFuertes(imageData);

  let actual = imageData;

  // CRR solo si hay ruido real y está activo
  if (CONFIG.CRR_ACTIVO && resultado.tieneRuido) {
    actual = aplicarCRR(actual);
    resultado.aplicoCRR = true;
  }

  // BS si hay colores y está activo
  if (CONFIG.BS_ACTIVO && resultado.tieneColor) {
    actual = aplicarBS(actual);
    resultado.aplicoBS = true;
  }

  resultado.imageData = actual;
  return resultado;
}

console.log('✅ Preprocesamiento cargado');
