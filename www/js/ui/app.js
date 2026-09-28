// ==============================================
// ui/app.js - Fase 2
// Optica + Eco. Dibuja capas.
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
  eco: null
};

function cargarImagen(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      window.estado.imagenActual = img;
      window.estado.ancho = img.width;
      window.estado.alto = img.height;

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

  // --- OPTICA ---
  try {
    st.optica = detectarOptica(st.brillo, st.ancho, st.alto);
    log('Optica: H=' + st.optica.lineasH.length + ' V=' + st.optica.lineasV.length + ' (' + st.optica.tiempo.toFixed(0) + 'ms)');
  } catch(e) {
    log('ERROR Optica: ' + e.message);
    st.optica = { lineasH: [], lineasV: [] };
  }

  // --- ECO ---
  try {
    st.eco = detectarEco(st.brillo, st.ancho, st.alto);
    log('Eco: H=' + st.eco.lineasH.length + ' V=' + st.eco.lineasV.length + ' (' + st.eco.tiempo.toFixed(0) + 'ms)');
  } catch(e) {
    log('ERROR Eco: ' + e.message);
    st.eco = { lineasH: [], lineasV: [] };
  }

  // Redibujar imagen original y superponer capas
  ctx.drawImage(st.imagenActual, 0, 0);
  dibujarLineas(canvas, st.optica.lineasH, st.optica.lineasV, CONFIG.COLOR_OPTICA, 2);
  dibujarLineas(canvas, st.eco.lineasH, null, CONFIG.COLOR_ECO_H, 2);
  dibujarLineas(canvas, null, st.eco.lineasV, CONFIG.COLOR_ECO_V, 2);

  const t1 = performance.now();
  log('--- Total: ' + (t1-t0).toFixed(0) + 'ms ---');
  log('Colores: Optica=amarillo, Eco H=rojo, Eco V=azul');
}


// --- Exportar análisis al almacenamiento ---
async function exportarAnalisis() {
  const st = window.estado;
  if (!st.imagenActual) { log('Carga una imagen primero'); return; }
  if (!st.optica) { log('Analiza primero'); return; }

  const canvas = el('canvas');
  if (!canvas || canvas.width === 0) { log('Canvas vacío'); return; }

  // Nombre descriptivo: algoritmo(s) + dimensiones + timestamp legible
  const d = new Date();
  const fecha = d.getFullYear() + '-' +
                String(d.getMonth()+1).padStart(2,'0') + '-' +
                String(d.getDate()).padStart(2,'0');
  const hora = String(d.getHours()).padStart(2,'0') + 'h' +
               String(d.getMinutes()).padStart(2,'0');
  const nombre = 'analisis_v14_optica-eco_' + st.ancho + 'x' + st.alto + '_' + fecha + '_' + hora + '.png';

  // Convertir canvas a base64
  const dataURL = canvas.toDataURL('image/png');
  const base64 = dataURL.split(',')[1];

  try {
    const fs = (typeof Capacitor !== 'undefined' && Capacitor.Plugins) ? Capacitor.Plugins.Filesystem : null;
    if (!fs) { log('ERROR: Filesystem no disponible'); return; }
    await fs.writeFile({
      path: nombre,
      data: base64,
      directory: 'DOCUMENTS'
    });
    log('💾 Guardado: ' + nombre);
    alert('Guardado en Documentos:\n' + nombre);
  } catch(e) {
    log('ERROR al guardar: ' + e.message);
    alert('Error: ' + e.message);
  }
}

function setup() {
  el('btnCargar').onclick = function() { el('inputImagen').click(); };
  el('inputImagen').onchange = function(e) {
    if (e.target.files && e.target.files[0]) cargarImagen(e.target.files[0]);
  };
  el('btnAnalizar').onclick = analizar;
  const btnExp = el('btnExportar');
  if (btnExp) btnExp.onclick = exportarAnalisis;
  el('btnLimpiar').onclick = function() {
    const canvas = el('canvas');
    canvas.width = 0; canvas.height = 0;
    window.estado = { imagenActual: null, brillo: null, ancho: 0, alto: 0, optica: null, eco: null };
    el('log').textContent = 'Limpiado';
  };
  console.log('app.js v2 listo');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setup);
} else {
  setup();
}
