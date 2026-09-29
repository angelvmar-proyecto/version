// ==============================================
// core/lvc.js
// Algoritmo 4: LVC (coherencia vertical)
// Detecta columnas donde el brillo es consistente verticalmente.
// ==============================================

function detectarLVC(brillo, ancho, alto) {
  const t0 = performance.now();
  const V = CONFIG.LVC_VENTANA;
  const umbralDif = CONFIG.LVC_UMBRAL_DIF;

  // Perfil: por cada columna, fraccion de pixels donde hay contraste con vecinos
  const perfilV = new Array(ancho).fill(0);

  for (let x = 0; x < ancho; x++) {
    let contador = 0;
    for (let y = 0; y < alto; y++) {
      const centro = brillo[y][x];
      let vecinosDiferentes = 0;
      for (let dx = 1; dx <= V; dx++) {
        const izq = x - dx;
        const der = x + dx;
        if (izq >= 0 && Math.abs(centro - brillo[y][izq]) > umbralDif) vecinosDiferentes++;
        if (der < ancho && Math.abs(centro - brillo[y][der]) > umbralDif) vecinosDiferentes++;
      }
      if (vecinosDiferentes >= 2) contador++;
    }
    perfilV[x] = contador / alto;
  }

  // Suavizar
  const pV = suavizar(perfilV, 2);

  // Buscar columnas con coherencia >= min
  const lineasV = [];
  let ultX = -9999;
  for (let x = 1; x < ancho - 1; x++) {
    if (pV[x] >= CONFIG.LVC_COHERENCIA_MIN &&
        pV[x] > pV[x-1] && pV[x] >= pV[x+1] &&
        x - ultX >= window.CONFIG_ESC.LVC_DISTANCIA_MIN) {
      lineasV.push(x);
      ultX = x;
    }
  }

  const t1 = performance.now();
  console.log('[LVC] V=' + lineasV.length + ' en ' + (t1-t0).toFixed(0) + 'ms');

  return { lineasH: [], lineasV, tiempo: t1-t0 };
}

console.log('core/lvc.js cargado');
