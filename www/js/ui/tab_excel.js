// ==============================================
// ui/tab_excel.js
// Renderiza la matriz del runner de tabla como
// tabla editable y permite exportarla a CSV.
// ==============================================

function excelLog(msg) {
  console.log('[EXCEL] ' + msg);
}

function excelRenderizarMatriz(matriz) {
  const tabla = document.getElementById('excelTable');
  if (!tabla) return;

  if (!matriz || matriz.length === 0) {
    tabla.innerHTML = '<thead><tr><th>Vacío</th></tr></thead><tbody><tr><td>No hay datos para mostrar</td></tr></tbody>';
    return;
  }

  let html = '';
  // Generar cabecera con letras de columna (A, B, C...)
  html += '<thead><tr><th style="width:30px; background:#0f172a; position:sticky; left:0; z-index:2;">#</th>';
  const numCols = matriz[0].length;
  for (let j = 0; j < numCols; j++) {
    html += '<th>' + excelColLetra(j) + '</th>';
  }
  html += '</tr></thead><tbody>';

  for (let i = 0; i < matriz.length; i++) {
    html += '<tr>';
    // Número de fila a la izquierda
    html += '<td style="background:#0f172a; position:sticky; left:0; z-index:1; text-align:center; color:#888;">' + (i + 1) + '</td>';
    for (let j = 0; j < numCols; j++) {
      const val = (matriz[i][j] || '').replace(/"/g, '&quot;');
      html += '<td><input type="text" value="' + val + '" data-row="' + i + '" data-col="' + j + '"></td>';
    }
    html += '</tr>';
  }
  html += '</tbody>';
  tabla.innerHTML = html;
  excelLog('Matriz renderizada: ' + matriz.length + ' filas x ' + numCols + ' cols');
}

function excelColLetra(n) {
  let s = '';
  let i = n;
  while (i >= 0) {
    s = String.fromCharCode((i % 26) + 65) + s;
    i = Math.floor(i / 26) - 1;
  }
  return s;
}

function excelRecargarClick() {
  const matriz = window.runnerTabla && window.runnerTabla.matrizFinal;
  if (!matriz || matriz.length === 0) {
    excelLog('No hay matriz para mostrar. Corre el runner de tabla primero.');
    alert('No hay datos. Corre el runner de Tabla primero.');
    return;
  }
  excelRenderizarMatriz(matriz);
}

function excelExportarClick() {
  const tabla = document.getElementById('excelTable');
  if (!tabla) return;
  const inputs = tabla.querySelectorAll('tbody input[data-row]');
  if (inputs.length === 0) { alert('No hay tabla para exportar.'); return; }

  // Reconstruir matriz desde los inputs (por si el usuario editó)
  const maxRow = Math.max(...Array.from(inputs).map(function(i) { return parseInt(i.dataset.row); })) + 1;
  const maxCol = Math.max(...Array.from(inputs).map(function(i) { return parseInt(i.dataset.col); })) + 1;

  const matriz = [];
  for (let i = 0; i < maxRow; i++) matriz.push(new Array(maxCol).fill(''));

  inputs.forEach(function(inp) {
    const r = parseInt(inp.dataset.row);
    const c = parseInt(inp.dataset.col);
    matriz[r][c] = inp.value;
  });

  if (typeof window.tabGuardarCsv === 'function') {
    window.tabGuardarCsv(matriz, 'excel_editado');
  } else {
    // Fallback: descargar como archivo
    const csv = tablaMatrizACsv(matriz);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'excel_editado.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
}

// --- Enganche de botones ---
function excelEngancharBotones() {
  const btnRecargar = document.getElementById('btnExcelRecargar');
  const btnExportar = document.getElementById('btnExcelExportar');
  if (btnRecargar) btnRecargar.addEventListener('click', excelRecargarClick);
  if (btnExportar) btnExportar.addEventListener('click', excelExportarClick);
  console.log('[EXCEL] Botones enganchados');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', excelEngancharBotones);
} else {
  excelEngancharBotones();
}

// --- Enganche del tab ---
(function() {
  function excelEngancharTab() {
    const tabBtns = document.querySelectorAll('.tab');
    tabBtns.forEach(function(t) {
      if (t.dataset.tab === 'excel' && !t.dataset.bound) {
        t.dataset.bound = '1';
        t.addEventListener('click', function() {
          document.querySelectorAll('.tab').forEach(function(x) { x.classList.remove('active'); });
          document.querySelectorAll('.tab-content').forEach(function(x) { x.classList.remove('active'); });
          this.classList.add('active');
          const c = document.getElementById('tab-excel');
          if (c) c.classList.add('active');
        });
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', excelEngancharTab);
  } else {
    excelEngancharTab();
  }
  setTimeout(excelEngancharTab, 500);
})();

console.log('tab_excel.js v1 cargado');
