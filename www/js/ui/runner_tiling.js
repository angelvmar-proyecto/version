// ==============================================
// ui/runner_tiling.js
// Runner de Tiling: prueba tiles + filtros.
// ==============================================

window.runnerTil = {
  imagenes: [],
  ejecutando: false,
  cancelar: false,
  resultados: []
};

function tilLog(msg) {
  const el = document.getElementById('tilLog');
  if (!el) { console.log('[TIL] ' + msg); return; }
  el.textContent = msg + '\n' + el.textContent;
  console.log('[TIL] ' + msg);
}

function tilCargarImgsClick() {
  const inp = document.getElementById('tilInputImgs');
  if (inp) { inp.value = ''; inp.click(); }
}

async function tilProcesarImgs(files) {
  const arr = Array.from(files);
  if (arr.length < 1) { tilLog('Selecciona imagenes'); return; }
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
        alto: img.height
      });
    } catch(e) { tilLog('Error: ' + e.message); }
  }
  window.runnerTil.imagenes = imgs;
  tilLog(imgs.length + ' imagenes cargadas');
  imgs.forEach(function(im) { tilLog('  ' + im.nombre + ' (' + im.ancho + 'x' + im.alto + ')'); });
}

function tilGenerarCombos() {
  return [
    // --- Bloque 1: variar tileSize (sin filtro) ---
    { nombre: 'tile400', tileSize: 400, overlap: 30, upscale: 3 },
    { nombre: 'tile500', tileSize: 500, overlap: 30, upscale: 3 },
    { nombre: 'tile600', tileSize: 600, overlap: 30, upscale: 3 },
    // --- Bloque 2: variar overlap (tile 500, sin filtro) ---
    { nombre: 'ov20', tileSize: 500, overlap: 20, upscale: 3 },
    { nombre: 'ov30', tileSize: 500, overlap: 30, upscale: 3 },
    { nombre: 'ov50', tileSize: 500, overlap: 50, upscale: 3 },
    // --- Bloque 3: variar upscale (tile 500) ---
    { nombre: 'up2', tileSize: 500, overlap: 30, upscale: 2 },
    { nombre: 'up3', tileSize: 500, overlap: 30, upscale: 3 },
    { nombre: 'up4', tileSize: 500, overlap: 30, upscale: 4 },
    // --- Bloque 4: filtros sobre tile 500/overlap 30/upscale 3 ---
    { nombre: 't500+blackhat3', tileSize: 500, overlap: 30, upscale: 3, filtro: { fn: 'nitBlackHat', args: [3] } },
    { nombre: 't500+gamma', tileSize: 500, overlap: 30, upscale: 3, filtro: { fn: 'nitGammaAdaptativaLocal', args: [15] } },
    { nombre: 't500+gamma+bh5', tileSize: 500, overlap: 30, upscale: 3, filtro: { fn: 'nitGammaAdaptativaLocal', args: [15], extra: { fn: 'nitBlackHat', args: [5] } } },
    { nombre: 't500+wiener', tileSize: 500, overlap: 30, upscale: 3, filtro: { fn: 'nitWiener', args: [0.05] } },
    { nombre: 't500+unsharp', tileSize: 500, overlap: 30, upscale: 3, filtro: { fn: 'nitUnsharpAdaptativo', args: [2, 1.0, 15] } },
    { nombre: 't500+bilateral', tileSize: 500, overlap: 30, upscale: 3, filtro: { fn: 'nitBilateralPlus', args: [30, 2] } },
    // --- Bloque 5: tile + filtro ---
    { nombre: 't400+blackhat3', tileSize: 400, overlap: 30, upscale: 3, filtro: { fn: 'nitBlackHat', args: [3] } },
    { nombre: 't600+gamma', tileSize: 600, overlap: 30, upscale: 3, filtro: { fn: 'nitGammaAdaptativaLocal', args: [15] } },
    { nombre: 't400+gamma+bh5', tileSize: 400, overlap: 30, upscale: 3, filtro: { fn: 'nitGammaAdaptativaLocal', args: [15], extra: { fn: 'nitBlackHat', args: [5] } } }
  ];
}

