// ==============================================
// ui/runner_ocr_directo.js
// OCR puro: ML Kit lee líneas y las ponemos en filas.
// Sin grilla, sin geometría. 4 variantes.
// ==============================================

window.runnerOD = {
  imagen: null,
  ejecutando: false,
  cancelar: false,
  resultados: {}
};

function odLog(msg) {
  const el = document.getElementById('odLog');
  if (!el) { console.log('[OD] ' + msg); return; }
  el.textContent = msg + '\n' + el.textContent;
  console.log('[OD] ' + msg);
}

function odCargarImagenClick() {
  const inp = document.getElementById('odInputImg');
  if (inp) { inp.value = ''; inp.click(); }
}

async function odProcesarImagen(file) {
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
    window.runnerOD.imagen = {
      nombre: file.name.replace('.jpg','').replace('.png',''),
      img: img,
      ancho: img.width,
      alto: img.height
    };
    odLog('Imagen: ' + window.runnerOD.imagen.nombre + ' (' + img.width + 'x' + img.height + ')');
  } catch(e) { odLog('Error: ' + e.message); }
}

// Aplica filtro sobre canvas upscaleado
function odAplicarFiltro(canvasUp, filtro) {
  if (!filtro) return canvasUp.toDataURL('image/jpeg', 0.95);
  const w = canvasUp.width, h = canvasUp.height;
  const ctx = canvasUp.getContext('2d');
  const imageData = ctx.getImageData(0, 0, w, h);
  let brillo = calcularBrillo(imageData);
  
  if (filtro === 'blackhat') brillo = nitBlackHat(brillo, w, h, 3);
  else if (filtro === 'gamma') brillo = nitGammaAdaptativaLocal(brillo, w, h, 15);
  else if (filtro === 'bh_gamma') {
    brillo = nitBlackHat(brillo, w, h, 3);
    brillo = nitGammaAdaptativaLocal(brillo, w, h, 15);
  }
  
  const canvasOut = document.createElement('canvas');
  canvasOut.width = w; canvasOut.height = h;
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

async function odCorrerTiling(img, filtro) {
  const TextRec = Capacitor.Plugins.TextRecognition;
  if (!TextRec) return [];
  const tileSize = 500, overlap = 30, upscale = 4, step = tileSize - overlap;
  const xs = [], ys = [];
  for (let x = 0; x < img.ancho; x += step) {
    xs.push(Math.min(x, Math.max(0, img.ancho - tileSize)));
    if (x + tileSize >= img.ancho) break;
  }
  for (let y = 0; y < img.alto; y += step) {
    ys.push(Math.min(y, Math.max(0, img.alto - tileSize)));
    if (y + tileSize >= img.alto) break;
  }
  const xsU = Array.from(new Set(xs)), ysU = Array.from(new Set(ys));
  const lineas = [];
  let tilesProc = 0;
  const totalTiles = xsU.length * ysU.length;

  for (const y of ysU) {
    if (window.runnerOD.cancelar) break;
    for (const x of xsU) {
      if (window.runnerOD.cancelar) break;
      const w = Math.min(tileSize, img.ancho - x), h = Math.min(tileSize, img.alto - y);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img.img, x, y, w, h, 0, 0, w, h);

      const wUp = Math.round(w * upscale), hUp = Math.round(h * upscale);
      const canvasUp = document.createElement('canvas');
      canvasUp.width = wUp; canvasUp.height = hUp;
      const ctxUp = canvasUp.getContext('2d');
      ctxUp.imageSmoothingEnabled = true; ctxUp.imageSmoothingQuality = 'high';
      ctxUp.drawImage(canvas, 0, 0, wUp, hUp);

      const dataURL = odAplicarFiltro(canvasUp, filtro);
      try {
        const result = await TextRec.processImage({ path: dataURL });
        if (result && result.blocks) {
          for (const block of result.blocks) {
            if (!block.lines) continue;
            for (const line of block.lines) {
              if (!line.boundingBox) continue;
              const ly = (line.boundingBox.top / upscale) + y;
              const lh = ((line.boundingBox.bottom - line.boundingBox.top) / upscale);
              const elementos = [];
              if (line.elements) {
                for (const el of line.elements) {
                  if (!el.boundingBox) continue;
                  elementos.push({
                    text: el.text,
                    absLeft: (el.boundingBox.left / upscale) + x
                  });
                }
              }
              lineas.push({ text: line.text, absTop: ly, absBottom: ly + lh, cy: ly + (lh/2), elementos });
            }
          }
        }
      } catch(e) {}
      tilesProc++;
      if (tilesProc % 10 === 0) odLog('  Tiles: ' + tilesProc + '/' + totalTiles);
    }
  }
  
  // Deduplicar líneas (misma Y y texto similar)
  const unicas = [];
  for (const l of lineas) {
    let dup = false;
    for (const u of unicas) {
      if (Math.abs(u.cy - l.cy) < 15) {
        let sim = (typeof ocrSimilitud === 'function') ? ocrSimilitud(l.text, u.text) : (l.text === u.text ? 1 : 0);
        if (sim > 0.85) { dup = true; break; }
      }
    }
    if (!dup) unicas.push(l);
  }
  unicas.sort(function(a, b) { return a.cy - b.cy; });
  for (const l of unicas) l.elementos.sort(function(a, b) { return a.absLeft - b.absLeft; });
  return unicas;
}

