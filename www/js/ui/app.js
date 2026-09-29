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
  ancho: 0,
  alto: 0,
  optica: null,
  eco: null,
  a3: null,
  lvc: null,
  io: null,
  cont: null,
  capasVisibles: { optica: true, eco: true, a3: true, lvc: true, io: true, cont: true }
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
  log('Brillo OK');

  try {
    st.optica = detectarOptica(st.brillo, st.ancho, st.alto);
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
    st.lidar = ejecutarLidar(st);
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
  const algoritmos = ['optica', 'eco', 'a3', 'lvc', 'io', 'cont'];
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
    realce: ['REALCE_CONTRASTE_MIN','REALCE_UMBRAL_FACTOR','REALCE_MIN_RUN_H','REALCE_MIN_RUN_V','REALCE_GAP_MAX','REALCE_DISTANCIA_MIN_H','REALCE_DISTANCIA_MIN_V']
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
      st.lidar = ejecutarLidar(st);
      log('LIDAR: H=' + st.lidar.lineasH.length + ' V=' + st.lidar.lineasV.length + ' (' + st.lidar.tiempo.toFixed(0) + 'ms)');
    } else if (fn === 'optica') {
      st.optica = detectarOptica(st.brillo, st.ancho, st.alto);
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
    }

    // Si cambio un algoritmo, re-votar LIDAR
    if (fn !== 'lidar' && st.lidar !== null) {
      st.lidar = ejecutarLidar(st);
      log('LIDAR (re-votado): H=' + st.lidar.lineasH.length + ' V=' + st.lidar.lineasV.length);
    }
    redibujar();
  } catch(e) {
    log('ERROR: ' + e.message);
  }
}

function setup() {
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
                     capasVisibles: { optica: true, eco: true, a3: true, lvc: true, io: true, cont: true } };
    el('log').textContent = 'Limpiado';
  };

  // Checkboxes
  const map = { chkOptica: 'optica', chkEco: 'eco', chkA3: 'a3', chkLVC: 'lvc', chkIO: 'io', chkCont: 'cont' };
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
