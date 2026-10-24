// ==============================================
// ui/runner_tabla_v3.js
// Pipeline: LIDAR (H) + Realce (V) + Inferencia OCR.
// ==============================================

window.runnerTablaV3 = {
  imagen: null,
  referencia: null,
  ejecutando: false,
  cancelar: false,
  matrizFinal: null
};

function tab3Log(msg) {
  const el = document.getElementById('tab3Log');
  if (!el) { console.log('[TAB3] ' + msg); return; }
  el.textContent = msg + '\n' + el.textContent;
  console.log('[TAB3] ' + msg);
}

function tab3CargarImagenClick() {
  const inp = document.getElementById('tab3InputImg');
  if (inp) { inp.value = ''; inp.click(); }
}

async function tab3ProcesarImagen(file) {
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
    window.runnerTablaV3.imagen = {
      nombre: file.name.replace('.jpg','').replace('.png',''),
      img: img,
      ancho: img.width,
      alto: img.height
    };
    tab3Log('Imagen: ' + window.runnerTablaV3.imagen.nombre + ' (' + img.width + 'x' + img.height + ')');
  } catch(e) { tab3Log('Error cargando: ' + e.message); }
}

// === PASO 1: Extraer H de LIDAR y V de Realce ===
async function tab3DetectarLineasBase(img) {
  tab3Log('Extrayendo brillo y aplicando pipeline ganador...');
  const canvas = document.createElement('canvas');
  canvas.width = img.ancho;
  canvas.height = img.alto;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img.img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.ancho, img.alto);

  const st = { brillo: calcularBrillo(imageData), ancho: img.ancho, alto: img.alto };

  // Pipeline ganador (para H)
  st.brillo = restaurarContrast(st.brillo, st.ancho, st.alto, 5, 95);
  st.brillo = restaurarCLAHE(st.brillo, st.ancho, st.alto, 16, 8);
  st.brillo = restaurarCLAHE(st.brillo, st.ancho, st.alto, 32, 2);
  st.brilloOriginal = st.brillo;
  st.brillo = aplicarSauvola(st.brillo, st.ancho, st.alto);

  calcularUmbralesBrillo(st.brillo, st.ancho, st.alto);

  // Corremos detectores (para LIDAR necesitamos todos, o al menos los de H)
  try { st.optica = detectarOptica(st.brillo, st.ancho, st.alto); } catch(e) { st.optica = { lineasH: [], lineasV: [] }; }
  try { st.eco = detectarEco(st.brillo, st.ancho, st.alto); } catch(e) { st.eco = { lineasH: [], lineasV: [] }; }
  try { st.a3 = detectarA3(st.brillo, st.ancho, st.alto); } catch(e) { st.a3 = { lineasH: [], lineasV: [] }; }
  try { st.morfo = detectarMorfologico(st.brilloOriginal, st.ancho, st.alto); } catch(e) { st.morfo = { lineasH: [], lineasV: [] }; }
  try { st.lvc = detectarLVC(st.brillo, st.ancho, st.alto); } catch(e) { st.lvc = { lineasH: [], lineasV: [] }; }
  try { st.io = detectarIO(st.brillo, st.ancho, st.alto, st.optica.lineasH, st.optica.lineasV); } catch(e) { st.io = { lineasH: [], lineasV: [] }; }
  try { st.cont = detectarContinuidad(st.brillo, st.ancho, st.alto); } catch(e) { st.cont = { lineasH: [], lineasV: [] }; }
  try { st.realce = detectarRealce(st.brilloOriginal, st.ancho, st.alto); } catch(e) { st.realce = { lineasH: [], lineasV: [] }; }
  try { st.openv = detectarOPENV(st.brillo, st.ancho, st.alto); } catch(e) { st.openv = { lineasH: [], lineasV: [] }; }
  try { st.ml = detectarML(st.brillo, st.ancho, st.alto); } catch(e) { st.ml = { lineasH: [], lineasV: [] }; }
  try { st.ws = detectarWS(st.brillo, st.ancho, st.alto); } catch(e) { st.ws = { lineasH: [], lineasV: [] }; }
  try { st.frangi = detectarFrangi(st.brillo, st.ancho, st.alto); } catch(e) { st.frangi = { lineasH: [], lineasV: [] }; }
  try { st.blackhat = detectarBlackHat(st.brillo, st.ancho, st.alto); } catch(e) { st.blackhat = { lineasH: [], lineasV: [] }; }
  try { st.hough = detectarHough(st.brillo, st.ancho, st.alto); } catch(e) { st.hough = { lineasH: [], lineasV: [] }; }

  // H de LIDAR (es el mejor para H)
  let lidar;
  try { lidar = votarLidarYRefinar(st); } catch(e) { lidar = { lineasH: [], lineasV: [] }; }
  tab3Log('LIDAR H=' + lidar.lineasH.length + ' V=' + lidar.lineasV.length);

  // V de Realce (el que dio 22 exactas)
  const vRealce = st.realce.lineasV.map(function(l) { return l.pos; }).sort(function(a, b) { return a - b; });
  tab3Log('Realce V=' + vRealce.length);

  return {
    hLidar: lidar.lineasH,
    vRealce: vRealce
  };
}

