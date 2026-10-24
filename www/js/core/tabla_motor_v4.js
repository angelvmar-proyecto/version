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
  const todosX = [];
  // Recolectar todos los centros X de todas las palabras
  for (const fila of elementosPorFila) {
    for (const el of fila) {
      const cx = (el.absLeft + el.absRight) / 2;
      todosX.push(cx);
    }
  }

  // Agrupar centros con 20px de tolerancia
  const clusters = motorClusters(todosX, 20);
  
  // Filtrar los clusters que son solo ruido (aparecen muy pocas veces)
  const umbralMinimo = elementosPorFila.length * 0.05; // 5% de las filas
  const centrosValidos = clusters
    .filter(function(c) { return c.count >= umbralMinimo; })
    .map(function(c) { return c.pos; })
    .sort(function(a, b) { return a - b; });

  // Crear líneas V a partir de los centros (usando el espacio entre centros)
  const lineasV = [];
  if (centrosValidos.length === 0) return [];

  // Línea inicial (margen izquierdo)
  lineasV.push(Math.max(0, centrosValidos[0] - 20));

  // Líneas intermedias
  for (let i = 0; i < centrosValidos.length - 1; i++) {
    const gap = centrosValidos[i+1] - centrosValidos[i];
    // Si el gap es grande, hay una separación
    if (gap > 40) {
      // Poner la línea justo en el medio del hueco
      lineasV.push(centrosValidos[i] + (gap / 2));
    }
  }

  // Línea final (margen derecho)
  lineasV.push(Math.min(anchoImagen, centrosValidos[centrosValidos.length - 1] + 20));

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
