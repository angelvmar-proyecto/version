// ==============================================
// ui/runner.js
// Runner automático de 100 combinaciones sobre 4 imágenes.
// ==============================================

const runEl = function(id) { return document.getElementById(id); };

function runLog(msg) {
  const el = runEl('runnerLog');
  if (!el) return;
  el.textContent = msg + '\n' + el.textContent;
  console.log('[RUNNER] ' + msg);
}

// Recursos cargados
window.runnerRecursos = {
  imagenes: [],  // {nombre, img, ancho, alto}
  benchmarks: [], // {nombre, ancho, alto, H, V}
  ejecutando: false,
  cancelar: false,
  mejor: 0,
  resultados: []
};

// ============ Cargar imágenes desde Documents ============
async function runnerCargarImagenes() {
  const fs = (typeof Capacitor !== 'undefined' && Capacitor.Plugins) ? Capacitor.Plugins.Filesystem : null;
  if (!fs) { runLog('❌ Filesystem no disponible'); return 0; }

  const nombres = [
    'imagen_01_horarios.jpg',
    'imagen_02_olas.jpg',
    'imagen_03_sep1.jpg',
    'imagen_04_sep23.jpg'
  ];

  const cargadas = [];
  for (let i = 0; i < nombres.length; i++) {
    try {
      const r = await fs.readFile({
        path: nombres[i],
        directory: 'DOCUMENTS',
        encoding: 'base64'
      });
      const img = await new Promise(function(resolve, reject) {
        const im = new Image();
        im.onload = function() { resolve(im); };
        im.onerror = reject;
        im.src = 'data:image/jpeg;base64,' + r.data;
      });
      cargadas.push({
        nombre: nombres[i].replace('.jpg', ''),
        img: img,
        ancho: img.width,
        alto: img.height
      });
    } catch(e) {
      runLog('⚠️ No se pudo cargar ' + nombres[i] + ': ' + e.message);
    }
  }
  return cargadas;
}

// ============ Cargar benchmarks desde Documents/benchmarks ============
async function runnerCargarBenchmarks() {
  const fs = (typeof Capacitor !== 'undefined' && Capacitor.Plugins) ? Capacitor.Plugins.Filesystem : null;
  if (!fs) return 0;

  const archivos = [
    'benchmarks/benchmark_01_horarios.json',
    'benchmarks/benchmark_02_olas.json',
    'benchmarks/benchmark_03_sep1.json',
    'benchmarks/benchmark_04_sep23.json'
  ];

  const cargados = [];
  for (let i = 0; i < archivos.length; i++) {
    try {
      const r = await fs.readFile({
        path: archivos[i],
        directory: 'DOCUMENTS',
        encoding: 'utf8'
      });
      const bm = JSON.parse(r.data);
      cargados.push(bm);
    } catch(e) {
      runLog('⚠️ No se pudo cargar ' + archivos[i] + ': ' + e.message);
    }
  }
  return cargados;
}

// ============ Verificar recursos ============
async function runnerVerificar() {
  runLog('🔍 Verificando recursos...');
  const imgs = window.runnerRecursos.imagenes || [];
  const bms = window.runnerRecursos.benchmarks || [];

  if (imgs.length > 0) {
    runEl('runnerStatusImgs').innerHTML = 'Imágenes: <b style="color:#22c55e;">✅ ' + imgs.length + ' cargadas</b>';
    imgs.forEach(function(im) { runLog('  • ' + im.nombre + ' (' + im.ancho + '×' + im.alto + ')'); });
  } else {
    runEl('runnerStatusImgs').innerHTML = 'Imágenes: <b style="color:#dc2626;">❌ no cargadas</b>';
  }

  if (bms.length > 0) {
    runEl('runnerStatusBms').innerHTML = 'Benchmarks: <b style="color:#22c55e;">✅ ' + bms.length + ' cargados</b>';
    bms.forEach(function(bm) { runLog('  • ' + bm.nombre + ' H=' + bm.H.length + ' V=' + bm.V.length); });
  } else {
    runEl('runnerStatusBms').innerHTML = 'Benchmarks: <b style="color:#dc2626;">❌ no cargados</b>';
  }

  return imgs.length > 0 && bms.length > 0;
}

