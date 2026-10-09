// ==============================================
// ui/runner_nitidez.js
// Runner de los 25 filtros de nitidez para OCR.
// Corre cada filtro con ML Kit y guarda imagen final.
// ==============================================

window.runnerNit = {
  imagenes: [],
  ejecutando: false,
  cancelar: false,
  resultados: []
};

function nitLog(msg) {
  const el = document.getElementById('nitLog');
  if (!el) { console.log('[NIT] ' + msg); return; }
  el.textContent = msg + '\n' + el.textContent;
  console.log('[NIT] ' + msg);
}

function nitCargarImgsClick() {
  const inp = document.getElementById('nitInputImgs');
  if (inp) { inp.value = ''; inp.click(); }
}

async function nitProcesarImgs(files) {
  const arr = Array.from(files);
  if (arr.length < 1) { nitLog('Selecciona imagenes'); return; }
  arr.sort(function(a, b) { return a.name.localeCompare(b.name); });

  const imgs = [];
  for (let i = 0; i < arr.length; i++) {
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
        reader.readAsDataURL(arr[i]);
      });
      imgs.push({
        nombre: arr[i].name.replace('.jpg','').replace('.png',''),
        img,
        ancho: img.width,
        alto: img.height,
        dataURLOriginal: img.src
      });
    } catch(e) { nitLog('Error: ' + e.message); }
  }
  window.runnerNit.imagenes = imgs;
  nitLog(imgs.length + ' imagenes cargadas');
  imgs.forEach(function(im) { nitLog('  ' + im.nombre + ' (' + im.ancho + 'x' + im.alto + ')'); });
}

// --- Lista de los 25 filtros ---
function nitGenerarCombos() {
  return [
    // --- Individuales (12) ---
    { nombre: 'gamma_local_r15', fn: 'nitGammaAdaptativaLocal', args: [15] },
    { nombre: 'gamma_local_r30', fn: 'nitGammaAdaptativaLocal', args: [30] },
    { nombre: 'blackhat_r3', fn: 'nitBlackHat', args: [3] },
    { nombre: 'blackhat_r5', fn: 'nitBlackHat', args: [5] },
    { nombre: 'blackhat_r7', fn: 'nitBlackHat', args: [7] },
    { nombre: 'wiener_k0.01', fn: 'nitWiener', args: [0.01] },
    { nombre: 'wiener_k0.05', fn: 'nitWiener', args: [0.05] },
    { nombre: 'rl_5i_s1', fn: 'nitRichardsonLucy', args: [5, 1.0] },
    { nombre: 'highpass_r5_a1.5', fn: 'nitHighPass', args: [5, 1.5] },
    { nombre: 'laplaciano_a0.5', fn: 'nitLaplacianoSharpen', args: [0.5] },
    { nombre: 'unsharp_adapt', fn: 'nitUnsharpAdaptativo', args: [2, 1.0, 15] },
    { nombre: 'bilateral_plus', fn: 'nitBilateralPlus', args: [30, 2] },
    // --- Combinaciones (13) ---
    { nombre: 'gamma+blackhat5', fn: 'nitGammaAdaptativaLocal', args: [15], extras: [{fn: 'nitBlackHat', args: [5]}] },
    { nombre: 'gamma+wiener', fn: 'nitGammaAdaptativaLocal', args: [15], extras: [{fn: 'nitWiener', args: [0.01]}] },
    { nombre: 'gamma+highpass', fn: 'nitGammaAdaptativaLocal', args: [15], extras: [{fn: 'nitHighPass', args: [5, 1.5]}] },
    { nombre: 'gamma+laplaciano', fn: 'nitGammaAdaptativaLocal', args: [15], extras: [{fn: 'nitLaplacianoSharpen', args: [0.5]}] },
    { nombre: 'blackhat5+wiener', fn: 'nitBlackHat', args: [5], extras: [{fn: 'nitWiener', args: [0.01]}] },
    { nombre: 'blackhat5+highpass', fn: 'nitBlackHat', args: [5], extras: [{fn: 'nitHighPass', args: [5, 1.5]}] },
    { nombre: 'blackhat5+laplaciano', fn: 'nitBlackHat', args: [5], extras: [{fn: 'nitLaplacianoSharpen', args: [0.5]}] },
    { nombre: 'highpass+wiener', fn: 'nitHighPass', args: [5, 1.5], extras: [{fn: 'nitWiener', args: [0.01]}] },
    { nombre: 'gamma+blackhat5+wiener', fn: 'nitGammaAdaptativaLocal', args: [15], extras: [{fn: 'nitBlackHat', args: [5]}, {fn: 'nitWiener', args: [0.01]}] },
    { nombre: 'gamma+blackhat5+highpass', fn: 'nitGammaAdaptativaLocal', args: [15], extras: [{fn: 'nitBlackHat', args: [5]}, {fn: 'nitHighPass', args: [5, 1.5]}] },
    { nombre: 'gamma+blackhat5+laplaciano', fn: 'nitGammaAdaptativaLocal', args: [15], extras: [{fn: 'nitBlackHat', args: [5]}, {fn: 'nitLaplacianoSharpen', args: [0.5]}] },
    { nombre: 'wiener+blackhat5+highpass', fn: 'nitWiener', args: [0.01], extras: [{fn: 'nitBlackHat', args: [5]}, {fn: 'nitHighPass', args: [5, 1.5]}] },
    { nombre: 'gamma+wiener+highpass', fn: 'nitGammaAdaptativaLocal', args: [15], extras: [{fn: 'nitWiener', args: [0.01]}, {fn: 'nitHighPass', args: [5, 1.5]}] }
  ];
}

