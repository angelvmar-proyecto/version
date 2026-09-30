// ==============================================
// ui/calibrar.js
// Modo calibracion: marcar lineas reales manualmente.
// 4 slots, cada uno con su imagen y su benchmark.
// ==============================================

const calEl = function(id) { return document.getElementById(id); };

function calLog(msg) {
  const el = calEl('calibLog');
  if (!el) return;
  el.textContent = msg + '\n' + el.textContent;
  console.log('[CALIB] ' + msg);
}

// --- Estado ---
window.calibState = {
  slotActivo: 0,
  modo: 'H',
  slots: [
    { nombre: '', imagen: null, ancho: 0, alto: 0, H: [], V: [], bmGuardado: false },
    { nombre: '', imagen: null, ancho: 0, alto: 0, H: [], V: [], bmGuardado: false },
    { nombre: '', imagen: null, ancho: 0, alto: 0, H: [], V: [], bmGuardado: false },
    { nombre: '', imagen: null, ancho: 0, alto: 0, H: [], V: [], bmGuardado: false }
  ],
  zoom: 1,
  panX: 0,
  panY: 0,
  touchStartX: 0,
  touchStartY: 0,
  touchStartTime: 0,
  isPan: false,
  dragging: null,  // {tipo: 'H'|'V', idx: N}
  distPinchInicial: 0,
  zoomPinchInicial: 1
};

// --- Redibujar canvas ---
function calRedibujar() {
  const slot = window.calibState.slots[window.calibState.slotActivo];
  const canvas = calEl('canvasCalib');
  if (!canvas || !slot.imagen) return;

  canvas.width = slot.ancho;
  canvas.height = slot.alto;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(slot.imagen, 0, 0);

  // Dibujar H (amarillas)
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 2;
  slot.H.forEach(function(y) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  });

  // Dibujar V (cian)
  ctx.strokeStyle = '#00FFFF';
  ctx.lineWidth = 2;
  slot.V.forEach(function(x) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  });

  // Aplicar transform zoom/pan
  canvas.style.transform = 'translate(' + window.calibState.panX + 'px,' + window.calibState.panY + 'px) scale(' + window.calibState.zoom + ')';

  calActualizarInfo();
}

function calActualizarInfo() {
  const slot = window.calibState.slots[window.calibState.slotActivo];
  calEl('calibSlotNombre').textContent = 'Slot ' + (window.calibState.slotActivo + 1);
  calEl('calibImgNombre').textContent = slot.imagen ? (slot.nombre + ' (' + slot.ancho + 'x' + slot.alto + ')') : 'vacío';
  calEl('calibBmEstado').textContent = slot.bmGuardado ? '✅ guardado' : '❌ no guardado';
  calEl('calibConteo').textContent = 'H=' + slot.H.length + ', V=' + slot.V.length;
}

