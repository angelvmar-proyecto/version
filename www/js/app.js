// ==============================================
// MAR Caribe v12.0 - APP PRINCIPAL
// ==============================================

let imagenActual = null;
let lienzo = null;
let ctx = null;
let zoom = 1;
let desplazamiento = { x: 0, y: 0 };
let toqueAnterior = null;
let distanciaPinchAnterior = null;
let ultimoToqueSimple = 0;

window.estadoPasos = {
  brillo: null, ancho: 0, alto: 0,
  perfilH: null, perfilV: null, ecoH: null, ecoV: null,
  imagenProcesada: null,
  celdas: [], matrizTexto: [], matrizColores: [], matrizConfianza: [],
  paso1Completado: false, paso2Completado: false,
  paso3Completado: false, paso4Completado: false,
  paso5Completado: false, paso6Completado: false,
  paso8Completado: false
};

function log(mensaje, tipo) {
  const logsEl = document.getElementById('logs');
  if (!logsEl) { console.log(mensaje); return; }
  const linea = document.createElement('div');
  linea.style.marginBottom = '2px';
  const colores = {
    'info': '#94a3b8', 'exito': '#22c55e', 'error': '#ef4444',
    'alerta': '#f59e0b', 'etapa': '#38bdf8'
  };
  linea.style.color = colores[tipo] || '#94a3b8';
  if (tipo === 'etapa') linea.style.fontWeight = 'bold';
  linea.textContent = mensaje;
  logsEl.appendChild(linea);
  logsEl.scrollTop = logsEl.scrollHeight;
  console.log(mensaje);
}

function actualizarProgreso(p) {
  const barra = document.getElementById('barraProgreso');
  if (!barra) return;
  barra.style.width = p + '%';
  barra.textContent = p + '%';
}

function marcarPasoCompletado(num) {
  const paso = document.getElementById('paso' + num);
  if (paso) paso.classList.add('hecho');
}

function cargarImagen(file) {
  log('📷 Cargando imagen...', 'etapa');
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      imagenActual = img;
      lienzo.width = img.width;
      lienzo.height = img.height;
      limpiarLineas();
      window.estadoPasos = {
        brillo: null, ancho: 0, alto: 0,
        perfilH: null, perfilV: null, ecoH: null, ecoV: null,
        imagenProcesada: null,
        celdas: [], matrizTexto: [], matrizColores: [], matrizConfianza: [],
        paso1Completado: false, paso2Completado: false,
        paso3Completado: false, paso4Completado: false,
        paso5Completado: false, paso6Completado: false,
        paso8Completado: false
      };
      for (let i = 1; i <= 9; i++) {
        const p = document.getElementById('paso' + i);
        if (p) p.classList.remove('hecho');
      }
      ajustarVista();
      actualizarProgreso(0);
      log(`✅ Imagen cargada: ${img.width}×${img.height}`, 'exito');
    };
    img.onerror = () => log('❌ Error al cargar', 'error');
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function ajustarVista() {
  if (!imagenActual) return;
  const area = document.querySelector('.area-img');
  if (!area) return;
  const anchoArea = area.clientWidth;
  const altoArea = area.clientHeight;
  const margen = 0.95;
  const ratioX = (anchoArea * margen) / imagenActual.width;
  const ratioY = (altoArea * margen) / imagenActual.height;
  zoom = Math.min(ratioX, ratioY);
  const anchoEsc = imagenActual.width * zoom;
  const altoEsc = imagenActual.height * zoom;
  desplazamiento = {
    x: (anchoArea - anchoEsc) / 2,
    y: (altoArea - altoEsc) / 2
  };
  dibujarTodo();
}

function cambiarZoom(delta, puntoX, puntoY) {
  if (!imagenActual) return;
  const area = document.querySelector('.area-img');
  if (!area) return;
  if (puntoX === undefined) puntoX = area.clientWidth / 2;
  if (puntoY === undefined) puntoY = area.clientHeight / 2;
  const zAnt = zoom;
  zoom = clamp(zoom + delta, CONFIG.ZOOM_MIN, CONFIG.ZOOM_MAX);
  if (zoom === zAnt) return;
  const factor = zoom / zAnt;
  desplazamiento.x = puntoX - (puntoX - desplazamiento.x) * factor;
  desplazamiento.y = puntoY - (puntoY - desplazamiento.y) * factor;
  dibujarTodo();
}

