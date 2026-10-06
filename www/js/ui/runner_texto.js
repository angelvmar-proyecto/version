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
      imgs.push({ nombre: arr[i].name.replace('.jpg','').replace('.png',''), img, ancho: img.width, alto: img.height });
    } catch(e) { txLog('Error: ' + e.message); }
  }
  window.runnerTexto.imagenes = imgs;
  txLog(imgs.length + ' imagenes cargadas');
  imgs.forEach(function(im) { txLog('  ' + im.nombre + ' (' + im.ancho + 'x' + im.alto + ')'); });
}

function txGenerarCombos() {
  return [
    { nombre: 'baseline', tipo: 'none', params: {} },
    { nombre: 'ocr+sauv+clahe_t32_c2', tipo: 'combo_full', params: {} },
    { nombre: 'contrast_only', tipo: 'contrast', params: { pb: 5, pa: 95 } },
    { nombre: 'cc_p5_t16_c8', tipo: 'combo_ocr', params: { pb: 5, pa: 95, tiles: 16, clip: 8 } },
    { nombre: 'cc_p5_t16_c4', tipo: 'combo_ocr', params: { pb: 5, pa: 95, tiles: 16, clip: 4 } },
    { nombre: 'cc_p5_t8_c8', tipo: 'combo_ocr', params: { pb: 5, pa: 95, tiles: 8, clip: 8 } },
    { nombre: 'sauvola_solo', tipo: 'sauvola', params: {} },
    { nombre: 'filtro_ocr_solo', tipo: 'filtro_ocr', params: {} },
    { nombre: 'gamma_1.8', tipo: 'gamma', params: { valor: 1.8 } },
    { nombre: 'unsharp_r3_a1.5', tipo: 'unsharp', params: { radio: 3, amount: 1.5 } }
  ];
}

