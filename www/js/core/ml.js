// Algoritmo: ML - Minimo Local
// Detecta lineas como minimos locales en los perfiles de brillo.
function detectarML(brillo, ancho, alto) {
  const t0 = performance.now();
  const pH = perfilH(brillo, alto, ancho);
  const pV = perfilV(brillo, alto, ancho);
  const pH_s = suavizar(pH, 2);
  const pV_s = suavizar(pV, 2);
  const distMin = window.CONFIG_ESC.ML_DISTANCIA_MIN || 8;

  const lineasH = [];
  let ultH = -9999;
  for (let y = 2; y < alto - 2; y++) {
    if (pH_s[y] < pH_s[y-1] && pH_s[y] < pH_s[y+1] &&
        pH_s[y] < pH_s[y-2] && pH_s[y] < pH_s[y+2] &&
        y - ultH >= distMin) {
      lineasH.push(y);
      ultH = y;
    }
  }
  const lineasV = [];
  let ultV = -9999;
  for (let x = 2; x < ancho - 2; x++) {
    if (pV_s[x] < pV_s[x-1] && pV_s[x] < pV_s[x+1] &&
        pV_s[x] < pV_s[x-2] && pV_s[x] < pV_s[x+2] &&
        x - ultV >= distMin) {
      lineasV.push(x);
      ultV = x;
    }
  }
  const t1 = performance.now();
  console.log('[ML] H=' + lineasH.length + ' V=' + lineasV.length + ' (' + (t1-t0).toFixed(0) + 'ms)');
  return { lineasH, lineasV, tiempo: t1-t0 };
}
console.log('core/ml.js cargado');
