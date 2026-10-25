// ==============================================
// ui/runner_tabla_v5.js
// Motor: gaps locales + consenso + sin overlap.
// ==============================================

window.runnerTablaV5 = {
  imagen: null, ejecutando: false, cancelar: false, matrizFinal: null
};

function tab5Log(msg) {
  const el = document.getElementById('tab5Log');
  if (!el) { console.log('[TAB5] ' + msg); return; }
  el.textContent = msg + '\n' + el.textContent;
  console.log('[TAB5] ' + msg);
}

function tab5CargarImagenClick() {
  const inp = document.getElementById('tab5InputImg');
  if (inp) { inp.value = ''; inp.click(); }
}

async function tab5ProcesarImagen(file) {
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
    window.runnerTablaV5.imagen = {
      nombre: file.name.replace('.jpg','').replace('.png',''),
      img: img, ancho: img.width, alto: img.height
    };
    tab5Log('Imagen: ' + window.runnerTablaV5.imagen.nombre + ' (' + img.width + 'x' + img.height + ')');
  } catch(e) { tab5Log('Error: ' + e.message); }
}

// OCR directo (sin tiling) para imágenes grandes
async function tab5OCRDirecto(img, elementos) {
  const TextRec = Capacitor.Plugins.TextRecognition;
  const canvas = document.createElement('canvas');
  canvas.width = img.ancho; canvas.height = img.alto;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img.img, 0, 0);
  const dataURL = canvas.toDataURL('image/jpeg', 0.95);

  try {
    const result = await TextRec.processImage({ path: dataURL });
    if (result && result.blocks) {
      for (const block of result.blocks) {
        if (!block.lines) continue;
        for (const line of block.lines) {
          if (!line.elements) continue;
          for (const el of line.elements) {
            if (!el.boundingBox) continue;
            elementos.push({
              text: el.text,
              absLeft: el.boundingBox.left,
              absRight: el.boundingBox.right,
              absTop: el.boundingBox.top,
              absBottom: el.boundingBox.bottom,
              cx: (el.boundingBox.left + el.boundingBox.right) / 2,
              cy: (el.boundingBox.top + el.boundingBox.bottom) / 2
            });
          }
        }
      }
    }
  } catch(e) { tab5Log('Error OCR directo: ' + e.message); }
}

// OCR con tiling SIN overlap (para imágenes pequeñas)
async function tab5TilingSinOverlap(img, elementos) {
  const TextRec = Capacitor.Plugins.TextRecognition;
  const tileSize = 500;
  const upscale = 4;
  const step = tileSize; // sin overlap

  const xs = [], ys = [];
  for (let x = 0; x < img.ancho; x += step) xs.push(x);
  for (let y = 0; y < img.alto; y += step) ys.push(y);

  for (const y of ys) {
    if (window.runnerTablaV5.cancelar) break;
    for (const x of xs) {
      if (window.runnerTablaV5.cancelar) break;
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
                elementos.push({
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
    }
  }
}

// Agrupar en filas por Y
function tab5AgruparFilas(elementos) {
  if (elementos.length === 0) return [];
  const sorted = elementos.slice().sort(function(a,b) { return a.cy - b.cy; });
  const filas = [];
  let grupo = [sorted[0]];
  let grupoY = sorted[0].cy;
  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].cy - grupoY) < 15) {
      grupo.push(sorted[i]);
    } else {
      grupo.sort(function(a,b) { return a.absLeft - b.absLeft; });
      filas.push(grupo);
      grupo = [sorted[i]];
      grupoY = sorted[i].cy;
    }
  }
  if (grupo.length > 0) {
    grupo.sort(function(a,b) { return a.absLeft - b.absLeft; });
    filas.push(grupo);
  }
  return filas;
}

// Detectar columnas con gaps locales + consenso
function tab5DetectarColumnas(filas, ancho) {
  const gaps = [];
  for (const fila of filas) {
    if (fila.length < 2) continue;
    for (let i = 0; i < fila.length - 1; i++) {
      const gap = fila[i+1].absLeft - fila[i].absRight;
      if (gap >= 15) {
        gaps.push((fila[i].absRight + fila[i+1].absLeft) / 2);
      }
    }
  }

  if (gaps.length === 0) return { lineasV: [0, ancho], info: 'sin gaps' };

  const ordenados = gaps.slice().sort(function(a,b) { return a - b; });
  const clusters = [];
  let grupo = [ordenados[0]];
  for (let i = 1; i < ordenados.length; i++) {
    if (ordenados[i] - grupo[grupo.length-1] < 25) {
      grupo.push(ordenados[i]);
    } else {
      const suma = grupo.reduce(function(s,v) { return s + v; }, 0);
      clusters.push({ pos: suma / grupo.length, count: grupo.length });
      grupo = [ordenados[i]];
    }
  }
  const suma = grupo.reduce(function(s,v) { return s + v; }, 0);
  clusters.push({ pos: suma / grupo.length, count: grupo.length });

  const filasConDatos = filas.filter(function(f) { return f.length >= 2; }).length;
  const umbralConsenso = Math.max(2, filasConDatos * 0.25);

  const cortes = clusters
    .filter(function(c) { return c.count >= umbralConsenso; })
    .map(function(c) { return c.pos; })
    .sort(function(a,b) { return a - b; });

  const lineasV = [0];
  for (const c of cortes) {
    if (c > 25 && c < ancho - 25) lineasV.push(c - 8); // margen 8px
  }
  lineasV.push(ancho);

  return { lineasV: lineasV, info: cortes.length + ' cortes de ' + filasConDatos + ' filas' };
}

