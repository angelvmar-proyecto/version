// ============================================================
// MAR Caribe — Detección real de líneas (Bloque 1)
// ============================================================

const lienzo = document.getElementById('lienzo');
const ctx = lienzo.getContext('2d', { willReadFrequently: true });
const logs = document.getElementById('logs');
const areaImagen = document.getElementById('areaImagen');

let imagenOriginal = null;
let escala = 1;
let lineasH = [];
let lineasV = [];
let motorOCR = null;

function log(texto) {
  if (!logs) return;
  logs.innerHTML += `<div>${new Date().toLocaleTimeString()} — ${texto}</div>`;
  logs.scrollTop = logs.scrollHeight;
}

function dibujarTodo() {
  if (!imagenOriginal) return;
  lienzo.width = imagenOriginal.width * escala;
  lienzo.height = imagenOriginal.height * escala;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, lienzo.width, lienzo.height);
  ctx.drawImage(imagenOriginal, 0, 0, lienzo.width, lienzo.height);

  ctx.strokeStyle = '#ff2a2a';
  ctx.lineWidth = Math.max(1, 1.5 / escala);
  lineasH.forEach(y => {
    ctx.beginPath();
    ctx.moveTo(0, y * escala);
    ctx.lineTo(lienzo.width, y * escala);
    ctx.stroke();
  });

  ctx.strokeStyle = '#00ffff';
  lineasV.forEach(x => {
    ctx.beginPath();
    ctx.moveTo(x * escala, 0);
    ctx.lineTo(x * escala, lienzo.height);
    ctx.stroke();
  });
}

document.getElementById('btnCargar').addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = e => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    log(`Cargando: ${archivo.name} (${Math.round(archivo.size / 1024)} KB)`);
    const lector = new FileReader();
    lector.onload = evt => {
      const img = new Image();
      img.onload = () => {
        imagenOriginal = img;
        escala = Math.min(areaImagen.clientWidth / img.width, 1);
        lineasH = []; lineasV = [];
        dibujarTodo();
        log(`✅ Imagen: ${img.width}×${img.height} | Escala: ${Math.round(escala * 100)}%`);
      };
      img.src = evt.target.result;
    };
    lector.readAsDataURL(archivo);
  };
  input.click();
});

document.getElementById('btnZoomMas').addEventListener('click', () => { escala *= 1.3; dibujarTodo(); });
document.getElementById('btnZoomMenos').addEventListener('click', () => { escala /= 1.3; dibujarTodo(); });

// ---------------- PIPELINE ----------------
function aGrises(imageData) {
  const d = imageData.data;
  const grises = new Uint8ClampedArray(imageData.width * imageData.height);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    grises[j] = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0;
  }
  return grises;
}

function mediana3x3(grises, w, h) {
  const out = new Uint8ClampedArray(grises.length);
  const buf = new Array(9);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
        out[idx] = grises[idx];
        continue;
      }
      let k = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          buf[k++] = grises[(y + dy) * w + (x + dx)];
        }
      }
      buf.sort((a, b) => a - b);
      out[idx] = buf[4];
    }
  }
  return out;
}

function gradientes(grises, w, h) {
  const gH = new Float32Array(w * h);
  const gV = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      const a = grises[p - w - 1], b = grises[p - w], c = grises[p - w + 1];
      const d = grises[p - 1],                          f = grises[p + 1];
      const g = grises[p + w - 1], hh = grises[p + w], i = grises[p + w + 1];
      const sy = (-a - 2 * d - g) + (c + 2 * f + i);
      const sx = (-a - 2 * b - c) + (g + 2 * hh + i);
      gH[p] = Math.abs(sy);
      gV[p] = Math.abs(sx);
    }
  }
  return { gH, gV };
}

function perfiles(gH, gV, w, h) {
  const perfilH = new Float32Array(h);
  const perfilV = new Float32Array(w);
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = 0; x < w; x++) s += gH[y * w + x];
    perfilH[y] = s / w;
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = 0; y < h; y++) s += gV[y * w + x];
    perfilV[x] = s / h;
  }
  return { perfilH, perfilV };
}

