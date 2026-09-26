// ==============================================
// MAR Caribe v12.0 - APP PRINCIPAL
// + Retina integrada + botones individuales funcionales + reset al analizar
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

// ============================================
// REINICIAR PASOS (para reanálisis limpio)
// ============================================
function reiniciarPasos(excepto) {
  for (let i = 1; i <= 9; i++) {
    if (i === excepto) continue;
    const paso = document.getElementById('paso' + i);
    if (paso) paso.classList.remove('hecho', 'activo');
  }
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
      limpiarLineas();
      reiniciarPasos();

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
      ajustarVista();
      actualizarProgreso(0);
      log('✅ Imagen cargada: ' + img.width + '×' + img.height, 'exito');
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

  // Usar getBoundingClientRect para dimensiones reales
  const rect = area.getBoundingClientRect();
  const anchoArea = rect.width;
  const altoArea = rect.height;

  if (anchoArea === 0 || altoArea === 0) {
    // El área aún no está renderizada, reintentar
    setTimeout(ajustarVista, 100);
    return;
  }

  // Margen del 95% para que se vea con un poco de aire
  const margen = 0.95;
  const ratioX = (anchoArea * margen) / imagenActual.width;
  const ratioY = (altoArea * margen) / imagenActual.height;
  zoom = Math.min(ratioX, ratioY);

  // Centrar: la imagen escalada ocupa imagenActual.width * zoom
  // El desplazamiento debe ponerla en el centro del área
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

  const rect = area.getBoundingClientRect();

  // Punto de referencia (por defecto: centro del área)
  if (puntoX === undefined) puntoX = rect.width / 2;
  if (puntoY === undefined) puntoY = rect.height / 2;

  const zAnt = zoom;
  zoom = clamp(zoom + delta, CONFIG.ZOOM_MIN, CONFIG.ZOOM_MAX);
  if (zoom === zAnt) return;

  // Ajustar desplazamiento para mantener el punto bajo el dedo/centro
  const factor = zoom / zAnt;
  desplazamiento.x = puntoX - (puntoX - desplazamiento.x) * factor;
  desplazamiento.y = puntoY - (puntoY - desplazamiento.y) * factor;

  dibujarTodo();
}

