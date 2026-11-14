// ==============================================
// core/tabla_motor_v4.js
// Motor de inferencia geométrica para Tabla v4.
// Usa las cajas de texto de ML Kit para inferir la grilla.
// ==============================================

// 1. Agrupa coordenadas en clusters (devuelve centros de columna/fila)
function motorClusters(coordenadas, tolerancia) {
  if (coordenadas.length === 0) return [];
  tolerancia = tolerancia || 15;
  
  const ordenadas = coordenadas.slice().sort(function(a, b) { return a - b; });
  const clusters = [];
  let grupo = [ordenadas[0]];

  for (let i = 1; i < ordenadas.length; i++) {
    if (ordenadas[i] - grupo[grupo.length - 1] < tolerancia) {
      grupo.push(ordenadas[i]);
    } else {
      // Calcular el promedio del grupo
      let suma = 0;
      for (const v of grupo) suma += v;
      clusters.push({ pos: suma / grupo.length, count: grupo.length });
      grupo = [ordenadas[i]];
    }
  }
  // Último grupo
  let suma = 0;
  for (const v of grupo) suma += v;
  clusters.push({ pos: suma / grupo.length, count: grupo.length });

  return clusters;
}
// 2. Construye la grilla V (Columnas) a partir de las cajas de texto
function motorInferirColumnas(elementosPorFila, anchoImagen) {
  const histGaps = new Array(Math.ceil(anchoImagen)).fill(0);

  // Analizar solo las primeras 6 filas (encabezados + primeras filas de datos)
  // Ahí están los gaps claros entre columnas.
  const filasAnalisis = elementosPorFila.slice(0, Math.min(6, elementosPorFila.length));

  // DEBUG
  if (typeof console !== 'undefined') {
    console.log('[MOTOR-V] Filas totales:', elementosPorFila.length);
    console.log('[MOTOR-V] Filas analizadas:', filasAnalisis.length);
    let totalPalabras = 0;
    for (const f of filasAnalisis) totalPalabras += f.length;
    console.log('[MOTOR-V] Palabras en filas analizadas:', totalPalabras);
  }

  // 1. Recolectar gaps horizontales entre palabras de la misma fila
  let gapsDetectados = 0;
  for (const fila of filasAnalisis) {
    if (fila.length < 2) continue;
    const ord = fila.slice().sort(function(a,b) { return a.absLeft - b.absLeft; });
    for (let i = 0; i < ord.length - 1; i++) {
      const gapInicio = ord[i].absRight;
      const gapFin = ord[i+1].absLeft;
      const gapAncho = gapFin - gapInicio;
      // Umbral más alto: 15px (evita gaps internos, captura gaps reales entre columnas)
      if (gapAncho > 15) {
        const centroGap = Math.round(gapInicio + (gapAncho / 2));
        if (centroGap >= 0 && centroGap < anchoImagen) {
          histGaps[centroGap]++;
          gapsDetectados++;
        }
      }
    }
  }

  if (typeof console !== 'undefined') {
    console.log('[MOTOR-V] Gaps detectados:', gapsDetectados);
  }

  // 2. Encontrar picos en el histograma
  const lineasV = [];
  // Umbral de consenso: al menos 1 fila (bajo, porque analizamos pocas filas)
  const umbralConsenso = Math.max(1, Math.min(3, Math.floor(filasAnalisis.length * 0.2)));

  let enPico = false;
  let inicioPico = 0;
  for (let x = 1; x < anchoImagen - 1; x++) {
    const esPico = histGaps[x] > umbralConsenso && histGaps[x] >= histGaps[x-1] && histGaps[x] > histGaps[x+1];
    if (esPico && !enPico) {
      enPico = true;
      inicioPico = x;
    } else if (!esPico && enPico) {
      enPico = false;
      lineasV.push(Math.round(inicioPico + ((x - inicioPico) / 2)));
    }
  }

  // 3. Agregar los bordes
  if (lineasV.length > 0) {
    if (lineasV[0] > 20) lineasV.unshift(0);
    if (lineasV[lineasV.length - 1] < anchoImagen - 20) lineasV.push(anchoImagen);
  }

  return lineasV;
}

// 3. Construye la grilla H (Filas) a partir de las cajas de texto
function motorInferirFilas(elementosPorFila, altoImagen) {
  const todosY = [];
  for (const fila of elementosPorFila) {
    if (fila.length > 0) {
      // Usar el promedio Y de la fila
      let sumaY = 0;
      for (const el of fila) sumaY += (el.absTop + el.absBottom) / 2;
      todosY.push(sumaY / fila.length);
    }
  }

  const clusters = motorClusters(todosY, 15);
  const lineasH = [];
  if (clusters.length === 0) return [];

  // Para H, es más fácil usar los bordes de los clusters
  lineasH.push(Math.max(0, clusters[0].pos - 15));
  
  for (let i = 0; i < clusters.length - 1; i++) {
    const gap = clusters[i+1].pos - clusters[i].pos;
    if (gap > 20) {
      lineasH.push(clusters[i].pos + (gap / 2));
    }
  }
  
  lineasH.push(Math.min(altoImagen, clusters[clusters.length - 1].pos + 15));

  return lineasH;
}

window.motorClusters = motorClusters;
window.motorInferirColumnas = motorInferirColumnas;
window.motorInferirFilas = motorInferirFilas;

console.log('core/tabla_motor_v4.js cargado');
