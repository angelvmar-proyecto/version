// ==============================================
// MAR Caribe v13 - OCR con ML Kit + Filesystem
// v5: 3 modos diferenciados (rapido/medio/preciso)
// ==============================================

let mlkitDisponible = false;

// ============================================
// INICIALIZAR ML KIT
// ============================================
async function inicializarMLKit() {
  if (typeof Capacitor === 'undefined' || !Capacitor.Plugins) {
    log('⚠️ Capacitor no disponible', 'alerta');
    return false;
  }

  const plugin = Capacitor.Plugins.TextRecognition;
  if (!plugin) {
    log('⚠️ TextRecognition plugin no encontrado', 'alerta');
    return false;
  }

  const fs = Capacitor.Plugins.Filesystem;
  if (!fs) {
    log('⚠️ Filesystem plugin no encontrado', 'alerta');
    return false;
  }

  log('🔤 Plugin ML Kit encontrado', 'exito');
  log('📁 Plugin Filesystem encontrado', 'exito');
  mlkitDisponible = true;
  return true;
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

// ============================================
// EXTRAER CELDA (con margen interno)
// ============================================
function extraerCeldaCanvas(canvasFuente, x1, y1, x2, y2) {
  const margen = (CONFIG.OCR_MARGEN_CELDA !== undefined) ? CONFIG.OCR_MARGEN_CELDA : 3;
  x1 = x1 + margen;
  y1 = y1 + margen;
  x2 = x2 - margen;
  y2 = y2 - margen;

  const ancho = Math.max(1, x2 - x1);
  const alto = Math.max(1, y2 - y1);
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
    datos[i]     = clamp((datos[i]     - fondoR) * 4 + 255, 0, 255);
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

function escalarInteligenteForzado(canvas, factorMinimo) {
  factorMinimo = factorMinimo || 2;
  const w = canvas.width, h = canvas.height;
  const factor = Math.max(factorMinimo, CONFIG.OCR_ESCALA_2X || 2);
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
  const brillos = [];
  for (let i = 0; i < datos.length; i += 4) {
    brillos.push((datos[i] + datos[i + 1] + datos[i + 2]) / 3);
  }
  brillos.sort((a, b) => a - b);
  const min = brillos[Math.floor(brillos.length * 0.02)];
  const max = brillos[Math.floor(brillos.length * 0.98)];
  if (max - min < 10) return canvas;
  const factor = 255 / (max - min);
  for (let i = 0; i < datos.length; i += 4) {
    datos[i]     = clamp((datos[i]     - min) * factor, 0, 255);
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

// ============================================
// PREPROCESAR CELDA - 3 MODOS DIFERENCIADOS
// ⚡ RÁPIDO   → BS + retinal suave opcional
// 📊 MEDIO    → Pipeline equilibrado (default)
// 🎯 PRECISO  → Retinal forzado + upscale 2x + binarizado
// ============================================
function preprocesarCelda(canvasOriginal, modo) {
  let canvas = canvasOriginal;

  // ⚡ RÁPIDO
  if (modo === 'rapido') {
    canvas = bsLocalCelda(canvas);
    if (CONFIG.RETINA_ACTIVO && CONFIG.RETINA_EN_RAPIDO === true &&
        typeof aplicarRetinaSuave === 'function') {
      canvas = aplicarRetinaSuave(canvas);
    }
    return añadirPadding(canvas);
  }

  // 🎯 PRECISO
  if (modo === 'preciso') {
    canvas = bsLocalCelda(canvas);

    if (CONFIG.RETINA_ACTIVO && typeof aplicarRetinaForzado === 'function') {
      canvas = aplicarRetinaForzado(canvas, 12, 2.0, 0.7);
    }

    if (typeof escalarInteligenteForzado === 'function') {
      canvas = escalarInteligenteForzado(canvas, 2);
    } else {
      canvas = escalarInteligente(canvas);
    }

    canvas = contrastarAdaptativo(canvas);
    canvas = binarizarAdaptativo(canvas);
    canvas = añadirPadding(canvas);
    return canvas;
  }

  // 📊 MEDIO (default)
  canvas = bsLocalCelda(canvas);

  if (CONFIG.RETINA_ACTIVO && typeof aplicarRetina === 'function') {
    canvas = aplicarRetina(canvas);
  }

  canvas = escalarInteligente(canvas);
  canvas = contrastarAdaptativo(canvas);

  if (CONFIG.OCR_BINARIZAR === true) {
    canvas = binarizarAdaptativo(canvas);
  }

  canvas = añadirPadding(canvas);
  return canvas;
}

// ============================================
// LIMPIAR TEXTO
// ============================================
function limpiarTexto(texto) {
  if (!texto) return '';
  let t = texto.trim();
  t = t.replace(/[|_~`^]/g, '');
  t = t.replace(/\s+/g, ' ');
  return t;
}

// ============================================
// LEER CELDA CON ML KIT
// ============================================
async function leerCeldaMLKit(canvasProcesado, indice) {
  if (!mlkitDisponible) return { texto: '', confianza: 0 };

  const plugin = Capacitor.Plugins.TextRecognition;
  const fs = Capacitor.Plugins.Filesystem;
  if (!plugin || !fs) return { texto: '', confianza: 0 };

  try {
    const dataURL = canvasProcesado.toDataURL('image/png');
    const base64 = dataURL.replace(/^data:image\/png;base64,/, '');

    const nombreArchivo = 'celda_' + indice + '_' + Date.now() + '.png';
    const escritura = await fs.writeFile({
      path: nombreArchivo,
      data: base64,
      directory: 'CACHE'
    });

    const uri = escritura.uri;
    const resultado = await plugin.processImage({
      path: uri,
      language: 'es'
    });

    try {
      await fs.deleteFile({ path: nombreArchivo, directory: 'CACHE' });
    } catch (e) {}

    const texto = (resultado.text || '').trim();
    return { texto, confianza: 90 };
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    log('      ⚠️ ML Kit falló: ' + msg, 'alerta');
    return { texto: '', confianza: 0 };
  }
}

// ============================================
// CONSISTENCIA CRUZADA
// ============================================
function aplicarConsistenciaCruzada(matrizTexto) {
  const filas = matrizTexto.length;
  const columnas = matrizTexto[0].length;
  let correcciones = 0;

  for (let c = 0; c < columnas; c++) {
    const grupos = {};
    for (let f = 0; f < filas; f++) {
      const texto = (matrizTexto[f][c] || '').trim();
      if (!texto) continue;
      const clave = texto.toLowerCase().replace(/\s+/g, '');
      if (!grupos[clave]) grupos[clave] = [];
      grupos[clave].push({ fila: f, texto: texto });
    }

    Object.keys(grupos).forEach(clave => {
      const grupo = grupos[clave];
      if (grupo.length < 2) return;
      const variantes = {};
      grupo.forEach(item => {
        variantes[item.texto] = (variantes[item.texto] || 0) + 1;
      });
      let mejorTexto = null, mejorCount = 0;
      Object.keys(variantes).forEach(v => {
        if (variantes[v] > mejorCount) {
          mejorCount = variantes[v];
          mejorTexto = v;
        }
      });
      const numVariantes = Object.keys(variantes).length;
      if (mejorCount >= 2 && numVariantes > 1) {
        grupo.forEach(item => {
          if (item.texto !== mejorTexto) {
            matrizTexto[item.fila][c] = mejorTexto;
            correcciones++;
          }
        });
      }
    });
  }
  return correcciones;
}

// ============================================
// OCR COMPLETO
// ============================================
// ============================================
// OCR MATRIZ CRUDA (sin efectos colaterales)
// Usada internamente por ejecutarOCRCompleto y por el entrenamiento
// ============================================
async function ocrMatrizCruda(canvasFuente, celdas, modo) {
  const total = celdas.length;
  if (total === 0) throw new Error('Sin celdas');

  const filas = Math.max(...celdas.map(c => c.fila)) + 1;
  const columnas = Math.max(...celdas.map(c => c.col)) + 1;

  const ok = await inicializarMLKit();
  if (!ok) throw new Error('ML Kit no disponible');

  const matrizTexto = Array(filas).fill(null).map(() => Array(columnas).fill(''));
  const matrizConfianza = Array(filas).fill(null).map(() => Array(columnas).fill(0));

  let procesadas = 0;
  let indiceGlobal = 0;

  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < columnas; c++) {
      procesadas++;
      indiceGlobal++;
      const celda = celdas.find(x => x.fila === f && x.col === c);
      if (!celda) continue;

      if (procesadas % 10 === 0 || procesadas === total || procesadas === 1) {
        const pct = Math.round((procesadas / total) * 100);
        actualizarProgreso(pct);
        if (!window._modoEntrenamiento) {
          log('   ⏳ ' + procesadas + '/' + total + ' (' + pct + '%)', 'info');
        }
      }

      const densidad = medirDensidadCelda(canvasFuente, celda.x1, celda.y1, celda.x2, celda.y2);
      if (densidad < CONFIG.OCR_DENSIDAD_MIN) {
        matrizTexto[f][c] = '';
        matrizConfianza[f][c] = 100;
        continue;
      }

      let canvasCelda = extraerCeldaCanvas(canvasFuente, celda.x1, celda.y1, celda.x2, celda.y2);
      let canvasProcesado = preprocesarCelda(canvasCelda, modo);

      const resultado = await leerCeldaMLKit(canvasProcesado, indiceGlobal);
      matrizTexto[f][c] = limpiarTexto(resultado.texto);
      matrizConfianza[f][c] = resultado.confianza;
    }
  }

  return { matrizTexto, matrizConfianza };
}

async function ejecutarOCRCompleto(canvasFuente, celdas, modo) {
  log('═══════════════════════════════════', 'etapa');
  log('📄 OCR MODO: ' + modo.toUpperCase() + ' (ML Kit)', 'etapa');
  log('═══════════════════════════════════', 'etapa');

  const total = celdas.length;
  if (total === 0) { log('⚠️ Sin celdas', 'alerta'); return; }

  const filas = Math.max(...celdas.map(c => c.fila)) + 1;
  const columnas = Math.max(...celdas.map(c => c.col)) + 1;
  log('📊 Tabla: ' + filas + '×' + columnas + ' (' + total + ' celdas)', 'info');

  const inicio = Date.now();

  let matrizTexto, matrizConfianza;
  try {
    const r = await ocrMatrizCruda(canvasFuente, celdas, modo);
    matrizTexto = r.matrizTexto;
    matrizConfianza = r.matrizConfianza;
  } catch (e) {
    log('❌ ' + e.message, 'error');
    return;
  }

  const duracion = ((Date.now() - inicio) / 1000).toFixed(1);
  log('✅ OCR COMPLETO en ' + duracion + 's', 'exito');

  window.estadoPasos.matrizTexto = matrizTexto;
  window.estadoPasos.matrizConfianza = matrizConfianza;
  window.estadoPasos.matrizColores = extraerColoresCelda(canvasFuente, celdas);

  // 🎓 Aplicar reglas aprendidas (si activo y NO en modo entrenamiento)
  if (typeof aprendizajeAplicar === 'function' && CONFIG.APRENDIZAJE_ACTIVO && !window._modoEntrenamiento) {
    const apr = aprendizajeAplicar(matrizTexto);
    if (apr.aplicado && apr.correcciones > 0) {
      log('🎓 Aprendizaje: ' + apr.correcciones + ' celdas corregidas', 'exito');
    } else if (apr.aplicado) {
      log('🎓 Aprendizaje: sin cambios', 'info');
    }
  }

  // 🧠 Consistencia cruzada (también se salta en modo entrenamiento)
  if (!window._modoEntrenamiento) {
    const correcciones = aplicarConsistenciaCruzada(matrizTexto);
    if (correcciones > 0) {
      log('🧠 Consistencia cruzada: ' + correcciones + ' celdas corregidas', 'exito');
    } else {
      log('🧠 Consistencia cruzada: sin correcciones', 'info');
    }
  }

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

// ============================================
// MOSTRAR TABLA
// ============================================
function mostrarTabla(matrizTexto, matrizColores, matrizConfianza) {
  const wrapper = document.getElementById('tablaWrapper');
  if (!wrapper) return;
  const filas = matrizTexto.length;
  const columnas = matrizTexto[0].length;
  const fila0EsEncabezado = (CONFIG.OCR_FILA0_ENCABEZADO === true);

  let html = '<table class="tabla-resultado"><tbody>';
  for (let f = 0; f < filas; f++) {
    html += '<tr>';
    for (let c = 0; c < columnas; c++) {
      const idx = f * columnas + c;
      const color = matrizColores[idx] || { r: 255, g: 255, b: 255 };
      const conf = matrizConfianza ? matrizConfianza[f][c] : 100;
      const esHeader = fila0EsEncabezado && (f === 0);
      const tag = esHeader ? 'th' : 'td';
      const colorHex = 'rgb(' + color.r + ',' + color.g + ',' + color.b + ')';
      const estilo = esHeader ? '' : 'background:' + colorHex + ';';
      const estiloConf = conf < 75 && !esHeader ? 'box-shadow:inset 0 0 0 2px ' + (conf < 50 ? '#ef4444' : '#f59e0b') + ';' : '';
      const texto = (matrizTexto[f][c] || '').replace(/</g, '&lt;');
      html += '<' + tag + ' style="' + estilo + estiloConf + '" contenteditable="' + (!esHeader) + '">' + texto + '</' + tag + '>';
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  wrapper.innerHTML = html;

  const info = document.getElementById('infoExtra');
  if (info) info.textContent = '📊 ' + filas + ' filas · ' + columnas + ' columnas · ' + (filas * columnas) + ' celdas';
  log('📊 Tabla mostrada: ' + filas + '×' + columnas, 'exito');
}

console.log('✅ OCR v5 (3 modos diferenciados)');

// ============================================================
// v13-fase2: ENTRENAMIENTO — procesar foto + devolver matriz cruda
// SIN aplicar aprendizaje (para no contaminar el entrenamiento)
// Reutiliza el pipeline real de app.js/analizarTodo.
// ============================================================
async function procesarFotoParaEntrenar(file) {
  if (!file) throw new Error('procesarFotoParaEntrenar: file vacío');

  // 1) Cargar imagen en canvas offscreen
  const img = await new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('No se pudo cargar la imagen'));
    im.src = URL.createObjectURL(file);
  });

  const canvasP1 = document.createElement('canvas');
  canvasP1.width = img.naturalWidth;
  canvasP1.height = img.naturalHeight;
  const ctxP1 = canvasP1.getContext('2d', { willReadFrequently: true });
  ctxP1.drawImage(img, 0, 0);
  URL.revokeObjectURL(img.src);

  // 2) Preprocesamiento (CRR + BS)
  const imageData = ctxP1.getImageData(0, 0, canvasP1.width, canvasP1.height);
  const preproc = preprocesarImagen(imageData);
  ctxP1.putImageData(preproc.imageData, 0, 0);

  // 3) Retinal global (mejora detección de líneas)
  if (typeof aplicarRetinaGlobal === 'function' && CONFIG.RETINA_GLOBAL_ACTIVO) {
    aplicarRetinaGlobal(canvasP1);
  }

  // 4) Brillo
  const imageDataPost = ctxP1.getImageData(0, 0, canvasP1.width, canvasP1.height);
  const brillo = calcularBrillo(imageDataPost);
  const ancho = canvasP1.width;
  const alto = canvasP1.height;

  // 5) Detección + LIDAR
  const det = ejecutarDeteccion(brillo, ancho, alto);
  const lidar = ejecutarLidar(
    det.optica.lineasH, det.optica.lineasV,
    det.ecografia.lineasH, det.ecografia.lineasV,
    det.a3.lineasH, det.a3.lineasV,
    brillo, ancho, alto
  );

  // 6) Celdas
  const celdas = recortarCeldas(lidar.lineasH, lidar.lineasV);
  if (!celdas || celdas.length === 0) {
    throw new Error('No se detectaron celdas en la imagen');
  }

  // 7) OCR crudo: usamos ocrMatrizCruda directamente
  //    No aplicamos aprendizaje ni consistencia cruzada (datos limpios)
  window._modoEntrenamiento = true;
  try {
    const r = await ocrMatrizCruda(canvasP1, celdas, 'rapido');
    const matriz = r.matrizTexto;
    if (!matriz || matriz.length === 0) {
      throw new Error('OCR no devolvió matriz');
    }
    // Devolver copia limpia (todo string)
    return matriz.map(fila => fila.map(c => (c == null ? '' : String(c))));
  } finally {
    window._modoEntrenamiento = false;
  }
}
