// ==============================================
// ui/app.js
// Interfaz mínima de MAR Caribe v15 (OCR).
// Solo 2 tabs: Imagen y Resultado.
// Depende de: config.js, todo el core, pipeline_ocr.js
// ==============================================

(function() {
  'use strict';

  // ----------------------------------------------
  // Estado global
  // ----------------------------------------------
  const estado = {
    imagen: null,
    canvas: null,
    ultimoResultado: null
  };

  // ----------------------------------------------
  // Helpers
  // ----------------------------------------------
  const el = function(id) { return document.getElementById(id); };

  function log(msg, tipo) {
    const cont = el('log');
    if (!cont) return;
    const linea = document.createElement('div');
    const colores = {
      info: '#94a3b8', exito: '#22c55e', error: '#ef4444',
      alerta: '#f59e0b', etapa: '#38bdf8'
    };
    linea.style.color = colores[tipo] || '#94a3b8';
    if (tipo === 'etapa') linea.style.fontWeight = 'bold';
    linea.textContent = msg;
    cont.appendChild(linea);
    cont.scrollTop = cont.scrollHeight;
    console.log(msg);
  }

  // ----------------------------------------------
  // Cargar imagen
  // ----------------------------------------------
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
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        estado.canvas = canvas;

        el('infoImagen').textContent = img.width + '×' + img.height + ' px';
        log('✅ Imagen cargada: ' + img.width + '×' + img.height, 'exito');
      };
      img.onerror = function() { log('❌ Error al cargar', 'error'); };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // ----------------------------------------------
  // Ejecutar pipeline OCR
  // ----------------------------------------------
  async function ejecutarOCR() {
    if (!estado.canvas) {
      alert('Primero carga una imagen');
      return;
    }

    el('btnOCR').disabled = true;
    el('btnOCR').textContent = '⏳ Procesando...';
    log('═══════════════════════════════════', 'etapa');
    log('🔬 NUEVO OCR', 'etapa');
    log('═══════════════════════════════════', 'etapa');

    try {
      const resultado = await window.ejecutarPipelineOCR(estado.canvas, {});

      // Loguear diagnóstico
      log('🔍 Diagnóstico:', 'etapa');
      if (resultado.diagnosticos.problemas.length === 0) {
        log('   Sin problemas detectados', 'exito');
      } else {
        resultado.diagnosticos.problemas.forEach(function(p) {
          log('   ⚠️ ' + p, 'alerta');
        });
      }
      const m = resultado.diagnosticos.metricas;
      log('   Nitidez: ' + m.nitidez.toFixed(1) + ' | Contraste: ' + m.contraste.toFixed(1) +
          ' | Ruido: ' + m.ruido.toFixed(1) + ' | Iluminación: ' + m.iluminacion.toFixed(1), 'info');
      log('   Tamaño texto: ' + (m.tamTexto < 999 ? m.tamTexto.toFixed(1) + 'px' : 'N/A'), 'info');

      // Filtros aplicados
      if (resultado.filtrosAplicados.length > 0) {
        log('🎨 Filtros aplicados: ' + resultado.filtrosAplicados.join(', '), 'exito');
      } else {
        log('🎨 Sin filtros aplicados (imagen ya estaba bien)', 'exito');
      }

      // Modo OCR
      log('📄 OCR modo: ' + resultado.modoOCR, 'info');
      log('⏱️ Tiempo total: ' + resultado.tiempo.toFixed(0) + 'ms', 'exito');

      // Matriz
      log('📊 Matriz: ' + resultado.matriz.length + ' filas × ' +
          (resultado.matriz[0] ? resultado.matriz[0].length : 0) + ' cols', 'exito');

      estado.ultimoResultado = resultado;
      mostrarResultado(resultado.matriz);
      el('btnExportar').disabled = false;

    } catch (e) {
      log('❌ Error: ' + e.message, 'error');
      console.error(e);
    } finally {
      el('btnOCR').disabled = false;
      el('btnOCR').textContent = '🔍 Ejecutar OCR';
    }
  }

  // ----------------------------------------------
  // Mostrar resultado en tabla editable
  // ----------------------------------------------
  function mostrarResultado(matriz) {
    const cont = el('resultado');
    if (!cont) return;

    if (!matriz || matriz.length === 0) {
      cont.innerHTML = '<div style="padding:20px; text-align:center; color:#64748b;">Sin resultados</div>';
      return;
    }

    let html = '<table class="tabla-resultado"><thead><tr>';
    const numCols = matriz[0].length;
    html += '<th style="width:30px;">#</th>';
    for (let c = 0; c < numCols; c++) {
      html += '<th>' + String.fromCharCode(65 + c) + '</th>';
    }
    html += '</tr></thead><tbody>';

    for (let f = 0; f < matriz.length; f++) {
      html += '<tr>';
      html += '<td style="background:#0f172a; color:#888; text-align:center;">' + (f + 1) + '</td>';
      for (let c = 0; c < numCols; c++) {
        const val = (matriz[f][c] || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        html += '<td><input type="text" value="' + val + '" data-row="' + f + '" data-col="' + c + '"></td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    cont.innerHTML = html;
  }

  // ----------------------------------------------
  // Exportar a CSV
  // ----------------------------------------------
  async function exportarCSV() {
    if (!estado.ultimoResultado) {
      alert('No hay resultado para exportar');
      return;
    }

    // Reconstruir matriz desde los inputs (por si el usuario editó)
    const inputs = document.querySelectorAll('#resultado input[data-row]');
    if (inputs.length === 0) {
      alert('No hay datos');
      return;
    }

    let maxRow = 0, maxCol = 0;
    inputs.forEach(function(inp) {
      const r = parseInt(inp.dataset.row);
      const c = parseInt(inp.dataset.col);
      if (r > maxRow) maxRow = r;
      if (c > maxCol) maxCol = c;
    });

    const matriz = [];
    for (let i = 0; i <= maxRow; i++) matriz.push(new Array(maxCol + 1).fill(''));
    inputs.forEach(function(inp) {
      matriz[parseInt(inp.dataset.row)][parseInt(inp.dataset.col)] = inp.value;
    });

    // Convertir a CSV
    const csv = matriz.map(function(fila) {
      return fila.map(function(c) {
        const s = String(c || '');
        if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      }).join(',');
    }).join('\n');

    // Guardar con Capacitor Filesystem
    const fs = (typeof Capacitor !== 'undefined' && Capacitor.Plugins) ? Capacitor.Plugins.Filesystem : null;
    const nombre = 'ocr_resultado_' + Date.now() + '.csv';

    if (fs) {
      try {
        const utf8Bytes = new TextEncoder().encode('\uFEFF' + csv);
        let binario = '';
        for (let i = 0; i < utf8Bytes.length; i++) binario += String.fromCharCode(utf8Bytes[i]);
        const base64 = btoa(binario);
        await fs.writeFile({
          path: nombre,
          data: base64,
          directory: 'DOCUMENTS'
        });
        log('✅ Guardado en Documentos: ' + nombre, 'exito');
        alert('✅ Guardado en Documentos:\n' + nombre);
      } catch (e) {
        log('❌ Error guardando: ' + e.message, 'error');
        alert('Error: ' + e.message);
      }
    } else {
      // Fallback navegador
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      log('✅ Descargado: ' + nombre, 'exito');
    }
  }

  // ----------------------------------------------
  // Limpiar
  // ----------------------------------------------
  function limpiar() {
    estado.imagen = null;
    estado.canvas = null;
    estado.ultimoResultado = null;

    const canvas = el('canvas');
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    el('infoImagen').textContent = '—';
    el('resultado').innerHTML = '<div style="padding:20px; text-align:center; color:#64748b;">Carga una imagen y ejecuta OCR</div>';
    el('log').textContent = '';
    el('btnExportar').disabled = true;
    el('inputImagen').value = '';
    log('🗑️ Limpiado', 'info');
  }

  // ----------------------------------------------
  // Tabs
  // ----------------------------------------------
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

  // ----------------------------------------------
  // Setup
  // ----------------------------------------------
  function setup() {
    setupTabs();

    const buildTag = el('buildTag');
    if (buildTag && typeof BUILD_TAG !== 'undefined') {
      buildTag.textContent = BUILD_TAG;
    }

    el('btnCargar').onclick = function() { el('inputImagen').click(); };
    el('inputImagen').onchange = function(e) {
      if (e.target.files && e.target.files[0]) cargarImagen(e.target.files[0]);
    };

    el('btnOCR').onclick = ejecutarOCR;
    el('btnExportar').onclick = exportarCSV;
    el('btnLimpiar').onclick = limpiar;

    // Cargar diccionario extra (silencioso)
    if (typeof window.ocrCargarDiccionarioExtra === 'function') {
      window.ocrCargarDiccionarioExtra();
    }

    log('✅ App lista. Carga una imagen para empezar.', 'exito');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }

  console.log('[ui] app.js cargado');
})();
