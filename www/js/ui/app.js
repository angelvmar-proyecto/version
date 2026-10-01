// ==============================================
// ui/app.js - Fase 3.5
// 5 algoritmos + checkboxes + export multiple.
// ==============================================

const el = function(id) { return document.getElementById(id); };

function log(msg) {
  const cont = el('log');
  if (!cont) return;
  cont.textContent = msg + '\n' + cont.textContent;
}

window.estado = {
  imagenActual: null,
  brillo: null,
  brilloOptica: null,
  ancho: 0,
  alto: 0,
  optica: null,
  eco: null,
  a3: null,
  lvc: null,
  io: null,
  cont: null,
  capasVisibles: { optica: true, eco: true, a3: true, lvc: true, io: true, cont: true, realce: true, lidar: true, openv: true, ml: true, ws: true, frangi: true }
};

// --- Carga de imagen ---
function cargarImagen(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const st = window.estado;
      st.imagenActual = img;
      st.ancho = img.width;
      st.alto = img.height;
      const canvas = el('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      log('Imagen cargada: ' + img.width + 'x' + img.height);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// --- Redibujado respetando checkboxes ---
function redibujar() {
  const st = window.estado;
  if (!st.imagenActual || !st.optica) return;
  const canvas = el('canvas');
  const ctx = canvas.getContext('2d');
  ctx.drawImage(st.imagenActual, 0, 0);

  if (st.capasVisibles.optica && st.optica) {
    dibujarLineas(canvas, st.optica.lineasH, st.optica.lineasV, CONFIG.COLOR_OPTICA, 2);
  }
  if (st.capasVisibles.eco && st.eco) {
    dibujarLineas(canvas, st.eco.lineasH, null, CONFIG.COLOR_ECO_H, 2);
    dibujarLineas(canvas, null, st.eco.lineasV, CONFIG.COLOR_ECO_V, 2);
  }
  if (st.capasVisibles.a3 && st.a3) {
    dibujarLineas(canvas, st.a3.lineasH, st.a3.lineasV, CONFIG.COLOR_A3, 1);
  }
  if (st.capasVisibles.lvc && st.lvc) {
    dibujarLineas(canvas, st.lvc.lineasH, st.lvc.lineasV, CONFIG.COLOR_LVC, 1);
  }
  if (st.capasVisibles.io && st.io) {
    dibujarLineas(canvas, st.io.lineasH, st.io.lineasV, CONFIG.COLOR_IO, 1);
  }
  if (st.capasVisibles.cont && st.cont) {
    dibujarLineas(canvas, st.cont.lineasH, st.cont.lineasV, CONFIG.COLOR_CONTINUIDAD, 1);
  }
  if (st.capasVisibles.realce && st.realce) {
    dibujarLineas(canvas, st.realce.lineasH, st.realce.lineasV, CONFIG.COLOR_REALCE, 1);
  }
  if (st.capasVisibles.lidar) {
    if (st.lidar) {
      log('🔍 DIBUJANDO LIDAR: H=' + st.lidar.lineasH.length + ' V=' + st.lidar.lineasV.length + ' color=' + CONFIG.COLOR_LIDAR);
      dibujarLineas(canvas, st.lidar.lineasH, st.lidar.lineasV, CONFIG.COLOR_LIDAR, 4);
    } else {
      log('⚠️ LIDAR visible=true pero st.lidar=null');
    }
  } else {
    log('⚠️ LIDAR checkbox desmarcado');
  }
}

// --- Análisis ---
function analizar() {
  const st = window.estado;
  if (!st.imagenActual) { log('Carga una imagen primero'); return; }
  const t0 = performance.now();

  escalarConfig(st.ancho, st.alto);
  log('Config escalada');

  const canvas = el('canvas');
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, st.ancho, st.alto);
  st.brillo = calcularBrillo(imageData);
  st.brilloOptica = calcularBrilloColorAgnostico(imageData);

  // Preprocesamiento avanzado (opcional)
  if (CONFIG.GAMMA_ACTIVO) {
    st.brillo = aplicarGamma(st.brillo, st.ancho, st.alto, CONFIG.GAMMA_VALOR);
    log('🔆 Gamma aplicado (valor=' + CONFIG.GAMMA_VALOR + ')');
  }
  if (CONFIG.CLAHE_ACTIVO) {
    st.brillo = aplicarCLAHE(st.brillo, st.ancho, st.alto, CONFIG.CLAHE_TILES, CONFIG.CLAHE_CLIP);
    log('🎛️ CLAHE aplicado (tiles=' + CONFIG.CLAHE_TILES + ', clip=' + CONFIG.CLAHE_CLIP + ')');
  }

  calcularUmbralesBrillo(st.brillo, st.ancho, st.alto);
  log('Brillo + umbrales calculados');

  try {
    st.optica = detectarOptica(st.brilloOptica || st.brillo, st.ancho, st.alto);
    log('Optica: H=' + st.optica.lineasH.length + ' V=' + st.optica.lineasV.length + ' (' + st.optica.tiempo.toFixed(0) + 'ms)');
  } catch(e) { log('ERROR Optica: ' + e.message); st.optica = { lineasH: [], lineasV: [] }; }

  try {
    st.eco = detectarEco(st.brillo, st.ancho, st.alto);
    log('Eco: H=' + st.eco.lineasH.length + ' V=' + st.eco.lineasV.length + ' (' + st.eco.tiempo.toFixed(0) + 'ms)');
  } catch(e) { log('ERROR Eco: ' + e.message); st.eco = { lineasH: [], lineasV: [] }; }

  try {
    st.a3 = detectarA3(st.brillo, st.ancho, st.alto);
    log('A3: H=' + st.a3.lineasH.length + ' V=' + st.a3.lineasV.length + ' (' + st.a3.tiempo.toFixed(0) + 'ms)');
  } catch(e) { log('ERROR A3: ' + e.message); st.a3 = { lineasH: [], lineasV: [] }; }

  try {
    st.lvc = detectarLVC(st.brillo, st.ancho, st.alto);
    log('LVC: V=' + st.lvc.lineasV.length + ' (' + st.lvc.tiempo.toFixed(0) + 'ms)');
  } catch(e) { log('ERROR LVC: ' + e.message); st.lvc = { lineasH: [], lineasV: [] }; }

  try {
    st.io = detectarIO(st.brillo, st.ancho, st.alto, st.optica.lineasH, st.optica.lineasV);
    log('IO: V=' + st.io.lineasV.length + ' H=' + st.io.lineasH.length + ' (' + st.io.tiempo.toFixed(0) + 'ms)');
  } catch(e) { log('ERROR IO: ' + e.message); st.io = { lineasH: [], lineasV: [] }; }

  try {
    st.cont = detectarContinuidad(st.brillo, st.ancho, st.alto);
    log('Continuidad: H=' + st.cont.lineasH.length + ' V=' + st.cont.lineasV.length + ' (' + st.cont.tiempo.toFixed(0) + 'ms)');
  } catch(e) { log('ERROR Continuidad: ' + e.message); st.cont = { lineasH: [], lineasV: [] }; }

  try {
    st.realce = detectarRealce(st.brillo, st.ancho, st.alto);
    log('Realce: H=' + st.realce.lineasH.length + ' V=' + st.realce.lineasV.length + ' (' + st.realce.tiempo.toFixed(0) + 'ms)');
  } catch(e) { log('ERROR Realce: ' + e.message); st.realce = { lineasH: [], lineasV: [] }; }

  try {
    st.openv = detectarOPENV(st.brillo, st.ancho, st.alto);
    log('OPENV: H=' + st.openv.lineasH.length + ' V=' + st.openv.lineasV.length + ' (' + st.openv.tiempo.toFixed(0) + 'ms)');
  } catch(e) { log('ERROR OPENV: ' + e.message); st.openv = { lineasH: [], lineasV: [] }; }

  try {
    st.ml = detectarML(st.brillo, st.ancho, st.alto);
    log('ML: H=' + st.ml.lineasH.length + ' V=' + st.ml.lineasV.length + ' (' + st.ml.tiempo.toFixed(0) + 'ms)');
  } catch(e) { log('ERROR ML: ' + e.message); st.ml = { lineasH: [], lineasV: [] }; }

  try {
    st.ws = detectarWS(st.brillo, st.ancho, st.alto);
    log('WS: H=' + st.ws.lineasH.length + ' V=' + st.ws.lineasV.length + ' (' + st.ws.tiempo.toFixed(0) + 'ms)');
  } catch(e) { log('ERROR WS: ' + e.message); st.ws = { lineasH: [], lineasV: [] }; }

  try {
    st.frangi = detectarFrangi(st.brillo, st.ancho, st.alto);
    log('Frangi: H=' + st.frangi.lineasH.length + ' V=' + st.frangi.lineasV.length + ' (' + st.frangi.tiempo.toFixed(0) + 'ms)');
  } catch(e) { log('ERROR Frangi: ' + e.message); st.frangi = { lineasH: [], lineasV: [] }; }

  log('DEBUG pre-LIDAR: st=' + typeof st + ', st.optica=' + (st ? typeof st.optica : 'N/A') + ', optica.V=' + (st && st.optica ? st.optica.lineasV.length : 'N/A'));
  try {
    st.lidar = votarLidarYRefinar(st);
    log('LIDAR: H=' + st.lidar.lineasH.length + ' V=' + st.lidar.lineasV.length + ' (' + st.lidar.tiempo.toFixed(0) + 'ms)');
  } catch(e) { log('ERROR LIDAR: ' + e.message); st.lidar = { lineasH: [], lineasV: [] }; }

  redibujar();

  const t1 = performance.now();
  log('--- Total: ' + (t1-t0).toFixed(0) + 'ms ---');
}

// --- Nombre de archivo ---
function nombreArchivo(sufijo) {
  const st = window.estado;
  const d = new Date();
  const fecha = d.getFullYear() + '-' +
                String(d.getMonth()+1).padStart(2,'0') + '-' +
                String(d.getDate()).padStart(2,'0');
  const hora = String(d.getHours()).padStart(2,'0') + 'h' +
               String(d.getMinutes()).padStart(2,'0');
  return 'analisis_v14_' + sufijo + '_' + st.ancho + 'x' + st.alto + '_' + fecha + '_' + hora + '.png';
}

// --- Guardar canvas ---
async function guardarCanvas(nombre) {
  const canvas = el('canvas');
  const dataURL = canvas.toDataURL('image/png');
  const base64 = dataURL.split(',')[1];
  const fs = (typeof Capacitor !== 'undefined' && Capacitor.Plugins) ? Capacitor.Plugins.Filesystem : null;
  if (!fs) { log('ERROR: Filesystem no disponible'); return false; }
  try {
    await fs.writeFile({ path: nombre, data: base64, directory: 'DOCUMENTS' });
    return true;
  } catch(e) {
    log('ERROR al guardar ' + nombre + ': ' + e.message);
    return false;
  }
}

// --- Exportar solo lo visible ---
async function exportarVisible() {
  const st = window.estado;
  if (!st.optica) { log('Analiza primero'); return; }
  const sufijo = Object.keys(st.capasVisibles).filter(function(k){ return st.capasVisibles[k]; }).join('-');
  const nombre = nombreArchivo(sufijo || 'vacio');
  const ok = await guardarCanvas(nombre);
  if (ok) { log('Guardado: ' + nombre); alert('Guardado:\n' + nombre); }
}

// --- Exportar todo (combinado + 5 individuales) ---
async function exportarTodo() {
  const st = window.estado;
  if (!st.optica) { log('Analiza primero'); return; }

  const guardadas = [];

  // 1. Combinado
  await guardarCanvas(nombreArchivo('combinado'));
  guardadas.push('combinado');

  // 2. Uno por uno
  const algoritmos = ['optica', 'eco', 'a3', 'lvc', 'io', 'cont', 'realce', 'lidar', 'openv', 'ml', 'ws', 'frangi'];
  for (let i = 0; i < algoritmos.length; i++) {
    const alg = algoritmos[i];
    Object.keys(st.capasVisibles).forEach(function(k){ st.capasVisibles[k] = false; });
    st.capasVisibles[alg] = true;
    redibujar();
    await guardarCanvas(nombreArchivo(alg));
    guardadas.push(alg);
  }

  // Restaurar todo visible
  Object.keys(st.capasVisibles).forEach(function(k){ st.capasVisibles[k] = true; });
  redibujar();

  log('Guardadas ' + guardadas.length + ' imagenes');
  alert('Guardadas ' + guardadas.length + ' imagenes en Documentos:\n' + guardadas.join(', '));
}

// --- Setup ---

// ==============================================
// Sandbox: aplicar parametros sin rebuild
// ==============================================

function sandboxParamsActuales(fn) {
  const teclas = {
    lidar: ['LIDAR_DIST_AGRUPAR_H','LIDAR_DIST_AGRUPAR_V','LIDAR_MIN_VOTOS','LIDAR_HUECO_MIN','LIDAR_HUECO_BORDE'],
    optica: ['OPTICA_UMBRAL_ADAPTATIVO','OPTICA_DISTANCIA_MIN_H','OPTICA_DISTANCIA_MIN_V','OPTICA_SUAVIZADO'],
    eco: ['ECO_VENTANA','ECO_UMBRAL_H','ECO_UMBRAL_V','ECO_CONTINUIDAD','ECO_DISTANCIA_MIN_H','ECO_DISTANCIA_MIN_V'],
    a3: ['A3_UMBRAL_MAGNITUD','A3_UMBRAL_ORTOGONALIDAD','A3_COBERTURA_MINIMA','A3_DISTANCIA_MIN'],
    lvc: ['LVC_VENTANA','LVC_UMBRAL_DIF','LVC_COHERENCIA_MIN','LVC_DISTANCIA_MIN'],
    io: ['IO_VENTANA_CRUCE','IO_UMBRAL_CRUCE','IO_CRUCES_MIN','IO_DISTANCIA_MIN'],
    cont: ['CONT_UMBRAL_OSCURO_H','CONT_RATIO_MIN_H','CONT_RUN_MIN_H','CONT_UMBRAL_OSCURO_V','CONT_RATIO_MIN_V','CONT_RUN_MIN_V','CONT_GAP_MAX','CONT_DISTANCIA_MIN_H','CONT_DISTANCIA_MIN_V'],
    realce: ['REALCE_CONTRASTE_MIN','REALCE_UMBRAL_FACTOR','REALCE_MIN_RUN_H','REALCE_MIN_RUN_V','REALCE_GAP_MAX','REALCE_DISTANCIA_MIN_H','REALCE_DISTANCIA_MIN_V'],
    openv: ['OPENV_UMBRAL_VALLE','OPENV_DISTANCIA_MIN'],
    ml: ['ML_DISTANCIA_MIN'],
    ws: ['WS_DISTANCIA_MIN'],
    frangi: ['FRANGI_SIGMA','FRANGI_BETA','FRANGI_C_FACTOR','FRANGI_DISTANCIA_MIN'],
    preprocesamiento: ['GAMMA_VALOR','CLAHE_TILES','CLAHE_CLIP']
  };
  const lista = teclas[fn] || [];
  const obj = {};
  lista.forEach(function(k) { obj[k] = CONFIG[k]; });
  return obj;
}

function sandboxAutoFill() {
  const fn = el('sbFunc').value;
  const obj = sandboxParamsActuales(fn);
  el('sbParams').value = JSON.stringify(obj, null, 2);
}

function sandboxEjecutar() {
  const st = window.estado;
  if (!st.brillo) { log('Analiza primero'); return; }

  let params;
  try {
    const txt = el('sbParams').value.trim();
    params = (txt && txt !== '{}') ? JSON.parse(txt) : {};
  } catch(e) {
    log('ERROR JSON: ' + e.message);
    return;
  }

  Object.keys(params).forEach(function(k) {
    if (CONFIG[k] !== undefined) CONFIG[k] = params[k];
    if (window.CONFIG_ESC && window.CONFIG_ESC[k] !== undefined) window.CONFIG_ESC[k] = params[k];
  });

  const fn = el('sbFunc').value;
  log('🧪 Sandbox: ' + fn + ' con ' + Object.keys(params).length + ' params');

  try {
    if (fn === 'lidar') {
      st.lidar = votarLidarYRefinar(st);
      log('LIDAR: H=' + st.lidar.lineasH.length + ' V=' + st.lidar.lineasV.length + ' (' + st.lidar.tiempo.toFixed(0) + 'ms)');
    } else if (fn === 'optica') {
      st.optica = detectarOptica(st.brilloOptica || st.brillo, st.ancho, st.alto);
      log('Optica: H=' + st.optica.lineasH.length + ' V=' + st.optica.lineasV.length);
    } else if (fn === 'eco') {
      st.eco = detectarEco(st.brillo, st.ancho, st.alto);
      log('Eco: H=' + st.eco.lineasH.length + ' V=' + st.eco.lineasV.length);
    } else if (fn === 'a3') {
      st.a3 = detectarA3(st.brillo, st.ancho, st.alto);
      log('A3: H=' + st.a3.lineasH.length + ' V=' + st.a3.lineasV.length);
    } else if (fn === 'lvc') {
      st.lvc = detectarLVC(st.brillo, st.ancho, st.alto);
      log('LVC: V=' + st.lvc.lineasV.length);
    } else if (fn === 'io') {
      st.io = detectarIO(st.brillo, st.ancho, st.alto, st.optica.lineasH, st.optica.lineasV);
      log('IO: V=' + st.io.lineasV.length + ' H=' + st.io.lineasH.length);
    } else if (fn === 'cont') {
      st.cont = detectarContinuidad(st.brillo, st.ancho, st.alto);
      log('Continuidad: H=' + st.cont.lineasH.length + ' V=' + st.cont.lineasV.length);
    } else if (fn === 'realce') {
      st.realce = detectarRealce(st.brillo, st.ancho, st.alto);
      log('Realce: H=' + st.realce.lineasH.length + ' V=' + st.realce.lineasV.length);
    } else if (fn === 'openv') {
      st.openv = detectarOPENV(st.brillo, st.ancho, st.alto);
      log('OPENV: H=' + st.openv.lineasH.length + ' V=' + st.openv.lineasV.length);
    } else if (fn === 'ml') {
      st.ml = detectarML(st.brillo, st.ancho, st.alto);
      log('ML: H=' + st.ml.lineasH.length + ' V=' + st.ml.lineasV.length);
    } else if (fn === 'ws') {
      st.ws = detectarWS(st.brillo, st.ancho, st.alto);
      log('WS: H=' + st.ws.lineasH.length + ' V=' + st.ws.lineasV.length);
    } else if (fn === 'frangi') {
      st.frangi = detectarFrangi(st.brillo, st.ancho, st.alto);
      log('Frangi: H=' + st.frangi.lineasH.length + ' V=' + st.frangi.lineasV.length);
    }

    // Si cambio un algoritmo, re-votar LIDAR
    if (fn !== 'lidar' && st.lidar !== null) {
      st.lidar = votarLidarYRefinar(st);
      log('LIDAR (re-votado): H=' + st.lidar.lineasH.length + ' V=' + st.lidar.lineasV.length);
    }
    redibujar();
  } catch(e) {
    log('ERROR: ' + e.message);
  }
}

function setup() {
  ['optica','eco','a3','lvc','io','cont','realce','lidar','openv','ml','ws','frangi'].forEach(function(k){ if (!window.estado.capasVisibles[k]) window.estado.capasVisibles[k] = true; });
  el('btnCargar').onclick = function() { el('inputImagen').click(); };
  el('inputImagen').onchange = function(e) {
    if (e.target.files && e.target.files[0]) cargarImagen(e.target.files[0]);
  };
  el('btnAnalizar').onclick = analizar;
  const sbRun = el('sbRun');
  if (sbRun) sbRun.onclick = sandboxEjecutar;
  const sbAF = el('sbAutoFill');
  if (sbAF) sbAF.onclick = sandboxAutoFill;
  el('btnExportar').onclick = exportarVisible;
  el('btnExportarTodo').onclick = exportarTodo;

  el('btnLimpiar').onclick = function() {
    const canvas = el('canvas');
    canvas.width = 0; canvas.height = 0;
    window.estado = { imagenActual: null, brillo: null, ancho: 0, alto: 0,
                     optica: null, eco: null, a3: null, lvc: null, io: null, cont: null,
                     capasVisibles: { optica: true, eco: true, a3: true, lvc: true, io: true, cont: true, realce: true, lidar: true, openv: true, ml: true, ws: true, frangi: true } };
    el('log').textContent = 'Limpiado';
  };

  // Checkboxes de preprocesamiento
  const chkGamma = el('chkGamma');
  if (chkGamma) chkGamma.addEventListener('change', function() {
    CONFIG.GAMMA_ACTIVO = this.checked;
    log('Gamma ' + (this.checked ? 'ON' : 'OFF'));
  });
  const chkCLAHE = el('chkCLAHE');
  if (chkCLAHE) chkCLAHE.addEventListener('change', function() {
    CONFIG.CLAHE_ACTIVO = this.checked;
    log('CLAHE ' + (this.checked ? 'ON' : 'OFF'));
  });

  // Checkboxes de capas
  const map = { chkOptica: 'optica', chkEco: 'eco', chkA3: 'a3', chkLVC: 'lvc', chkIO: 'io', chkCont: 'cont', chkRealce: 'realce', chkLidar: 'lidar', chkOPENV: 'openv', chkML: 'ml', chkWS: 'ws', chkFrangi: 'frangi' };;
  Object.keys(map).forEach(function(id) {
    const c = el(id);
    if (c) c.addEventListener('change', function() {
      window.estado.capasVisibles[map[id]] = this.checked;
      redibujar();
    });
  });

  console.log('app.js v3.5 listo');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setup);
} else {
  setup();
}
