// ==============================================
// ui/runner_tabla.js
// Pipeline: imagen → líneas → grilla → OCR por fila → CSV.
// Usa pipeline ganador del refinamiento: ocr+sauv+clahe_t32_c2
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

// === PASO 1: Detección de líneas ===
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

  tabLog('Aplicando pipeline ganador (contrast + CLAHE x2 + Sauvola)...');
  st.brillo = restaurarContrast(st.brillo, st.ancho, st.alto, 5, 95);
  st.brillo = restaurarCLAHE(st.brillo, st.ancho, st.alto, 16, 8);
  st.brillo = restaurarCLAHE(st.brillo, st.ancho, st.alto, 32, 2);
  st.brilloOriginal = st.brillo;
  st.brillo = aplicarSauvola(st.brillo, st.ancho, st.alto);
  tabLog('Pipeline ganador aplicado');

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

// === PASO 2: OCR por fila con tiling horizontal ===
async function tabCorrerFranja(img, y1, y2, upscale) {
  const TextRec = Capacitor.Plugins.TextRecognition;
  if (!TextRec) { return []; }

  const alto = y2 - y1;
  if (alto <= 0) return [];

  const ancho = img.ancho;
  const tileSize = 500;
  const overlap = 30;
  const step = tileSize - overlap;

  const xs = [];
  for (let x = 0; x < ancho; x += step) {
    xs.push(Math.min(x, Math.max(0, ancho - tileSize)));
    if (x + tileSize >= ancho) break;
  }
  const xsU = Array.from(new Set(xs));

  const todosElementos = [];

  for (const x of xsU) {
    const w = Math.min(tileSize, ancho - x);
    const h = alto;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img.img, x, y1, w, h, 0, 0, w, h);

    const wUp = Math.round(w * upscale);
    const hUp = Math.round(h * upscale);
    const canvasUp = document.createElement('canvas');
    canvasUp.width = wUp;
    canvasUp.height = hUp;
    const ctxUp = canvasUp.getContext('2d');
    ctxUp.imageSmoothingEnabled = true;
    ctxUp.imageSmoothingQuality = 'high';
    ctxUp.drawImage(canvas, 0, 0, wUp, hUp);

    const dataURL = canvasUp.toDataURL('image/jpeg', 0.95);

    try {
      const result = await TextRec.processImage({ path: dataURL });
      if (result && result.blocks) {
        for (const block of result.blocks) {
          if (!block.lines) continue;
          for (const line of block.lines) {
            if (!line.elements) continue;
            for (const el of line.elements) {
              if (!el.boundingBox) continue;
              // Convertir a coordenadas de imagen original
              todosElementos.push({
                text: el.text,
                absLeft: (el.boundingBox.left / upscale) + x,
                absRight: (el.boundingBox.right / upscale) + x,
                absTop: (el.boundingBox.top / upscale) + y1,
                absBottom: (el.boundingBox.bottom / upscale) + y1
              });
            }
          }
        }
      }
    } catch(e) {
      // tile falló, seguir
    }
  }

  return todosElementos;
}

// === PASO 3: Procesar todas las filas ===
async function tabProcesarFilas(img, grilla) {
  const celdas = {};
  const total = grilla.numFilas;
  const upscale = 4;

  for (let i = 0; i < total; i++) {
    if (window.runnerTabla.cancelar) break;

    const y1 = Math.max(0, grilla.lineasH[i] - 3);
    const y2 = Math.min(img.alto, grilla.lineasH[i + 1] + 3);

    const elementos = await tabCorrerFranja(img, y1, y2, upscale);

    for (const el of elementos) {
      const cx = (el.absLeft + el.absRight) / 2;

      let col = -1;
      for (let j = 0; j < grilla.lineasV.length - 1; j++) {
        if (cx >= grilla.lineasV[j] && cx < grilla.lineasV[j + 1]) { col = j; break; }
      }
      if (col < 0) continue;

      const key = i + '_' + col;
      if (!celdas[key]) celdas[key] = [];
      celdas[key].push({ text: el.text, left: el.absLeft });
    }

    if ((i + 1) % 10 === 0 || i === total - 1) {
      tabLog('  Fila ' + (i + 1) + '/' + total + ' procesada');
    }
  }

  return celdas;
}

// === PASO 4: Armar matriz y eliminar vacías ===
function tabArmarMatrizYLimpiar(celdas, grilla) {
  const matriz = [];
  for (let i = 0; i < grilla.numFilas; i++) {
    const fila = [];
    for (let j = 0; j < grilla.numCols; j++) {
      const key = i + '_' + j;
      const elems = celdas[key] || [];
      elems.sort(function(a, b) { return a.left - b.left; });
      fila.push(elems.map(function(e) { return e.text; }).join(' ').trim());
    }
    matriz.push(fila);
  }

  const colsConDatos = [];
  for (let j = 0; j < grilla.numCols; j++) {
    let tiene = false;
    for (let i = 0; i < grilla.numFilas; i++) {
      if (matriz[i][j] && matriz[i][j].length > 0) { tiene = true; break; }
    }
    if (tiene) colsConDatos.push(j);
  }

  const filasConDatos = [];
  for (let i = 0; i < grilla.numFilas; i++) {
    let tiene = false;
    for (let j = 0; j < grilla.numCols; j++) {
      if (matriz[i][j] && matriz[i][j].length > 0) { tiene = true; break; }
    }
    if (tiene) filasConDatos.push(i);
  }

  const matrizFiltrada = [];
  for (const i of filasConDatos) {
    const fila = [];
    for (const j of colsConDatos) {
      fila.push(matriz[i][j] || '');
    }
    matrizFiltrada.push(fila);
  }

  return {
    matriz: matrizFiltrada,
    columnasOriginales: grilla.numCols,
    columnasFinales: colsConDatos.length,
    filasOriginales: grilla.numFilas,
    filasFinales: filasConDatos.length
  };
}