// --- Cargar imagen ---
function calCargarImagen(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const slot = window.calibState.slots[window.calibState.slotActivo];
      slot.imagen = img;
      slot.nombre = file.name || 'imagen';
      slot.ancho = img.width;
      slot.alto = img.height;
      slot.bmGuardado = false;
      window.calibState.zoom = 1;
      window.calibState.panX = 0;
      window.calibState.panY = 0;
      calRedibujar();
      calLog('Imagen cargada: ' + img.width + 'x' + img.height);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// --- Convertir tap a coords de imagen ---
function calTapACoords(event) {
  const canvas = calEl('canvasCalib');
  const rect = canvas.getBoundingClientRect();
  const imageX = (event.clientX - rect.left) * (canvas.width / rect.width);
  const imageY = (event.clientY - rect.top) * (canvas.height / rect.height);
  return { x: Math.round(imageX), y: Math.round(imageY) };
}

// --- Agregar marca ---
function calAgregarMarca(x, y) {
  const slot = window.calibState.slots[window.calibState.slotActivo];
  if (!slot.imagen) return;

  if (window.calibState.modo === 'H') {
    // Evitar duplicados cercanos
    if (slot.H.some(function(v) { return Math.abs(v - y) < 5; })) {
      calLog('H duplicada cerca de y=' + y);
      return;
    }
    slot.H.push(y);
    slot.H.sort(function(a, b) { return a - b; });
    calLog('+ H y=' + y);
  } else if (window.calibState.modo === 'V') {
    if (slot.V.some(function(v) { return Math.abs(v - x) < 5; })) {
      calLog('V duplicada cerca de x=' + x);
      return;
    }
    slot.V.push(x);
    slot.V.sort(function(a, b) { return a - b; });
    calLog('+ V x=' + x);
  }
  calRedibujar();
}

// --- Borrar última marca ---
function calBorrarUltima() {
  const slot = window.calibState.slots[window.calibState.slotActivo];
  if (window.calibState.modo === 'H' && slot.H.length > 0) {
    const ult = slot.H.pop();
    calLog('- H y=' + ult);
  } else if (window.calibState.modo === 'V' && slot.V.length > 0) {
    const ult = slot.V.pop();
    calLog('- V x=' + ult);
  } else {
    calLog('Nada que borrar');
  }
  calRedibujar();
}

// --- Limpiar marcas ---
function calLimpiarMarcas() {
  if (!confirm('¿Borrar todas las marcas del slot actual?')) return;
  const slot = window.calibState.slots[window.calibState.slotActivo];
  slot.H = [];
  slot.V = [];
  slot.bmGuardado = false;
  calRedibujar();
  calLog('Marcas borradas');
}

// --- Guardar benchmark ---
function calGuardarBenchmark() {
  const slot = window.calibState.slots[window.calibState.slotActivo];
  if (!slot.imagen) { calLog('Carga imagen primero'); return; }

  const bm = {
    nombre: slot.nombre.replace(/\.\w+$/, '') || ('slot' + (window.calibState.slotActivo + 1)),
    ancho: slot.ancho,
    alto: slot.alto,
    H: slot.H.slice(),
    V: slot.V.slice(),
    fecha: new Date().toISOString()
  };

  try {
    localStorage.setItem('calib_slot_' + window.calibState.slotActivo, JSON.stringify(bm));
    slot.bmGuardado = true;
    calActualizarInfo();
    calLog('💾 Benchmark guardado: H=' + bm.H.length + ', V=' + bm.V.length);
  } catch(e) {
    calLog('ERROR: ' + e.message);
  }
}

// --- Copiar JSON ---
function calCopiarJSON() {
  const slot = window.calibState.slots[window.calibState.slotActivo];
  if (!slot.imagen) { calLog('Carga imagen primero'); return; }

  const bm = {
    nombre: slot.nombre.replace(/\.\w+$/, '') || ('slot' + (window.calibState.slotActivo + 1)),
    ancho: slot.ancho,
    alto: slot.alto,
    H: slot.H.slice(),
    V: slot.V.slice(),
    fecha: new Date().toISOString()
  };

  const json = JSON.stringify(bm, null, 2);
  navigator.clipboard.writeText(json).then(function() {
    calLog('📋 JSON copiado (' + json.length + ' chars)');
    alert('JSON copiado al portapapeles. Pégalo en el chat.');
  }).catch(function() {
    calLog('No se pudo copiar automáticamente');
    alert(json);
  });
}

// --- Setup touches ---
function calSetupTouch() {
  const wrap = calEl('calibWrap');
  const canvas = calEl('canvasCalib');
  if (!wrap || !canvas) return;

  wrap.addEventListener('touchstart', function(e) {
    const st = window.calibState;
    if (e.touches.length === 1) {
      st.touchStartX = e.touches[0].clientX;
      st.touchStartY = e.touches[0].clientY;
      st.touchStartTime = Date.now();
      st.isPan = false;

      // Detectar si el toque está cerca de una línea (para agarrar)
      if (st.modo === 'H' || st.modo === 'V') {
        const coords = calTapACoords(e.touches[0]);
        const slot = st.slots[st.slotActivo];
        const umbral = 25 / st.zoom; // 25px reales, ajustados al zoom

        if (st.modo === 'H') {
          for (let i = 0; i < slot.H.length; i++) {
            if (Math.abs(slot.H[i] - coords.y) < umbral) {
              st.dragging = { tipo: 'H', idx: i };
              calLog('🔧 Agarró H y=' + slot.H[i]);
              return;
            }
          }
        } else {
          for (let i = 0; i < slot.V.length; i++) {
            if (Math.abs(slot.V[i] - coords.x) < umbral) {
              st.dragging = { tipo: 'V', idx: i };
              calLog('🔧 Agarró V x=' + slot.V[i]);
              return;
            }
          }
        }
      }
    } else if (e.touches.length === 2) {
      const t1 = e.touches[0], t2 = e.touches[1];
      st.distPinchInicial = Math.sqrt(Math.pow(t1.clientX-t2.clientX,2) + Math.pow(t1.clientY-t2.clientY,2));
      st.zoomPinchInicial = st.zoom;
    }
  }, { passive: true });

  wrap.addEventListener('touchmove', function(e) {
    const st = window.calibState;
    if (e.touches.length === 2 && st.distPinchInicial > 0) {
      const t1 = e.touches[0], t2 = e.touches[1];
      const distActual = Math.sqrt(Math.pow(t1.clientX-t2.clientX,2) + Math.pow(t1.clientY-t2.clientY,2));
      st.zoom = Math.max(0.5, Math.min(6, st.zoomPinchInicial * (distActual / st.distPinchInicial)));
      canvas.style.transform = 'translate(' + st.panX + 'px,' + st.panY + 'px) scale(' + st.zoom + ')';
    } else if (e.touches.length === 1) {
      // Arrastrar línea
      if (st.dragging) {
        const coords = calTapACoords(e.touches[0]);
        const slot = st.slots[st.slotActivo];
        if (st.dragging.tipo === 'H') {
          slot.H[st.dragging.idx] = coords.y;
        } else {
          slot.V[st.dragging.idx] = coords.x;
        }
        calRedibujar();
        return;
      }

      // Pan normal (solo en modo Ver o si no agarro linea)
      const dx = e.touches[0].clientX - st.touchStartX;
      const dy = e.touches[0].clientY - st.touchStartY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 15) st.isPan = true;
      if (st.isPan && st.modo === 'Ver') {
        st.panX += (e.touches[0].clientX - st.touchStartX);
        st.panY += (e.touches[0].clientY - st.touchStartY);
        st.touchStartX = e.touches[0].clientX;
        st.touchStartY = e.touches[0].clientY;
        canvas.style.transform = 'translate(' + st.panX + 'px,' + st.panY + 'px) scale(' + st.zoom + ')';
      }
    }
  }, { passive: true });

  wrap.addEventListener('touchend', function(e) {
    const st = window.calibState;
    if (e.touches.length < 2) st.distPinchInicial = 0;

    // Si estaba arrastrando, terminar
    if (st.dragging) {
      const slot = st.slots[st.slotActivo];
      if (st.dragging.tipo === 'H') {
        slot.H.sort(function(a, b) { return a - b; });
      } else {
        slot.V.sort(function(a, b) { return a - b; });
      }
      calLog('✅ Soltó ' + st.dragging.tipo + ' en nueva posición');
      st.dragging = null;
      calRedibujar();
      st.isPan = false;
      return;
    }

    // Si fue un tap limpio (sin pan), añadir marca
    if (e.touches.length === 0 && !st.isPan && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      if (st.modo !== 'Ver') {
        const coords = calTapACoords(touch);
        calAgregarMarca(coords.x, coords.y);
      }
    }
    st.isPan = false;
  }, { passive: true });
}

