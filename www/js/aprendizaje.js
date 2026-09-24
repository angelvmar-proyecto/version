// ==============================================
// MAR Caribe v13 - Módulo de aprendizaje
// Aprende de pares (imagen OCR + Excel correcto)
// Fase 2: persistencia dual + aplicación automática
// ==============================================

const APRENDIZAJE_KEY = 'mar_caribe_aprendizaje_v1';
const APRENDIZAJE_VERSION = 1;
const APRENDIZAJE_UMBRAL_CONFIANZA = 2;   // mínimo de apariciones para aplicar una sustitución
const APRENDIZAJE_ARCHIVO = 'aprendizaje.json';

window.APRENDIZAJE = {
  version: APRENDIZAJE_VERSION,
  pares: [],
  sustituciones: {},
  diccionarios: {},
  patrones: {},
  stats: {
    totalCeldas: 0,
    totalAciertos: 0,
    totalFallos: 0,
    totalPares: 0
  }
};

// ============================================
// PERSISTENCIA
// ============================================
function aprendizajeCargar() {
  // 1. Intentar desde localStorage primero (más rápido)
  let cargado = false;
  try {
    const raw = localStorage.getItem(APRENDIZAJE_KEY);
    if (raw) {
      const datos = JSON.parse(raw);
      if (datos.version === APRENDIZAJE_VERSION) {
        window.APRENDIZAJE = datos;
        cargado = true;
        console.log('✅ Aprendizaje cargado de localStorage');
      }
    }
  } catch (e) {
    console.warn('⚠️ Error leyendo localStorage:', e);
  }

  // 2. Si localStorage está vacío, intentar leer desde Documents (async, no bloquea)
  if (!cargado) {
    aprendizajeCargarDesdeDocuments().then(ok => {
      if (ok) {
        console.log('✅ Aprendizaje cargado de Documents');
        if (typeof log === 'function') {
          log('🎓 Aprendizaje cargado desde Documents', 'info');
        }
      }
    });
  }

  return cargado;
}

async function aprendizajeCargarDesdeDocuments() {
  try {
    if (typeof Capacitor === 'undefined' || !Capacitor.Plugins) return false;
    const fs = Capacitor.Plugins.Filesystem;
    if (!fs) return false;

    const res = await fs.readFile({
      path: APRENDIZAJE_ARCHIVO,
      directory: 'DOCUMENTS',
      encoding: 'utf8'
    });
    const datos = JSON.parse(res.data);
    if (datos.version !== APRENDIZAJE_VERSION) {
      console.warn('⚠️ Versión de aprendizaje incompatible');
      return false;
    }
    window.APRENDIZAJE = datos;
    aprendizajeGuardarLocal();
    return true;
  } catch (e) {
    // Normal si es la primera vez (archivo no existe)
    return false;
  }
}

function aprendizajeGuardarLocal() {
  try {
    localStorage.setItem(APRENDIZAJE_KEY, JSON.stringify(window.APRENDIZAJE));
    return true;
  } catch (e) {
    console.warn('⚠️ Error guardando en localStorage:', e);
    return false;
  }
}

async function aprendizajeGuardarDocuments() {
  try {
    if (typeof Capacitor === 'undefined' || !Capacitor.Plugins) return false;
    const fs = Capacitor.Plugins.Filesystem;
    if (!fs) return false;

    const json = JSON.stringify(window.APRENDIZAJE, null, 2);
    await fs.writeFile({
      path: APRENDIZAJE_ARCHIVO,
      data: btoa(unescape(encodeURIComponent(json))),
      directory: 'DOCUMENTS'
    });
    return true;
  } catch (e) {
    console.warn('⚠️ Error guardando en Documents:', e);
    return false;
  }
}

function aprendizajeGuardar() {
  aprendizajeGuardarLocal();
  // Documents en background, no bloquea
  aprendizajeGuardarDocuments();
}

