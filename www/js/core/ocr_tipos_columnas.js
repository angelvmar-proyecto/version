// ==============================================
// core/ocr_tipos_columnas.js
// Detección automática del tipo de cada columna
// basada en su CONTENIDO (no en su nombre).
// ==============================================

function tipoEsNumerico(t) { return /^[\d\s.,]+$/.test(t) && /\d/.test(t); }
function tipoEsRatio(t) { return /^[\d\s]+\s*[\/:]\s*[\d\s]+$/.test(t) && /\d/.test(t); }
function tipoEsHora(t) { return /^\d{1,2}\s*[:.]\s*\d{2}/.test(t); }
function tipoEsFecha(t) { return /^\d{1,2}[\/\-\.\s]\d{1,2}([\/\-\.\s]\d{2,4})?$/.test(t) || /^(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC|JAN|APR|AUG|DEC)\b/i.test(t); }
function tipoEsEmail(t) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t); }
function tipoEsPorcentaje(t) { return /^\d+([.,]\d+)?\s*%$/.test(t); }
function tipoEsIdLargo(t) { return /^\d{5,}$/.test(t.replace(/\s/g, '')); }
function tipoEsMoneda(t) { return /^[A-Z]{3}$/i.test(t) || /^[\$€¥£]/.test(t); }
function tipoEsCodigo(t) { return /^[A-Z]{1,5}[\dA-Z\-]{1,6}$/i.test(t) && /\d/.test(t) && /[A-Z]/i.test(t); }

function tipoDetectarColumna(valores) {
  const validos = valores.filter(function(v) { return v && v.trim().length > 0; });
  if (validos.length === 0) return { tipo: 'vacio', valores: [] };

  const n = validos.length;
  const unicosSet = {};
  for (const v of validos) unicosSet[v.trim().toUpperCase()] = true;
  const unicos = Object.keys(unicosSet);

  // Lista cerrada: pocos únicos distintos (aunque aparezcan muchas veces)
  if (unicos.length <= 15 && unicos.length < n * 0.7) {
    return { tipo: 'lista_cerrada', valores: unicos };
  }

  let num = 0, ratio = 0, hora = 0, fecha = 0, email = 0, moneda = 0, pct = 0, id = 0, codigo = 0;
  for (const v of validos) {
    const t = v.trim();
    if (tipoEsRatio(t)) ratio++;
    else if (tipoEsHora(t)) hora++;
    else if (tipoEsFecha(t)) fecha++;
    else if (tipoEsEmail(t)) email++;
    else if (tipoEsMoneda(t)) moneda++;
    else if (tipoEsPorcentaje(t)) pct++;
    else if (tipoEsIdLargo(t)) id++;
    else if (tipoEsNumerico(t)) num++;
    else if (tipoEsCodigo(t)) codigo++;
  }

  const umbral = n * 0.5;
  if (ratio >= umbral) return { tipo: 'ratio' };
  if (hora >= umbral) return { tipo: 'hora' };
  if (fecha >= umbral) return { tipo: 'fecha' };
  if (email >= umbral) return { tipo: 'email' };
  if (moneda >= umbral) return { tipo: 'moneda', valores: unicos };
  if (pct >= umbral) return { tipo: 'porcentaje' };
  if (id >= umbral) return { tipo: 'id_largo' };
  if (num >= umbral) return { tipo: 'numerica' };
  if (codigo >= umbral) return { tipo: 'codigo' };
  return { tipo: 'texto_libre' };
}

window.tipoDetectarColumna = tipoDetectarColumna;
console.log('core/ocr_tipos_columnas.js cargado');
