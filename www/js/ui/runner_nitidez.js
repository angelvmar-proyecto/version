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
    { nombre: 'nit_laplaciano_a0.5', fn: 'nitLaplacianoSharpen', args: [0.5] },
    { nombre: 'nit_laplaciano_a1.0', fn: 'nitLaplacianoSharpen', args: [1.0] },
    { nombre: 'nit_laplaciano_a1.5', fn: 'nitLaplacianoSharpen', args: [1.5] },
    { nombre: 'nit_highpass_r3_a1', fn: 'nitHighPass', args: [3, 1.0] },
    { nombre: 'nit_highpass_r5_a1.5', fn: 'nitHighPass', args: [5, 1.5] },
    { nombre: 'nit_unsharp_adapt', fn: 'nitUnsharpAdaptativo', args: [2, 1.0, 15] },
    { nombre: 'nit_unsharp_adapt_fuerte', fn: 'nitUnsharpAdaptativo', args: [3, 1.5, 20] },
    { nombre: 'nit_gabor', fn: 'nitGaborMulti', args: [0.1, 4] },
    { nombre: 'nit_sobel_a0.3', fn: 'nitSobelSharpen', args: [0.3] },
    { nombre: 'nit_sobel_a0.6', fn: 'nitSobelSharpen', args: [0.6] },
    { nombre: 'nit_prewitt_a0.3', fn: 'nitPrewitt', args: [0.3] },
    { nombre: 'nit_kirsch_a0.2', fn: 'nitKirsch', args: [0.2] },
    { nombre: 'nit_estructura_a0.5', fn: 'nitEstructura', args: [0.5] },
    { nombre: 'nit_rl_5i_s1', fn: 'nitRichardsonLucy', args: [5, 1.0] },
    { nombre: 'nit_rl_10i_s1', fn: 'nitRichardsonLucy', args: [10, 1.0] },
    { nombre: 'nit_wiener_k0.01', fn: 'nitWiener', args: [0.01] },
    { nombre: 'nit_tikhonov_l0.1', fn: 'nitTikhonov', args: [0.1] },
    { nombre: 'nit_nlm_h10', fn: 'nitNonLocalMeans', args: [10, 3] },
    { nombre: 'nit_nlm_h15', fn: 'nitNonLocalMeans', args: [15, 3] },
    { nombre: 'nit_tv_l0.1', fn: 'nitTotalVariation', args: [0.1, 5] },
    { nombre: 'nit_bilateral_plus', fn: 'nitBilateralPlus', args: [30, 2] },
    { nombre: 'nit_mediana_plus', fn: 'nitMedianaPlus', args: [1] },
    { nombre: 'nit_tophat_r3', fn: 'nitTopHat', args: [3] },
    { nombre: 'nit_blackhat_r3', fn: 'nitBlackHat', args: [3] },
    { nombre: 'nit_blackhat_r5', fn: 'nitBlackHat', args: [5] },
    { nombre: 'nit_grad_morfo', fn: 'nitGradienteMorfologico', args: [2] },
    { nombre: 'nit_cierre_peq', fn: 'nitCierrePequeno', args: [1] },
    { nombre: 'nit_fourier_hp', fn: 'nitFourierHighPass', args: [5] },
    { nombre: 'nit_wavelet_2', fn: 'nitWaveletHaar', args: [2] },
    { nombre: 'nit_bandpass', fn: 'nitFourierBandpass', args: [2, 8] },
    { nombre: 'nit_gamma_local', fn: 'nitGammaAdaptativaLocal', args: [15] },
    { nombre: 'nit_dark_channel', fn: 'nitDarkChannel', args: [5] },
    { nombre: 'nit_contraste_local', fn: 'nitContrasteLocal', args: [10, 1.5] },
    // Combinaciones de ganadores esperados
    { nombre: 'nit_lapl+contraste', fn: 'nitLaplacianoSharpen', args: [0.8], extra: 'nitContrasteLocal' },
    { nombre: 'nit_highpass+unsharp', fn: 'nitHighPass', args: [3, 1.0], extra: 'nitUnsharpAdaptativo' },
    { nombre: 'nit_rl+blackhat', fn: 'nitRichardsonLucy', args: [5, 1.0], extra: 'nitBlackHat' }
  ];
}

// --- Aplicar un filtro con upscale adaptativo previo ---
async function nitAplicarFiltro(img, combo) {
  // 1. Calcular brillo
  const canvas = document.createElement('canvas');
  canvas.width = img.ancho;
  canvas.height = img.alto;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img.img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.ancho, img.alto);
  const brillo = calcularBrillo(imageData);

  // 2. Aplicar filtro principal
  const fnPrincipal = window[combo.fn];
  if (!fnPrincipal) {
    nitLog('Filtro no existe: ' + combo.fn);
    return null;
  }
  let brilloFilt = fnPrincipal(brillo, img.ancho, img.alto, ...combo.args);

  // 3. Aplicar filtro extra si existe
  if (combo.extra) {
    const fnExtra = window[combo.extra];
    if (fnExtra) {
      if (combo.extra === 'nitUnsharpAdaptativo') {
        brilloFilt = fnExtra(brilloFilt, img.ancho, img.alto, 2, 0.8, 15);
      } else if (combo.extra === 'nitContrasteLocal') {
        brilloFilt = fnExtra(brilloFilt, img.ancho, img.alto, 10, 1.5);
      } else if (combo.extra === 'nitBlackHat') {
        brilloFilt = fnExtra(brilloFilt, img.ancho, img.alto, 3);
      } else {
        brilloFilt = fnExtra(brilloFilt, img.ancho, img.alto);
      }
    }
  }

  // 4. Convertir a dataURL (imagen de salida)
  const canvasOut = document.createElement('canvas');
  canvasOut.width = img.ancho;
  canvasOut.height = img.alto;
  const ctxOut = canvasOut.getContext('2d');
  const imageDataOut = ctxOut.createImageData(img.ancho, img.alto);
  for (let y = 0; y < img.alto; y++) {
    for (let x = 0; x < img.ancho; x++) {
      const v = Math.max(0, Math.min(255, brilloFilt[y][x] | 0));
      const idx = (y * img.ancho + x) * 4;
      imageDataOut.data[idx] = v;
      imageDataOut.data[idx + 1] = v;
      imageDataOut.data[idx + 2] = v;
      imageDataOut.data[idx + 3] = 255;
    }
  }
  ctxOut.putImageData(imageDataOut, 0, 0);
  const dataURL = canvasOut.toDataURL('image/jpeg', 0.95);
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
}

console.log('runner_nitidez.js v1 cargado');

// Verificación visible en el panel
try {
  const elChk = document.getElementById('nitLog');
  if (elChk) elChk.textContent = '[nit-v1] cargado - ' + nitGenerarCombos().length + ' combos\n' + elChk.textContent;
} catch(e) {}
