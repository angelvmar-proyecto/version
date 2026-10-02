// ==============================================
// MAR Caribe v14 - CONFIGURACION LIMPIA
// 5 algoritmos: Optica, Eco, A3, LVC, IO
// ==============================================

const BUILD_TAG = 'v14.162-opt-adaptativo';

const CONFIG = {
  VERSION: '14.0',

  // --- Preprocesamiento avanzado (aplicado a la imagen completa antes de algoritmos) ---
  GAMMA_ACTIVO: false,
  GAMMA_VALOR: 1.8,
  CLAHE_ACTIVO: false,
  CLAHE_TILES: 8,
  CLAHE_CLIP: 2.5,

  // --- Optica (proyeccion de brillo) ---
  OPTICA_UMBRAL_ADAPTATIVO: 0.75,
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
  A3_COBERTURA_MINIMA: 0.15,
  A3_DISTANCIA_MIN: 10,

  // --- LVC (coherencia vertical) ---
  LVC_VENTANA: 2,
  LVC_UMBRAL_DIF: 6,
  LVC_COHERENCIA_MIN: 0.42,
  LVC_DISTANCIA_MIN: 10,

  // --- IO (interseccion ortogonal) ---
  IO_VENTANA_CRUCE: 4,
  IO_UMBRAL_CRUCE: 220,
  IO_CRUCES_MIN: 4,
  IO_DISTANCIA_MIN: 10,

  // --- Continuidad (lineas por píxeles oscuros consecutivos) ---
  CONT_UMBRAL_OSCURO_H: 210,
  CONT_RATIO_MIN_H: 0.50,
  CONT_RUN_MIN_H: 0.40,
  CONT_UMBRAL_OSCURO_V: 225,
  CONT_RATIO_MIN_V: 0.35,
  CONT_RUN_MIN_V: 0.25,
  CONT_GAP_MAX: 35,
  CONT_DISTANCIA_MIN_H: 15,
  CONT_DISTANCIA_MIN_V: 8,

  // --- OPENV (opening vertical morfologico) ---
  OPENV_UMBRAL_VALLE: 15,
  OPENV_DISTANCIA_MIN: 10,

  // --- ML (minimo local) ---
  ML_DISTANCIA_MIN: 8,

  // --- WS (whitespace) ---
  WS_DISTANCIA_MIN: 8,

  // --- Frangi (vesselness) ---
  FRANGI_SIGMA: 2.0,
  FRANGI_BETA: 0.5,
  FRANGI_C_FACTOR: 0.5,
  FRANGI_DISTANCIA_MIN: 10,

  // --- Realce (umbral adaptativo por fila/columna) ---
  REALCE_CONTRASTE_MIN: 35,
  REALCE_UMBRAL_FACTOR: 0.65,
  REALCE_MIN_RUN_H: 0.50,
  REALCE_MIN_RUN_V: 0.45,
  REALCE_GAP_MAX: 30,
  REALCE_DISTANCIA_MIN_H: 12,
  REALCE_DISTANCIA_MIN_V: 10,

  // --- LIDAR (votacion) ---
  LIDAR_DIST_AGRUPAR_H: 12,
  LIDAR_DIST_AGRUPAR_V: 12,
  LIDAR_MIN_VOTOS: 2,
  LIDAR_PESOS: { optica: 2, eco: 1, io: 1, cont: 1, realce: 1, a3: 0, lvc: 0 },
  LIDAR_HUECO_MIN: 60,
  LIDAR_HUECO_BORDE: 15,

  // --- Colores ---
  COLOR_OPTICA: '#FF00FF',
  COLOR_ECO_H: '#00FFFF',
  COLOR_ECO_V: '#0000FF',
  COLOR_A3: '#FF00AA',
  COLOR_LVC: '#00FF00',
  COLOR_IO: '#FF6600',
  COLOR_LIDAR: '#000000',
  COLOR_CONTINUIDAD: '#FFFF00',
  COLOR_REALCE: '#8800FF',
  COLOR_OPENV: '#22d3ee',
  COLOR_ML: '#84cc16',
  COLOR_WS: '#f97316',
  COLOR_FRANGI: '#14b8a6'
};

// CONFIG_ESC: valores escalados por imagen. Se recalcula con escalarConfig().
window.CONFIG_ESC = Object.assign({}, CONFIG);