async function analizarTodo() {
  if (!imagenActual) {
    log('⚠️ Carga una imagen', 'alerta');
    alert('⚠️ Primero carga una imagen');
    return;
  }
  log('═══════════════════════════════════', 'etapa');
  log('🔬 ANÁLISIS COMPLETO', 'etapa');
  log('═══════════════════════════════════', 'etapa');

  try {
    actualizarProgreso(5);
    log('🔧 Paso 1: Preprocesamiento', 'etapa');
    const canvasP1 = document.createElement('canvas');
    canvasP1.width = imagenActual.width;
    canvasP1.height = imagenActual.height;
    const ctxP1 = canvasP1.getContext('2d');
    ctxP1.drawImage(imagenActual, 0, 0);
    let imageData = ctxP1.getImageData(0, 0, canvasP1.width, canvasP1.height);
    const preproc = preprocesarImagen(imageData);
    log(`   Color: ${preproc.tieneColor ? 'SÍ' : 'NO'} | Ruido: ${preproc.tieneRuido ? 'SÍ' : 'NO'}`, 'info');
    if (preproc.aplicoCRR) log('   ✅ CRR', 'exito');
    if (preproc.aplicoBS) log('   ✅ BS', 'exito');
    ctxP1.putImageData(preproc.imageData, 0, 0);
    window.estadoPasos.imagenProcesada = canvasP1;
    marcarPasoCompletado(1);
    actualizarProgreso(15);

    log('🎨 Paso 2: Brillo', 'etapa');
    const brillo = calcularBrillo(preproc.imageData);
    window.estadoPasos.brillo = brillo;
    window.estadoPasos.ancho = canvasP1.width;
    window.estadoPasos.alto = canvasP1.height;
    marcarPasoCompletado(2);
    actualizarProgreso(25);

    log('🔬 Pasos 3-5: Detección', 'etapa');
    const det = ejecutarDeteccion(brillo, canvasP1.width, canvasP1.height);
    window.lineasOpticaH = det.optica.lineasH;
    window.lineasOpticaV = det.optica.lineasV;
    window.lineasEcografiaH = det.ecografia.lineasH;
    window.lineasEcografiaV = det.ecografia.lineasV;
    window.lineasA3H = det.a3.lineasH;
    window.lineasA3V = det.a3.lineasV;
    log(`   🟡 ${det.optica.lineasH.length}H, ${det.optica.lineasV.length}V`, 'info');
    log(`   🔴🔵 ${det.ecografia.lineasH.length}H, ${det.ecografia.lineasV.length}V`, 'info');
    log(`   🟣 ${det.a3.lineasH.length}H, ${det.a3.lineasV.length}V`, 'info');
    marcarPasoCompletado(3); marcarPasoCompletado(4); marcarPasoCompletado(5);
    actualizarProgreso(55);
    dibujarTodo();

    log('📐 Paso 6: LIDAR', 'etapa');
    const lidar = ejecutarLidar(
      det.optica.lineasH, det.optica.lineasV,
      det.ecografia.lineasH, det.ecografia.lineasV,
      det.a3.lineasH, det.a3.lineasV,
      brillo, canvasP1.width, canvasP1.height
    );
    window.lineasLidarH = lidar.lineasH;
    window.lineasLidarV = lidar.lineasV;
    const rH = resumenVotacion(lidar.votosH);
    const rV = resumenVotacion(lidar.votosV);
    log(`   📊 H: ${rH.con3Votos}×3v, ${rH.con2Votos}×2v, ${rH.con1Voto}×1v`, 'info');
    log(`   📊 V: ${rV.con3Votos}×3v, ${rV.con2Votos}×2v, ${rV.con1Voto}×1v`, 'info');
    log(`   ✅ Finales: ${lidar.lineasH.length}H, ${lidar.lineasV.length}V`, 'exito');
    marcarPasoCompletado(6);
    actualizarProgreso(70);
    dibujarTodo();

    log('✂️ Paso 8: Celdas', 'etapa');
    const celdas = recortarCeldas(lidar.lineasH, lidar.lineasV);
    window.estadoPasos.celdas = celdas;
    window.estadoPasos.paso8Completado = true;
    const filas = lidar.lineasH.length - 1;
    const columnas = lidar.lineasV.length - 1;
    log(`   ${filas} filas × ${columnas} columnas = ${celdas.length} celdas`, 'exito');
    marcarPasoCompletado(8);
    actualizarProgreso(85);

    log('✅ ANÁLISIS LISTO. Elige ⚡/📊/🎯 para el OCR', 'exito');
    actualizarProgreso(90);

  } catch (e) {
    log(`❌ Error: ${e.message}`, 'error');
    console.error(e);
  }
}

function recortarCeldas(lineasH, lineasV) {
  const celdas = [];
  const nf = lineasH.length - 1;
  const nc = lineasV.length - 1;
  for (let f = 0; f < nf; f++) {
    for (let c = 0; c < nc; c++) {
      celdas.push({
        fila: f, col: c,
        x1: lineasV[c], y1: lineasH[f],
        x2: lineasV[c + 1], y2: lineasH[f + 1]
      });
    }
  }
  return celdas;
}

function limpiarTodo() {
  imagenActual = null;
  zoom = 1;
  desplazamiento = { x: 0, y: 0 };
  limpiarLineas();
  window.estadoPasos = {
    brillo: null, ancho: 0, alto: 0,
    perfilH: null, perfilV: null, ecoH: null, ecoV: null,
    imagenProcesada: null,
    celdas: [], matrizTexto: [], matrizColores: [], matrizConfianza: [],
    paso1Completado: false, paso2Completado: false,
    paso3Completado: false, paso4Completado: false,
    paso5Completado: false, paso6Completado: false,
    paso8Completado: false
  };
  lienzo.width = 0;
  lienzo.height = 0;
  for (let i = 1; i <= 9; i++) {
    const p = document.getElementById('paso' + i);
    if (p) p.classList.remove('hecho');
  }
  const input = document.getElementById('entradaImagen');
  if (input) input.value = '';
  document.getElementById('tablaWrapper').innerHTML = '<div class="empty-state">📊 Sin datos.</div>';
  actualizarProgreso(0);
  log('🗑️ Todo limpiado', 'info');
}

