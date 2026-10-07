// ==============================================
// ui/runner_texto.js
// Runner de OCR real con ML Kit.
// Compara filtros por palabras detectadas.
// ==============================================

window.runnerTexto = {
  imagenes: [],
  ejecutando: false,
  cancelar: false,
  resultados: []
};

function txLog(msg) {
  const el = document.getElementById('txLog');
  if (!el) { console.log('[TX] ' + msg); return; }
  el.textContent = msg + '\n' + el.textContent;
  console.log('[TX] ' + msg);
}

function txCargarImgsClick() {
  const inp = document.getElementById('txInputImgs');
  if (inp) { inp.value = ''; inp.click(); }
}

async function txProcesarImgs(files) {
  const arr = Array.from(files);
  if (arr.length < 1) { txLog('Selecciona imagenes'); return; }
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
    } catch(e) { txLog('Error: ' + e.message); }
  }
  window.runnerTexto.imagenes = imgs;
  txLog(imgs.length + ' imagenes cargadas');
  imgs.forEach(function(im) { txLog('  ' + im.nombre + ' (' + im.ancho + 'x' + im.alto + ')'); });
}

function txGenerarCombos() {
  return [
    { nombre: 'raw_original', tipo: 'raw', params: {} },
    { nombre: 'raw_upscale_auto', tipo: 'upscale_auto', params: {} },
    { nombre: 'baseline', tipo: 'none', params: {} },
    { nombre: 'contrast_only', tipo: 'contrast', params: { pb: 5, pa: 95 } },
    { nombre: 'cc_p5_t16_c8', tipo: 'contrast_clahe', params: { pb: 5, pa: 95, tiles: 16, clip: 8 } },
    { nombre: 'cc_p5_t16_c4', tipo: 'contrast_clahe', params: { pb: 5, pa: 95, tiles: 16, clip: 4 } },
    { nombre: 'cc_p5_t8_c8', tipo: 'contrast_clahe', params: { pb: 5, pa: 95, tiles: 8, clip: 8 } },
    { nombre: 'ocr+sauv+clahe_t32_c2', tipo: 'ocr_combo', params: {} },
    { nombre: 'sauvola_solo', tipo: 'sauvola', params: {} },
    { nombre: 'filtro_ocr_solo', tipo: 'clahe_only', params: {} },
    { nombre: 'gamma_1.8', tipo: 'gamma', params: { valor: 1.8 } },
    { nombre: 'unsharp_r3_a1.5', tipo: 'unsharp', params: { radio: 3, amount: 1.5 } }
  ];
}

function txAplicarFiltro(brillo, ancho, alto, combo) {
  try {
    switch (combo.tipo) {
      case 'none': return brillo;
      case 'contrast': return restaurarContrast(brillo, ancho, alto, combo.params.pb, combo.params.pa);
      case 'contrast_clahe': {
        let b = restaurarContrast(brillo, ancho, alto, combo.params.pb, combo.params.pa);
        b = restaurarCLAHE(b, ancho, alto, combo.params.tiles, combo.params.clip);
        return b;
      }
      case 'ocr_combo': {
        let b = restaurarContrast(brillo, ancho, alto, 5, 95);
        b = restaurarCLAHE(b, ancho, alto, 16, 8);
        b = restaurarCLAHE(b, ancho, alto, 32, 2);
        return b;
      }
      case 'clahe_only': {
        let b = restaurarContrast(brillo, ancho, alto, 5, 95);
        b = restaurarCLAHE(b, ancho, alto, 16, 8);
        return b;
      }
      case 'sauvola': return aplicarSauvola(brillo, ancho, alto);
      case 'gamma': return aplicarGamma(brillo, ancho, alto, combo.params.valor);
      case 'unsharp': return restaurarUnsharp(brillo, ancho, alto, combo.params.radio, combo.params.amount);
      default: return brillo;
    }
  } catch(e) {
    txLog('Filtro error ' + combo.nombre + ': ' + e.message);
    return brillo;
  }
}

function txBrilloAPNGBase64(brillo, ancho, alto) {
  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(ancho, alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const v = Math.max(0, Math.min(255, brillo[y][x]));
      const idx = (y * ancho + x) * 4;
      imageData.data[idx] = v;
      imageData.data[idx + 1] = v;
      imageData.data[idx + 2] = v;
      imageData.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  const dataURL = canvas.toDataURL('image/jpeg', 0.92);
  return dataURL.replace('data:image/jpeg;base64,', '');
}

async function txCorrerOCR(brillo, ancho, alto, nombreTemp) {
  const TextRec = Capacitor.Plugins.TextRecognition;
  if (!TextRec) { txLog('TextRecognition no disponible'); return null; }

  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, ancho, alto);

  const imageData = ctx.getImageData(0, 0, ancho, alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const v = Math.max(0, Math.min(255, brillo[y][x]));
      const idx = (y * ancho + x) * 4;
      imageData.data[idx] = v;
      imageData.data[idx + 1] = v;
      imageData.data[idx + 2] = v;
      imageData.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);

  const dataURL = canvas.toDataURL('image/jpeg', 0.92);

  try {
    const result = await TextRec.processImage({ path: dataURL });
    const txt = (result && result.text) ? result.text : '';
    txLog('    text len=' + txt.length + ' inicio="' + txt.substring(0, 80).replace(/\n/g, ' ') + '"');
    return result;
  } catch(e) {
    txLog('    OCR fallo: ' + e.message);
    return null;
  }
}

