// ==============================================
// ui/runner_ocr.js
// Runner para evaluar calidad de imagen post-restauracion.
// Mide nitidez, contraste, ruido, entropia. Sin OCR.
// ==============================================

window.runnerOCR = {
  imagenes: [],
  ejecutando: false,
  cancelar: false,
  resultados: [],
  mejor: 0
};

function ocrLog(msg) {
  const el = document.getElementById('ocrLog');
  if (!el) { console.log('[OCR] ' + msg); return; }
  el.textContent = msg + '\n' + el.textContent;
  console.log('[OCR] ' + msg);
}

function ocrCargarImgsClick() {
  const inp = document.getElementById('ocrInputImgs');
  if (inp) { inp.value = ''; inp.click(); }
}

async function ocrProcesarImgs(files) {
  const arr = Array.from(files);
  if (arr.length < 4) { ocrLog('Selecciona 4 imagenes'); return; }
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
      ocrLog('Error cargando ' + arr[i].name + ': ' + e.message);
    }
  }
  window.runnerOCR.imagenes = imgs;
  ocrLog(imgs.length + ' imagenes cargadas');
  imgs.forEach(function(im) { ocrLog('  ' + im.nombre + ' (' + im.ancho + 'x' + im.alto + ')'); });
}

// Filtros a probar (definidos localmente para no depender de runner_restauracion)
function ocrAplicarFiltro(brillo, ancho, alto, combo) {
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
      case 'guided': return restaurarGuided(brillo, ancho, alto, combo.params.radio, combo.params.eps);
      case 'bilateral+contrast': {
        const b = restaurarBilateral(brillo, ancho, alto, combo.params.sigmaColor, combo.params.sigmaSpace);
        return restaurarContrast(b, ancho, alto, combo.params.percBajo, combo.params.percAlto);
      }
      case 'bilateral+clahe': {
        const b = restaurarBilateral(brillo, ancho, alto, combo.params.sigmaColor, combo.params.sigmaSpace);
        return restaurarCLAHE(b, ancho, alto, combo.params.tiles, combo.params.clip);
      }
      case 'bilateral+unsharp_suave': {
        const b = restaurarBilateral(brillo, ancho, alto, combo.params.sigmaColor, combo.params.sigmaSpace);
        return restaurarUnsharp(b, ancho, alto, combo.params.radio, combo.params.amount);
      }
      case 'contrast+clahe': {
        const c = restaurarContrast(brillo, ancho, alto, combo.params.percBajo, combo.params.percAlto);
        return restaurarCLAHE(c, ancho, alto, combo.params.tiles, combo.params.clip);
      }
      case 'contrast+unsharp_suave': {
        const c = restaurarContrast(brillo, ancho, alto, combo.params.percBajo, combo.params.percAlto);
        return restaurarUnsharp(c, ancho, alto, combo.params.radio, combo.params.amount);
      }
      case 'clahe+unsharp_suave': {
        const cl = restaurarCLAHE(brillo, ancho, alto, combo.params.tiles, combo.params.clip);
        return restaurarUnsharp(cl, ancho, alto, combo.params.radio, combo.params.amount);
      }
      default: return brillo;
    }
  } catch(e) {
    console.warn('[OCR] Error filtro ' + combo.nombre + ': ' + e.message);
    return brillo;
  }
}

