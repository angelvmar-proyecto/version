// ==============================================
// ui/runner_tabla.js
// Pipeline: imagen → líneas → grilla → OCR por fila → CSV.
// ==============================================

window.runnerTabla = {
  imagen: null,
  referencia: null,
  ejecutando: false,
  cancelar: false
};

function tabLog(msg) {
  const el = document.getElementById('tabLog');
  if (!el) { console.log('[TAB] ' + msg); return; }
  el.textContent = msg + '\n' + el.textContent;
  console.log('[TAB] ' + msg);
}

function tabCargarImagenClick() {
  const inp = document.getElementById('tabInputImg');
  if (inp) { inp.value = ''; inp.click(); }
}

async function tabProcesarImagen(file) {
  try {
    const img = await new Promise(function(resolve, reject) {
      const reader = new FileReader();
      reader.onload = function(e) {
        const im = new Image();
        im.onload = function() { resolve(im); };
        im.onerror = reject;
        im.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    window.runnerTabla.imagen = {
      nombre: file.name.replace('.jpg','').replace('.png',''),
      img: img,
      ancho: img.width,
      alto: img.height
    };
    tabLog('Imagen cargada: ' + window.runnerTabla.imagen.nombre + ' (' + img.width + 'x' + img.height + ')');
  } catch(e) {
    tabLog('Error cargando: ' + e.message);
  }
}

// Corre el pipeline de líneas (13 detectores + LIDAR)
async function tabDetectarLineas(img) {
  tabLog('Extrayendo brillo...');
  const canvas = document.createElement('canvas');
  canvas.width = img.ancho;
  canvas.height = img.alto;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img.img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.ancho, img.alto);

  const st = {
    brillo: calcularBrillo(imageData),
    ancho: img.ancho,
    alto: img.alto
  };
  st.brilloOriginal = st.brillo;

  calcularUmbralesBrillo(st.brillo, st.ancho, st.alto);
  tabLog('Umbrales calculados');

  tabLog('Ejecutando detectores...');
  try { st.optica = detectarOptica(st.brillo, st.ancho, st.alto); } catch(e) { st.optica = { lineasH: [], lineasV: [] }; }
  try { st.eco = detectarEco(st.brillo, st.ancho, st.alto); } catch(e) { st.eco = { lineasH: [], lineasV: [] }; }
  try { st.a3 = detectarA3(st.brillo, st.ancho, st.alto); } catch(e) { st.a3 = { lineasH: [], lineasV: [] }; }
  try { st.morfo = detectarMorfologico(st.brilloOriginal, st.ancho, st.alto); } catch(e) { st.morfo = { lineasH: [], lineasV: [] }; }
  try { st.lvc = detectarLVC(st.brillo, st.ancho, st.alto); } catch(e) { st.lvc = { lineasH: [], lineasV: [] }; }
  try { st.io = detectarIO(st.brillo, st.ancho, st.alto, st.optica.lineasH, st.optica.lineasV); } catch(e) { st.io = { lineasH: [], lineasV: [] }; }
  try { st.cont = detectarContinuidad(st.brillo, st.ancho, st.alto); } catch(e) { st.cont = { lineasH: [], lineasV: [] }; }
  try { st.realce = detectarRealce(st.brillo, st.ancho, st.alto); } catch(e) { st.realce = { lineasH: [], lineasV: [] }; }
  try { st.openv = detectarOPENV(st.brillo, st.ancho, st.alto); } catch(e) { st.openv = { lineasH: [], lineasV: [] }; }
  try { st.ml = detectarML(st.brillo, st.ancho, st.alto); } catch(e) { st.ml = { lineasH: [], lineasV: [] }; }
  try { st.ws = detectarWS(st.brillo, st.ancho, st.alto); } catch(e) { st.ws = { lineasH: [], lineasV: [] }; }
  try { st.frangi = detectarFrangi(st.brillo, st.ancho, st.alto); } catch(e) { st.frangi = { lineasH: [], lineasV: [] }; }
  try { st.blackhat = detectarBlackHat(st.brillo, st.ancho, st.alto); } catch(e) { st.blackhat = { lineasH: [], lineasV: [] }; }
  try { st.hough = detectarHough(st.brillo, st.ancho, st.alto); } catch(e) { st.hough = { lineasH: [], lineasV: [] }; }

  let lidar;
  try {
    lidar = votarLidarYRefinar(st);
  } catch(e) {
    tabLog('Error LIDAR: ' + e.message);
    lidar = { lineasH: [], lineasV: [] };
  }
  tabLog('LIDAR: H=' + (lidar.lineasH || []).length + ' V=' + (lidar.lineasV || []).length);

  return lidar;
}

async function tabIniciar() {
  if (window.runnerTabla.ejecutando) { tabLog('Ya ejecutando'); return; }
  if (!window.runnerTabla.imagen) { tabLog('Carga una imagen primero'); return; }

  window.runnerTabla.ejecutando = true;
  window.runnerTabla.cancelar = false;

  try {
    const img = window.runnerTabla.imagen;
    tabLog('=== Procesando ' + img.nombre + ' (' + img.ancho + 'x' + img.alto + ') ===');

    // Paso 1: líneas
    const lidar = await tabDetectarLineas(img);
    if (window.runnerTabla.cancelar) { tabLog('Cancelado'); return; }

    if (!lidar.lineasH || lidar.lineasH.length < 3 || !lidar.lineasV || lidar.lineasV.length < 3) {
      tabLog('ERROR: muy pocas líneas detectadas');
      return;
    }

    // Paso 2: filtrar líneas duplicadas
    const lineasH = tablaFiltrarLineas(lidar.lineasH, 15);
    const lineasV = tablaFiltrarLineas(lidar.lineasV, 20);
    tabLog('Líneas filtradas: H=' + lineasH.length + ' V=' + lineasV.length);
    tabLog('[POS] V=' + JSON.stringify(lineasV));
    tabLog('[POS] H=' + JSON.stringify(lineasH));

    // Paso 3: grilla
    const grilla = tablaConstruirGrilla(lineasH, lineasV);
    tabLog('Grilla: ' + grilla.numFilas + ' filas x ' + grilla.numCols + ' cols');

    // Guardar para el próximo paso
    window.runnerTabla.grilla = grilla;
    window.runnerTabla.img = img;

    tabLog('Listo. Líneas y grilla construidas. Pendiente: ML Kit por fila.');
  } catch(e) {
    tabLog('ERROR: ' + e.message);
    console.error(e);
  } finally {
    window.runnerTabla.ejecutando = false;
  }
}

function tabParar() {
  window.runnerTabla.cancelar = true;
  tabLog('Parando...');
}

window.tabCargarImagenClick = tabCargarImagenClick;
window.tabProcesarImagen = tabProcesarImagen;
window.tabIniciar = tabIniciar;
window.tabParar = tabParar;

// --- Enganche de botones ---
function tabEngancharBotones() {
  const btnCargar = document.getElementById('btnTabCargarImg');
  const btnIniciar = document.getElementById('btnTabIniciar');
  const btnParar = document.getElementById('btnTabParar');
  const inputImg = document.getElementById('tabInputImg');

  if (btnCargar) btnCargar.addEventListener('click', tabCargarImagenClick);
  if (btnIniciar) btnIniciar.addEventListener('click', tabIniciar);
  if (btnParar) btnParar.addEventListener('click', tabParar);
  if (inputImg) inputImg.addEventListener('change', function(e) {
    if (e.target.files && e.target.files[0]) tabProcesarImagen(e.target.files[0]);
  });

  console.log('[TAB] Botones enganchados');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', tabEngancharBotones);
} else {
  tabEngancharBotones();
}

// --- Enganche del tab ---
(function() {
  function tabEngancharTab() {
    const tabBtns = document.querySelectorAll('.tab');
    tabBtns.forEach(function(t) {
      if (t.dataset.tab === 'tabla' && !t.dataset.bound) {
        t.dataset.bound = '1';
        t.addEventListener('click', function() {
          document.querySelectorAll('.tab').forEach(function(x) { x.classList.remove('active'); });
          document.querySelectorAll('.tab-content').forEach(function(x) { x.classList.remove('active'); });
          this.classList.add('active');
          const c = document.getElementById('tab-tabla');
          if (c) c.classList.add('active');
        });
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tabEngancharTab);
  } else {
    tabEngancharTab();
  }
  setTimeout(tabEngancharTab, 500);
})();

console.log('runner_tabla.js v1 cargado');

try {
  const elChk = document.getElementById('tabLog');
  if (elChk) elChk.textContent = '[tabla-v1] cargado\n' + elChk.textContent;
} catch(e) {}