function aprendizajeReset() {
  window.APRENDIZAJE = {
    version: APRENDIZAJE_VERSION,
    pares: [],
    sustituciones: {},
    diccionarios: {},
    patrones: {},
    stats: { totalCeldas: 0, totalAciertos: 0, totalFallos: 0, totalPares: 0 }
  };
  localStorage.removeItem(APRENDIZAJE_KEY);
  aprendizajeGuardarDocuments();
  return true;
}

// ============================================
// NORMALIZACIÓN
// ============================================
function normalizarCelda(texto) {
  return String(texto || '').toLowerCase().replace(/\s+/g, '').trim();
}

// ============================================
// COMPARACIÓN OCR vs EXCEL
// ============================================
function compararMatrices(matrizOCR, matrizExcel) {
  const filas = Math.min(matrizOCR.length, matrizExcel.length);
  const resultado = {
    totalCeldas: 0,
    aciertos: 0,
    fallos: 0,
    diferencias: []
  };

  for (let f = 0; f < filas; f++) {
    const cols = Math.min(matrizOCR[f].length, matrizExcel[f].length);
    for (let c = 0; c < cols; c++) {
      const ocr = matrizOCR[f][c] || '';
      const excel = matrizExcel[f][c] || '';
      if (!ocr && !excel) continue;
      resultado.totalCeldas++;
      if (normalizarCelda(ocr) === normalizarCelda(excel)) {
        resultado.aciertos++;
      } else {
        resultado.fallos++;
        resultado.diferencias.push({
          fila: f,
          col: c,
          ocr: ocr,
          excel: excel
        });
      }
    }
  }

  return resultado;
}

// ============================================
// LEVENSHTEIN
// ============================================
function levenshtein(a, b) {
  a = String(a || '');
  b = String(b || '');
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matriz = [];
  for (let i = 0; i <= b.length; i++) matriz[i] = [i];
  for (let j = 0; j <= a.length; j++) matriz[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matriz[i][j] = matriz[i - 1][j - 1];
      } else {
        matriz[i][j] = Math.min(
          matriz[i - 1][j - 1] + 1,
          matriz[i][j - 1] + 1,
          matriz[i - 1][j] + 1
        );
      }
    }
  }
  return matriz[b.length][a.length];
}

// ============================================
// DETECTAR SUSTITUCIONES
// ============================================
function detectarSustituciones(diferencias) {
  const nuevas = {};

  diferencias.forEach(dif => {
    const ocr = dif.ocr;
    const excel = dif.excel;
    if (!ocr || !excel) return;
    if (ocr.length !== excel.length) return;

    // 🔒 FILTRO Levenshtein: solo aceptar si son realmente similares
    const dist = levenshtein(ocr.toLowerCase(), excel.toLowerCase());
    const umbralDist = ocr.length <= 10 ? 2 : 3;
    if (dist > umbralDist) return;

    // 🔒 FILTRO ratio: si cambian >40% de chars, no es el mismo texto
    const ratioCambio = dist / Math.max(ocr.length, 1);
    if (ratioCambio > 0.4) return;

    for (let i = 0; i < ocr.length; i++) {
      const a = ocr[i];
      const b = excel[i];
      if (a === b) continue;
      if (/\s/.test(a) || /\s/.test(b)) continue;

      const clave = a + '→' + b;
      if (!nuevas[clave]) {
        nuevas[clave] = { count: 0, ejemplos: [] };
      }
      nuevas[clave].count++;
      if (nuevas[clave].ejemplos.length < 3) {
        nuevas[clave].ejemplos.push(ocr + ' → ' + excel);
      }
    }
  });

  return nuevas;
}

