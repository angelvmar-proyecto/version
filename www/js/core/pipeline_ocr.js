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
      aplicados.push('contrast_stretch');
    }

    return { brillo: resultado, aplicados };
  }

  async function ocrDirecto(canvas) {
    const TextRec = Capacitor.Plugins.TextRecognition;
    if (!TextRec) throw new Error('TextRecognition no disponible');
    const dataURL = canvas.toDataURL('image/jpeg', 0.95);
    const result = await TextRec.processImage({ path: dataURL });
    return extraerElementos(result);
  }

  async function ocrPorFranjas(canvas, ancho, alto) {
    const TextRec = Capacitor.Plugins.TextRecognition;
    if (!TextRec) throw new Error('TextRecognition no disponible');

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
      return ocrDirecto(canvas);
    }

    const filasMini = agruparEnFilas(elementosMini);
    if (filasMini.length === 0) return ocrDirecto(canvas);

    const franjas = calcularFranjas(filasMini, alto, factorMini);
    const todosElementos = [];

    for (let i = 0; i < franjas.length; i++) {
      const f = franjas[i];
      const canvasFranja = document.createElement('canvas');
      canvasFranja.width = ancho;
      canvasFranja.height = f.alto;
      canvasFranja.getContext('2d').drawImage(canvas, 0, f.y0, ancho, f.alto, 0, 0, ancho, f.alto);

      try {
        const resultF = await TextRec.processImage({ path: canvasFranja.toDataURL('image/jpeg', 0.95) });
        const elementosF = extraerElementos(resultF, f.y0);
        todosElementos.push.apply(todosElementos, elementosF);
      } catch (e) {}
    }

    return deduplicarElementos(todosElementos);
  }

  function extraerElementos(result, offsetY) {
    offsetY = offsetY || 0;
    const elementos = [];
    if (!result || !result.blocks) return elementos;

    for (const block of result.blocks) {
      if (!block.lines) continue;
      for (const line of block.lines) {
        if (!line.elements) continue;
        for (const el of line.elements) {
          if (!el.boundingBox) continue;
          const bb = el.boundingBox;
          elementos.push({
            text: el.text || '',
            absLeft: bb.left,
            absRight: bb.right,
            absTop: bb.top + offsetY,
            absBottom: bb.bottom + offsetY,
            cx: (bb.left + bb.right) / 2,
            cy: ((bb.top + bb.bottom) / 2) + offsetY
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

  function calcularFranjas(filasMini, altoReal, factorMini) {
    const ALTO_OBJETIVO = CONFIG.OCR_FRANJA_ALTO_OBJETIVO || 1500;
    const SOLAPE = CONFIG.OCR_FRANJA_SOLAPE || 50;
    const franjas = [];
    let inicioFila = 0;
    let y0 = 0;

    for (let i = 0; i < filasMini.length; i++) {
      const filaRealY = filasMini[i][0].cy / factorMini;
      const altoHastaAqui = filaRealY - y0;

      if (altoHastaAqui > ALTO_OBJETIVO && i > inicioFila) {
        const filaAnteriorY = filasMini[i - 1][0].cy / factorMini;
        const altoFranja = Math.min(altoReal, filaAnteriorY + 30) - y0;
        franjas.push({ y0: Math.max(0, y0 - SOLAPE), alto: Math.min(altoReal, altoFranja + 2 * SOLAPE) });
        y0 = filaAnteriorY - 10;
        inicioFila = i;
      }
    }

    if (y0 < altoReal) franjas.push({ y0: Math.max(0, y0 - SOLAPE), alto: altoReal - y0 + SOLAPE });
    if (franjas.length === 0) franjas.push({ y0: 0, alto: altoReal });

    return franjas;
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

  function organizarEnMatriz(elementos, ancho, alto, upscaleFactor) {
    upscaleFactor = upscaleFactor || 1;

    // Ajustar coordenadas si hubo upscale
    if (upscaleFactor > 1) {
      for (const el of elementos) {
        el.absLeft /= upscaleFactor;
        el.absRight /= upscaleFactor;
        el.absTop /= upscaleFactor;
        el.absBottom /= upscaleFactor;
        el.cx /= upscaleFactor;
        el.cy /= upscaleFactor;
      }
    }

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

    // 1. DOWNSCALE DEFENSIVO (max 1500px)
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

    let canvasProcesado = canvas;
    if (preproc.aplicados.length > 0) {
      canvasProcesado = document.createElement('canvas');
      canvasProcesado.width = ancho;
      canvasProcesado.height = alto;
      const ctxProc = canvasProcesado.getContext('2d');
      const imgDataProc = ctxProc.createImageData(ancho, alto);
      for (let y = 0; y < alto; y++) {
        for (let x = 0; x < ancho; x++) {
          const v = Math.max(0, Math.min(255, preproc.brillo[y][x]));
          const idx = (y * ancho + x) * 4;
          imgDataProc.data[idx] = v;
          imgDataProc.data[idx + 1] = v;
          imgDataProc.data[idx + 2] = v;
          imgDataProc.data[idx + 3] = 255;
        }
      }
      ctxProc.putImageData(imgDataProc, 0, 0);
    }

    // 2. UPSCALE SELECTIVO (si texto chico)
    let upscaleFactor = 1;
    if (diag.problemas.indexOf('texto_chico') >= 0) {
      let factor = 2;
      if (diag.metricas.tamTexto < 7) factor = 3;
      
      const canvasUp = document.createElement('canvas');
      canvasUp.width = Math.round(ancho * factor);
      canvasUp.height = Math.round(alto * factor);
      const ctxUp = canvasUp.getContext('2d');
      ctxUp.imageSmoothingEnabled = true;
      ctxUp.imageSmoothingQuality = 'high';
      ctxUp.drawImage(canvasProcesado, 0, 0, canvasUp.width, canvasUp.height);
      
      canvasProcesado = canvasUp;
      upscaleFactor = factor;
      preproc.aplicados.push('upscale_x' + factor);
    }

    const umbralFranjas = CONFIG.OCR_IMAGEN_UMBRAL_FRANJAS || 2048;
    let elementos;
    let modoOCR;

    if (canvasProcesado.height > umbralFranjas) {
      modoOCR = 'franjas';
      elementos = await ocrPorFranjas(canvasProcesado, canvasProcesado.width, canvasProcesado.height);
    } else {
      modoOCR = 'directo';
      elementos = await ocrDirecto(canvasProcesado);
    }

    const organizado = organizarEnMatriz(elementos, ancho, alto, upscaleFactor);

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
