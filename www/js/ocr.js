// ==============================================
// MAR Caribe v12.0 - OCR CON ÓPTICA ESPACIAL
// Pipeline: AP + BS local + PSF + escalado + binarización + voting
// ==============================================

let tesseractWorker = null;

// ============================================
// INICIALIZAR TESSERACT (una sola vez)
// ============================================
async function inicializarTesseract() {
  if (tesseractWorker) return tesseractWorker;

  log('🔤 Inicializando Tesseract...', 'etapa');

  try {
    tesseractWorker = await Tesseract.createWorker(CONFIG.TESS_IDIOMAS, CONFIG.TESS_OEM, {
      workerPath: CONFIG.TESS_RUTA_WORKER,
      corePath: CONFIG.TESS_RUTA_CORE,
      langPath: CONFIG.TESS_RUTA_DATOS,
      logger: function(m) {
        if (m.status === 'loading tesseract core') {
          log(`   ⏳ ${m.status} ${Math.round(m.progress * 100)}%`, 'info');
        }
      }
    });

    await tesseractWorker.setParameters({
      tessedit_pageseg_mode: CONFIG.TESS_PSM,
      preserve_interword_spaces: CONFIG.TESS_PRESERVE_SPACES
    });

    log('✅ Tesseract listo', 'exito');
    return tesseractWorker;
  } catch (e) {
    log(`❌ Error Tesseract: ${e.message}`, 'error');
    throw e;
  }
}

// ============================================
// MEDIR DENSIDAD DE CELDA (Aperture Photometry)
// Devuelve 0-1 (proporción de píxeles con contenido)
// ============================================
function medirDensidadCelda(canvas, x1, y1, x2, y2) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const ancho = x2 - x1;
  const alto = y2 - y1;
  if (ancho <= 0 || alto <= 0) return 0;

  const imageData = ctx.getImageData(x1, y1, ancho, alto);
  const datos = imageData.data;

  let conContenido = 0;
  let total = 0;

  for (let i = 0; i < datos.length; i += 4) {
    const brillo = (datos[i] + datos[i + 1] + datos[i + 2]) / 3;
    // Consideramos "contenido" píxeles oscuros
    if (brillo < 180) conContenido++;
    total++;
  }

  return conContenido / total;
}

