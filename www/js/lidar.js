// ==============================================
// MAR Caribe v12.0 - LIDAR v2
// Votación + distancia adaptativa + auto-bordes agresivos
// ==============================================

function votarLineas(lineas1, lineas2, lineas3, distanciaAgrup, lineas4, lineas5) {
  const todos = [];
  lineas1.forEach(pos => todos.push({ pos, alg: 1 }));
  lineas2.forEach(pos => todos.push({ pos, alg: 2 }));
  lineas3.forEach(pos => todos.push({ pos, alg: 3 }));
  if (lineas4) lineas4.forEach(pos => todos.push({ pos, alg: 4 }));
  if (lineas5) lineas5.forEach(pos => todos.push({ pos, alg: 5 }));
  if (todos.length === 0) return [];
  todos.sort((a, b) => a.pos - b.pos);
  const grupos = [];
  let grupo = [todos[0]];
  for (let i = 1; i < todos.length; i++) {
    if (todos[i].pos - grupo[grupo.length - 1].pos <= distanciaAgrup) {
      grupo.push(todos[i]);
    } else {
      grupos.push(grupo);
      grupo = [todos[i]];
    }
  }
  grupos.push(grupo);
  const confirmados = [];
  grupos.forEach(g => {
    const algs = new Set(g.map(x => x.alg));
    const posicion = Math.round(g.reduce((s, x) => s + x.pos, 0) / g.length);
    confirmados.push({ posicion, votos: algs.size, algoritmos: Array.from(algs) });
  });
  return confirmados;
}

function clasificarLinea(votos, eco) {
  if (votos >= 3 && eco >= CONFIG.LIDAR_ECO_ALTO) return { aceptar: true, razon: '3v+eco alto' };
  if (votos >= CONFIG.LIDAR_VOTOS_MINIMOS && eco >= CONFIG.LIDAR_ECO_ALTO) return { aceptar: true, razon: '2v+eco alto' };
  if (votos >= 3) return { aceptar: true, razon: '3v (confianza alta)' };
  if (votos >= 2 && eco >= CONFIG.LIDAR_ECO_BAJO) return { aceptar: true, razon: '2v+eco medio' };
  if (votos < CONFIG.LIDAR_VOTOS_MINIMOS) return { aceptar: false, razon: votos + 'v' };
  if (votos >= 2 && eco < CONFIG.LIDAR_ECO_BAJO) return { aceptar: false, razon: '2v eco bajo' };
  return { aceptar: false, razon: 'no cumple' };
}

function filtrarLineasAdaptativo(lineas, minRatio) {
  minRatio = minRatio || 0.5;
  if (!lineas || lineas.length < 3) return lineas;
  const distancias = [];
  for (let i = 1; i < lineas.length; i++) {
    distancias.push(lineas[i] - lineas[i - 1]);
  }
  distancias.sort(function(a, b) { return a - b; });
  const mediana = distancias[Math.floor(distancias.length / 2)];
  const minimoAceptable = mediana * minRatio;
  const resultado = [lineas[0]];
  for (let i = 1; i < lineas.length; i++) {
    const dist = lineas[i] - resultado[resultado.length - 1];
    if (dist >= minimoAceptable) {
      resultado.push(lineas[i]);
    }
  }
  console.log('   🔬 Filtro adaptativo: ' + lineas.length + ' → ' + resultado.length +
              ' (mediana=' + mediana.toFixed(0) + 'px, min=' + minimoAceptable.toFixed(0) + 'px)');
  return resultado;
}

function rellenarHuecosV(lineasV, opticaV, ioV, distHuecoMin, distBorde) {
  console.log('   >>> rellenarHuecosV invocada con ' + (lineasV ? lineasV.length : 0) + ' lineas V, distMin=' + distHuecoMin);
  if (!lineasV || lineasV.length < 2) return lineasV;
  const resultado = [];
  for (let i = 0; i < lineasV.length; i++) {
    resultado.push(lineasV[i]);
    if (i + 1 >= lineasV.length) break;
    const hueco = lineasV[i+1] - lineasV[i];
    if (hueco <= distHuecoMin) continue;
    const inicio = lineasV[i] + distBorde;
    const fin = lineasV[i+1] - distBorde;
    const buckets = {};
    const add = function(pos) {
      if (pos <= inicio || pos >= fin) return;
      const k = Math.round(pos / 15) * 15;
      if (!buckets[k]) buckets[k] = { suma: 0, count: 0 };
      buckets[k].suma += pos;
      buckets[k].count++;
    };
    opticaV.forEach(add);
    ioV.forEach(add);
    let mejor = null, mejorCount = 0;
    for (const k in buckets) {
      if (buckets[k].count > mejorCount) { mejorCount = buckets[k].count; mejor = buckets[k]; }
    }
    if (mejor && mejorCount >= 2) {
      const nuevaPos = Math.round(mejor.suma / mejor.count);
      resultado.push(nuevaPos);
      console.log('   >>> Hueco ' + lineasV[i] + ' -> ' + lineasV[i+1] + ' rellenado con ' + nuevaPos + ' (' + mejorCount + ' votos)');
    } else {
      console.log('   >>> Hueco ' + lineasV[i] + ' -> ' + lineasV[i+1] + ' sin candidatos');
    }
  }
  return resultado;
}