async function txCorrerOCRRaw(dataURL) {
  const TextRec = Capacitor.Plugins.TextRecognition;
  if (!TextRec) { txLog('TextRecognition no disponible'); return null; }
  try {
    const result = await TextRec.processImage({ path: dataURL });
    const txt = (result && result.text) ? result.text : '';
    txLog('    RAW text len=' + txt.length + ' inicio="' + txt.substring(0, 80).replace(/\n/g, ' ') + '"');
    return result;
  } catch(e) {
    txLog('    RAW OCR fallo: ' + e.message);
    return null;
  }
}

async function txAsegurarAlbum() {

async function txCorrerOCRUpscaleAuto(img) {
  const TextRec = Capacitor.Plugins.TextRecognition;
  if (!TextRec) { txLog('TextRecognition no disponible'); return null; }

  const canvasTmp = document.createElement('canvas');
  canvasTmp.width = img.ancho; canvasTmp.height = img.alto;
  const ctxTmp = canvasTmp.getContext('2d');
  ctxTmp.drawImage(img.img, 0, 0);
  const imageDataTmp = ctxTmp.getImageData(0, 0, img.ancho, img.alto);
  const brilloTmp = calcularBrillo(imageDataTmp);

  let estim;
  try {
    estim = estimarTamanoTexto(brilloTmp, img.ancho, img.alto);
  } catch(e) {
    txLog('    [auto] estimarTamanoTexto fallo: ' + e.message);
    return txCorrerOCRRaw(img.dataURLOriginal);
  }

  const tamTexto = estim.tamTexto;
  txLog('    [auto] ' + img.nombre + ': tamTexto=' + tamTexto.toFixed(1) + 'px, renglones=' + estim.numRenglones);

  let factor;
  if (tamTexto >= 14) factor = 1.0;
  else if (tamTexto >= 10) factor = 1.5;
  else if (tamTexto >= 7) factor = 2.0;
  else if (tamTexto < 999) factor = 3.0;
  else factor = 1.0;

  const maxLado = Math.max(img.ancho, img.alto);
  const factorMax = 2048 / maxLado;
  const factorReal = Math.min(factor, factorMax);

  txLog('    [auto] factor=' + factorReal.toFixed(2) + ' (pedido=' + factor + ', max=' + factorMax.toFixed(2) + ')');

  if (factorReal <= 1.05) {
    return txCorrerOCRRaw(img.dataURLOriginal);
  }

  const wNuevo = Math.round(img.ancho * factorReal);
  const hNuevo = Math.round(img.alto * factorReal);
  const canvas = document.createElement('canvas');
  canvas.width = wNuevo;
  canvas.height = hNuevo;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img.img, 0, 0, wNuevo, hNuevo);

  const dataURL = canvas.toDataURL('image/jpeg', 0.95);
  txLog('    [auto] ' + img.ancho + 'x' + img.alto + ' -> ' + wNuevo + 'x' + hNuevo);

  try {
    const result = await TextRec.processImage({ path: dataURL });
    const txt = (result && result.text) ? result.text : '';
    txLog('    AUTO text len=' + txt.length + ' inicio="' + txt.substring(0, 80).replace(/\n/g, ' ') + '"');
    return result;
  } catch(e) {
    txLog('    AUTO OCR fallo: ' + e.message);
    return null;
  }
}
  try {
    const Media = Capacitor.Plugins.Media;
    if (!Media) return false;

    let albums = await Media.getAlbums();
    let album = (albums.albums || []).find(function(a) { return a.name === "MAR_Caribe_Texto"; });

    if (!album) {
      await Media.createAlbum({ name: "MAR_Caribe_Texto" });
      txLog("Album MAR_Caribe_Texto creado");
      albums = await Media.getAlbums();
      album = (albums.albums || []).find(function(a) { return a.name === "MAR_Caribe_Texto"; });
    }

    if (album && album.identifier) {
      window.runnerTexto.albumId = album.identifier;
      txLog("Album identifier OK");
      return true;
    }
    return false;
  } catch(e) {
    txLog("txAsegurarAlbum error: " + e.message);
    return false;
  }
}

function txContarPalabras(texto) {
  if (!texto) return 0;
  return texto.split(/\s+/).filter(function(p) { return p.length > 1; }).length;
}

