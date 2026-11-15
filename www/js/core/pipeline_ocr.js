// ==============================================
// core/pipeline_ocr.js
// Pipeline completo de OCR.
// Sin downscale para no perder resolución en texto chico.
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

    // Detección rápida de brillos
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

  function aplicarPreprocesamientoSelectivo(brillo, ancho, alto, problemas) {
    let resultado = brillo;
    const aplicados = [];

    if (problemas.indexOf('brillo') >= 0) {
      resultado = window.restaurarQuitarBrillos(resultado, ancho, alto);
      aplicados.push('quitar_brillos');
    }
    if (problemas.indexOf('iluminacion') >= 0) {
      if (problemas.indexOf('contraste') >= 0) {
        resultado = window.restaurarRetinex(resultado, ancho, alto);
        aplicados.push('retinex');
      } else {
        resultado = window.restaurarFlattenIluminacion(resultado, ancho, alto);
        aplicados.push('flatten_iluminacion');
      }
    }
    if (problemas.indexOf('desenfoque') >= 0) {
      resultado = window.nitRichardsonLucy(resultado, ancho, alto, 5, 1.0);
      aplicados.push('richardson_lucy');
    }
    if (problemas.indexOf('ruido') >= 0) {
      resultado = window.restaurarMediana(resultado, ancho, alto, 1);
      aplicados.push('mediana');
    }
    if (problemas.indexOf('contraste') >= 0 && problemas.indexOf('iluminacion') < 0) {
      resultado = window.restaurarContrast(resultado, ancho, alto, 5, 95);
      aplicados.push('contraste');
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

  // --- FRANJAS CON MÚLTIPLES PERSPECTIVAS ---
  async function ocrPorFranjas(canvas, ancho, alto, tamTexto, factorUpscale) {
    const TextRec = Capacitor.Plugins.TextRecognition;
    if (!TextRec) throw new Error('TextRecognition no disponible');

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

      const lecturasFranja = [];

      for (const angulo of angulos) {
        const diag = Math.ceil(Math.sqrt(ancho*ancho + f.alto*f.alto));
        const canvasRot = document.createElement('canvas');
        canvasRot.width = Math.round(diag * factorFinal);
        canvasRot.height = Math.round(diag * factorFinal);
        const ctxRot = canvasRot.getContext('2d');
        
        ctxRot.imageSmoothingEnabled = true;
        ctxRot.imageSmoothingQuality = 'high';
        
        ctxRot.translate(canvasRot.width/2, canvasRot.height/2);
        ctxRot.rotate(angulo * Math.PI / 180);
        ctxRot.scale(factorFinal, factorFinal);
        ctxRot.drawImage(canvasFranja, -ancho/2, -f.alto/2);
        
        try {
          const result = await TextRec.processImage({ path: canvasRot.toDataURL('image/jpeg', 0.95) });
          const elementos = extraerElementosRotados(result, f.y0, factorFinal, angulo, ancho, f.alto, diag);
          lecturasFranja.push({ angulo: angulo, elementos: elementos });
        } catch(e) {
          console.warn('Falló ángulo ' + angulo + ' en franja ' + i);
        }
      }

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

    // SIN DOWNSCALE: trabajamos con la imagen original para no perder resolución
    const ancho = canvas.width, alto = canvas.height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, ancho, alto);
    const brillo = window.calcularBrillo(imageData);

    const diag = diagnosticarImagen(brillo, ancho, alto);
    const preproc = aplicarPreprocesamientoSelectivo(brillo, ancho, alto, diag.problemas);

    let canvasProcesado = canvas;
    if (preproc.aplicados.length > 0) {
      canvasProcesado = brilloACanvas(preproc.brillo, ancho, alto);
    }

    let factorUpscale = 1;
    if (diag.problemas.indexOf('texto_chico') >= 0) {
      factorUpscale = (diag.metricas.tamTexto < 7) ? 3 : 2;
      preproc.aplicados.push('upscale_x' + factorUpscale);
    }

    const umbralFranjas = CONFIG.OCR_IMAGEN_UMBRAL_FRANJAS || 2048;
    let elementos, modoOCR;

    // Siempre usamos franjas para no perder resolución en imágenes grandes o con texto chico
    if (ancho > umbralFranjas || alto > umbralFranjas || factorUpscale > 1) {
      modoOCR = 'franjas_perspectivas';
      elementos = await ocrPorFranjas(canvasProcesado, ancho, alto, diag.metricas.tamTexto, factorUpscale);
    } else {
      modoOCR = 'directo';
      elementos = await ocrDirecto(canvasProcesado);
    }

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

  console.log('[core] pipeline_ocr.js cargado (sin downscale)');
})();
