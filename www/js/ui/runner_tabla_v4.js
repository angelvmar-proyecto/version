// ==============================================
// ui/runner_tabla_v4.js
// Pipeline Iterativo: OCR puro -> Grilla geométrica -> CSV
// ==============================================

window.runnerTablaV4 = {
  imagen: null,
  referencia: null,
  ejecutando: false,
  cancelar: false,
  matrizFinal: null
};

function tab4Log(msg) {
  const el = document.getElementById('tab4Log');
  if (!el) { console.log('[TAB4] ' + msg); return; }
  el.textContent = msg + '\n' + el.textContent;
  console.log('[TAB4] ' + msg);
}

function tab4CargarImagenClick() {
  const inp = document.getElementById('tab4InputImg');
  if (inp) { inp.value = ''; inp.click(); }
}

async function tab4ProcesarImagen(file) {
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
    window.runnerTablaV4.imagen = {
      nombre: file.name.replace('.jpg','').replace('.png',''),
      img: img,
      ancho: img.width,
      alto: img.height
    };
    tab4Log('Imagen: ' + window.runnerTablaV4.imagen.nombre + ' (' + img.width + 'x' + img.height + ')');
  } catch(e) { tab4Log('Error cargando: ' + e.message); }
}

// Recolector de elementos OCR en toda la imagen
async function tab4CorrerOCRTiling(img) {
  const TextRec = Capacitor.Plugins.TextRecognition;
  if (!TextRec) return [];
  
  const tileSize = 500;
  const overlap = 30;
  const upscale = 4;
  const step = tileSize - overlap;
  
  const xs = [], ys = [];
  for (let x = 0; x < img.ancho; x += step) {
    xs.push(Math.min(x, Math.max(0, img.ancho - tileSize)));
    if (x + tileSize >= img.ancho) break;
  }
  for (let y = 0; y < img.alto; y += step) {
    ys.push(Math.min(y, Math.max(0, img.alto - tileSize)));
    if (y + tileSize >= img.alto) break;
  }
  const xsU = Array.from(new Set(xs));
  const ysU = Array.from(new Set(ys));
  
  const todosElementos = [];
  let tilesProcesados = 0;
  const totalTiles = xsU.length * ysU.length;

  for (const y of ysU) {
    if (window.runnerTablaV4.cancelar) break;
    for (const x of xsU) {
      if (window.runnerTablaV4.cancelar) break;
      
      const w = Math.min(tileSize, img.ancho - x);
      const h = Math.min(tileSize, img.alto - y);
      
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img.img, x, y, w, h, 0, 0, w, h);

      const wUp = Math.round(w * upscale);
      const hUp = Math.round(h * upscale);
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
                  absTop: (el.boundingBox.top / upscale) + y,
                  absBottom: (el.boundingBox.bottom / upscale) + y,
                  cx: ((el.boundingBox.left + el.boundingBox.right) / 2 / upscale) + x,
                  cy: ((el.boundingBox.top + el.boundingBox.bottom) / 2 / upscale) + y
                });
              }
            }
          }
        }
      } catch(e) {}
      
      tilesProcesados++;
      if (tilesProcesados % 10 === 0) tab4Log('  Tiles: ' + tilesProcesados + '/' + totalTiles);
    }
  }
  
  // Deduplicación de elementos por overlap de tiles
  const limpios = [];
  for (const el of todosElementos) {
    let dup = false;
    for (const d of limpios) {
      if (Math.abs(d.cx - el.cx) < 15 && Math.abs(d.cy - el.cy) < 10) {
        if (typeof ocrSimilitud === 'function' && ocrSimilitud(el.text, d.text) > 0.8) {
          dup = true; break;
        }
      }
    }
    if (!dup) limpios.push(el);
  }
  
  return limpios;
}

// Agrupa elementos por filas (Y)
function tab4AgruparEnFilas(elementos) {
  if (elementos.length === 0) return [];
  
  // Ordenar por Y
  elementos.sort(function(a, b) { return a.cy - b.cy; });
  
  const filas = [];
  let filaActual = [elementos[0]];
  
  for (let i = 1; i < elementos.length; i++) {
    const el = elementos[i];
    // Si está cerca en Y de la fila actual, se agrega
    if (Math.abs(el.cy - filaActual[0].cy) < 20) {
      filaActual.push(el);
    } else {
      // Nueva fila
      filas.push(filaActual);
      filaActual = [el];
    }
  }
  filas.push(filaActual);
  
  // Ordenar cada fila por X
  for (const f of filas) {
    f.sort(function(a, b) { return a.cx - b.cx; });
  }
  
  return filas;
}

