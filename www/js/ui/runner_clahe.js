// ==============================================
// ui/runner_clahe.js
// Runner para optimizar CLAHE + contrast+clahe.
// 30 combos, mide calidad visual para OCR.
// ==============================================

window.runnerClahe = {
  imagenes: [],
  ejecutando: false,
  cancelar: false,
  resultados: []
};

function clLog(msg) {
  const el = document.getElementById('clLog');
  if (!el) { console.log('[CL] ' + msg); return; }
  el.textContent = msg + '\n' + el.textContent;
  console.log('[CL] ' + msg);
}

function clCargarImgsClick() {
  const inp = document.getElementById('clInputImgs');
  if (inp) { inp.value = ''; inp.click(); }
}

async function clProcesarImgs(files) {
  const arr = Array.from(files);
  if (arr.length < 4) { clLog('Selecciona 4 imagenes'); return; }
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
      clLog('Error cargando ' + arr[i].name + ': ' + e.message);
    }
  }
  window.runnerClahe.imagenes = imgs;
  clLog(imgs.length + ' imagenes cargadas');
  imgs.forEach(function(im) { clLog('  ' + im.nombre + ' (' + im.ancho + 'x' + im.alto + ')'); });
}

function clGenerarCombos() {
  const combos = [];

  // 1) Baseline (sin filtro)
  combos.push({ nombre: 'baseline', tipo: 'none', params: {} });

  // 2) CLAHE solo: 5 tiles x 4 clips = 20
  [4, 8, 16, 32, 64].forEach(function(t) {
    [2, 4, 8, 16].forEach(function(c) {
      combos.push({ nombre: 'clahe_t' + t + '_c' + c, tipo: 'clahe', params: { tiles: t, clip: c } });
    });
  });

  // 3) Contrast + CLAHE: mejor contraste x 4 tiles = 4
  [8, 16, 32].forEach(function(t) {
    [4, 8].forEach(function(c) {
      combos.push({ nombre: 'cc_p5_t' + t + '_c' + c, tipo: 'contrast+clahe', params: { percBajo: 5, percAlto: 95, tiles: t, clip: c } });
    });
  });

  // 4) Contrast suave + CLAHE: 2
  [8, 16].forEach(function(t) {
    combos.push({ nombre: 'cc_p2_t' + t + '_c4', tipo: 'contrast+clahe', params: { percBajo: 2, percAlto: 98, tiles: t, clip: 4 } });
  });

  // 5) CLAHE + unsharp suave: 3
  [4, 8, 16].forEach(function(t) {
    combos.push({ nombre: 'clahe_t' + t + '_c4_unsharp', tipo: 'clahe+unsharp_suave', params: { tiles: t, clip: 4, radio: 1, amount: 0.3 } });
  });

  return combos; // 1 + 20 + 6 + 3 = 30
}

function clAplicarFiltro(brillo, ancho, alto, combo) {
  try {
    switch (combo.tipo) {
      case 'none': return brillo;
      case 'clahe': return restaurarCLAHE(brillo, ancho, alto, combo.params.tiles, combo.params.clip);
      case 'contrast+clahe': {
        const c = restaurarContrast(brillo, ancho, alto, combo.params.percBajo, combo.params.percAlto);
        return restaurarCLAHE(c, ancho, alto, combo.params.tiles, combo.params.clip);
      }
      case 'clahe+unsharp_suave': {
        const cl = restaurarCLAHE(brillo, ancho, alto, combo.params.tiles, combo.params.clip);
        return restaurarUnsharp(cl, ancho, alto, combo.params.radio, combo.params.amount);
      }
      default: return brillo;
    }
  } catch(e) {
    console.warn('[CL] Error filtro ' + combo.nombre + ': ' + e.message);
    return brillo;
  }
}