function fusionarSustituciones(nuevas) {
  Object.keys(nuevas).forEach(clave => {
    if (!window.APRENDIZAJE.sustituciones[clave]) {
      window.APRENDIZAJE.sustituciones[clave] = { count: 0, ejemplos: [] };
    }
    window.APRENDIZAJE.sustituciones[clave].count += nuevas[clave].count;
    window.APRENDIZAJE.sustituciones[clave].ejemplos =
      window.APRENDIZAJE.sustituciones[clave].ejemplos
        .concat(nuevas[clave].ejemplos)
        .slice(0, 3);
  });
}

// ============================================
// DETECTAR DICCIONARIOS POR COLUMNA
// ============================================
function detectarDiccionarios(matrizExcel, umbralMin) {
  umbralMin = umbralMin || 2;
  const dicc = {};

  for (let f = 0; f < matrizExcel.length; f++) {
    for (let c = 0; c < matrizExcel[f].length; c++) {
      const valor = String(matrizExcel[f][c] || '').trim();
      if (!valor) continue;
      if (valor.length > 40) continue;

      if (!dicc[c]) dicc[c] = {};
      dicc[c][valor] = (dicc[c][valor] || 0) + 1;
    }
  }

  const diccFinal = {};
  Object.keys(dicc).forEach(col => {
    const valores = dicc[col];
    const filtrados = {};
    Object.keys(valores).forEach(v => {
      if (valores[v] >= umbralMin) filtrados[v] = valores[v];
    });
    if (Object.keys(filtrados).length > 0) diccFinal[col] = filtrados;
  });

  return diccFinal;
}

function fusionarDiccionarios(nuevos) {
  Object.keys(nuevos).forEach(col => {
    if (!window.APRENDIZAJE.diccionarios[col]) {
      window.APRENDIZAJE.diccionarios[col] = {};
    }
    Object.keys(nuevos[col]).forEach(v => {
      window.APRENDIZAJE.diccionarios[col][v] =
        (window.APRENDIZAJE.diccionarios[col][v] || 0) + nuevos[col][v];
    });
  });
}

// ============================================
// DETECTAR PATRONES POR COLUMNA
// ============================================
function detectarPatrones(matrizExcel) {
  const patrones = {};
  const numCols = matrizExcel[0] ? matrizExcel[0].length : 0;

  for (let c = 0; c < numCols; c++) {
    const valores = [];
    for (let f = 0; f < matrizExcel.length; f++) {
      const v = String(matrizExcel[f][c] || '').trim();
      if (v) valores.push(v);
    }
    if (valores.length < 3) continue;

    const soloDigitos = valores.every(v => /^[0-9]+$/.test(v));
    const soloLetras = valores.every(v => /^[A-Za-zÁÉÍÓÚÑáéíóúñ\s]+$/.test(v));
    const alfanum = valores.every(v => /^[A-Za-z0-9ÁÉÍÓÚÑáéíóúñ\s\-\.]+$/.test(v));

    const longitudes = valores.map(v => v.length);
    const longMin = Math.min.apply(null, longitudes);
    const longMax = Math.max.apply(null, longitudes);
    const longitudUniforme = (longMin === longMax);

    patrones[c] = {
      tipo: soloDigitos ? 'digitos' : soloLetras ? 'letras' : alfanum ? 'alfanum' : 'mixto',
      longitudUniforme: longitudUniforme,
      longMin: longMin,
      longMax: longMax,
      count: valores.length
    };
  }

  return patrones;
}

function fusionarPatrones(nuevos) {
  Object.keys(nuevos).forEach(col => {
    const nuevo = nuevos[col];
    const existente = window.APRENDIZAJE.patrones[col];
    if (!existente || nuevo.count > existente.count) {
      window.APRENDIZAJE.patrones[col] = nuevo;
    }
  });
}

