// ==============================================
// ui/runner_filtros.js
// Runner para encontrar el set minimo de filtros.
// 30 combos, pipeline completo con LIDAR.
// ==============================================

window.runnerFiltros = {
  imagenes: [],
  benchmarks: [],
  ejecutando: false,
  cancelar: false,
  resultados: []
};

function rfLog(msg) {
  const el = document.getElementById('rfLog');
  if (!el) { console.log('[RF] ' + msg); return; }
  el.textContent = msg + '\n' + el.textContent;
  console.log('[RF] ' + msg);
}

function rfCargarImgsClick() {
  const inp = document.getElementById('rfInputImgs');
  if (inp) { inp.value = ''; inp.click(); }
}

async function rfProcesarImgs(files) {
  const arr = Array.from(files);
  if (arr.length < 4) { rfLog('Selecciona 4 imagenes'); return; }
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
      imgs.push({
        nombre: arr[i].name.replace('.jpg', '').replace('.png', ''),
        img: img,
        ancho: img.width,
        alto: img.height
      });
    } catch(e) {
      rfLog('Error cargando ' + arr[i].name + ': ' + e.message);
    }
  }
  window.runnerFiltros.imagenes = imgs;
  rfLog(imgs.length + ' imagenes cargadas');
}

function rfCargarBmsClick() {
  const inp = document.getElementById('rfInputBms');
  if (inp) { inp.value = ''; inp.click(); }
}

async function rfProcesarBms(files) {
  const arr = Array.from(files);
  if (arr.length < 4) { rfLog('Selecciona 4 benchmarks'); return; }
  arr.sort(function(a, b) { return a.name.localeCompare(b.name); });

  const bms = [];
  for (let i = 0; i < arr.length; i++) {
    try {
      const texto = await arr[i].text();
      bms.push(JSON.parse(texto));
    } catch(e) {
      rfLog('Error con ' + arr[i].name + ': ' + e.message);
    }
  }
  window.runnerFiltros.benchmarks = bms;
  rfLog(bms.length + ' benchmarks cargados');
}

function rfGenerarCombos() {
  const combos = [];

  // === Bloque 1: Filtros individuales (6) ===
  combos.push({ nombre: 'baseline_nada', aplicar: [] });
  combos.push({ nombre: 'gamma_1.8', aplicar: ['gamma'] });
  combos.push({ nombre: 'clahe_manual_8_25', aplicar: ['clahe_manual'] });
  combos.push({ nombre: 'sauvola_solo', aplicar: ['sauvola'] });
  combos.push({ nombre: 'filtro_ocr_solo', aplicar: ['filtro_ocr'] });
  combos.push({ nombre: 'zonas_solo', aplicar: ['zonas'] });

  // === Bloque 2: Filtro OCR + 1 (4) ===
  combos.push({ nombre: 'ocr+gamma', aplicar: ['filtro_ocr', 'gamma'] });
  combos.push({ nombre: 'ocr+clahe_manual', aplicar: ['filtro_ocr', 'clahe_manual'] });
  combos.push({ nombre: 'ocr+sauvola', aplicar: ['filtro_ocr', 'sauvola'] });
  combos.push({ nombre: 'ocr+zonas', aplicar: ['filtro_ocr', 'zonas'] });

  // === Bloque 3: Filtro OCR + 2 (4) ===
  combos.push({ nombre: 'ocr+gamma+zonas', aplicar: ['filtro_ocr', 'gamma', 'zonas'] });
  combos.push({ nombre: 'ocr+clahe+zonas', aplicar: ['filtro_ocr', 'clahe_manual', 'zonas'] });
  combos.push({ nombre: 'ocr+gamma+clahe', aplicar: ['filtro_ocr', 'gamma', 'clahe_manual'] });
  combos.push({ nombre: 'ocr+gamma+sauvola', aplicar: ['filtro_ocr', 'gamma', 'sauvola'] });

  // === Bloque 4: Filtro OCR + 3 (2) ===
  combos.push({ nombre: 'ocr+gamma+clahe+zonas', aplicar: ['filtro_ocr', 'gamma', 'clahe_manual', 'zonas'] });
  combos.push({ nombre: 'ocr+gamma+sauvola+zonas', aplicar: ['filtro_ocr', 'gamma', 'sauvola', 'zonas'] });

  // === Bloque 5: Variaciones del filtro OCR (8) ===
  combos.push({ nombre: 'contrast_only', aplicar: ['contrast_only'] });
  combos.push({ nombre: 'clahe_only_16_8', aplicar: ['clahe_only'] });
  combos.push({ nombre: 'cc_p2_t16_c8', aplicar: ['cc_p2'] });
  combos.push({ nombre: 'cc_p5_t8_c4', aplicar: ['cc_t8_c4'] });
  combos.push({ nombre: 'cc_p5_t8_c8', aplicar: ['cc_t8_c8'] });
  combos.push({ nombre: 'cc_p5_t32_c8', aplicar: ['cc_t32_c8'] });
  combos.push({ nombre: 'cc_p5_t16_c4', aplicar: ['cc_t16_c4'] });
  combos.push({ nombre: 'cc_p5_t16_c16', aplicar: ['cc_t16_c16'] });

  // === Bloque 6: Todo ON menos uno (6) ===
  combos.push({ nombre: 'todo_on_actual', aplicar: ['filtro_ocr', 'gamma', 'clahe_manual', 'sauvola', 'zonas'] });
  combos.push({ nombre: 'todo_menos_gamma', aplicar: ['filtro_ocr', 'clahe_manual', 'sauvola', 'zonas'] });
  combos.push({ nombre: 'todo_menos_clahe', aplicar: ['filtro_ocr', 'gamma', 'sauvola', 'zonas'] });
  combos.push({ nombre: 'todo_menos_sauvola', aplicar: ['filtro_ocr', 'gamma', 'clahe_manual', 'zonas'] });
  combos.push({ nombre: 'todo_menos_ocr', aplicar: ['gamma', 'clahe_manual', 'sauvola', 'zonas'] });
  combos.push({ nombre: 'todo_menos_zonas', aplicar: ['filtro_ocr', 'gamma', 'clahe_manual', 'sauvola'] });

  return combos; // 30
}