// --- Aplicar un filtro con upscale adaptativo previo ---
async function nitAplicarFiltro(img, combo) {
  // 1. Calcular brillo de la imagen original
  const canvasOrig = document.createElement('canvas');
  canvasOrig.width = img.ancho;
  canvasOrig.height = img.alto;
  const ctxOrig = canvasOrig.getContext('2d');
  ctxOrig.drawImage(img.img, 0, 0);
  const imageDataOrig = ctxOrig.getImageData(0, 0, img.ancho, img.alto);
  const brilloOrig = calcularBrillo(imageDataOrig);

  // 2. Estimar tamaño de texto y decidir factor de upscale
  let factor = 1.0;
  let tamTextoDetectado = 0;
  try {
    const estim = estimarTamanoTexto(brilloOrig, img.ancho, img.alto);
    tamTextoDetectado = estim.tamTexto;
    if (estim.tamTexto >= 14) factor = 1.0;
    else if (estim.tamTexto >= 10) factor = 1.5;
    else if (estim.tamTexto >= 7) factor = 2.0;
    else if (estim.tamTexto < 999) factor = 3.0;
    else factor = 1.0;
  } catch(e) {
    factor = 1.0;
  }

  // 3. Aplicar límite de 2048px (ML Kit)
  const maxLado = Math.max(img.ancho, img.alto);
  const factorMax = 2048 / maxLado;
  const factorReal = Math.min(factor, factorMax);

  // 4. Preparar brillo (con o sin upscale)
  let brillo;
  let anchoFilt, altoFilt;
  if (factorReal <= 1.05) {
    brillo = brilloOrig;
    anchoFilt = img.ancho;
    altoFilt = img.alto;
  } else {
    const wNuevo = Math.round(img.ancho * factorReal);
    const hNuevo = Math.round(img.alto * factorReal);
    const canvasUp = document.createElement('canvas');
    canvasUp.width = wNuevo;
    canvasUp.height = hNuevo;
    const ctxUp = canvasUp.getContext('2d');
    ctxUp.imageSmoothingEnabled = true;
    ctxUp.imageSmoothingQuality = 'high';
    ctxUp.drawImage(img.img, 0, 0, wNuevo, hNuevo);
    const imageDataUp = ctxUp.getImageData(0, 0, wNuevo, hNuevo);
    brillo = calcularBrillo(imageDataUp);
    anchoFilt = wNuevo;
    altoFilt = hNuevo;
  }

  // 5. Aplicar filtro principal
  const fnPrincipal = window[combo.fn];
  if (!fnPrincipal) {
    nitLog('Filtro no existe: ' + combo.fn);
    return null;
  }
  let brilloFilt = fnPrincipal(brillo, anchoFilt, altoFilt, ...combo.args);

  // 6. Aplicar extras en orden (soporta array de extras)
  if (combo.extras && Array.isArray(combo.extras)) {
    for (let e = 0; e < combo.extras.length; e++) {
      const ex = combo.extras[e];
      const fnEx = window[ex.fn];
      if (fnEx) {
        brilloFilt = fnEx(brilloFilt, anchoFilt, altoFilt, ...ex.args);
      }
    }
  } else if (combo.extra) {
    // Compatibilidad con la versión anterior (extra único)
    const fnEx = window[combo.extra];
    if (fnEx) {
      if (combo.extra === 'nitUnsharpAdaptativo') {
        brilloFilt = fnEx(brilloFilt, anchoFilt, altoFilt, 2, 0.8, 15);
      } else if (combo.extra === 'nitContrasteLocal') {
        brilloFilt = fnEx(brilloFilt, anchoFilt, altoFilt, 10, 1.5);
      } else if (combo.extra === 'nitBlackHat') {
        brilloFilt = fnEx(brilloFilt, anchoFilt, altoFilt, 3);
      } else {
        brilloFilt = fnEx(brilloFilt, anchoFilt, altoFilt);
      }
    }
  }

  // 7. Convertir brilloFilt a dataURL
  const canvasOut = document.createElement('canvas');
  canvasOut.width = anchoFilt;
  canvasOut.height = altoFilt;
  const ctxOut = canvasOut.getContext('2d');
  const imageDataOut = ctxOut.createImageData(anchoFilt, altoFilt);
  for (let y = 0; y < altoFilt; y++) {
    for (let x = 0; x < anchoFilt; x++) {
      const v = Math.max(0, Math.min(255, brilloFilt[y][x] | 0));
      const idx = (y * anchoFilt + x) * 4;
      imageDataOut.data[idx] = v;
      imageDataOut.data[idx + 1] = v;
      imageDataOut.data[idx + 2] = v;
      imageDataOut.data[idx + 3] = 255;
    }
  }
  ctxOut.putImageData(imageDataOut, 0, 0);
  const dataURL = canvasOut.toDataURL('image/jpeg', 0.95);

  // Log de upscale (para saber qué hizo)
  if (factorReal > 1.05) {
    nitLog('    [upscale x' + factorReal.toFixed(2) + '] ' + img.nombre + ' ' + img.ancho + 'x' + img.alto + ' -> ' + anchoFilt + 'x' + altoFilt + ' (tamTexto=' + tamTextoDetectado.toFixed(1) + 'px)');
  }

  return dataURL;
}
// --- Guardar imagen de salida en Documents ---
async function nitGuardarImagen(dataURL, nombre) {
  try {
    const fs = Capacitor.Plugins.Filesystem;
    if (!fs) return;
    const base64 = dataURL.replace('data:image/jpeg;base64,', '');
    await fs.writeFile({
      path: 'MAR_Caribe_OCR_Sim/' + nombre + '.jpg',
      directory: 'DOCUMENTS',
      encoding: 'base64',
      data: base64,
      recursive: true
    });
  } catch(e) {
    // Silencioso — no rompe el runner si falla el guardado
  }
}

