// ==============================================
// MAR Caribe v12.0 - DIBUJO CENTRALIZADO
// Un solo punto de control para dibujar en canvas
// ==============================================

// ============================================
// ESTADO GLOBAL DE LÍNEAS Y VISIBILIDAD
// ============================================
window.lineasOpticaH = [];
window.lineasOpticaV = [];
window.lineasEcografiaH = [];
window.lineasEcografiaV = [];
window.lineasA3H = [];
window.lineasA3V = [];
window.lineasLidarH = [];
window.lineasLidarV = [];

window.lineasVisibles = true;

// ============================================
// DIBUJAR TODO
// Lee las variables globales y pinta el canvas
// ============================================
function dibujarTodo() {
  if (typeof imagenActual === 'undefined' || !imagenActual) return;

  // Decidir la fuente: imagen procesada si existe, si no la original
  const fuente = (window.estadoPasos && window.estadoPasos.imagenProcesada)
    ? window.estadoPasos.imagenProcesada
    : imagenActual;

  // Ajustar tamaño del canvas
  if (lienzo.width !== fuente.width || lienzo.height !== fuente.height) {
    lienzo.width = fuente.width;
    lienzo.height = fuente.height;
  }

  // Limpiar
  ctx.clearRect(0, 0, lienzo.width, lienzo.height);

  // Aplicar zoom y desplazamiento
  ctx.save();
  ctx.translate(desplazamiento.x, desplazamiento.y);
  ctx.scale(zoom, zoom);

  // Dibujar imagen base
  ctx.drawImage(fuente, 0, 0);

  // Dibujar líneas si están visibles
  if (window.lineasVisibles) {
    // Ajustar grosor según zoom para que se vea siempre nítido
    const grosor = CONFIG.ANCHO_LINEA / zoom;

    // 🟡 ÓPTICA (amarillo)
    ctx.strokeStyle = CONFIG.COLOR_OPTICA;
    ctx.lineWidth = grosor;
    window.lineasOpticaH.forEach(y => {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(fuente.width, y);
      ctx.stroke();
    });
    window.lineasOpticaV.forEach(x => {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, fuente.height);
      ctx.stroke();
    });

    // 🔴 ECOGRAFÍA H (rojo)
    ctx.strokeStyle = CONFIG.COLOR_ECO_H;
    ctx.lineWidth = grosor;
    window.lineasEcografiaH.forEach(y => {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(fuente.width, y);
      ctx.stroke();
    });

    // 🔵 ECOGRAFÍA V (azul)
    ctx.strokeStyle = CONFIG.COLOR_ECO_V;
    window.lineasEcografiaV.forEach(x => {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, fuente.height);
      ctx.stroke();
    });

    // 🟣 A3 (morado)
    ctx.strokeStyle = CONFIG.COLOR_A3;
    ctx.lineWidth = grosor;
    window.lineasA3H.forEach(y => {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(fuente.width, y);
      ctx.stroke();
    });
    window.lineasA3V.forEach(x => {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, fuente.height);
      ctx.stroke();
    });

    // ⚫ LIDAR (negro, más grueso)
    if (window.lineasLidarH.length > 0 || window.lineasLidarV.length > 0) {
      ctx.strokeStyle = CONFIG.COLOR_LIDAR;
      ctx.lineWidth = grosor * 1.5;
      window.lineasLidarH.forEach(y => {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(fuente.width, y);
        ctx.stroke();
      });
      window.lineasLidarV.forEach(x => {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, fuente.height);
        ctx.stroke();
      });
    }
  }

  ctx.restore();

  // Actualizar etiqueta de zoom si existe
  const zoomLabel = document.getElementById('zoomLevel');
  if (zoomLabel) zoomLabel.textContent = zoom.toFixed(2) + 'x';
}

// ============================================
// TOGGLE VISIBILIDAD DE LÍNEAS
// ============================================
function toggleLineas() {
  window.lineasVisibles = !window.lineasVisibles;
  dibujarTodo();

  const btn = document.getElementById('btnToggleLineas');
  if (btn) btn.textContent = window.lineasVisibles ? '👁️' : '🚫';

  if (typeof log === 'function') {
    log(window.lineasVisibles ? '👁️ Líneas visibles' : '🚫 Líneas ocultas', 'info');
  }
}

// ============================================
// LIMPIAR TODAS LAS LÍNEAS
// ============================================
function limpiarLineas() {
  window.lineasOpticaH = [];
  window.lineasOpticaV = [];
  window.lineasEcografiaH = [];
  window.lineasEcografiaV = [];
  window.lineasA3H = [];
  window.lineasA3V = [];
  window.lineasLidarH = [];
  window.lineasLidarV = [];
}

// ============================================
// BOTÓN FLOTANTE DE VISIBILIDAD
// Se añade automáticamente al área de imagen
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    const areaImg = document.querySelector('.area-img');
    if (!areaImg || document.getElementById('btnToggleLineas')) return;

    const btn = document.createElement('button');
    btn.id = 'btnToggleLineas';
    btn.textContent = '👁️';
    btn.style.cssText = [
      'position:absolute',
      'top:12px',
      'right:12px',
      'width:44px',
      'height:44px',
      'border-radius:50%',
      'background:rgba(10,61,98,0.9)',
      'color:white',
      'border:2px solid rgba(255,255,255,0.3)',
      'font-size:1.3rem',
      'cursor:pointer',
      'z-index:100',
      'box-shadow:0 2px 8px rgba(0,0,0,0.4)'
    ].join(';');
    btn.onclick = toggleLineas;
    areaImg.appendChild(btn);
    console.log('✅ Botón de líneas agregado');
  }, 500);
});

console.log('✅ Dibujo cargado');
