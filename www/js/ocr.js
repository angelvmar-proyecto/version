// ==============================================
// MAR Caribe v12.0 - OCR con Tesseract v4
// ==============================================

let tesseractWorker = null;

async function inicializarTesseract() {
  if (tesseractWorker) return tesseractWorker;

  log('🔤 Inicializando Tesseract v4...', 'etapa');

  if (typeof Tesseract === 'undefined') {
    throw new Error('Tesseract no está cargado');
  }
  log('   ✅ Tesseract disponible', 'exito');

  log('   🔧 Creando worker...', 'info');
  log('      Worker: ' + CONFIG.TESS_RUTA_WORKER, 'info');
  log('      Core:   ' + CONFIG.TESS_RUTA_CORE, 'info');
  log('      Datos:  ' + CONFIG.TESS_RUTA_DATOS, 'info');

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
  log('   ✅ Worker creado y guardado', 'exito');
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

function estimarBorroso(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const datos = imageData.data;
  const w = canvas.width, h = canvas.height;
  let sumaAnchos = 0, count = 0;
  for (let y = 0; y < h; y += 5) {
    let enTransicion = false, anchoTransicion = 0;
    for (let x = 1; x < w; x++) {
      const idx = (y * w + x) * 4;
      const idxAnt = (y * w + x - 1) * 4;
      const brillo = (datos[idx] + datos[idx + 1] + datos[idx + 2]) / 3;
      const brilloAnt = (datos[idxAnt] + datos[idxAnt + 1] + datos[idxAnt + 2]) / 3;
      const dif = Math.abs(brillo - brilloAnt);
      if (dif > 20 && dif < 100) { enTransicion = true; anchoTransicion++; }
      else if (dif >= 100) { enTransicion = false; anchoTransicion = 0; }
      else if (enTransicion && dif < 20) {
        if (anchoTransicion > 0) { sumaAnchos += anchoTransicion; count++; }
        enTransicion = false; anchoTransicion = 0;
      }
    }
  }
  return count > 0 ? sumaAnchos / count : 0;
}

function deconvolucionarPSF(canvas, iteraciones) {
  iteraciones = iteraciones || 3;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const w = canvas.width, h = canvas.height;
  let est = new Float32Array(w * h);
  const orig = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    const brillo = (imageData.data[idx] + imageData.data[idx + 1] + imageData.data[idx + 2]) / 3;
    est[i] = brillo / 255;
    orig[i] = est[i];
  }
  const kernel = [0.0625, 0.125, 0.0625, 0.125, 0.25, 0.125, 0.0625, 0.125, 0.0625];
  for (let iter = 0; iter < iteraciones; iter++) {
    const borroso = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let suma = 0;
        for (let ky = -1; ky <= 1; ky++)
          for (let kx = -1; kx <= 1; kx++)
            suma += est[(y + ky) * w + (x + kx)] * kernel[(ky + 1) * 3 + (kx + 1)];
        borroso[y * w + x] = suma;
      }
    }
    const ratio = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) ratio[i] = orig[i] / (borroso[i] + 0.001);
    const ratioConv = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let suma = 0;
        for (let ky = -1; ky <= 1; ky++)
          for (let kx = -1; kx <= 1; kx++)
            suma += ratio[(y + ky) * w + (x + kx)] * kernel[(ky + 1) * 3 + (kx + 1)];
        ratioConv[y * w + x] = suma;
      }
    }
    for (let i = 0; i < w * h; i++) {
      est[i] = clamp(est[i] * ratioConv[i], 0, 1);
    }
  }
  for (let i = 0; i < w * h; i++) {
    const v = Math.round(est[i] * 255);
    imageData.data[i * 4] = v;
    imageData.data[i * 4 + 1] = v;
    imageData.data[i * 4 + 2] = v;
    imageData.data[i * 4 + 3] = 255;
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

function detectarTipoColumna(matrizTexto, colIndex) {
  const muestras = [];
  for (let f = 1; f < matrizTexto.length; f++) {
    const txt = matrizTexto[f][colIndex] || '';
    if (txt.trim()) muestras.push(txt.trim());
  }
  if (muestras.length === 0) return 'texto';
  let numericos = 0, fechas = 0, monedas = 0, horas = 0;
  for (const m of muestras) {
    if (/^\d+(\.\d+)?$/.test(m)) numericos++;
    else if (/^\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?$/.test(m)) fechas++;
    else if (/^[\$\€\£]?\s?\d+([\.,]\d+)?$/.test(m)) monedas++;
    else if (/^\d{1,2}:\d{2}/.test(m)) horas++;
  }
  const total = muestras.length;
  if (numericos / total > 0.7) return 'numero';
  if (fechas / total > 0.7) return 'fecha';
  if (monedas / total > 0.7) return 'moneda';
  if (horas / total > 0.7) return 'hora';
  return 'texto';
}

async function aplicarWhitelist(worker, tipo) {
  if (!worker) {
    log('      ⚠️ aplicarWhitelist: worker es null', 'alerta');
    return;
  }
  const whitelists = {
    'numero': '0123456789.',
    'fecha': '0123456789/-',
    'moneda': '0123456789.,$€£',
    'hora': '0123456789:',
    'texto': ''
  };
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: '7',
      tessedit_char_whitelist: whitelists[tipo] || ''
    });
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    log('      ⚠️ setParameters falló: ' + msg, 'alerta');
  }
}

