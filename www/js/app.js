// ==============================================
// MAR Caribe v12.0 - APP PRINCIPAL
// UI + Zoom + Carga + Orquestación + OCR
// ==============================================

// ============================================
// ESTADO GLOBAL DE LA APP
// ============================================
let imagenActual = null;
let lienzo = null;
let ctx = null;
let zoom = 1;
let desplazamiento = { x: 0, y: 0 };

// Estado de los pasos (compartido con pasos individuales)
window.estadoPasos = {
  brillo: null,
  ancho: 0,
  alto: 0,
  perfilH: null,
  perfilV: null,
  ecoH: null,
  ecoV: null,
  imagenProcesada: null,
  celdas: [],
  matrizTexto: [],
  matrizColores: [],
  paso1Completado: false,
  paso2Completado: false,
  paso3Completado: false,
  paso4Completado: false,
  paso5Completado: false,
  paso6Completado: false,
  paso8Completado: false
};

// ============================================
// LOG
// ============================================
function log(mensaje, tipo) {
  const logsEl = document.getElementById('logs');
  if (!logsEl) {
    console.log(mensaje);
    return;
  }
  const linea = document.createElement('div');
  linea.style.marginBottom = '2px';

  // Colores según tipo
  const colores = {
    'info': '#94a3b8',
    'exito': '#22c55e',
    'error': '#ef4444',
    'alerta': '#f59e0b',
    'etapa': '#38bdf8'
  };
  linea.style.color = colores[tipo] || '#94a3b8';
  if (tipo === 'etapa') linea.style.fontWeight = 'bold';
  linea.textContent = mensaje;

  logsEl.appendChild(linea);
  logsEl.scrollTop = logsEl.scrollHeight;

  // También a consola
  console.log(mensaje);
}

// ============================================
// ACTUALIZAR BARRA DE PROGRESO
// ============================================
function actualizarProgreso(porcentaje) {
  const barra = document.getElementById('barraProgreso');
  if (!barra) return;
  barra.style.width = porcentaje + '%';
  barra.textContent = porcentaje + '%';
}

// ============================================
// MARCAR PASO COMO COMPLETADO
// ============================================
function marcarPasoCompletado(num) {
  const paso = document.getElementById('paso' + num);
  if (paso) paso.classList.add('hecho');
}

