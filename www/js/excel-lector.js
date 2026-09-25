// ==============================================
// MAR Caribe v13 - Lector de Excel
// Depende de SheetJS (www/lib/xlsx.full.min.js)
// ==============================================

function leerExcelDesdeArchivo(file) {
  return new Promise((resolve, reject) => {
    if (typeof XLSX === 'undefined') {
      reject(new Error('SheetJS no cargado'));
      return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const primeraHoja = workbook.SheetNames[0];
        const hoja = workbook.Sheets[primeraHoja];
        const matriz = XLSX.utils.sheet_to_json(hoja, {
          header: 1,
          raw: false,
          defval: ''
        });
        resolve(matrizExcelALimpia(matriz));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Error leyendo archivo'));
    reader.readAsArrayBuffer(file);
  });
}

function leerExcelDesdeBase64(base64) {
  if (typeof XLSX === 'undefined') {
    throw new Error('SheetJS no cargado');
  }
  const workbook = XLSX.read(base64, { type: 'base64' });
  const primeraHoja = workbook.SheetNames[0];
  const hoja = workbook.Sheets[primeraHoja];
  const matriz = XLSX.utils.sheet_to_json(hoja, {
    header: 1,
    raw: false,
    defval: ''
  });
  return matrizExcelALimpia(matriz);
}

function matrizExcelALimpia(matriz) {
  // Normaliza: trim, quita filas vacías (inicio/final) y columnas vacías (cualquier pos)
  if (!matriz || !matriz.length) return [];

  // Trim de cada celda
  let limpia = matriz.map(fila =>
    fila.map(celda => String(celda == null ? '' : celda).trim())
  );

  // Quitar filas completamente vacías del inicio
  while (limpia.length > 0 && limpia[0].every(c => !c)) {
    limpia.shift();
  }

  // Quitar filas completamente vacías del final
  while (limpia.length > 0 && limpia[limpia.length - 1].every(c => !c)) {
    limpia.pop();
  }

  // Quitar columnas COMPLETAMENTE vacías en cualquier posición
  // (el OCR no las detecta y desplazan la alineación)
  const maxAncho = limpia.reduce((m, f) => Math.max(m, f.length), 0);
  const colVacia = new Array(maxAncho).fill(true);
  for (let c = 0; c < maxAncho; c++) {
    for (let f = 0; f < limpia.length; f++) {
      if (limpia[f][c] && limpia[f][c].length > 0) {
        colVacia[c] = false;
        break;
      }
    }
  }
  const colEliminadas = colVacia.map((v, i) => v ? i : -1).filter(i => i >= 0);
  if (colEliminadas.length > 0) {
    console.log('📋 Excel: quitando ' + colEliminadas.length + ' columnas vacías: ' + colEliminadas.join(','));
  }
  limpia = limpia.map(f => f.filter((_, i) => !colVacia[i]));

  // Rellenar filas cortas con '' hasta el ancho máximo
  const anchoFinal = limpia.reduce((m, f) => Math.max(m, f.length), 0);
  limpia = limpia.map(f => {
    while (f.length < anchoFinal) f.push('');
    return f;
  });

  return limpia;
}

console.log('✅ Excel-lector cargado');
