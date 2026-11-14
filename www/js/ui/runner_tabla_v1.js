// ==============================================
// ui/runner_tabla_v1.js
// Runner simplificado de tablas (motor v1).
// Pipeline: imagen → OCR → motor universal → CSV
// ==============================================

window.runnerTablaV1 = {
  imagen: null,
  ejecutando: false,
  cancelar: false,
  matrizFinal: null,
  referencia: null
};

function tabV1Log(msg) {
  const el = document.getElementById('tabV1Log');
  if (!el) { console.log('[TAB-V1] ' + msg); return; }
  el.textContent = msg + '\n' + el.textContent;
  console.log('[TAB-V1] ' + msg);
}

function tabV1CargarImagenClick() {
  const inp = document.getElementById('tabV1InputImg');
  if (inp) { inp.value = ''; inp.click(); }
}

async function tabV1ProcesarImagen(file) {
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
    window.runnerTablaV1.imagen = {
      nombre: file.name.replace('.jpg','').replace('.png',''),
      img: img,
      ancho: img.width,
      alto: img.height
    };
    tabV1Log('Imagen: ' + window.runnerTablaV1.imagen.nombre + ' (' + img.width + 'x' + img.height + ')');
  } catch(e) {
    tabV1Log('Error cargando: ' + e.message);
  }
}

// OCR directo (sin tiling, sin filtros). Devuelve elementos con boundingBox.
async function tabV1OCRDirecto(img) {
  const TextRec = Capacitor.Plugins.TextRecognition;
  if (!TextRec) {
    tabV1Log('TextRecognition no disponible');
    return [];
  }

  // Detectar si hace falta upscale (texto chico)
  let upscale = 1;
  try {
    const canvasTmp = document.createElement('canvas');
    canvasTmp.width = img.ancho;
    canvasTmp.height = img.alto;
    const ctxTmp = canvasTmp.getContext('2d');
    ctxTmp.drawImage(img.img, 0, 0);
    const imageDataTmp = ctxTmp.getImageData(0, 0, img.ancho, img.alto);
    const brilloTmp = calcularBrillo(imageDataTmp);
    if (typeof estimarTamanoTexto === 'function') {
      const est = estimarTamanoTexto(brilloTmp, img.ancho, img.alto);
      tabV1Log('Tamaño de texto detectado: ' + est.tamTexto.toFixed(1) + 'px');
      if (est.tamTexto < 8 && est.tamTexto < 999) {
        upscale = 2;
        tabV1Log('Texto chico → upscale x2');
      }
    }
  } catch(e) {
    tabV1Log('Error estimando tamaño: ' + e.message);
  }

  // Preparar canvas (con o sin upscale)
  const canvas = document.createElement('canvas');
  canvas.width = img.ancho * upscale;
  canvas.height = img.alto * upscale;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img.img, 0, 0, canvas.width, canvas.height);
  const dataURL = canvas.toDataURL('image/jpeg', 0.95);

  tabV1Log('Enviando a ML Kit (' + canvas.width + 'x' + canvas.height + ')...');

  try {
    const result = await TextRec.processImage({ path: dataURL });
    const elementos = [];
    if (result && result.blocks) {
      for (const block of result.blocks) {
        if (!block.lines) continue;
        for (const line of block.lines) {
          if (!line.elements) continue;
          for (const el of line.elements) {
            if (!el.boundingBox) continue;
            elementos.push({
              text: el.text,
              x1: (el.boundingBox.left / upscale),
              x2: (el.boundingBox.right / upscale),
              y1: (el.boundingBox.top / upscale),
              y2: (el.boundingBox.bottom / upscale),
              cx: ((el.boundingBox.left + el.boundingBox.right) / 2 / upscale),
              cy: ((el.boundingBox.top + el.boundingBox.bottom) / 2 / upscale)
            });
          }
        }
      }
    }
    tabV1Log('Elementos extraídos: ' + elementos.length);
    return elementos;
  } catch(e) {
    tabV1Log('Error OCR: ' + e.message);
    return [];
  }
}

