// ==============================================
// core/superposicion.js
// Fusión de imágenes (papel albanene) + diagnóstico de líneas.
// ==============================================

(function() {
  'use strict';

  // 1. Fusiona dos canvas tomando el píxel más oscuro (mínimo)
  function fusionarCanvas(canvas1, canvas2) {
    const ctx1 = canvas1.getContext('2d');
    const ctx2 = canvas2.getContext('2d');
    const ancho = canvas1.width;
    const alto = canvas1.height;
    
    const data1 = ctx1.getImageData(0, 0, ancho, alto).data;
    const data2 = ctx2.getImageData(0, 0, ancho, alto).data;
    
    const canvasResult = document.createElement('canvas');
    canvasResult.width = ancho;
    canvasResult.height = alto;
    const ctxResult = canvasResult.getContext('2d');
    const imgDataResult = ctxResult.createImageData(ancho, alto);
    const dataR = imgDataResult.data;

    for (let i = 0; i < data1.length; i += 4) {
      // Tomar el mínimo de los 3 canales (el más oscuro)
      const r = Math.min(data1[i], data2[i]);
      const g = Math.min(data1[i+1], data2[i+1]);
      const b = Math.min(data1[i+2], data2[i+2]);
      dataR[i] = r;
      dataR[i+1] = g;
      dataR[i+2] = b;
      dataR[i+3] = 255;
    }
    
    ctxResult.putImageData(imgDataResult, 0, 0);
    return canvasResult;
  }

  // 2. Prueba los detectores en la imagen fusionada y elige el mejor
  function diagnosticarLineas(canvasFusionado) {
    const ctx = canvasFusionado.getContext('2d');
    const ancho = canvasFusionado.width;
    const alto = canvasFusionado.height;
    const imageData = ctx.getImageData(0, 0, ancho, alto);
    
    // Necesitamos el brillo para los detectores
    const brillo = window.calcularBrillo(imageData);
    
    const candidatos = [];
    
    // Probar A3 (Sobel)
    try {
      if (typeof window.detectarA3 === 'function') {
        const a3 = window.detectarA3(brillo, ancho, alto);
        candidatos.push({ nombre: 'A3', lineasH: a3.lineasH || [], lineasV: a3.lineasV || [] });
      }
    } catch(e) { console.warn('Falló A3:', e.message); }

    // Probar Morfológico
    try {
      if (typeof window.detectarMorfologico === 'function') {
        const morfo = window.detectarMorfologico(brillo, ancho, alto);
        candidatos.push({ nombre: 'Morfo', lineasH: morfo.lineasH || [], lineasV: morfo.lineasV || [] });
      }
    } catch(e) { console.warn('Falló Morfo:', e.message); }

    // Probar Hough
    try {
      if (typeof window.detectarHough === 'function') {
        const hough = window.detectarHough(brillo, ancho, alto);
        candidatos.push({ nombre: 'Hough', lineasH: hough.lineasH || [], lineasV: hough.lineasV || [] });
      }
    } catch(e) { console.warn('Falló Hough:', e.message); }

    // Elegir el mejor: el que tenga más líneas H y V sin que sea una locura (más de 100)
    let mejor = null;
    let mejorScore = -1;

    for (const c of candidatos) {
      const numH = c.lineasH.length;
      const numV = c.lineasV.length;
      // Queremos que tenga líneas, pero no miles (ruido)
      if (numH > 2 && numV > 2 && numH < 200 && numV < 100) {
        const score = numH + numV;
        if (score > mejorScore) {
          mejorScore = score;
          mejor = c;
        }
      }
    }

    if (mejor) {
      console.log('[SUPERPOSICION] Mejor detector: ' + mejor.nombre + ' (H=' + mejor.lineasH.length + ', V=' + mejor.lineasV.length + ')');
      return mejor;
    }
    
    console.warn('[SUPERPOSICION] Ningún detector dio líneas válidas. Usando fallback.');
    return null;
  }

  // 3. Función principal que orquesta todo
  async function obtenerLineasSuperpuestas(canvasOriginal) {
    // Crear las 3 rotaciones (0, -3, +3)
    const ancho = canvasOriginal.width;
    const alto = canvasOriginal.height;
    const diag = Math.ceil(Math.sqrt(ancho*ancho + alto*alto));
    
    const rotaciones = [];
    for (const angulo of [0, -3, 3]) {
      const canvasRot = document.createElement('canvas');
      canvasRot.width = diag;
      canvasRot.height = diag;
      const ctxRot = canvasRot.getContext('2d');
      
      ctxRot.translate(diag/2, diag/2);
      ctxRot.rotate(angulo * Math.PI / 180);
      ctxRot.drawImage(canvasOriginal, -ancho/2, -alto/2);
      
      rotaciones.push(canvasRot);
    }

    // Fusionar las 3 imágenes (papel albanene)
    let canvasFusionado = rotaciones[0];
    for (let i = 1; i < rotaciones.length; i++) {
      canvasFusionado = fusionarCanvas(canvasFusionado, rotaciones[i]);
    }
    
    // Liberar las rotaciones para no llenar la memoria
    for (const r of rotaciones) {
      r.width = 0;
      r.height = 0;
    }

    // Diagnosticar líneas sobre la imagen fusionada
    const mejorDetector = diagnosticarLineas(canvasFusionado);
    
    // Liberar el canvas fusionado
    canvasFusionado.width = 0;
    canvasFusionado.height = 0;

    return mejorDetector;
  }

  // Exportar
  window.obtenerLineasSuperpuestas = obtenerLineasSuperpuestas;

  console.log('[core] superposicion.js cargado');
})();