function rfAplicarFiltros(brillo, ancho, alto, combo) {
  let b = brillo;
  for (let i = 0; i < combo.aplicar.length; i++) {
    const f = combo.aplicar[i];
    try {
      switch (f) {
        case 'gamma': b = aplicarGamma(b, ancho, alto, 1.8); break;
        case 'clahe_manual': b = restaurarCLAHE(b, ancho, alto, 8, 2.5); break;
        case 'sauvola': b = aplicarSauvola(b, ancho, alto); break;
        case 'filtro_ocr':
          b = restaurarContrast(b, ancho, alto, 5, 95);
          b = restaurarCLAHE(b, ancho, alto, 16, 8);
          break;
        case 'contrast_only': b = restaurarContrast(b, ancho, alto, 5, 95); break;
        case 'clahe_only': b = restaurarCLAHE(b, ancho, alto, 16, 8); break;
        case 'cc_p2':
          b = restaurarContrast(b, ancho, alto, 2, 98);
          b = restaurarCLAHE(b, ancho, alto, 16, 8);
          break;
        case 'cc_t8_c4':
          b = restaurarContrast(b, ancho, alto, 5, 95);
          b = restaurarCLAHE(b, ancho, alto, 8, 4);
          break;
        case 'cc_t8_c8':
          b = restaurarContrast(b, ancho, alto, 5, 95);
          b = restaurarCLAHE(b, ancho, alto, 8, 8);
          break;
        case 'cc_t32_c8':
          b = restaurarContrast(b, ancho, alto, 5, 95);
          b = restaurarCLAHE(b, ancho, alto, 32, 8);
          break;
        case 'cc_t16_c4':
          b = restaurarContrast(b, ancho, alto, 5, 95);
          b = restaurarCLAHE(b, ancho, alto, 16, 4);
          break;
        case 'cc_t16_c16':
          b = restaurarContrast(b, ancho, alto, 5, 95);
          b = restaurarCLAHE(b, ancho, alto, 16, 16);
          break;
        case 'zonas': break; // post-proceso
      }
    } catch(e) {
      console.warn('[RF] Error filtro ' + f + ': ' + e.message);
    }
  }
  return b;
}

function rfCorrerDetectores(brillo, brilloPreSauvola, ancho, alto) {
  const st = {};
  st.brillo = brillo;
  st.brilloOriginal = brilloPreSauvola;
  st.ancho = ancho;
  st.alto = alto;

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

async function rfEjecutarCombo(combo, recursos) {
  const resultadosPorImagen = {};
  let scoreTotal = 0;

  for (let i = 0; i < recursos.imagenes.length; i++) {
    const img = recursos.imagenes[i];
    const bm = recursos.benchmarks[i];
    if (!bm) continue;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.ancho;
      canvas.height = img.alto;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img.img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.ancho, img.alto);

      const brilloOrig = calcularBrillo(imageData);
      let brilloFilt = rfAplicarFiltros(brilloOrig, img.ancho, img.alto, combo);

      // Capturar antes de Sauvola para morfo
      const brilloPreSauvola = brilloFilt;

      // Sauvola al final si esta en el combo
      if (combo.aplicar.indexOf('sauvola') >= 0) {
        brilloFilt = aplicarSauvola(brilloFilt, img.ancho, img.alto);
      }

      calcularUmbralesBrillo(brilloFilt, img.ancho, img.alto);

      const st = rfCorrerDetectores(brilloFilt, brilloPreSauvola, img.ancho, img.alto);

      // LIDAR
      let lidar;
      try {
        lidar = votarLidarYRefinar(st);
      } catch(e) {
        lidar = { lineasH: [], lineasV: [] };
      }

      // Zonas post-proceso
      if (combo.aplicar.indexOf('zonas') >= 0 && typeof detectarRescateZonas === 'function') {
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

      resultadosPorImagen[img.nombre] = {
        H: mH, V: mV, pts: pts
      };
    } catch(e) {
      rfLog('Error en ' + combo.nombre + ' x ' + img.nombre + ': ' + e.message);
    }
  }

  return {
    nombre: combo.nombre,
    aplicar: combo.aplicar,
    resultados: resultadosPorImagen,
    score: scoreTotal
  };
}

