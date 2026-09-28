// ==============================================
// ui/zoom.js
// Zoom + pan + doble-toque en el canvas.
// ==============================================

(function() {
  let escala = 1;
  let panX = 0, panY = 0;
  let tocando = false;
  let arrastrando = false;
  let panIniX = 0, panIniY = 0;
  let distIniPinch = 0;
  let escalaIniPinch = 1;
  let ultimoTap = 0;

  function aplicar() {
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    canvas.style.transform = 'translate(' + panX + 'px,' + panY + 'px) scale(' + escala + ')';
  }

  function resetZoom() {
    escala = 1; panX = 0; panY = 0;
    aplicar();
  }

  function distancia(t1, t2) {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx*dx + dy*dy);
  }

  function setup() {
    const wrap = document.getElementById('canvasWrap');
    if (!wrap) return;

    wrap.addEventListener('touchstart', function(e) {
      if (e.touches.length === 1) {
        // Detectar doble toque
        const ahora = Date.now();
        if (ahora - ultimoTap < 300) {
          resetZoom();
          ultimoTap = 0;
          return;
        }
        ultimoTap = ahora;

        // Iniciar pan
        arrastrando = true;
        panIniX = e.touches[0].clientX - panX;
        panIniY = e.touches[0].clientY - panY;
      } else if (e.touches.length === 2) {
        // Pinch
        arrastrando = false;
        distIniPinch = distancia(e.touches[0], e.touches[1]);
        escalaIniPinch = escala;
      }
    }, { passive: true });

    wrap.addEventListener('touchmove', function(e) {
      if (e.touches.length === 2 && distIniPinch > 0) {
        const distActual = distancia(e.touches[0], e.touches[1]);
        escala = Math.max(0.5, Math.min(5, escalaIniPinch * (distActual / distIniPinch)));
        aplicar();
      } else if (e.touches.length === 1 && arrastrando) {
        panX = e.touches[0].clientX - panIniX;
        panY = e.touches[0].clientY - panIniY;
        aplicar();
      }
    }, { passive: true });

    wrap.addEventListener('touchend', function(e) {
      if (e.touches.length < 2) distIniPinch = 0;
      if (e.touches.length === 0) arrastrando = false;
    }, { passive: true });

    // Botón reset
    const btnR = document.getElementById('btnZoomReset');
    if (btnR) btnR.addEventListener('click', resetZoom);

    console.log('zoom.js listo');
  }

  window.__zoomReset = resetZoom;
  window.__zoomAplicar = aplicar;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