// Aplica filtro sobre un canvas upscaleado, devuelve dataURL con filtro
function tilAplicarFiltroACanvas(canvasUp, filtro) {
  if (!filtro || !filtro.fn) {
    return canvasUp.toDataURL('image/jpeg', 0.95);
  }
  const w = canvasUp.width;
  const h = canvasUp.height;
  const ctx = canvasUp.getContext('2d');
  const imageData = ctx.getImageData(0, 0, w, h);
  let brillo = calcularBrillo(imageData);

  const fnPrincipal = window[filtro.fn];
  if (!fnPrincipal) return canvasUp.toDataURL('image/jpeg', 0.95);
  brillo = fnPrincipal(brillo, w, h, ...filtro.args);

  if (filtro.extra) {
    const fnEx = window[filtro.extra.fn];
    if (fnEx) brillo = fnEx(brillo, w, h, ...filtro.extra.args);
  }

  const canvasOut = document.createElement('canvas');
  canvasOut.width = w;
  canvasOut.height = h;
  const ctxOut = canvasOut.getContext('2d');
  const imageDataOut = ctxOut.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = Math.max(0, Math.min(255, brillo[y][x] | 0));
      const idx = (y * w + x) * 4;
      imageDataOut.data[idx] = v;
      imageDataOut.data[idx + 1] = v;
      imageDataOut.data[idx + 2] = v;
      imageDataOut.data[idx + 3] = 255;
    }
  }
  ctxOut.putImageData(imageDataOut, 0, 0);
  return canvasOut.toDataURL('image/jpeg', 0.95);
}

async function tilCorrerTiling(img, combo) {
  const TextRec = Capacitor.Plugins.TextRecognition;
  if (!TextRec) { tilLog('TextRecognition no disponible'); return null; }

  const ancho = img.ancho;
  const alto = img.alto;
  const tileSize = combo.tileSize;
  const overlap = combo.overlap;
  const upscale = combo.upscale;
  const step = tileSize - overlap;

  const xs = [];
  for (let x = 0; x < ancho; x += step) {
    xs.push(Math.min(x, Math.max(0, ancho - tileSize)));
    if (x + tileSize >= ancho) break;
  }
  const ys = [];
  for (let y = 0; y < alto; y += step) {
    ys.push(Math.min(y, Math.max(0, alto - tileSize)));
    if (y + tileSize >= alto) break;
  }
  const xsU = Array.from(new Set(xs));
  const ysU = Array.from(new Set(ys));

  const lineasGlobales = [];
  for (const y of ysU) {
    for (const x of xsU) {
      const w = Math.min(tileSize, ancho - x);
      const h = Math.min(tileSize, alto - y);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img.img, x, y, w, h, 0, 0, w, h);

      const wUp = Math.round(w * upscale);
      const hUp = Math.round(h * upscale);
      const canvasUp = document.createElement('canvas');
      canvasUp.width = wUp;
      canvasUp.height = hUp;
      const ctxUp = canvasUp.getContext('2d');
      ctxUp.imageSmoothingEnabled = true;
      ctxUp.imageSmoothingQuality = 'high';
      ctxUp.drawImage(canvas, 0, 0, wUp, hUp);

      const dataURL = tilAplicarFiltroACanvas(canvasUp, combo.filtro);

      try {
        const result = await TextRec.processImage({ path: dataURL });
        let txt = (result && result.text) ? result.text : '';
        try {
          if (typeof ocrPostProcesar === 'function') txt = ocrPostProcesar(txt);
        } catch(e) {}
        const lineas = txt.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });
        for (const l of lineas) lineasGlobales.push(l);
      } catch(e) {}
    }
  }

  // Dedupe
  const lineasFiltradas = [];
  for (const l of lineasGlobales) {
    let dup = false;
    const ini = Math.max(0, lineasFiltradas.length - 5);
    for (let k = ini; k < lineasFiltradas.length; k++) {
      let sim = 0;
      if (typeof ocrSimilitud === 'function') sim = ocrSimilitud(l, lineasFiltradas[k]);
      else sim = (l === lineasFiltradas[k]) ? 1 : 0;
      if (sim > 0.85) { dup = true; break; }
    }
    if (!dup) lineasFiltradas.push(l);
  }

  return { text: lineasFiltradas.join('\n'), len: lineasFiltradas.join('\n').length, lineas: lineasGlobales.length, dedup: lineasFiltradas.length };
}

async function tilGuardarRanking() {
  try {
    const fs = Capacitor.Plugins.Filesystem;
    if (!fs) return;
    const ordenados = window.runnerTil.resultados.slice().sort(function(a, b) { return b.totalPalabras - a.totalPalabras; });
    const out = {
      fecha: new Date().toISOString(),
      buildTag: (typeof BUILD_TAG !== 'undefined') ? BUILD_TAG : 'desconocido',
      totalCombos: ordenados.length,
      completo: ordenados
    };
    await fs.writeFile({
      path: 'MAR_Caribe_OCR_Sim/ranking_tiling.json',
      directory: 'DOCUMENTS',
      encoding: 'utf8',
      data: JSON.stringify(out, null, 2),
      recursive: true
    });
  } catch(e) {}
}