// ============================================
// ANALIZAR UN PAR (función principal)
// ============================================
function aprendizajeAnalizarPar(matrizOCR, matrizExcel, nombre) {
  if (!matrizOCR || !matrizExcel) {
    return { ok: false, error: 'Falta una de las matrices' };
  }

  // 🔍 DIAGNÓSTICO DE ALINEACIÓN
  if (typeof log === 'function') {
    log('🔍 [DIAG] OCR: ' + matrizOCR.length + ' filas × ' + (matrizOCR[0] ? matrizOCR[0].length : 0) + ' cols', 'info');
    log('🔍 [DIAG] Excel: ' + matrizExcel.length + ' filas × ' + (matrizExcel[0] ? matrizExcel[0].length : 0) + ' cols', 'info');
    const nf = Math.min(2, matrizOCR.length, matrizExcel.length);
    for (let i = 0; i < nf; i++) {
      const o = (matrizOCR[i] || []).slice(0, 6).join(' | ');
      const e = (matrizExcel[i] || []).slice(0, 6).join(' | ');
      log('🔍 [DIAG] Fila ' + i + ' OCR: ' + o, 'info');
      log('🔍 [DIAG] Fila ' + i + ' XLS: ' + e, 'info');
    }
  }

  const comparacion = compararMatrices(matrizOCR, matrizExcel);
  const sustitucionesNuevas = detectarSustituciones(comparacion.diferencias);
  const diccionariosNuevos = detectarDiccionarios(matrizExcel, 2);
  const patronesNuevos = detectarPatrones(matrizExcel);

  fusionarSustituciones(sustitucionesNuevas);
  fusionarDiccionarios(diccionariosNuevos);
  fusionarPatrones(patronesNuevos);

  window.APRENDIZAJE.pares.push({
    nombre: nombre || ('par_' + Date.now()),
    fecha: new Date().toISOString(),
    totalCeldas: comparacion.totalCeldas,
    aciertos: comparacion.aciertos,
    fallos: comparacion.fallos,
    precision: comparacion.totalCeldas > 0
      ? (comparacion.aciertos / comparacion.totalCeldas)
      : 0
  });

  window.APRENDIZAJE.stats.totalCeldas += comparacion.totalCeldas;
  window.APRENDIZAJE.stats.totalAciertos += comparacion.aciertos;
  window.APRENDIZAJE.stats.totalFallos += comparacion.fallos;
  window.APRENDIZAJE.stats.totalPares++;

  aprendizajeGuardar();

  return {
    ok: true,
    comparacion: comparacion,
    sustitucionesNuevas: Object.keys(sustitucionesNuevas).length,
    diccionariosNuevos: Object.keys(diccionariosNuevos).length,
    patronesNuevos: Object.keys(patronesNuevos).length
  };
}

// ============================================
// APLICAR REGLAS APRENDIDAS A UNA MATRIZ OCR
// Se aplica automáticamente si APRENDIZAJE_ACTIVO está en true
// Sustituciones con >= APRENDIZAJE_UMBRAL_CONFIANZA
// Diccionarios por columna con Levenshtein <= 2
// ============================================
function aprendizajeAplicar(matrizOCR) {
  if (!CONFIG.APRENDIZAJE_ACTIVO) {
    return { aplicado: false, motivo: 'desactivado', correcciones: 0 };
  }

  let correccionesSust = 0;
  let correccionesDicc = 0;

  // 1. Preparar sustituciones que superan el umbral
  const sustitucionesConf = {};
  Object.keys(window.APRENDIZAJE.sustituciones).forEach(clave => {
    const s = window.APRENDIZAJE.sustituciones[clave];
    if (s.count >= APRENDIZAJE_UMBRAL_CONFIANZA) {
      const partes = clave.split('→');
      if (partes.length === 2) sustitucionesConf[partes[0]] = partes[1];
    }
  });

  const dicc = window.APRENDIZAJE.diccionarios;

  // 2. Recorrer cada celda
  for (let f = 0; f < matrizOCR.length; f++) {
    for (let c = 0; c < matrizOCR[f].length; c++) {
      let valor = matrizOCR[f][c] || '';
      if (!valor) continue;
      const original = valor;

      // Sustituciones carácter por carácter
      let reconstruido = '';
      let huboSust = false;
      for (let i = 0; i < valor.length; i++) {
        const ch = valor[i];
        if (sustitucionesConf[ch]) {
          reconstruido += sustitucionesConf[ch];
          huboSust = true;
        } else {
          reconstruido += ch;
        }
      }
      if (huboSust && reconstruido !== valor) {
        correccionesSust++;
        valor = reconstruido;
      }

      // Diccionario de la columna (distancia Levenshtein <= 2)
      if (dicc[c]) {
        let mejorMatch = null;
        let mejorDist = 999;
        Object.keys(dicc[c]).forEach(candidato => {
          const dist = levenshtein(
            valor.toLowerCase(),
            candidato.toLowerCase()
          );
          if (dist < mejorDist && dist <= 2) {
            mejorDist = dist;
            mejorMatch = candidato;
          }
        });
        if (mejorMatch && mejorMatch !== valor) {
          correccionesDicc++;
          valor = mejorMatch;
        }
      }

      if (valor !== original) {
        matrizOCR[f][c] = valor;
      }
    }
  }

  return {
    aplicado: true,
    correcciones: correccionesSust + correccionesDicc,
    correccionesSust: correccionesSust,
    correccionesDicc: correccionesDicc,
    sustitucionesActivas: Object.keys(sustitucionesConf).length
  };
}

