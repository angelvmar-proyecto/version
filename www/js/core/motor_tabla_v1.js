// ==============================================
// core/motor_tabla_v1.js
// Motor universal de tablas basado solo en boundingBox.
// Sin detectores de líneas, sin tiling, sin filtros.
// ==============================================

// === UTILIDAD: calcular alto de imagen desde elementos ===
function motorAltoImagen(elementos) {
  let maxY = 0;
  for (const el of elementos) if (el.y2 > maxY) maxY = el.y2;
  return Math.ceil(maxY) + 5;
}

// === UTILIDAD: histograma suavizado ===
function motorSuavizar(hist, radio) {
  const out = new Array(hist.length).fill(0);
  for (let i = 0; i < hist.length; i++) {
    let suma = 0, count = 0;
    for (let k = -radio; k <= radio; k++) {
      const j = i + k;
      if (j >= 0 && j < hist.length) { suma += hist[j]; count++; }
    }
    out[i] = suma / count;
  }
  return out;
}

// === DETECCIÓN DE FILAS por proyección horizontal ===
function motorDetectarFilas(elementos, altoImagen) {
  const histY = new Array(altoImagen).fill(0);
  for (const el of elementos) {
    const y1 = Math.max(0, Math.floor(el.y1));
    const y2 = Math.min(altoImagen - 1, Math.ceil(el.y2));
    for (let y = y1; y <= y2; y++) histY[y]++;
  }

  const histSuave = motorSuavizar(histY, 3);

  // Detectar bloques densos (filas)
  const filas = [];
  let enFila = false;
  let inicio = 0;
  let maxDensidad = 0;
  for (let y = 1; y < altoImagen - 1; y++) {
    const esDenso = histSuave[y] > 1;
    if (esDenso && !enFila) {
      enFila = true;
      inicio = y;
      maxDensidad = histSuave[y];
    } else if (esDenso && enFila) {
      if (histSuave[y] > maxDensidad) maxDensidad = histSuave[y];
    } else if (!esDenso && enFila) {
      enFila = false;
      const altura = y - inicio;
      if (altura >= 8) {
        filas.push({ y1: inicio, y2: y, altura: altura });
      }
    }
  }
  if (enFila) {
    filas.push({ y1: inicio, y2: altoImagen - 1, altura: altoImagen - inicio });
  }

  return filas;
}

