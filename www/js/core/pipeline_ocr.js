// ==============================================
// core/pipeline_ocr.js
// Pipeline completo de OCR con diagnóstico selectivo.
// ==============================================

(function() {
  'use strict';

  function diagnosticarImagen(brillo, ancho, alto) {
    const problemas = [];
    const metricas = {};

    metricas.iluminacion = window.metricaIluminacionDesigual(brillo, ancho, alto);
    if (metricas.iluminacion > CONFIG.DIAG_UMBRAL_ILUMINACION) problemas.push('iluminacion');

    metricas.nitidez = window.metricaNitidez(brillo, ancho, alto);
    if (metricas.nitidez < CONFIG.DIAG_UMBRAL_NITIDEZ) problemas.push('desenfoque');

    metricas.ruido = window.metricaRuido(brillo, ancho, alto);
    if (metricas.ruido > CONFIG.DIAG_UMBRAL_RUIDO) problemas.push('ruido');

    metricas.contraste = window.metricaContrasteRMS(brillo, ancho, alto);
    if (metricas.contraste < CONFIG.DIAG_UMBRAL_CONTRASTE) problemas.push('contraste');

    const est = window.estimarTamanoTexto(brillo, ancho, alto);
    metricas.tamTexto = est.tamTexto;
    if (est.tamTexto < CONFIG.DIAG_UMBRAL_TEXTO_CHICO && est.tamTexto < 999) problemas.push('texto_chico');

    return { problemas, metricas };
  }

  function aplicarPreprocesamientoSelectivo(brillo, ancho, alto, problemas) {
    let resultado = brillo;
    const aplicados = [];

    if (problemas.indexOf('iluminacion') >= 0) {
      resultado = window.restaurarFlattenIluminacion(resultado, ancho, alto);
      aplicados.push('flatten_iluminacion');
    }
    if (problemas.indexOf('desenfoque') >= 0) {
      resultado = window.nitRichardsonLucy(resultado, ancho, alto, 5, 1.0);
      aplicados.push('richardson_lucy');
    }
    if (problemas.indexOf('ruido') >= 0) {
      resultado = window.restaurarMediana(resultado, ancho, alto, 1);
      aplicados.push('mediana');
    }
    if (problemas.indexOf('contraste') >= 0) {
      resultado = window.restaurarContrast(resultado, ancho, alto, 5, 95);
      aplicados.push('contraste');
    }

    return { brillo: resultado, aplicados };
  }

  // Función auxiliar: convierte brillo a canvas
  function brilloACanvas(brillo, ancho, alto) {
    const canvas = document.createElement('canvas');
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(ancho, alto);
    for (let y = 0; y < alto; y++) {
      for (let x = 0; x < ancho; x++) {
        const v = Math.max(0, Math.min(255, brillo[y][x]));
        const idx = (y * ancho + x) * 4;
        imgData.data[idx] = v;
        imgData.data[idx + 1] = v;
        imgData.data[idx + 2] = v;
        imgData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  async function ocrDirecto(canvas) {
    const TextRec = Capacitor.Plugins.TextRecognition;
    if (!TextRec) throw new Error('TextRecognition no disponible');
    const dataURL = canvas.toDataURL('image/jpeg', 0.95);
    const result = await TextRec.processImage({ path: dataURL });
    return extraerElementos(result);
  }

  // --- NUEVA LÓGICA DE FRANJAS CON UPSCALE ---
  async function ocrPorFranjas(canvas, ancho, alto, tamTexto, factorUpscale) {
    const TextRec = Capacitor.Plugins.TextRecognition;
    if (!TextRec) throw new Error('TextRecognition no disponible');

    // 1. Detectar filas lógicas sobre la imagen original (o miniatura)
    const maxAltoMini = 800;
    const factorMini = Math.min(1, maxAltoMini / alto);
    const canvasMini = document.createElement('canvas');
    canvasMini.width = Math.round(ancho * factorMini);
    canvasMini.height = Math.round(alto * factorMini);
    canvasMini.getContext('2d').drawImage(canvas, 0, 0, canvasMini.width, canvasMini.height);

    let elementosMini = [];
    try {
      const resultMini = await TextRec.processImage({ path: canvasMini.toDataURL('image/jpeg', 0.9) });
      elementosMini = extraerElementos(resultMini);
    } catch (e) {
      // Si falla la miniatura, hacemos OCR directo sobre la imagen original
      const canvasOrig = document.createElement('canvas');
      canvasOrig.width = ancho;
      canvasOrig.height = alto;
      canvasOrig.getContext('2d').drawImage(canvas, 0, 0);
      return ocrDirecto(canvasOrig);
    }

    const filasMini = agruparEnFilas(elementosMini);
    if (filasMini.length === 0) {
      const canvasOrig = document.createElement('canvas');
      canvasOrig.width = ancho;
      canvasOrig.height = alto;
      canvasOrig.getContext('2d').drawImage(canvas, 0, 0);
      return ocrDirecto(canvasOrig);
    }

    // 2. Calcular franjas basadas en las filas reales
    const ALTO_OBJETIVO = 1500;
    const SOLAPE = 50;
    const franjas = [];
    let inicioFila = 0;
    let y0 = 0;

    for (let i = 0; i < filasMini.length; i++) {
      const filaRealY = filasMini[i][0].cy / factorMini;
      if (filaRealY - y0 > ALTO_OBJETIVO && i > inicioFila) {
        const filaAnteriorY = filasMini[i - 1][0].cy / factorMini;
        const altoFranja = Math.min(alto, filaAnteriorY + 30) - y0;
        franjas.push({ y0: Math.max(0, y0 - SOLAPE), alto: Math.min(alto, altoFranja + 2 * SOLAPE) });
        y0 = filaAnteriorY - 10;
        inicioFila = i;
      }
    }
    if (y0 < alto) franjas.push({ y0: Math.max(0, y0 - SOLAPE), alto: alto - y0 + SOLAPE });
    if (franjas.length === 0) franjas.push({ y0: 0, alto: alto });

    // 3. Procesar cada franja con upscale individual
    const todosElementos = [];
    const factorFinal = factorUpscale > 1 ? factorUpscale : 1;

    for (let i = 0; i < franjas.length; i++) {
      const f = franjas[i];
      
      // Recortar la franja de la imagen original
      const canvasFranja = document.createElement('canvas');
      canvasFranja.width = ancho;
      canvasFranja.height = f.alto;
      canvasFranja.getContext('2d').drawImage(canvas, 0, f.y0, ancho, f.alto, 0, 0, ancho, f.alto);

      let canvasFinal = canvasFranja;

      // Si hay texto chico, upscalear SOLO esta franja
      if (factorFinal > 1) {
        const canvasUp = document.createElement('canvas');
        canvasUp.width = Math.round(ancho * factorFinal);
        canvasUp.height = Math.round(f.alto * factorFinal);
        const ctxUp = canvasUp.getContext('2d');
        ctxUp.imageSmoothingEnabled = true;
        ctxUp.imageSmoothingQuality = 'high';
        ctxUp.drawImage(canvasFranja, 0, 0, canvasUp.width, canvasUp.height);
        canvasFinal = canvasUp;
      }

      try {
        const resultF = await TextRec.processImage({ path: canvasFinal.toDataURL('image/jpeg', 0.95) });
        // Extraer elementos y ajustar coordenadas:
        // 1. Dividir por factorFinal (porque la franja estaba escalada)
        // 2. Sumar f.y0 (porque la franja empieza más abajo)
        const elementosF = extraerElementos(resultF, f.y0, factorFinal);
        todosElementos.push.apply(todosElementos, elementosF);
      } catch (e) {
        console.warn('Falló franja ' + i + ': ' + e.message);
      }
    }

    return deduplicarElementos(todosElementos);
  }

  // Extrae elementos de un resultado de ML Kit, ajustando coordenadas
  // offsetY: desplazamiento vertical (si es franja)
  // factor: factor de upscale aplicado a la franja (default 1)
  function extraerElementos(result, offsetY, factor) {
    offsetY = offsetY || 0;
    factor = factor || 1;
    const elementos = [];
    if (!result || !result.blocks) return elementos;

    for (const block of result.blocks) {
      if (!block.lines) continue;
      for (const line of block.lines) {
        if (!line.elements) continue;
        for (const el of line.elements) {
          if (!el.boundingBox) continue;
          const bb = el.boundingBox;
          
          // Ajustar coordenadas:
          // 1. Dividir por factor (para volver a escala original)
          // 2. Sumar offsetY (para volver a posición original)
          const left = bb.left / factor;
          const right = bb.right / factor;
          const top = (bb.top / factor) + offsetY;
          const bottom = (bb.bottom / factor) + offsetY;
          
          elementos.push({
            text: el.text || '',
            absLeft: left,
            absRight: right,
            absTop: top,
            absBottom: bottom,
            cx: (left + right) / 2,
            cy: (top + bottom) / 2
          });
        }
      }
    }
    return elementos;
  }

  function agruparEnFilas(elementos) {
    if (elementos.length === 0) return [];
    
    let sumaAltura = 0;
    for (const el of elementos) sumaAltura += (el.absBottom - el.absTop);
    const alturaProm = sumaAltura / elementos.length;
    const umbralVertical = Math.max(25, alturaProm * 1.8);

    const ordenados = elementos.slice().sort(function(a, b) { return a.cy - b.cy; });
    const filas = [];
    let grupo = [ordenados[0]];
    let grupoY = ordenados[0].cy;

    for (let i = 1; i < ordenados.length; i++) {
      if (Math.abs(ordenados[i].cy - grupoY) < umbralVertical) {
        grupo.push(ordenados[i]);
        grupoY = grupo.reduce((s, e) => s + e.cy, 0) / grupo.length;
      } else {
        grupo.sort(function(a, b) { return a.absLeft - b.absLeft; });
        filas.push(grupo);
        grupo = [ordenados[i]];
        grupoY = ordenados[i].cy;
      }
    }
    if (grupo.length > 0) {
      grupo.sort(function(a, b) { return a.absLeft - b.absLeft; });
      filas.push(grupo);
    }
    return filas;
  }

  function deduplicarElementos(elementos) {
    const limpios = [];
    for (const el of elementos) {
      let dup = false;
      for (const d of limpios) {
        if (Math.abs(d.cx - el.cx) < 20 && Math.abs(d.cy - el.cy) < 20) {
          const sim = (typeof window.ocrSimilitud === 'function') ? window.ocrSimilitud(el.text, d.text) : (el.text === d.text ? 1 : 0);
          if (sim > 0.8) { dup = true; break; }
        }
      }
      if (!dup) limpios.push(el);
    }
    return limpios;
  }

  function organizarEnMatriz(elementos, ancho, alto) {
    const filas = agruparEnFilas(elementos);
    if (filas.length === 0) return { matriz: [], tipos: [], filas: [] };

    const gaps = [];
    for (const fila of filas) {
      if (fila.length < 2) continue;
      for (let i = 0; i < fila.length - 1; i++) {
        const gap = fila[i + 1].absLeft - fila[i].absRight;
        if (gap > 20) gaps.push((fila[i].absRight + fila[i + 1].absLeft) / 2);
      }
    }

    gaps.sort(function(a, b) { return a - b; });
    const columnas = [];
    let grupoGap = [];
    for (const g of gaps) {
      if (grupoGap.length === 0 || Math.abs(g - grupoGap[grupoGap.length - 1]) < 30) {
        grupoGap.push(g);
      } else {
        columnas.push(grupoGap.reduce(function(s, v) { return s + v; }, 0) / grupoGap.length);
        grupoGap = [g];
      }
    }
    if (grupoGap.length > 0) columnas.push(grupoGap.reduce(function(s, v) { return s + v; }, 0) / grupoGap.length);

    const matriz = [];
    for (const fila of filas) {
      const filaArr = new Array(Math.max(1, columnas.length + 1)).fill('');
      for (const el of fila) {
        let col = 0;
        for (let c = 0; c < columnas.length; c++) if (el.cx > columnas[c]) col = c + 1;
        filaArr[col] = (filaArr[col] ? filaArr[col] + ' ' : '') + el.text;
      }
      matriz.push(filaArr);
    }

    const tipos = [];
    for (let c = 0; c < (matriz[0] ? matriz[0].length : 0); c++) {
      const valores = matriz.map(function(f) { return f[c]; }).filter(function(v) { return v; });
      tipos.push(window.tipoDetectarColumna ? window.tipoDetectarColumna(valores) : { tipo: 'texto_libre' });
    }

    for (let f = 0; f < matriz.length; f++) {
      for (let c = 0; c < matriz[f].length; c++) {
        if (matriz[f][c] && tipos[c] && window.correctorAplicarPorTipo) {
          matriz[f][c] = window.correctorAplicarPorTipo(matriz[f][c], tipos[c]);
        }
      }
    }

    const matrizLimpia = matriz.filter(function(fila) {
      return fila.some(function(celda) { return celda && celda.trim().length > 0; });
    });

    return { matriz: matrizLimpia, tipos, filas };
  }

  async function ejecutarPipelineOCR(canvas, opciones) {
    opciones = opciones || {};
    const t0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();

    // 1. DOWNSCALE DEFENSIVO (max 1500px) para análisis inicial
    const MAX_LADO = 1500;
    if (canvas.width > MAX_LADO || canvas.height > MAX_LADO) {
      const factor = Math.min(MAX_LADO / canvas.width, MAX_LADO / canvas.height);
      const canvasDown = document.createElement('canvas');
      canvasDown.width = Math.round(canvas.width * factor);
      canvasDown.height = Math.round(canvas.height * factor);
      const ctxDown = canvasDown.getContext('2d');
      ctxDown.imageSmoothingEnabled = true;
      ctxDown.imageSmoothingQuality = 'high';
      ctxDown.drawImage(canvas, 0, 0, canvasDown.width, canvasDown.height);
      canvas = canvasDown;
    }

    const ancho = canvas.width;
    const alto = canvas.height;

    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, ancho, alto);
    const brillo = window.calcularBrillo(imageData);

    const diag = diagnosticarImagen(brillo, ancho, alto);
    const preproc = aplicarPreprocesamientoSelectivo(brillo, ancho, alto, diag.problemas);

    // Si se aplicaron filtros, convertir brillo de vuelta a canvas
    let canvasProcesado = canvas;
    if (preproc.aplicados.length > 0) {
      canvasProcesado = brilloACanvas(preproc.brillo, ancho, alto);
    }

    // 2. Calcular factor de upscale para franjas (si hay texto chico)
    let factorUpscale = 1;
    if (diag.problemas.indexOf('texto_chico') >= 0) {
      if (diag.metricas.tamTexto < 7) factorUpscale = 3;
      else factorUpscale = 2;
      preproc.aplicados.push('upscale_x' + factorUpscale + '_franjas');
    }

    // 3. Decidir modo de OCR
    const umbralFranjas = CONFIG.OCR_IMAGEN_UMBRAL_FRANJAS || 2048;
    let elementos;
    let modoOCR;

    if (ancho > umbralFranjas || alto > umbralFranjas || factorUpscale > 1) {
      modoOCR = 'franjas';
      elementos = await ocrPorFranjas(canvasProcesado, ancho, alto, diag.metricas.tamTexto, factorUpscale);
    } else {
      modoOCR = 'directo';
      elementos = await ocrDirecto(canvasProcesado);
    }

    // 4. Organizar en matriz
    const organizado = organizarEnMatriz(elementos, ancho, alto);

    // 5. Post-procesar el texto (diccionario + homóglifos)
    if (CONFIG.OCR_USAR_HOMOGLIFOS || CONFIG.OCR_USAR_DICCIONARIO) {
      for (let f = 0; f < organizado.matriz.length; f++) {
        for (let c = 0; c < organizado.matriz[f].length; c++) {
          if (organizado.matriz[f][c]) {
            organizado.matriz[f][c] = window.ocrPostProcesar(organizado.matriz[f][c], {
              usarDiccionario: CONFIG.OCR_USAR_DICCIONARIO,
              usarHomoglifos: CONFIG.OCR_USAR_HOMOGLIFOS
            });
          }
        }
      }
    }

    const t1 = (typeof performance !== 'undefined') ? performance.now() : Date.now();

    return {
      matriz: organizado.matriz,
      tipos: organizado.tipos,
      filas: organizado.filas,
      elementos: elementos,
      diagnosticos: diag,
      filtrosAplicados: preproc.aplicados,
      modoOCR: modoOCR,
      tiempo: t1 - t0
    };
  }

  window.diagnosticarImagen = diagnosticarImagen;
  window.aplicarPreprocesamientoSelectivo = aplicarPreprocesamientoSelectivo;
  window.ejecutarPipelineOCR = ejecutarPipelineOCR;

  console.log('[core] pipeline_ocr.js cargado');
})();
