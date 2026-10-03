// ==============================================
// core/lidar.js
// Votacion de lineas entre los 7 algoritmos.
// ==============================================


function deduplicarLineasFinales(lineas, distMin) {
  if (!lineas || lineas.length < 2) return lineas;
  const ordenadas = lineas.slice().sort(function(a, b) { return a - b; });
  const resultado = [];
  let i = 0;
  while (i < ordenadas.length) {
    const grupo = [ordenadas[i]];
    while (i + 1 < ordenadas.length && ordenadas[i+1] - grupo[0] < distMin) {
      i++;
      grupo.push(ordenadas[i]);
    }
    // Promedio del grupo
    const promedio = Math.round(grupo.reduce(function(s, x) { return s + x; }, 0) / grupo.length);
    resultado.push(promedio);
    i++;
  }
  return resultado;
}

function votarLidarYRefinar(st) {
  const t0 = performance.now();

  const distH = window.CONFIG_ESC.LIDAR_DIST_AGRUPAR_H;
  const distV = window.CONFIG_ESC.LIDAR_DIST_AGRUPAR_V;
  const minVotos = CONFIG.LIDAR_MIN_VOTOS;
  const pesosH = CONFIG.LIDAR_PESOS_H || CONFIG.LIDAR_PESOS;
  const pesosV = CONFIG.LIDAR_PESOS_V || CONFIG.LIDAR_PESOS;

  const candidatasH = [];
  const candidatasV = [];
  console.log("[LIDAR-MAGENTA] Filtro de longitud activo. LIDAR_LONG_MIN se calculara con st.ancho=" + st.ancho + " st.alto=" + st.alto);

  const fuentes = [
    { alg: 'optica', datos: st.optica },
    { alg: 'eco',    datos: st.eco },
    { alg: 'a3',     datos: st.a3 },
    { alg: 'lvc',    datos: st.lvc },
    { alg: 'io',     datos: st.io },
    { alg: 'cont',   datos: st.cont },
    { alg: 'realce', datos: st.realce },
    { alg: 'blackhat', datos: st.blackhat },
    { alg: 'hough',    datos: st.hough }
  ];

  fuentes.forEach(function(f) {
    if (!f.datos) return;
    if (f.datos.lineasH) { const lh = f.datos.longitudesH || []; f.datos.lineasH.forEach(function(p, i) { candidatasH.push({ pos: p, alg: f.alg, longitud: lh[i] !== undefined ? lh[i] : Infinity }); }); }
    if (f.datos.lineasV) { const lv = f.datos.longitudesV || []; f.datos.lineasV.forEach(function(p, i) { candidatasV.push({ pos: p, alg: f.alg, longitud: lv[i] !== undefined ? lv[i] : Infinity }); }); }
  });
  log("[LIDAR-DIAG] Antes filtro: H=" + candidatasH.length + " V=" + candidatasV.length + " V.opt=" + candidatasV.filter(function(c){return c.alg==="optica";}).length);
  // Filtrar candidatas por longitud minima (descarta ticks, ruido, texto corto)
    const LIDAR_LONG_MIN = Math.max(20, Math.round(Math.max(st.ancho || 1000, st.alto || 1000) * 0.03));
  const candH = candidatasH.filter(function(c) { return c.longitud >= LIDAR_LONG_MIN; });
  const candV = candidatasV.filter(function(c) { return c.longitud >= LIDAR_LONG_MIN; });
  log("[LIDAR-DIAG] Tras filtro (MIN=" + LIDAR_LONG_MIN + "): H=" + candH.length + " V=" + candV.length + " V.opt=" + candV.filter(function(c){return c.alg==="optica";}).length);

  const lineasH = agruparYVotar(candH, distH, pesosH, minVotos);
  const lineasV = agruparYVotar(candV, distV, pesosV, minVotos);
  log("[LIDAR-DIAG] Aceptadas: H=" + lineasH.length + " V=" + lineasV.length);

  const lineasHRellenas = rellenarHuecos(lineasH, candidatasH, window.CONFIG_ESC.LIDAR_HUECO_MIN, window.CONFIG_ESC.LIDAR_HUECO_BORDE);
  const lineasVRellenas = rellenarHuecos(lineasV, candidatasV, window.CONFIG_ESC.LIDAR_HUECO_MIN, window.CONFIG_ESC.LIDAR_HUECO_BORDE);

  // Deduplicacion final: fusionar lineas a <10px
  const dedupH = deduplicarLineasFinales(lineasHRellenas, 10);
  const dedupV = deduplicarLineasFinales(lineasVRellenas, 10);

  const t1 = performance.now();
  console.log('[LIDAR] H=' + dedupH.length + ' V=' + dedupV.length + ' (relleno: ' + lineasHRellenas.length + 'H ' + lineasVRellenas.length + 'V -> dedup: ' + dedupH.length + 'H ' + dedupV.length + 'V) (' + (t1-t0).toFixed(0) + 'ms)');

  return { lineasH: dedupH, lineasV: dedupV, tiempo: t1-t0 };
}

