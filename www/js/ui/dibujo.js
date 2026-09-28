// ==============================================
// ui/dibujo.js
// Dibuja lineas sobre un canvas.
// ==============================================

/**
 * Dibuja un conjunto de lineas H y V sobre el canvas dado.
 */
function dibujarLineas(canvas, lineasH, lineasV, color, grosor) {
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = color || '#000000';
  ctx.lineWidth = grosor || Math.max(2, Math.floor(canvas.width / 500));

  if (lineasH) {
    lineasH.forEach(function(y) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    });
  }
  if (lineasV) {
    lineasV.forEach(function(x) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    });
  }
}

console.log('ui/dibujo.js cargado');
