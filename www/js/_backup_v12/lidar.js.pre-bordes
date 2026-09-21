// ==============================================
// MAR Caribe v12.0 - LIDAR
// Votación entre 3 algoritmos + análisis de eco
// + distancia adaptativa al tamaño de la imagen
// ==============================================

// ============================================
// AGRUPAR LÍNEAS CERCANAS Y CONTAR VOTOS
// ============================================
function votarLineas(lineas1, lineas2, lineas3, distanciaAgrup) {
  const todos = [];

  lineas1.forEach(pos => todos.push({ pos, alg: 1 }));
  lineas2.forEach(pos => todos.push({ pos, alg: 2 }));
  lineas3.forEach(pos => todos.push({ pos, alg: 3 }));

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
    confirmados.push({
      posicion: posicion,
      votos: algs.size,
      algoritmos: Array.from(algs)
    });
  });

  return confirmados;
}

// ============================================
// CLASIFICAR LÍNEA SEGÚN VOTOS Y ECO
// ============================================
function clasificarLinea(votos, eco) {
  if (votos >= 3 && eco >= CONFIG.LIDAR_ECO_ALTO) {
    return { aceptar: true, razon: '3 votos + eco alto' };
  }

  if (votos >= CONFIG.LIDAR_VOTOS_MINIMOS && eco >= CONFIG.LIDAR_ECO_ALTO) {
    return { aceptar: true, razon: '2 votos + eco alto' };
  }

  if (votos >= 3 && eco < CONFIG.LIDAR_ECO_BAJO) {
    return { aceptar: false, razon: '3 votos pero eco bajo (doble renglón)' };
  }

  if (votos >= 3 && eco >= CONFIG.LIDAR_ECO_BAJO) {
    return { aceptar: true, razon: '3 votos + eco medio' };
  }

  if (votos >= 2 && eco >= CONFIG.LIDAR_ECO_BAJO) {
    return { aceptar: true, razon: '2 votos + eco medio' };
  }

  if (votos < CONFIG.LIDAR_VOTOS_MINIMOS) {
    return { aceptar: false, razon: votos + ' voto(s)' };
  }

  if (votos >= 2 && eco < CONFIG.LIDAR_ECO_BAJO) {
    return { aceptar: false, razon: '2 votos pero eco bajo' };
  }

  return { aceptar: false, razon: 'No cumple reglas' };
}

// ============================================
// EJECUTAR LIDAR COMPLETO
// ============================================
function ejecutarLidar(opticaH, opticaV, ecoH, ecoV, a3H, a3V, brillo, ancho, alto) {
  console.log('📐 LIDAR: votación + eco');

  // 📊 Diagnóstico de entrada
  console.log('   📥 ENTRADA V: optica=' + opticaV.length +
              ', eco=' + ecoV.length +
              ', a3=' + a3V.length +
              ' (total=' + (opticaV.length + ecoV.length + a3V.length) + ')');
  console.log('   📥 ENTRADA H: optica=' + opticaH.length +
              ', eco=' + ecoH.length +
              ', a3=' + a3H.length +
              ' (total=' + (opticaH.length + ecoH.length + a3H.length) + ')');

  // 🎯 Distancia adaptativa: al menos el config, o ~0.3% de la dimensión
  const distH = Math.max(CONFIG.LIDAR_AGRUPAR_DIST, Math.round(alto / 300));
  const distV = Math.max(CONFIG.LIDAR_AGRUPAR_DIST, Math.round(ancho / 300));
  console.log('   📏 distAgrup: H=' + distH + ', V=' + distV +
              ' (img ' + ancho + '×' + alto + ')');

  // ==========================================
  // VOTACIÓN HORIZONTAL
  // ==========================================
  const votosH = votarLineas(opticaH, ecoH, a3H, distH);

  const analisisH = votosH.map(v => {
    const eco = medirEcoLineaH(v.posicion, brillo, alto, ancho, CONFIG.ECO_VENTANA);
    const clasif = clasificarLinea(v.votos, eco);
    return {
      posicion: v.posicion,
      votos: v.votos,
      algoritmos: v.algoritmos,
      eco: Math.round(eco),
      aceptar: clasif.aceptar,
      razon: clasif.razon
    };
  });

  // ==========================================
  // VOTACIÓN VERTICAL
  // ==========================================
  const votosV = votarLineas(opticaV, ecoV, a3V, distV);

  const analisisV = votosV.map(v => {
    const eco = medirEcoLineaV(v.posicion, brillo, alto, ancho, CONFIG.ECO_VENTANA);
    const clasif = clasificarLinea(v.votos, eco);
    return {
      posicion: v.posicion,
      votos: v.votos,
      algoritmos: v.algoritmos,
      eco: Math.round(eco),
      aceptar: clasif.aceptar,
      razon: clasif.razon
    };
  });

  // ==========================================
  // EXTRAER SOLO LAS ACEPTADAS
  // ==========================================
  const lineasHFinal = analisisH
    .filter(a => a.aceptar)
    .map(a => a.posicion)
    .sort((a, b) => a - b);

  const lineasVFinal = analisisV
    .filter(a => a.aceptar)
    .map(a => a.posicion)
    .sort((a, b) => a - b);

  const descartadasH = analisisH.filter(a => !a.aceptar);
  const descartadasV = analisisV.filter(a => !a.aceptar);

  console.log('   ✅ Aceptadas: ' + lineasHFinal.length + 'H, ' + lineasVFinal.length + 'V');
  console.log('   ❌ Descartadas: ' + descartadasH.length + 'H, ' + descartadasV.length + 'V');

  return {
    lineasH: lineasHFinal,
    lineasV: lineasVFinal,
    analisisH,
    analisisV,
    descartadasH,
    descartadasV,
    votosH,
    votosV
  };
}

// ============================================
// RESUMEN DE VOTACIÓN (para mostrar en logs)
// ============================================
function resumenVotacion(votos) {
  let h3 = 0, h2 = 0, h1 = 0;
  votos.forEach(v => {
    if (v.votos >= 3) h3++;
    else if (v.votos === 2) h2++;
    else h1++;
  });
  return { con3Votos: h3, con2Votos: h2, con1Voto: h1 };
}

console.log('✅ LIDAR cargado');