function agruparYVotar(lineas, distAgrup, pesos, minVotos) {
  if (lineas.length === 0) return [];
  lineas.sort(function(a, b) { return a.pos - b.pos; });

  const grupos = [];
  let grupo = [lineas[0]];
  for (let i = 1; i < lineas.length; i++) {
    if (lineas[i].pos - grupo[0].pos <= distAgrup) {
      grupo.push(lineas[i]);
    } else {
      grupos.push(grupo);
      grupo = [lineas[i]];
    }
  }
  grupos.push(grupo);

  const aceptadas = [];
  for (let gi = 0; gi < grupos.length; gi++) {
    const g = grupos[gi];
    const algsPresentes = {};
    g.forEach(function(x) { algsPresentes[x.alg] = true; });
    let votos = 0;
    Object.keys(algsPresentes).forEach(function(a) {
      votos += (pesos[a] !== undefined ? pesos[a] : 1);
    });
    if (votos >= minVotos) {
      const posiciones = g.map(function(x) { return x.pos; }).sort(function(a,b) { return a-b; });
      const pos = posiciones[Math.floor(posiciones.length/2)];
      aceptadas.push(pos);
    }
  }
  return aceptadas;
}

function rellenarHuecos(lineasAceptadas, candidatas, distHuecoMin, distBorde) {
  if (lineasAceptadas.length < 2) return lineasAceptadas;
  const resultado = [];
  for (let i = 0; i < lineasAceptadas.length; i++) {
    resultado.push(lineasAceptadas[i]);
    if (i + 1 >= lineasAceptadas.length) break;
    const hueco = lineasAceptadas[i+1] - lineasAceptadas[i];
    if (hueco <= distHuecoMin) continue;
    const inicio = lineasAceptadas[i] + distBorde;
    const fin = lineasAceptadas[i+1] - distBorde;
    const buckets = {};
    candidatas.forEach(function(c) {
      if (c.pos <= inicio || c.pos >= fin) return;
      const k = Math.round(c.pos / 15) * 15;
      if (!buckets[k]) buckets[k] = { suma: 0, count: 0, algs: {} };
      buckets[k].suma += c.pos;
      buckets[k].count++;
      buckets[k].algs[c.alg] = true;
    });
    let mejor = null;
    Object.keys(buckets).forEach(function(k) {
      const b = buckets[k];
      const numAlgs = Object.keys(b.algs).length;
      if (numAlgs >= 2) {
        if (!mejor || b.count > mejor.count) mejor = b;
      }
    });
    if (mejor) {
      resultado.push(Math.round(mejor.suma / mejor.count));
      console.log('   [LIDAR] Hueco ' + lineasAceptadas[i] + '-' + lineasAceptadas[i+1] + ' rellenado');
    }
  }
  return resultado;
}

console.log('core/lidar.js cargado');