// ============ Definir las 100 combinaciones ============
function runnerGenerarCombinaciones() {
  const combos = [];

  // ==================== A3 (50 combos) ====================
  // Cobertura sola: 8 valores
  [0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.50].forEach(function(c) {
    combos.push({ nombre: 'A3_cob_' + c, params: { A3_COBERTURA_MINIMA: c } });
  });

  // Ortogonalidad sola: 7 valores
  [0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80].forEach(function(o) {
    combos.push({ nombre: 'A3_orto_' + o, params: { A3_UMBRAL_ORTOGONALIDAD: o } });
  });

  // Magnitud sola: 6 valores
  [80, 100, 110, 130, 160, 200].forEach(function(m) {
    combos.push({ nombre: 'A3_mag_' + m, params: { A3_UMBRAL_MAGNITUD: m } });
  });

  // Distancia sola: 4 valores
  [5, 8, 12, 20].forEach(function(d) {
    combos.push({ nombre: 'A3_dist_' + d, params: { A3_DISTANCIA_MIN: d } });
  });

  // Multi-change: 25 combos clave
  const multiA3 = [
    { cob: 0.15, orto: 0.60 },
    { cob: 0.15, orto: 0.70 },
    { cob: 0.20, orto: 0.60 },
    { cob: 0.20, orto: 0.65 },
    { cob: 0.20, orto: 0.70 },
    { cob: 0.25, orto: 0.60 },
    { cob: 0.25, orto: 0.65 },
    { cob: 0.25, orto: 0.70 },
    { cob: 0.25, orto: 0.80 },
    { cob: 0.30, orto: 0.60 },
    { cob: 0.30, orto: 0.65 },
    { cob: 0.30, orto: 0.70 },
    { cob: 0.30, orto: 0.75 },
    { cob: 0.35, orto: 0.60 },
    { cob: 0.35, orto: 0.65 },
    { cob: 0.35, orto: 0.70 },
    { cob: 0.40, orto: 0.65 },
    { cob: 0.40, orto: 0.75 },
    { cob: 0.20, orto: 0.55 },
    { cob: 0.15, orto: 0.55 },
    { cob: 0.25, orto: 0.55 },
    { cob: 0.10, orto: 0.65 },
    { cob: 0.10, orto: 0.70 },
    { cob: 0.15, orto: 0.75 },
    { cob: 0.20, orto: 0.75 }
  ];
  multiA3.forEach(function(mc, i) {
    combos.push({ nombre: 'A3_multi_' + i, params: { A3_COBERTURA_MINIMA: mc.cob, A3_UMBRAL_ORTOGONALIDAD: mc.orto } });
  });

  // ==================== REALCE (50 combos) ====================
  // Contraste solo (valor absoluto): 8 valores
  [15, 20, 25, 30, 35, 45, 55, 70].forEach(function(c) {
    combos.push({ nombre: 'REALCE_cont_' + c, params: { REALCE_CONTRASTE_MIN: c } });
  });

  // Umbral factor solo: 6 valores
  [0.30, 0.40, 0.45, 0.50, 0.55, 0.65].forEach(function(f) {
    combos.push({ nombre: 'REALCE_uf_' + f, params: { REALCE_UMBRAL_FACTOR: f } });
  });

  // Run H solo: 6 valores
  [0.15, 0.20, 0.25, 0.30, 0.40, 0.50].forEach(function(r) {
    combos.push({ nombre: 'REALCE_runH_' + r, params: { REALCE_MIN_RUN_H: r } });
  });

  // Run V solo: 6 valores
  [0.15, 0.20, 0.25, 0.30, 0.40, 0.50].forEach(function(r) {
    combos.push({ nombre: 'REALCE_runV_' + r, params: { REALCE_MIN_RUN_V: r } });
  });

  // Gap solo: 4 valores
  [10, 20, 30, 50].forEach(function(g) {
    combos.push({ nombre: 'REALCE_gap_' + g, params: { REALCE_GAP_MAX: g } });
  });

  // Multi-change: 20 combos
  const multiR = [
    { c: 20, rh: 0.20 },
    { c: 20, rh: 0.25 },
    { c: 25, rh: 0.20 },
    { c: 25, rh: 0.25 },
    { c: 25, rh: 0.30 },
    { c: 30, rh: 0.20 },
    { c: 30, rh: 0.25 },
    { c: 30, rh: 0.30 },
    { c: 35, rh: 0.25 },
    { c: 35, rh: 0.30 },
    { c: 15, rh: 0.15 },
    { c: 15, rh: 0.20 },
    { c: 15, rh: 0.25 },
    { c: 20, rh: 0.25, rv: 0.20 },
    { c: 20, rh: 0.25, rv: 0.25 },
    { c: 25, rh: 0.25, rv: 0.25 },
    { c: 25, rh: 0.30, rv: 0.30 },
    { c: 15, rh: 0.20, rv: 0.20 },
    { c: 30, rh: 0.35 },
    { c: 35, rh: 0.35 }
  ];
  multiR.forEach(function(mr, i) {
    const p = { REALCE_CONTRASTE_MIN: mr.c, REALCE_MIN_RUN_H: mr.rh };
    if (mr.rv) p.REALCE_MIN_RUN_V = mr.rv;
    combos.push({ nombre: 'REALCE_multi_' + i, params: p });
  });

  return combos;
}