// --- Cambiar modo ---
function calSetModo(modo) {
  window.calibState.modo = modo;
  ['modeH', 'modeV', 'modeVer'].forEach(function(id) {
    const el = calEl(id);
    if (el) el.classList.remove('active');
  });
  if (modo === 'H') calEl('modeH').classList.add('active');
  else if (modo === 'V') calEl('modeV').classList.add('active');
  else calEl('modeVer').classList.add('active');
  calLog('Modo: ' + modo);
}

// --- Cambiar slot ---
function calSetSlot(idx) {
  window.calibState.slotActivo = idx;
  document.querySelectorAll('#tab-calibrar .chip[data-slot]').forEach(function(c) {
    c.classList.toggle('active', parseInt(c.dataset.slot) === idx);
  });
  // Intentar cargar benchmark guardado
  try {
    const stored = localStorage.getItem('calib_slot_' + idx);
    if (stored) {
      const bm = JSON.parse(stored);
      const slot = window.calibState.slots[idx];
      slot.H = bm.H || [];
      slot.V = bm.V || [];
      slot.bmGuardado = true;
      calLog('Benchmark cargado del slot ' + (idx+1) + ': H=' + slot.H.length + ', V=' + slot.V.length);
    }
  } catch(e) {}
  window.calibState.zoom = 1;
  window.calibState.panX = 0;
  window.calibState.panY = 0;
  calRedibujar();
}

// --- Setup ---
function calSetup() {
  // Tabs
  document.querySelectorAll('.tab').forEach(function(t) {
    t.addEventListener('click', function() {
      const target = this.dataset.tab;
      document.querySelectorAll('.tab').forEach(function(x) { x.classList.remove('active'); });
      document.querySelectorAll('.tab-content').forEach(function(x) { x.classList.remove('active'); });
      this.classList.add('active');
      const content = document.getElementById('tab-' + target);
      if (content) content.classList.add('active');
    });
  });

  // Slots
  document.querySelectorAll('#tab-calibrar .chip[data-slot]').forEach(function(c) {
    c.addEventListener('click', function() { calSetSlot(parseInt(this.dataset.slot)); });
  });

  // Modos
  calEl('modeH').onclick = function() { calSetModo('H'); };
  calEl('modeV').onclick = function() { calSetModo('V'); };
  calEl('modeVer').onclick = function() { calSetModo('Ver'); };

  // Cargar imagen
  calEl('btnCalibCargar').onclick = function() { calEl('inputCalib').click(); };
  calEl('inputCalib').onchange = function(e) {
    if (e.target.files && e.target.files[0]) calCargarImagen(e.target.files[0]);
  };

  // Botones
  calEl('btnCalibBorrar').onclick = calBorrarUltima;
  calEl('btnCalibLimpiar').onclick = calLimpiarMarcas;
  calEl('btnCalibGuardar').onclick = calGuardarBenchmark;
  calEl('btnCalibCopiar').onclick = calCopiarJSON;
  calEl('btnCalibZoomRst').onclick = function() {
    window.calibState.zoom = 1;
    window.calibState.panX = 0;
    window.calibState.panY = 0;
    calRedibujar();
  };

  calSetupTouch();
  calSetModo('H');
  calLog('Calibrador listo.');
  calLog('💡 Tap: añade línea. Tap cerca de línea: la agarra para mover.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', calSetup);
} else {
  calSetup();
}
