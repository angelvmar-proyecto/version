// ==============================================
// core/ocr_corrector_tipos.js
// Correctores especializados por tipo de columna.
// ==============================================

function corregirNumerico(texto) {
  if (!texto) return '';
  const mapa = { 'O':'0', 'o':'0', 'Q':'0', 'I':'1', 'l':'1', 'L':'1', 'S':'5', 's':'5', 'B':'8', 'Z':'2', 'z':'2', 'G':'6' };
  let out = '';
  for (const c of texto) {
    if (/\d/.test(c)) out += c;
    else if (/\s/.test(c)) continue;
    else if (c === '.' || c === ',') out += c;
    else if (mapa[c] !== undefined) out += mapa[c];
  }
  return out;
}

function corregirRatio(texto) {
  if (!texto) return '';
  const parts = texto.split(/[\/:]/);
  if (parts.length !== 2) return corregirNumerico(texto);
  return corregirNumerico(parts[0]) + '/' + corregirNumerico(parts[1]);
}

function corregirHora(texto) {
  if (!texto) return '';
  let t = texto.toUpperCase();
  t = t.replace(/A\s*\.?\s*N\s*\.?\s*M?\.?/g, 'A. M.');
  t = t.replace(/A\s*\.?\s*RN\s*\.?/g, 'A. M.');
  t = t.replace(/P\s*\.?\s*N\s*\.?\s*M?\.?/g, 'P. M.');
  const m = t.match(/^(\d{1,2})\s*[:.]\s*(\d{2})/);
  if (m) {
    const hh = m[1].padStart(2, '0');
    const mm = m[2];
    const suf = t.match(/(A\.?\s*M\.?|P\.?\s*M\.?)/i);
    return hh + ':' + mm + (suf ? ' ' + suf[1] : '');
  }
  return texto;
}

function corregirListaCerrada(texto, lista) {
  if (!texto || !lista || lista.length === 0) return texto;
  const t = texto.trim().toUpperCase();
  if (lista.indexOf(t) >= 0) return t;
  let mejor = null, mejorDist = 999;
  for (const v of lista) {
    const d = ocrLevenshtein(t, v);
    if (d < mejorDist) { mejorDist = d; mejor = v; }
  }
  const tol = mejor ? Math.max(1, Math.floor(mejor.length / 3)) : 0;
  if (mejor && mejorDist <= tol) return mejor;
  return texto;
}

function corregirCodigo(texto) {
  if (!texto) return '';
  const mapa = { '0':'O', '1':'I', '5':'S', '4':'A', '8':'B' };
  let out = '';
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    const prev = i > 0 ? texto[i-1] : '';
    const next = i < texto.length - 1 ? texto[i+1] : '';
    const prevLetra = /[A-Z]/i.test(prev);
    const nextLetra = /[A-Z]/i.test(next);
    if (/\d/.test(c) && prevLetra && nextLetra && mapa[c]) out += mapa[c];
    else out += c;
  }
  return out.toUpperCase();
}

function correctorAplicarPorTipo(texto, tipoInfo) {
  if (!texto || texto.trim().length === 0) return texto;
  const tipo = tipoInfo.tipo;
  switch (tipo) {
    case 'numerica':
    case 'id_largo':
      return corregirNumerico(texto);
    case 'ratio':
      return corregirRatio(texto);
    case 'hora':
      return corregirHora(texto);
    case 'moneda':
    case 'lista_cerrada':
      return corregirListaCerrada(texto, tipoInfo.valores || []);
    case 'codigo':
      return corregirCodigo(texto);
    case 'porcentaje': {
      const p = texto.replace(/\s*%/g, '');
      return corregirNumerico(p) + '%';
    }
    case 'email':
    case 'fecha':
      return texto;
    default:
      if (typeof ocrPostProcesar === 'function') {
        try { return ocrPostProcesar(texto); } catch(e) { return texto; }
      }
      return texto;
  }
}

window.corregirNumerico = corregirNumerico;
window.corregirRatio = corregirRatio;
window.corregirHora = corregirHora;
window.corregirListaCerrada = corregirListaCerrada;
window.corregirCodigo = corregirCodigo;
window.correctorAplicarPorTipo = correctorAplicarPorTipo;
console.log('core/ocr_corrector_tipos.js cargado');