// === PASO 2: OCR por fila ===
async function tab3CorrerFranja(img, y1, y2, upscale) {
  const TextRec = Capacitor.Plugins.TextRecognition;
  if (!TextRec) return [];
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
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img.img, x, y1, w, h, 0, 0, w, h);
    const wUp = Math.round(w * upscale), hUp = Math.round(h * upscale);
    const canvasUp = document.createElement('canvas');
    canvasUp.width = wUp; canvasUp.height = hUp;
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
    } catch(e) {}
  }
  return todosElementos;
}

// === PASO 3: Pipeline Completo ===
async function tab3Iniciar() {
  if (window.runnerTablaV3.ejecutando) { tab3Log('Ya ejecutando'); return; }
  if (!window.runnerTablaV3.imagen) { tab3Log('Carga una imagen'); return; }

  window.runnerTablaV3.ejecutando = true;
  window.runnerTablaV3.cancelar = false;

  try {
    const img = window.runnerTablaV3.imagen;
    tab3Log('=== Iniciando Tabla v3 ===');

    // 1. Detectar H y V base
    const bases = await tab3DetectarLineasBase(img);
    
    // Filtrar H (gap 15)
    const hFiltradas = tablaFiltrarLineas(bases.hLidar, 15);
    tab3Log('H filtradas: ' + hFiltradas.length);

    // 2. OCR por fila (recolección)
    tab3Log('Recolectando elementos OCR...');
    const elementosPorFila = [];
    const upscale = 4;

    for (let i = 0; i < hFiltradas.length - 1; i++) {
      if (window.runnerTablaV3.cancelar) break;
      const y1 = Math.max(0, hFiltradas[i] - 8);
      const y2 = Math.min(img.alto, hFiltradas[i + 1] + 8);
      
      const elementos = await tab3CorrerFranja(img, y1, y2, upscale);
      
      // Filtrar elementos que caen fuera de la fila real (usando Y)
      const elementosFiltrados = elementos.filter(function(el) {
        const cy = (el.absTop + el.absBottom) / 2;
        return (cy >= hFiltradas[i] && cy < hFiltradas[i + 1]);
      });

      elementosPorFila.push(elementosFiltrados);
      
      if ((i + 1) % 10 === 0) tab3Log('  Fila ' + (i + 1) + '/' + (hFiltradas.length - 1));
    }

    // 3. Inferir V
    tab3Log('Inferiendo V desde gaps de texto...');
    // Umbral de gap: 20px (ajustable)
    const candidatosV = tabInferirCandidatosV(elementosPorFila, img.ancho, 20);
    const vInferidas = tabFiltrarVConsenso(candidatosV, elementosPorFila.length, 0.3);
    tab3Log('V inferidas (consenso): ' + vInferidas.length);

    // 4. Combinar V (Realce + Inferidas)
    const vFinales = tabCombinarV(bases.vRealce, vInferidas, 30);
    tab3Log('V finales combinadas: ' + vFinales.length);

    // 5. Construir grilla final
    const grilla = tablaConstruirGrilla(hFiltradas, vFinales);
    tab3Log('Grilla final: ' + grilla.numFilas + ' filas x ' + grilla.numCols + ' cols');

    // 6. Asignar a celdas
    const celdas = {};
    for (let i = 0; i < elementosPorFila.length; i++) {
      for (const el of elementosPorFila[i]) {
        const cx = (el.absLeft + el.absRight) / 2;
        let col = -1;
        for (let j = 0; j < vFinales.length - 1; j++) {
          if (cx >= vFinales[j] && cx < vFinales[j + 1]) { col = j; break; }
        }
        if (col < 0) continue;
        const key = i + '_' + col;
        if (!celdas[key]) celdas[key] = [];
        celdas[key].push({ text: el.text, left: el.absLeft });
      }
    }

    // 7. Limpiar
    const resultado = tabArmarMatrizYLimpiar(celdas, grilla);
    tab3Log('Matriz final: ' + resultado.filasFinales + ' x ' + resultado.columnasFinales);

    // 8. Guardar para la pestaña Excel (podemos reusar la misma)
    window.runnerTabla.matrizFinal = resultado.matriz;

    // 9. F1
    if (!window.runnerTablaV3.referencia) {
      const nombre = img.nombre.toLowerCase();
      let rutaRef = null;
      if (nombre.indexOf('sep1') >= 0) rutaRef = 'assets/referencia/01_sep.csv';
      if (rutaRef) {
        window.runnerTablaV3.referencia = await ocrCargarReferencia(rutaRef);
        tab3Log('Ref: ' + window.runnerTablaV3.referencia.length + ' tokens');
      }
    }
    if (window.runnerTablaV3.referencia) {
      const fidelidad = tabCompararConReferencia(resultado.matriz, window.runnerTablaV3.referencia);
      if (fidelidad) {
        tab3Log('=== F1: ' + fidelidad.f1.toFixed(3) + ' P: ' + fidelidad.precision.toFixed(3) + ' R: ' + fidelidad.recall.toFixed(3) + ' ===');
      }
    }

    // 10. Guardar CSV
    await tabGuardarCsv(resultado.matriz, img.nombre + '_v3');

  } catch(e) {
    tab3Log('ERROR: ' + e.message);
  } finally {
    window.runnerTablaV3.ejecutando = false;
  }
}

