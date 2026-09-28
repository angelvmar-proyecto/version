// ==============================================
// MAR Caribe v12.0 - DIBUJO CENTRALIZADO
// Canvas = tamaño del área visible. Imagen centrada con zoom.
// ==============================================

// Variables globales de líneas
window.lineasOpticaH = [];
window.lineasOpticaV = [];
window.lineasEcografiaH = [];
window.lineasEcografiaV = [];
window.lineasA3H = [];
window.lineasA3V = [];
window.lineasLidarH = [];
window.lineasLidarV = [];
window.lineasLVCV = [];
window.lineasVisibles = true;

function dibujarTodo() {
  if (typeof imagenActual === 'undefined' || !imagenActual) return;

  const fuente = (window.estadoPasos && window.estadoPasos.imagenProcesada)
    ? window.estadoPasos.imagenProcesada
    : imagenActual;

  const area = document.querySelector('.area-img');
  if (!area) return;

  const rect = area.getBoundingClientRect();
  const anchoArea = Math.round(rect.width);
  const altoArea = Math.round(rect.height);

  if (anchoArea === 0 || altoArea === 0) return;

  // Canvas del tamaño del ÁREA (no de la imagen)
  if (lienzo.width !== anchoArea || lienzo.height !== altoArea) {
    lienzo.width = anchoArea;
    lienzo.height = altoArea;
  }

  // Limpiar
  ctx.clearRect(0, 0, lienzo.width, lienzo.height);

  // Fondo del área
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);

  // Aplicar transformación
  ctx.save();
  ctx.translate(desplazamiento.x, desplazamiento.y);
  ctx.scale(zoom, zoom);

  // Dibujar imagen base
  ctx.drawImage(fuente, 0, 0);

  // Dibujar líneas si están visibles
  if (window.lineasVisibles) {
    const grosor = CONFIG.ANCHO_LINEA / zoom;

    // 🟡 ÓPTICA
    ctx.strokeStyle = CONFIG.COLOR_OPTICA;
    ctx.lineWidth = grosor;
    window.lineasOpticaH.forEach(function(y) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(fuente.width, y);
      ctx.stroke();
    });
    window.lineasOpticaV.forEach(function(x) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, fuente.height);
      ctx.stroke();
    });

    // 🔴 ECO H
    ctx.strokeStyle = CONFIG.COLOR_ECO_H;
    window.lineasEcografiaH.forEach(function(y) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(fuente.width, y);
      ctx.stroke();
    });

    // 🔵 ECO V
    ctx.strokeStyle = CONFIG.COLOR_ECO_V;
    window.lineasEcografiaV.forEach(function(x) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, fuente.height);
      ctx.stroke();
    });

    // 🟣 A3
    ctx.strokeStyle = CONFIG.COLOR_A3;
    window.lineasA3H.forEach(function(y) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(fuente.width, y);
      ctx.stroke();
    });
    window.lineasA3V.forEach(function(x) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, fuente.height);
      ctx.stroke();
    });

    // 💗 LVC (coherencia vertical)
    if (window.lineasLVCV && window.lineasLVCV.length > 0) {
      ctx.strokeStyle = CONFIG.COLOR_LVC || '#ec4899';
      ctx.lineWidth = grosor;
      window.lineasLVCV.forEach(function(x) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, fuente.height);
        ctx.stroke();
      });
    }

    // ⚫ LIDAR
    if (window.lineasLidarH.length > 0 || window.lineasLidarV.length > 0) {
      ctx.strokeStyle = CONFIG.COLOR_LIDAR;
      ctx.lineWidth = grosor * 1.5;
      window.lineasLidarH.forEach(function(y) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(fuente.width, y);
        ctx.stroke();
      });
      window.lineasLidarV.forEach(function(x) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, fuente.height);
        ctx.stroke();
      });
    }
  }

  ctx.restore();

  const zoomLabel = document.getElementById('zoomLevel');
  if (zoomLabel) zoomLabel.textContent = zoom.toFixed(2) + 'x';
}

function toggleLineas() {
  window.lineasVisibles = !window.lineasVisibles;
  dibujarTodo();
  const btn = document.getElementById('btnToggleLineas');
  if (btn) btn.textContent = window.lineasVisibles ? '👁️' : '🚫';
  if (typeof log === 'function') {
    log(window.lineasVisibles ? '👁️ Líneas visibles' : '🚫 Líneas ocultas', 'info');
  }
}

function limpiarLineas() {
  window.lineasOpticaH = [];
  window.lineasOpticaV = [];
  window.lineasEcografiaH = [];
  window.lineasEcografiaV = [];
  window.lineasA3H = [];
  window.lineasA3V = [];
  window.lineasLidarH = [];
  window.lineasLidarV = [];
  window.lineasLVCV = [];
}

document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    const areaImg = document.querySelector('.area-img');
    if (!areaImg || document.getElementById('btnToggleLineas')) return;

    const btn = document.createElement('button');
    btn.id = 'btnToggleLineas';
    btn.textContent = '👁️';
    btn.style.cssText = 'position:absolute;top:12px;right:12px;width:44px;height:44px;border-radius:50%;background:rgba(10,61,98,0.9);color:white;border:2px solid rgba(255,255,255,0.3);font-size:1.3rem;cursor:pointer;z-index:100;box-shadow:0 2px 8px rgba(0,0,0,0.4);';
    btn.onclick = toggleLineas;
    areaImg.appendChild(btn);
    console.log('✅ Botón de líneas agregado');
  }, 500);
});

console.log('✅ Dibujo cargado');
