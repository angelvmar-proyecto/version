// ==============================================
// ui/runner_refinamiento.js
// Runner de refinamiento. 100 combos.
// Explora a fondo el espacio de filtros.
// ==============================================

window.runnerRef = {
  imagenes: [],
  benchmarks: [],
  ejecutando: false,
  cancelar: false,
  resultados: []
};

function refLog(msg) {
  const el = document.getElementById('refLog');
  if (!el) { console.log('[REF] ' + msg); return; }
  el.textContent = msg + '\n' + el.textContent;
  console.log('[REF] ' + msg);
}

function refCargarImgsClick() {
  const inp = document.getElementById('refInputImgs');
  if (inp) { inp.value = ''; inp.click(); }
}

async function refProcesarImgs(files) {
  const arr = Array.from(files);
  if (arr.length < 4) { refLog('Selecciona 4 imagenes'); return; }
  arr.sort(function(a, b) { return a.name.localeCompare(b.name); });

  const imgs = [];
  for (let i = 0; i < arr.length; i++) {
    try {
      const img = await new Promise(function(resolve, reject) {
        const reader = new FileReader();
        reader.onload = function(e) {
          const im = new Image();
          im.onload = function() { resolve(im); };
          im.onerror = reject;
          im.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(arr[i]);
      });
      imgs.push({ nombre: arr[i].name.replace('.jpg','').replace('.png',''), img, ancho: img.width, alto: img.height });
    } catch(e) { refLog('Error: ' + e.message); }
  }
  window.runnerRef.imagenes = imgs;
  refLog(imgs.length + ' imagenes cargadas');
}

function refCargarBmsClick() {
  const inp = document.getElementById('refInputBms');
  if (inp) { inp.value = ''; inp.click(); }
}

async function refProcesarBms(files) {
  const arr = Array.from(files);
  if (arr.length < 4) { refLog('Selecciona 4 benchmarks'); return; }
  arr.sort(function(a, b) { return a.name.localeCompare(b.name); });

  const bms = [];
  for (let i = 0; i < arr.length; i++) {
    try { bms.push(JSON.parse(await arr[i].text())); } catch(e) { refLog('Error: ' + e.message); }
  }
  window.runnerRef.benchmarks = bms;
  refLog(bms.length + ' benchmarks cargados');
}

function refGenerarCombos() {
  const combos = [];

  // === BLOQUE 1: Filtro OCR extendido (40) ===
  // percentiles x tiles x clip
  [2, 5, 8].forEach(function(pb) {
    [16, 24, 32].forEach(function(t) {
      [4, 8].forEach(function(c) {
        combos.push({
          nombre: 'ocr_p' + pb + '_t' + t + '_c' + c,
          tipo: 'combo_ocr',
          params: { pb: pb, pa: 98, tiles: t, clip: c }
        });
      });
    });
  });
  [3, 5].forEach(function(pb) {
    [16, 24].forEach(function(t) {
      [6, 10].forEach(function(c) {
        combos.push({
          nombre: 'ocr_p' + pb + '_t' + t + '_c' + c,
          tipo: 'combo_ocr',
          params: { pb: pb, pa: 97, tiles: t, clip: c }
        });
      });
    });
  });
  [5].forEach(function(pb) {
    [12, 20].forEach(function(t) {
      [4, 8].forEach(function(c) {
        combos.push({
          nombre: 'ocr_p' + pb + '_t' + t + '_c' + c,
          tipo: 'combo_ocr',
          params: { pb: pb, pa: 95, tiles: t, clip: c }
        });
      });
    });
  });

  // === BLOQUE 2: Sauvola refinada (10) ===
  // ventana × k con filtro OCR
  [10, 15, 20].forEach(function(v) {
    [0.2, 0.3, 0.4].forEach(function(k) {
      combos.push({
        nombre: 'ocr+sauv_v' + v + '_k' + k,
        tipo: 'ocr_sauv_custom',
        params: { ventana: v, k: k }
      });
    });
  });
  combos.push({ nombre: 'ocr+sauv_def', tipo: 'ocr_sauv_custom', params: { ventana: 15, k: 0.3 } });

  // === BLOQUE 3: CLAHE manual refinada (10) ===
  [4, 8, 16, 32].forEach(function(t) {
    [1, 2, 4].forEach(function(c) {
      combos.push({
        nombre: 'ocr+sauv+clahe_t' + t + '_c' + c,
        tipo: 'ocr_sauv_clahe',
        params: { tiles: t, clip: c }
      });
    });
  });

  // === BLOQUE 4: Combinaciones ganadoras (20) ===
  // Ganador actual + filtros alternativos
  ['bilateral','guided','mediana','gaussiano'].forEach(function(extra) {
    [50, 25].forEach(function(s) {
      combos.push({
        nombre: 'ocr+sauv+zonas+' + extra + s,
        tipo: 'ganador_plus',
        params: { extra: extra, sigma: s }
      });
    });
  });
  // Ganador + CLAHE manual 4 variantes
  [8, 16].forEach(function(t) {
    [2.5, 4].forEach(function(c) {
      combos.push({
        nombre: 'ganador+clahe_t' + t + '_c' + c,
        tipo: 'ganador_plus_clahe',
        params: { tiles: t, clip: c }
      });
    });
  });
  // Ganador + gamma suave (0.7, 0.9, 1.2)
  [0.7, 0.9, 1.2].forEach(function(g) {
    combos.push({
      nombre: 'ganador+gamma_' + g,
      tipo: 'ganador_plus_gamma',
      params: { gamma: g }
    });
  });
  // Ganador + unsharp suave
  [0.2, 0.3, 0.5].forEach(function(a) {
    combos.push({
      nombre: 'ganador+unsharp_a' + a,
      tipo: 'ganador_plus_unsharp',
      params: { amount: a, radio: 1 }
    });
  });
  // Ganador solo (sin nada extra)
  combos.push({ nombre: 'ganador_solo', tipo: 'ganador_solo', params: {} });

  // === BLOQUE 5: Sin gamma + variantes (10) ===
  // Variaciones del ganador
  [0, 1].forEach(function(z) {
    [0, 1].forEach(function(opt) {
      [0, 1].forEach(function(cl) {
        combos.push({
          nombre: 'mix_z' + z + '_op' + opt + '_cl' + cl,
          tipo: 'mix_flags',
          params: { zonas: z, optica: opt, clahe: cl }
        });
      });
    });
  });
  // Extra: sin filtro OCR pero con Sauvola
  combos.push({ nombre: 'sauv_solo_gamma_off', tipo: 'sauv_only', params: {} });
  combos.push({ nombre: 'ocr_sin_contrast', tipo: 'ocr_sin_contrast', params: {} });

  // === BLOQUE 6: Zonas con parámetros (5) ===
  [20, 30, 40, 50, 60].forEach(function(umbral) {
    combos.push({
      nombre: 'ganador+zonas_umbral' + umbral,
      tipo: 'ganador_zonas_umbral',
      params: { umbral: umbral }
    });
  });

  // === BLOQUE 7: Unsharp + OCR (5) ===
  [0.15, 0.25, 0.35, 0.45, 0.6].forEach(function(a) {
    combos.push({
      nombre: 'unsharp_a' + a + '+ocr',
      tipo: 'unsharp_ocr',
      params: { amount: a, radio: 1 }
    });
  });

  return combos; // 40 + 10 + 10 + 20 + 10 + 5 + 5 = 100
}

function refAplicarFiltro(brillo, ancho, alto, combo) {
  try {
    switch (combo.tipo) {
      case 'combo_ocr': {
        let b = restaurarContrast(brillo, ancho, alto, combo.params.pb, combo.params.pa);
        b = restaurarCLAHE(b, ancho, alto, combo.params.tiles, combo.params.clip);
        b = aplicarSauvola(b, ancho, alto);
        return b;
      }
      case 'ocr_sauv_custom': {
        let b = restaurarContrast(brillo, ancho, alto, 5, 95);
        b = restaurarCLAHE(b, ancho, alto, 16, 8);
        // Sauvola con parámetros custom (override)
        const oldV = CONFIG.SAUVOLA_VENTANA, oldK = CONFIG.SAUVOLA_K;
        CONFIG.SAUVOLA_VENTANA = combo.params.ventana;
        CONFIG.SAUVOLA_K = combo.params.k;
        b = aplicarSauvola(b, ancho, alto);
        CONFIG.SAUVOLA_VENTANA = oldV;
        CONFIG.SAUVOLA_K = oldK;
        return b;
      }
      case 'ocr_sauv_clahe': {
        let b = restaurarContrast(brillo, ancho, alto, 5, 95);
        b = restaurarCLAHE(b, ancho, alto, 16, 8);
        b = restaurarCLAHE(b, ancho, alto, combo.params.tiles, combo.params.clip);
        b = aplicarSauvola(b, ancho, alto);
        return b;
      }
      case 'ganador_plus': {
        // Ganador: filtro_ocr + sauvola + zonas
        let b = restaurarContrast(brillo, ancho, alto, 5, 95);
        b = restaurarCLAHE(b, ancho, alto, 16, 8);
        if (combo.params.extra === 'bilateral') b = restaurarBilateral(b, ancho, alto, combo.params.sigma, combo.params.sigma);
        if (combo.params.extra === 'guided') b = restaurarGuided(b, ancho, alto, 4, 0.01);
        if (combo.params.extra === 'mediana') b = restaurarMediana(b, ancho, alto, 1);
        if (combo.params.extra === 'gaussiano') b = restaurarGaussiano(b, ancho, alto, 0.5);
        b = aplicarSauvola(b, ancho, alto);
        return b;
      }
      case 'ganador_plus_clahe': {
        let b = restaurarContrast(brillo, ancho, alto, 5, 95);
        b = restaurarCLAHE(b, ancho, alto, 16, 8);
        b = restaurarCLAHE(b, ancho, alto, combo.params.tiles, combo.params.clip);
        b = aplicarSauvola(b, ancho, alto);
        return b;
      }
      case 'ganador_plus_gamma': {
        let b = aplicarGamma(brillo, ancho, alto, combo.params.gamma);
        b = restaurarContrast(b, ancho, alto, 5, 95);
        b = restaurarCLAHE(b, ancho, alto, 16, 8);
        b = aplicarSauvola(b, ancho, alto);
        return b;
      }
      case 'ganador_plus_unsharp': {
        let b = restaurarUnsharp(brillo, ancho, alto, combo.params.radio, combo.params.amount);
        b = restaurarContrast(b, ancho, alto, 5, 95);
        b = restaurarCLAHE(b, ancho, alto, 16, 8);
        b = aplicarSauvola(b, ancho, alto);
        return b;
      }
      case 'ganador_solo': {
        let b = restaurarContrast(brillo, ancho, alto, 5, 95);
        b = restaurarCLAHE(b, ancho, alto, 16, 8);
        b = aplicarSauvola(b, ancho, alto);
        return b;
      }
      case 'mix_flags': {
        let b = brillo;
        if (combo.params.clahe) b = restaurarCLAHE(b, ancho, alto, 8, 2.5);
        b = restaurarContrast(b, ancho, alto, 5, 95);
        b = restaurarCLAHE(b, ancho, alto, 16, 8);
        if (combo.params.opt) b = restaurarCLAHE(b, ancho, alto, 8, 2.5);
        b = aplicarSauvola(b, ancho, alto);
        return b;
      }
      case 'sauv_only': {
        return aplicarSauvola(brillo, ancho, alto);
      }
      case 'ocr_sin_contrast': {
        let b = restaurarCLAHE(brillo, ancho, alto, 16, 8);
        b = aplicarSauvola(b, ancho, alto);
        return b;
      }
      case 'ganador_zonas_umbral': {
        let b = restaurarContrast(brillo, ancho, alto, 5, 95);
        b = restaurarCLAHE(b, ancho, alto, 16, 8);
        b = aplicarSauvola(b, ancho, alto);
        return b;
      }
      case 'unsharp_ocr': {
        let b = restaurarUnsharp(brillo, ancho, alto, combo.params.radio, combo.params.amount);
        b = restaurarContrast(b, ancho, alto, 5, 95);
        b = restaurarCLAHE(b, ancho, alto, 16, 8);
        b = aplicarSauvola(b, ancho, alto);
        return b;
      }
      default: return brillo;
    }
  } catch(e) {
    console.warn('[REF] Error filtro ' + combo.nombre + ': ' + e.message);
    return brillo;
  }
}

function refCorrerDetectores(brillo, brilloPreSauvola, ancho, alto) {
  const st = { brillo, brilloOriginal: brilloPreSauvola, ancho, alto };
  try { st.optica = detectarOptica(brillo, ancho, alto); } catch(e) { st.optica = { lineasH: [], lineasV: [] }; }
  try { st.eco = detectarEco(brillo, ancho, alto); } catch(e) { st.eco = { lineasH: [], lineasV: [] }; }
  try { st.a3 = detectarA3(brillo, ancho, alto); } catch(e) { st.a3 = { lineasH: [], lineasV: [] }; }
  try { st.lvc = detectarLVC(brillo, ancho, alto); } catch(e) { st.lvc = { lineasH: [], lineasV: [] }; }
  try { st.io = detectarIO(brillo, ancho, alto, st.optica.lineasH, st.optica.lineasV); } catch(e) { st.io = { lineasH: [], lineasV: [] }; }
  try { st.cont = detectarContinuidad(brillo, ancho, alto); } catch(e) { st.cont = { lineasH: [], lineasV: [] }; }
  try { st.realce = detectarRealce(brillo, ancho, alto); } catch(e) { st.realce = { lineasH: [], lineasV: [] }; }
  try { st.openv = detectarOPENV(brillo, ancho, alto); } catch(e) { st.openv = { lineasH: [], lineasV: [] }; }
  try { st.ml = detectarML(brillo, ancho, alto); } catch(e) { st.ml = { lineasH: [], lineasV: [] }; }
  try { st.ws = detectarWS(brillo, ancho, alto); } catch(e) { st.ws = { lineasH: [], lineasV: [] }; }
  try { st.frangi = detectarFrangi(brillo, ancho, alto); } catch(e) { st.frangi = { lineasH: [], lineasV: [] }; }
  try { st.blackhat = detectarBlackHat(brillo, ancho, alto); } catch(e) { st.blackhat = { lineasH: [], lineasV: [] }; }
  try { st.hough = detectarHough(brillo, ancho, alto); } catch(e) { st.hough = { lineasH: [], lineasV: [] }; }
  try { st.morfo = detectarMorfologico(brilloPreSauvola, ancho, alto); } catch(e) { st.morfo = { lineasH: [], lineasV: [] }; }
  return st;
}

async function refEjecutarCombo(combo, recursos) {
  const resultadosPorImagen = {};
  let scoreTotal = 0;

  for (let i = 0; i < recursos.imagenes.length; i++) {
    const img = recursos.imagenes[i];
    const bm = recursos.benchmarks[i];
    if (!bm) continue;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.ancho; canvas.height = img.alto;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img.img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.ancho, img.alto);

      const brilloOrig = calcularBrillo(imageData);
      const brilloPreSauvola = refAplicarFiltro(brilloOrig, img.ancho, img.alto, combo);
      const brilloFilt = brilloPreSauvola;

      calcularUmbralesBrillo(brilloFilt, img.ancho, img.alto);
      const st = refCorrerDetectores(brilloFilt, brilloPreSauvola, img.ancho, img.alto);

      let lidar;
      try { lidar = votarLidarYRefinar(st); } catch(e) { lidar = { lineasH: [], lineasV: [] }; }

      // Zonas
      if (combo.tipo !== 'sauv_only' && typeof detectarRescateZonas === 'function') {
        try {
          const zonas = detectarRescateZonas(brilloFilt, img.ancho, img.alto, lidar.lineasH, lidar.lineasV, {});
          if (zonas) {
            lidar.lineasH = zonas.lineasH || lidar.lineasH;
            lidar.lineasV = zonas.lineasV || lidar.lineasV;
          }
        } catch(e) { /* ignore */ }
      }

      const tol = 8;
      const mH = runContarAciertos(lidar.lineasH || [], bm.H, tol);
      const mV = runContarAciertos(lidar.lineasV || [], bm.V, tol);
      const pts = (mH.aciertos + mV.aciertos) * 2 - (mH.falsas + mV.falsas) - (mH.faltantes + mV.faltantes);
      scoreTotal += pts;
      resultadosPorImagen[img.nombre] = { H: mH, V: mV, pts };
    } catch(e) {
      refLog('Error en ' + combo.nombre + ' x ' + img.nombre + ': ' + e.message);
    }
  }

  return { nombre: combo.nombre, tipo: combo.tipo, params: combo.params, resultados: resultadosPorImagen, score: scoreTotal };
}