// ============ Fuzzy match contra benchmark ============
function runContarAciertos(detectadas, reales, tolerancia) {
  if (!reales || reales.length === 0) return { aciertos: 0, falsas: detectadas.length, faltantes: 0 };
  const usados = new Array(reales.length).fill(false);
  let aciertos = 0;
  let falsas = 0;
  for (let i = 0; i < detectadas.length; i++) {
    let encontrado = false;
    for (let j = 0; j < reales.length; j++) {
      if (!usados[j] && Math.abs(detectadas[i] - reales[j]) <= tolerancia) {
        usados[j] = true;
        aciertos++;
        encontrado = true;
        break;
      }
    }
    if (!encontrado) falsas++;
  }
  let faltantes = 0;
  for (let j = 0; j < reales.length; j++) if (!usados[j]) faltantes++;
  return { aciertos: aciertos, falsas: falsas, faltantes: faltantes };
}

// ============ Analizar UNA imagen con combinación actual ============
function runAnalizarImagen(recurso) {
  const canvas = document.createElement('canvas');
  canvas.width = recurso.ancho;
  canvas.height = recurso.alto;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(recurso.img, 0, 0);
  const imageData = ctx.getImageData(0, 0, recurso.ancho, recurso.alto);

  const brillo = calcularBrillo(imageData);
  const brilloOptica = calcularBrilloColorAgnostico(imageData);
  escalarConfig(recurso.ancho, recurso.alto);
  calcularUmbralesBrillo(brillo, recurso.ancho, recurso.alto);

  // Recolectar resultados de los 3 algoritmos
  const r = {};
  try { r.a3 = detectarA3(brillo, recurso.ancho, recurso.alto); } catch(e) { r.a3 = { lineasH: [], lineasV: [] }; }
  try { r.realce = detectarRealce(brillo, recurso.ancho, recurso.alto); } catch(e) { r.realce = { lineasH: [], lineasV: [] }; }
  try { r.lvc = detectarLVC(brillo, recurso.ancho, recurso.alto); } catch(e) { r.lvc = { lineasH: [], lineasV: [] }; }

  return r;
}

// ============ Ejecutar UN combo sobre las 4 imágenes ============
async function runEjecutarCombo(combo, recursos) {
  // Aplicar parámetros al CONFIG y CONFIG_ESC
  const backup = {};
  Object.keys(combo.params).forEach(function(k) {
    backup[k] = CONFIG[k];
    CONFIG[k] = combo.params[k];
  });

  const resultadosPorImagen = {};
  let puntuacionTotal = 0;

  for (let i = 0; i < recursos.imagenes.length; i++) {
    const img = recursos.imagenes[i];
    const bm = recursos.benchmarks[i];
    if (!bm) continue;

    const r = runAnalizarImagen(img);

    // Comparar cada algoritmo vs benchmark
    const tol = 8; // 8px de tolerancia
    const a3H = runContarAciertos(r.a3.lineasH, bm.H, tol);
    const a3V = runContarAciertos(r.a3.lineasV, bm.V, tol);
    const reH = runContarAciertos(r.realce.lineasH, bm.H, tol);
    const reV = runContarAciertos(r.realce.lineasV, bm.V, tol);
    const lvV = runContarAciertos(r.lvc.lineasV, bm.V, tol);

    const puntImagen = (a3H.aciertos + a3V.aciertos + reH.aciertos + reV.aciertos + lvV.aciertos) * 2
                     - (a3H.falsas + a3V.falsas + reH.falsas + reV.falsas + lvV.falsas)
                     - (a3H.faltantes + a3V.faltantes + reH.faltantes + reV.faltantes + lvV.faltantes);

    puntuacionTotal += puntImagen;

    resultadosPorImagen[img.nombre] = {
      A3_H: a3H, A3_V: a3V,
      REALCE_H: reH, REALCE_V: reV,
      LVC_V: lvV,
      puntuacion: puntImagen
    };
  }

  // Restaurar parámetros
  Object.keys(backup).forEach(function(k) {
    CONFIG[k] = backup[k];
  });

  return {
    nombre: combo.nombre,
    params: combo.params,
    resultados_por_imagen: resultadosPorImagen,
    puntuacion_total: puntuacionTotal
  };
}