async function tilIniciar() {
  if (window.runnerTil.ejecutando) { tilLog('Ya ejecutando'); return; }
  if (window.runnerTil.imagenes.length === 0) { tilLog('Carga imagenes primero'); return; }

  window.runnerTil.ejecutando = true;
  window.runnerTil.cancelar = false;
  window.runnerTil.resultados = [];

  const combos = tilGenerarCombos();
  const total = combos.length;
  tilLog('Iniciando tiling: ' + total + ' combos x ' + window.runnerTil.imagenes.length + ' imagenes');

  for (let i = 0; i < combos.length; i++) {
    if (window.runnerTil.cancelar) { tilLog('Cancelado'); break; }
    const elBar = document.getElementById('tilBar');
    if (elBar) elBar.style.width = (((i + 1) / total) * 100).toFixed(0) + '%';
    const elCombo = document.getElementById('tilCombo');
    if (elCombo) elCombo.textContent = (i + 1) + '/' + total;

    const combo = combos[i];
    const porImagen = {};
    let totalPalabras = 0;

    for (let j = 0; j < window.runnerTil.imagenes.length; j++) {
      if (window.runnerTil.cancelar) break;
      const img = window.runnerTil.imagenes[j];
      try {
        const res = await tilCorrerTiling(img, combo);
        if (!res) continue;
        const palabras = res.text.split(/\s+/).filter(function(p) { return p.length > 1; }).length;
        totalPalabras += palabras;
        porImagen[img.nombre] = { palabras: palabras, len: res.len, lineas: res.lineas, dedup: res.dedup };
        tilLog('  ' + combo.nombre + ' x ' + img.nombre + ': ' + palabras + ' palabras (lineas ' + res.lineas + '->' + res.dedup + ')');
      } catch(e) {
        tilLog('Error ' + combo.nombre + ' x ' + img.nombre + ': ' + e.message);
      }
    }

    window.runnerTil.resultados.push({ nombre: combo.nombre, totalPalabras: totalPalabras, porImagen: porImagen });
    tilLog('#' + (i + 1) + ' ' + combo.nombre + ' = ' + totalPalabras + ' palabras');
    await tilGuardarRanking();
  }

  const ordenados = window.runnerTil.resultados.slice().sort(function(a, b) { return b.totalPalabras - a.totalPalabras; });
  tilLog('=== TOP ' + ordenados.length + ' ===');
  ordenados.forEach(function(r, idx) { tilLog('#' + (idx + 1) + ' ' + r.nombre + ' = ' + r.totalPalabras + ' palabras'); });
  tilLog('Terminado');
  window.runnerTil.ejecutando = false;
}

function tilParar() {
  window.runnerTil.cancelar = true;
  tilLog('Parando...');
}

window.tilCargarImgsClick = tilCargarImgsClick;
window.tilProcesarImgs = tilProcesarImgs;
window.tilIniciar = tilIniciar;
window.tilParar = tilParar;

// --- Enganche de botones ---
function tilEngancharBotones() {
  const btnCargar = document.getElementById('btnTilCargarImgs');
  const btnIniciar = document.getElementById('btnTilIniciar');
  const btnParar = document.getElementById('btnTilParar');
  const inputImgs = document.getElementById('tilInputImgs');
  if (btnCargar) btnCargar.addEventListener('click', tilCargarImgsClick);
  if (btnIniciar) btnIniciar.addEventListener('click', tilIniciar);
  if (btnParar) btnParar.addEventListener('click', tilParar);
  if (inputImgs) inputImgs.addEventListener('change', function(e) { tilProcesarImgs(e.target.files); });
  console.log('[TIL] Botones enganchados');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', tilEngancharBotones);
} else {
  tilEngancharBotones();
}

// --- Enganche del tab ---
(function() {
  function tilEngancharTab() {
    const tabBtns = document.querySelectorAll('.tab');
    tabBtns.forEach(function(t) {
      if (t.dataset.tab === 'tiling' && !t.dataset.bound) {
        t.dataset.bound = '1';
        t.addEventListener('click', function() {
          document.querySelectorAll('.tab').forEach(function(x) { x.classList.remove('active'); });
          document.querySelectorAll('.tab-content').forEach(function(x) { x.classList.remove('active'); });
          this.classList.add('active');
          const c = document.getElementById('tab-tiling');
          if (c) c.classList.add('active');
        });
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tilEngancharTab);
  } else {
    tilEngancharTab();
  }
  setTimeout(tilEngancharTab, 500);
})();

console.log('runner_tiling.js v1 cargado');

try {
  const elChk = document.getElementById('tilLog');
  if (elChk) elChk.textContent = '[til-v1] cargado - ' + tilGenerarCombos().length + ' combos\n' + elChk.textContent;
} catch(e) {}