// ============================================
// EXTRAER CELDA COMO CANVAS INDEPENDIENTE
// ============================================
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
// BS LOCAL POR CELDA
// Elimina el color de fondo de la celda
// ============================================
function bsLocalCelda(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const datos = imageData.data;

  // 1. Encontrar el color de fondo (píxeles más claros)
  const muestras = [];
  for (let i = 0; i < datos.length; i += 16) {
    muestras.push({
      r: datos[i], g: datos[i + 1], b: datos[i + 2],
      brillo: (datos[i] + datos[i + 1] + datos[i + 2]) / 3
    });
  }
  muestras.sort((a, b) => b.brillo - a.brillo);

  // Top 25% más brillante = fondo
  const top25 = muestras.slice(0, Math.max(1, Math.floor(muestras.length * 0.25)));
  const fondoR = top25.reduce((s, m) => s + m.r, 0) / top25.length;
  const fondoG = top25.reduce((s, m) => s + m.g, 0) / top25.length;
  const fondoB = top25.reduce((s, m) => s + m.b, 0) / top25.length;

  // 2. Restar fondo y normalizar a blanco puro
  for (let i = 0; i < datos.length; i += 4) {
    datos[i] = clamp((datos[i] - fondoR) * 4 + 255, 0, 255);
    datos[i + 1] = clamp((datos[i + 1] - fondoG) * 4 + 255, 0, 255);
    datos[i + 2] = clamp((datos[i + 2] - fondoB) * 4 + 255, 0, 255);
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// ============================================
// ESTIMAR BORROSIDAD (PSF σ aproximado)
// Mide el ancho de las transiciones de borde
// ============================================
function estimarBorroso(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const datos = imageData.data;
  const w = canvas.width;
  const h = canvas.height;

  let sumaAnchos = 0;
  let count = 0;

  // Escanear filas horizontales buscando transiciones
  for (let y = 0; y < h; y += 5) {
    let enTransicion = false;
    let anchoTransicion = 0;

    for (let x = 1; x < w; x++) {
      const idx = (y * w + x) * 4;
      const idxAnt = (y * w + x - 1) * 4;
      const brillo = (datos[idx] + datos[idx + 1] + datos[idx + 2]) / 3;
      const brilloAnt = (datos[idxAnt] + datos[idxAnt + 1] + datos[idxAnt + 2]) / 3;
      const dif = Math.abs(brillo - brilloAnt);

      if (dif > 20 && dif < 100) {
        // Transición suave = borroso
        enTransicion = true;
        anchoTransicion++;
      } else if (dif >= 100) {
        // Transición brusca = nítido
        enTransicion = false;
        anchoTransicion = 0;
      } else if (enTransicion && dif < 20) {
        if (anchoTransicion > 0) {
          sumaAnchos += anchoTransicion;
          count++;
        }
        enTransicion = false;
        anchoTransicion = 0;
      }
    }
  }

  const anchoPromedio = count > 0 ? sumaAnchos / count : 0;
  // Interpretación: 0-1px nítido, 2-3px borroso moderado, 4+px muy borroso
  return anchoPromedio;
}

// ============================================
// PSF DECONVOLUTION (Richardson-Lucy simplificado)
// Recupera nitidez del texto borroso de WhatsApp
// ============================================
function deconvolucionarPSF(canvas, iteraciones) {
  iteraciones = iteraciones || 3;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const w = canvas.width;
  const h = canvas.height;

  let est = new Float32Array(w * h);
  const orig = new Float32Array(w * h);

  // Convertir a escala de grises (0-1)
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    const brillo = (imageData.data[idx] + imageData.data[idx + 1] + imageData.data[idx + 2]) / 3;
    est[i] = brillo / 255;
    orig[i] = est[i];
  }

  // Kernel Gaussiano 3x3 (PSF estimada para WhatsApp)
  const kernel = [
    0.0625, 0.125, 0.0625,
    0.125,  0.25,  0.125,
    0.0625, 0.125, 0.0625
  ];

  // Aplicar Richardson-Lucy
  for (let iter = 0; iter < iteraciones; iter++) {
    const borroso = new Float32Array(w * h);

    // Convolución
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let suma = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            suma += est[(y + ky) * w + (x + kx)] * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        borroso[y * w + x] = suma;
      }
    }

    // Cociente entre original y convolución
    const ratio = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      ratio[i] = orig[i] / (borroso[i] + 0.001);
    }

    // Convolución del ratio con kernel transpuesto
    const ratioConv = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let suma = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            suma += ratio[(y + ky) * w + (x + kx)] * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        ratioConv[y * w + x] = suma;
      }
    }

    // Actualizar estimación
    for (let i = 0; i < w * h; i++) {
      est[i] = est[i] * ratioConv[i];
      est[i] = clamp(est[i], 0, 1);
    }
  }

  // Escribir de vuelta
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

// ============================================
// ESCALADO INTELIGENTE
// Escala según altura del texto detectado
// ============================================
function escalarInteligente(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const datos = imageData.data;
  const w = canvas.width;
  const h = canvas.height;

  // Detectar altura aproximada del texto
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

  // Encontrar filas con contenido
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
    if (alturaTexto < CONFIG.OCR_ESCALA_UMBRAL_BAJO) {
      factor = CONFIG.OCR_ESCALA_3X;
    } else if (alturaTexto < CONFIG.OCR_ESCALA_UMBRAL_MEDIO) {
      factor = CONFIG.OCR_ESCALA_2X;
    }
  } else {
    factor = 1;
  }

  if (factor === 1) return canvas;

  // Escalar
  const nuevoCanvas = document.createElement('canvas');
  nuevoCanvas.width = w * factor;
  nuevoCanvas.height = h * factor;
  const nuevoCtx = nuevoCanvas.getContext('2d');
  nuevoCtx.imageSmoothingEnabled = true;
  nuevoCtx.imageSmoothingQuality = 'high';
  nuevoCtx.drawImage(canvas, 0, 0, w * factor, h * factor);

  return nuevoCanvas;
}