function ejecutarLidar(opticaH, opticaV, ecoH, ecoV, a3H, a3V, brillo, ancho, alto, lvcV, ioH, ioV) {
  console.log('📐 LIDAR: votación + eco');
  const lvcLen = (lvcV && lvcV.length) || 0;
  console.log('   📥 ENTRADA V: optica=' + opticaV.length + ', eco=' + ecoV.length + ', a3=' + a3V.length + ', lvc=' + lvcLen + ' (total=' + (opticaV.length + ecoV.length + a3V.length + lvcLen) + ')');
  console.log('   📥 ENTRADA H: optica=' + opticaH.length + ', eco=' + ecoH.length + ', a3=' + a3H.length + ' (total=' + (opticaH.length + ecoH.length + a3H.length) + ')');

  const distH = Math.max(CONFIG_ESC.LIDAR_AGRUPAR_DIST, Math.round(alto / 300));
  const distV = Math.max(CONFIG_ESC.LIDAR_AGRUPAR_DIST, Math.round(ancho / 300));
  console.log('   📏 distAgrup: H=' + distH + ', V=' + distV);

  const votosH = votarLineas(opticaH, ecoH, a3H, distH, null, ioH);
  const analisisH = votosH.map(v => {
    const eco = medirEcoLineaH(v.posicion, brillo, alto, ancho, CONFIG.ECO_VENTANA);
    const clasif = clasificarLinea(v.votos, eco);
    return { posicion: v.posicion, votos: v.votos, algoritmos: v.algoritmos, eco: Math.round(eco), aceptar: clasif.aceptar, razon: clasif.razon };
  });

  // Filtrar A3: solo mantener lineas A3 que tengan Optica cerca (evita bordes de texto)
  const a3VFiltradas = [];
  for (const a of a3V) {
    let opticaCerca = false;
    for (const o of opticaV) {
      if (Math.abs(a - o) <= 5) { opticaCerca = true; break; }
    }
    if (opticaCerca) a3VFiltradas.push(a);
  }
  console.log('   🔍 A3V filtrada: ' + a3V.length + ' → ' + a3VFiltradas.length + ' (solo con Optica cerca)');

  // TEST-2: A3 fuera de votos V
  // OPTICA-B: cluster de Optica cuenta doble (lineas1 + lineas3)
  // Razon: el cluster consolida 2-3 detecciones, es señal de alta confianza
  const votosV = votarLineas(opticaV, ecoV, opticaV, distV, lvcV, ioV);
  const analisisV = votosV.map(v => {
    const eco = medirEcoLineaV(v.posicion, brillo, alto, ancho, CONFIG.ECO_VENTANA);
    const clasif = clasificarLinea(v.votos, eco);
    return { posicion: v.posicion, votos: v.votos, algoritmos: v.algoritmos, eco: Math.round(eco), aceptar: clasif.aceptar, razon: clasif.razon };
  });

  const lineasHFinal = analisisH.filter(a => a.aceptar).map(a => a.posicion).sort((a, b) => a - b);
  const lineasVFinal = analisisV.filter(a => a.aceptar).map(a => a.posicion).sort((a, b) => a - b);

  const descartadasH = analisisH.filter(a => !a.aceptar);
  const descartadasV = analisisV.filter(a => !a.aceptar);

  // 🔲 AUTO-BORDES v2: más agresivo
  // Siempre garantiza que existan bordes en las 4 orillas de la imagen
  const MARGEN = (CONFIG_ESC.LIDAR_MARGEN_BORDE !== undefined) ? CONFIG_ESC.LIDAR_MARGEN_BORDE : 8;

  if (lineasVFinal.length > 0) {
    if (lineasVFinal[0] > MARGEN) {
      lineasVFinal.unshift(0);
      console.log('   🔲 Borde izquierdo agregado en x=0 (primera linea estaba en ' + lineasVFinal[1] + ')');
    }
    const ult = lineasVFinal[lineasVFinal.length - 1];
    if (ult < ancho - MARGEN) {
      lineasVFinal.push(ancho - 1);
      console.log('   🔲 Borde derecho agregado en x=' + (ancho - 1) + ' (ultima linea estaba en ' + ult + ')');
    }
  }

  if (lineasHFinal.length > 0) {
    if (lineasHFinal[0] > MARGEN) {
      lineasHFinal.unshift(0);
      console.log('   🔲 Borde superior agregado en y=0');
    }
    const ult = lineasHFinal[lineasHFinal.length - 1];
    if (ult < alto - MARGEN) {
      lineasHFinal.push(alto - 1);
      console.log('   🔲 Borde inferior agregado en y=' + (alto - 1));
    }
  }

  console.log('   ✅ Aceptadas: ' + lineasHFinal.length + 'H, ' + lineasVFinal.length + 'V');
  console.log('   ❌ Descartadas: ' + descartadasH.length + 'H, ' + descartadasV.length + 'V');

  // Filtro adaptativo: SOLO en horizontales (las verticales tienen anchos muy distintos y el filtro las elimina)
  const lineasHFiltered = filtrarLineasAdaptativo(lineasHFinal, 0.5);
  const lineasVRellenas = rellenarHuecosV(lineasVFinal, opticaV, ioV, 60, 15);
  console.log('   >>> Relleno V: ' + lineasVFinal.length + ' -> ' + lineasVRellenas.length);
  const lineasVFiltered = lineasVRellenas;

  return { lineasH: lineasHFiltered, lineasV: lineasVFiltered, analisisH, analisisV, descartadasH, descartadasV, votosH, votosV };
}

function resumenVotacion(votos) {
  let h3 = 0, h2 = 0, h1 = 0;
  votos.forEach(v => {
    if (v.votos >= 3) h3++;
    else if (v.votos === 2) h2++;
    else h1++;
  });
  return { con3Votos: h3, con2Votos: h2, con1Voto: h1 };
}

console.log('✅ LIDAR cargado v2 (auto-bordes agresivos)');