function tab3Parar() {
  window.runnerTablaV3.cancelar = true;
  tab3Log('Parando...');
}

window.tab3CargarImagenClick = tab3CargarImagenClick;
window.tab3ProcesarImagen = tab3ProcesarImagen;
window.tab3Iniciar = tab3Iniciar;
window.tab3Parar = tab3Parar;

// --- Enganche de botones ---
function tab3EngancharBotones() {
  const btnCargar = document.getElementById('btnTab3CargarImg');
  const btnIniciar = document.getElementById('btnTab3Iniciar');
  const btnParar = document.getElementById('btnTab3Parar');
  const inputImg = document.getElementById('tab3InputImg');

  if (btnCargar) btnCargar.addEventListener('click', tab3CargarImagenClick);
  if (btnIniciar) btnIniciar.addEventListener('click', tab3Iniciar);
  if (btnParar) btnParar.addEventListener('click', tab3Parar);
  if (inputImg) inputImg.addEventListener('change', function(e) {
    if (e.target.files && e.target.files[0]) tab3ProcesarImagen(e.target.files[0]);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', tab3EngancharBotones);
} else {
  tab3EngancharBotones();
}

// --- Enganche del tab ---
(function() {
  function tab3EngancharTab() {
    const tabBtns = document.querySelectorAll('.tab');
    tabBtns.forEach(function(t) {
      if (t.dataset.tab === 'tabla_v3' && !t.dataset.bound) {
        t.dataset.bound = '1';
        t.addEventListener('click', function() {
          document.querySelectorAll('.tab').forEach(function(x) { x.classList.remove('active'); });
          document.querySelectorAll('.tab-content').forEach(function(x) { x.classList.remove('active'); });
          this.classList.add('active');
          const c = document.getElementById('tab-tabla-v3');
          if (c) c.classList.add('active');
        });
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tab3EngancharTab);
  } else {
    tab3EngancharTab();
  }
  setTimeout(tab3EngancharTab, 500);
})();

console.log('runner_tabla_v3.js cargado');