async function tabV1Iniciar() {
  if (window.runnerTablaV1.ejecutando) { tabV1Log('Ya ejecutando'); return; }
  if (!window.runnerTablaV1.imagen) { tabV1Log('Carga una imagen primero'); return; }

  window.runnerTablaV1.ejecutando = true;
  window.runnerTablaV1.cancelar = false;

  try {
    const img = window.runnerTablaV1.imagen;
    tabV1Log('=== Procesando ' + img.nombre + ' (' + img.ancho + 'x' + img.alto + ') ===');

    // 1. OCR directo
    const elementos = await tabV1OCRDirecto(img);
    if (elementos.length === 0) {
      tabV1Log('Sin elementos OCR');
      return;
    }
    if (window.runnerTablaV1.cancelar) { tabV1Log('Cancelado'); return; }

    // 2. Motor universal
    tabV1Log('Ejecutando motor universal...');
    const resultado = motorProcesarTabla(elementos, img.ancho);

    tabV1Log('Filas detectadas: ' + resultado.numFilas);
    tabV1Log('Columnas detectadas: ' + resultado.numCols);
    tabV1Log('Matriz: ' + resultado.matriz.length + ' filas x ' + resultado.numCols + ' cols');
    tabV1Log('[tipos] ' + resultado.tipos.map(function(t) { return t.tipo; }).join(', '));
    tabV1Log('[corrección] ' + resultado.stats.celdasCorregidas + '/' + resultado.stats.celdasTotales);

    // 3. Guardar para Excel
    window.runnerTabla.matrizFinal = resultado.matriz;
    window.runnerTablaV1.matrizFinal = resultado.matriz;

    // 4. Guardar CSV
    if (typeof window.tabGuardarCsv === 'function') {
      await window.tabGuardarCsv(resultado.matriz, img.nombre + '_v1');
    }


    tabV1Log('=== Terminado ===');
  } catch(e) {
    tabV1Log('ERROR: ' + e.message);
    console.error(e);
  } finally {
    window.runnerTablaV1.ejecutando = false;
  }
}

function tabV1Parar() {
  window.runnerTablaV1.cancelar = true;
  tabV1Log('Parando...');
}

window.tabV1CargarImagenClick = tabV1CargarImagenClick;
window.tabV1ProcesarImagen = tabV1ProcesarImagen;
window.tabV1Iniciar = tabV1Iniciar;
window.tabV1Parar = tabV1Parar;

function tabV1EngancharBotones() {
  const btnCargar = document.getElementById('btnTabV1CargarImg');
  const btnIniciar = document.getElementById('btnTabV1Iniciar');
  const btnParar = document.getElementById('btnTabV1Parar');
  const inputImg = document.getElementById('tabV1InputImg');
  if (btnCargar) btnCargar.addEventListener('click', tabV1CargarImagenClick);
  if (btnIniciar) btnIniciar.addEventListener('click', tabV1Iniciar);
  if (btnParar) btnParar.addEventListener('click', tabV1Parar);
  if (inputImg) inputImg.addEventListener('change', function(e) {
    if (e.target.files && e.target.files[0]) tabV1ProcesarImagen(e.target.files[0]);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', tabV1EngancharBotones);
} else {
  tabV1EngancharBotones();
}

(function() {
  function tabV1EngancharTab() {
    document.querySelectorAll('.tab').forEach(function(t) {
      if (t.dataset.tab === 'tabla_v1' && !t.dataset.bound) {
        t.dataset.bound = '1';
        t.addEventListener('click', function() {
          document.querySelectorAll('.tab').forEach(function(x) { x.classList.remove('active'); });
          document.querySelectorAll('.tab-content').forEach(function(x) { x.classList.remove('active'); });
          this.classList.add('active');
          const c = document.getElementById('tab-tabla-v1');
          if (c) c.classList.add('active');
        });
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tabV1EngancharTab);
  } else {
    tabV1EngancharTab();
  }
  setTimeout(tabV1EngancharTab, 500);
})();

console.log('runner_tabla_v1.js cargado');