function medianaArr(arr) {
  const copia = Array.from(arr).sort((a, b) => a - b);
  return copia[(copia.length / 2) | 0];
}

function buscarPicos(perfil, umbral, distMin) {
  const picos = [];
  const n = perfil.length;
  for (let i = 1; i < n - 1; i++) {
    const v = perfil[i];
    if (v < umbral) continue;
    if (v >= perfil[i - 1] && v >= perfil[i + 1]) {
      if (picos.length === 0 || i - picos[picos.length - 1].pos >= distMin) {
        picos.push({ pos: i, val: v });
      } else if (v > picos[picos.length - 1].val) {
        picos[picos.length - 1] = { pos: i, val: v };
      }
    }
  }
  return picos;
}

function ajustarLineas(picos, perfil, rango) {
  return picos.map(p => {
    let mejor = p.pos;
    let mejorVal = perfil[p.pos];
    const ini = Math.max(0, p.pos - rango);
    const fin = Math.min(perfil.length - 1, p.pos + rango);
    for (let i = ini; i <= fin; i++) {
      if (perfil[i] > mejorVal) { mejorVal = perfil[i]; mejor = i; }
    }
    return mejor;
  });
}

async function detectarLineas() {
  if (!imagenOriginal) { log('⚠️ Carga una imagen primero'); return; }
  const t0 = performance.now();
  log('🔍 Paso 1/6: Extrayendo píxeles...');

  const cv = document.createElement('canvas');
  cv.width = imagenOriginal.width;
  cv.height = imagenOriginal.height;
  const c2 = cv.getContext('2d', { willReadFrequently: true });
  c2.drawImage(imagenOriginal, 0, 0);

  const imgData = c2.getImageData(0, 0, cv.width, cv.height);
  const w = cv.width, h = cv.height;

  log('🔍 Paso 2/6: Convirtiendo a grises...');
  let grises = aGrises(imgData);

  log('🔍 Paso 3/6: Aplicando mediana 3×3...');
  grises = mediana3x3(grises, w, h);

  log('🔍 Paso 4/6: Calculando gradientes Sobel...');
  const { gH, gV } = gradientes(grises, w, h);

  log('🔍 Paso 5/6: Generando perfiles...');
  const { perfilH, perfilV } = perfiles(gH, gV, w, h);

  const medH = medianaArr(perfilH);
  const medV = medianaArr(perfilV);
  const umbralH = Math.max(8, medH * 2.5);
  const umbralV = Math.max(5, medV * 1.2);
  log(`📊 Umbral H: ${umbralH.toFixed(1)} | Umbral V: ${umbralV.toFixed(1)}`);

  log('🔍 Paso 6/6: Buscando picos...');
  const picosH = buscarPicos(perfilH, umbralH, 8);
  const picosV = buscarPicos(perfilV, umbralV, 15);
  const posH = ajustarLineas(picosH, perfilH, 5);
  const posV = ajustarLineas(picosV, perfilV, 5);

  lineasH = posH;
  lineasV = posV;

  const t1 = performance.now();
  log(`✅ Detectadas: ${lineasH.length} H / ${lineasV.length} V en ${Math.round(t1 - t0)} ms`);
  dibujarTodo();
}

document.getElementById('btnDetectar').addEventListener('click', detectarLineas);

document.getElementById('btnLeer').addEventListener('click', async () => {
  if (!imagenOriginal) { log('⚠️ Carga una imagen primero'); return; }
  log('📖 Iniciando Tesseract...');
  if (!motorOCR) {
    motorOCR = await Tesseract.createWorker('spa+eng');
    log('✅ Tesseract listo');
  }
  log('🔄 Procesando...');
  const { data: { text } } = await motorOCR.recognize(lienzo);
  log(`📝 Texto extraído:\n${text}`);
});

document.getElementById('btnExportar').addEventListener('click', () => {
  log('📋 Función en desarrollo');
});

log('✅ Aplicación MAR Caribe inicializada (Bloque 1: detección real)');