async function ejecutarOCR(modo) {
  if (window.estadoPasos.celdas.length === 0) {
    log('⚠️ Analiza primero', 'alerta');
    alert('⚠️ Primero ejecuta "Analizar"');
    return;
  }
  const fuente = window.estadoPasos.imagenProcesada || imagenActual;
  try {
    await ejecutarOCRCompleto(fuente, window.estadoPasos.celdas, modo);
  } catch (e) {
    log(`❌ Error OCR: ${e.message}`, 'error');
    console.error(e);
  }
}

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Iniciando MAR Caribe v12.0...');
  lienzo = document.getElementById('lienzo');
  ctx = lienzo.getContext('2d', { willReadFrequently: true });

  document.getElementById('btnCargar').onclick = () => document.getElementById('entradaImagen').click();
  document.getElementById('entradaImagen').onchange = (e) => {
    if (e.target.files && e.target.files[0]) cargarImagen(e.target.files[0]);
  };
  document.getElementById('btnAnalizar').onclick = analizarTodo;
  document.getElementById('btnLimpiar').onclick = limpiarTodo;
  document.getElementById('btnMas').onclick = () => cambiarZoom(CONFIG.ZOOM_PASO);
  document.getElementById('btnMenos').onclick = () => cambiarZoom(-CONFIG.ZOOM_PASO);

  const btnCentrar = document.getElementById('btnCentrar');
  if (btnCentrar) btnCentrar.onclick = ajustarVista;

  document.getElementById('btnLeerRapido').onclick = () => ejecutarOCR('rapido');
  document.getElementById('btnLeerMedio').onclick = () => ejecutarOCR('medio');
  document.getElementById('btnLeerPreciso').onclick = () => ejecutarOCR('preciso');

  document.querySelectorAll('.tab').forEach(tab => {
    tab.onclick = function() {
      const target = this.dataset.tab;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      document.getElementById('tab-' + target).classList.add('active');
    };
  });

  for (let i = 1; i <= 9; i++) {
    const paso = document.getElementById('paso' + i);
    if (paso) paso.onclick = () => log(`👆 Paso ${i}`, 'info');
  }

  // Gestos táctiles
  const areaImg = document.querySelector('.area-img');
  if (areaImg) {
    areaImg.addEventListener('touchstart', function(e) {
      if (!imagenActual) return;
      if (e.touches.length === 1) {
        toqueAnterior = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        const ahora = Date.now();
        if (ahora - ultimoToqueSimple < 300) {
          ajustarVista();
          ultimoToqueSimple = 0;
        } else ultimoToqueSimple = ahora;
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        distanciaPinchAnterior = Math.sqrt(dx * dx + dy * dy);
      }
    }, { passive: true });

    areaImg.addEventListener('touchmove', function(e) {
      if (!imagenActual) return;
      e.preventDefault();
      if (e.touches.length === 1 && toqueAnterior && !distanciaPinchAnterior) {
        const dx = e.touches[0].clientX - toqueAnterior.x;
        const dy = e.touches[0].clientY - toqueAnterior.y;
        desplazamiento.x += dx;
        desplazamiento.y += dy;
        toqueAnterior = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        dibujarTodo();
      } else if (e.touches.length === 2 && distanciaPinchAnterior) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const rect = areaImg.getBoundingClientRect();
        const px = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left;
        const py = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top;
        const factor = dist / distanciaPinchAnterior;
        const nz = clamp(zoom * factor, CONFIG.ZOOM_MIN, CONFIG.ZOOM_MAX);
        cambiarZoom(nz - zoom, px, py);
        distanciaPinchAnterior = dist;
      }
    }, { passive: false });

    areaImg.addEventListener('touchend', function(e) {
      if (e.touches.length === 0) {
        toqueAnterior = null;
        distanciaPinchAnterior = null;
      } else if (e.touches.length === 1) {
        toqueAnterior = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        distanciaPinchAnterior = null;
      }
    }, { passive: true });

    areaImg.addEventListener('wheel', function(e) {
      if (!imagenActual) return;
      e.preventDefault();
      const rect = areaImg.getBoundingClientRect();
      cambiarZoom(e.deltaY > 0 ? -CONFIG.ZOOM_PASO : CONFIG.ZOOM_PASO, e.clientX - rect.left, e.clientY - rect.top);
    }, { passive: false });
  }

  log('✅ App lista', 'exito');
  log('👆 Arrastra · 🔍 Pinch · 👆👆 Doble toque = centrar', 'info');
});

console.log('✅ App cargada');
