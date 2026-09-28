// ==============================================
// MAR Caribe v12.0 - Exportar Análisis
// Genera un HTML con: imagen + parámetros + log
// ==============================================

async function exportarAnalisis() {
  if (typeof lienzo === 'undefined' || !lienzo || lienzo.width === 0) {
    alert('⚠️ Primero carga y analiza una imagen');
    return;
  }

  log('═══════════════════════════════════', 'etapa');
  log('📸 Exportando análisis...', 'etapa');

  try {
    // 1. Convertir canvas a imagen PNG
    const imagenBase64 = lienzo.toDataURL('image/png');

    // 2. Recopilar parámetros actuales
    const parametros = [
      'OPTICA_UMBRAL_ADAPTATIVO', 'OPTICA_DISTANCIA_MIN_H', 'OPTICA_DISTANCIA_MIN_V', 'OPTICA_SUAVIZADO',
      'A3_UMBRAL_MAGNITUD', 'A3_UMBRAL_ORTOGONALIDAD', 'A3_COBERTURA_MINIMA', 'A3_DISTANCIA_MIN',
      'ECO_VENTANA', 'ECO_UMBRAL_H', 'ECO_UMBRAL_V', 'ECO_CONTINUIDAD',
      'LIDAR_VOTOS_MINIMOS', 'LIDAR_ECO_ALTO', 'LIDAR_ECO_BAJO', 'LIDAR_AGRUPAR_DIST',
      'RANGO_AJUSTE'
    ];

    let tablaParams = '';
    parametros.forEach(function(p) {
      if (CONFIG[p] !== undefined) {
        tablaParams += '<tr><td>' + p + '</td><td>' + CONFIG[p] + '</td></tr>';
      }
    });

    // 3. Recopilar log
    const logsEl = document.getElementById('logs');
    const textoLog = logsEl ? logsEl.innerText : '(sin log)';

    // 4. Estadísticas
    const stats = {
      opticaH: (window.lineasOpticaH || []).length,
      opticaV: (window.lineasOpticaV || []).length,
      ecoH: (window.lineasEcografiaH || []).length,
      ecoV: (window.lineasEcografiaV || []).length,
      a3H: (window.lineasA3H || []).length,
      a3V: (window.lineasA3V || []).length,
      lidarH: (window.lineasLidarH || []).length,
      lidarV: (window.lineasLidarV || []).length,
      celdas: (window.estadoPasos && window.estadoPasos.celdas) ? window.estadoPasos.celdas.length : 0
    };

    // 5. Generar HTML
    const fecha = new Date().toLocaleString('es-MX');
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Análisis MAR Caribe - ${fecha}</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #0f172a;
      color: #f1f5f9;
      padding: 16px;
      max-width: 1200px;
      margin: 0 auto;
    }
    h1 { color: #38bdf8; font-size: 1.3rem; }
    h2 { color: #38bdf8; font-size: 1rem; margin-top: 20px; border-bottom: 1px solid #334155; padding-bottom: 4px; }
    .fecha { color: #94a3b8; font-size: 0.85rem; }
    img { max-width: 100%; border-radius: 8px; margin-top: 8px; border: 1px solid #334155; }
    table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
    td, th { padding: 6px 10px; border: 1px solid #334155; text-align: left; }
    th { background: #1e293b; color: #38bdf8; }
    pre { background: #1e293b; padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 0.75rem; line-height: 1.4; white-space: pre-wrap; word-wrap: break-word; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; margin-top: 8px; }
    .stat { background: #1e293b; padding: 8px 12px; border-radius: 8px; }
    .stat-valor { font-size: 1.2rem; font-weight: bold; color: #38bdf8; }
    .stat-label { font-size: 0.7rem; color: #94a3b8; }
  </style>
</head>
<body>
  <h1>📊 Análisis MAR Caribe v12.0</h1>
  <p class="fecha">${fecha}</p>

  <h2>🖼️ Imagen con líneas detectadas</h2>
  <img src="${imagenBase64}" alt="Análisis">

  <h2>📊 Estadísticas</h2>
  <div class="stats">
    <div class="stat"><div class="stat-valor">${stats.opticaH}</div><div class="stat-label">Óptica H</div></div>
    <div class="stat"><div class="stat-valor">${stats.opticaV}</div><div class="stat-label">Óptica V</div></div>
    <div class="stat"><div class="stat-valor">${stats.ecoH}</div><div class="stat-label">Eco H</div></div>
    <div class="stat"><div class="stat-valor">${stats.ecoV}</div><div class="stat-label">Eco V</div></div>
    <div class="stat"><div class="stat-valor">${stats.a3H}</div><div class="stat-label">A3 H</div></div>
    <div class="stat"><div class="stat-valor">${stats.a3V}</div><div class="stat-label">A3 V</div></div>
    <div class="stat"><div class="stat-valor">${stats.lidarH}</div><div class="stat-label">LIDAR H</div></div>
    <div class="stat"><div class="stat-valor">${stats.lidarV}</div><div class="stat-label">LIDAR V</div></div>
    <div class="stat"><div class="stat-valor">${stats.celdas}</div><div class="stat-label">Celdas</div></div>
  </div>

  <h2>⚙️ Parámetros usados</h2>
  <table>
    <tr><th>Parámetro</th><th>Valor</th></tr>
    ${tablaParams}
  </table>

  <h2>📋 Log completo</h2>
  <pre>${textoLog.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>

</body>
</html>`;

    // 6. Guardar usando Filesystem
    if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.Filesystem) {
      const fs = Capacitor.Plugins.Filesystem;
      const nombreArchivo = 'analisis_' + Date.now() + '.html';
      const base64 = btoa(unescape(encodeURIComponent(html)));

      // Intentar guardar en Documents primero (más accesible)
      try {
        const resultado = await fs.writeFile({
          path: nombreArchivo,
          data: base64,
          directory: 'DOCUMENTS'
        });
        log('✅ Guardado en Documentos: ' + nombreArchivo, 'exito');
        alert('✅ Análisis exportado:\n\n' + nombreArchivo + '\n\nBúscalo en la carpeta Documentos de tu celular.');
      } catch (e) {
        // Si falla Documents, intentar con Cache
        const resultado = await fs.writeFile({
          path: nombreArchivo,
          data: base64,
          directory: 'CACHE'
        });
        log('✅ Guardado en Cache: ' + resultado.uri, 'exito');
        alert('✅ Análisis exportado en Cache:\n\n' + resultado.uri);
      }
    } else {
      // Fallback: descarga directa con <a> (funciona en navegador)
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'analisis_' + Date.now() + '.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      log('✅ Descargado vía navegador', 'exito');
    }

    log('✅ Análisis exportado correctamente', 'exito');

  } catch (e) {
    log('❌ Error al exportar: ' + e.message, 'error');
    alert('❌ Error al exportar: ' + e.message);
    console.error(e);
  }
}

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    const btn = document.getElementById('btnExportar');
    if (btn) {
      btn.onclick = exportarAnalisis;
    }
  }, 500);
});

console.log('✅ Exportar análisis cargado');

// ============================================
// EXPORTAR TABLA: CSV / Excel / Copiar
// ============================================
function _obtenerTablaHTML() {
  return document.querySelector('#tablaWrapper table.tabla-resultado');
}

function _tablaAArray() {
  const tabla = _obtenerTablaHTML();
  if (!tabla) return null;
  const filas = [];
  for (const tr of tabla.rows) {
    const fila = [];
    for (const cell of tr.cells) {
      fila.push(cell.innerText.replace(/\s+/g, ' ').trim());
    }
    filas.push(fila);
  }
  return filas;
}

async function _guardarArchivo(nombre, contenido, mime) {
  const fs = (typeof Capacitor !== 'undefined' && Capacitor.Plugins)
    ? Capacitor.Plugins.Filesystem : null;

  if (fs) {
    const base64 = btoa(unescape(encodeURIComponent(contenido)));
    try {
      await fs.writeFile({ path: nombre, data: base64, directory: 'DOCUMENTS' });
      alert('✅ Guardado en Documentos:\n' + nombre);
      return;
    } catch (e) {
      try {
        const res = await fs.writeFile({ path: nombre, data: base64, directory: 'CACHE' });
        alert('✅ Guardado en Cache:\n' + res.uri);
        return;
      } catch (e2) {
        alert('❌ Error al guardar: ' + e2.message);
        return;
      }
    }
  } else {
    const blob = new Blob([contenido], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

async function exportarTablaCSV() {
  const datos = _tablaAArray();
  if (!datos) { alert('⚠️ No hay tabla para exportar'); return; }
  const csv = '\uFEFF' + datos.map(fila =>
    fila.map(c => '"' + c.replace(/"/g, '""') + '"').join(',')
  ).join('\n');
  await _guardarArchivo('tabla_' + Date.now() + '.csv', csv, 'text/csv;charset=utf-8');
}

async function exportarTablaExcel() {
  const tabla = _obtenerTablaHTML();
  if (!tabla) { alert('⚠️ No hay tabla para exportar'); return; }
  const html = '<html><head><meta charset="utf-8"></head><body>'
    + tabla.outerHTML + '</body></html>';
  await _guardarArchivo('tabla_' + Date.now() + '.xls', html, 'application/vnd.ms-excel');
}

async function copiarTabla() {
  const datos = _tablaAArray();
  if (!datos) { alert('⚠️ No hay tabla'); return; }
  const tsv = datos.map(fila => fila.join('\t')).join('\n');
  try {
    await navigator.clipboard.writeText(tsv);
    alert('✅ Tabla copiada al portapapeles (pégala en Excel/Sheets)');
  } catch (e) {
    alert('❌ No se pudo copiar: ' + e.message);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    const b1 = document.getElementById('btnCopiar');
    const b2 = document.getElementById('btnCSV');
    const b3 = document.getElementById('btnExcel');
    if (b1) b1.onclick = copiarTabla;
    if (b2) b2.onclick = exportarTablaCSV;
    if (b3) b3.onclick = exportarTablaExcel;
    console.log('✅ Handlers de exportación registrados');
  }, 700);
});
