// ==============================================
// core/csv_parser.js
// Parser CSV que respeta comillas y saltos internos.
// ==============================================

// Parsea texto CSV y devuelve array de arrays (filas × celdas)
function csvParsear(texto) {
  const filas = [];
  let fila = [];
  let celda = '';
  let enComillas = false;
  let i = 0;
  const n = texto.length;

  while (i < n) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"') {
        if (i + 1 < n && texto[i + 1] === '"') {
          celda += '"';
          i += 2;
          continue;
        } else {
          enComillas = false;
          i++;
          continue;
        }
      } else {
        celda += c;
        i++;
        continue;
      }
    } else {
      if (c === '"') {
        enComillas = true;
        i++;
        continue;
      }
      if (c === ',') {
        fila.push(celda);
        celda = '';
        i++;
        continue;
      }
      if (c === '\r') {
        i++;
        continue;
      }
      if (c === '\n') {
        fila.push(celda);
        filas.push(fila);
        fila = [];
        celda = '';
        i++;
        continue;
      }
      celda += c;
      i++;
    }
  }
  // Última celda/fila
  if (celda.length > 0 || fila.length > 0) {
    fila.push(celda);
    filas.push(fila);
  }
  return filas;
}

// Convierte filas CSV a objetos usando la primera fila como headers
function csvParsearConHeaders(texto) {
  const filas = csvParsear(texto);
  if (filas.length === 0) return [];
  const headers = filas[0].map(function(h) { return (h || '').trim(); });
  const out = [];
  for (let i = 1; i < filas.length; i++) {
    const f = filas[i];
    // Ignorar filas completamente vacías
    const tieneDatos = f.some(function(v) { return v && v.trim().length > 0; });
    if (!tieneDatos) continue;
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = (f[j] !== undefined) ? f[j] : '';
    }
    out.push(obj);
  }
  return out;
}

// Extrae todos los tokens únicos de un CSV (de todas las celdas)
// Filtra tokens útiles: >2 caracteres, no puramente numéricos
function csvExtraerTokens(objetos, opciones) {
  opciones = opciones || {};
  const minLen = opciones.minLen || 3;
  const incluirNumeros = opciones.incluirNumeros || false;
  const set = new Set();
  for (const obj of objetos) {
    for (const key in obj) {
      const v = obj[key];
      if (!v) continue;
      // Separar por espacios, comas, puntos, símbolos comunes
      const tokens = String(v).toUpperCase().split(/[\s,;:.\/\(\)\[\]{}'"!?¡¿|]+/);
      for (const t of tokens) {
        if (t.length < minLen) continue;
        if (!incluirNumeros && /^\d+$/.test(t)) continue;
        set.add(t);
      }
    }
  }
  return Array.from(set);
}

// Extrae tokens únicos de un texto plano (OCR)
function textoExtraerTokens(texto, opciones) {
  opciones = opciones || {};
  const minLen = opciones.minLen || 3;
  const incluirNumeros = opciones.incluirNumeros || false;
  const set = new Set();
  if (!texto) return [];
  const tokens = texto.toUpperCase().split(/[\s,;:.\/\(\)\[\]{}'"!?¡¿|]+/);
  for (const t of tokens) {
    if (t.length < minLen) continue;
    if (!incluirNumeros && /^\d+$/.test(t)) continue;
    set.add(t);
  }
  return Array.from(set);
}

window.csvParsear = csvParsear;
window.csvParsearConHeaders = csvParsearConHeaders;
window.csvExtraerTokens = csvExtraerTokens;
window.textoExtraerTokens = textoExtraerTokens;

console.log('core/csv_parser.js cargado');
