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
  frangi: null,
  capasVisibles: { optica: true, eco: true, a3: true, lvc: true, io: true, frangi: true }
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
  if (st.capasVisibles.frangi && st.frangi) {
    dibujarLineas(canvas, st.frangi.lineasH, st.frangi.lineasV, CONFIG.COLOR_FRANGI, 1);
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
    st.frangi = detectarFrangi(st.brillo, st.ancho, st.alto);
    log('Frangi: H=' + st.frangi.lineasH.length + ' V=' + st.frangi.lineasV.length + ' (' + st.frangi.tiempo.toFixed(0) + 'ms)');
  } catch(e) { log('ERROR Frangi: ' + e.message); st.frangi = { lineasH: [], lineasV: [] }; }

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
  const algoritmos = ['optica', 'eco', 'a3', 'lvc', 'io', 'frangi'];
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
function setup() {
  el('btnCargar').onclick = function() { el('inputImagen').click(); };
  el('inputImagen').onchange = function(e) {
    if (e.target.files && e.target.files[0]) cargarImagen(e.target.files[0]);
  };
  el('btnAnalizar').onclick = analizar;
  el('btnExportar').onclick = exportarVisible;
  el('btnExportarTodo').onclick = exportarTodo;

  el('btnLimpiar').onclick = function() {
    const canvas = el('canvas');
    canvas.width = 0; canvas.height = 0;
    window.estado = { imagenActual: null, brillo: null, ancho: 0, alto: 0,
                     optica: null, eco: null, a3: null, lvc: null, io: null, frangi: null,
                     capasVisibles: { optica: true, eco: true, a3: true, lvc: true, io: true, frangi: true } };
    el('log').textContent = 'Limpiado';
  };

  // Checkboxes
  const map = { chkOptica: 'optica', chkEco: 'eco', chkA3: 'a3', chkLVC: 'lvc', chkIO: 'io', chkFrangi: 'frangi' };
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