// ============================================
// CARGAR IMAGEN
// ============================================
function cargarImagen(file) {
  log('📷 Cargando imagen...', 'etapa');

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      imagenActual = img;
      lienzo.width = img.width;
      lienzo.height = img.height;
      zoom = 1;
      desplazamiento = { x: 0, y: 0 };

      // Resetear estado
      limpiarLineas();
      window.estadoPasos = {
        brillo: null, ancho: 0, alto: 0,
        perfilH: null, perfilV: null, ecoH: null, ecoV: null,
        imagenProcesada: null,
        celdas: [], matrizTexto: [], matrizColores: [],
        paso1Completado: false, paso2Completado: false,
        paso3Completado: false, paso4Completado: false,
        paso5Completado: false, paso6Completado: false,
        paso8Completado: false
      };

      // Resetear pasos visuales
      for (let i = 1; i <= 9; i++) {
        const p = document.getElementById('paso' + i);
        if (p) p.classList.remove('hecho');
      }

      dibujarTodo();
      actualizarProgreso(0);
      log(`✅ Imagen cargada: ${img.width}×${img.height}`, 'exito');
    };
    img.onerror = function() {
      log('❌ Error al cargar la imagen', 'error');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ============================================
// AJUSTAR VISTA (centrar imagen)
// ============================================
function ajustarVista() {
  if (!imagenActual) return;
  const area = document.querySelector('.area-img');
  if (!area) return;

  const anchoArea = area.clientWidth;
  const altoArea = area.clientHeight;
  const ratioX = anchoArea / imagenActual.width;
  const ratioY = altoArea / imagenActual.height;
  zoom = Math.min(ratioX, ratioY, 1);

  desplazamiento = { x: 0, y: 0 };
  dibujarTodo();
}

// ============================================
// ZOOM
// ============================================
function cambiarZoom(delta) {
  if (!imagenActual) return;
  const zoomAnterior = zoom;
  zoom = clamp(zoom + delta, CONFIG.ZOOM_MIN, CONFIG.ZOOM_MAX);
  if (zoom === zoomAnterior) return;
  dibujarTodo();
  log(`🔍 Zoom: ${zoom.toFixed(2)}x`, 'info');
}

// ============================================
// ANALIZAR TODO (pipeline completo)
// ============================================
async function analizarTodo() {
  if (!imagenActual) {
    log('⚠️ Carga una imagen primero', 'alerta');
    alert('⚠️ Primero carga una imagen');
    return;
  }

  log('═══════════════════════════════════', 'etapa');
  log('🔬 ANÁLISIS COMPLETO', 'etapa');
  log('═══════════════════════════════════', 'etapa');

  try {
    actualizarProgreso(5);

    // =====================================
    // PASO 1: PREPROCESAMIENTO
    // =====================================
    log('🔧 Paso 1: Preprocesamiento', 'etapa');
    const canvasPaso1 = document.createElement('canvas');
    canvasPaso1.width = imagenActual.width;
    canvasPaso1.height = imagenActual.height;
    const ctxP1 = canvasPaso1.getContext('2d');
    ctxP1.drawImage(imagenActual, 0, 0);

    let imageData = ctxP1.getImageData(0, 0, canvasPaso1.width, canvasPaso1.height);
    const preproc = preprocesarImagen(imageData);

    log(`   • Color detectado: ${preproc.tieneColor ? 'SÍ' : 'NO'}`, 'info');
    log(`   • Ruido detectado: ${preproc.tieneRuido ? 'SÍ' : 'NO'}`, 'info');
    if (preproc.aplicoCRR) log('   ✅ CRR aplicado', 'exito');
    if (preproc.aplicoBS) log('   ✅ BS aplicado', 'exito');

    ctxP1.putImageData(preproc.imageData, 0, 0);
    window.estadoPasos.imagenProcesada = canvasPaso1;
    marcarPasoCompletado(1);
    actualizarProgreso(15);

    // =====================================
    // PASO 2: CANALES (BRILLO)
    // =====================================
    log('🎨 Paso 2: Canales (brillo)', 'etapa');
    const brillo = calcularBrillo(preproc.imageData);
    window.estadoPasos.brillo = brillo;
    window.estadoPasos.ancho = canvasPaso1.width;
    window.estadoPasos.alto = canvasPaso1.height;

    log(`   • Dimensiones: ${canvasPaso1.width}×${canvasPaso1.height}`, 'info');
    marcarPasoCompletado(2);
    actualizarProgreso(25);

    // =====================================
    // PASO 3-5: DETECCIÓN (los 3 algoritmos)
    // =====================================
    log('🔬 Pasos 3-5: Detección de líneas', 'etapa');
    const deteccion = ejecutarDeteccion(brillo, canvasPaso1.width, canvasPaso1.height);

    // Guardar resultados de cada algoritmo
    window.lineasOpticaH = deteccion.optica.lineasH;
    window.lineasOpticaV = deteccion.optica.lineasV;
    window.lineasEcografiaH = deteccion.ecografia.lineasH;
    window.lineasEcografiaV = deteccion.ecografia.lineasV;
    window.lineasA3H = deteccion.a3.lineasH;
    window.lineasA3V = deteccion.a3.lineasV;

    window.estadoPasos.perfilH = deteccion.optica.perfilH;
    window.estadoPasos.perfilV = deteccion.optica.perfilV;
    window.estadoPasos.ecoH = deteccion.ecografia.ecoH;
    window.estadoPasos.ecoV = deteccion.ecografia.ecoV;

    log(`   🟡 Óptica:     ${deteccion.optica.lineasH.length}H, ${deteccion.optica.lineasV.length}V`, 'info');
    log(`   🔴🔵 Ecografía: ${deteccion.ecografia.lineasH.length}H, ${deteccion.ecografia.lineasV.length}V`, 'info');
    log(`   🟣 A3:         ${deteccion.a3.lineasH.length}H, ${deteccion.a3.lineasV.length}V`, 'info');

    marcarPasoCompletado(3);
    marcarPasoCompletado(4);
    marcarPasoCompletado(5);
    actualizarProgreso(55);

    // Redibujar con las líneas de cada algoritmo
    dibujarTodo();

    // =====================================
    // PASO 6: LIDAR (votación)
    // =====================================
    log('📐 Paso 6: LIDAR (votación)', 'etapa');
    const lidar = ejecutarLidar(
      deteccion.optica.lineasH, deteccion.optica.lineasV,
      deteccion.ecografia.lineasH, deteccion.ecografia.lineasV,
      deteccion.a3.lineasH, deteccion.a3.lineasV,
      brillo, canvasPaso1.width, canvasPaso1.height
    );

    // Guardar líneas finales
    window.lineasLidarH = lidar.lineasH;
    window.lineasLidarV = lidar.lineasV;
    window.estadoPasos.lineasH = lidar.lineasH;
    window.estadoPasos.lineasV = lidar.lineasV;

    // Mostrar resumen
    const resH = resumenVotacion(lidar.votosH);
    const resV = resumenVotacion(lidar.votosV);
    log(`   📊 H: ${resH.con3Votos} con 3v, ${resH.con2Votos} con 2v, ${resH.con1Voto} con 1v`, 'info');
    log(`   📊 V: ${resV.con3Votos} con 3v, ${resV.con2Votos} con 2v, ${resV.con1Voto} con 1v`, 'info');
    log(`   ✅ Finales: ${lidar.lineasH.length}H, ${lidar.lineasV.length}V`, 'exito');

    marcarPasoCompletado(6);
    actualizarProgreso(70);
    dibujarTodo();

    // =====================================
    // PASO 8: RECORTAR CELDAS
    // =====================================
    log('✂️ Paso 8: Recortar celdas', 'etapa');
    const celdas = recortarCeldas(lidar.lineasH, lidar.lineasV);
    window.estadoPasos.celdas = celdas;
    window.estadoPasos.paso8Completado = true;

    const filas = lidar.lineasH.length - 1;
    const columnas = lidar.lineasV.length - 1;
    log(`   • Filas: ${filas}`, 'exito');
    log(`   • Columnas: ${columnas}`, 'exito');
    log(`   • Celdas totales: ${celdas.length}`, 'exito');

    marcarPasoCompletado(8);
    actualizarProgreso(85);

    // =====================================
    // RESUMEN FINAL
    // =====================================
    actualizarProgreso(100);
    log('═══════════════════════════════════', 'etapa');
    log('✅ ANÁLISIS COMPLETO', 'exito');
    log(`   📊 Tabla: ${filas} filas × ${columnas} columnas`, 'exito');
    log(`   📄 Listo para OCR (elige Rápido/Medio/Preciso)`, 'info');
    log('═══════════════════════════════════', 'etapa');

  } catch (e) {
    log(`❌ Error en análisis: ${e.message}`, 'error');
    console.error(e);
  }
}

// ============================================
// RECORTAR CELDAS
// ============================================
function recortarCeldas(lineasH, lineasV) {
  const celdas = [];
  const numFilas = lineasH.length - 1;
  const numColumnas = lineasV.length - 1;

  for (let f = 0; f < numFilas; f++) {
    for (let c = 0; c < numColumnas; c++) {
      celdas.push({
        fila: f,
        col: c,
        x1: lineasV[c],
        y1: lineasH[f],
        x2: lineasV[c + 1],
        y2: lineasH[f + 1]
      });
    }
  }
  return celdas;
}

// ============================================
// LIMPIAR TODO
// ============================================
function limpiarTodo() {
  imagenActual = null;
  zoom = 1;
  desplazamiento = { x: 0, y: 0 };
  limpiarLineas();
  window.estadoPasos = {
    brillo: null, ancho: 0, alto: 0,
    perfilH: null, perfilV: null, ecoH: null, ecoV: null,
    imagenProcesada: null,
    celdas: [], matrizTexto: [], matrizColores: [],
    paso1Completado: false, paso2Completado: false,
    paso3Completado: false, paso4Completado: false,
    paso5Completado: false, paso6Completado: false,
    paso8Completado: false
  };

  // Resetear canvas
  lienzo.width = 0;
  lienzo.height = 0;

  // Resetear pasos visuales
  for (let i = 1; i <= 9; i++) {
    const p = document.getElementById('paso' + i);
    if (p) p.classList.remove('hecho');
  }

  // Resetear inputs
  const input = document.getElementById('entradaImagen');
  if (input) input.value = '';

  actualizarProgreso(0);
  log('🗑️ Todo limpiado', 'info');
}

// ============================================
// OCR (placeholder - se implementará después)
// ============================================
async function ejecutarOCR(modo) {
  if (window.estadoPasos.celdas.length === 0) {
    log('⚠️ Ejecuta el análisis primero', 'alerta');
    alert('⚠️ Primero ejecuta "Analizar Todo"');
    return;
  }

  log('═══════════════════════════════════', 'etapa');
  log(`📄 OCR en modo: ${modo.toUpperCase()}`, 'etapa');
  log('═══════════════════════════════════', 'etapa');
  log('⏳ OCR aún no implementado en v12.0', 'alerta');
  log('   • Los pasos 1-8 ya funcionan', 'info');
  log('   • El OCR viene en la siguiente fase', 'info');
}

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Inicializando MAR Caribe v12.0...');

  // Capturar referencias
  lienzo = document.getElementById('lienzo');
  ctx = lienzo.getContext('2d', { willReadFrequently: true });

  // ====================================
  // BOTONES
  // ====================================

  // Cargar imagen
  document.getElementById('btnCargar').onclick = function() {
    document.getElementById('entradaImagen').click();
  };

  // Input de imagen
  document.getElementById('entradaImagen').onchange = function(e) {
    if (e.target.files && e.target.files[0]) {
      cargarImagen(e.target.files[0]);
    }
  };

  // Analizar todo
  document.getElementById('btnAnalizar').onclick = analizarTodo;

  // Limpiar
  document.getElementById('btnLimpiar').onclick = limpiarTodo;

  // Zoom
  document.getElementById('btnMas').onclick = function() {
    cambiarZoom(CONFIG.ZOOM_PASO);
  };
  document.getElementById('btnMenos').onclick = function() {
    cambiarZoom(-CONFIG.ZOOM_PASO);
  };

  // OCR
  const btnRapido = document.getElementById('btnLeerRapido');
  const btnMedio = document.getElementById('btnLeerMedio');
  const btnPreciso = document.getElementById('btnLeerPreciso');

  if (btnRapido) btnRapido.onclick = function() { ejecutarOCR('rapido'); };
  if (btnMedio) btnMedio.onclick = function() { ejecutarOCR('medio'); };
  if (btnPreciso) btnPreciso.onclick = function() { ejecutarOCR('preciso'); };

  // ====================================
  // TABS
  // ====================================
  document.querySelectorAll('.tab').forEach(tab => {
    tab.onclick = function() {
      const target = this.dataset.tab;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      document.getElementById('tab-' + target).classList.add('active');
    };
  });

  // ====================================
  // PASOS INDIVIDUALES (opcional)
  // ====================================
  for (let i = 1; i <= 9; i++) {
    const paso = document.getElementById('paso' + i);
    if (paso) {
      paso.onclick = function() {
        log(`👆 Paso ${i} pulsado (usa "Analizar Todo" para el pipeline completo)`, 'info');
      };
    }
  }

  // ====================================
  // ZOOM CON RUEDA (desktop)
  // ====================================
  const areaImg = document.querySelector('.area-img');
  if (areaImg) {
    areaImg.addEventListener('wheel', function(e) {
      if (!imagenActual) return;
      e.preventDefault();
      cambiarZoom(e.deltaY > 0 ? -CONFIG.ZOOM_PASO : CONFIG.ZOOM_PASO);
    }, { passive: false });
  }

  log('✅ App lista. Carga una imagen para empezar.', 'exito');
});

console.log('✅ App cargada');