// ============ Iniciar el runner ============
async function runnerIniciar() {
  if (window.runnerRecursos.ejecutando) {
    runLog('⚠️ Ya hay un barrido en curso');
    return;
  }

  // Verificar recursos
  if (window.runnerRecursos.imagenes.length === 0 || window.runnerRecursos.benchmarks.length === 0) {
    const ok = await runnerVerificar();
    if (!ok) { runLog('❌ Recursos incompletos'); return; }
  }

  window.runnerRecursos.ejecutando = true;
  window.runnerRecursos.cancelar = false;
  window.runnerRecursos.resultados = [];
  window.runnerRecursos.mejor = 0;

  const combos = runnerGenerarCombinaciones();
  const total = combos.length;
  runLog('🚀 Iniciando barrido de ' + total + ' combinaciones...');

  const t0 = performance.now();

  for (let i = 0; i < combos.length; i++) {
    if (window.runnerRecursos.cancelar) {
      runLog('⏸️ Cancelado por el usuario en combo ' + i);
      break;
    }

    const combo = combos[i];
    runEl('runnerCombo').textContent = (i + 1) + '/' + total;
    runEl('runnerProgressBar').style.width = (((i + 1) / total) * 100).toFixed(0) + '%';

    try {
      const res = await runEjecutarCombo(combo, window.runnerRecursos);
      window.runnerRecursos.resultados.push(res);

      if (res.puntuacion_total > window.runnerRecursos.mejor) {
        window.runnerRecursos.mejor = res.puntuacion_total;
        runEl('runnerMejor').textContent = res.puntuacion_total.toFixed(1);
      }

      runLog('#' + (i + 1) + ' ' + combo.nombre + ' → ' + res.puntuacion_total.toFixed(1) + ' pts');
    } catch(e) {
      runLog('❌ Error en combo ' + (i + 1) + ': ' + e.message);
    }

    // Ceder control a la UI
    await new Promise(function(r) { setTimeout(r, 30); });
  }

  const t1 = performance.now();
  window.runnerRecursos.ejecutando = false;
  runLog('✅ Barrido terminado en ' + ((t1 - t0) / 1000).toFixed(1) + 's');
}

// ============ Copiar resultados ============
function runnerCopiarResultados() {
  if (window.runnerRecursos.resultados.length === 0) {
    alert('No hay resultados todavía');
    return;
  }

  const salida = {
    fecha: new Date().toISOString(),
    total_combos: window.runnerRecursos.resultados.length,
    mejor_combo: window.runnerRecursos.resultados.reduce(function(best, r) {
      return r.puntuacion_total > best.puntuacion_total ? r : best;
    }),
    todas_combinaciones: window.runnerRecursos.resultados
  };

  const json = JSON.stringify(salida, null, 2);
  navigator.clipboard.writeText(json).then(function() {
    runLog('📋 Resultados copiados (' + json.length + ' chars)');
    alert('Resultados copiados al portapapeles. Pégalos en el chat.');
  }).catch(function() {
    alert(json);
  });
}

// ============ Reset ============
function runnerReset() {
  if (confirm('¿Borrar todos los resultados del runner?')) {
    window.runnerRecursos.resultados = [];
    window.runnerRecursos.mejor = 0;
    runEl('runnerCombo').textContent = '0/100';
    runEl('runnerMejor').textContent = '0';
    runEl('runnerProgressBar').style.width = '0%';
    runEl('runnerLog').textContent = 'Reset. Listo para iniciar.';
  }
}

// ============ Setup ============


// ============ Cargar imágenes via file picker ============
function runCargarImgsClick() {
  const inp = runEl('runInputImgs');
  if (inp) { inp.value = ''; inp.click(); }
}

