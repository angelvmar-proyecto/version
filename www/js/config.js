// ==============================================
// MAR Caribe v14 - CONFIGURACION LIMPIA
// 5 algoritmos: Optica, Eco, A3, LVC, IO
// ==============================================

const CONFIG = {
  VERSION: '14.0',

  // --- Optica (proyeccion de brillo) ---
  OPTICA_UMBRAL_ADAPTATIVO: 0.30,
  OPTICA_DISTANCIA_MIN_H: 13,
  OPTICA_DISTANCIA_MIN_V: 7,
  OPTICA_SUAVIZADO: 20,

  // --- Eco (cambio de brillo) ---
  ECO_VENTANA: 3,
  ECO_UMBRAL_H: 38,
  ECO_UMBRAL_V: 30,
  ECO_CONTINUIDAD: 0.35,
  ECO_DISTANCIA_MIN_H: 18,
  ECO_DISTANCIA_MIN_V: 20,

  // --- A3 (Sobel ortogonal) ---
  A3_UMBRAL_MAGNITUD: 130,
  A3_UMBRAL_ORTOGONALIDAD: 0.75,
  A3_COBERTURA_MINIMA: 0.35,
  A3_DISTANCIA_MIN: 10,

  // --- LVC (coherencia vertical) ---
  LVC_VENTANA: 2,
  LVC_UMBRAL_DIF: 6,
  LVC_COHERENCIA_MIN: 0.35,
  LVC_DISTANCIA_MIN: 10,

  // --- IO (interseccion ortogonal) ---
  IO_VENTANA_CRUCE: 4,
  IO_UMBRAL_CRUCE: 220,
  IO_CRUCES_MIN: 2,
  IO_DISTANCIA_MIN: 10,

  // --- Continuidad (lineas por píxeles oscuros consecutivos) ---
  CONT_UMBRAL_OSCURO_H: 210,
  CONT_RATIO_MIN_H: 0.55,
  CONT_RUN_MIN_H: 0.40,
  CONT_UMBRAL_OSCURO_V: 225,
  CONT_RATIO_MIN_V: 0.35,
  CONT_RUN_MIN_V: 0.25,
  CONT_GAP_MAX: 35,
  CONT_DISTANCIA_MIN_H: 15,
  CONT_DISTANCIA_MIN_V: 8,

  // --- LIDAR (votacion) ---
  LIDAR_VOTOS_MINIMOS: 2,
  LIDAR_ECO_ALTO: 60,
  LIDAR_ECO_BAJO: 30,
  LIDAR_AGRUPAR_DIST: 0.015,   // proporcion del ancho
  LIDAR_MARGEN_BORDE: 8,
  LIDAR_HUECO_MIN: 60,
  LIDAR_HUECO_BORDE: 15,

  // --- Colores ---
  COLOR_OPTICA: '#FFD700',
  COLOR_ECO_H: '#FF0000',
  COLOR_ECO_V: '#0088FF',
  COLOR_A3: '#8B5CF6',
  COLOR_LVC: '#ec4899',
  COLOR_IO: '#eab308',
  COLOR_LIDAR: '#000000',
  COLOR_CONTINUIDAD: '#00FFFF'
};

// CONFIG_ESC: valores escalados por imagen. Se recalcula con escalarConfig().
window.CONFIG_ESC = Object.assign({}, CONFIG);

// ==============================================
// Escalado proporcional segun tamano de imagen
// ==============================================
function escalarConfig(ancho, alto) {
  // Base de calibracion: 990x1600
  const refAncho = 990;
  const refAlto = 1600;
  const kAncho = ancho / refAncho;
  const kAlto = alto / refAlto;

  CONFIG_ESC = Object.assign({}, CONFIG);
window.CONFIG_ESC = CONFIG_ESC;

  window.CONFIG_ESC.OPTICA_DISTANCIA_MIN_V = Math.max(3, Math.round(CONFIG.OPTICA_DISTANCIA_MIN_V * kAncho));
  window.CONFIG_ESC.OPTICA_DISTANCIA_MIN_H = Math.max(4, Math.round(CONFIG.OPTICA_DISTANCIA_MIN_H * kAlto));

  window.CONFIG_ESC.ECO_DISTANCIA_MIN_V = Math.max(4, Math.round(CONFIG.ECO_DISTANCIA_MIN_V * kAncho));
  window.CONFIG_ESC.ECO_DISTANCIA_MIN_H = Math.max(4, Math.round(CONFIG.ECO_DISTANCIA_MIN_H * kAlto));

  window.CONFIG_ESC.A3_DISTANCIA_MIN = Math.max(4, Math.round(CONFIG.A3_DISTANCIA_MIN * Math.min(kAncho, kAlto)));
  window.CONFIG_ESC.LVC_DISTANCIA_MIN = Math.max(4, Math.round(CONFIG.LVC_DISTANCIA_MIN * kAncho));
  window.CONFIG_ESC.IO_DISTANCIA_MIN = Math.max(4, Math.round(CONFIG.IO_DISTANCIA_MIN * Math.min(kAncho, kAlto)));

  window.CONFIG_ESC.LIDAR_AGRUPAR_DIST = Math.max(4, Math.round(ancho * CONFIG.LIDAR_AGRUPAR_DIST));
  window.CONFIG_ESC.LIDAR_HUECO_MIN = Math.max(30, Math.round(Math.max(ancho, alto) * 0.06));
  window.CONFIG_ESC.LIDAR_HUECO_BORDE = Math.max(8, Math.round(Math.min(ancho, alto) * 0.015));

  return window.CONFIG_ESC;
}

console.log('CONFIG v14 cargado');
