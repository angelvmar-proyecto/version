// ==============================================
// core/ocr/ocr_tipos_columnas.js
// Detección automática del tipo de cada columna
// basada en su CONTENIDO (no en su nombre).
// Lo usa: ocr_corrector_tipos.js, motor_tabla_v1.js
// ==============================================

(function() {
  'use strict';

  // ----------------------------------------------
  // Detectores atómicos por celda
  // ----------------------------------------------
  function esNumerico(t) {
    return /^[\d\s.,]+$/.test(t) && /\d/.test(t);
  }
  function esRatio(t) {
    return /^[\d\s]+\s*[\/:]\s*[\d\s]+$/.test(t) && /\d/.test(t);
  }
  function esHora(t) {
    return /^\d{1,2}\s*[:.]\s*\d{2}/.test(t);
  }
  function esFecha(t) {
    return /^\d{1,2}[\/\-\.\s]\d{1,2}([\/\-\.\s]\d{2,4})?$/.test(t)
      || /^(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC|JAN|APR|AUG|DEC)\b/i.test(t);
  }
  function esEmail(t) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
  }
  function esPorcentaje(t) {
    return /^\d+([.,]\d+)?\s*%$/.test(t);
  }
  function esIdLargo(t) {
    return /^\d{5,}$/.test(t.replace(/\s/g, ''));
  }
  function esMoneda(t) {
    return /^[A-Z]{3}$/i.test(t) || /^[\$€¥£]/.test(t);
  }
  function esCodigo(t) {
    return /^[A-Z]{1,5}[\dA-Z\-]{1,6}$/i.test(t) && /\d/.test(t) && /[A-Z]/i.test(t);
  }

  // ----------------------------------------------
  // Detectar tipo de una columna completa
  // ----------------------------------------------
  function detectarColumna(valores) {
    const validos = valores.filter(function(v) {
      return v && v.trim().length > 0;
    });
    if (validos.length === 0) return { tipo: 'vacio', valores: [] };

    const n = validos.length;

    // Lista cerrada: pocos únicos distintos
    const unicosSet = {};
    for (const v of validos) unicosSet[v.trim().toUpperCase()] = true;
    const unicos = Object.keys(unicosSet);
    if (unicos.length <= 15 && unicos.length < n * 0.7) {
      return { tipo: 'lista_cerrada', valores: unicos };
    }

    let num = 0, ratio = 0, hora = 0, fecha = 0, email = 0;
    let moneda = 0, pct = 0, id = 0, codigo = 0;

    for (const v of validos) {
      const t = v.trim();
      if (esRatio(t)) ratio++;
      else if (esHora(t)) hora++;
      else if (esFecha(t)) fecha++;
      else if (esEmail(t)) email++;
      else if (esMoneda(t)) moneda++;
      else if (esPorcentaje(t)) pct++;
      else if (esIdLargo(t)) id++;
      else if (esNumerico(t)) num++;
      else if (esCodigo(t)) codigo++;
    }

    const umbral = n * 0.5;
    if (ratio >= umbral)  return { tipo: 'ratio' };
    if (hora >= umbral)   return { tipo: 'hora' };
    if (fecha >= umbral)  return { tipo: 'fecha' };
    if (email >= umbral)  return { tipo: 'email' };
    if (moneda >= umbral) return { tipo: 'moneda', valores: unicos };
    if (pct >= umbral)    return { tipo: 'porcentaje' };
    if (id >= umbral)     return { tipo: 'id_largo' };
    if (num >= umbral)    return { tipo: 'numerica' };
    if (codigo >= umbral) return { tipo: 'codigo' };
    return { tipo: 'texto_libre' };
  }

  // ----------------------------------------------
  // Exportar
  // ----------------------------------------------
  window.tipoDetectarColumna = detectarColumna;

  // Exportar los helpers también (los puede necesitar corrector_tipos)
  window.tipoEsNumerico = esNumerico;
  window.tipoEsRatio = esRatio;
  window.tipoEsHora = esHora;
  window.tipoEsFecha = esFecha;
  window.tipoEsEmail = esEmail;
  window.tipoEsPorcentaje = esPorcentaje;
  window.tipoEsIdLargo = esIdLargo;
  window.tipoEsMoneda = esMoneda;
  window.tipoEsCodigo = esCodigo;

  console.log('[core/ocr] ocr_tipos_columnas.js cargado');
})();
