// ==============================================
// ui/app.js - Fase 1
// Orquesta carga de imagen, brillo, perfiles.
// ==============================================

const el = function(id) { return document.getElementById(id); };

function log(msg) {
  const cont = el('log');
  if (!cont) return;
  cont.textContent = msg + '\n' + cont.textContent;
}

// --- Estado global ---
window.estado = {
  imagenActual: null,
  brillo: null,
  ancho: 0,
  alto: 0
};

// --- Cargar imagen ---
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
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      log('Imagen cargada: ' + img.width + 'x' + img.height);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// --- Analizar ---
function analizar() {
  const st = window.estado;
  if (!st.imagenActual) { log('Carga una imagen primero'); return; }

  const t0 = performance.now();

  // Config escalada
  escalarConfig(st.ancho, st.alto);
  log('Config escalada OK');

  // Calcular brillo
  const canvas = el('canvas');
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, st.ancho, st.alto);
  st.brillo = calcularBrillo(imageData);
  log('Brillo calculado');

  // Perfiles
  const pH = perfilH(st.brillo, st.alto, st.ancho);
  const pV = perfilV(st.brillo, st.alto, st.ancho);
  log('Perfiles H/V calculados');

  // Estadisticas simples
  const minH = Math.min.apply(null, pH).toFixed(1);
  const maxH = Math.max.apply(null, pH).toFixed(1);
  const minV = Math.min.apply(null, pV).toFixed(1);
  const maxV = Math.max.apply(null, pV).toFixed(1);

  log('Perfil H: min=' + minH + ' max=' + maxH);
  log('Perfil V: min=' + minV + ' max=' + maxV);

  const t1 = performance.now();
  log('Tiempo total: ' + (t1 - t0).toFixed(0) + 'ms');
}

// --- Setup ---
function setup() {
  el('btnCargar').onclick = function() { el('inputImagen').click(); };
  el('inputImagen').onchange = function(e) {
    if (e.target.files && e.target.files[0]) cargarImagen(e.target.files[0]);
  };
  el('btnAnalizar').onclick = analizar;
  el('btnLimpiar').onclick = function() {
    const canvas = el('canvas');
    canvas.width = 0; canvas.height = 0;
    window.estado = { imagenActual: null, brillo: null, ancho: 0, alto: 0 };
    el('log').textContent = 'Limpiado';
  };
  console.log('app.js listo');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setup);
} else {
  setup();
}
