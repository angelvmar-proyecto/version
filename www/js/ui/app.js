// ==============================================
// ui/app.js
// Interfaz mínima con barra de progreso y validación.
// ==============================================

(function() {
  'use strict';

  const estado = { imagen: null, canvas: null, ultimoResultado: null };
  const el = function(id) { return document.getElementById(id); };

  function log(msg, tipo) {
    const cont = el('log');
    if (!cont) return;
    const linea = document.createElement('div');
    const colores = { info: '#94a3b8', exito: '#22c55e', error: '#ef4444', alerta: '#f59e0b', etapa: '#38bdf8' };
    linea.style.color = colores[tipo] || '#94a3b8';
    if (tipo === 'etapa') linea.style.fontWeight = 'bold';
    linea.textContent = msg;
    cont.appendChild(linea);
    cont.scrollTop = cont.scrollHeight;
    console.log(msg);
  }

  function actualizarBarra(msg, pct) {
    const cont = el('progresoContainer');
    const barra = el('progresoBarra');
    const texto = el('progresoTexto');
    if (!cont || !barra || !texto) return;
    cont.style.display = 'block';
    texto.textContent = msg;
    barra.style.width = pct + '%';
  }

  function ocultarBarra() {
    const cont = el('progresoContainer');
    if (cont) cont.style.display = 'none';
  }

  function cargarImagen(file) {
    log('📷 Cargando imagen...', 'etapa');
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        estado.imagen = img;
        const canvas = el('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
        estado.canvas = canvas;
        el('infoImagen').textContent = img.width + '×' + img.height + ' px';
        log('✅ Imagen cargada: ' + img.width + '×' + img.height, 'exito');
      };
      img.onerror = function() { log('❌ Error al cargar', 'error'); };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  async function ejecutarOCR() {
    if (!estado.canvas) { alert('Primero carga una imagen'); return; }

    el('btnOCR').disabled = true;
    el('btnOCR').textContent = '⏳ Procesando...';
    actualizarBarra('Iniciando...', 0);
    log('═══════════════════════════════════', 'etapa');
    log('🔬 NUEVO OCR', 'etapa');
    log('═══════════════════════════════════', 'etapa');

    try {
      const resultado = await window.ejecutarPipelineOCR(estado.canvas, {}, function(msg, pct) {
        actualizarBarra(msg, pct);
        log('   ' + msg + ' (' + pct + '%)', 'info');
      });

      log('🔍 Diagnóstico:', 'etapa');
      resultado.diagnosticos.problemas.forEach(function(p) { log('   ⚠️ ' + p, 'alerta'); });
      const m = resultado.diagnosticos.metricas;
      log('   Nitidez: ' + m.nitidez.toFixed(1) + ' | Contraste: ' + m.contraste.toFixed(1) + ' | Ruido: ' + m.ruido.toFixed(1), 'info');

      log('🎨 Filtros aplicados:', 'etapa');
      resultado.filtrosAplicados.forEach(function(f) {
        if (f.indexOf('DESCARTADO') >= 0) log('   ❌ ' + f, 'error');
        else log('   ✅ ' + f, 'exito');
      });

      log('📄 OCR modo: ' + resultado.modoOCR, 'info');
      log('⏱️ Tiempo total: ' + resultado.tiempo.toFixed(0) + 'ms', 'exito');
      log('📊 Matriz: ' + resultado.matriz.length + ' filas × ' + (resultado.matriz[0] ? resultado.matriz[0].length : 0) + ' cols', 'exito');

      estado.ultimoResultado = resultado;
      mostrarResultado(resultado.matriz);
      el('btnExportar').disabled = false;

    } catch (e) {
      log('❌ Error: ' + e.message, 'error');
    } finally {
      ocultarBarra();
      el('btnOCR').disabled = false;
      el('btnOCR').textContent = '🔍 Ejecutar OCR';
    }
  }

  function mostrarResultado(matriz) {
    const cont = el('resultado');
    if (!cont) return;
    if (!matriz || matriz.length === 0) {
      cont.innerHTML = '<div style="padding:20px; text-align:center; color:#64748b;">Sin resultados</div>';
      return;
    }

    let html = '<table class="tabla-resultado"><thead><tr><th style="width:30px;">#</th>';
    const numCols = matriz[0].length;
    for (let c = 0; c < numCols; c++) html += '<th>' + String.fromCharCode(65 + c) + '</th>';
    html += '</tr></thead><tbody>';

    for (let f = 0; f < matriz.length; f++) {
      html += '<tr><td style="background:#0f172a; color:#888; text-align:center;">' + (f + 1) + '</td>';
      for (let c = 0; c < numCols; c++) {
        const val = (matriz[f][c] || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        html += '<td><input type="text" value="' + val + '" data-row="' + f + '" data-col="' + c + '"></td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    cont.innerHTML = html;
  }

  async function exportarExcel() {
    if (!estado.ultimoResultado) { alert('No hay resultado'); return; }
    if (typeof XLSX === 'undefined') { alert('Librería XLSX no disponible'); return; }

    const inputs = document.querySelectorAll('#resultado input[data-row]');
    if (inputs.length === 0) { alert('No hay datos'); return; }

    let maxRow = 0, maxCol = 0;
    inputs.forEach(function(inp) {
      const r = parseInt(inp.dataset.row), c = parseInt(inp.dataset.col);
      if (r > maxRow) maxRow = r;
      if (c > maxCol) maxCol = c;
    });

    const matriz = [];
    for (let i = 0; i <= maxRow; i++) matriz.push(new Array(maxCol + 1).fill(''));
    inputs.forEach(function(inp) {
      matriz[parseInt(inp.dataset.row)][parseInt(inp.dataset.col)] = inp.value;
    });

    try {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(matriz);
      XLSX.utils.book_append_sheet(wb, ws, 'OCR');
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
      const nombre = 'resultado_' + Date.now() + '.xlsx';
      const fs = (typeof Capacitor !== 'undefined' && Capacitor.Plugins) ? Capacitor.Plugins.Filesystem : null;

      if (fs) {
        await fs.writeFile({ path: nombre, data: wbout, directory: 'DOCUMENTS' });
        log('✅ Guardado en Documentos: ' + nombre, 'exito');
        alert('✅ Guardado en Documentos:\n' + nombre);
      } else {
        alert('Filesystem no disponible');
      }
    } catch (e) {
      log('❌ Error guardando Excel: ' + e.message, 'error');
    }
  }

  function limpiar() {
    estado.imagen = null; estado.canvas = null; estado.ultimoResultado = null;
    const canvas = el('canvas');
    if (canvas) { canvas.width = 0; canvas.height = 0; }
    el('infoImagen').textContent = '—';
    el('resultado').innerHTML = '<div style="padding:20px; text-align:center; color:#64748b;">Carga una imagen y ejecuta OCR</div>';
    el('log').textContent = '';
    el('btnExportar').disabled = true;
    el('inputImagen').value = '';
    log('🗑️ Limpiado', 'info');
  }

  function setupTabs() {
    document.querySelectorAll('.tab').forEach(function(tab) {
      tab.onclick = function() {
        const target = this.dataset.tab;
        document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
        document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
        this.classList.add('active');
        const content = el('tab-' + target);
        if (content) content.classList.add('active');
      };
    });
  }

  function setup() {
    setupTabs();
    const buildTag = el('buildTag');
    if (buildTag && typeof BUILD_TAG !== 'undefined') buildTag.textContent = BUILD_TAG;

    el('btnCargar').onclick = function() { el('inputImagen').click(); };
    el('inputImagen').onchange = function(e) {
      if (e.target.files && e.target.files[0]) cargarImagen(e.target.files[0]);
    };

    el('btnOCR').onclick = ejecutarOCR;
    el('btnExportar').onclick = exportarExcel;
    el('btnLimpiar').onclick = limpiar;

    if (typeof window.ocrCargarDiccionarioExtra === 'function') window.ocrCargarDiccionarioExtra();
    log('✅ Imagen Tabla MAR Caribe lista.', 'exito');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();

  console.log('[ui] app.js cargado');
})();
