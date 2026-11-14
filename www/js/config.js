// ==============================================
// config.js
// Configuración global de MAR Caribe v15 (OCR).
// Solo contiene parámetros del pipeline de OCR.
// Los parámetros de LIDAR y detectores de líneas
// están archivados en www/_archivo/lineas/.
// ==============================================

const BUILD_TAG = 'v15-ocr-limpio';

const CONFIG = {
  VERSION: '15.0',

  // ----------------------------------------------
  // PREPROCESAMIENTO AVANZADO
  // ----------------------------------------------
  GAMMA_ACTIVO: false,
  GAMMA_VALOR: 1.8,

  CLAHE_ACTIVO: false,
  CLAHE_TILES: 8,
  CLAHE_CLIP: 2.5,

  // ----------------------------------------------
  // SAUVOLA (binarización adaptativa)
  // ----------------------------------------------
  SAUVOLA_ACTIVO: false,
  SAUVOLA_VENTANA: 15,
  SAUVOLA_K: 0.3,

  // ----------------------------------------------
  // FILTRO OCR (contraste + CLAHE pre-binarización)
  // Aplicado antes del OCR cuando el diagnóstico lo pide.
  // ----------------------------------------------
  FILTRO_OCR_ACTIVO: false,
  FILTRO_OCR_PERC_BAJO: 5,
  FILTRO_OCR_PERC_ALTO: 95,
  FILTRO_OCR_TILES: 16,
  FILTRO_OCR_CLIP: 8,

  // ----------------------------------------------
  // DIAGNÓSTICO SELECTIVO
  // Umbrales para decidir qué filtro aplicar.
  // ----------------------------------------------
  DIAG_UMBRAL_NITIDEZ: 100,      // < esto = desenfoque
  DIAG_UMBRAL_RUIDO: 15,         // > esto = ruido
  DIAG_UMBRAL_CONTRASTE: 40,     // < esto = bajo contraste
  DIAG_UMBRAL_ILUMINACION: 25,   // > esto = iluminación desigual
  DIAG_UMBRAL_TEXTO_CHICO: 10,   // < esto = texto chico (px)
  DIAG_UMBRAL_SATURACION: 0.10,  // > esto = imagen con color

  // ----------------------------------------------
  // OCR - ML Kit + preprocesamiento por celda
  // ----------------------------------------------
  OCR_MARGEN_CELDA: 3,
  OCR_MARGEN_PADDING: 10,
  OCR_DENSIDAD_MIN: 0.05,
  OCR_BINARIZAR: false,

  // Escalado inteligente por celda (según altura de texto)
  OCR_ESCALA_UMBRAL_BAJO: 15,
  OCR_ESCALA_UMBRAL_MEDIO: 30,
  OCR_ESCALA_3X: 3,
  OCR_ESCALA_2X: 2,

  // ----------------------------------------------
  // OCR - Tiling / franjas (imágenes grandes)
  // ----------------------------------------------
  OCR_FRANJA_ALTO_OBJETIVO: 1500,     // altura objetivo por franja
  OCR_FRANJA_SOLAPE: 50,              // píxeles de solape en Y
  OCR_TILING_TAMANO: 500,             // solo si se usa tiling cuadrado
  OCR_TILING_SOLAPE: 30,              // solo si se usa tiling cuadrado
  OCR_TILING_UPSCALE: 4,              // upscale aplicado a cada tile
  OCR_IMAGEN_UMBRAL_FRANJAS: 2048,    // > esto = usar franjas

  // ----------------------------------------------
  // OCR - Post-procesamiento
  // ----------------------------------------------
  OCR_FILA0_ENCABEZADO: false,
  OCR_USAR_DICCIONARIO: true,
  OCR_USAR_HOMOGLIFOS: true,

  // Matriz de confusión aprendida (futuro)
  APRENDIZAJE_ACTIVO: false,

  // ----------------------------------------------
  // VISUALIZACIÓN
  // ----------------------------------------------
  ANCHO_LINEA: 2,
  ZOOM_MIN: 0.5,
  ZOOM_MAX: 5,
  ZOOM_PASO: 0.25
};

// ==============================================
// CONFIG_ESC: copia modificable que se recalcula por imagen.
// Por ahora solo contiene los parámetros que dependen del tamaño.
// ==============================================
window.CONFIG_ESC = Object.assign({}, CONFIG);

// ==============================================
// Escalado proporcional según tamaño de imagen.
// Los parámetros absolutos (px) se ajustan a la resolución real.
// ==============================================
function escalarConfig(ancho, alto) {
  window.CONFIG_ESC = Object.assign({}, CONFIG);

  const minDim = Math.min(ancho, alto);
  const maxDim = Math.max(ancho, alto);

  // Radio de box blur para flatten de iluminación
  window.CONFIG_ESC.FLATTEN_RADIO = Math.max(20, Math.round(minDim * 0.15));

  // Tamaño de franja para tiling horizontal
  window.CONFIG_ESC.OCR_FRANJA_ALTO_OBJETIVO = Math.max(
    800,
    Math.round(alto * 0.9)
  );

  // Margen entre celdas escalado
  window.CONFIG_ESC.OCR_MARGEN_CELDA = Math.max(
    2,
    Math.round(minDim * 0.003)
  );

  // Radio de la ventana de Sauvola
  window.CONFIG_ESC.SAUVOLA_VENTANA = Math.max(
    9,
    Math.round(minDim * 0.015)
  );

  return window.CONFIG_ESC;
}

console.log('[config] ' + BUILD_TAG + ' cargado');