// ============================================
// ANÁLISIS COMPLETO
// ============================================
async function analizarTodo() {
  if (!imagenActual) {
    log('⚠️ Carga una imagen', 'alerta');
    alert('⚠️ Primero carga una imagen');
    return;
  }

  // Reiniciar pasos visuales Y líneas (pero mantener log)
  reiniciarPasos();
  limpiarLineas();
  actualizarProgreso(0);
  log('═══════════════════════════════════', 'etapa');
  log('🔬 NUEVO ANÁLISIS', 'etapa');
  log('═══════════════════════════════════', 'etapa');

  try {
    actualizarProgreso(5);
    log('🔧 Paso 1: Preprocesamiento', 'etapa');
    const canvasP1 = document.createElement('canvas');
    canvasP1.width = imagenActual.width;
    canvasP1.height = imagenActual.height;
    const ctxP1 = canvasP1.getContext('2d');
    ctxP1.drawImage(imagenActual, 0, 0);

    // v13-fase2: guardar COPIA ORIGINAL antes de filtros (para OCR limpio)
    const canvasOriginal = document.createElement('canvas');
    canvasOriginal.width = canvasP1.width;
    canvasOriginal.height = canvasP1.height;
    canvasOriginal.getContext('2d').drawImage(canvasP1, 0, 0);
    window.estadoPasos.imagenOriginal = canvasOriginal;

    let imageData = ctxP1.getImageData(0, 0, canvasP1.width, canvasP1.height);
    const preproc = preprocesarImagen(imageData);
    log('   Color: ' + (preproc.tieneColor ? 'SÍ' : 'NO') + ' | Ruido: ' + (preproc.tieneRuido ? 'SÍ' : 'NO'), 'info');
    if (preproc.aplicoCRR) log('   ✅ CRR', 'exito');
    if (preproc.aplicoBS) log('   ✅ BS', 'exito');
    ctxP1.putImageData(preproc.imageData, 0, 0);

    // ✨ RETINAL GLOBAL (antes de detección de líneas)
    // Mejora la detección de líneas tenues/grises
    if (typeof aplicarRetinaGlobal === 'function' && CONFIG.RETINA_GLOBAL_ACTIVO) {
      log('🧠 Retinal global: aplicando contraste local...', 'info');
      const inicioRetina = Date.now();
      aplicarRetinaGlobal(canvasP1);
      const duracionRetina = ((Date.now() - inicioRetina) / 1000).toFixed(2);
      log('   ✅ Retinal global aplicado en ' + duracionRetina + 's', 'exito');
    }

    window.estadoPasos.imagenProcesada = canvasP1;
    marcarPasoCompletado(1);
    actualizarProgreso(15);

    log('🎨 Paso 2: Brillo', 'etapa');
    const imageDataPostRetina = ctxP1.getImageData(0, 0, canvasP1.width, canvasP1.height);
    const brillo = calcularBrillo(imageDataPostRetina);
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
    log('   🟡 Óptica: ' + det.optica.lineasH.length + 'H, ' + det.optica.lineasV.length + 'V', 'info');
    log('   🔴🔵 Eco: ' + det.ecografia.lineasH.length + 'H, ' + det.ecografia.lineasV.length + 'V', 'info');
    log('   🟣 A3: ' + det.a3.lineasH.length + 'H, ' + det.a3.lineasV.length + 'V', 'info');

    // LVC: 4to algoritmo (coherencia vertical para columnas angostas)
    const lvc = detectarCoherenciaV(brillo, canvasP1.width, canvasP1.height);
    window.lineasLVCV = lvc.lineasV;
    log('   📊 LVC: ' + lvc.lineasV.length + 'V', 'info');

    // OPENV: 5to algoritmo (opening vertical morfologico)
    const openv = detectarOpeningVertical(brillo, canvasP1.width, canvasP1.height);
    window.lineasOPENVV = openv.lineasV;
    log('   🔷 OPENV: ' + openv.lineasV.length + 'V', 'info');

    marcarPasoCompletado(3);
    marcarPasoCompletado(4);
    marcarPasoCompletado(5);
    actualizarProgreso(55);
    dibujarTodo();

    log('📐 Paso 6: LIDAR', 'etapa');
    const lidar = ejecutarLidar(
      det.optica.lineasH, det.optica.lineasV,
      det.ecografia.lineasH, det.ecografia.lineasV,
      det.a3.lineasH, det.a3.lineasV,
      brillo, canvasP1.width, canvasP1.height,
      lvc.lineasV
    );
    window.lineasLidarH = lidar.lineasH;
    window.lineasLidarV = lidar.lineasV;
    const rH = resumenVotacion(lidar.votosH);
    const rV = resumenVotacion(lidar.votosV);
    log('   📊 H: ' + rH.con3Votos + '×3v, ' + rH.con2Votos + '×2v, ' + rH.con1Voto + '×1v', 'info');
    log('   📊 V: ' + rV.con3Votos + '×3v, ' + rV.con2Votos + '×2v, ' + rV.con1Voto + '×1v', 'info');
    log('   ✅ Finales: ' + lidar.lineasH.length + 'H, ' + lidar.lineasV.length + 'V', 'exito');
    marcarPasoCompletado(6);
    actualizarProgreso(70);
    dibujarTodo();

    log('✂️ Paso 8: Celdas', 'etapa');
    const celdas = recortarCeldas(lidar.lineasH, lidar.lineasV);
    window.estadoPasos.celdas = celdas;
    window.estadoPasos.paso8Completado = true;
    const filas = lidar.lineasH.length - 1;
    const columnas = lidar.lineasV.length - 1;
    log('   ' + filas + ' filas × ' + columnas + ' columnas = ' + celdas.length + ' celdas', 'exito');
    marcarPasoCompletado(8);
    actualizarProgreso(85);

    log('✅ ANÁLISIS LISTO. Elige ⚡/📊/🎯 para el OCR', 'exito');
    actualizarProgreso(90);

  } catch (e) {
    log('❌ Error: ' + e.message, 'error');
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
  reiniciarPasos();
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
  const input = document.getElementById('entradaImagen');
  if (input) input.value = '';
  const tw = document.getElementById('tablaWrapper');
  if (tw) tw.innerHTML = '<div class="empty-state">📊 Sin datos.</div>';
  actualizarProgreso(0);
  log('🗑️ Todo limpiado', 'info');
}

async function ejecutarOCR(modo) {
  if (window.estadoPasos.celdas.length === 0) {
    log('⚠️ Analiza primero', 'alerta');
    alert('⚠️ Primero ejecuta "Analizar"');
    return;
  }
  // v13-fase2: usar imagen ORIGINAL (sin filtros) para OCR limpio
  const fuente = window.estadoPasos.imagenOriginal
              || window.estadoPasos.imagenProcesada
              || imagenActual;
  try {
    await ejecutarOCRCompleto(fuente, window.estadoPasos.celdas, modo);
  } catch (e) {
    log('❌ Error OCR: ' + e.message, 'error');
    console.error(e);
  }
}

// ============================================
// BOTONES INDIVIDUALES DE ALGORITMOS
// ============================================
async function ejecutarPasoIndividual(num) {
  if (!imagenActual) {
    log('⚠️ Carga una imagen primero', 'alerta');
    return;
  }

  log('═══════════════════════════════════', 'etapa');
  log('🎯 PASO ' + num + ' INDIVIDUAL', 'etapa');
  log('═══════════════════════════════════', 'etapa');

  // Marcar visualmente el paso activo
  document.querySelectorAll('.paso').forEach(p => p.classList.remove('activo'));
  const pasoEl = document.getElementById('paso' + num);
  if (pasoEl) pasoEl.classList.add('activo');

  // Asegurar brillo calculado
  if (!window.estadoPasos.brillo) {
    const canvasP1 = document.createElement('canvas');
    canvasP1.width = imagenActual.width;
    canvasP1.height = imagenActual.height;
    const ctxP1 = canvasP1.getContext('2d');
    ctxP1.drawImage(imagenActual, 0, 0);
    const imageData = ctxP1.getImageData(0, 0, canvasP1.width, canvasP1.height);
    window.estadoPasos.brillo = calcularBrillo(imageData);
    window.estadoPasos.ancho = canvasP1.width;
    window.estadoPasos.alto = canvasP1.height;
    window.estadoPasos.imagenProcesada = canvasP1;
  }

  const brillo = window.estadoPasos.brillo;
  const ancho = window.estadoPasos.ancho;
  const alto = window.estadoPasos.alto;

  try {
    switch (num) {
      case 3: {
        log('🔭 Ejecutando solo Óptica...', 'etapa');
        const r = detectarOptica(brillo, ancho, alto);
        const aj = aplicarAjusteLocal(r.lineasH, r.lineasV, brillo, alto, ancho);
        window.lineasOpticaH = aj.lineasH;
        window.lineasOpticaV = aj.lineasV;
        window.lineasEcografiaH = [];
        window.lineasEcografiaV = [];
        window.lineasA3H = [];
        window.lineasA3V = [];
        window.lineasLidarH = [];
        window.lineasLidarV = [];
        log('   🟡 Óptica: ' + aj.lineasH.length + 'H, ' + aj.lineasV.length + 'V', 'exito');
        dibujarTodo();
        marcarPasoCompletado(3);
        break;
      }
      case 4: {
        log('🔊 Ejecutando solo Ecografía...', 'etapa');
        const r = detectarEcografia(brillo, ancho, alto);
        const aj = aplicarAjusteLocal(r.lineasH, r.lineasV, brillo, alto, ancho);
        window.lineasEcografiaH = aj.lineasH;
        window.lineasEcografiaV = aj.lineasV;
        window.lineasOpticaH = [];
        window.lineasOpticaV = [];
        window.lineasA3H = [];
        window.lineasA3V = [];
        window.lineasLidarH = [];
        window.lineasLidarV = [];
        log('   🔴🔵 Eco: ' + aj.lineasH.length + 'H, ' + aj.lineasV.length + 'V', 'exito');
        dibujarTodo();
        marcarPasoCompletado(4);
        break;
      }
      case 5: {
        log('🟣 Ejecutando solo A3...', 'etapa');
        const r = detectarA3(brillo, ancho, alto);
        const aj = aplicarAjusteLocal(r.lineasH, r.lineasV, brillo, alto, ancho);
        window.lineasA3H = aj.lineasH;
        window.lineasA3V = aj.lineasV;
        window.lineasOpticaH = [];
        window.lineasOpticaV = [];
        window.lineasEcografiaH = [];
        window.lineasEcografiaV = [];
        window.lineasLidarH = [];
        window.lineasLidarV = [];
        log('   🟣 A3: ' + aj.lineasH.length + 'H, ' + aj.lineasV.length + 'V', 'exito');
        dibujarTodo();
        marcarPasoCompletado(5);
        break;
      }
      case 6: {
        log('📐 Ejecutando LIDAR (requiere los 3 algoritmos)...', 'etapa');
        if (!window.lineasOpticaH.length && !window.lineasA3H.length && !window.lineasEcografiaH.length) {
          log('   ⚠️ Ejecuta primero 3, 4 y 5 (o Analizar completo)', 'alerta');
          return;
        }
        const lidar = ejecutarLidar(
          window.lineasOpticaH, window.lineasOpticaV,
          window.lineasEcografiaH, window.lineasEcografiaV,
          window.lineasA3H, window.lineasA3V,
          brillo, ancho, alto
        );
        window.lineasLidarH = lidar.lineasH;
        window.lineasLidarV = lidar.lineasV;
        log('   ✅ Finales: ' + lidar.lineasH.length + 'H, ' + lidar.lineasV.length + 'V', 'exito');
        dibujarTodo();
        marcarPasoCompletado(6);
        break;
      }
      case 8: {
        log('✂️ Recortando celdas...', 'etapa');
        const lh = window.lineasLidarH.length ? window.lineasLidarH : window.lineasOpticaH;
        const lv = window.lineasLidarV.length ? window.lineasLidarV : window.lineasOpticaV;
        if (lh.length < 2 || lv.length < 2) {
          log('   ⚠️ Necesitas al menos 2 líneas H y 2 V', 'alerta');
          return;
        }
        window.estadoPasos.celdas = recortarCeldas(lh, lv);
        log('   ' + (lh.length - 1) + ' filas × ' + (lv.length - 1) + ' columnas = ' + window.estadoPasos.celdas.length + ' celdas', 'exito');
        marcarPasoCompletado(8);
        break;
      }
      default:
        log('   ℹ️ Paso ' + num + ' sin función individual (usa Analizar)', 'info');
    }
  } catch (e) {
    log('❌ Error en paso ' + num + ': ' + e.message, 'error');
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

  const btnT1 = document.getElementById('btnLeerTripleEscala');
  if (btnT1) btnT1.onclick = () => ejecutarOCRMulti(['rapido', 'rapido_x2', 'rapido_x3'], {}, 'TRIPLE ESCALA');
  const btnT2 = document.getElementById('btnLeerTripleDicc');
  if (btnT2) btnT2.onclick = () => ejecutarOCRMulti(['rapido', 'medio', 'preciso'], { usarDiccionario: true }, 'TRIPLE + DICC');
  const btnT3 = document.getElementById('btnLeerUltra');
  if (btnT3) btnT3.onclick = () => ejecutarOCRMulti(['rapido_x2', 'medio_x2', 'preciso'], { usarDiccionario: true }, 'ULTRA');
  const btnRetry = document.getElementById('btnLeerRetry');
  if (btnRetry) btnRetry.onclick = () => ejecutarOCRRetry();

  document.querySelectorAll('.tab').forEach(tab => {
    tab.onclick = function() {
      const target = this.dataset.tab;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      document.getElementById('tab-' + target).classList.add('active');
    };
  });

  // PASOS INDIVIDUALES: ahora funcionales
  for (let i = 1; i <= 9; i++) {
    const paso = document.getElementById('paso' + i);
    if (paso) {
      paso.onclick = () => ejecutarPasoIndividual(i);
    }
  }

  // Gestos táctiles (sin cambios)
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
  }

  log('✅ App lista', 'exito');
  log('👆 Arrastra · 🔍 Pinch · 👆👆 Doble toque = centrar', 'info');
  log('🎯 Pulsa los números de paso (3, 4, 5, 6, 8) para ejecutarlos individualmente', 'info');
});