function ocrGenerarCombos() {
  const combos = [];

  // Baseline
  combos.push({ nombre: 'baseline', tipo: 'none', params: {} });

  // Filtros suaves (orientados a texto legible)
  // Unsharp suave (amounts bajos)
  [1, 2].forEach(function(r) {
    [0.3, 0.5, 0.8].forEach(function(a) {
      combos.push({ nombre: 'unsharp_r' + r + '_a' + a, tipo: 'unsharp', params: { radio: r, amount: a } });
    });
  });

  // Contrast stretch moderado
  [[2,98],[5,95],[1,99]].forEach(function(p) {
    combos.push({ nombre: 'contrast_' + p[0] + '_' + p[1], tipo: 'contrast', params: { percBajo: p[0], percAlto: p[1] } });
  });

  // CLAHE (local contrast)
  [4, 8].forEach(function(t) {
    [2, 4].forEach(function(c) {
      combos.push({ nombre: 'clahe_t' + t + '_c' + c, tipo: 'clahe', params: { tiles: t, clip: c } });
    });
  });

  // Bilateral suave (para denoising)
  [[25,25],[50,50],[75,75]].forEach(function(ss) {
    combos.push({ nombre: 'bilat_c' + ss[0] + '_s' + ss[1], tipo: 'bilateral', params: { sigmaColor: ss[0], sigmaSpace: ss[1] } });
  });

  // Guided suave
  [[2,0.01],[4,0.01],[8,0.01]].forEach(function(g) {
    combos.push({ nombre: 'guided_r' + g[0] + '_e' + g[1], tipo: 'guided', params: { radio: g[0], eps: g[1] } });
  });

  // Mediana (denoise)
  [1, 2].forEach(function(r) {
    combos.push({ nombre: 'mediana_r' + r, tipo: 'mediana', params: { radio: r } });
  });

  // Gaussiano suave
  [0.5, 1.0].forEach(function(s) {
    combos.push({ nombre: 'gauss_s' + s, tipo: 'gaussiano', params: { sigma: s } });
  });

  // Combinaciones prometedoras para OCR
  // bilateral + contrast (denoise + contraste)
  [[50,50]].forEach(function(bs) {
    [[2,98],[5,95]].forEach(function(c) {
      combos.push({ nombre: 'bilat_contrast_c' + bs[0] + '_p' + c[0], tipo: 'bilateral+contrast', params: { sigmaColor: bs[0], sigmaSpace: bs[1], percBajo: c[0], percAlto: c[1] } });
    });
  });

  // bilateral + clahe
  [[50,50]].forEach(function(bs) {
    [[8,4]].forEach(function(cl) {
      combos.push({ nombre: 'bilat_clahe_c' + bs[0] + '_t' + cl[0], tipo: 'bilateral+clahe', params: { sigmaColor: bs[0], sigmaSpace: bs[1], tiles: cl[0], clip: cl[1] } });
    });
  });

  // contrast + clahe (contraste global + local)
  [[2,98],[5,95]].forEach(function(c) {
    [[8,4]].forEach(function(cl) {
      combos.push({ nombre: 'contrast_clahe_p' + c[0] + '_t' + cl[0], tipo: 'contrast+clahe', params: { percBajo: c[0], percAlto: c[1], tiles: cl[0], clip: cl[1] } });
    });
  });

  // contrast + unsharp suave
  [[2,98]].forEach(function(c) {
    [[1,0.3],[1,0.5]].forEach(function(u) {
      combos.push({ nombre: 'contrast_unsharp_p' + c[0] + '_a' + u[1], tipo: 'contrast+unsharp_suave', params: { percBajo: c[0], percAlto: c[1], radio: u[0], amount: u[1] } });
    });
  });

  // clahe + unsharp suave
  [[8,4]].forEach(function(cl) {
    [[1,0.3]].forEach(function(u) {
      combos.push({ nombre: 'clahe_unsharp_t' + cl[0], tipo: 'clahe+unsharp_suave', params: { tiles: cl[0], clip: cl[1], radio: u[0], amount: u[1] } });
    });
  });

  return combos;
}

