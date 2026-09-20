// ==============================================
// MAR Caribe v12.0 - OCR con Tesseract v4 (minimal)
// ==============================================

let tesseractWorker = null;
let tesseractListo = false;

// ============================================
// INICIALIZAR TESSERACT (versión minimal)
// ============================================
async function inicializarTesseract() {
  if (tesseractListo && tesseractWorker) return tesseractWorker;

  log('🔤 Inicializando Tesseract v4...', 'etapa');

  if (typeof Tesseract === 'undefined') {
    throw new Error('Tesseract no está cargado');
  }
  log('   ✅ Tesseract disponible', 'exito');

  log('   🔧 Creando worker (sin parámetros)...', 'info');

  const worker = await Tesseract.createWorker(
    CONFIG.TESS_IDIOMAS,
    CONFIG.TESS_OEM,
    {
      workerPath: CONFIG.TESS_RUTA_WORKER,
      corePath: CONFIG.TESS_RUTA_CORE,
      langPath: CONFIG.TESS_RUTA_DATOS,
      logger: function(m) {
        if (m.status && (m.status.indexOf('core') !== -1 || m.status.indexOf('language') !== -1)) {
          const pct = m.progress ? Math.round(m.progress * 100) : 0;
          log('      ⏳ ' + m.status + ' ' + pct + '%', 'info');
        }
      }
    }
  );

  tesseractWorker = worker;
  tesseractListo = true;
  log('   ✅ Worker creado y guardado', 'exito');

  // Test de lectura mínimo con canvas blanco
  log('   🧪 Probando lectura con canvas vacío...', 'info');
  try {
    const canvasTest = document.createElement('canvas');
    canvasTest.width = 100;
    canvasTest.height = 50;
    const ctxT = canvasTest.getContext('2d');
    ctxT.fillStyle = 'white';
    ctxT.fillRect(0, 0, 100, 50);
    ctxT.fillStyle = 'black';
    ctxT.font = 'bold 30px sans-serif';
    ctxT.fillText('TEST', 10, 35);

    const testResult = await worker.recognize(canvasTest.toDataURL('image/png'));
    const txt = (testResult.data && testResult.data.text) ? testResult.data.text.trim() : '';
    log('   ✅ Test de lectura OK (texto detectado: "' + txt + '")', 'exito');
  } catch (e) {
    log('   ⚠️ Test de lectura falló: ' + (e.message || e), 'alerta');
  }

  log('✅ Tesseract listo', 'exito');
  return worker;
}

// ============================================
// MEDIR DENSIDAD DE CELDA
// ============================================
function medirDensidadCelda(canvas, x1, y1, x2, y2) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const ancho = x2 - x1;
  const alto = y2 - y1;
  if (ancho <= 0 || alto <= 0) return 0;
  const imageData = ctx.getImageData(x1, y1, ancho, alto);
  const datos = imageData.data;
  let conContenido = 0, total = 0;
  for (let i = 0; i < datos.length; i += 4) {
    const brillo = (datos[i] + datos[i + 1] + datos[i + 2]) / 3;
    if (brillo < 180) conContenido++;
    total++;
  }
  return conContenido / total;
}

function extraerCeldaCanvas(canvasFuente, x1, y1, x2, y2) {
  const ancho = x2 - x1;
  const alto = y2 - y1;
  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(canvasFuente, x1, y1, ancho, alto, 0, 0, ancho, alto);
  return canvas;
}

