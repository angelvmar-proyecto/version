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
  // 1. Filtrar filas cortas (excluir texto largo como Notes)
  const filasCortas = elementosPorFila.filter(function(f) {
    return f.length >= 3 && f.length <= 20;
  });
  const filasAnalisis = filasCortas.length >= 2 ? filasCortas : elementosPorFila;

  // 2. Recolectar gaps de cada fila
  const gaps = [];
  for (let i = 0; i < filasAnalisis.length; i++) {
    const fila = filasAnalisis[i];
    if (fila.length < 2) continue;
    const ord = fila.slice().sort(function(a,b) { return a.cx - b.cx; });
    for (let j = 0; j < ord.length - 1; j++) {
      const gap = ord[j+1].absLeft - ord[j].absRight;
      if (gap > 15) {
        gaps.push({ x: (ord[j].absRight + ord[j+1].absLeft) / 2, fila: i });
      }
    }
  }

  // 3. Clusterizar gaps por X (tolerancia 25px)
  gaps.sort(function(a,b) { return a.x - b.x; });
  const clusters = [];
  let grupo = [];
  for (const g of gaps) {
    if (grupo.length === 0 || (g.x - grupo[grupo.length-1].x) < 25) {
      grupo.push(g);
    } else {
      if (grupo.length > 0) clusters.push(grupo);
      grupo = [g];
    }
  }
  if (grupo.length > 0) clusters.push(grupo);

  // 4. Solo clusters que aparezcan en >= 2 filas distintas
  const lineasV = [];
  for (const c of clusters) {
    const filasDistintas = new Set();
    for (const g of c) filasDistintas.add(g.fila);
    if (filasDistintas.size >= 2) {
      let sumaX = 0;
      for (const g of c) sumaX += g.x;
      lineasV.push(sumaX / c.length);
    }
  }

  // 5. Ordenar y agregar bordes
  lineasV.sort(function(a,b) { return a - b; });
  return [0, ...lineasV, anchoImagen];
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