function limpiarTexto(texto, tipo) {
  let t = texto.trim().replace(/[|_~`^]/g, '').replace(/\s+/g, ' ');
  switch (tipo) {
    case 'numero': t = t.replace(/[^\d.]/g, ''); break;
    case 'fecha': t = t.replace(/[^\d\/\-]/g, ''); break;
    case 'moneda': t = t.replace(/[^\d.,\$€£]/g, ''); break;
    case 'hora': t = t.replace(/[^\d:]/g, ''); break;
    case 'texto': t = t.replace(/[^\w\sáéíóúÁÉÍÓÚñÑüÜ\-\.,]/g, ''); break;
  }
  return t.trim();
}

function corregirConDiccionario(texto) {
  if (!texto) return texto;
  return texto.split(/\s+/).map(p => {
    const mayus = p.toUpperCase();
    if (CONFIG.DICCIONARIO.indexOf(mayus) !== -1) return mayus;
    for (const palabra of CONFIG.DICCIONARIO) {
      if (levenshtein(mayus, palabra) <= 1 && mayus.length > 3) return palabra;
    }
    return p;
  }).join(' ');
}

function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matriz = [];
  for (let i = 0; i <= b.length; i++) matriz[i] = [i];
  for (let j = 0; j <= a.length; j++) matriz[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) matriz[i][j] = matriz[i - 1][j - 1];
      else matriz[i][j] = Math.min(matriz[i - 1][j - 1] + 1, matriz[i][j - 1] + 1, matriz[i - 1][j] + 1);
    }
  }
  return matriz[b.length][a.length];
}

function preprocesarCelda(canvasOriginal) {
  let canvas = canvasOriginal;
  canvas = bsLocalCelda(canvas);
  if (estimarBorroso(canvas) > 1.5) canvas = deconvolucionarPSF(canvas, 3);
  canvas = escalarInteligente(canvas);
  canvas = contrastarAdaptativo(canvas);
  canvas = binarizarAdaptativo(canvas);
  canvas = añadirPadding(canvas);
  return canvas;
}

async function leerCelda(canvasProcesado, tipo) {
  let worker = tesseractWorker;
  if (!worker) {
    worker = await inicializarTesseract();
  }
  if (!worker) {
    log('      ❌ worker null en leerCelda', 'error');
    return { texto: '', confianza: 0 };
  }

  await aplicarWhitelist(worker, tipo);
  const dataURL = canvasProcesado.toDataURL('image/png');

  try {
    const resultado = await worker.recognize(dataURL);
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

  log('🔤 Iniciando Tesseract...', 'etapa');
  try { await inicializarTesseract(); }
  catch (e) { log('❌ No se pudo inicializar: ' + e.message, 'error'); return; }

  let procesadas = 0;
  const inicio = Date.now();

  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < columnas; c++) {
      procesadas++;
      const celda = celdas.find(x => x.fila === f && x.col === c);
      if (!celda) continue;

      if (procesadas % 10 === 0 || procesadas === total || procesadas === 1) {
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

      let tipo = 'texto';
      if (f > 0 && c < columnas) {
        const colMuestra = [];
        for (let ff = 1; ff <= Math.min(f, 3); ff++)
          if (matrizTexto[ff][c]) colMuestra.push(matrizTexto[ff][c]);
        if (colMuestra.length >= 2) tipo = detectarTipoColumna(matrizTexto, c);
      }

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

      const resultado = await leerCelda(canvasProcesado, tipo);
      let textoLimpio = limpiarTexto(resultado.texto, tipo);
      if (tipo === 'texto') textoLimpio = corregirConDiccionario(textoLimpio);

      if (modo === 'preciso' && resultado.confianza < CONFIG.OCR_VOTING_CONFIANZA) {
        let canvasAlt = añadirPadding(binarizarAdaptativo(canvasCelda));
        const alt = await leerCelda(canvasAlt, tipo);
        if (alt.confianza > resultado.confianza) {
          textoLimpio = limpiarTexto(alt.texto, tipo);
          matrizConfianza[f][c] = alt.confianza;
        } else matrizConfianza[f][c] = resultado.confianza;
      } else matrizConfianza[f][c] = resultado.confianza;

      matrizTexto[f][c] = textoLimpio;
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

console.log('✅ OCR cargado (Tesseract v4)');
