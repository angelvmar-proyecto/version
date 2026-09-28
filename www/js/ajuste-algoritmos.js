// ==============================================
// MAR Caribe v13 - Panel de ajuste por algoritmo
// Permite ajustar un algoritmo a la vez con parámetros pegados
// ==============================================

(function() {
  // Blindaje: limpia cualquier override residual del panel de ajustes
  try { localStorage.removeItem('mar_caribe_config_override'); } catch(e) {}
  let modoActual = 'ambas';
  let ultimoLog = '';

  function log(msg) {
    ultimoLog += msg + '\n';
    const el = document.getElementById('ajLog');
    if (el) el.textContent = ultimoLog;
    console.log('[AJUSTE] ' + msg);
  }

  function limpiar() {
    ultimoLog = '';
    const el = document.getElementById('ajLog');
    if (el) el.textContent = '';
  }

  function esperarEstadoPasos() {
    return window.estadoPasos && window.estadoPasos.imagenProcesada && window.estadoPasos.brillo;
  }

  function aplicarParams(params) {
    const backup = {};
    Object.keys(params).forEach(function(k) {
      if (CONFIG[k] !== undefined) backup[k] = CONFIG[k];
      CONFIG[k] = params[k];
      if (window.CONFIG_ESC && window.CONFIG_ESC[k] !== undefined) {
        window.CONFIG_ESC[k] = params[k];
      }
    });
    return backup;
  }

  function restaurarParams(backup) {
    Object.keys(backup).forEach(function(k) {
      CONFIG[k] = backup[k];
      if (window.CONFIG_ESC && window.CONFIG_ESC[k] !== undefined) {
        window.CONFIG_ESC[k] = backup[k];
      }
    });
  }

  function dibujarCapa(canvas, lineasH, lineasV, color) {
    const fuente = window.estadoPasos.imagenProcesada;
    canvas.width = fuente.width;
    canvas.height = fuente.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(fuente, 0, 0);
    ctx.strokeStyle = color || '#FFD700';
    ctx.lineWidth = Math.max(2, Math.floor(canvas.width / 500));

    if (modoActual !== 'v') {
      (lineasH || []).forEach(function(y) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      });
    }
    if (modoActual !== 'h') {
      (lineasV || []).forEach(function(x) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      });
    }
  }

  function ejecutarAlgoritmo(nombre, brillo, ancho, alto) {
    if (nombre === 'optica') return detectarOptica(brillo, ancho, alto);
    if (nombre === 'eco') return detectarEcografia(brillo, ancho, alto);
    if (nombre === 'a3') return detectarA3(brillo, ancho, alto);
    if (nombre === 'lvc') return detectarCoherenciaV(brillo, ancho, alto);
    if (nombre === 'openv') return detectarOpeningVertical(brillo, ancho, alto);
    if (nombre === 'ml') return detectarMinimoLocal(brillo, ancho, alto);
    if (nombre === 'ws') return detectarWhitespace(brillo, ancho, alto);
    if (nombre === 'io') {
      const optica = detectarOptica(brillo, ancho, alto);
      return detectarIntersecciones(brillo, ancho, alto, optica.lineasH, optica.lineasV);
    }
    return { lineasH: [], lineasV: [] };
  }

  function colorDe(nombre) {
    const colores = {
      optica: '#FFD700', eco: '#FF0000', a3: '#8B5CF6',
      lvc: '#ec4899', openv: '#22d3ee', ml: '#84cc16',
      ws: '#f97316', io: '#eab308'
    };
    return colores[nombre] || '#ffffff';
  }

  async function analizar() {
    limpiar();
    if (!esperarEstadoPasos()) {
      log('⚠️ Primero carga y analiza una imagen en la pestaña Imagen.');
      alert('Carga y analiza una imagen primero');
      return;
    }

    const nombre = document.getElementById('ajAlgoritmo').value;
    const texto = document.getElementById('ajParams').value.trim();

    let params = {};
    if (texto && texto !== '{}') {
      try {
        params = JSON.parse(texto);
      } catch (e) {
        log('❌ JSON inválido: ' + e.message);
        alert('JSON inválido. Revisa las comillas y llaves.');
        return;
      }
    }

    log('🔬 Algoritmo: ' + nombre);
    log('📐 Modo: ' + modoActual);
    log('⚙️ Params: ' + JSON.stringify(params));

    const backup = aplicarParams(params);

    try {
      const brillo = window.estadoPasos.brillo;
      const ancho = window.estadoPasos.ancho;
      const alto = window.estadoPasos.alto;

      const t0 = performance.now();
      const res = ejecutarAlgoritmo(nombre, brillo, ancho, alto);
      const t1 = performance.now();

      const H = res.lineasH || [];
      const V = res.lineasV || [];

      log('✅ H: ' + H.length + ', V: ' + V.length);
      log('⏱️ Tiempo: ' + (t1 - t0).toFixed(1) + 'ms');

      if (H.length > 0 && H.length < 30) log('   H: ' + H.join(', '));
      if (V.length > 0 && V.length < 30) log('   V: ' + V.join(', '));

      const canvas = document.getElementById('ajCanvas');
      dibujarCapa(canvas, H, V, colorDe(nombre));

    } catch (e) {
      log('❌ Error: ' + e.message);
    } finally {
      restaurarParams(backup);
    }
  }

  function exportarPNG() {
    const canvas = document.getElementById('ajCanvas');
    if (!canvas || canvas.width === 0) {
      alert('Primero analiza un algoritmo.');
      return;
    }
    const nombre = document.getElementById('ajAlgoritmo').value;
    const ts = Date.now();
    const filename = 'ajuste_' + ts + '_' + nombre + '_' + modoActual + '.png';

    canvas.toBlob(async function(blob) {
      try {
        const fs = (typeof Capacitor !== 'undefined' && Capacitor.Plugins) ? Capacitor.Plugins.Filesystem : null;
        if (!fs) { alert('Filesystem no disponible'); return; }
        const reader = new FileReader();
        reader.onloadend = async function() {
          const base64 = reader.result.split(',')[1];
          await fs.writeFile({
            path: filename,
            data: base64,
            directory: 'DOCUMENTS'
          });
          alert('✅ Guardado: ' + filename);
        };
        reader.readAsDataURL(blob);
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }, 'image/png');
  }

  function copiarParams() {
    const texto = document.getElementById('ajParams').value;
    navigator.clipboard.writeText(texto).then(function() {
      alert('📋 Parámetros copiados');
    }).catch(function() {
      alert('No se pudo copiar');
    });
  }

  function resetPanel() {
    const ta = document.getElementById('ajParams');
    if (ta) ta.value = '{\n}';
    const canvas = document.getElementById('ajCanvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
    }
    limpiar();
    log('🔄 Panel reseteado');
  }

  function copiarLog() {
    navigator.clipboard.writeText(ultimoLog).then(function() {
      alert('📄 Log copiado');
    }).catch(function() {
      alert('No se pudo copiar');
    });
  }

  function setupModo() {
    document.querySelectorAll('.aj-modo').forEach(function(btn) {
      btn.addEventListener('click', function() {
        modoActual = this.dataset.modo;
        document.querySelectorAll('.aj-modo').forEach(function(b) {
          b.style.background = '#374151';
        });
        this.style.background = '#0ea5e9';
      });
    });
  }

  function init() {
    const btnA = document.getElementById('ajAnalizar');
    const btnE = document.getElementById('ajExportar');
    const btnP = document.getElementById('ajCopiarParams');
    const btnL = document.getElementById('ajCopiarLog');
    if (!btnA) return;

    btnA.addEventListener('click', analizar);
    btnE.addEventListener('click', exportarPNG);
    btnP.addEventListener('click', copiarParams);
    btnL.addEventListener('click', copiarLog);
    const btnR = document.getElementById('ajReset');
    if (btnR) btnR.addEventListener('click', resetPanel);
    setupModo();
    console.log('✅ Panel Ajuste cargado');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