// ============================================
// BINARIZACIÓN ADAPTATIVA
// ============================================
function binarizarAdaptativo(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const datos = imageData.data;
  const w = canvas.width;
  const h = canvas.height;

  // Calcular umbral global primero
  let suma = 0;
  for (let i = 0; i < datos.length; i += 4) {
    suma += (datos[i] + datos[i + 1] + datos[i + 2]) / 3;
  }
  const promGlobal = suma / (datos.length / 4);

  // Umbral adaptativo por bloques
  const bloque = 20;
  for (let by = 0; by < h; by += bloque) {
    for (let bx = 0; bx < w; bx += bloque) {
      const x1 = Math.min(bx + bloque, w);
      const y1 = Math.min(by + bloque, h);

      let sumaLocal = 0, count = 0;
      for (let y = by; y < y1; y++) {
        for (let x = bx; x < x1; x++) {
          const idx = (y * w + x) * 4;
          sumaLocal += (datos[idx] + datos[idx + 1] + datos[idx + 2]) / 3;
          count++;
        }
      }
      const umbralLocal = (sumaLocal / count) * 0.85;

      for (let y = by; y < y1; y++) {
        for (let x = bx; x < x1; x++) {
          const idx = (y * w + x) * 4;
          const brillo = (datos[idx] + datos[idx + 1] + datos[idx + 2]) / 3;
          const valor = brillo < umbralLocal ? 0 : 255;
          datos[idx] = valor;
          datos[idx + 1] = valor;
          datos[idx + 2] = valor;
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// ============================================
// CONTRASTE ADAPTATIVO (simplificado)
// ============================================
function contrastarAdaptativo(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const datos = imageData.data;

  // Encontrar mín y máx
  let min = 255, max = 0;
  for (let i = 0; i < datos.length; i += 4) {
    const b = (datos[i] + datos[i + 1] + datos[i + 2]) / 3;
    if (b < min) min = b;
    if (b > max) max = b;
  }

  if (max - min < 10) return canvas;

  // Estirar el rango
  const factor = 255 / (max - min);
  for (let i = 0; i < datos.length; i += 4) {
    datos[i] = clamp((datos[i] - min) * factor, 0, 255);
    datos[i + 1] = clamp((datos[i + 1] - min) * factor, 0, 255);
    datos[i + 2] = clamp((datos[i + 2] - min) * factor, 0, 255);
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// ============================================
// AÑADIR PADDING (margen blanco)
// ============================================
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
// DETECTAR TIPO DE COLUMNA
// Analiza la primera fila completa de la columna
// ============================================
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

// ============================================
// APLICAR WHITELIST SEGÚN TIPO
// ============================================
async function aplicarWhitelist(worker, tipo) {
  const whitelists = {
    'numero': '0123456789.',
    'fecha': '0123456789/-',
    'moneda': '0123456789.,$€£',
    'hora': '0123456789:',
    'texto': ''
  };
  const wl = whitelists[tipo] || '';
  try {
    await worker.setParameters({
      tessedit_char_whitelist: wl
    });
  } catch (e) {
    console.log('No se pudo aplicar whitelist:', e);
  }
}

// ============================================
// LIMPIAR TEXTO SEGÚN TIPO
// ============================================
function limpiarTexto(texto, tipo) {
  let t = texto.trim();

  // Quitar basura común
  t = t.replace(/[|_~`^]/g, '');
  t = t.replace(/\s+/g, ' ');

  switch (tipo) {
    case 'numero':
      t = t.replace(/[^\d.]/g, '');
      break;
    case 'fecha':
      t = t.replace(/[^\d\/\-]/g, '');
      break;
    case 'moneda':
      t = t.replace(/[^\d.,\$€£]/g, '');
      break;
    case 'hora':
      t = t.replace(/[^\d:]/g, '');
      break;
    case 'texto':
      // Solo letras, números, espacios y algunos signos
      t = t.replace(/[^\w\sáéíóúÁÉÍÓÚñÑüÜ\-\.,]/g, '');
      break;
  }

  return t.trim();
}

// ============================================
// CORREGIR CON DICCIONARIO
// ============================================
function corregirConDiccionario(texto) {
  if (!texto) return texto;
  const palabras = texto.split(/\s+/);
  const corregidas = palabras.map(p => {
    const mayus = p.toUpperCase();
    // Si ya está en el diccionario, dejarla
    if (CONFIG.DICCIONARIO.indexOf(mayus) !== -1) return mayus;
    // Buscar similar (distancia 1-2)
    for (const palabra of CONFIG.DICCIONARIO) {
      if (levenshtein(mayus, palabra) <= 1 && mayus.length > 3) {
        return palabra;
      }
    }
    return p;
  });
  return corregidas.join(' ');
}

// ============================================
// LEVENSHTEIN (distancia entre strings)
// ============================================
function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matriz = [];
  for (let i = 0; i <= b.length; i++) {
    matriz[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matriz[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matriz[i][j] = matriz[i - 1][j - 1];
      } else {
        matriz[i][j] = Math.min(
          matriz[i - 1][j - 1] + 1,
          matriz[i][j - 1] + 1,
          matriz[i - 1][j] + 1
        );
      }
    }
  }
  return matriz[b.length][a.length];
}

// ============================================
// PREPROCESAR CELDA (pipeline completo)
// ============================================
function preprocesarCelda(canvasOriginal) {
  let canvas = canvasOriginal;

  // 1. BS local (eliminar color de fondo)
  canvas = bsLocalCelda(canvas);

  // 2. Detectar borrosidad y aplicar PSF si es necesario
  const borroso = estimarBorroso(canvas);
  if (borroso > 1.5) {
    canvas = deconvolucionarPSF(canvas, 3);
  }

  // 3. Escalar según altura de texto
  canvas = escalarInteligente(canvas);

  // 4. Contraste adaptativo
  canvas = contrastarAdaptativo(canvas);

  // 5. Binarización adaptativa
  canvas = binarizarAdaptativo(canvas);

  // 6. Añadir padding
  canvas = añadirPadding(canvas);

  return canvas;
}

// ============================================
// LEER CELDA CON TESSERACT
// ============================================
async function leerCelda(canvasProcesado, tipo) {
  const worker = await inicializarTesseract();

  // Aplicar whitelist según tipo
  await aplicarWhitelist(worker, tipo);

  // Convertir canvas a dataURL
  const dataURL = canvasProcesado.toDataURL('image/png');

  try {
    const { data } = await worker.recognize(dataURL);
    return {
      texto: data.text.trim(),
      confianza: data.confidence
    };
  } catch (e) {
    return { texto: '', confianza: 0 };
  }
}

// ============================================
// OCR COMPLETO DE LA TABLA
// ============================================
async function ejecutarOCRCompleto(canvasFuente, celdas, modo) {
  log('═══════════════════════════════════', 'etapa');
  log(`📄 OCR MODO: ${modo.toUpperCase()}`, 'etapa');
  log('═══════════════════════════════════', 'etapa');

  const total = celdas.length;
  if (total === 0) {
    log('⚠️ No hay celdas para procesar', 'alerta');
    return;
  }

  // Determinar filas y columnas
  const filas = Math.max(...celdas.map(c => c.fila)) + 1;
  const columnas = Math.max(...celdas.map(c => c.col)) + 1;

  log(`📊 Tabla: ${filas}×${columnas} (${total} celdas)`, 'info');

  // Matriz de resultados
  const matrizTexto = Array(filas).fill(null).map(() => Array(columnas).fill(''));
  const matrizConfianza = Array(filas).fill(null).map(() => Array(columnas).fill(0));

  // Primera pasada: leer cabecera + muestra para detectar tipos de columna
  const muestraFilas = Math.min(5, filas - 1);

  let procesadas = 0;
  const inicio = Date.now();

  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < columnas; c++) {
      procesadas++;

      // Buscar la celda correspondiente
      const celda = celdas.find(x => x.fila === f && x.col === c);
      if (!celda) continue;

      // Progreso cada 10 celdas
      if (procesadas % 10 === 0 || procesadas === total) {
        const pct = Math.round((procesadas / total) * 100);
        actualizarProgreso(pct);
        log(`   ⏳ ${procesadas}/${total} (${pct}%)`, 'info');
      }

      // Medir densidad
      const densidad = medirDensidadCelda(canvasFuente, celda.x1, celda.y1, celda.x2, celda.y2);

      // Saltar celdas vacías
      if (densidad < CONFIG.OCR_DENSIDAD_MIN) {
        matrizTexto[f][c] = '';
        matrizConfianza[f][c] = 100;
        continue;
      }

      // Extraer canvas de la celda
      let canvasCelda = extraerCeldaCanvas(canvasFuente, celda.x1, celda.y1, celda.x2, celda.y2);

      // Detectar tipo (usar 'texto' por defecto la primera vez)
      let tipo = 'texto';
      if (f > 0 && c < columnas) {
        const colMuestra = [];
        for (let ff = 1; ff <= Math.min(f, 3); ff++) {
          if (matrizTexto[ff][c]) colMuestra.push(matrizTexto[ff][c]);
        }
        if (colMuestra.length >= 2) {
          tipo = detectarTipoColumna(matrizTexto, c);
        }
      }

      // Preprocesar según modo
      let canvasProcesado;
      if (modo === 'rapido') {
        // Solo binarización
        canvasProcesado = binarizarAdaptativo(canvasCelda);
        canvasProcesado = añadirPadding(canvasProcesado);
      } else if (modo === 'medio') {
        // BS + escalado + binarización
        canvasProcesado = bsLocalCelda(canvasCelda);
        canvasProcesado = escalarInteligente(canvasProcesado);
        canvasProcesado = binarizarAdaptativo(canvasProcesado);
        canvasProcesado = añadirPadding(canvasProcesado);
      } else {
        // Preciso: pipeline completo
        canvasProcesado = preprocesarCelda(canvasCelda);
      }

      // Leer
      const resultado = await leerCelda(canvasProcesado, tipo);

      // Limpiar según tipo
      let textoLimpio = limpiarTexto(resultado.texto, tipo);

      // Corregir con diccionario (solo tipo texto)
      if (tipo === 'texto') {
        textoLimpio = corregirConDiccionario(textoLimpio);
      }

      // Si la confianza es muy baja y hay modo voting, reintentar
      if (modo === 'preciso' && resultado.confianza < CONFIG.OCR_VOTING_CONFIANZA) {
        // Segunda pasada con binarización simple
        let canvasAlt = binarizarAdaptativo(canvasCelda);
        canvasAlt = añadirPadding(canvasAlt);
        const alt = await leerCelda(canvasAlt, tipo);
        // Elegir el de mayor confianza
        if (alt.confianza > resultado.confianza) {
          textoLimpio = limpiarTexto(alt.texto, tipo);
          matrizConfianza[f][c] = alt.confianza;
        } else {
          matrizConfianza[f][c] = resultado.confianza;
        }
      } else {
        matrizConfianza[f][c] = resultado.confianza;
      }

      matrizTexto[f][c] = textoLimpio;
    }
  }

  const duracion = ((Date.now() - inicio) / 1000).toFixed(1);
  log(`✅ OCR COMPLETO en ${duracion}s`, 'exito');

  // Guardar resultados
  window.estadoPasos.matrizTexto = matrizTexto;
  window.estadoPasos.matrizConfianza = matrizConfianza;
  window.estadoPasos.matrizColores = extraerColoresCelda(canvasFuente, celdas);

  // Mostrar en la pestaña Tabla
  mostrarTabla(matrizTexto, window.estadoPasos.matrizColores, matrizConfianza);

  // Cambiar a la pestaña Tabla
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector('[data-tab="tabla"]').classList.add('active');
  document.getElementById('tab-tabla').classList.add('active');

  marcarPasoCompletado(9);
  log('✅ Resultados en la pestaña 📊 Tabla', 'exito');
}

// ============================================
// EXTRAER COLOR DE FONDO DE CADA CELDA
// ============================================
function extraerColoresCelda(canvasFuente, celdas) {
  const ctx = canvasFuente.getContext('2d', { willReadFrequently: true });
  const colores = [];

  for (const celda of celdas) {
    const ancho = celda.x2 - celda.x1;
    const alto = celda.y2 - celda.y1;
    if (ancho <= 0 || alto <= 0) {
      colores.push({ r: 255, g: 255, b: 255 });
      continue;
    }

    // Muestrear píxeles (cada 4)
    const imageData = ctx.getImageData(celda.x1, celda.y1, ancho, alto);
    const datos = imageData.data;

    const muestras = [];
    for (let i = 0; i < datos.length; i += 16) {
      const r = datos[i], g = datos[i + 1], b = datos[i + 2];
      const brillo = (r + g + b) / 3;
      muestras.push({ r, g, b, brillo });
    }

    // El fondo es el más brillante (top 25%)
    muestras.sort((a, b) => b.brillo - a.brillo);
    const top = muestras.slice(0, Math.max(1, Math.floor(muestras.length * 0.25)));
    const promR = Math.round(top.reduce((s, m) => s + m.r, 0) / top.length);
    const promG = Math.round(top.reduce((s, m) => s + m.g, 0) / top.length);
    const promB = Math.round(top.reduce((s, m) => s + m.b, 0) / top.length);

    colores.push({ r: promR, g: promG, b: promB });
  }
  return colores;
}

// ============================================
// MOSTRAR TABLA EN HTML
// ============================================
function mostrarTabla(matrizTexto, matrizColores, matrizConfianza) {
  const wrapper = document.getElementById('tablaWrapper');
  if (!wrapper) return;

  const filas = matrizTexto.length;
  const columnas = matrizTexto[0].length;

  let html = '<table class="tabla-resultado"><tbody>';

  for (let f = 0; f < filas; f++) {
    html += '<tr>';
    for (let c = 0; c < columnas; c++) {
      // Índice en matrizColores (lineal)
      const idx = f * columnas + c;
      const color = matrizColores[idx] || { r: 255, g: 255, b: 255 };
      const conf = matrizConfianza ? matrizConfianza[f][c] : 100;
      const confColor = conf < 50 ? '#fee2e2' : (conf < 75 ? '#fef3c7' : 'transparent');

      const tag = (f === 0) ? 'th' : 'td';
      const colorHex = `rgb(${color.r},${color.g},${color.b})`;
      const estilo = f === 0 ? '' : `background:${colorHex};`;
      const estiloConf = conf < 75 && f > 0 ? `box-shadow:inset 0 0 0 2px ${conf < 50 ? '#ef4444' : '#f59e0b'};` : '';

      const texto = (matrizTexto[f][c] || '').replace(/</g, '&lt;');
      html += `<${tag} style="${estilo}${estiloConf}" contenteditable="${f > 0}">${texto}</${tag}>`;
    }
    html += '</tr>';
  }

  html += '</tbody></table>';

  wrapper.innerHTML = html;

  // Info extra
  const info = document.getElementById('infoExtra');
  if (info) {
    info.textContent = `📊 ${filas} filas · ${columnas} columnas · ${filas * columnas} celdas`;
  }

  log(`📊 Tabla mostrada: ${filas}×${columnas}`, 'exito');
}

console.log('✅ OCR cargado');
