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
    const MAX_PX_ROT = 8000000; // presupuesto: ~32 MB RGBA por canvas rotado

    for (let i = 0; i < franjas.length; i++) {
      const f = franjas[i];

      // --- FACTOR UNICO POR FRANJA (peor caso de los 3 angulos) ---
      let bbMaxAncho = 0, bbMaxAlto = 0;
      for (const angulo of angulos) {
        const rad = Math.abs(angulo) * Math.PI / 180;
        const bbA = ancho * Math.cos(rad) + f.alto * Math.sin(rad);
        const bbH = ancho * Math.sin(rad) + f.alto * Math.cos(rad);
        if (bbA > bbMaxAncho) bbMaxAncho = bbA;
        if (bbH > bbMaxAlto) bbMaxAlto = bbH;
      }
      let factorRot = factorFinal;
      const pxConUpscale = (bbMaxAncho * factorRot) * (bbMaxAlto * factorRot);
      if (pxConUpscale > MAX_PX_ROT) {
        factorRot = Math.sqrt(MAX_PX_ROT / (bbMaxAncho * bbMaxAlto));
        console.log('[DIAG-MEM] franja ' + i + ': factorRot unico bajado ' + factorFinal + ' -> ' + factorRot.toFixed(2) + ' (peor caso ' + bbMaxAncho.toFixed(0) + 'x' + bbMaxAlto.toFixed(0) + ')');
      } else {
        console.log('[DIAG-MEM] franja ' + i + ': factorRot unico ' + factorRot.toFixed(2) + ' (peor caso ' + bbMaxAncho.toFixed(0) + 'x' + bbMaxAlto.toFixed(0) + ')');
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
          const elementos = extraerElementosRotados(result, f.y0, factorRot, angulo, ancho, f.alto, diagLado);
          lecturasFranja.push({ angulo: angulo, elementos: elementos });
          console.log('[EXP-FRANJA] franja ' + i + ' ang ' + angulo + ' -> ' + elementos.length + ' elementos');
        } catch (e) {
          console.warn('Fallo angulo ' + angulo + ' en franja ' + i + ': ' + (e && e.message ? e.message : e));
        } finally {
          try { await FS.deleteFile({ path: nombreRot, directory: 'CACHE' }); } catch (e) {}
        }
      }

      try { await FS.deleteFile({ path: nombreBase, directory: 'CACHE' }); } catch (e) {}

      const elementosVotados = votarElementos(lecturasFranja);
      console.log('[EXP-VOTO] franja ' + i + ': entradas=' + lecturasFranja.length + ' totalLecturas=' + lecturasFranja.reduce(function(s, l) { return s + l.elementos.length; }, 0) + ' salida=' + elementosVotados.length);
      todosElementos.push.apply(todosElementos, elementosVotados);
    }
    return deduplicarElementos(todosElementos);
  }