// === PASO 5: Comparar con referencia ===
function tabCompararConReferencia(matriz, tokensRef) {
  if (!tokensRef || tokensRef.length === 0) return null;
  const textoCsv = matriz.map(function(f) { return f.join(' '); }).join('\n');
  return ocrCalcularFidelidad(textoCsv, tokensRef);
}

// === PASO 6: Guardar CSV ===
async function tabGuardarCsv(matriz, nombreBase) {
  try {
    const fs = Capacitor.Plugins.Filesystem;
    if (!fs) return false;
    const csv = tablaMatrizACsv(matriz);
    const nombreLimpio = String(nombreBase).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    // btoa no maneja UTF-8 bien; convertir a base64 UTF-8-safe
    const utf8Bytes = new TextEncoder().encode(csv);
    let binario = '';
    for (let i = 0; i < utf8Bytes.length; i++) binario += String.fromCharCode(utf8Bytes[i]);
    const base64 = btoa(binario);
    await fs.writeFile({
      path: 'MAR_Caribe_OCR_Sim/' + nombreLimpio + '_tabla.csv',
      data: base64,
      directory: 'DOCUMENTS'
    });
    tabLog('CSV guardado: MAR_Caribe_OCR_Sim/' + nombreLimpio + '_tabla.csv');
    return true;
  } catch(e) {
    tabLog('Error guardando CSV: ' + e.message);
    return false;
  }
}

// === PIPELINE PRINCIPAL ===
async function tabIniciar() {
  if (window.runnerTabla.ejecutando) { tabLog('Ya ejecutando'); return; }
  if (!window.runnerTabla.imagen) { tabLog('Carga una imagen primero'); return; }

  window.runnerTabla.ejecutando = true;
  window.runnerTabla.cancelar = false;

  try {
    const img = window.runnerTabla.imagen;
    tabLog('=== Procesando ' + img.nombre + ' (' + img.ancho + 'x' + img.alto + ') ===');

    // Cargar referencia automáticamente
    if (!window.runnerTabla.referencia) {
      const nombre = img.nombre.toLowerCase();
      let rutaRef = null;
      if (nombre.indexOf('sep1') >= 0) rutaRef = 'assets/referencia/01_sep.csv';
      else if (nombre.indexOf('sep23') >= 0) rutaRef = 'assets/referencia/23_sep.csv';
      if (rutaRef) {
        const ref = await ocrCargarReferencia(rutaRef);
        if (ref) {
          window.runnerTabla.referencia = ref;
          tabLog('Referencia: ' + ref.length + ' tokens');
        }
      }
    }

    // Paso 1: líneas
    const lidar = await tabDetectarLineas(img);
    if (window.runnerTabla.cancelar) { tabLog('Cancelado'); return; }

    if (!lidar.lineasH || lidar.lineasH.length < 3 || !lidar.lineasV || lidar.lineasV.length < 3) {
      tabLog('ERROR: muy pocas líneas');
      return;
    }

    // Paso 2: filtrar líneas duplicadas
    const lineasH = tablaFiltrarLineas(lidar.lineasH, 15);
    const lineasV = tablaFiltrarLineas(lidar.lineasV, 20);
    tabLog('Líneas filtradas: H=' + lineasH.length + ' V=' + lineasV.length);

    // Paso 3: grilla
    const grilla = tablaConstruirGrilla(lineasH, lineasV);
    tabLog('Grilla: ' + grilla.numFilas + ' filas x ' + grilla.numCols + ' cols');

    // Paso 4: OCR por fila
    tabLog('Corriendo OCR por fila (upscale x4, tiles de 500px)...');
    const celdas = await tabProcesarFilas(img, grilla);
    if (window.runnerTabla.cancelar) { tabLog('Cancelado'); return; }

    // Paso 5: matriz + limpieza
    const resultado = tabArmarMatrizYLimpiar(celdas, grilla);
    tabLog('Matriz final: ' + resultado.filasFinales + ' filas x ' + resultado.columnasFinales + ' cols');
    tabLog('  (antes de limpiar: ' + resultado.filasOriginales + ' x ' + resultado.columnasOriginales + ')');

    // Paso 6: comparar con referencia
    if (window.runnerTabla.referencia) {
      const fidelidad = tabCompararConReferencia(resultado.matriz, window.runnerTabla.referencia);
      if (fidelidad) {
        tabLog('=== FIDELIDAD ===');
        tabLog('F1=' + fidelidad.f1.toFixed(3) + ' P=' + fidelidad.precision.toFixed(3) + ' R=' + fidelidad.recall.toFixed(3));
        tabLog('  (OCR: ' + fidelidad.totalOcr + ' tokens, REF: ' + fidelidad.totalRef + ' tokens)');
      }
    }

    // Paso 7: guardar CSV
    await tabGuardarCsv(resultado.matriz, img.nombre);

    tabLog('=== Terminado ===');
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

console.log('runner_tabla.js v2 cargado');

try {
  const elChk = document.getElementById('tabLog');
  if (elChk) elChk.textContent = '[tabla-v2] cargado\n' + elChk.textContent;
} catch(e) {}
