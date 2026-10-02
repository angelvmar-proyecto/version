// ==============================================
// core/blackhat.js
// Algoritmo 12: Black-Hat morfologico
// Closing (dilatar+erosionar) - original = lineas oscuras resaltadas
// ==============================================

function detectarBlackHat(brillo, ancho, alto) {
  const t0 = performance.now();

  const kernelH = window.CONFIG_ESC.BLACKHAT_KERNEL_H || 25;
  const kernelV = window.CONFIG_ESC.BLACKHAT_KERNEL_V || 25;
  const umbralRatio = CONFIG.BLACKHAT_UMBRAL_RATIO || 0.15;

  // 1. Calcular closing con kernel horizontal (para H lines)
  const lineasH = blackhatDireccion(brillo, ancho, alto, kernelH, 'H', umbralRatio);
  const lineasV = blackhatDireccion(brillo, ancho, alto, kernelV, 'V', umbralRatio);

  const t1 = performance.now();
  console.log('[BlackHat] H=' + lineasH.length + ' V=' + lineasV.length + ' (' + (t1-t0).toFixed(0) + 'ms)');

  return { lineasH, lineasV, tiempo: t1-t0 };
}

function blackhatDireccion(brillo, ancho, alto, ksize, dir, umbralRatio) {
  // Proyeccion: para cada fila/columna, calcular el maximo de (max_local - valor)
  const perfil = [];
  const limite = dir === 'H' ? alto : ancho;
  const otroLimite = dir === 'H' ? ancho : alto;

  for (let i = 0; i < limite; i++) {
    // Calcular rango de la fila/columna: maximo local en ventana vs valor actual
    let sumaDif = 0;
    for (let j = 0; j < otroLimite; j++) {
      const v = dir === 'H' ? brillo[i][j] : brillo[j][i];
      // Buscar maximo local en +-ksize/2
      let maxLocal = v;
      const ini = Math.max(0, j - Math.floor(ksize/2));
      const fin = Math.min(otroLimite - 1, j + Math.floor(ksize/2));
      for (let k = ini; k <= fin; k++) {
        const vk = dir === 'H' ? brillo[i][k] : brillo[k][i];
        if (vk > maxLocal) maxLocal = vk;
      }
      const dif = maxLocal - v;
      if (dif > sumaDif) sumaDif = dif;
    }
    perfil.push(sumaDif);
  }

  // Umbral adaptativo: mediana de los top 30
  const copia = perfil.slice().sort(function(a, b) { return b - a; });
  const N = Math.min(30, copia.length);
  const topN = copia.slice(0, N);
  const mediana = topN[Math.floor(topN.length / 2)] || 1;
  const umbral = mediana * (1 - umbralRatio * 0.5);
  const distMin = dir === 'H'
    ? (window.CONFIG_ESC.BLACKHAT_DISTANCIA_H || 15)
    : (window.CONFIG_ESC.BLACKHAT_DISTANCIA_V || 15);

  const resultado = [];
  let ultPos = -99999;
  for (let i = 2; i < limite - 2; i++) {
    if (perfil[i] >= umbral &&
        perfil[i] >= perfil[i-1] && perfil[i] >= perfil[i+1] &&
        perfil[i] >= perfil[i-2] && perfil[i] >= perfil[i+2] &&
        i - ultPos >= distMin) {
      resultado.push(i);
      ultPos = i;
    }
  }
  return resultado;
}

console.log('core/blackhat.js cargado');
