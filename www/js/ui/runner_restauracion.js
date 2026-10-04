// ==============================================
// ui/runner_restauracion.js
// Runner de restauracion de imagen.
// Guarda imagenes cuando supera el record.
// ==============================================

window.runnerRestauracion = {
  imagenes: [],
  benchmarks: [],
  ejecutando: false,
  cancelar: false,
  resultados: [],
  mejor: 0,
  tandaActual: 0
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
  if (arr.length < 4) {
    rrLog('Selecciona 4 imagenes (recibidas ' + arr.length + ')');
    return;
  }
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
  if (arr.length < 4) {
    rrLog('Selecciona 4 benchmarks (recibidos ' + arr.length + ')');
    return;
  }
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

function rrGenerarTanda1() {
  const combos = [];

  combos.push({ nombre: 'baseline', tipo: 'none', params: {} });

  [25, 50, 75, 100].forEach(function(sc) {
    [25, 50, 75, 100].forEach(function(ss) {
      combos.push({ nombre: 'bilat_c' + sc + '_s' + ss, tipo: 'bilateral', params: { sigmaColor: sc, sigmaSpace: ss } });
    });
  });

  [[1,95],[1,98],[1,99],[2,95],[2,98],[2,99],[5,95],[5,98],[5,99]].forEach(function(p) {
    combos.push({ nombre: 'contrast_' + p[0] + '_' + p[1], tipo: 'contrast', params: { percBajo: p[0], percAlto: p[1] } });
  });

  [1, 2, 3].forEach(function(r) {
    [0.5, 1.0, 1.5].forEach(function(a) {
      combos.push({ nombre: 'unsharp_r' + r + '_a' + a, tipo: 'unsharp', params: { radio: r, amount: a } });
    });
  });

  [1, 2, 3].forEach(function(r) {
    combos.push({ nombre: 'mediana_r' + r, tipo: 'mediana', params: { radio: r } });
  });

  [0.5, 1.0, 1.5].forEach(function(s) {
    combos.push({ nombre: 'gauss_s' + s, tipo: 'gaussiano', params: { sigma: s } });
  });

  [4, 8, 16].forEach(function(t) {
    [2, 4, 8].forEach(function(c) {
      combos.push({ nombre: 'clahe_t' + t + '_c' + c, tipo: 'clahe', params: { tiles: t, clip: c } });
    });
  });

  [8, 16].forEach(function(bs) {
    combos.push({ nombre: 'deblock_' + bs, tipo: 'deblock', params: { blockSize: bs } });
    combos.push({ nombre: 'deblock_bilat_' + bs, tipo: 'deblock+bilateral', params: { blockSize: bs, sigmaColor: 50, sigmaSpace: 50 } });
  });

  combos.push({ nombre: 'binarizar', tipo: 'binarizar', params: {} });

  [25, 50, 75, 100].forEach(function(sc) {
    combos.push({ nombre: 'bilat_bin_c' + sc, tipo: 'bilateral+binarizar', params: { sigmaColor: sc, sigmaSpace: 50 } });
  });

  [2, 4, 8, 16].forEach(function(r) {
    [0.001, 0.01, 0.1].forEach(function(e) {
      combos.push({ nombre: 'guided_r' + r + '_e' + e, tipo: 'guided', params: { radio: r, eps: e } });
    });
  });

  [4, 8].forEach(function(r) {
    [0.01, 0.1].forEach(function(e) {
      combos.push({ nombre: 'guided_bin_r' + r + '_e' + e, tipo: 'guided+binarizar', params: { radio: r, eps: e } });
    });
  });

  return combos;
}

function rrAplicarRestauracion(brillo, ancho, alto, combo) {
  try {
    switch (combo.tipo) {
      case 'none': return brillo;
      case 'bilateral': return restaurarBilateral(brillo, ancho, alto, combo.params.sigmaColor, combo.params.sigmaSpace);
      case 'contrast': return restaurarContrast(brillo, ancho, alto, combo.params.percBajo, combo.params.percAlto);
      case 'unsharp': return restaurarUnsharp(brillo, ancho, alto, combo.params.radio, combo.params.amount);
      case 'mediana': return restaurarMediana(brillo, ancho, alto, combo.params.radio);
      case 'gaussiano': return restaurarGaussiano(brillo, ancho, alto, combo.params.sigma);
      case 'clahe': return restaurarCLAHE(brillo, ancho, alto, combo.params.tiles, combo.params.clip);
      case 'deblock': return restaurarDeBlock(brillo, ancho, alto, combo.params.blockSize);
      case 'deblock+bilateral': {
        const db = restaurarDeBlock(brillo, ancho, alto, combo.params.blockSize);
        return restaurarBilateral(db, ancho, alto, combo.params.sigmaColor, combo.params.sigmaSpace);
      }
      case 'binarizar': return restaurarBinarizar(brillo, ancho, alto);
      case 'bilateral+binarizar': {
        const b = restaurarBilateral(brillo, ancho, alto, combo.params.sigmaColor, combo.params.sigmaSpace);
        return restaurarBinarizar(b, ancho, alto);
      }
      case 'guided': return restaurarGuided(brillo, ancho, alto, combo.params.radio, combo.params.eps);
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

async function rrGuardarImagenesRecord(res, combo, recursos) {
  const fs = Capacitor.Plugins.Filesystem;
  if (!fs) { rrLog('  Filesystem no disponible'); return; }

  for (let i = 0; i < recursos.imagenes.length; i++) {
    const img = recursos.imagenes[i];
    const r = res.resultados[img.nombre];
    if (!r || !r.brillo) continue;

    const canvas = document.createElement('canvas');
    canvas.width = img.ancho;
    canvas.height = img.alto;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(img.ancho, img.alto);
    for (let y = 0; y < img.alto; y++) {
      for (let x = 0; x < img.ancho; x++) {
        const v = Math.max(0, Math.min(255, r.brillo[y][x]));
        const idx = (y * img.ancho + x) * 4;
        imageData.data[idx] = v;
        imageData.data[idx + 1] = v;
        imageData.data[idx + 2] = v;
        imageData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    const dataURL = canvas.toDataURL('image/png');
    const base64 = dataURL.replace('data:image/png;base64,', '');

    const nombre = 'rest_mejor_' + combo.nombre + '_' + img.nombre + '.png';
    try {
      await fs.writeFile({
        path: nombre,
        directory: 'DOCUMENTS',
        encoding: 'base64',
        data: base64
      });
      rrLog('  Guardada: ' + nombre);
    } catch(e) {
      rrLog('  Error guardando ' + nombre + ': ' + e.message);
    }
  }
}

async function rrEjecutarCombo(combo, recursos) {
  const resultadosPorImagen = {};
  let puntuacionTotal = 0;

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
    resultadosPorImagen[img.nombre] = { metricas: metricas, puntuacion: puntImagen, brillo: brillo };
  }

  return {
    nombre: combo.nombre,
    tipo: combo.tipo,
    params: combo.params,
    resultados: resultadosPorImagen,
    puntuacion_total: puntuacionTotal
  };
}

async function rrIniciar() {
  if (window.runnerRestauracion.ejecutando) {
    rrLog('Ya hay una tanda en curso');
    return;
  }
  if (window.runnerRestauracion.imagenes.length < 4 || window.runnerRestauracion.benchmarks.length < 4) {
    rrLog('Faltan imagenes o benchmarks');
    return;
  }

  window.runnerRestauracion.ejecutando = true;
  window.runnerRestauracion.cancelar = false;
  window.runnerRestauracion.mejor = 0;

  const combos = rrGenerarTanda1();
  const total = combos.length;
  rrLog('Iniciando tanda 1: ' + total + ' combos x 4 imagenes x 13 detectores');

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
        try {
          await rrGuardarImagenesRecord(res, combo, window.runnerRestauracion);
        } catch(e) {
          rrLog('  Error guardando imagenes: ' + e.message);
        }
      } else {
        rrLog('#' + (i + 1) + ' ' + combo.nombre + ' = ' + res.puntuacion_total + ' pts');
      }

      // Limpiar brillos de resultados para no llenar memoria
      Object.keys(res.resultados).forEach(function(nombre) {
        delete res.resultados[nombre].brillo;
      });

      window.runnerRestauracion.resultados.push(res);
    } catch(e) {
      rrLog('Error en ' + combo.nombre + ': ' + e.message);
    }

    await new Promise(function(r) { setTimeout(r, 20); });
  }

  const t1 = performance.now();
  window.runnerRestauracion.ejecutando = false;
  rrLog('Tanda 1 terminada en ' + ((t1 - t0) / 1000).toFixed(1) + 's');
}

async function rrCopiarResultados() {
  if (window.runnerRestauracion.resultados.length === 0) {
    alert('No hay resultados todavia');
    return;
  }
  const out = {
    fecha: new Date().toISOString(),
    total_combos: window.runnerRestauracion.resultados.length,
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

  const resumen = out.resultados.map(function(r) {
    return { nombre: r.nombre, tipo: r.tipo, params: r.params, puntuacion_total: r.puntuacion_total };
  }).sort(function(a, b) { return b.puntuacion_total - a.puntuacion_total; });

  const jsonCorto = JSON.stringify({ fecha: out.fecha, ranking: resumen }, null, 2);
  navigator.clipboard.writeText(jsonCorto).then(function() {
    rrLog('Copiado resumen al portapapeles (' + jsonCorto.length + ' chars)');
    alert('Copiado resumen al portapapeles');
  }).catch(function() {
    alert('No se pudo guardar ni copiar');
  });
}

function rrSetup() {
  const logEl = document.getElementById('rrLog');
  if (logEl) logEl.textContent = 'Runner Restauracion listo\n';

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

  console.log('runner_restauracion.js listo');
}

setTimeout(rrSetup, 500);
