// ==============================================
// MAR Caribe v12.0 - LIDAR v2
// Votación + distancia adaptativa + auto-bordes agresivos
// ==============================================

function votarLineas(lineas1, lineas2, lineas3, distanciaAgrup, lineas4) {
  const todos = [];
  lineas1.forEach(pos => todos.push({ pos, alg: 1 }));
  lineas2.forEach(pos => todos.push({ pos, alg: 2 }));
  lineas3.forEach(pos => todos.push({ pos, alg: 3 }));
  if (lineas4) lineas4.forEach(pos => todos.push({ pos, alg: 4 }));
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

function ejecutarLidar(opticaH, opticaV, ecoH, ecoV, a3H, a3V, brillo, ancho, alto, lvcV) {
  console.log('📐 LIDAR: votación + eco');
  const lvcLen = (lvcV && lvcV.length) || 0;
  console.log('   📥 ENTRADA V: optica=' + opticaV.length + ', eco=' + ecoV.length + ', a3=' + a3V.length + ', lvc=' + lvcLen + ' (total=' + (opticaV.length + ecoV.length + a3V.length + lvcLen) + ')');
  console.log('   📥 ENTRADA H: optica=' + opticaH.length + ', eco=' + ecoH.length + ', a3=' + a3H.length + ' (total=' + (opticaH.length + ecoH.length + a3H.length) + ')');

  const distH = Math.max(CONFIG.LIDAR_AGRUPAR_DIST, Math.round(alto / 300));
  const distV = Math.max(CONFIG.LIDAR_AGRUPAR_DIST, Math.round(ancho / 300));
  console.log('   📏 distAgrup: H=' + distH + ', V=' + distV);

  const votosH = votarLineas(opticaH, ecoH, a3H, distH);
  const analisisH = votosH.map(v => {
    const eco = medirEcoLineaH(v.posicion, brillo, alto, ancho, CONFIG.ECO_VENTANA);
    const clasif = clasificarLinea(v.votos, eco);
    return { posicion: v.posicion, votos: v.votos, algoritmos: v.algoritmos, eco: Math.round(eco), aceptar: clasif.aceptar, razon: clasif.razon };
  });

  const votosV = votarLineas(opticaV, ecoV, a3V, distV, lvcV);
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
  const MARGEN = (CONFIG.LIDAR_MARGEN_BORDE !== undefined) ? CONFIG.LIDAR_MARGEN_BORDE : 8;

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
  const lineasVFiltered = lineasVFinal;

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