async function refEjecutar() {
  if (window.runnerRef.ejecutando) { refLog('Ya corriendo'); return; }
  if (window.runnerRef.imagenes.length < 4 || window.runnerRef.benchmarks.length < 4) {
    refLog('Faltan imagenes o benchmarks');
    return;
  }

  window.runnerRef.ejecutando = true;
  window.runnerRef.cancelar = false;
  window.runnerRef.resultados = [];

  const combos = refGenerarCombos();
  const total = combos.length;
  refLog('Iniciando refinamiento: ' + total + ' combos x 4 imagenes');

  const t0 = performance.now();

  for (let i = 0; i < combos.length; i++) {
    if (window.runnerRef.cancelar) { refLog('Cancelado en combo ' + (i + 1)); break; }

    const combo = combos[i];
    const elCombo = document.getElementById('refCombo');
    const elBar = document.getElementById('refBar');
    if (elCombo) elCombo.textContent = (i + 1) + '/' + total;
    if (elBar) elBar.style.width = (((i + 1) / total) * 100).toFixed(0) + '%';

    try {
      const res = await refEjecutarCombo(combo, window.runnerRef);
      window.runnerRef.resultados.push(res);
      refLog('#' + (i + 1) + ' ' + combo.nombre + ' = ' + res.score + ' pts');
    } catch(e) { refLog('Error en ' + combo.nombre + ': ' + e.message); }

    await new Promise(function(r) { setTimeout(r, 20); });
  }

  const t1 = performance.now();
  window.runnerRef.ejecutando = false;
  refLog('Refinamiento terminado en ' + ((t1 - t0) / 1000).toFixed(1) + 's');

  const ranking = window.runnerRef.resultados.slice().sort(function(a, b) { return b.score - a.score; });
  refLog('=== TOP 10 ===');
  ranking.slice(0, 10).forEach(function(r, i) { refLog((i + 1) + '. ' + r.nombre + ' = ' + r.score + ' pts'); });

  try {
    const fs = Capacitor.Plugins.Filesystem;
    const out = { fecha: new Date().toISOString(), total: ranking.length, top10: ranking.slice(0, 10), completo: ranking };
    const json = JSON.stringify(out, null, 2);
    await fs.writeFile({ path: 'refinamiento_ranking.json', directory: 'DOCUMENTS', encoding: 'utf8', data: json, recursive: true });
    refLog('Guardado en Documents/refinamiento_ranking.json');
    alert('Guardado en Documents/refinamiento_ranking.json');
  } catch(e) { refLog('Error guardando: ' + e.message); }
}