async function rfEjecutar() {
  if (window.runnerFiltros.ejecutando) { rfLog('Ya corriendo'); return; }
  if (window.runnerFiltros.imagenes.length < 4 || window.runnerFiltros.benchmarks.length < 4) {
    rfLog('Faltan imagenes o benchmarks');
    return;
  }

  window.runnerFiltros.ejecutando = true;
  window.runnerFiltros.cancelar = false;
  window.runnerFiltros.resultados = [];

  const combos = rfGenerarCombos();
  const total = combos.length;
  rfLog('Iniciando: ' + total + ' combos x 4 imagenes (pipeline completo + LIDAR)');

  const t0 = performance.now();

  for (let i = 0; i < combos.length; i++) {
    if (window.runnerFiltros.cancelar) {
      rfLog('Cancelado en combo ' + (i + 1));
      break;
    }

    const combo = combos[i];
    const elCombo = document.getElementById('rfCombo');
    const elBar = document.getElementById('rfBar');
    if (elCombo) elCombo.textContent = (i + 1) + '/' + total;
    if (elBar) elBar.style.width = (((i + 1) / total) * 100).toFixed(0) + '%';

    try {
      const res = await rfEjecutarCombo(combo, window.runnerFiltros);
      window.runnerFiltros.resultados.push(res);
      rfLog('#' + (i + 1) + ' ' + combo.nombre + ' = ' + res.score + ' pts');
    } catch(e) {
      rfLog('Error en ' + combo.nombre + ': ' + e.message);
    }

    await new Promise(function(r) { setTimeout(r, 20); });
  }

  const t1 = performance.now();
  window.runnerFiltros.ejecutando = false;
  rfLog('Terminado en ' + ((t1 - t0) / 1000).toFixed(1) + 's');

  const ranking = window.runnerFiltros.resultados.slice().sort(function(a, b) { return b.score - a.score; });
  rfLog('=== TOP 10 ===');
  ranking.slice(0, 10).forEach(function(r, i) {
    rfLog((i + 1) + '. ' + r.nombre + ' = ' + r.score + ' pts');
  });

  try {
    const fs = Capacitor.Plugins.Filesystem;
    const out = {
      fecha: new Date().toISOString(),
      total: ranking.length,
      top10: ranking.slice(0, 10),
      completo: ranking
    };
    const json = JSON.stringify(out, null, 2);
    await fs.writeFile({
      path: 'filtros_ranking.json',
      directory: 'DOCUMENTS',
      encoding: 'utf8',
      data: json,
      recursive: true
    });
    rfLog('Guardado en Documents/filtros_ranking.json');
    alert('Ranking guardado en Documents/filtros_ranking.json');
  } catch(e) {
    rfLog('Error guardando: ' + e.message);
  }
}

function rfSetup() {
  const logEl = document.getElementById('rfLog');
  if (logEl) logEl.textContent = 'Runner Filtros v1 listo\n';

  const btnCI = document.getElementById('btnRfCargarImgs');
  const btnCB = document.getElementById('btnRfCargarBms');
  const inpI = document.getElementById('rfInputImgs');
  const inpB = document.getElementById('rfInputBms');
  if (btnCI) btnCI.onclick = rfCargarImgsClick;
  if (btnCB) btnCB.onclick = rfCargarBmsClick;
  if (inpI) inpI.onchange = function(e) { if (e.target.files.length > 0) rfProcesarImgs(e.target.files); };
  if (inpB) inpB.onchange = function(e) { if (e.target.files.length > 0) rfProcesarBms(e.target.files); };

  const btnI = document.getElementById('btnRfIniciar');
  const btnP = document.getElementById('btnRfParar');
  if (btnI) btnI.onclick = rfEjecutar;
  if (btnP) btnP.onclick = function() { window.runnerFiltros.cancelar = true; };

  const tabBtns = document.querySelectorAll('.tab');
  tabBtns.forEach(function(t) {
    if (t.dataset.tab === 'filtros' && !t.dataset.bound) {
      t.dataset.bound = '1';
      t.addEventListener('click', function() {
        document.querySelectorAll('.tab').forEach(function(x) { x.classList.remove('active'); });
        document.querySelectorAll('.tab-content').forEach(function(x) { x.classList.remove('active'); });
        this.classList.add('active');
        const c = document.getElementById('tab-filtros');
        if (c) c.classList.add('active');
      });
    }
  });

  console.log('runner_filtros.js listo');
}

setTimeout(rfSetup, 500);
