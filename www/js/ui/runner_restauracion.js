// ==============================================
// ui/runner_restauracion.js
// Runner de restauracion con persistencia.
// Tanda 2: solo los combos prometedores (~18).
// ==============================================

window.runnerRestauracion = {
  imagenes: [],
  benchmarks: [],
  ejecutando: false,
  cancelar: false,
  resultados: [],
  mejor: 0,
  ultimoCombo: 0
};

function rrLog(msg) {
  const el = document.getElementById('rrLog');
  if (!el) { console.log('[RR] ' + msg); return; }
  el.textContent = msg + '\n' + el.textContent;
  console.log('[RR] ' + msg);
}

function rrCargarImgsClick() {
  const inp = document.getElementById('rrInputImgs');
  if (inp) { inp.value = ''; inp.click(); }
}

async function rrProcesarImgs(files) {
  const arr = Array.from(files);
  if (arr.length < 4) { rrLog('Selecciona 4 imagenes'); return; }
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
      rrLog('Error cargando ' + arr[i].name + ': ' + e.message);
    }
  }
  window.runnerRestauracion.imagenes = imgs;
  rrLog(imgs.length + ' imagenes cargadas');
  imgs.forEach(function(im) { rrLog('  ' + im.nombre + ' (' + im.ancho + 'x' + im.alto + ')'); });
}

function rrCargarBmsClick() {
  const inp = document.getElementById('rrInputBms');
  if (inp) { inp.value = ''; inp.click(); }
}

async function rrProcesarBms(files) {
  const arr = Array.from(files);
  if (arr.length < 4) { rrLog('Selecciona 4 benchmarks'); return; }
  arr.sort(function(a, b) { return a.name.localeCompare(b.name); });

  const bms = [];
  for (let i = 0; i < arr.length; i++) {
    try {
      const texto = await arr[i].text();
      bms.push(JSON.parse(texto));
    } catch(e) {
      rrLog('Error con ' + arr[i].name + ': ' + e.message);
    }
  }
  window.runnerRestauracion.benchmarks = bms;
  rrLog(bms.length + ' benchmarks cargados');
  bms.forEach(function(bm) { rrLog('  ' + bm.nombre + ' H=' + bm.H.length + ' V=' + bm.V.length); });
}

// ============ Tanda 2 CORTA ============
function rrGenerarTanda1() {
  const combos = [];

  // 1. Baseline
  combos.push({ nombre: 'baseline', tipo: 'none', params: {} });

  // 2. Unsharp: 3 radios × 3 amounts = 9
  [1, 2, 3].forEach(function(r) {
    [0.5, 1.0, 1.5].forEach(function(a) {
      combos.push({ nombre: 'unsharp_r' + r + '_a' + a, tipo: 'unsharp', params: { radio: r, amount: a } });
    });
  });

  // 3. Contrast: 3
  [[5,95],[5,98],[5,99]].forEach(function(p) {
    combos.push({ nombre: 'contrast_' + p[0] + '_' + p[1], tipo: 'contrast', params: { percBajo: p[0], percAlto: p[1] } });
  });

  // 4. CLAHE: 3
  [[16,8],[4,4],[8,8]].forEach(function(tc) {
    combos.push({ nombre: 'clahe_t' + tc[0] + '_c' + tc[1], tipo: 'clahe', params: { tiles: tc[0], clip: tc[1] } });
  });

  // 5. Guided+binarizar: 2
  [4, 8].forEach(function(r) {
    combos.push({ nombre: 'guided_bin_r' + r, tipo: 'guided+binarizar', params: { radio: r, eps: 0.1 } });
  });

  return combos;
}

