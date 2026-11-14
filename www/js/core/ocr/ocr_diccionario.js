// ==============================================
// core/ocr/ocr_diccionario.js
// Diccionario base de tokens para corrección post-OCR.
// Se complementa con diccionario_dominio.json si existe.
// Lo usa: ocr_post.js, ocr_corrector_tipos.js
// ==============================================

(function() {
  'use strict';

  const DICCIONARIO_BASE = [
    'SUITE', 'STUDIO', 'PENTHOUSE', 'DELUXE', 'PREMIER', 'ELITE',
    'DIAMOND', 'JUNIOR', 'STANDARD', 'MASTER', 'PRESIDENTIAL',
    'FAMILY', 'ROYAL', 'CLUB', 'GOLD', 'PLATINUM', 'SENIOR', 'PRIME',
    'OCEAN', 'BEACH', 'GARDEN', 'POOL', 'SUNSET', 'SUNRISE', 'CORNER',
    'VIVA', 'VOLARIS', 'AEROMEXICO', 'AMERICAN', 'UNITED', 'DELTA',
    'SPIRIT', 'JETBLUE', 'COPA', 'AVIANCA', 'SOUTHWEST', 'ALASKA',
    'AEROLINEAS', 'ARGENTINAS', 'LATAM',
    'TAFER', 'RIU', 'PALACE', 'BARCELO', 'IBEROSTAR', 'HARD', 'ROCK',
    'MOON', 'SUN', 'OCCIDENTAL', 'MELIA', 'CATALONIA', 'DREAMS',
    'SENSATORI', 'SECRETS', 'BREATHLESS', 'NOW', 'GRAND', 'PALLADIUM',
    'HILTON', 'MARRIOTT', 'HYATT', 'WESTIN', 'SHERATON', 'FOUR',
    'SEASONS', 'INTERCONTINENTAL',
    'INT', 'PROG', 'OPC', 'PAX', 'GRP', 'FIT',
    'T3A', 'T3B', 'T3C', 'T4A', 'T4B', 'T4C', 'T5A', 'T5B',
    'MEMB', 'VDP', 'TOTAL', 'FINAL', 'TIMESHARE',
    'WALMART', 'CLAC', 'CHEDRAUI', 'SAMS', 'COSTCO', 'SORIANA',
    'JOLLY', 'BARCO', 'ACUARIO', 'AQUARIO', 'MOUSAI', 'NETCENTER',
    'GARZA', 'BLANCA', 'PALMAR', 'REAGENDA', 'REFERRAL',
    'T2B', 'CASA', 'LEY', 'ELEKTRA',
    'USA', 'MEX', 'CAN', 'USD', 'MXN', 'CAD',
    'MEXICO', 'CANADA', 'AMERICA', 'AMERICANO', 'AMERICANA',
    'ESPANOL', 'ESPANOLA',
    'CALIFORNIA', 'TEXAS', 'FLORIDA', 'NEW', 'YORK', 'ILLINOIS',
    'ARIZONA', 'NEVADA', 'OHIO', 'OREGON', 'WASHINGTON', 'COLORADO',
    'GEORGIA', 'VIRGINIA', 'MICHIGAN', 'PENNSYLVANIA', 'CAROLINA',
    'JERSEY', 'NUEVA', 'NUEVO', 'LEON', 'JALISCO', 'QUINTANA', 'ROO',
    'CANCUN', 'GB', 'PLAYA', 'MUJERES', 'TULUM', 'RIVIERA',
    'MAYA', 'COZUMEL', 'ISLA', 'HOLBOX', 'PUERTO', 'VALLARTA',
    'CABO', 'SAN', 'JOSE', 'LUCAS', 'MAZATLAN', 'ACAPULCO',
    'MIAMI', 'ORLANDO', 'LOS', 'ANGELES', 'CHICAGO', 'HOUSTON',
    'DALLAS', 'ATLANTA', 'BOSTON', 'DENVER', 'SEATTLE', 'PHOENIX',
    'PHILADELPHIA', 'DETROIT', 'NASHVILLE', 'PORTLAND', 'AUSTIN',
    'TORONTO', 'MONTREAL', 'VANCOUVER', 'OTTAWA', 'QUEBEC',
    'HORARIOS', 'ENTRADA', 'SALIDA', 'CHECK',
    'ARRIVAL', 'DEPARTURE', 'PRESENTATION', 'COUNTRY', 'STATE',
    'STATUS', 'CIVIL', 'LOCATION', 'MEMBER', 'GUEST', 'ADULTS',
    'CHILDREN', 'NIGHTS', 'ROOMS', 'NOTE', 'NOTA', 'FECHA',
    'HOTEL', 'CONTACTO', 'PROVEEDOR', 'AGENCIA', 'OPERADOR',
    'MEXICANA', 'EXTRANJERA', 'NACIONAL', 'INTERNACIONAL',
    'WELCOME', 'BIENVENIDO', 'MENSAJE', 'SERVICIO', 'RESERVA',
    'PASAJERO', 'PASAJEROS', 'PRECIO', 'TARIFA', 'PROMO', 'PROMOCION',
    'DESCUENTO', 'INCLUYE', 'EXTRAS', 'SERVICIOS'
  ];

  const EXTRA = [];
  let cargado = false;

  async function cargarDiccionarioExtra() {
    if (cargado) return;
    cargado = true;
    const rutas = [
      'assets/diccionario_dominio.json',
      'assets/diccionario_usuario.json'
    ];
    for (const ruta of rutas) {
      try {
        const resp = await fetch(ruta);
        if (!resp.ok) continue;
        const data = await resp.json();
        let palabras = [];
        if (Array.isArray(data)) {
          palabras = data;
        } else if (data && typeof data === 'object') {
          Object.keys(data).forEach(function(k) {
            if (Array.isArray(data[k])) {
              palabras = palabras.concat(data[k]);
            }
          });
        }
        const normalizadas = palabras
          .map(function(w) { return String(w).toUpperCase().trim(); })
          .filter(function(w) { return w.length > 1; });
        EXTRA.push.apply(EXTRA, normalizadas);
        console.log('[DICC] Cargado ' + ruta + ': ' + normalizadas.length + ' palabras');
      } catch (e) {
        // Silencioso
      }
    }
  }

  function obtenerDiccionarioCompleto() {
    return DICCIONARIO_BASE.concat(EXTRA);
  }

  window.OCR_DICCIONARIO_BASE = DICCIONARIO_BASE;
  window.OCR_DICCIONARIO_EXTRA = EXTRA;
  window.ocrCargarDiccionarioExtra = cargarDiccionarioExtra;
  window.ocrObtenerDiccionarioCompleto = obtenerDiccionarioCompleto;

  console.log('[core/ocr] ocr_diccionario.js cargado (' + DICCIONARIO_BASE.length + ' palabras base)');
})();