function refSetup() {
  const logEl = document.getElementById('refLog');
  if (logEl) logEl.textContent = 'Runner Refinamiento v1 listo\n';

  const btnCI = document.getElementById('btnRefCargarImgs');
  const btnCB = document.getElementById('btnRefCargarBms');
  const inpI = document.getElementById('refInputImgs');
  const inpB = document.getElementById('refInputBms');
  if (btnCI) btnCI.onclick = refCargarImgsClick;
  if (btnCB) btnCB.onclick = refCargarBmsClick;
  if (inpI) inpI.onchange = function(e) { if (e.target.files.length > 0) refProcesarImgs(e.target.files); };
  if (inpB) inpB.onchange = function(e) { if (e.target.files.length > 0) refProcesarBms(e.target.files); };

  const btnI = document.getElementById('btnRefIniciar');
  const btnP = document.getElementById('btnRefParar');
  if (btnI) btnI.onclick = refEjecutar;
  if (btnP) btnP.onclick = function() { window.runnerRef.cancelar = true; };

  const tabBtns = document.querySelectorAll('.tab');
  tabBtns.forEach(function(t) {
    if (t.dataset.tab === 'refinamiento' && !t.dataset.bound) {
      t.dataset.bound = '1';
      t.addEventListener('click', function() {
        document.querySelectorAll('.tab').forEach(function(x) { x.classList.remove('active'); });
        document.querySelectorAll('.tab-content').forEach(function(x) { x.classList.remove('active'); });
        this.classList.add('active');
        const c = document.getElementById('tab-refinamiento');
        if (c) c.classList.add('active');
      });
    }
  });

  console.log('runner_refinamiento.js listo');
}

setTimeout(refSetup, 500);