function odLineasAMatriz(lineas) {
  const matriz = [];
  let maxCols = 0;
  for (const l of lineas) if (l.elementos.length > maxCols) maxCols = l.elementos.length;
  for (const l of lineas) {
    const fila = [];
    for (let j = 0; j < maxCols; j++) fila.push(l.elementos[j] ? l.elementos[j].text : '');
    matriz.push(fila);
  }
  return matriz;
}

function odTokensDeMatriz(matriz) {
  const set = new Set();
  for (const fila of matriz) for (const celda of fila) {
    if (!celda) continue;
    String(celda).toUpperCase().split(/[\s,;:.\/\(\)\[\]{}'"!?¡¿|]+/).forEach(function(t){ if(t.length>=3) set.add(t); });
  }
  return set;
}

async function odIniciar() {
  if (window.runnerOD.ejecutando) { odLog('Ya ejecutando'); return; }
  if (!window.runnerOD.imagen) { odLog('Carga imagen'); return; }
  window.runnerOD.ejecutando = true;
  window.runnerOD.cancelar = false;
  window.runnerOD.resultados = {};

  try {
    const img = window.runnerOD.imagen;
    odLog('=== Iniciando OCR Directo ===');
    const variantes = [
      { nombre: 'V1_raw', filtro: null },
      { nombre: 'V2_blackhat', filtro: 'blackhat' },
      { nombre: 'V3_gamma', filtro: 'gamma' },
      { nombre: 'V4_bh_gamma', filtro: 'bh_gamma' }
    ];
    const conjuntos = {};

    for (const v of variantes) {
      if (window.runnerOD.cancelar) break;
      odLog('');
      odLog('>>> ' + v.nombre + ' <<<');
      const lineas = await odCorrerTiling(img, v.filtro);
      odLog('  Líneas: ' + lineas.length);
      const matriz = odLineasAMatriz(lineas);
      const tokens = odTokensDeMatriz(matriz);
      odLog('  Tokens únicos: ' + tokens.size);
      
      conjuntos[v.nombre] = tokens;
      window.runnerOD.resultados[v.nombre] = { matriz, lineas, tokens };
      
      if (typeof window.tabGuardarCsv === 'function') {
        await window.tabGuardarCsv(matriz, img.nombre + '_' + v.nombre);
        odLog('  CSV guardado');
      }
      if (window.runnerTabla) window.runnerTabla.matrizFinal = matriz;
    }

    // Consenso cruzado
    odLog('');
    odLog('=== CONSENSO CRUZADO ===');
    const contador = {};
    const todos = new Set();
    for (const k in conjuntos) {
      for (const t of conjuntos[k]) {
        todos.add(t);
        contador[t] = (contador[t] || 0) + 1;
      }
    }
    let en4=0, en3=0, en2=0, en1=0;
    for (const t of todos) {
      if (contador[t] === 4) en4++;
      else if (contador[t] === 3) en3++;
      else if (contador[t] === 2) en2++;
      else en1++;
    }
    odLog('Total únicos: ' + todos.size);
    odLog('En 4 variantes: ' + en4);
    odLog('En 3 variantes: ' + en3);
    odLog('En 2 variantes: ' + en2);
    odLog('En 1 sola: ' + en1);

    odLog('');
    odLog('=== SCORE POR VARIANTE ===');
    for (const v of variantes) {
      const propios = conjuntos[v.nombre];
      let cons = 0;
      for (const t of propios) {
        let c = 0;
        for (const k in conjuntos) if (conjuntos[k].has(t)) c++;
        if (c >= 2) cons++;
      }
      const pct = propios.size > 0 ? (cons / propios.size * 100).toFixed(1) : '0';
      odLog(v.nombre + ': ' + propios.size + ' tokens, ' + cons + ' en consenso (' + pct + '%)');
    }
    odLog('');
    odLog('=== TERMINADO ===');
  } catch(e) {
    odLog('ERROR: ' + e.message);
  } finally {
    window.runnerOD.ejecutando = false;
  }
}

function odParar() { window.runnerOD.cancelar = true; odLog('Parando...'); }

window.odCargarImagenClick = odCargarImagenClick;
window.odProcesarImagen = odProcesarImagen;
window.odIniciar = odIniciar;
window.odParar = odParar;

function odEngancharBotones() {
  const btnCargar = document.getElementById('btnOdCargarImg');
  const btnIniciar = document.getElementById('btnOdIniciar');
  const btnParar = document.getElementById('btnOdParar');
  const inputImg = document.getElementById('odInputImg');
  if (btnCargar) btnCargar.addEventListener('click', odCargarImagenClick);
  if (btnIniciar) btnIniciar.addEventListener('click', odIniciar);
  if (btnParar) btnParar.addEventListener('click', odParar);
  if (inputImg) inputImg.addEventListener('change', function(e) {
    if (e.target.files && e.target.files[0]) odProcesarImagen(e.target.files[0]);
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', odEngancharBotones);
else odEngancharBotones();

(function() {
  function odEngancharTab() {
    document.querySelectorAll('.tab').forEach(function(t) {
      if (t.dataset.tab === 'ocr_directo' && !t.dataset.bound) {
        t.dataset.bound = '1';
        t.addEventListener('click', function() {
          document.querySelectorAll('.tab').forEach(function(x) { x.classList.remove('active'); });
          document.querySelectorAll('.tab-content').forEach(function(x) { x.classList.remove('active'); });
          this.classList.add('active');
          const c = document.getElementById('tab-ocr-directo');
          if (c) c.classList.add('active');
        });
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', odEngancharTab);
  else odEngancharTab();
  setTimeout(odEngancharTab, 500);
})();
console.log('runner_ocr_directo.js cargado');