function rrAplicarRestauracion(brillo, ancho, alto, combo) {
  try {
    switch (combo.tipo) {
      case 'none': return brillo;
      case 'unsharp': return restaurarUnsharp(brillo, ancho, alto, combo.params.radio, combo.params.amount);
      case 'contrast': return restaurarContrast(brillo, ancho, alto, combo.params.percBajo, combo.params.percAlto);
      case 'clahe': return restaurarCLAHE(brillo, ancho, alto, combo.params.tiles, combo.params.clip);
      case 'guided+binarizar': {
        const g = restaurarGuided(brillo, ancho, alto, combo.params.radio, combo.params.eps);
        return restaurarBinarizar(g, ancho, alto);
      }
      default: return brillo;
    }
  } catch(e) {
    console.warn('[RR] Error en ' + combo.nombre + ': ' + e.message);
    return brillo;
  }
}

function rrEvaluarImagen(recurso, brilloRestaurado) {
  const ancho = recurso.ancho, alto = recurso.alto;
  const detectores = [
    { nombre: 'optica',   fn: function() { return detectarOptica(brilloRestaurado, ancho, alto); } },
    { nombre: 'eco',      fn: function() { return detectarEco(brilloRestaurado, ancho, alto); } },
    { nombre: 'a3',       fn: function() { return detectarA3(brilloRestaurado, ancho, alto); } },
    { nombre: 'lvc',      fn: function() { return detectarLVC(brilloRestaurado, ancho, alto); } },
    { nombre: 'cont',     fn: function() { return detectarContinuidad(brilloRestaurado, ancho, alto); } },
    { nombre: 'realce',   fn: function() { return detectarRealce(brilloRestaurado, ancho, alto); } },
    { nombre: 'openv',    fn: function() { return detectarOPENV(brilloRestaurado, ancho, alto); } },
    { nombre: 'ml',       fn: function() { return detectarML(brilloRestaurado, ancho, alto); } },
    { nombre: 'ws',       fn: function() { return detectarWS(brilloRestaurado, ancho, alto); } },
    { nombre: 'frangi',   fn: function() { return detectarFrangi(brilloRestaurado, ancho, alto); } },
    { nombre: 'blackhat', fn: function() { return detectarBlackHat(brilloRestaurado, ancho, alto); } },
    { nombre: 'hough',    fn: function() { return detectarHough(brilloRestaurado, ancho, alto); } },
    { nombre: 'morfo',    fn: function() { return detectarMorfologico(brilloRestaurado, ancho, alto); } }
  ];
  const r = {};
  for (let i = 0; i < detectores.length; i++) {
    const d = detectores[i];
    try { r[d.nombre] = d.fn(); } catch(e) { r[d.nombre] = { lineasH: [], lineasV: [] }; }
  }
  return r;
}

// ============ Guardar imagen como PNG con <a download> ============
function rrGuardarPNG(brillo, ancho, alto, nombreArchivo) {
  return new Promise(function(resolve) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = ancho;
      canvas.height = alto;
      const ctx = canvas.getContext('2d');
      const imageData = ctx.createImageData(ancho, alto);
      for (let y = 0; y < alto; y++) {
        for (let x = 0; x < ancho; x++) {
          const v = Math.max(0, Math.min(255, brillo[y][x]));
          const idx = (y * ancho + x) * 4;
          imageData.data[idx] = v;
          imageData.data[idx + 1] = v;
          imageData.data[idx + 2] = v;
          imageData.data[idx + 3] = 255;
        }
      }
      ctx.putImageData(imageData, 0, 0);
      const dataURL = canvas.toDataURL('image/png');

      const a = document.createElement('a');
      a.href = dataURL;
      a.download = nombreArchivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      rrLog('  Descargada: ' + nombreArchivo);
      resolve(true);
    } catch(e) {
      rrLog('  Error PNG ' + nombreArchivo + ': ' + e.message);
      resolve(false);
    }
  });
}

// ============ Persistencia ============
async function rrGuardarProgreso() {
  try {
    const fs = Capacitor.Plugins.Filesystem;
    if (!fs) return;
    const data = {
      ultimoCombo: window.runnerRestauracion.ultimoCombo,
      mejor: window.runnerRestauracion.mejor,
      resultados: window.runnerRestauracion.resultados.map(function(r) {
        return { nombre: r.nombre, tipo: r.tipo, params: r.params, puntuacion_total: r.puntuacion_total };
      })
    };
    await fs.writeFile({
      path: 'runner_progress.json',
      directory: 'DOCUMENTS',
      encoding: 'utf8',
      data: JSON.stringify(data)
    });
  } catch(e) {
    console.warn('Progress save fallo: ' + e.message);
  }
}