// ============================================
// EXPORTAR / IMPORTAR
// ============================================
function aprendizajeExportar() {
  return JSON.stringify(window.APRENDIZAJE, null, 2);
}

function aprendizajeImportar(jsonString) {
  try {
    const datos = JSON.parse(jsonString);
    if (!datos.version) {
      return { ok: false, error: 'JSON sin versión' };
    }
    window.APRENDIZAJE = datos;
    aprendizajeGuardar();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ============================================
// RESUMEN LEGIBLE (para la UI)
// ============================================
function aprendizajeResumen() {
  const a = window.APRENDIZAJE;
  const precision = a.stats.totalCeldas > 0
    ? (a.stats.totalAciertos / a.stats.totalCeldas * 100).toFixed(1)
    : '0.0';

  const sustitucionesTotal = Object.keys(a.sustituciones).length;
  const sustitucionesConf = Object.keys(a.sustituciones).filter(
    k => a.sustituciones[k].count >= APRENDIZAJE_UMBRAL_CONFIANZA
  ).length;

  return {
    paresAnalizados: a.stats.totalPares,
    precisionGlobal: precision + '%',
    sustituciones: sustitucionesTotal,
    sustitucionesConf: sustitucionesConf,
    umbralConfianza: APRENDIZAJE_UMBRAL_CONFIANZA,
    diccionarios: Object.keys(a.diccionarios).length,
    patrones: Object.keys(a.patrones).length
  };
}

// ============================================
// UTILIDAD: EXPORTAR A DOCUMENTS (botón de la UI)
// ============================================
async function aprendizajeExportarADocuments() {
  const ok = await aprendizajeGuardarDocuments();
  if (ok) {
    if (typeof log === 'function') {
      log('📤 Aprendizaje guardado en Documentos/' + APRENDIZAJE_ARCHIVO, 'exito');
    }
    return { ok: true, path: APRENDIZAJE_ARCHIVO };
  }
  return { ok: false };
}

// ============================================
// CARGA INICIAL
// ============================================
aprendizajeCargar();

document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    if (typeof log === 'function' && typeof aprendizajeResumen === 'function') {
      const r = aprendizajeResumen();
      log('🎓 Aprendizaje: ' + r.paresAnalizados + ' pares, ' +
          r.sustitucionesConf + ' sustituciones activas (umbral ' +
          r.umbralConfianza + ')', 'info');
    }
  }, 1200);
});

console.log('✅ Aprendizaje v' + APRENDIZAJE_VERSION + ' cargado (fase 2)');
