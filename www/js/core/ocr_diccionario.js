// ==============================================
// core/ocr_diccionario.js
// Diccionario de tokens base para corrección post-OCR.
// Todas las palabras en MAYÚSCULAS.
// Se pueden agregar más palabras desde:
//   www/assets/diccionario_usuario.json
// ==============================================

window.OCR_DICCIONARIO_BASE = [
  // --- Categorías de hotel / tipo de habitación ---
  'SUITE', 'STUDIO', 'PENTHOUSE', 'DELUXE', 'PREMIER', 'ELITE',
  'DIAMOND', 'JUNIOR', 'STANDARD', 'MASTER', 'PRESIDENTIAL',
  'FAMILY', 'ROYAL', 'CLUB', 'GOLD', 'PLATINUM', 'SENIOR', 'PRIME',
  'OCEAN', 'BEACH', 'GARDEN', 'POOL', 'SUNSET', 'SUNRISE', 'CORNER',

  // --- Aerolíneas ---
  'VIVA', 'VOLARIS', 'AEROMEXICO', 'AMERICAN', 'UNITED', 'DELTA',
  'SPIRIT', 'JETBLUE', 'COPA', 'AVIANCA', 'SOUTHWEST', 'ALASKA',
  'AEROLINEAS', 'ARGENTINAS', 'LATAM',

  // --- Operadores / hoteles grandes ---
  'TAFER', 'RIU', 'PALACE', 'BARCELO', 'IBEROSTAR', 'HARD', 'ROCK',
  'MOON', 'SUN', 'OCCIDENTAL', 'MELIA', 'CATALONIA', 'DREAMS',
  'SENSATORI', 'SECRETS', 'BREATHLESS', 'NOW', 'GRAND', 'PALLADIUM',
  'HILTON', 'MARRIOTT', 'HYATT', 'WESTIN', 'SHERATON', 'FOUR',
  'SEASONS', 'INTERCONTINENTAL',

  // --- Códigos de programa / reserva ---
  'INT', 'PROG', 'OPC', 'PAX', 'GRP', 'FIT', 'T3A', 'T3B', 'T3C',
  'T4A', 'T4B', 'T4C', 'T5A', 'T5B', 'MEMB', 'VDP', 'TOTAL', 'FINAL',
  'PREMIER', 'PRIME', 'TIMESHARE',

  // --- Contactos / promotores ---
  'WALMART', 'CLAC', 'CHEDRAUI', 'SAMS', 'COSTCO', 'SORIANA',
  'CASA', 'LEY', 'ELEKTRA',

  // --- Nacionalidades / países ---
  'USA', 'MEX', 'CAN', 'MEXICO', 'CANADA', 'AMERICA', 'AMERICANO',
  'AMERICANA', 'ESPANOL', 'ESPANOLA',

  // --- Estados / regiones ---
  'CALIFORNIA', 'TEXAS', 'FLORIDA', 'NEW', 'YORK', 'ILLINOIS',
  'ARIZONA', 'NEVADA', 'OHIO', 'OREGON', 'WASHINGTON', 'COLORADO',
  'GEORGIA', 'VIRGINIA', 'MICHIGAN', 'PENNSYLVANIA', 'CAROLINA',
  'JERSEY', 'NUEVA', 'NUEVO', 'LEON', 'JALISCO', 'QUINTANA', 'ROO',

  // --- Ciudades / ubicaciones turísticas ---
  'CANCUN', 'VDP', 'GB', 'PLAYA', 'MUJERES', 'TULUM', 'RIVIERA',
  'MAYA', 'COZUMEL', 'ISLA', 'HOLBOX', 'PUERTO', 'VALLARTA',
  'CABO', 'SAN', 'JOSE', 'LUCAS', 'MAZATLAN', 'ACAPULCO',
  'MIAMI', 'ORLANDO', 'LOS', 'ANGELES', 'CHICAGO', 'HOUSTON',
  'DALLAS', 'ATLANTA', 'BOSTON', 'DENVER', 'SEATTLE', 'PHOENIX',
  'PHILADELPHIA', 'DETROIT', 'NASHVILLE', 'PORTLAND', 'AUSTIN',
  'TORONTO', 'MONTREAL', 'VANCOUVER', 'OTTAWA', 'QUEBEC',

  // --- Palabras operativas ---
  'HORARIOS', 'TOTAL', 'FINAL', 'ENTRADA', 'SALIDA', 'CHECK',
  'ARRIVAL', 'DEPARTURE', 'PRESENTATION', 'COUNTRY', 'STATE',
  'STATUS', 'CIVIL', 'LOCATION', 'MEMBER', 'GUEST', 'ADULTS',
  'CHILDREN', 'NIGHTS', 'ROOMS', 'NOTE', 'NOTA', 'FECHA',
  'HOTEL', 'CONTACTO', 'PROVEEDOR', 'AGENCIA', 'OPERADOR',
  'MEXICANA', 'EXTRANJERA', 'NACIONAL', 'INTERNACIONAL',

  // --- Vocabulario general ---
  'WELCOME', 'BIENVENIDO', 'MENSAJE', 'SERVICIO', 'RESERVA',
  'PASAJERO', 'PASAJEROS', 'PRECIO', 'TARIFA', 'PROMO', 'PROMOCION',
  'DESCUENTO', 'INCLUYE', 'EXTRAS', 'SERVICIOS'
];

// ==============================================
// Cargar diccionario extra desde assets (opcional)
// ==============================================
window.OCR_DICCIONARIO_EXTRA = [];

async function ocrCargarDiccionarioExtra() {
  try {
    const resp = await fetch('assets/diccionario_usuario.json');
    if (!resp.ok) return;
    const data = await resp.json();
    if (Array.isArray(data)) {
      window.OCR_DICCIONARIO_EXTRA = data.map(function(w) {
        return String(w).toUpperCase().trim();
      }).filter(function(w) { return w.length > 1; });
      console.log('[DICC] Extra cargado: ' + window.OCR_DICCIONARIO_EXTRA.length + ' palabras');
    }
  } catch(e) {
    // Silencioso — no hay diccionario extra
  }
}

function ocrObtenerDiccionarioCompleto() {
  return window.OCR_DICCIONARIO_BASE.concat(window.OCR_DICCIONARIO_EXTRA);
}

window.ocrCargarDiccionarioExtra = ocrCargarDiccionarioExtra;
window.ocrObtenerDiccionarioCompleto = ocrObtenerDiccionarioCompleto;

console.log('core/ocr_diccionario.js cargado (' + window.OCR_DICCIONARIO_BASE.length + ' palabras base)');