// --- Guardar ranking JSON en Documents ---
async function nitGuardarRanking() {
  try {
    const fs = Capacitor.Plugins.Filesystem;
    if (!fs) return;
    const ordenados = window.runnerNit.resultados.slice().sort(function(a, b) {
      return b.totalPalabras - a.totalPalabras;
    });
    const out = {
      fecha: new Date().toISOString(),
      buildTag: (typeof BUILD_TAG !== 'undefined') ? BUILD_TAG : 'desconocido',
      totalCombos: ordenados.length,
      completo: ordenados
    };
    const json = JSON.stringify(out, null, 2);
    await fs.writeFile({
      path: 'MAR_Caribe_OCR_Sim/ranking_nitidez.json',
      directory: 'DOCUMENTS',
      encoding: 'utf8',
      data: json,
      recursive: true
    });
  } catch(e) {
    // Silencioso
  }
}

// --- Cargar ranking anterior al arrancar ---
async function nitCargarRankingAnterior() {
  try {
    const fs = Capacitor.Plugins.Filesystem;
    if (!fs) return;
    const res = await fs.readFile({
      path: 'MAR_Caribe_OCR_Sim/ranking_nitidez.json',
      directory: 'DOCUMENTS',
      encoding: 'utf8'
    });
    if (!res || !res.data) return;
    const obj = JSON.parse(res.data);
    nitLog('[ranking previo] ' + obj.fecha + ' (' + obj.buildTag + ')');
    nitLog('[ranking previo] total combos: ' + obj.totalCombos);
    if (obj.completo && obj.completo.length > 0) {
      nitLog('[ranking previo] TOP 5:');
      obj.completo.slice(0, 5).forEach(function(r, idx) {
        nitLog('  #' + (idx + 1) + ' ' + r.nombre + ' = ' + r.totalPalabras + ' palabras');
      });
    }
  } catch(e) {
    // Silencioso — no hay ranking previo
  }
}