function txAplicarFiltro(brillo, ancho, alto, combo) {
  try {
    switch (combo.tipo) {
      case 'none': return brillo;
      case 'contrast': return restaurarContrast(brillo, ancho, alto, combo.params.pb, combo.params.pa);
      case 'combo_ocr': {
        let b = restaurarContrast(brillo, ancho, alto, combo.params.pb, combo.params.pa);
        b = restaurarCLAHE(b, ancho, alto, combo.params.tiles, combo.params.clip);
        return b;
      }
      case 'combo_full': {
        let b = restaurarContrast(brillo, ancho, alto, 5, 95);
        b = restaurarCLAHE(b, ancho, alto, 16, 8);
        b = restaurarCLAHE(b, ancho, alto, 32, 2);
        b = aplicarSauvola(b, ancho, alto);
        return b;
      }
      case 'sauvola': return aplicarSauvola(brillo, ancho, alto);
      case 'filtro_ocr': {
        let b = restaurarContrast(brillo, ancho, alto, 5, 95);
        b = restaurarCLAHE(b, ancho, alto, 16, 8);
        return b;
      }
      case 'gamma': return aplicarGamma(brillo, ancho, alto, combo.params.valor);
      case 'unsharp': return restaurarUnsharp(brillo, ancho, alto, combo.params.radio, combo.params.amount);
      default: return brillo;
    }
  } catch(e) {
    console.warn('[TX] Error filtro ' + combo.nombre + ': ' + e.message);
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
  const dataURL = canvas.toDataURL('image/png');
  return dataURL.replace('data:image/png;base64,', '');
}

async function txCorrerOCR(brillo, ancho, alto, nombreTemp) {
  const TextRec = Capacitor.Plugins.TextRecognition;
  if (!TextRec) { txLog('TextRecognition no disponible'); return null; }

  const base64 = txBrilloAPNGBase64(brillo, ancho, alto);
  const dataUrl = 'data:image/png;base64,' + base64;

  // Intento 1: dataURL directo
  try {
    txLog('    dataURL (' + base64.length + ' chars)');
    const result = await TextRec.processImage({ path: dataUrl });
    txLog('    OK via dataURL');
    return result;
  } catch(e1) {
    txLog('    dataURL fallo: ' + e1.message);
  }

  // Intento 2: Media.savePhoto + getMedias
  const Media = Capacitor.Plugins.Media;
  if (!Media) { txLog('    Media no disponible'); return null; }

  try {
    const fileName = nombreTemp.replace('.png', '');
    await Media.savePhoto({
      path: dataUrl,
      albumIdentifier: window.runnerTexto.albumId,
      fileName: fileName
    });
    txLog('    Guardado con Media: ' + fileName);

    const medias = await Media.getMedias({ quantity: 1 });
    if (medias && medias.medias && medias.medias[0]) {
      const u = medias.medias[0];
      txLog('    Ultimo identifier: ' + u.identifier);

      // Intento 2a: identifier
      try {
        const r2 = await TextRec.processImage({ path: u.identifier });
        txLog('    OK via identifier');
        return r2;
      } catch(e2) { txLog('    identifier fallo: ' + e2.message); }

      // Intento 2b: data como dataURL
      if (u.data) {
        try {
          const d2 = 'data:image/jpeg;base64,' + u.data;
          const r3 = await TextRec.processImage({ path: d2 });
          txLog('    OK via media.data');
          return r3;
        } catch(e3) { txLog('    media.data fallo: ' + e3.message); }
      }
    }
  } catch(e) {
    txLog('    Media fallo: ' + e.message);
  }

  return null;
}
function txContarPalabras(texto) {
  if (!texto) return 0;
  const palabras = texto.split(/\s+/).filter(function(w) {
    return w.length >= 3 && /[a-zA-Z0-9áéíóúñÁÉÍÓÚÑ]/.test(w);
  });
  return palabras.length;
}


async function txAsegurarAlbum() {
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

    txLog("No se pudo obtener identifier del album");
    return false;
  } catch(e) {
    txLog("Error album: " + e.message);
    return false;
  }
}
async function txEjecutar() {
  if (window.runnerTexto.ejecutando) { txLog('Ya corriendo'); return; }
  if (window.runnerTexto.imagenes.length < 1) { txLog('Faltan imagenes'); return; }

  window.runnerTexto.ejecutando = true;
  window.runnerTexto.cancelar = false;
  window.runnerTexto.resultados = [];

  await txAsegurarAlbum();

  const combos = txGenerarCombos();
  const total = combos.length;
  txLog('Iniciando OCR: ' + total + ' filtros x ' + window.runnerTexto.imagenes.length + ' imagenes');

  const t0 = performance.now();

  for (let i = 0; i < combos.length; i++) {
    if (window.runnerTexto.cancelar) { txLog('Cancelado en combo ' + (i + 1)); break; }

    const combo = combos[i];
    const elCombo = document.getElementById('txCombo');
    const elBar = document.getElementById('txBar');
    if (elCombo) elCombo.textContent = (i + 1) + '/' + total;
    if (elBar) elBar.style.width = (((i + 1) / total) * 100).toFixed(0) + '%';

    const resultadosPorImagen = {};
    let totalPalabras = 0;

    for (let j = 0; j < window.runnerTexto.imagenes.length; j++) {
      const img = window.runnerTexto.imagenes[j];
      try {
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

    await new Promise(function(r) { setTimeout(r, 50); });
  }

  const t1 = performance.now();
  window.runnerTexto.ejecutando = false;
  txLog('Terminado en ' + ((t1 - t0) / 1000).toFixed(1) + 's');

  const ranking = window.runnerTexto.resultados.slice().sort(function(a, b) { return b.totalPalabras - a.totalPalabras; });
  txLog('=== TOP 10 ===');
  ranking.forEach(function(r, i) { txLog((i + 1) + '. ' + r.nombre + ' = ' + r.totalPalabras + ' palabras'); });

  try {
    const fs = Capacitor.Plugins.Filesystem;
    const out = { fecha: new Date().toISOString(), total: ranking.length, ranking: ranking };
    const json = JSON.stringify(out, null, 2);
    await fs.writeFile({ path: 'texto_ranking.json', directory: 'DOCUMENTS', encoding: 'utf8', data: json, recursive: true });
    txLog('Guardado en Documents/texto_ranking.json');
    alert('Guardado en Documents/texto_ranking.json');
  } catch(e) { txLog('Error guardando: ' + e.message); }
}

function txSetup() {
  const logEl = document.getElementById('txLog');
  if (logEl) logEl.textContent = 'Runner Texto v1 listo\n';

  const btnCI = document.getElementById('btnTxCargarImgs');
  const inpI = document.getElementById('txInputImgs');
  if (btnCI) btnCI.onclick = txCargarImgsClick;
  if (inpI) inpI.onchange = function(e) { if (e.target.files.length > 0) txProcesarImgs(e.target.files); };

  const btnI = document.getElementById('btnTxIniciar');
  const btnP = document.getElementById('btnTxParar');
  if (btnI) btnI.onclick = txEjecutar;
  if (btnP) btnP.onclick = function() { window.runnerTexto.cancelar = true; };

  const tabBtns = document.querySelectorAll('.tab');
  tabBtns.forEach(function(t) {
    if (t.dataset.tab === 'texto' && !t.dataset.bound) {
      t.dataset.bound = '1';
      t.addEventListener('click', function() {
        document.querySelectorAll('.tab').forEach(function(x) { x.classList.remove('active'); });
        document.querySelectorAll('.tab-content').forEach(function(x) { x.classList.remove('active'); });
        this.classList.add('active');
        const c = document.getElementById('tab-texto');
        if (c) c.classList.add('active');
      });
    }
  });

  console.log('runner_texto.js listo');
}

setTimeout(txSetup, 500);