async function runProcesarImgs(files) {
  const arr = Array.from(files);
  if (arr.length < 4) {
    runLog('⚠️ Selecciona 4 imágenes (recibidas ' + arr.length + ')');
    return;
  }

  // Ordenar por nombre (contiene horarios/olas/sep1/sep23)
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
      runLog('❌ Error cargando ' + arr[i].name + ': ' + e.message);
    }
  }

  window.runnerRecursos.imagenes = imgs;
  runEl('runnerStatusImgs').innerHTML = 'Imágenes: <b style="color:#22c55e;">✅ ' + imgs.length + ' cargadas</b>';
  runLog('📷 ' + imgs.length + ' imágenes cargadas:');
  imgs.forEach(function(im) { runLog('  • ' + im.nombre + ' (' + im.ancho + '×' + im.alto + ')'); });
}

// ============ Cargar benchmarks via file picker ============
function runCargarBmsClick() {
  const inp = runEl('runInputBms');
  if (inp) { inp.value = ''; inp.click(); }
}

async function runProcesarBms(files) {
  const arr = Array.from(files);
  if (arr.length < 4) {
    runLog('⚠️ Selecciona 4 benchmarks (recibidos ' + arr.length + ')');
    return;
  }

  arr.sort(function(a, b) { return a.name.localeCompare(b.name); });

  const bms = [];
  for (let i = 0; i < arr.length; i++) {
    try {
      const texto = await arr[i].text();
      const bm = JSON.parse(texto);
      bms.push(bm);
    } catch(e) {
      runLog('❌ Error con ' + arr[i].name + ': ' + e.message);
    }
  }

  window.runnerRecursos.benchmarks = bms;
  runEl('runnerStatusBms').innerHTML = 'Benchmarks: <b style="color:#22c55e;">✅ ' + bms.length + ' cargados</b>';
  runLog('📂 ' + bms.length + ' benchmarks cargados:');
  bms.forEach(function(bm) { runLog('  • ' + bm.nombre + ' H=' + bm.H.length + ' V=' + bm.V.length); });
}

function runSetup() {
  const logEl = document.getElementById('runnerLog');
  function diag(msg) {
    console.log('[RUNNER] ' + msg);
    if (logEl) logEl.textContent = msg + '\n' + logEl.textContent;
  }

  diag('=== runSetup iniciado ===');

  const btnV = runEl('btnRunnerVerificar');
  const btnI = runEl('btnRunnerIniciar');
  const btnP = runEl('btnRunnerParar');
  const btnC = runEl('btnRunnerCopiar');
  const btnR = runEl('btnRunnerReset');

  diag('Botones encontrados: V=' + !!btnV + ' I=' + !!btnI + ' P=' + !!btnP + ' C=' + !!btnC + ' R=' + !!btnR);

  try {
    // File pickers
  const btnCI = runEl('btnRunnerCargarImgs');
  const btnCB = runEl('btnRunnerCargarBms');
  const inpI = runEl('runInputImgs');
  const inpB = runEl('runInputBms');
  if (btnCI) btnCI.onclick = runCargarImgsClick;
  if (btnCB) btnCB.onclick = runCargarBmsClick;
  if (inpI) inpI.onchange = function(e) { if (e.target.files.length > 0) runProcesarImgs(e.target.files); };
  if (inpB) inpB.onchange = function(e) { if (e.target.files.length > 0) runProcesarBms(e.target.files); };
  diag('File pickers conectados');

  if (btnV) btnV.onclick = runnerVerificar;
    if (btnI) btnI.onclick = runnerIniciar;
    if (btnP) btnP.onclick = function() { window.runnerRecursos.cancelar = true; };
    if (btnC) btnC.onclick = runnerCopiarResultados;
    if (btnR) btnR.onclick = runnerReset;
    diag('Listeners asignados');
  } catch(e) {
    diag('ERROR al asignar listeners: ' + e.message);
  }

  // Click handler para el tab (si no está en app.js)
  const tabBtns = document.querySelectorAll('.tab');
  tabBtns.forEach(function(t) {
    if (t.dataset.tab === 'runner' && !t.dataset.bound) {
      t.dataset.bound = '1';
      t.addEventListener('click', function() {
        document.querySelectorAll('.tab').forEach(function(x) { x.classList.remove('active'); });
        document.querySelectorAll('.tab-content').forEach(function(x) { x.classList.remove('active'); });
        this.classList.add('active');
        const c = document.getElementById('tab-runner');
        if (c) c.classList.add('active');
      });
    }
  });

  console.log('runner.js listo');
}

try {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runSetup);
  } else {
    runSetup();
  }
} catch(e) {
  console.error('FALLO GLOBAL runner.js:', e);
  var logEl = document.getElementById('runnerLog');
  if (logEl) logEl.textContent = 'FALLO GLOBAL: ' + e.message + '\n' + logEl.textContent;
}