async function tab5Iniciar() {
  if (window.runnerTablaV5.ejecutando) { tab5Log('Ya ejecutando'); return; }
  if (!window.runnerTablaV5.imagen) { tab5Log('Carga imagen'); return; }

  window.runnerTablaV5.ejecutando = true;
  window.runnerTablaV5.cancelar = false;

  try {
    const img = window.runnerTablaV5.imagen;
    tab5Log('=== Tabla v5 (gaps locales) ===');
    tab5Log('Imagen: ' + img.nombre + ' (' + img.ancho + 'x' + img.alto + ')');

    const elementos = [];
    const esChica = (img.ancho < 1024 && img.alto < 1024);
    if (esChica) {
      tab5Log('Imagen chica → tiling sin overlap');
      await tab5TilingSinOverlap(img, elementos);
    } else {
      tab5Log('Imagen grande → OCR directo');
      await tab5OCRDirecto(img, elementos);
    }
    tab5Log('Elementos: ' + elementos.length);
    if (elementos.length === 0) { tab5Log('Sin elementos'); return; }

    tab5Log('Agrupando en filas...');
    const filas = tab5AgruparFilas(elementos);
    tab5Log('Filas: ' + filas.length);

    tab5Log('Detectando columnas...');
    const det = tab5DetectarColumnas(filas, img.ancho);
    tab5Log('Columnas: ' + (det.lineasV.length - 1) + ' (' + det.info + ')');

    const grilla = { lineasH: [], lineasV: det.lineasV, numFilas: filas.length, numCols: det.lineasV.length - 1 };
    const celdas = {};
    for (let i = 0; i < filas.length; i++) {
      for (const el of filas[i]) {
        for (let j = 0; j < det.lineasV.length - 1; j++) {
          if (el.cx >= det.lineasV[j] && el.cx < det.lineasV[j + 1]) {
            const key = i + '_' + j;
            if (!celdas[key]) celdas[key] = [];
            celdas[key].push({ text: el.text, left: el.absLeft, top: el.absTop });
            break;
          }
        }
      }
    }

    const resultado = tabArmarMatrizYLimpiar(celdas, grilla);
    tab5Log('Matriz: ' + resultado.filasFinales + ' x ' + resultado.columnasFinales);
    tab5Log('[tipos] ' + JSON.stringify(resultado.tiposColumnas.map(function(t){ return t.tipo; })));
    tab5Log('[corrección] ' + resultado.celdasCorregidas + '/' + resultado.celdasTotales);

    window.runnerTabla.matrizFinal = resultado.matriz;
    window.runnerTablaV5.matrizFinal = resultado.matriz;

    await tabGuardarCsv(resultado.matriz, img.nombre + '_v5');
    tab5Log('=== Terminado ===');
  } catch(e) {
    tab5Log('ERROR: ' + e.message);
  } finally {
    window.runnerTablaV5.ejecutando = false;
  }
}

function tab5Parar() { window.runnerTablaV5.cancelar = true; tab5Log('Parando...'); }

window.tab5CargarImagenClick = tab5CargarImagenClick;
window.tab5ProcesarImagen = tab5ProcesarImagen;
window.tab5Iniciar = tab5Iniciar;
window.tab5Parar = tab5Parar;

function tab5EngancharBotones() {
  const btnCargar = document.getElementById('btnTab5CargarImg');
  const btnIniciar = document.getElementById('btnTab5Iniciar');
  const btnParar = document.getElementById('btnTab5Parar');
  const inputImg = document.getElementById('tab5InputImg');
  if (btnCargar) btnCargar.addEventListener('click', tab5CargarImagenClick);
  if (btnIniciar) btnIniciar.addEventListener('click', tab5Iniciar);
  if (btnParar) btnParar.addEventListener('click', tab5Parar);
  if (inputImg) inputImg.addEventListener('change', function(e) {
    if (e.target.files && e.target.files[0]) tab5ProcesarImagen(e.target.files[0]);
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tab5EngancharBotones);
else tab5EngancharBotones();

(function() {
  function tab5EngancharTab() {
    document.querySelectorAll('.tab').forEach(function(t) {
      if (t.dataset.tab === 'tabla_v5' && !t.dataset.bound) {
        t.dataset.bound = '1';
        t.addEventListener('click', function() {
          document.querySelectorAll('.tab').forEach(function(x) { x.classList.remove('active'); });
          document.querySelectorAll('.tab-content').forEach(function(x) { x.classList.remove('active'); });
          this.classList.add('active');
          const c = document.getElementById('tab-tabla-v5');
          if (c) c.classList.add('active');
        });
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tab5EngancharTab);
  else tab5EngancharTab();
  setTimeout(tab5EngancharTab, 500);
})();
console.log('runner_tabla_v5.js cargado');
