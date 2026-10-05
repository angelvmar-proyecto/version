// ==============================================
// ui/runner_restauracion.js
// Runner de restauracion v6. Tanda extendida ~130 combos.
// Con reanudacion y PNG a galeria.
// ==============================================

window.runnerRestauracion = {
  imagenes: [],
  benchmarks: [],
  ejecutando: false,
  cancelar: false,
  resultados: [],
  mejor: 0,
  ultimoCombo: 0,
  albumId: null
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

function rrGenerarTanda1() {
  const combos = [];

  // 1) Baseline
  combos.push({ nombre: 'baseline', tipo: 'none', params: {} });

  // 2) Unsharp extendido: 6 radios x 5 amounts = 30
  [1, 2, 3, 4, 5, 8].forEach(function(r) {
    [0.5, 1.0, 1.5, 2.0, 3.0].forEach(function(a) {
      combos.push({ nombre: 'unsharp_r' + r + '_a' + a, tipo: 'unsharp', params: { radio: r, amount: a } });
    });
  });

  // 3) Contrast completo: 9
  [1, 2, 5].forEach(function(pb) {
    [95, 98, 99].forEach(function(pa) {
      combos.push({ nombre: 'contrast_' + pb + '_' + pa, tipo: 'contrast', params: { percBajo: pb, percAlto: pa } });
    });
  });

  // 4) CLAHE completo: 9
  [4, 8, 16].forEach(function(t) {
    [2, 4, 8].forEach(function(c) {
      combos.push({ nombre: 'clahe_t' + t + '_c' + c, tipo: 'clahe', params: { tiles: t, clip: c } });
    });
  });

  // 5) Guided solo: 12
  [2, 4, 8, 16].forEach(function(r) {
    [0.001, 0.01, 0.1].forEach(function(e) {
      combos.push({ nombre: 'guided_r' + r + '_e' + e, tipo: 'guided', params: { radio: r, eps: e } });
    });
  });

  // 6) Bilateral: 16
  [25, 50, 75, 100].forEach(function(sc) {
    [25, 50, 75, 100].forEach(function(ss) {
      combos.push({ nombre: 'bilat_c' + sc + '_s' + ss, tipo: 'bilateral', params: { sigmaColor: sc, sigmaSpace: ss } });
    });
  });

  // 7) Mediana: 3
  [1, 2, 3].forEach(function(r) {
    combos.push({ nombre: 'mediana_r' + r, tipo: 'mediana', params: { radio: r } });
  });

  // 8) Gaussiano: 3
  [0.5, 1.0, 1.5].forEach(function(s) {
    combos.push({ nombre: 'gauss_s' + s, tipo: 'gaussiano', params: { sigma: s } });
  });

  // 9) Deblock: 4
  [8, 16].forEach(function(bs) {
    combos.push({ nombre: 'deblock_' + bs, tipo: 'deblock', params: { blockSize: bs } });
    combos.push({ nombre: 'deblock_bilat_' + bs, tipo: 'deblock+bilateral', params: { blockSize: bs, sigmaColor: 50, sigmaSpace: 50 } });
  });

  // 10) Binarizar: 1
  combos.push({ nombre: 'binarizar', tipo: 'binarizar', params: {} });

  // 11) Bilateral+binarizar: 4
  [25, 50, 75, 100].forEach(function(sc) {
    combos.push({ nombre: 'bilat_bin_c' + sc, tipo: 'bilateral+binarizar', params: { sigmaColor: sc, sigmaSpace: 50 } });
  });

  // 12) Guided+binarizar: 4
  [4, 8].forEach(function(r) {
    [0.01, 0.1].forEach(function(e) {
      combos.push({ nombre: 'guided_bin_r' + r + '_e' + e, tipo: 'guided+binarizar', params: { radio: r, eps: e } });
    });
  });

  // 13) Combinaciones: unsharp + contrast (4 unsharp x 3 contrast = 12)
  [3, 4].forEach(function(r) {
    [1.5, 2.0].forEach(function(a) {
      [95, 98, 99].forEach(function(pa) {
        combos.push({ nombre: 'uc_r' + r + '_a' + a + '_c5_' + pa, tipo: 'combo_unsharp_contrast', params: { radio: r, amount: a, percBajo: 5, percAlto: pa } });
      });
    });
  });

  // 14) Combinaciones: unsharp + clahe (2 unsharp x 3 clahe = 6)
  [3, 4].forEach(function(r) {
    [1.5, 2.0].forEach(function(a) {
      [8, 16].forEach(function(t) {
        combos.push({ nombre: 'uk_r' + r + '_a' + a + '_t' + t, tipo: 'combo_unsharp_clahe', params: { radio: r, amount: a, tiles: t, clip: 8 } });
      });
    });
  });

  // 15) Combinaciones: contrast + clahe (3 contrast x 3 clahe = 9)
  [[5,98],[5,99],[2,99]].forEach(function(c) {
    [4, 8, 16].forEach(function(t) {
      combos.push({ nombre: 'ck_c' + c[0] + '_' + c[1] + '_t' + t, tipo: 'combo_contrast_clahe', params: { percBajo: c[0], percAlto: c[1], tiles: t, clip: 8 } });
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
      case 'combo_unsharp_contrast': {
        const u = restaurarUnsharp(brillo, ancho, alto, combo.params.radio, combo.params.amount);
        return restaurarContrast(u, ancho, alto, combo.params.percBajo, combo.params.percAlto);
      }
      case 'combo_unsharp_clahe': {
        const u2 = restaurarUnsharp(brillo, ancho, alto, combo.params.radio, combo.params.amount);
        return restaurarCLAHE(u2, ancho, alto, combo.params.tiles, combo.params.clip);
      }
      case 'combo_contrast_clahe': {
        const c1 = restaurarContrast(brillo, ancho, alto, combo.params.percBajo, combo.params.percAlto);
        return restaurarCLAHE(c1, ancho, alto, combo.params.tiles, combo.params.clip);
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

function rrBrilloACanvas(brillo, ancho, alto) {
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
  return canvas;
}

async function rrAsegurarAlbum() {
  try {
    const Media = Capacitor.Plugins.Media;
    if (!Media) return false;

    let albums = await Media.getAlbums();
    let album = (albums.albums || []).find(function(a) { return a.name === "MAR_Caribe"; });

    if (!album) {
      await Media.createAlbum({ name: "MAR_Caribe" });
      rrLog("Album MAR_Caribe creado");
      albums = await Media.getAlbums();
      album = (albums.albums || []).find(function(a) { return a.name === "MAR_Caribe"; });
    }

    if (album && album.identifier) {
      window.runnerRestauracion.albumId = album.identifier;
      rrLog("Album identifier OK");
      return true;
    }

    rrLog("No se pudo obtener identifier del album");
    return false;
  } catch(e) {
    rrLog("Error album: " + e.message);
    return false;
  }
}

async function rrGuardarPNG(brillo, ancho, alto, nombreArchivo) {
  try {
    const Media = Capacitor.Plugins.Media;
    if (!Media) { rrLog('  Media plugin no disponible'); return false; }

    const canvas = rrBrilloACanvas(brillo, ancho, alto);
    const dataURL = canvas.toDataURL('image/png');

    await Media.savePhoto({
      path: dataURL,
      albumIdentifier: window.runnerRestauracion.albumId,
      fileName: nombreArchivo.replace('.png', '')
    });

    rrLog('  Guardada en galeria: ' + nombreArchivo);
    return true;
  } catch(e) {
    rrLog('  Error PNG ' + nombreArchivo + ': ' + e.message);
    return false;
  }
}

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
      data: JSON.stringify(data),
      recursive: true
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

  await rrAsegurarAlbum();

  window.runnerRestauracion.ejecutando = true;
  window.runnerRestauracion.cancelar = false;

  const combos = rrGenerarTanda1();
  const total = combos.length;
  rrLog('Iniciando tanda EXTENDIDA: ' + total + ' combos');

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

      res.brillos = null;
      delete res.brillos;

      window.runnerRestauracion.resultados.push(res);
      window.runnerRestauracion.ultimoCombo = i + 1;

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

  const fs = Capacitor.Plugins.Filesystem;
  if (!fs) { alert('Filesystem no disponible'); return; }

  const fecha = new Date().toISOString();
  const ranking = window.runnerRestauracion.resultados.map(function(r) {
    return { nombre: r.nombre, tipo: r.tipo, params: r.params, puntuacion_total: r.puntuacion_total };
  }).sort(function(a, b) { return b.puntuacion_total - a.puntuacion_total; });

  const resumen = { fecha: fecha, total_combos: ranking.length, mejor: window.runnerRestauracion.mejor, ranking: ranking };
  const jsonResumen = JSON.stringify(resumen, null, 2);

  try {
    await fs.writeFile({
      path: "tanda1_resumen.json",
      directory: "DOCUMENTS",
      encoding: "utf8",
      data: jsonResumen,
      recursive: true
    });
    rrLog("Resumen guardado (" + jsonResumen.length + " chars)");
  } catch(e) {
    rrLog("Error resumen: " + e.message);
  }

  const completo = { fecha: fecha, total_combos: window.runnerRestauracion.resultados.length, mejor: window.runnerRestauracion.mejor, resultados: window.runnerRestauracion.resultados };
  const jsonCompleto = JSON.stringify(completo);
  const base64 = btoa(unescape(encodeURIComponent(jsonCompleto)));

  try {
    const path = "tanda1_completo.json.b64";
    const chunkSize = 48000;

    try { await fs.deleteFile({ path: path, directory: "DOCUMENTS" }); } catch(e) {}

    await fs.writeFile({
      path: path,
      directory: "DOCUMENTS",
      encoding: "base64",
      data: base64.substring(0, chunkSize),
      recursive: true
    });

    for (let i = chunkSize; i < base64.length; i += chunkSize) {
      await fs.appendFile({
        path: path,
        directory: "DOCUMENTS",
        encoding: "base64",
        data: base64.substring(i, i + chunkSize)
      });
    }
    rrLog("Completo guardado (" + Math.ceil(base64.length / chunkSize) + " chunks)");
  } catch(e) {
    rrLog("Error completo: " + e.message);
  }

  alert("Guardado:\n- Documents/tanda1_resumen.json (leible)\n- Documents/tanda1_completo.json.b64 (decodificar en Termux)");
}

function rrSetup() {
  const logEl = document.getElementById('rrLog');
  if (logEl) logEl.textContent = 'Runner Restauracion v6 (extendido ~130)\n';

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

  console.log('runner_restauracion.js v6 listo');
}

setTimeout(rrSetup, 500);