async function ocrEjecutar() {
  if (window.runnerOCR.ejecutando) { ocrLog('Ya corriendo'); return; }
  if (window.runnerOCR.imagenes.length < 4) { ocrLog('Faltan imagenes'); return; }

  window.runnerOCR.ejecutando = true;
  window.runnerOCR.cancelar = false;
  window.runnerOCR.resultados = [];

  const combos = ocrGenerarCombos();
  const total = combos.length;
  ocrLog('Iniciando evaluacion de calidad: ' + total + ' filtros x 4 imagenes');

  const t0 = performance.now();

  for (let i = 0; i < combos.length; i++) {
    if (window.runnerOCR.cancelar) {
      ocrLog('Cancelado en filtro ' + (i + 1));
      break;
    }

    const combo = combos[i];
    const elCombo = document.getElementById('ocrCombo');
    const elBar = document.getElementById('ocrBar');
    if (elCombo) elCombo.textContent = (i + 1) + '/' + total;
    if (elBar) elBar.style.width = (((i + 1) / total) * 100).toFixed(0) + '%';

    const resultadosPorImagen = {};
    let scoreTotal = 0;

    for (let j = 0; j < window.runnerOCR.imagenes.length; j++) {
      const img = window.runnerOCR.imagenes[j];
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.ancho;
        canvas.height = img.alto;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img.img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.ancho, img.alto);
        let brillo = calcularBrillo(imageData);

        brillo = ocrAplicarFiltro(brillo, img.ancho, img.alto, combo);

        const metricas = metricaCalidadOCR(brillo, img.ancho, img.alto);
        resultadosPorImagen[img.nombre] = metricas;
        scoreTotal += metricas.score;
      } catch(e) {
        ocrLog('Error en ' + combo.nombre + ' x ' + img.nombre + ': ' + e.message);
      }
    }

    const scorePromedio = scoreTotal / window.runnerOCR.imagenes.length;

    window.runnerOCR.resultados.push({
      nombre: combo.nombre,
      tipo: combo.tipo,
      params: combo.params,
      resultados: resultadosPorImagen,
      score: scorePromedio
    });

    ocrLog('#' + (i + 1) + ' ' + combo.nombre + ' = ' + scorePromedio.toFixed(4));

    await new Promise(function(r) { setTimeout(r, 20); });
  }

  const t1 = performance.now();
  window.runnerOCR.ejecutando = false;
  ocrLog('Evaluacion terminada en ' + ((t1 - t0) / 1000).toFixed(1) + 's');

  // Ranking
  const ranking = window.runnerOCR.resultados.slice().sort(function(a, b) { return b.score - a.score; });
  ocrLog('=== TOP 10 ===');
  ranking.slice(0, 10).forEach(function(r, i) {
    ocrLog((i + 1) + '. ' + r.nombre + ' = ' + r.score.toFixed(4));
  });

  // Guardar JSON
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
      path: 'ocr_ranking.json',
      directory: 'DOCUMENTS',
      encoding: 'utf8',
      data: json,
      recursive: true
    });
    ocrLog('Ranking guardado en Documents/ocr_ranking.json');
    alert('Ranking guardado en Documents/ocr_ranking.json');
  } catch(e) {
    ocrLog('Error guardando JSON: ' + e.message);
  }
}

function ocrCopiarResultados() {
  const ranking = window.runnerOCR.resultados.slice().sort(function(a, b) { return b.score - a.score; });
  const json = JSON.stringify({ top10: ranking.slice(0, 10), completo: ranking }, null, 2);
  navigator.clipboard.writeText(json).then(function() {
    alert('Copiado (' + json.length + ' chars)');
  }).catch(function() {
    alert(json.substring(0, 2000));
  });
}

function ocrSetup() {
  const logEl = document.getElementById('ocrLog');
  if (logEl) logEl.textContent = 'Runner OCR v1 listo\n';

  const btnCI = document.getElementById('btnOcrCargarImgs');
  const inpI = document.getElementById('ocrInputImgs');
  if (btnCI) btnCI.onclick = ocrCargarImgsClick;
  if (inpI) inpI.onchange = function(e) { if (e.target.files.length > 0) ocrProcesarImgs(e.target.files); };

  const btnI = document.getElementById('btnOcrIniciar');
  const btnP = document.getElementById('btnOcrParar');
  const btnC = document.getElementById('btnOcrCopiar');
  if (btnI) btnI.onclick = ocrEjecutar;
  if (btnP) btnP.onclick = function() { window.runnerOCR.cancelar = true; };
  if (btnC) btnC.onclick = ocrCopiarResultados;

  const tabBtns = document.querySelectorAll('.tab');
  tabBtns.forEach(function(t) {
    if (t.dataset.tab === 'ocr' && !t.dataset.bound) {
      t.dataset.bound = '1';
      t.addEventListener('click', function() {
        document.querySelectorAll('.tab').forEach(function(x) { x.classList.remove('active'); });
        document.querySelectorAll('.tab-content').forEach(function(x) { x.classList.remove('active'); });
        this.classList.add('active');
        const c = document.getElementById('tab-ocr');
        if (c) c.classList.add('active');
      });
    }
  });

  console.log("runner_ocr.js listo");
}

setTimeout(ocrSetup, 500);