async function nitIniciar() {
  if (window.runnerNit.ejecutando) { nitLog('Ya ejecutando'); return; }
  if (window.runnerNit.imagenes.length === 0) { nitLog('Carga imagenes primero'); return; }

  window.runnerNit.ejecutando = true;
  window.runnerNit.cancelar = false;
  window.runnerNit.resultados = [];

  const TextRec = Capacitor.Plugins.TextRecognition;
  if (!TextRec) { nitLog('TextRecognition no disponible'); return; }

  const combos = nitGenerarCombos();
  const total = combos.length;

  nitLog('Iniciando nitidez: ' + total + ' combos x ' + window.runnerNit.imagenes.length + ' imagenes');

  for (let i = 0; i < combos.length; i++) {
    if (window.runnerNit.cancelar) { nitLog('Cancelado'); break; }
    const elBar = document.getElementById('nitBar');
    if (elBar) elBar.style.width = (((i + 1) / total) * 100).toFixed(0) + '%';
    const elCombo = document.getElementById('nitCombo');
    if (elCombo) elCombo.textContent = (i + 1) + '/' + total;

    const combo = combos[i];
    const resultadosPorImagen = {};
    let totalPalabras = 0;

    for (let j = 0; j < window.runnerNit.imagenes.length; j++) {
      if (window.runnerNit.cancelar) break;
      const img = window.runnerNit.imagenes[j];
      try {
        const dataURL = await nitAplicarFiltro(img, combo);
        if (!dataURL) continue;

        // Guardar imagen
        const nombreGuardar = combo.nombre + '__' + img.nombre;
        await nitGuardarImagen(dataURL, nombreGuardar);

        // Correr ML Kit
        const result = await TextRec.processImage({ path: dataURL });
        const txt = (result && result.text) ? result.text : '';
        const palabras = txt.split(/\s+/).filter(function(p) { return p.length > 1; }).length;
        totalPalabras += palabras;
        resultadosPorImagen[img.nombre] = { palabras: palabras, len: txt.length };
      } catch(e) {
        nitLog('Error en ' + combo.nombre + ' x ' + img.nombre + ': ' + e.message);
      }
    }

    window.runnerNit.resultados.push({
      nombre: combo.nombre,
      totalPalabras: totalPalabras,
      porImagen: resultadosPorImagen
    });
    nitLog('#' + (i + 1) + ' ' + combo.nombre + ' = ' + totalPalabras + ' palabras');
    await nitGuardarRanking();
  }

  // Ranking
  const ordenados = window.runnerNit.resultados.slice().sort(function(a, b) { return b.totalPalabras - a.totalPalabras; });
  nitLog('=== TOP 10 ===');
  ordenados.slice(0, 10).forEach(function(r, idx) {
    nitLog('#' + (idx + 1) + ' ' + r.nombre + ' = ' + r.totalPalabras + ' palabras');
  });

  nitLog('Terminado. Imagenes en Documents/MAR_Caribe_OCR_Sim/');
  window.runnerNit.ejecutando = false;
}

function nitParar() {
  window.runnerNit.cancelar = true;
  nitLog('Parando...');
}

// --- Enganche de botones al DOM ---
function nitEngancharBotones() {
  const btnCargar = document.getElementById('btnNitCargarImgs');
  const btnIniciar = document.getElementById('btnNitIniciar');
  const btnParar = document.getElementById('btnNitParar');
  const inputImgs = document.getElementById('nitInputImgs');

  if (btnCargar) btnCargar.addEventListener('click', nitCargarImgsClick);
  if (btnIniciar) btnIniciar.addEventListener('click', nitIniciar);
  if (btnParar) btnParar.addEventListener('click', nitParar);
  if (inputImgs) inputImgs.addEventListener('change', function(e) { nitProcesarImgs(e.target.files); });

  console.log('[NIT] Botones enganchados');
}

// --- Enganche directo + DOMContentLoaded ---
window.nitCargarImgsClick = nitCargarImgsClick;
window.nitProcesarImgs = nitProcesarImgs;
window.nitIniciar = nitIniciar;
window.nitParar = nitParar;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', nitEngancharBotones);
} else {
  nitEngancharBotones();
  setTimeout(nitCargarRankingAnterior, 1500);
}


// --- Enganche del tab ⚡ Nitidez ---
(function() {
  function nitEngancharTab() {
    const tabBtns = document.querySelectorAll('.tab');
    tabBtns.forEach(function(t) {
      if (t.dataset.tab === 'nitidez' && !t.dataset.bound) {
        t.dataset.bound = '1';
        t.addEventListener('click', function() {
          document.querySelectorAll('.tab').forEach(function(x) { x.classList.remove('active'); });
          document.querySelectorAll('.tab-content').forEach(function(x) { x.classList.remove('active'); });
          this.classList.add('active');
          const c = document.getElementById('tab-nitidez');
          if (c) c.classList.add('active');
        });
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', nitEngancharTab);
  } else {
    nitEngancharTab();
  }
  setTimeout(nitEngancharTab, 500);
})();
console.log('runner_nitidez.js v1 cargado');

// Verificación visible en el panel
try {
  const elChk = document.getElementById('nitLog');
  if (elChk) elChk.textContent = '[nit-v1] cargado - ' + nitGenerarCombos().length + ' combos\n' + elChk.textContent;
} catch(e) {}