async function rrEjecutarCombo(combo, recursos) {
  const resultadosPorImagen = {};
  let puntuacionTotal = 0;
  const brillosPorImagen = {};

  for (let i = 0; i < recursos.imagenes.length; i++) {
    const img = recursos.imagenes[i];
    const bm = recursos.benchmarks[i];
    if (!bm) continue;

    const canvas = document.createElement('canvas');
    canvas.width = img.ancho;
    canvas.height = img.alto;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img.img, 0, 0);
    const imageData = ctx.getImageData(0, 0, img.ancho, img.alto);
    let brillo = calcularBrillo(imageData);

    brillo = rrAplicarRestauracion(brillo, img.ancho, img.alto, combo);

    calcularUmbralesBrillo(brillo, img.ancho, img.alto);

    const r = rrEvaluarImagen(img, brillo);

    const tol = 8;
    const metricas = {};
    let puntImagen = 0;
    Object.keys(r).forEach(function(alg) {
      const res = r[alg];
      const mH = runContarAciertos(res.lineasH || [], bm.H, tol);
      const mV = runContarAciertos(res.lineasV || [], bm.V, tol);
      const pts = (mH.aciertos + mV.aciertos) * 2 - (mH.falsas + mV.falsas) - (mH.faltantes + mV.faltantes);
      metricas[alg] = { H: mH, V: mV, pts: pts };
      puntImagen += pts;
    });

    puntuacionTotal += puntImagen;
    resultadosPorImagen[img.nombre] = { metricas: metricas, puntuacion: puntImagen };
    brillosPorImagen[img.nombre] = brillo;
  }

  return {
    nombre: combo.nombre,
    tipo: combo.tipo,
    params: combo.params,
    resultados: resultadosPorImagen,
    puntuacion_total: puntuacionTotal,
    brillos: brillosPorImagen
  };
}

async function rrIniciar() {
  if (window.runnerRestauracion.ejecutando) { rrLog('Ya hay una tanda en curso'); return; }
  if (window.runnerRestauracion.imagenes.length < 4 || window.runnerRestauracion.benchmarks.length < 4) {
    rrLog('Faltan imagenes o benchmarks');
    return;
  }

  window.runnerRestauracion.ejecutando = true;
  window.runnerRestauracion.cancelar = false;
  window.runnerRestauracion.mejor = 0;
  window.runnerRestauracion.resultados = [];
  window.runnerRestauracion.ultimoCombo = 0;

  const combos = rrGenerarTanda1();
  const total = combos.length;
  rrLog('Iniciando tanda CORTA: ' + total + ' combos');

  const t0 = performance.now();

  for (let i = 0; i < combos.length; i++) {
    if (window.runnerRestauracion.cancelar) {
      rrLog('Cancelado en combo ' + (i + 1));
      break;
    }

    const combo = combos[i];
    const elCombo = document.getElementById('rrCombo');
    const elBar = document.getElementById('rrBar');
    if (elCombo) elCombo.textContent = (i + 1) + '/' + total;
    if (elBar) elBar.style.width = (((i + 1) / total) * 100).toFixed(0) + '%';

    try {
      const res = await rrEjecutarCombo(combo, window.runnerRestauracion);

      const esRecord = res.puntuacion_total > window.runnerRestauracion.mejor;
      if (esRecord) {
        window.runnerRestauracion.mejor = res.puntuacion_total;
        rrLog('#' + (i + 1) + ' ' + combo.nombre + ' = ' + res.puntuacion_total + ' pts [RECORD]');
        for (let k = 0; k < window.runnerRestauracion.imagenes.length; k++) {
          const im = window.runnerRestauracion.imagenes[k];
          const b = res.brillos[im.nombre];
          if (b) {
            await rrGuardarPNG(b, im.ancho, im.alto, 'rest_mejor_' + combo.nombre + '_' + im.nombre + '.png');
          }
        }
      } else {
        rrLog('#' + (i + 1) + ' ' + combo.nombre + ' = ' + res.puntuacion_total + ' pts');
      }

      // Limpiar brillos para no llenar memoria
      res.brillos = null;
      delete res.brillos;

      window.runnerRestauracion.resultados.push(res);
      window.runnerRestauracion.ultimoCombo = i + 1;

      // Persistir cada 3 combos
      if ((i + 1) % 3 === 0 || i === combos.length - 1) {
        await rrGuardarProgreso();
      }
    } catch(e) {
      rrLog('Error en ' + combo.nombre + ': ' + e.message);
    }

    await new Promise(function(r) { setTimeout(r, 20); });
  }

  const t1 = performance.now();
  window.runnerRestauracion.ejecutando = false;
  rrLog('Tanda terminada en ' + ((t1 - t0) / 1000).toFixed(1) + 's');
  await rrGuardarProgreso();
}

