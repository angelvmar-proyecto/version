// ==============================================
// MAR Caribe v12.0 - CONFIGURACIÓN GLOBAL
// Todos los parámetros centralizados aquí
// ==============================================

const CONFIG = {

  // ============================================
  // VERSIÓN
  // ============================================
  VERSION: '12.0',

  // ============================================
  // PREPROCESAMIENTO
  // ============================================
  // CRR: elimina píxeles anómalos (solo si hay ruido real)
  CRR_ACTIVO: false,          // Se activa automáticamente si detecta ruido
  CRR_UMBRAL: 80,             // Diferencia mínima para considerar píxel anómalo

  // BS: Background Subtraction (OBLIGATORIO si hay colores)
  BS_ACTIVO: true,            // Se activa automáticamente si detecta color
  BS_TAMANIO_BLOQUE: 30,      // Tamaño del bloque para estimar fondo
  BS_UMBRAL_SATURACION: 0.20, // Saturación mínima para considerar "color"

  // ============================================
  // ÓPTICA (Perfil de Proyección)
  // ============================================
  OPTICA_UMBRAL_ADAPTATIVO: 0.20, // % del máximo para considerar valle
  OPTICA_DISTANCIA_MIN_H: 18,     // Distancia mínima entre líneas H (px)
  OPTICA_DISTANCIA_MIN_V: 40,     // Distancia mínima entre líneas V (px)
  OPTICA_SUAVIZADO: 3,            // Ventana de suavizado (impar)

  // ============================================
  // ECOGRAFÍA (Cambio de brillo)
  // ============================================
  ECO_VENTANA: 3,             // Radio de la ventana de análisis
  ECO_UMBRAL_H: 38,           // Umbral de eco para líneas H
  ECO_UMBRAL_V: 42,           // Umbral de eco para líneas V
  ECO_CONTINUIDAD: 0.55,      // % mínimo de píxeles fuertes
  ECO_DISTANCIA_MIN_H: 18,
  ECO_DISTANCIA_MIN_V: 40,

  // ============================================
  // A3 ORTOGONALIDAD (Sobel)
  // ============================================
  A3_UMBRAL_MAGNITUD: 100,        // Magnitud mínima del gradiente
  A3_UMBRAL_ORTOGONALIDAD: 0.70,  // % de ortogonalidad mínima
  A3_COBERTURA_MINIMA: 0.30,      // % de cobertura mínima de la línea
  A3_DISTANCIA_MIN: 18,           // Distancia mínima entre líneas

  // ============================================
  // AJUSTE LOCAL
  // ============================================
  RANGO_AJUSTE: 5,            // ±px para buscar el centro real de la línea

  // ============================================
  // LIDAR (Votación + Eco)
  // ============================================
  LIDAR_VOTOS_MINIMOS: 2,     // Votos mínimos para aceptar una línea
  LIDAR_ECO_ALTO: 80,         // Eco considerado "alto"
  LIDAR_ECO_BAJO: 30,         // Eco considerado "bajo"
  LIDAR_AGRUPAR_DIST: 8,      // Distancia para agrupar votos (px)

  // ============================================
  // VISUALIZACIÓN
  // ============================================
  ANCHO_LINEA: 2,             // Grosor de las líneas dibujadas
  ZOOM_MIN: 0.5,
  ZOOM_MAX: 5,
  ZOOM_PASO: 0.25,

  // ============================================
  // COLORES POR ALGORITMO
  // ============================================
  COLOR_OPTICA:    '#FFD700',  // 🟡 Amarillo
  COLOR_ECO_H:     '#FF0000',  // 🔴 Rojo
  COLOR_ECO_V:     '#0088FF',  // 🔵 Azul
  COLOR_A3:        '#8B5CF6',  // 🟣 Morado
  COLOR_LIDAR:     '#000000',  // ⚫ Negro

  // ============================================
  // OCR - TESSERACT (rutas relativas a www/)
  // ============================================
  TESS_IDIOMAS: 'spa+eng',
  TESS_RUTA_WORKER: 'tesseract/worker.min.js',
  TESS_RUTA_CORE: 'tesseract',
  TESS_RUTA_DATOS: 'tesseract/lang-data',
  TESS_PSM: 7,
  TESS_OEM: 1,
  TESS_PRESERVE_SPACES: '1',
  TESS_CONF_MIN: 30,         // Confianza mínima aceptable

  // ============================================
  // OCR - PREPROCESAMIENTO POR CELDA
  // ============================================
  OCR_DENSIDAD_MIN: 0.05,     // Densidad mínima para procesar una celda
  OCR_ESCALA_UMBRAL_BAJO: 15, // Si el texto mide <15px, escalar 3x
  OCR_ESCALA_UMBRAL_MEDIO: 30,// Si el texto mide 15-30px, escalar 2x
  OCR_ESCALA_3X: 3,
  OCR_ESCALA_2X: 2,

  // ============================================
  // OCR - MULTI-PASE (voting)
  // ============================================
  OCR_VOTING_ACTIVO: true,    // Si hay baja confianza, probar variantes
  OCR_VOTING_CONFIANZA: 75,   // Si confianza < este %, activar voting
  OCR_MARGEN_PADDING: 10,     // Margen blanco alrededor de cada celda

  // ============================================
  // DICCIONARIO DE DOMINIO
  // ============================================
  // Palabras que probablemente aparezcan en las tablas
  DICCIONARIO: [
    'MARRIED', 'SINGLE', 'COUPLE', 'DIVORCED', 'WIDOWED',
    'APTO', 'OLA', 'PROMOTOR', 'HOTEL', 'RESORT',
    'MXN', 'USD', 'EUR',
    'FECHA', 'NOMBRE', 'EDAD', 'TOTAL'
  ]
};

console.log('✅ CONFIG v' + CONFIG.VERSION + ' cargado');
