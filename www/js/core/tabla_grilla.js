// ==============================================
// core/tabla_grilla.js
// Construcción de grilla a partir de líneas H/V.
// Segmentación de elementos OCR en celdas.
// ==============================================

// Filtra líneas duplicadas (gap menor al umbral)
function tablaFiltrarLineas(lineas, umbral) {
  if (!lineas || lineas.length === 0) return [];
  // Extraer posiciones
  const posiciones = lineas.map(function(l) {
    return (typeof l === 'number') ? l : l.pos;
  }).sort(function(a, b) { return a - b; });

  const filtradas = [];
  let previa = posiciones[0];
  filtradas.push(previa);
  for (let i = 1; i < posiciones.length; i++) {
    if (posiciones[i] - previa >= umbral) {
      filtradas.push(posiciones[i]);
      previa = posiciones[i];
    }
  }
  return filtradas;
}

// Construye grilla a partir de líneas H y V filtradas
function tablaConstruirGrilla(lineasH, lineasV) {
  return {
    lineasH: lineasH,
    lineasV: lineasV,
    numFilas: lineasH.length - 1,
    numCols: lineasV.length - 1
  };
}

// Asigna un elemento OCR (con boundingBox) a una celda
// Devuelve { fila, col } o null si cae fuera
function tablaAsignarCelda(grilla, bbox, offsetX, offsetY) {
  if (!bbox) return null;
  const cx = (bbox.left + bbox.right) / 2 + (offsetX || 0);
  const cy = (bbox.top + bbox.bottom) / 2 + (offsetY || 0);

  // Encontrar fila
  let fila = -1;
  for (let i = 0; i < grilla.lineasH.length - 1; i++) {
    if (cy >= grilla.lineasH[i] && cy < grilla.lineasH[i + 1]) { fila = i; break; }
  }
  if (fila < 0) return null;

  // Encontrar columna
  let col = -1;
  for (let j = 0; j < grilla.lineasV.length - 1; j++) {
    if (cx >= grilla.lineasV[j] && cx < grilla.lineasV[j + 1]) { col = j; break; }
  }
  if (col < 0) return null;

  return { fila: fila, col: col };
}

// Agrega un elemento a la celda correspondiente
function tablaAgregarElemento(celdas, grilla, elemento, offsetX, offsetY) {
  const pos = tablaAsignarCelda(grilla, elemento.boundingBox, offsetX, offsetY);
  if (!pos) return false;
  const key = pos.fila + '_' + pos.col;
  if (!celdas[key]) celdas[key] = [];
  celdas[key].push({
    text: elemento.text,
    bbox: elemento.boundingBox,
    left: elemento.boundingBox ? elemento.boundingBox.left : 0
  });
  return true;
}

// Extrae el texto de una celda (concatenando elementos ordenados por X)
function tablaTextoDeCelda(celdas, fila, col) {
  const key = fila + '_' + col;
  const elems = celdas[key];
  if (!elems || elems.length === 0) return '';
  elems.sort(function(a, b) { return a.left - b.left; });
  return elems.map(function(e) { return e.text; }).join(' ').trim();
}

// Convierte la grilla completa a matriz de strings
function tablaExtraerMatriz(celdas, grilla) {
  const matriz = [];
  for (let i = 0; i < grilla.numFilas; i++) {
    const fila = [];
    for (let j = 0; j < grilla.numCols; j++) {
      fila.push(tablaTextoDeCelda(celdas, i, j));
    }
    matriz.push(fila);
  }
  return matriz;
}

// Convierte matriz a texto CSV (escapando comillas y comas)
function tablaMatrizACsv(matriz) {
  const lineas = [];
  for (const fila of matriz) {
    const celdas = fila.map(function(v) {
      const s = String(v || '');
      if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    });
    lineas.push(celdas.join(','));
  }
  return lineas.join('\n');
}

window.tablaFiltrarLineas = tablaFiltrarLineas;
window.tablaConstruirGrilla = tablaConstruirGrilla;
window.tablaAsignarCelda = tablaAsignarCelda;
window.tablaAgregarElemento = tablaAgregarElemento;
window.tablaTextoDeCelda = tablaTextoDeCelda;
window.tablaExtraerMatriz = tablaExtraerMatriz;
window.tablaMatrizACsv = tablaMatrizACsv;

console.log('core/tabla_grilla.js cargado');
