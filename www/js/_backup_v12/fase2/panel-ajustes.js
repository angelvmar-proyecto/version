// ==============================================
// MAR Caribe v12.0 - Panel de Ajustes en Vivo
// Sliders + inputs numéricos + localStorage
// ==============================================

const PARAMETROS_AJUSTABLES = [
  // Óptica
  {
    id: 'OPTICA_UMBRAL_ADAPTATIVO',
    grupo: '🟡 ÓPTICA',
    nombre: 'Umbral adaptativo',
    min: 0.10, max: 0.50, paso: 0.01,
    valorAjustado: 0.30,
    formato: function(v) { return v.toFixed(2); }
  },
  {
    id: 'OPTICA_DISTANCIA_MIN_V',
    grupo: '🟡 ÓPTICA',
    nombre: 'Distancia V (px)',
    min: 5, max: 80, paso: 1,
    valorAjustado: 10,
    formato: function(v) { return v; }
  },
  // A3
  {
    id: 'A3_UMBRAL_MAGNITUD',
    grupo: '🟣 A3',
    nombre: 'Umbral magnitud',
    min: 50, max: 250, paso: 5,
    valorAjustado: 150,
    formato: function(v) { return v; }
  },
  {
    id: 'A3_UMBRAL_ORTOGONALIDAD',
    grupo: '🟣 A3',
    nombre: 'Ortogonalidad',
    min: 0.50, max: 0.95, paso: 0.01,
    valorAjustado: 0.80,
    formato: function(v) { return v.toFixed(2); }
  },
  {
    id: 'A3_COBERTURA_MINIMA',
    grupo: '🟣 A3',
    nombre: 'Cobertura mínima',
    min: 0.15, max: 0.70, paso: 0.01,
    valorAjustado: 0.45,
    formato: function(v) { return v.toFixed(2); }
  },
  // RETINA GLOBAL
  {
    id: 'RETINA_GLOBAL_FUERZA',
    grupo: '🧠 RETINA GLOBAL',
    nombre: 'Fuerza contraste',
    min: 0.3, max: 1.5, paso: 0.1,
    valorAjustado: 1.0,
    formato: function(v) { return v.toFixed(1); }
  },
  {
    id: 'RETINA_GLOBAL_RADIO',
    grupo: '🧠 RETINA GLOBAL',
    nombre: 'Radio (px)',
    min: 10, max: 50, paso: 5,
    valorAjustado: 25,
    formato: function(v) { return v; }
  },
  // RETINA (por celda)
  {
    id: 'RETINA_RADIO',
    grupo: '🧠 RETINA',
    nombre: 'Radio (px)',
    min: 5, max: 30, paso: 1,
    valorAjustado: 15,
    formato: function(v) { return v; }
  },
  {
    id: 'RETINA_FUERZA_CONTRASTE',
    grupo: '🧠 RETINA',
    nombre: 'Fuerza contraste',
    min: 0.5, max: 2.5, paso: 0.1,
    valorAjustado: 1.5,
    formato: function(v) { return v.toFixed(1); }
  },
  {
    id: 'RETINA_FUERZA_BORDES',
    grupo: '🧠 RETINA',
    nombre: 'Fuerza bordes',
    min: 0.0, max: 1.0, paso: 0.05,
    valorAjustado: 0.5,
    formato: function(v) { return v.toFixed(2); }
  },
  {
    id: 'RETINA_UMBRAL_APLICAR',
    grupo: '🧠 RETINA',
    nombre: 'Umbral aplicar',
    min: 20, max: 120, paso: 5,
    valorAjustado: 60,
    formato: function(v) { return v; }
  },
  // LIDAR
  {
    id: 'LIDAR_AGRUPAR_DIST',
    grupo: '📐 LIDAR',
    nombre: 'Agrupar dist (px)',
    min: 2, max: 30, paso: 1,
    valorAjustado: 8,
    formato: function(v) { return v; }
  },
  {
    id: 'LIDAR_ECO_ALTO',
    grupo: '📐 LIDAR',
    nombre: 'Eco alto',
    min: 50, max: 150, paso: 5,
    valorAjustado: 100,
    formato: function(v) { return v; }
  },
  {
    id: 'LIDAR_ECO_BAJO',
    grupo: '📐 LIDAR',
    nombre: 'Eco bajo',
    min: 10, max: 70, paso: 5,
    valorAjustado: 40,
    formato: function(v) { return v; }
  }
];

// ============================================
// ABRIR/CERRAR PANEL
// ============================================
function togglePanelAjustes() {
  const panel = document.getElementById('panelAjustes');
  if (!panel) return;
  if (panel.style.display === 'none' || panel.style.display === '') {
    panel.style.display = 'block';
    renderizarPanelAjustes();
  } else {
    panel.style.display = 'none';
  }
}

function cerrarPanelAjustes() {
  const panel = document.getElementById('panelAjustes');
  if (panel) panel.style.display = 'none';
}

