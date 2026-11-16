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
      console.log('[EXP] Forzando modo DIRECT0 (sin franjas, sin rotaciones, sin upscale)');
      elementos = await ocrDirecto(canvasProcesado);
    } else if (ancho > umbralFranjas || alto > umbralFranjas || factorUpscale > 1) {
      modoOCR = 'franjas_perspectivas_disco';
      elementos = await ocrPorFranjas(canvasProcesado, ancho, alto, diag.metricas.tamTexto, factorUpscale);
    } else {
      modoOCR = 'directo';
      elementos = await ocrDirecto(canvasProcesado);
    }

    console.log('[EXP] Modo: ' + modoOCR + ' | elementos devueltos por OCR: ' + (elementos ? elementos.length : 0));

    notificar('Organizando matriz...', 85);
    const organizado = organizarEnMatriz(elementos, ancho, alto);
    console.log('[EXP] Matriz: ' + (organizado.matriz ? organizado.matriz.length : 0) + ' filas x ' + (organizado.matriz && organizado.matriz[0] ? organizado.matriz[0].length : 0) + ' cols');