// ============================================
// PREPROCESAMIENTO POR CELDA
// ============================================
function bsLocalCelda(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const datos = imageData.data;
  const muestras = [];
  for (let i = 0; i < datos.length; i += 16) {
    muestras.push({ r: datos[i], g: datos[i + 1], b: datos[i + 2], brillo: (datos[i] + datos[i + 1] + datos[i + 2]) / 3 });
  }
  muestras.sort((a, b) => b.brillo - a.brillo);
  const top25 = muestras.slice(0, Math.max(1, Math.floor(muestras.length * 0.25)));
  const fondoR = top25.reduce((s, m) => s + m.r, 0) / top25.length;
  const fondoG = top25.reduce((s, m) => s + m.g, 0) / top25.length;
  const fondoB = top25.reduce((s, m) => s + m.b, 0) / top25.length;
  for (let i = 0; i < datos.length; i += 4) {
    datos[i] = clamp((datos[i] - fondoR) * 4 + 255, 0, 255);
    datos[i + 1] = clamp((datos[i + 1] - fondoG) * 4 + 255, 0, 255);
    datos[i + 2] = clamp((datos[i + 2] - fondoB) * 4 + 255, 0, 255);
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function escalarInteligente(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const datos = imageData.data;
  const w = canvas.width, h = canvas.height;
  const perfilH = new Array(h).fill(0);
  for (let y = 0; y < h; y++) {
    let cuenta = 0;
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const brillo = (datos[idx] + datos[idx + 1] + datos[idx + 2]) / 3;
      if (brillo < 128) cuenta++;
    }
    perfilH[y] = cuenta;
  }
  let primera = -1, ultima = -1;
  for (let y = 0; y < h; y++) {
    if (perfilH[y] > w * 0.02) {
      if (primera === -1) primera = y;
      ultima = y;
    }
  }
  const alturaTexto = ultima - primera + 1;
  let factor = 1;
  if (alturaTexto > 0) {
    if (alturaTexto < CONFIG.OCR_ESCALA_UMBRAL_BAJO) factor = CONFIG.OCR_ESCALA_3X;
    else if (alturaTexto < CONFIG.OCR_ESCALA_UMBRAL_MEDIO) factor = CONFIG.OCR_ESCALA_2X;
  }
  if (factor === 1) return canvas;
  const nuevoCanvas = document.createElement('canvas');
  nuevoCanvas.width = w * factor;
  nuevoCanvas.height = h * factor;
  const nuevoCtx = nuevoCanvas.getContext('2d');
  nuevoCtx.imageSmoothingEnabled = true;
  nuevoCtx.imageSmoothingQuality = 'high';
  nuevoCtx.drawImage(canvas, 0, 0, w * factor, h * factor);
  return nuevoCanvas;
}

function binarizarAdaptativo(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const datos = imageData.data;
  const w = canvas.width, h = canvas.height;
  const bloque = 20;
  for (let by = 0; by < h; by += bloque) {
    for (let bx = 0; bx < w; bx += bloque) {
      const x1 = Math.min(bx + bloque, w);
      const y1 = Math.min(by + bloque, h);
      let sumaLocal = 0, count = 0;
      for (let y = by; y < y1; y++)
        for (let x = bx; x < x1; x++) {
          const idx = (y * w + x) * 4;
          sumaLocal += (datos[idx] + datos[idx + 1] + datos[idx + 2]) / 3;
          count++;
        }
      const umbralLocal = (sumaLocal / count) * 0.85;
      for (let y = by; y < y1; y++)
        for (let x = bx; x < x1; x++) {
          const idx = (y * w + x) * 4;
          const brillo = (datos[idx] + datos[idx + 1] + datos[idx + 2]) / 3;
          const valor = brillo < umbralLocal ? 0 : 255;
          datos[idx] = valor; datos[idx + 1] = valor; datos[idx + 2] = valor;
        }
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function contrastarAdaptativo(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const datos = imageData.data;
  let min = 255, max = 0;
  for (let i = 0; i < datos.length; i += 4) {
    const b = (datos[i] + datos[i + 1] + datos[i + 2]) / 3;
    if (b < min) min = b;
    if (b > max) max = b;
  }
  if (max - min < 10) return canvas;
  const factor = 255 / (max - min);
  for (let i = 0; i < datos.length; i += 4) {
    datos[i] = clamp((datos[i] - min) * factor, 0, 255);
    datos[i + 1] = clamp((datos[i + 1] - min) * factor, 0, 255);
    datos[i + 2] = clamp((datos[i + 2] - min) * factor, 0, 255);
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function añadirPadding(canvas, margen) {
  margen = margen || CONFIG.OCR_MARGEN_PADDING;
  const nuevoCanvas = document.createElement('canvas');
  nuevoCanvas.width = canvas.width + margen * 2;
  nuevoCanvas.height = canvas.height + margen * 2;
  const ctx = nuevoCanvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, nuevoCanvas.width, nuevoCanvas.height);
  ctx.drawImage(canvas, margen, margen);
  return nuevoCanvas;
}

function preprocesarCelda(canvasOriginal) {
  let canvas = canvasOriginal;
  canvas = bsLocalCelda(canvas);
  canvas = escalarInteligente(canvas);
  canvas = contrastarAdaptativo(canvas);
  canvas = binarizarAdaptativo(canvas);
  canvas = añadirPadding(canvas);
  return canvas;
}

// ============================================
// LEER CELDA (mínimo)
// ============================================
async function leerCelda(canvasProcesado) {
  if (!tesseractWorker) {
    await inicializarTesseract();
  }
  if (!tesseractWorker) {
    return { texto: '', confianza: 0 };
  }

  try {
    const dataURL = canvasProcesado.toDataURL('image/png');
    const resultado = await tesseractWorker.recognize(dataURL);
    const data = resultado.data || resultado;
    return {
      texto: (data.text || '').trim(),
      confianza: data.confidence || 0
    };
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    log('      ⚠️ recognize falló: ' + msg, 'alerta');
    return { texto: '', confianza: 0 };
  }
}

// ============================================
// OCR COMPLETO
// ============================================
async function ejecutarOCRCompleto(canvasFuente, celdas, modo) {
  log('═══════════════════════════════════', 'etapa');
  log('📄 OCR MODO: ' + modo.toUpperCase(), 'etapa');
  log('═══════════════════════════════════', 'etapa');

  const total = celdas.length;
  if (total === 0) { log('⚠️ Sin celdas', 'alerta'); return; }

  const filas = Math.max(...celdas.map(c => c.fila)) + 1;
  const columnas = Math.max(...celdas.map(c => c.col)) + 1;
  log('📊 Tabla: ' + filas + '×' + columnas + ' (' + total + ' celdas)', 'info');

  const matrizTexto = Array(filas).fill(null).map(() => Array(columnas).fill(''));
  const matrizConfianza = Array(filas).fill(null).map(() => Array(columnas).fill(0));

  // Inicializar UNA SOLA VEZ
  log('🔤 Iniciando Tesseract...', 'etapa');
  try {
    await inicializarTesseract();
  } catch (e) {
    log('❌ No se pudo inicializar: ' + (e.message || e), 'error');
    return;
  }

  let procesadas = 0;
  const inicio = Date.now();

  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < columnas; c++) {
      procesadas++;
      const celda = celdas.find(x => x.fila === f && x.col === c);
      if (!celda) continue;

      if (procesadas % 20 === 0 || procesadas === total || procesadas === 1) {
        const pct = Math.round((procesadas / total) * 100);
        actualizarProgreso(pct);
        log('   ⏳ ' + procesadas + '/' + total + ' (' + pct + '%)', 'info');
      }

      const densidad = medirDensidadCelda(canvasFuente, celda.x1, celda.y1, celda.x2, celda.y2);
      if (densidad < CONFIG.OCR_DENSIDAD_MIN) {
        matrizTexto[f][c] = '';
        matrizConfianza[f][c] = 100;
        continue;
      }

      let canvasCelda = extraerCeldaCanvas(canvasFuente, celda.x1, celda.y1, celda.x2, celda.y2);

      let canvasProcesado;
      if (modo === 'rapido') {
        canvasProcesado = añadirPadding(binarizarAdaptativo(canvasCelda));
      } else if (modo === 'medio') {
        canvasProcesado = bsLocalCelda(canvasCelda);
        canvasProcesado = escalarInteligente(canvasProcesado);
        canvasProcesado = binarizarAdaptativo(canvasProcesado);
        canvasProcesado = añadirPadding(canvasProcesado);
      } else {
        canvasProcesado = preprocesarCelda(canvasCelda);
      }

      const resultado = await leerCelda(canvasProcesado);
      matrizTexto[f][c] = resultado.texto;
      matrizConfianza[f][c] = resultado.confianza;
    }
  }

  const duracion = ((Date.now() - inicio) / 1000).toFixed(1);
  log('✅ OCR COMPLETO en ' + duracion + 's', 'exito');

  window.estadoPasos.matrizTexto = matrizTexto;
  window.estadoPasos.matrizConfianza = matrizConfianza;
  window.estadoPasos.matrizColores = extraerColoresCelda(canvasFuente, celdas);

  mostrarTabla(matrizTexto, window.estadoPasos.matrizColores, matrizConfianza);

  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector('[data-tab="tabla"]').classList.add('active');
  document.getElementById('tab-tabla').classList.add('active');

  marcarPasoCompletado(9);
  log('✅ Resultados en 📊 Tabla', 'exito');
}

function extraerColoresCelda(canvasFuente, celdas) {
  const ctx = canvasFuente.getContext('2d', { willReadFrequently: true });
  const colores = [];
  for (const celda of celdas) {
    const ancho = celda.x2 - celda.x1;
    const alto = celda.y2 - celda.y1;
    if (ancho <= 0 || alto <= 0) { colores.push({ r: 255, g: 255, b: 255 }); continue; }
    const imageData = ctx.getImageData(celda.x1, celda.y1, ancho, alto);
    const datos = imageData.data;
    const muestras = [];
    for (let i = 0; i < datos.length; i += 16)
      muestras.push({ r: datos[i], g: datos[i + 1], b: datos[i + 2], brillo: (datos[i] + datos[i + 1] + datos[i + 2]) / 3 });
    muestras.sort((a, b) => b.brillo - a.brillo);
    const top = muestras.slice(0, Math.max(1, Math.floor(muestras.length * 0.25)));
    colores.push({
      r: Math.round(top.reduce((s, m) => s + m.r, 0) / top.length),
      g: Math.round(top.reduce((s, m) => s + m.g, 0) / top.length),
      b: Math.round(top.reduce((s, m) => s + m.b, 0) / top.length)
    });
  }
  return colores;
}

function mostrarTabla(matrizTexto, matrizColores, matrizConfianza) {
  const wrapper = document.getElementById('tablaWrapper');
  if (!wrapper) return;
  const filas = matrizTexto.length;
  const columnas = matrizTexto[0].length;
  let html = '<table class="tabla-resultado"><tbody>';
  for (let f = 0; f < filas; f++) {
    html += '<tr>';
    for (let c = 0; c < columnas; c++) {
      const idx = f * columnas + c;
      const color = matrizColores[idx] || { r: 255, g: 255, b: 255 };
      const conf = matrizConfianza ? matrizConfianza[f][c] : 100;
      const tag = (f === 0) ? 'th' : 'td';
      const colorHex = 'rgb(' + color.r + ',' + color.g + ',' + color.b + ')';
      const estilo = f === 0 ? '' : 'background:' + colorHex + ';';
      const estiloConf = conf < 75 && f > 0 ? 'box-shadow:inset 0 0 0 2px ' + (conf < 50 ? '#ef4444' : '#f59e0b') + ';' : '';
      const texto = (matrizTexto[f][c] || '').replace(/</g, '&lt;');
      html += '<' + tag + ' style="' + estilo + estiloConf + '" contenteditable="' + (f > 0) + '">' + texto + '</' + tag + '>';
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  wrapper.innerHTML = html;

  const info = document.getElementById('infoExtra');
  if (info) info.textContent = '📊 ' + filas + ' filas · ' + columnas + ' columnas · ' + (filas * columnas) + ' celdas';
  log('📊 Tabla mostrada: ' + filas + '×' + columnas, 'exito');
}

console.log('✅ OCR cargado (Tesseract v4 minimal)');
