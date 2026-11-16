// ==============================================
// core/pipeline_ocr.js
// Pipeline completo con gestión de archivos temporales (Offloading).
// Versión restaurada (leía bien) + logs + guardia de memoria unificado.
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
    const MAX_PX_ROT = 8000000;

    for (let i = 0; i < franjas.length; i++) {
      const f = franjas[i];

      // --- BOUNDING BOX REAL + FACTOR UNICO POR FRANJA (peor caso de los 3 angulos) ---
      const radMax = 3 * Math.PI / 180;
      const bbMaxAncho = ancho * Math.cos(radMax) + f.alto * Math.sin(radMax);
      const bbMaxAlto  = ancho * Math.sin(radMax) + f.alto * Math.cos(radMax);

      let factorRot = factorFinal;
      const pxConUpscale = (bbMaxAncho * factorRot) * (bbMaxAlto * factorRot);
      if (pxConUpscale > MAX_PX_ROT) {
        factorRot = Math.sqrt(MAX_PX_ROT / (bbMaxAncho * bbMaxAlto));
        console.log('[DIAG-MEM] franja ' + i + ': factorRot unico bajado ' + factorFinal + ' -> ' + factorRot.toFixed(2) + ' (bbMax=' + bbMaxAncho.toFixed(0) + 'x' + bbMaxAlto.toFixed(0) + ')');
      } else {
        console.log('[DIAG-MEM] franja ' + i + ': factorRot unico ' + factorRot.toFixed(2) + ' (bbMax=' + bbMaxAncho.toFixed(0) + 'x' + bbMaxAlto.toFixed(0) + ')');
      }
      if (factorRot < 1) {
        console.warn('[DIAG-MEM] franja ' + i + ': factorRot < 1 (' + factorRot.toFixed(2) + '). La imagen se reducira.');
      }

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
        const rad = Math.abs(angulo) * Math.PI / 180;
        const bbAncho = ancho * Math.cos(rad) + f.alto * Math.sin(rad);
        const bbAlto  = ancho * Math.sin(rad) + f.alto * Math.cos(rad);

        const canvasRot = document.createElement('canvas');
        canvasRot.width  = Math.max(1, Math.round(bbAncho * factorRot));
        canvasRot.height = Math.max(1, Math.round(bbAlto  * factorRot));

        console.log('[DIAG-MEM] franja ' + i + '/' + franjas.length + ' ang ' + angulo + ' canvasRot=' + canvasRot.width + 'x' + canvasRot.height + ' (' + ((canvasRot.width * canvasRot.height) / 1e6).toFixed(2) + ' MPx) factor=' + factorRot.toFixed(2));

        const ctxRot = canvasRot.getContext('2d');
        ctxRot.imageSmoothingEnabled = true;
        ctxRot.imageSmoothingQuality = 'high';

        const imgFranja = new Image();
        imgFranja.src = 'data:image/jpeg;base64,' + franjaBase64;
        await new Promise(r => imgFranja.onload = r);

        ctxRot.translate(canvasRot.width / 2, canvasRot.height / 2);
        ctxRot.rotate(angulo * Math.PI / 180);
        ctxRot.scale(factorRot, factorRot);
        ctxRot.drawImage(imgFranja, -ancho / 2, -f.alto / 2);

        const rotBase64 = canvasRot.toDataURL('image/jpeg', 0.95).split(',')[1];
        const nombreRot = 'franja_' + i + '_rot_' + angulo + '.jpg';
        await FS.writeFile({ path: nombreRot, data: rotBase64, directory: 'CACHE' });
        canvasRot.width = 0;
        canvasRot.height = 0;

        try {
          const uri = await FS.getUri({ path: nombreRot, directory: 'CACHE' });
          const result = await TextRec.processImage({ path: uri.uri });
          const diagLado = Math.max(Math.round(bbAncho * factorRot), Math.round(bbAlto * factorRot));
          const elementos = extraerElementosRotados(result, f.y0, factorRot, angulo, ancho, f.alto, canvasRot.width, canvasRot.height);
          lecturasFranja.push({ angulo: angulo, elementos: elementos });
          console.log('[EXP-FRANJA] franja ' + i + ' ang ' + angulo + ' -> ' + elementos.length + ' elementos');
        } catch (e) {
          console.warn('Fallo angulo ' + angulo + ' en franja ' + i + ': ' + (e && e.message ? e.message : e));
        } finally {
          canvasRot.width = 0;
          canvasRot.height = 0;
          try { await FS.deleteFile({ path: nombreRot, directory: 'CACHE' }); } catch (e) {}
        }
      }

      try { await FS.deleteFile({ path: nombreBase, directory: 'CACHE' }); } catch (e) {}

      const elementosVotados = votarElementos(lecturasFranja);
      const totalLecturas = lecturasFranja.reduce(function(s, l) { return s + l.elementos.length; }, 0);
      console.log('[EXP-VOTO] franja ' + i + ': totalLecturas=' + totalLecturas + ' salida=' + elementosVotados.length);
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

  function extraerElementosRotados(result, offsetY, factor, angulo, anchoOrig, altoOrig, anchoCanvas, altoCanvas) {
    const elementos = [];
    if (!result || !result.blocks) return elementos;
    const rad = angulo * Math.PI / 180;
    const cos = Math.cos(-rad), sin = Math.sin(-rad);

    // Centro real del canvas rotado (puede ser rectangular)
    const centroX = anchoCanvas / 2;
    const centroY = altoCanvas / 2;

    for (const block of result.blocks) {
      if (!block.lines) continue;
      for (const line of block.lines) {
        if (!line.elements) continue;
        for (const el of line.elements) {
          if (!el.boundingBox) continue;
          const bb = el.boundingBox;

          // Coordenadas en el canvas rotado, relativas al centro real
          const cxRot = ((bb.left + bb.right) / 2) - centroX;
          const cyRot = ((bb.top + bb.bottom) / 2) - centroY;

          // Des-rotar para volver al espacio de la franja original
          const cxFranja = (cxRot * cos - cyRot * sin) + anchoOrig / 2;
          const cyFranja = (cxRot * sin + cyRot * cos) + altoOrig / 2;

          // Volver a escala original (el canvas estaba escalado por factor)
          const w = (bb.right - bb.left) / factor;
          const h = (bb.bottom - bb.top) / factor;

          const left = cxFranja / factor - (w / 2);
          const right = left + w;
          const top = cyFranja / factor + offsetY - (h / 2);
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

  function agruparEnFilas(elementos) {
    if (elementos.length === 0) return [];
    let sumaAltura = 0;
    for (const el of elementos) sumaAltura += (el.absBottom - el.absTop);
    const alturaProm = sumaAltura / elementos.length;
    const umbralVertical = Math.max(25, alturaProm * 1.8);

    const ordenados = elementos.slice().sort(function(a, b) { return a.cy - b.cy; });
    const filas = [];
    let grupo = [ordenados[0]], grupoY = ordenados[0].cy;

    for (let i = 1; i < ordenados.length; i++) {
      if (Math.abs(ordenados[i].cy - grupoY) < umbralVertical) {
        grupo.push(ordenados[i]);
        grupoY = grupo.reduce((s, e) => s + e.cy, 0) / grupo.length;
      } else {
        grupo.sort(function(a, b) { return a.absLeft - b.absLeft; });
        filas.push(grupo);
        grupo = [ordenados[i]]; grupoY = ordenados[i].cy;
      }
    }
    if (grupo.length > 0) {
      grupo.sort(function(a, b) { return a.absLeft - b.absLeft; });
      filas.push(grupo);
    }

    console.log('[DIAG-FILAS] Altura promedio: ' + alturaProm.toFixed(1) + 'px, Umbral: ' + umbralVertical.toFixed(1) + 'px');
    console.log('[DIAG-FILAS] Filas detectadas: ' + filas.length);
    for (let i = 0; i < filas.length; i++) {
      if (filas[i].length > 15) {
        console.warn('[DIAG-FILAS] ALERTA: Fila ' + (i + 1) + ' tiene ' + filas[i].length + ' palabras (posible fusión)');
      }
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

    console.log('[DIAG-COLS] gaps: ' + gaps.length + ', columnas: ' + columnas.length);

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

    const forzarDirecto = (typeof window !== 'undefined' && window.__EXPERIMENTO_DIRECTO === true);
    console.log('[EXP] Imagen ' + ancho + 'x' + alto + ' | texto_chico=' + (diag.problemas.indexOf('texto_chico') >= 0) + ' | tamTexto=' + (diag.metricas.tamTexto ? diag.metricas.tamTexto.toFixed(1) : 'n/a') + ' | factorUpscale=' + factorUpscale + ' | forzarDirecto=' + forzarDirecto);

    if (forzarDirecto) {
      modoOCR = 'directo_forzado';
      console.log('[EXP] Forzando modo DIRECTO');
      elementos = await ocrDirecto(canvasProcesado);
    } else if (ancho > umbralFranjas || alto > umbralFranjas || factorUpscale > 1) {
      modoOCR = 'franjas_perspectivas_disco';
      elementos = await ocrPorFranjas(canvasProcesado, ancho, alto, diag.metricas.tamTexto, factorUpscale);
    } else {
      modoOCR = 'directo';
      elementos = await ocrDirecto(canvasProcesado);
    }

    console.log('[EXP] Modo: ' + modoOCR + ' | elementos: ' + (elementos ? elementos.length : 0));

    notificar('Organizando matriz...', 85);
    const organizado = organizarEnMatriz(elementos, ancho, alto);
    console.log('[EXP] Matriz: ' + (organizado.matriz ? organizado.matriz.length : 0) + ' filas x ' + (organizado.matriz && organizado.matriz[0] ? organizado.matriz[0].length : 0) + ' cols');

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

  console.log('[core] pipeline_ocr.js cargado (version restaurada + logs + guardia memoria unificado)');
})();