async function rrCopiarResultados() {
  if (window.runnerRestauracion.resultados.length === 0) {
    alert('No hay resultados todavia');
    return;
  }
  const out = {
    fecha: new Date().toISOString(),
    total_combos: window.runnerRestauracion.resultados.length,
    mejor: window.runnerRestauracion.mejor,
    resultados: window.runnerRestauracion.resultados
  };
  const json = JSON.stringify(out, null, 2);

  try {
    const fs = Capacitor.Plugins.Filesystem;
    if (fs) {
      await fs.writeFile({
        path: 'tanda1_resultados.json',
        directory: 'DOCUMENTS',
        encoding: 'utf8',
        data: json
      });
      rrLog('Guardado en Documents/tanda1_resultados.json (' + json.length + ' chars)');
      alert('Guardado en Documents/tanda1_resultados.json');
      return;
    }
  } catch(e) {
    console.warn('Filesystem fallo: ' + e.message);
  }

  alert('No se pudo guardar');
}

function rrSetup() {
  const logEl = document.getElementById('rrLog');
  if (logEl) logEl.textContent = 'Runner Restauracion v2 (corta + persistencia)\n';

  const btnCI = document.getElementById('btnRrCargarImgs');
  const btnCB = document.getElementById('btnRrCargarBms');
  const inpI = document.getElementById('rrInputImgs');
  const inpB = document.getElementById('rrInputBms');
  if (btnCI) btnCI.onclick = rrCargarImgsClick;
  if (btnCB) btnCB.onclick = rrCargarBmsClick;
  if (inpI) inpI.onchange = function(e) { if (e.target.files.length > 0) rrProcesarImgs(e.target.files); };
  if (inpB) inpB.onchange = function(e) { if (e.target.files.length > 0) rrProcesarBms(e.target.files); };

  const btnI = document.getElementById('btnRrIniciar');
  const btnP = document.getElementById('btnRrParar');
  const btnC = document.getElementById('btnRrCopiar');
  if (btnI) btnI.onclick = rrIniciar;
  if (btnP) btnP.onclick = function() { window.runnerRestauracion.cancelar = true; };
  if (btnC) btnC.onclick = rrCopiarResultados;

  const tabBtns = document.querySelectorAll('.tab');
  tabBtns.forEach(function(t) {
    if (t.dataset.tab === 'restauracion' && !t.dataset.bound) {
      t.dataset.bound = '1';
      t.addEventListener('click', function() {
        document.querySelectorAll('.tab').forEach(function(x) { x.classList.remove('active'); });
        document.querySelectorAll('.tab-content').forEach(function(x) { x.classList.remove('active'); });
        this.classList.add('active');
        const c = document.getElementById('tab-restauracion');
        if (c) c.classList.add('active');
      });
    }
  });

  console.log('runner_restauracion.js v2 listo');
}

setTimeout(rrSetup, 500);