async function txIniciar() {
  if (window.runnerTexto.ejecutando) { txLog('Ya ejecutando'); return; }
  if (window.runnerTexto.imagenes.length === 0) { txLog('Carga imagenes primero'); return; }

  window.runnerTexto.ejecutando = true;
  window.runnerTexto.cancelar = false;
  window.runnerTexto.resultados = [];

  txLog('Iniciando OCR: ' + txGenerarCombos().length + ' filtros x ' + window.runnerTexto.imagenes.length + ' imagenes');
  await txAsegurarAlbum();

  const combos = txGenerarCombos();
  const total = combos.length;

  for (let i = 0; i < combos.length; i++) {
    if (window.runnerTexto.cancelar) { txLog('Cancelado'); break; }
    const elBar = document.getElementById('txBar');
    if (elBar) elBar.style.width = (((i + 1) / total) * 100).toFixed(0) + '%';
    const elCombo = document.getElementById('txCombo');
    if (elCombo) elCombo.textContent = (i + 1) + '/' + total;

    const combo = combos[i];
    const resultadosPorImagen = {};
    let totalPalabras = 0;

    for (let j = 0; j < window.runnerTexto.imagenes.length; j++) {
      if (window.runnerTexto.cancelar) break;
      const img = window.runnerTexto.imagenes[j];
      try {
        if (combo.tipo === 'raw') {
          const ocrRaw = await txCorrerOCRRaw(img.dataURLOriginal);
          const palabrasRaw = ocrRaw ? txContarPalabras(ocrRaw.text) : 0;
          totalPalabras += palabrasRaw;
          resultadosPorImagen[img.nombre] = { palabras: palabrasRaw, texto: ocrRaw ? ocrRaw.text.substring(0, 100) : '' };
          continue;
        }


        if (combo.tipo === 'upscale_auto') {
          const ocrAuto = await txCorrerOCRUpscaleAuto(img);
          const palabrasAuto = ocrAuto ? txContarPalabras(ocrAuto.text) : 0;
          totalPalabras += palabrasAuto;
          resultadosPorImagen[img.nombre] = { palabras: palabrasAuto, texto: ocrAuto ? ocrAuto.text.substring(0, 100) : '' };
          continue;
        }
        const canvas = document.createElement('canvas');
        canvas.width = img.ancho; canvas.height = img.alto;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img.img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.ancho, img.alto);

        const brilloOrig = calcularBrillo(imageData);
        const brilloFilt = txAplicarFiltro(brilloOrig, img.ancho, img.alto, combo);

        const tempName = 'tx_' + combo.nombre.replace(/[^a-zA-Z0-9]/g, '_') + '_' + img.nombre + '.png';
        const ocr = await txCorrerOCR(brilloFilt, img.ancho, img.alto, tempName);

        const palabras = ocr ? txContarPalabras(ocr.text) : 0;
        totalPalabras += palabras;
        resultadosPorImagen[img.nombre] = { palabras: palabras, texto: ocr ? ocr.text.substring(0, 100) : '' };
      } catch(e) {
        txLog('Error en ' + combo.nombre + ' x ' + img.nombre + ': ' + e.message);
      }
    }

    window.runnerTexto.resultados.push({
      nombre: combo.nombre,
      totalPalabras: totalPalabras,
      porImagen: resultadosPorImagen
    });

    txLog('#' + (i + 1) + ' ' + combo.nombre + ' = ' + totalPalabras + ' palabras');
  }

  // Ranking
  const ordenados = window.runnerTexto.resultados.slice().sort(function(a, b) { return b.totalPalabras - a.totalPalabras; });
  txLog('=== TOP ' + ordenados.length + ' ===');
  ordenados.forEach(function(r, idx) {
    txLog('#' + (idx + 1) + ' ' + r.nombre + ' = ' + r.totalPalabras + ' palabras');
  });

  // Persistir ranking
  try {
    const fs = Capacitor.Plugins.Filesystem;
    if (fs) {
      const json = JSON.stringify(ordenados, null, 2);
      await fs.writeFile({ path: 'texto_ranking.json', directory: 'DOCUMENTS', encoding: 'utf8', data: json, recursive: true });
    }
  } catch(e) {
    txLog('Error guardando: ' + e.message);
  }

  txLog('Terminado');
  window.runnerTexto.ejecutando = false;
}

function txParar() {
  window.runnerTexto.cancelar = true;
  txLog('Parando...');
}

window.txIniciar = txIniciar;
window.txParar = txParar;
window.txCargarImgsClick = txCargarImgsClick;
window.txProcesarImgs = txProcesarImgs;

// Enganche de botones al DOM
function txEngancharBotones() {
  const btnCargar = document.getElementById('btnTxCargarImgs');
  const btnIniciar = document.getElementById('btnTxIniciar');
  const btnParar = document.getElementById('btnTxParar');
  const inputImgs = document.getElementById('txInputImgs');

  if (btnCargar) btnCargar.addEventListener('click', txCargarImgsClick);
  if (btnIniciar) btnIniciar.addEventListener('click', txIniciar);
  if (btnParar) btnParar.addEventListener('click', txParar);
  if (inputImgs) inputImgs.addEventListener('change', function(e) { txProcesarImgs(e.target.files); });

  console.log('[TX] Botones enganchados');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', txEngancharBotones);
} else {
  txEngancharBotones();
}

console.log('Runner Texto v1 listo');
try {
  const elChk = document.getElementById('txLog');
  if (elChk) elChk.textContent = '[v1-upscale-auto] cargado\n' + elChk.textContent;
} catch(e) {}