console.log('✅ App cargada');

// ============================================================
// v13-fase2: OCR multi-pasada + retry
// ============================================================
async function _ejecutarOCRGenerico(fn, nombre) {
  if (window.estadoPasos.celdas.length === 0) {
    log('⚠️ Analiza primero', 'alerta');
    alert('⚠️ Primero ejecuta "Analizar"');
    return;
  }
  // v13-fase2: usar imagen ORIGINAL (sin filtros) para OCR limpio
  const fuente = window.estadoPasos.imagenOriginal
              || window.estadoPasos.imagenProcesada
              || imagenActual;
  const celdas = window.estadoPasos.celdas;
  log('═══════════════════════════════════', 'etapa');
  log('🔬 OCR ' + nombre, 'etapa');
  log('═══════════════════════════════════', 'etapa');
  const inicio = Date.now();
  try {
    const r = await fn(fuente, celdas);
    const duracion = ((Date.now() - inicio) / 1000).toFixed(1);
    log('✅ OCR ' + nombre + ' en ' + duracion + 's', 'exito');

    const matrizTexto = r.matrizTexto;
    const matrizConfianza = r.matrizConfianza;
    window.estadoPasos.matrizTexto = matrizTexto;
    window.estadoPasos.matrizConfianza = matrizConfianza;
    window.estadoPasos.matrizColores = extraerColoresCelda(fuente, celdas);

    if (typeof aprendizajeAplicar === 'function' && CONFIG.APRENDIZAJE_ACTIVO) {
      const apr = aprendizajeAplicar(matrizTexto);
      if (apr.aplicado && apr.correcciones > 0) log('🎓 Aprendizaje: ' + apr.correcciones + ' celdas', 'exito');
    }
    const corr = aplicarConsistenciaCruzada(matrizTexto);
    if (corr > 0) log('🧠 Consistencia: ' + corr + ' celdas', 'exito');

    mostrarTabla(matrizTexto, window.estadoPasos.matrizColores, matrizConfianza);
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('[data-tab="tabla"]').classList.add('active');
    document.getElementById('tab-tabla').classList.add('active');
    marcarPasoCompletado(9);
    log('✅ Resultados en 📊 Tabla', 'exito');
  } catch (e) {
    log('❌ Error: ' + e.message, 'error');
    console.error(e);
  }
}

