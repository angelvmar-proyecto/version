// ==============================================
// core/pipeline_ocr.js
// Pipeline completo con diagnóstico de filas
// y corte por líneas virtuales basadas en texto.
// ==============================================

(function() {
  'use strict';

  let FS = null;

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
    
    let pixelesBrillantes = 0;
    for (let y = 0; y < alto; y += 4) {
      for (let x = 0; x < ancho; x += 4) {
        if (brillo[y][x] > 240) pixelesBrillantes++;
      }
    }
    const totalMuestreado = Math.ceil(alto / 4) * Math.ceil(ancho / 4);
    metricas.brillo = pixelesBrillantes / totalMuestreado;
    if (metricas.brillo > 0.02) problemas.push('brillo');
    return { problemas, metricas };
  }

  function aplicarFiltroConValidacion(brillo, ancho, alto, nombre, funcionFiltro, aplicados) {
    const metricaAntes = window.metricaNitidez(brillo, ancho, alto);
    const resultado = funcionFiltro(brillo);
    const metricaDespues = window.metricaNitidez(resultado, ancho, alto);
    if (metricaDespues >= metricaAntes * 1.05) {
      aplicados.push(nombre + ' (mejora: ' + (metricaDespues - metricaAntes).toFixed(1) + ')');
      return resultado;
    } else {
      aplicados.push(nombre + ' DESCARTADO (empeoró)');
      return brillo;
    }
  }

  function aplicarPreprocesamientoSelectivo(brillo, ancho, alto, problemas) {
    let resultado = brillo;
    const aplicados = [];
    if (problemas.indexOf('brillo') >= 0) {
      resultado = aplicarFiltroConValidacion(resultado, ancho, alto, 'quitar_brillos',
        function(b) { return window.restaurarQuitarBrillos(b, ancho, alto); }, aplicados);
    }
    if (problemas.indexOf('iluminacion') >= 0) {
      if (problemas.indexOf('contraste') >= 0) {
        resultado = aplicarFiltroConValidacion(resultado, ancho, alto, 'retinex',
          function(b) { return window.restaurarRetinex(b, ancho, alto); }, aplicados);
      } else {
        resultado = aplicarFiltroConValidacion(resultado, ancho, alto, 'flatten_iluminacion',
          function(b) { return window.restaurarFlattenIluminacion(b, ancho, alto); }, aplicados);
      }
    }
    if (problemas.indexOf('desenfoque') >= 0) {
      resultado = aplicarFiltroConValidacion(resultado, ancho, alto, 'richardson_lucy',
        function(b) { return window.nitRichardsonLucy(b, ancho, alto, 5, 1.0); }, aplicados);
    }
    if (problemas.indexOf('ruido') >= 0 && problemas.indexOf('texto_chico') < 0) {
      resultado = aplicarFiltroConValidacion(resultado, ancho, alto, 'mediana',
        function(b) { return window.restaurarMediana(b, ancho, alto, 1); }, aplicados);
    }
    if (problemas.indexOf('contraste') >= 0 && problemas.indexOf('iluminacion') < 0) {
      resultado = aplicarFiltroConValidacion(resultado, ancho, alto, 'contraste',
        function(b) { return window.restaurarContrast(b, ancho, alto, 5, 95); }, aplicados);
    }
    return { brillo: resultado, aplicados };
  }

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
        imgData.data[idx] = v; imgData.data[idx + 1] = v;
        imgData.data[idx + 2] = v; imgData.data[idx + 3] = 255;
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
    return extraerElementos(result, 0, 1);
  }

  async function ocrPorFranjas(canvas, ancho, alto, tamTexto, factorUpscale) {
    const TextRec = Capacitor.Plugins.TextRecognition;
    if (!TextRec) throw new Error('TextRecognition no disponible');
    if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.Filesystem) {
      FS = Capacitor.Plugins.Filesystem;
    } else {
      throw new Error('Filesystem plugin no disponible');
    }

    const ALTO_FRANJA = 600;
    const SOLAPE = 50;
    const numFranjas = Math.ceil(alto / ALTO_FRANJA);
    const franjas = [];

    for (let i = 0; i < numFranjas; i++) {
      let y0 = i * ALTO_FRANJA;
      let y1 = Math.min(alto, y0 + ALTO_FRANJA);
      if (i > 0) y0 = Math.max(0, y0 - SOLAPE);
      if (i < numFranjas - 1) y1 = Math.min(alto, y1 + SOLAPE);
      franjas.push({ y0: y0, alto: y1 - y0 });
    }

    const todosElementos = [];
    const factorFinal = factorUpscale > 1 ? factorUpscale : 1;
    const angulos = [0, -3, 3];

    for (let i = 0; i < franjas.length; i++) {
      const f = franjas[i];
      const canvasFranja = document.createElement('canvas');
      canvasFranja.width = ancho;
      canvasFranja.height = f.alto;
      canvasFranja.getContext('2d').drawImage(canvas, 0, f.y0, ancho, f.alto, 0, 0, ancho, f.alto);
      
      const franjaBase64 = canvasFranja.toDataURL('image/jpeg', 0.95).split(',')[1];
      const nombreBase = 'franja_' + i + '.jpg';
      await FS.writeFile({ path: nombreBase, data: franjaBase64, directory: 'CACHE' });
      canvasFranja.width = 0;
      canvasFranja.height = 0;

      const lecturasFranja = [];

      for (const angulo of angulos) {
        const diag = Math.ceil(Math.sqrt(ancho*ancho + f.alto*f.alto));
        const canvasRot = document.createElement('canvas');
        canvasRot.width = Math.round(diag * factorFinal);
        canvasRot.height = Math.round(diag * factorFinal);
        const ctxRot = canvasRot.getContext('2d');
        ctxRot.imageSmoothingEnabled = true;
        ctxRot.imageSmoothingQuality = 'high';
        
        const imgFranja = new Image();
        imgFranja.src = 'data:image/jpeg;base64,' + franjaBase64;
        await new Promise(r => imgFranja.onload = r);
        
        ctxRot.translate(canvasRot.width/2, canvasRot.height/2);
        ctxRot.rotate(angulo * Math.PI / 180);
        ctxRot.scale(factorFinal, factorFinal);
        ctxRot.drawImage(imgFranja, -ancho/2, -f.alto/2);
        
        const rotBase64 = canvasRot.toDataURL('image/jpeg', 0.95).split(',')[1];
        const nombreRot = 'franja_' + i + '_rot_' + angulo + '.jpg';
        await FS.writeFile({ path: nombreRot, data: rotBase64, directory: 'CACHE' });
        canvasRot.width = 0;
        canvasRot.height = 0;

        try {
          const uri = await FS.getUri({ path: nombreRot, directory: 'CACHE' });
          const result = await TextRec.processImage({ path: uri.uri });
          const elementos = extraerElementosRotados(result, f.y0, factorFinal, angulo, ancho, f.alto, diag);
          lecturasFranja.push({ angulo: angulo, elementos: elementos });
        } catch(e) {
          console.warn('Falló ángulo ' + angulo + ' en franja ' + i);
        } finally {
          try { await FS.deleteFile({ path: nombreRot, directory: 'CACHE' }); } catch(e) {}
        }
      }
      try { await FS.deleteFile({ path: nombreBase, directory: 'CACHE' }); } catch(e) {}

      const elementosVotados = votarElementos(lecturasFranja);
      todosElementos.push.apply(todosElementos, elementosVotados);
    }
    return deduplicarElementos(todosElementos);
  }

  function votarElementos(lecturas) {
    const votos = [];
    for (const lectura of lecturas) {
      for (const el of lectura.elementos) {
        let encontrado = false;
        for (const v of votos) {
          if (Math.abs(v.cx - el.cx) < 20 && Math.abs(v.cy - el.cy) < 20) {
            const sim = (typeof window.ocrSimilitud === 'function') ? window.ocrSimilitud(el.text, v.text) : (el.text === v.text ? 1 : 0);
            if (sim > 0.5) {
              v.contador++;
              if (el.text.length > v.text.length) v.text = el.text;
              encontrado = true;
              break;
            }
          }
        }
        if (!encontrado) votos.push({ ...el, contador: 1 });
      }
    }
    return votos.filter(v => v.contador >= 2);
  }

  function extraerElementos(result, offsetY, factor) {
    offsetY = offsetY || 0; factor = factor || 1;
    const elementos = [];
    if (!result || !result.blocks) return elementos;
    for (const block of result.blocks) {
      if (!block.lines) continue;
      for (const line of block.lines) {
        if (!line.elements) continue;
        for (const el of line.elements) {
          if (!el.boundingBox) continue;
          const bb = el.boundingBox;
          const left = bb.left / factor, right = bb.right / factor;
          const top = (bb.top / factor) + offsetY, bottom = (bb.bottom / factor) + offsetY;
          elementos.push({
            text: el.text || '', absLeft: left, absRight: right,
            absTop: top, absBottom: bottom, cx: (left + right) / 2, cy: (top + bottom) / 2
          });
        }
      }
    }
    return elementos;
  }

  function extraerElementosRotados(result, offsetY, factor, angulo, anchoOrig, altoOrig, diag) {
    const elementos = [];
    if (!result || !result.blocks) return elementos;
    const rad = angulo * Math.PI / 180;
    const cos = Math.cos(-rad), sin = Math.sin(-rad);

    for (const block of result.blocks) {
      if (!block.lines) continue;
      for (const line of block.lines) {
        if (!line.elements) continue;
        for (const el of line.elements) {
          if (!el.boundingBox) continue;
          const bb = el.boundingBox;
          const cxRot = ((bb.left + bb.right) / 2) - (diag * factor)/2;
          const cyRot = ((bb.top + bb.bottom) / 2) - (diag * factor)/2;
          const cxOrig = (cxRot * cos - cyRot * sin) + anchoOrig/2;
          const cyOrig = (cxRot * sin + cyRot * cos) + altoOrig/2;
          const w = (bb.right - bb.left) / factor;
          const h = (bb.bottom - bb.top) / factor;
          
          const left = (cxOrig / factor) - (w/2);
          const right = left + w;
          const top = (cyOrig / factor) + offsetY - (h/2);
          const bottom = top + h;

          elementos.push({
            text: el.text || '', absLeft: left, absRight: right,
            absTop: top, absBottom: bottom, cx: (left + right) / 2, cy: (top + bottom) / 2
          });
        }
      }
    }
    return elementos;
  }

  // --- NUEVA AGRUPACIÓN CON LOG Y CORTE POR LÍNEAS VIRTUALES ---
  function agruparEnFilas(elementos) {
    if (elementos.length === 0) return [];
    
    // Ordenar por Y
    const ordenados = elementos.slice().sort(function(a, b) { return a.cy - b.cy; });
    
    // Calcular altura promedio para el log
    let sumaAltura = 0;
    for (const el of ordenados) sumaAltura += (el.absBottom - el.absTop);
    const alturaProm = sumaAltura / ordenados.length;
    console.log('[DIAG] Total palabras: ' + ordenados.length + ', altura promedio: ' + alturaProm.toFixed(2) + 'px');

    const filas = [];
    let grupoActual = [ordenados[0]];
    
    // Log de la primera fila
    let topActual = ordenados[0].absTop;
    let bottomActual = ordenados[0].absBottom;

    for (let i = 1; i < ordenados.length; i++) {
      const el = ordenados[i];
      
      // Criterio de corte: Si hay un espacio vertical entre el grupo y el nuevo elemento
      // que sea mayor al 50% de la altura promedio, es una nueva fila.
      // (Ajusta este 0.5 si necesitas ser más o menos estricto).
      const umbralCorte = Math.max(10, alturaProm * 0.5);
      
      if (el.absTop > bottomActual + umbralCorte) {
        // Hay un hueco -> nueva fila
        grupoActual.sort(function(a, b) { return a.absLeft - b.absLeft; });
        filas.push(grupoActual);
        
        // Log de la fila cerrada
        if (grupoActual.length > 20) {
          console.log('[DIAG] Fila ' + filas.length + ' tiene ' + grupoActual.length + ' palabras (posible fusión).');
        }
        
        grupoActual = [el];
        topActual = el.absTop;
        bottomActual = el.absBottom;
      } else {
        // Misma fila (se solapan o están muy cerca)
        grupoActual.push(el);
        if (el.absTop < topActual) topActual = el.absTop;
        if (el.absBottom > bottomActual) bottomActual = el.absBottom;
      }
    }
    
    // Añadir la última
    if (grupoActual.length > 0) {
      grupoActual.sort(function(a, b) { return a.absLeft - b.absLeft; });
      filas.push(grupoActual);
      if (grupoActual.length > 20) {
         console.log('[DIAG] Fila ' + filas.length + ' tiene ' + grupoActual.length + ' palabras (posible fusión).');
      }
    }

    console.log('[DIAG] Filas detectadas por corte virtual: ' + filas.length);
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

    // Inferir columnas por bordes izquierdos repetidos
    const bordesX = [];
    for (const fila of filas) {
      for (const el of fila) {
        bordesX.push(el.absLeft);
      }
    }
    bordesX.sort(function(a, b) { return a - b; });

    const columnas = [];
    let grupoX = [bordesX[0]];
    for (let i = 1; i < bordesX.length; i++) {
      if (bordesX[i] - grupoX[grupoX.length - 1] < 30) {
        grupoX.push(bordesX[i]);
      } else {
        if (grupoX.length >= 2) columnas.push(grupoX.reduce(function(s, v) { return s + v; }, 0) / grupoX.length);
        grupoX = [bordesX[i]];
      }
    }
    if (grupoX.length >= 2) columnas.push(grupoX.reduce(function(s, v) { return s + v; }, 0) / grupoX.length);

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

  async function ejecutarPipelineOCR(canvas, opciones, onProgress) {
    opciones = opciones || {};
    const t0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();

    const notificar = function(msg, pct) {
      if (typeof onProgress === 'function') onProgress(msg, pct);
    };

    notificar('Iniciando...', 5);
    const ancho = canvas.width, alto = canvas.height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, ancho, alto);
    const brillo = window.calcularBrillo(imageData);
    
    notificar('Diagnosticando imagen...', 15);
    const diag = diagnosticarImagen(brillo, ancho, alto);
    
    notificar('Aplicando filtros (validando)...', 30);
    const preproc = aplicarPreprocesamientoSelectivo(brillo, ancho, alto, diag.problemas);

    let canvasProcesado = canvas;
    if (preproc.aplicados.some(function(a) { return a.indexOf('DESCARTADO') === -1; })) {
      canvasProcesado = brilloACanvas(preproc.brillo, ancho, alto);
    }

    let factorUpscale = 1;
    if (diag.problemas.indexOf('texto_chico') >= 0) {
      factorUpscale = (diag.metricas.tamTexto < 7) ? 3 : 2;
      preproc.aplicados.push('upscale_x' + factorUpscale);
    }

    notificar('Ejecutando OCR...', 50);
    const umbralFranjas = CONFIG.OCR_IMAGEN_UMBRAL_FRANJAS || 2048;
    let elementos, modoOCR;

    if (ancho > umbralFranjas || alto > umbralFranjas || factorUpscale > 1) {
      modoOCR = 'franjas_perspectivas_disco';
      elementos = await ocrPorFranjas(canvasProcesado, ancho, alto, diag.metricas.tamTexto, factorUpscale);
    } else {
      modoOCR = 'directo';
      elementos = await ocrDirecto(canvasProcesado);
    }

    notificar('Organizando matriz...', 85);
    const organizado = organizarEnMatriz(elementos, ancho, alto);

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

    notificar('Completado', 100);
    const t1 = (typeof performance !== 'undefined') ? performance.now() : Date.now();

    return {
      matriz: organizado.matriz, tipos: organizado.tipos, filas: organizado.filas,
      elementos: elementos, diagnosticos: diag, filtrosAplicados: preproc.aplicados,
      modoOCR: modoOCR, tiempo: t1 - t0
    };
  }

  window.diagnosticarImagen = diagnosticarImagen;
  window.aplicarPreprocesamientoSelectivo = aplicarPreprocesamientoSelectivo;
  window.ejecutarPipelineOCR = ejecutarPipelineOCR;

  console.log('[core] pipeline_ocr.js cargado (corte por líneas virtuales + log)');
})();
