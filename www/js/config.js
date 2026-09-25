// ==============================================
// MAR Caribe v12.0 - CONFIGURACIÓN GLOBAL
// Valores calibrados sobre tabla densa real
// Incluye: OCR_FILA0_ENCABEZADO y LIDAR_MARGEN_BORDE
// ==============================================

const CONFIG_DEFAULTS = {
  VERSION: '12.0',

  // Preprocesamiento
  CRR_ACTIVO: false,
  CRR_UMBRAL: 80,
  BS_ACTIVO: true,
  BS_TAMANIO_BLOQUE: 30,
  BS_UMBRAL_SATURACION: 0.20,

  // Óptica (calibrado: 37→50 verticales en tabla densa)
  OPTICA_UMBRAL_ADAPTATIVO: 0.30,
  OPTICA_DISTANCIA_MIN_H: 15,
  OPTICA_DISTANCIA_MIN_V: 12,
  OPTICA_SUAVIZADO: 5,

  // Ecografía
  ECO_VENTANA: 3,
  ECO_UMBRAL_H: 38,
  ECO_UMBRAL_V: 42,
  ECO_CONTINUIDAD: 0.55,
  ECO_DISTANCIA_MIN_H: 18,
  ECO_DISTANCIA_MIN_V: 20,

  // A3 (calibrado: 21→40+ verticales en tabla densa)
  A3_UMBRAL_MAGNITUD: 180,
  A3_UMBRAL_ORTOGONALIDAD: 0.75,
  A3_COBERTURA_MINIMA: 0.50,
  A3_DISTANCIA_MIN: 10,

  // A3 para VERTICALES (independiente de las horizontales)
  // Permisivo para detectar columnas angostas
  A3_UMBRAL_MAGNITUD_V: 130,
  A3_UMBRAL_ORTOGONALIDAD_V: 0.75,
  A3_COBERTURA_MINIMA_V: 0.20,

  // Ajuste local
  RANGO_AJUSTE: 2,

  // LIDAR
  LIDAR_VOTOS_MINIMOS: 2,
  LIDAR_ECO_ALTO: 60,
  LIDAR_ECO_BAJO: 30,
  LIDAR_AGRUPAR_DIST: 4,
  LIDAR_MARGEN_BORDE: 8,

  // Visualización
  ANCHO_LINEA: 2,
  ZOOM_MIN: 0.5,
  ZOOM_MAX: 5,
  ZOOM_PASO: 0.25,

  // Colores
  COLOR_OPTICA: '#FFD700',
  COLOR_ECO_H: '#FF0000',
  COLOR_ECO_V: '#0088FF',
  COLOR_A3: '#8B5CF6',
  COLOR_LIDAR: '#000000',

  // OCR
  TESS_IDIOMAS: 'spa+eng',
  TESS_PSM: 7,
  TESS_OEM: 1,
  TESS_CONF_MIN: 30,
  OCR_DENSIDAD_MIN: 0.05,
  OCR_ESCALA_UMBRAL_BAJO: 15,
  OCR_ESCALA_UMBRAL_MEDIO: 30,
  OCR_ESCALA_3X: 3,
  OCR_ESCALA_2X: 2,
  OCR_VOTING_ACTIVO: true,
  OCR_VOTING_CONFIANZA: 75,
  OCR_MARGEN_PADDING: 10,
  OCR_MARGEN_CELDA: 3,
  OCR_BINARIZAR: false,
  OCR_FILA0_ENCABEZADO: false,
  RETINA_EN_RAPIDO: false,
  RETINA_RAPIDO_RADIO: 8,
  RETINA_RAPIDO_FUERZA: 0.8,
  APRENDIZAJE_ACTIVO: true,

  // Retina por celda
  RETINA_ACTIVO: true,
  RETINA_RADIO: 15,
  RETINA_FUERZA_CONTRASTE: 1.5,
  RETINA_FUERZA_BORDES: 0.5,
  RETINA_UMBRAL_APLICAR: 60,

  // Retina global (antes de detección de líneas)
  RETINA_GLOBAL_ACTIVO: true,
  RETINA_GLOBAL_FUERZA: 1.3,
  RETINA_GLOBAL_RADIO: 15,

  // Diccionario
  DICCIONARIO: [
    'MARRIED', 'SINGLE', 'COUPLE', 'DIVORCED', 'WIDOWED',
    'APTO', 'OLA', 'PROMOTOR', 'HOTEL', 'RESORT',
    'MXN', 'USD', 'EUR',
    'FECHA', 'NOMBRE', 'EDAD', 'TOTAL'
  ]
};

// CONFIG es una copia modificable de CONFIG_DEFAULTS
let CONFIG = JSON.parse(JSON.stringify(CONFIG_DEFAULTS));

// Cargar ajustes guardados de localStorage si existen
(function cargarAjustesGuardados() {
  try {
    const guardados = localStorage.getItem('mar_caribe_config_override');
    if (guardados) {
      const ajustes = JSON.parse(guardados);
      Object.keys(ajustes).forEach(function(k) {
        if (CONFIG[k] !== undefined) {
          CONFIG[k] = ajustes[k];
        }
      });
      console.log('✅ Ajustes cargados de localStorage:', Object.keys(ajustes).length, 'parámetros');
    }
  } catch (e) {
    console.warn('⚠️ No se pudieron cargar ajustes guardados:', e);
  }
})();

console.log('✅ CONFIG v' + CONFIG.VERSION + ' cargado');