async function tab4Iniciar() {
  if (window.runnerTablaV4.ejecutando) { tab4Log('Ya ejecutando'); return; }
  if (!window.runnerTablaV4.imagen) { tab4Log('Carga imagen'); return; }

  window.runnerTablaV4.ejecutando = true;
  window.runnerTablaV4.cancelar = false;

  try {
    const img = window.runnerTablaV4.imagen;
    tab4Log('=== Iniciando Tabla v4 (Iterativo) ===');
    
    // 1. Recolectar TODO el texto sin importar líneas
    tab4Log('Extrayendo texto de toda la imagen...');
    const elementos = await tab4CorrerOCRTiling(img);
    tab4Log('Elementos únicos extraídos: ' + elementos.length);

    // 2. Agrupar por filas basado puramente en Y
    tab4Log('Agrupando en filas...');
    const filas = tab4AgruparEnFilas(elementos);
    tab4Log('Filas detectadas por texto: ' + filas.length);

    // 3. Inferir líneas V basadas en los textos
    tab4Log('Infiriendo columnas geométricamente...');
    const lineasV = motorInferirColumnas(filas, img.ancho);
    tab4Log('Columnas inferidas: ' + lineasV.length);

    // 4. Construir matriz y asignar celdas
    const grilla = tablaConstruirGrilla([], lineasV);
    grilla.numFilas = filas.length;
    
    const celdas = {};
    for (let i = 0; i < filas.length; i++) {
      for (const el of filas[i]) {
        let col = -1;
        for (let j = 0; j < lineasV.length - 1; j++) {
          if (el.cx >= lineasV[j] && el.cx < lineasV[j + 1]) { col = j; break; }
        }
        if (col < 0) continue;
        const key = i + '_' + col;
        if (!celdas[key]) celdas[key] = [];
        celdas[key].push({ text: el.text, left: el.absLeft, top: el.absTop });
      }
    }

    // 5. Armar matriz final y limpiar
    const resultado = tabArmarMatrizYLimpiar(celdas, grilla);
    tab4Log('Matriz final: ' + resultado.filasFinales + ' x ' + resultado.columnasFinales);
    tab4Log('[tipos] ' + JSON.stringify(resultado.tiposColumnas.map(function(t){ return t.tipo; })));
    tab4Log('[corrección] ' + resultado.celdasCorregidas + '/' + resultado.celdasTotales);

    // 6. Guardar para pestaña Excel
    window.runnerTabla.matrizFinal = resultado.matriz;
    window.runnerTablaV4.matrizFinal = resultado.matriz;

    // 7. Comparar con referencia si existe
    if (!window.runnerTablaV4.referencia) {
      const nombre = img.nombre.toLowerCase();
      let rutaRef = null;
      if (nombre.indexOf('sep1') >= 0) rutaRef = 'assets/referencia/01_sep.csv';
      if (rutaRef) {
        window.runnerTablaV4.referencia = await ocrCargarReferencia(rutaRef);
      }
    }
    if (window.runnerTablaV4.referencia) {
      const fidelidad = tabCompararConReferencia(resultado.matriz, window.runnerTablaV4.referencia);
      if (fidelidad) {
        tab4Log('=== F1: ' + fidelidad.f1.toFixed(3) + ' P: ' + fidelidad.precision.toFixed(3) + ' R: ' + fidelidad.recall.toFixed(3) + ' ===');
      }
    }

    // 8. Guardar CSV
    await tabGuardarCsv(resultado.matriz, img.nombre + '_v4');

  } catch(e) {
    tab4Log('ERROR: ' + e.message);
  } finally {
    window.runnerTablaV4.ejecutando = false;
  }
}

function tab4Parar() {
  window.runnerTablaV4.cancelar = true;
  tab4Log('Parando...');
}

window.tab4CargarImagenClick = tab4CargarImagenClick;
window.tab4ProcesarImagen = tab4ProcesarImagen;
window.tab4Iniciar = tab4Iniciar;
window.tab4Parar = tab4Parar;

function tab4EngancharBotones() {
  const btnCargar = document.getElementById('btnTab4CargarImg');
  const btnIniciar = document.getElementById('btnTab4Iniciar');
  const btnParar = document.getElementById('btnTab4Parar');
  const inputImg = document.getElementById('tab4InputImg');
  if (btnCargar) btnCargar.addEventListener('click', tab4CargarImagenClick);
  if (btnIniciar) btnIniciar.addEventListener('click', tab4Iniciar);
  if (btnParar) btnParar.addEventListener('click', tab4Parar);
  if (inputImg) inputImg.addEventListener('change', function(e) {
    if (e.target.files && e.target.files[0]) tab4ProcesarImagen(e.target.files[0]);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', tab4EngancharBotones);
} else {
  tab4EngancharBotones();
}

// Enganche del tab
(function() {
  function tab4EngancharTab() {
    const tabBtns = document.querySelectorAll('.tab');
    tabBtns.forEach(function(t) {
      if (t.dataset.tab === 'tabla_v4' && !t.dataset.bound) {
        t.dataset.bound = '1';
        t.addEventListener('click', function() {
          document.querySelectorAll('.tab').forEach(function(x) { x.classList.remove('active'); });
          document.querySelectorAll('.tab-content').forEach(function(x) { x.classList.remove('active'); });
          this.classList.add('active');
          const c = document.getElementById('tab-tabla-v4');
          if (c) c.classList.add('active');
        });
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tab4EngancharTab);
  } else {
    tab4EngancharTab();
  }
  setTimeout(tab4EngancharTab, 500);
})();

console.log('runner_tabla_v4.js cargado');