// === DETECCIÓN DE COLUMNAS por consenso de gaps ===
function motorDetectarColumnas(elementos, filas, anchoImagen) {
  // 1. Filtrar filas cortas (excluir Notes = filas con mucho texto)
  const filasCortas = [];
  for (const fila of filas) {
    const elementosFila = elementos.filter(function(e) {
      return e.cy >= fila.y1 && e.cy <= fila.y2;
    });
    if (elementosFila.length >= 2 && elementosFila.length <= 25) {
      filasCortas.push({ fila: fila, elementos: elementosFila });
    }
  }

  // 2. Recolectar gaps de cada fila corta
  const gaps = [];
  for (const fc of filasCortas) {
    const ord = fc.elementos.slice().sort(function(a,b) { return a.x1 - b.x1; });
    for (let i = 0; i < ord.length - 1; i++) {
      const gap = ord[i+1].x1 - ord[i].x2;
      if (gap > 15) {
        gaps.push({
          x: (ord[i].x2 + ord[i+1].x1) / 2,
          filaY: fc.fila.y1
        });
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

  // 4. Solo clusters que aparezcan en >= 3 filas distintas
  const columnasReales = [];
  for (const c of clusters) {
    const filasDistintas = new Set();
    for (const g of c) filasDistintas.add(g.filaY);
    if (filasDistintas.size >= 3) {
      let sumaX = 0;
      for (const g of c) sumaX += g.x;
      columnasReales.push(sumaX / c.length);
    }
  }

  columnasReales.sort(function(a,b) { return a - b; });

  // 5. Agregar bordes
  const lineasV = [0, ...columnasReales, anchoImagen];
  return lineasV;
}

// === ASIGNACIÓN DE ELEMENTOS A CELDAS ===
function motorAsignarCeldas(elementos, filas, columnas) {
  const celdas = {};
  for (const el of elementos) {
    // Buscar fila
    let filaIdx = -1;
    for (let i = 0; i < filas.length; i++) {
      if (el.cy >= filas[i].y1 && el.cy <= filas[i].y2) { filaIdx = i; break; }
    }
    if (filaIdx < 0) continue;

    // Buscar columna
    let colIdx = -1;
    for (let j = 0; j < columnas.length - 1; j++) {
      if (el.cx >= columnas[j] && el.cx < columnas[j+1]) { colIdx = j; break; }
    }
    if (colIdx < 0) continue;

    const key = filaIdx + '_' + colIdx;
    if (!celdas[key]) celdas[key] = [];
    celdas[key].push({ text: el.text, left: el.x1, top: el.y1 });
  }

  // Ordenar elementos de cada celda por Y, luego X (para nombres en 2 renglones)
  for (const key in celdas) {
    celdas[key].sort(function(a,b) {
      const diffY = a.top - b.top;
      if (Math.abs(diffY) > 5) return diffY;
      return a.left - b.left;
    });
  }

  return celdas;
}

// === CONSTRUIR MATRIZ Y LIMPIAR ===
function motorConstruirMatriz(celdas, numFilas, numCols) {
  const matriz = [];
  for (let i = 0; i < numFilas; i++) {
    const fila = [];
    for (let j = 0; j < numCols; j++) {
      const key = i + '_' + j;
      const elems = celdas[key] || [];
      const texto = elems.map(function(e) { return e.text; }).join(' ').trim();
      fila.push(texto);
    }
    matriz.push(fila);
  }
  return matriz;
}

// === DETECCIÓN DE TIPOS POR COLUMNA ===
function motorDetectarTipos(matriz) {
  const numCols = matriz[0] ? matriz[0].length : 0;
  const tipos = [];
  for (let j = 0; j < numCols; j++) {
    const valores = [];
    for (let i = 0; i < matriz.length; i++) {
      if (matriz[i][j]) valores.push(matriz[i][j]);
    }
    tipos.push(window.tipoDetectarColumna ? window.tipoDetectarColumna(valores) : { tipo: 'texto_libre' });
  }
  return tipos;
}

// === CORRECCIÓN POR TIPO ===
function motorCorregirPorTipo(matriz, tipos) {
  let celdasCorregidas = 0;
  let celdasTotales = 0;
  for (let i = 0; i < matriz.length; i++) {
    for (let j = 0; j < matriz[i].length; j++) {
      const texto = matriz[i][j];
      if (!texto || texto.length === 0) continue;
      celdasTotales++;
      const tipo = tipos[j] || { tipo: 'texto_libre' };
      const corregido = window.correctorAplicarPorTipo ? window.correctorAplicarPorTipo(texto, tipo) : texto;
      if (corregido !== texto) celdasCorregidas++;
      matriz[i][j] = corregido;
    }
  }
  return { celdasCorregidas, celdasTotales };
}

// === PIPELINE COMPLETO ===
function motorProcesarTabla(elementos, anchoImagen) {
  const altoImagen = motorAltoImagen(elementos);

  // 1. Filas
  const filas = motorDetectarFilas(elementos, altoImagen);

  // 2. Columnas
  const columnas = motorDetectarColumnas(elementos, filas, anchoImagen);

  // 3. Asignación
  const celdas = motorAsignarCeldas(elementos, filas, columnas);

  // 4. Matriz
  const numCols = Math.max(0, columnas.length - 1);
  const matriz = motorConstruirMatriz(celdas, filas.length, numCols);

  // 5. Tipos
  const tipos = motorDetectarTipos(matriz);

  // 6. Corrección
  const stats = motorCorregirPorTipo(matriz, tipos);

  return {
    matriz: matriz,
    filas: filas,
    columnas: columnas,
    tipos: tipos,
    stats: stats,
    altoImagen: altoImagen,
    numFilas: filas.length,
    numCols: numCols
  };
}

window.motorDetectarFilas = motorDetectarFilas;
window.motorDetectarColumnas = motorDetectarColumnas;
window.motorAsignarCeldas = motorAsignarCeldas;
window.motorConstruirMatriz = motorConstruirMatriz;
window.motorDetectarTipos = motorDetectarTipos;
window.motorCorregirPorTipo = motorCorregirPorTipo;
window.motorProcesarTabla = motorProcesarTabla;

console.log('core/motor_tabla_v1.js cargado');