// ============================================
// RENDERIZAR PANEL
// ============================================
function renderizarPanelAjustes() {
  const contenedor = document.getElementById('panelAjustesContenido');
  if (!contenedor) return;

  let html = '';

  const grupos = {};
  PARAMETROS_AJUSTABLES.forEach(function(p) {
    if (!grupos[p.grupo]) grupos[p.grupo] = [];
    grupos[p.grupo].push(p);
  });

  Object.keys(grupos).forEach(function(nombreGrupo) {
    html += '<div class="ajuste-grupo">';
    html += '<div class="ajuste-grupo-titulo">' + nombreGrupo + '</div>';

    grupos[nombreGrupo].forEach(function(p) {
      const valorActual = CONFIG[p.id] !== undefined ? CONFIG[p.id] : p.valorAjustado;
      const idSlider = 'slider_' + p.id;
      const idInput = 'input_' + p.id;

      html += '<div class="ajuste-fila">';
      html += '<div class="ajuste-nombre">' + p.nombre + '</div>';
      html += '<input type="range" id="' + idSlider + '" ';
      html += 'min="' + p.min + '" max="' + p.max + '" step="' + p.paso + '" ';
      html += 'value="' + valorActual + '" ';
      html += 'oninput="onSliderChange(\'' + p.id + '\', this.value)">';
      html += '<input type="number" id="' + idInput + '" class="ajuste-input" ';
      html += 'min="' + p.min + '" max="' + p.max + '" step="' + p.paso + '" ';
      html += 'value="' + valorActual + '" ';
      html += 'onchange="onInputChange(\'' + p.id + '\', this.value)">';
      html += '</div>';
    });

    html += '</div>';
  });

  contenedor.innerHTML = html;
}

// ============================================
// HANDLERS DE CAMBIO
// ============================================
function onSliderChange(id, valor) {
  const num = parseFloat(valor);
  CONFIG[id] = num;
  const input = document.getElementById('input_' + id);
  if (input) input.value = num;
}

function onInputChange(id, valor) {
  const num = parseFloat(valor);
  if (isNaN(num)) return;
  CONFIG[id] = num;
  const slider = document.getElementById('slider_' + id);
  if (slider) slider.value = num;
}

// ============================================
// GUARDAR AJUSTES
// ============================================
function guardarAjustes() {
  try {
    const ajustes = {};
    PARAMETROS_AJUSTABLES.forEach(function(p) {
      ajustes[p.id] = CONFIG[p.id];
    });
    localStorage.setItem('mar_caribe_config_override', JSON.stringify(ajustes));
    alert('✅ Ajustes guardados. Se aplicarán en el próximo análisis.');
  } catch (e) {
    alert('❌ Error al guardar: ' + e.message);
  }
}

// ============================================
// RESET A DEFAULTS
// ============================================
function resetAjustes() {
  if (!confirm('¿Resetear todos los parámetros a los valores originales?')) return;

  try {
    localStorage.removeItem('mar_caribe_config_override');
    PARAMETROS_AJUSTABLES.forEach(function(p) {
      CONFIG[p.id] = CONFIG_DEFAULTS[p.id];
    });
    renderizarPanelAjustes();
    alert('✅ Parámetros reseteados a defaults.');
  } catch (e) {
    alert('❌ Error al resetear: ' + e.message);
  }
}

// ============================================
// APLICAR VALORES AJUSTADOS SUGERIDOS
// ============================================
function aplicarValoresSugeridos() {
  PARAMETROS_AJUSTABLES.forEach(function(p) {
    CONFIG[p.id] = p.valorAjustado;
  });
  renderizarPanelAjustes();
}

// ============================================
// COPIAR LOG AL PORTAPAPELES
// ============================================
async function copiarLog() {
  try {
    let texto = '═══════════════════════════════════\n';
    texto += 'PARÁMETROS ACTUALES:\n';
    PARAMETROS_AJUSTABLES.forEach(function(p) {
      const valor = CONFIG[p.id];
      const tipo = typeof valor === 'number' ? p.formato(valor) : valor;
      texto += '  ' + p.id + ': ' + tipo + '\n';
    });
    texto += '═══════════════════════════════════\n';
    texto += 'LOG COMPLETO:\n';
    texto += '═══════════════════════════════════\n';

    const logsEl = document.getElementById('logs');
    if (logsEl) {
      texto += logsEl.innerText + '\n';
    }

    texto += '═══════════════════════════════════\n';
    texto += 'FIN DEL LOG · ' + new Date().toLocaleString() + '\n';
    texto += '═══════════════════════════════════\n';

    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(texto);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = texto;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    const btn = event && event.target;
    if (btn) {
      const textoOriginal = btn.textContent;
      btn.textContent = '✅ Copiado';
      setTimeout(function() {
        btn.textContent = textoOriginal;
      }, 2000);
    }

  } catch (e) {
    alert('❌ Error al copiar: ' + e.message);
  }
}

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    const btnAbrir = document.getElementById('btnAbrirAjustes');
    if (btnAbrir) btnAbrir.onclick = togglePanelAjustes;

    const btnCerrar = document.getElementById('btnCerrarAjustes');
    if (btnCerrar) btnCerrar.onclick = cerrarPanelAjustes;

    const btnGuardar = document.getElementById('btnGuardarAjustes');
    if (btnGuardar) btnGuardar.onclick = guardarAjustes;

    const btnReset = document.getElementById('btnResetAjustes');
    if (btnReset) btnReset.onclick = resetAjustes;

    const btnSugeridos = document.getElementById('btnValoresSugeridos');
    if (btnSugeridos) btnSugeridos.onclick = aplicarValoresSugeridos;

    const btnCopiarLog = document.getElementById('btnCopiarLog');
    if (btnCopiarLog) btnCopiarLog.onclick = copiarLog;
  }, 500);
});

console.log('✅ Panel de ajustes cargado');