// ==============================================
// Escalado proporcional segun tamano de imagen
// ==============================================
function escalarConfig(ancho, alto) {
  window.CONFIG_ESC = Object.assign({}, CONFIG);

  // Formulas proporcionales al tamaño de imagen
  // (Referencia original: 990 x 1600)

  // === OPTICA ===
  window.CONFIG_ESC.OPTICA_DISTANCIA_MIN_H = Math.max(4, Math.round(alto * 0.008));
  window.CONFIG_ESC.OPTICA_DISTANCIA_MIN_V = Math.max(4, Math.round(ancho * 0.007));
  window.CONFIG_ESC.OPTICA_SUAVIZADO = Math.max(3, Math.round(alto * 0.0125));

  // === ECO ===
  window.CONFIG_ESC.ECO_VENTANA = Math.max(1, Math.round(ancho * 0.003));
  window.CONFIG_ESC.ECO_DISTANCIA_MIN_H = Math.max(4, Math.round(alto * 0.011));
  window.CONFIG_ESC.ECO_DISTANCIA_MIN_V = Math.max(4, Math.round(ancho * 0.020));

  // === A3 ===
  window.CONFIG_ESC.A3_DISTANCIA_MIN = Math.max(4, Math.round(Math.min(ancho, alto) * 0.010));

  // === LVC ===
  window.CONFIG_ESC.LVC_VENTANA = Math.max(1, Math.round(ancho * 0.002));
  window.CONFIG_ESC.LVC_DISTANCIA_MIN = Math.max(4, Math.round(ancho * 0.010));

  // === IO ===
  window.CONFIG_ESC.IO_VENTANA_CRUCE = Math.max(2, Math.round(Math.min(ancho, alto) * 0.004));
  window.CONFIG_ESC.IO_DISTANCIA_MIN = Math.max(4, Math.round(Math.min(ancho, alto) * 0.010));

  // === CONTINUIDAD ===
  window.CONFIG_ESC.CONT_GAP_MAX = Math.max(8, Math.round(Math.max(ancho, alto) * 0.022));
  window.CONFIG_ESC.CONT_DISTANCIA_MIN_H = Math.max(4, Math.round(alto * 0.009));
  window.CONFIG_ESC.CONT_DISTANCIA_MIN_V = Math.max(4, Math.round(ancho * 0.008));

  // === OPENV ===
  window.CONFIG_ESC.OPENV_DISTANCIA_MIN = Math.max(4, Math.round(Math.min(ancho, alto) * 0.010));

  // === ML ===
  window.CONFIG_ESC.ML_DISTANCIA_MIN = Math.max(4, Math.round(Math.min(ancho, alto) * 0.018));

  // === WS ===
  window.CONFIG_ESC.WS_DISTANCIA_MIN = Math.max(4, Math.round(Math.min(ancho, alto) * 0.008));

  // === FRANGI ===
  window.CONFIG_ESC.FRANGI_DISTANCIA_MIN = Math.max(4, Math.round(Math.min(ancho, alto) * 0.010));

  // === REALCE ===
  window.CONFIG_ESC.REALCE_GAP_MAX = Math.max(8, Math.round(Math.max(ancho, alto) * 0.019));
  window.CONFIG_ESC.REALCE_DISTANCIA_MIN_H = Math.max(4, Math.round(alto * 0.0075));
  window.CONFIG_ESC.REALCE_DISTANCIA_MIN_V = Math.max(4, Math.round(ancho * 0.010));

  // === LIDAR ===
  window.CONFIG_ESC.LIDAR_DIST_AGRUPAR_H = Math.max(4, Math.round(alto * 0.0075));
  window.CONFIG_ESC.LIDAR_DIST_AGRUPAR_V = Math.max(4, Math.round(ancho * 0.012));
  window.CONFIG_ESC.LIDAR_HUECO_MIN = Math.max(20, Math.round(Math.max(ancho, alto) * 0.0375));
  window.CONFIG_ESC.LIDAR_HUECO_BORDE = Math.max(8, Math.round(Math.min(ancho, alto) * 0.015));

  return window.CONFIG_ESC;
}

// ==============================================
// calcularUmbralesBrillo: percentiles del histograma
// ==============================================
function calcularUmbralesBrillo(brillo, ancho, alto) {
  const hist = new Array(256).fill(0);
  for (let y = 0; y < alto; y++) {
    const fila = brillo[y];
    for (let x = 0; x < ancho; x++) {
      hist[fila[x]]++;
    }
  }
  const total = ancho * alto;

  function percentil(p) {
    let acum = 0;
    const objetivo = total * p;
    for (let i = 0; i < 256; i++) {
      acum += hist[i];
      if (acum >= objetivo) return i;
    }
    return 255;
  }

  const p10 = percentil(0.10);
  const p85 = percentil(0.85);
  const p90 = percentil(0.90);
  const rango = Math.max(1, p90 - p10);

  // Umbrales absolutos (percentil)
  window.CONFIG_ESC.CONT_UMBRAL_OSCURO_H = p85;
  window.CONFIG_ESC.CONT_UMBRAL_OSCURO_V = p85;
  window.CONFIG_ESC.IO_UMBRAL_CRUCE = p85;

  // Umbrales de contraste (relativos al rango dinamico)
  window.CONFIG_ESC.ECO_UMBRAL_H = Math.max(8, Math.round(rango * 0.50));
  window.CONFIG_ESC.ECO_UMBRAL_V = Math.max(8, Math.round(rango * 0.18));
  window.CONFIG_ESC.REALCE_CONTRASTE_MIN = Math.max(10, Math.round(rango * 0.20));
  window.CONFIG_ESC.LVC_UMBRAL_DIF = Math.max(3, Math.round(rango * 0.035));
  window.CONFIG_ESC.A3_UMBRAL_MAGNITUD = Math.max(30, Math.round(rango * 0.75));
  window.CONFIG_ESC.OPENV_UMBRAL_VALLE = Math.max(50, Math.round(rango * 0.20));

  return { p10, p85, p90, rango };
}


console.log('CONFIG v14 cargado');
