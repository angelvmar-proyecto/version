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