async function ejecutarOCRMulti(modos, estrategia, nombre) {
  return _ejecutarOCRGenerico(
    (f, c) => ocrMultiPasada(f, c, modos, estrategia || {}),
    nombre + ' (' + modos.length + ' pasadas)'
  );
}

async function ejecutarOCRRetry() {
  return _ejecutarOCRGenerico(
    (f, c) => ocrMatrizConRetry(f, c, 'rapido', 70),
    'RETRY SELECTIVO'
  );
}


// ============================================================
// v13-fase2: Exportar capas individuales para diagnostico
// ============================================================
async function exportarCapasDiag() {
  if (!window.estadoPasos || (!window.estadoPasos.imagenProcesada && !imagenActual)) {
    alert('Primero carga y analiza una imagen');
    return;
  }
  const fuente = window.estadoPasos.imagenProcesada || imagenActual;
  const ts = Date.now();
  const fs = (typeof Capacitor !== 'undefined' && Capacitor.Plugins)
    ? Capacitor.Plugins.Filesystem : null;

  const capas = [
    { nombre: 'optica', color: '#FFD700', V: window.lineasOpticaV || [], H: window.lineasOpticaH || [] },
    { nombre: 'a3', color: '#8B5CF6', V: window.lineasA3V || [], H: window.lineasA3H || [] },
    { nombre: 'lvc', color: '#ec4899', V: window.lineasLVCV || [], H: [] },
    { nombre: 'openv', color: '#22d3ee', V: window.lineasOPENVV || [], H: [] },
    { nombre: 'lidar', color: '#000000', V: window.lineasLidarV || [], H: window.lineasLidarH || [] },
  ];

  let guardados = 0;

  for (const capa of capas) {
    const canvas = document.createElement('canvas');
    canvas.width = fuente.width;
    canvas.height = fuente.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(fuente, 0, 0);

    ctx.strokeStyle = capa.color;
    ctx.lineWidth = Math.max(2, Math.floor(canvas.width / 500));

    capa.V.forEach(function(x) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    });
    capa.H.forEach(function(y) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    });

    const dataURL = canvas.toDataURL('image/png');
    const base64 = dataURL.replace(/^data:image\/png;base64,/, '');

    if (fs) {
      try {
        await fs.writeFile({
          path: 'capas_' + ts + '_' + capa.nombre + '.png',
          data: base64,
          directory: 'DOCUMENTS'
        });
        guardados++;
      } catch(e) {
        console.log('Error guardando ' + capa.nombre + ': ' + e.message);
      }
    }
  }

  const info = {
    imagen: fuente.width + 'x' + fuente.height,
    timestamp: new Date().toISOString(),
    capas: capas.map(function(c) {
      return {
        nombre: c.nombre,
        V_count: c.V.length,
        H_count: c.H.length,
        V: c.V,
        H: c.H
      };
    })
  };
  const txt = JSON.stringify(info, null, 2);

  if (fs) {
    const txt64 = btoa(unescape(encodeURIComponent(txt)));
    try {
      await fs.writeFile({
        path: 'capas_' + ts + '_posiciones.json',
        data: txt64,
        directory: 'DOCUMENTS'
      });
      guardados++;
    } catch(e) {
      console.log('Error guardando posiciones: ' + e.message);
    }
  }

  alert('✅ Exportadas ' + guardados + ' archivos a Documentos.\n\nBusca archivos capas_' + ts + '_*.png y capas_' + ts + '_posiciones.json');
}

document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    const btn = document.getElementById('btnExportarCapas');
    if (btn) btn.onclick = exportarCapasDiag;
  }, 800);
});