async function clEjecutar() {
  if (window.runnerClahe.ejecutando) { clLog('Ya corriendo'); return; }
  if (window.runnerClahe.imagenes.length < 4) { clLog('Faltan imagenes'); return; }

  window.runnerClahe.ejecutando = true;
  window.runnerClahe.cancelar = false;
  window.runnerClahe.resultados = [];

  const combos = clGenerarCombos();
  const total = combos.length;
  clLog('Iniciando: ' + total + ' combos x 4 imagenes');

  const t0 = performance.now();

  for (let i = 0; i < combos.length; i++) {
    if (window.runnerClahe.cancelar) {
      clLog('Cancelado en combo ' + (i + 1));
      break;
    }

    const combo = combos[i];
    const elCombo = document.getElementById('clCombo');
    const elBar = document.getElementById('clBar');
    if (elCombo) elCombo.textContent = (i + 1) + '/' + total;
    if (elBar) elBar.style.width = (((i + 1) / total) * 100).toFixed(0) + '%';

    const resultadosPorImagen = {};
    let scoreTotal = 0;

    for (let j = 0; j < window.runnerClahe.imagenes.length; j++) {
      const img = window.runnerClahe.imagenes[j];
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.ancho;
        canvas.height = img.alto;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img.img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.ancho, img.alto);
        let brillo = calcularBrillo(imageData);

        brillo = clAplicarFiltro(brillo, img.ancho, img.alto, combo);

        const metricas = window.metricaCalidadOCR(brillo, img.ancho, img.alto);
        resultadosPorImagen[img.nombre] = metricas;
        scoreTotal += metricas.score;
      } catch(e) {
        clLog('Error en ' + combo.nombre + ' x ' + img.nombre + ': ' + e.message);
      }
    }

    const scorePromedio = scoreTotal / window.runnerClahe.imagenes.length;

    window.runnerClahe.resultados.push({
      nombre: combo.nombre,
      tipo: combo.tipo,
      params: combo.params,
      resultados: resultadosPorImagen,
      score: scorePromedio
    });

    clLog('#' + (i + 1) + ' ' + combo.nombre + ' = ' + scorePromedio.toFixed(4));

    await new Promise(function(r) { setTimeout(r, 20); });
  }

  const t1 = performance.now();
  window.runnerClahe.ejecutando = false;
  clLog('Evaluacion terminada en ' + ((t1 - t0) / 1000).toFixed(1) + 's');

  const ranking = window.runnerClahe.resultados.slice().sort(function(a, b) { return b.score - a.score; });
  clLog('=== TOP 10 ===');
  ranking.slice(0, 10).forEach(function(r, i) {
    clLog((i + 1) + '. ' + r.nombre + ' = ' + r.score.toFixed(4));
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
      path: 'clahe_ranking.json',
      directory: 'DOCUMENTS',
      encoding: 'utf8',
      data: json,
      recursive: true
    });
    clLog('Guardado en Documents/clahe_ranking.json');
    alert('Ranking guardado en Documents/clahe_ranking.json');
  } catch(e) {
    clLog('Error guardando: ' + e.message);
  }
}

function clSetup() {
  const logEl = document.getElementById('clLog');
  if (logEl) logEl.textContent = 'Runner CLAHE v1 listo\n';

  const btnCI = document.getElementById('btnClCargarImgs');
  const inpI = document.getElementById('clInputImgs');
  if (btnCI) btnCI.onclick = clCargarImgsClick;
  if (inpI) inpI.onchange = function(e) { if (e.target.files.length > 0) clProcesarImgs(e.target.files); };

  const btnI = document.getElementById('btnClIniciar');
  const btnP = document.getElementById('btnClParar');
  if (btnI) btnI.onclick = clEjecutar;
  if (btnP) btnP.onclick = function() { window.runnerClahe.cancelar = true; };

  const tabBtns = document.querySelectorAll('.tab');
  tabBtns.forEach(function(t) {
    if (t.dataset.tab === 'clahe' && !t.dataset.bound) {
      t.dataset.bound = '1';
      t.addEventListener('click', function() {
        document.querySelectorAll('.tab').forEach(function(x) { x.classList.remove('active'); });
        document.querySelectorAll('.tab-content').forEach(function(x) { x.classList.remove('active'); });
        this.classList.add('active');
        const c = document.getElementById('tab-clahe');
        if (c) c.classList.add('active');
      });
    }
  });

  console.log('runner_clahe.js listo');
}

setTimeout(clSetup, 500);
