// ==============================================
// core/pipeline_ocr.js
// Pipeline completo de OCR con diagnóstico selectivo.
// 1. Diagnostica la imagen (qué problemas tiene)
// 2. Aplica solo los filtros necesarios
// 3. Hace OCR con ML Kit (directo o por franjas)
// 4. Post-procesa el texto (homóglifos + diccionario)
// 5. Devuelve matriz organizada por filas/columnas
// Depende de: config.js, brillo.js, metricas_imagen.js,
//             analisis_texto.js, restauracion.js, nitidez.js,
//             ocr_post.js, ocr_tipos_columnas.js, ocr_corrector_tipos.js
// ==============================================

(function() {
  'use strict';

  // ----------------------------------------------
  // DIAGNÓSTICO: detecta qué problemas tiene la imagen
  // ----------------------------------------------
  function diagnosticarImagen(brillo, ancho, alto) {
    const problemas = [];
    const metricas = {};

    // 1. Iluminación desigual
    metricas.iluminacion = window.metricaIluminacionDesigual(brillo, ancho, alto);
    if (metricas.iluminacion > CONFIG.DIAG_UMBRAL_ILUMINACION) {
      problemas.push('iluminacion');
    }

    // 2. Desenfoque
    metricas.nitidez = window.metricaNitidez(brillo, ancho, alto);
    if (metricas.nitidez < CONFIG.DIAG_UMBRAL_NITIDEZ) {
      problemas.push('desenfoque');
    }

    // 3. Ruido
    metricas.ruido = window.metricaRuido(brillo, ancho, alto);
    if (metricas.ruido > CONFIG.DIAG_UMBRAL_RUIDO) {
      problemas.push('ruido');
    }

    // 4. Bajo contraste
    metricas.contraste = window.metricaContrasteRMS(brillo, ancho, alto);
    if (metricas.contraste < CONFIG.DIAG_UMBRAL_CONTRASTE) {
      problemas.push('contraste');
    }

    // 5. Texto chico
    const est = window.estimarTamanoTexto(brillo, ancho, alto);
    metricas.tamTexto = est.tamTexto;
    if (est.tamTexto < CONFIG.DIAG_UMBRAL_TEXTO_CHICO && est.tamTexto < 999) {
      problemas.push('texto_chico');
    }

    return { problemas, metricas };
  }

  // ----------------------------------------------
  // PREPROCESAMIENTO SELECTIVO: solo aplica lo necesario
  // ----------------------------------------------
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

  // ----------------------------------------------
  // OCR DIRECTO: imagen completa, sin cortes
  // ----------------------------------------------
  async function ocrDirecto(canvas) {
    const TextRec = Capacitor.Plugins.TextRecognition;
    if (!TextRec) throw new Error('TextRecognition no disponible');

    const dataURL = canvas.toDataURL('image/jpeg', 0.95);
    const result = await TextRec.processImage({
      path: dataURL

    });

    return extraerElementos(result);
  }

  // ----------------------------------------------
  // OCR POR FRANJAS HORIZONTALES: para imágenes muy altas
  // Primera pasada sobre miniatura para detectar filas de texto,
  // luego OCR por franjas que respetan esas filas.
  // ----------------------------------------------
  async function ocrPorFranjas(canvas, ancho, alto) {
    const TextRec = Capacitor.Plugins.TextRecognition;
    if (!TextRec) throw new Error('TextRecognition no disponible');

    // 1. Primera pasada sobre miniatura para detectar filas
    const maxAltoMini = 800;
    const factorMini = Math.min(1, maxAltoMini / alto);
    const anchoMini = Math.round(ancho * factorMini);
    const altoMini = Math.round(alto * factorMini);

    const canvasMini = document.createElement('canvas');
    canvasMini.width = anchoMini;
    canvasMini.height = altoMini;
    const ctxMini = canvasMini.getContext('2d');
    ctxMini.drawImage(canvas, 0, 0, anchoMini, altoMini);

    const dataURLMini = canvasMini.toDataURL('image/jpeg', 0.9);
    let elementosMini = [];
    try {
      const resultMini = await TextRec.processImage({ path: dataURLMini });
      elementosMini = extraerElementos(resultMini);
    } catch (e) {
      // Si falla la miniatura, caemos a OCR directo
      return ocrDirecto(canvas);
    }

    // 2. Agrupar elementos de la miniatura en filas por Y
    const filasMini = agruparEnFilas(elementosMini);
    if (filasMini.length === 0) {
      return ocrDirecto(canvas);
    }

    // 3. Calcular franjas que respetan las filas
    const franjas = calcularFranjas(filasMini, alto, factorMini);

    // 4. OCR por cada franja
    const todosElementos = [];
    for (let i = 0; i < franjas.length; i++) {
      const f = franjas[i];
      const canvasFranja = document.createElement('canvas');
      canvasFranja.width = ancho;
      canvasFranja.height = f.alto;
      const ctxF = canvasFranja.getContext('2d');
      ctxF.drawImage(canvas, 0, f.y0, ancho, f.alto, 0, 0, ancho, f.alto);

      const dataURLF = canvasFranja.toDataURL('image/jpeg', 0.95);
      try {
        const resultF = await TextRec.processImage({ path: dataURLF });
        const elementosF = extraerElementos(resultF, f.y0);
        todosElementos.push.apply(todosElementos, elementosF);
      } catch (e) {
        // Franja falló, seguir con la siguiente
      }
    }

    // 5. Deduplicar entre franjas (solape)
    return deduplicarElementos(todosElementos);
  }

  // ----------------------------------------------
  // Extrae elementos de un resultado de ML Kit
  // offsetY: desplazamiento vertical si es una franja
  // ----------------------------------------------
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

  // ----------------------------------------------
  // Agrupa elementos en filas por proximidad de CY
  // ----------------------------------------------
  function agruparEnFilas(elementos) {
    if (elementos.length === 0) return [];
    const ordenados = elementos.slice().sort(function(a, b) { return a.cy - b.cy; });
    const filas = [];
    let grupo = [ordenados[0]];
    let grupoY = ordenados[0].cy;

    for (let i = 1; i < ordenados.length; i++) {
      if (Math.abs(ordenados[i].cy - grupoY) < 30) {
        grupo.push(ordenados[i]);
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

  // ----------------------------------------------
  // Calcula franjas horizontales que respetan las filas
  // ----------------------------------------------
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
        // Cerrar franja en la fila anterior
        const filaAnteriorY = filasMini[i - 1][0].cy / factorMini;
        const altoFranja = Math.min(altoReal, filaAnteriorY + 30) - y0;
        franjas.push({ y0: Math.max(0, y0 - SOLAPE), alto: Math.min(altoReal, altoFranja + 2 * SOLAPE) });
        y0 = filaAnteriorY - 10;
        inicioFila = i;
      }
    }

    // Última franja
    if (y0 < altoReal) {
      franjas.push({ y0: Math.max(0, y0 - SOLAPE), alto: altoReal - y0 + SOLAPE });
    }

    // Si no se generó ninguna, una sola franja
    if (franjas.length === 0) {
      franjas.push({ y0: 0, alto: altoReal });
    }

    return franjas;
  }

  // ----------------------------------------------
  // Deduplica elementos que aparecen en franjas con solape
  // (misma posición + texto similar)
  // ----------------------------------------------
  function deduplicarElementos(elementos) {
    const limpios = [];
    for (const el of elementos) {
      let dup = false;
      for (const d of limpios) {
        if (Math.abs(d.cx - el.cx) < 20 && Math.abs(d.cy - el.cy) < 20) {
          // Si el texto es similar, es el mismo elemento
          const sim = (typeof window.ocrSimilitud === 'function')
            ? window.ocrSimilitud(el.text, d.text)
            : (el.text === d.text ? 1 : 0);
          if (sim > 0.8) { dup = true; break; }
        }
      }
      if (!dup) limpios.push(el);
    }
    return limpios;
  }

  // ----------------------------------------------
  // Organiza elementos en matriz (filas × columnas)
  // Infiere columnas por gaps entre elementos
  // ----------------------------------------------
  function organizarEnMatriz(elementos, ancho, alto) {
    const filas = agruparEnFilas(elementos);
    if (filas.length === 0) return { matriz: [], tipos: [], filas: [] };

    // Inferir columnas por gaps entre elementos de cada fila
    const gaps = [];
    for (const fila of filas) {
      if (fila.length < 2) continue;
      for (let i = 0; i < fila.length - 1; i++) {
        const gap = fila[i + 1].absLeft - fila[i].absRight;
        if (gap > 20) {
          gaps.push((fila[i].absRight + fila[i + 1].absLeft) / 2);
        }
      }
    }

    // Clusterizar gaps
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
    if (grupoGap.length > 0) {
      columnas.push(grupoGap.reduce(function(s, v) { return s + v; }, 0) / grupoGap.length);
    }

    // Construir matriz
    const matriz = [];
    for (const fila of filas) {
      const filaArr = new Array(Math.max(1, columnas.length + 1)).fill('');
      for (const el of fila) {
        let col = 0;
        for (let c = 0; c < columnas.length; c++) {
          if (el.cx > columnas[c]) col = c + 1;
        }
        filaArr[col] = (filaArr[col] ? filaArr[col] + ' ' : '') + el.text;
      }
      matriz.push(filaArr);
    }

    // Detectar tipos de columna
    const tipos = [];
    for (let c = 0; c < (matriz[0] ? matriz[0].length : 0); c++) {
      const valores = matriz.map(function(f) { return f[c]; }).filter(function(v) { return v; });
      tipos.push(window.tipoDetectarColumna ? window.tipoDetectarColumna(valores) : { tipo: 'texto_libre' });
    }

    // Aplicar corrector por tipo
    for (let f = 0; f < matriz.length; f++) {
      for (let c = 0; c < matriz[f].length; c++) {
        if (matriz[f][c] && tipos[c] && window.correctorAplicarPorTipo) {
          matriz[f][c] = window.correctorAplicarPorTipo(matriz[f][c], tipos[c]);
        }
      }
    }

    return { matriz, tipos, filas };
  }

  // ----------------------------------------------
  // PIPELINE PRINCIPAL
  // ----------------------------------------------
  async function ejecutarPipelineOCR(canvas, opciones) {
    opciones = opciones || {};
    const t0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();

    const ancho = canvas.width;
    const alto = canvas.height;

    // 1. Calcular brillo
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, ancho, alto);
    const brillo = window.calcularBrillo(imageData);

    // 2. Diagnosticar
    const diag = diagnosticarImagen(brillo, ancho, alto);

    // 3. Preprocesar selectivamente
    const preproc = aplicarPreprocesamientoSelectivo(brillo, ancho, alto, diag.problemas);

    // 4. Convertir brillo procesado de vuelta a canvas (si se aplicó algo)
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

    // 5. OCR: directo o por franjas según altura
    const umbralFranjas = CONFIG.OCR_IMAGEN_UMBRAL_FRANJAS || 2048;
    let elementos;
    let modoOCR;

    if (alto > umbralFranjas) {
      modoOCR = 'franjas';
      elementos = await ocrPorFranjas(canvasProcesado, ancho, alto);
    } else {
      modoOCR = 'directo';
      elementos = await ocrDirecto(canvasProcesado);
    }

    // 6. Organizar en matriz
    const organizado = organizarEnMatriz(elementos, ancho, alto);

    // 7. Post-procesar el texto
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

  // ----------------------------------------------
  // Exportar
  // ----------------------------------------------
  window.diagnosticarImagen = diagnosticarImagen;
  window.aplicarPreprocesamientoSelectivo = aplicarPreprocesamientoSelectivo;
  window.ejecutarPipelineOCR = ejecutarPipelineOCR;

  console.log('[core] pipeline_ocr.js cargado');
})();
