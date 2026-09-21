// ============================================================
// MAR Caribe v13 — aprendizaje-ui.js
// UI de la pestaña 🎓 Entrenar
// Consume la API de aprendizaje.js (fase 2)
// ============================================================

(function() {
  'use strict';

  let paresPendientes = [];  // [{fotoFile, excelFile, nombre}]
  let procesando = false;

  // ----------------------------------------------------------
  // RENDER PRINCIPAL
  // ----------------------------------------------------------
  function renderEntrenar() {
    const cont = document.getElementById('entrenarContenido');
    if (!cont) return;

    let resumen = null;
    try {
      resumen = (typeof aprendizajeResumen === 'function') ? aprendizajeResumen() : null;
    } catch (e) {
      resumen = null;
    }
    const r = resumen || {
      paresAnalizados: 0,
      precisionGlobal: '0.0%',
      sustituciones: 0,
      sustitucionesConf: 0,
      umbralConfianza: 2,
      diccionarios: 0,
      patrones: 0
    };

    cont.innerHTML = `
      <div style="background:#1e293b;border-radius:10px;padding:14px;margin-bottom:12px;">
        <h3 style="font-size:0.95rem;color:#38bdf8;margin:0 0 10px 0;">🎓 Entrenamiento del OCR</h3>
        <p style="font-size:0.75rem;color:#94a3b8;margin:0 0 12px 0;line-height:1.4;">
          Sube pares <b>foto + Excel</b> correctos. La app compara el OCR con el Excel
          y aprende sustituciones (2→Z), diccionarios por columna y patrones.
          En los próximos OCR las reglas se aplican automáticamente.
        </p>

        <div style="background:#0f172a;border-radius:8px;padding:10px;margin-bottom:12px;">
          <div style="font-size:0.72rem;color:#94a3b8;margin-bottom:6px;">
            Precisión global: <b style="color:#38bdf8;">${r.precisionGlobal}</b>
            · Umbral confianza: <b style="color:#38bdf8;">${r.umbralConfianza}</b>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.72rem;color:#cbd5e1;">
            <div>📚 Sustituciones: <b style="color:#22c55e;">${r.sustituciones}</b></div>
            <div>✅ Confiables: <b style="color:#22c55e;">${r.sustitucionesConf}</b></div>
            <div>📖 Diccionarios: <b style="color:#22c55e;">${r.diccionarios}</b></div>
            <div>🔤 Patrones: <b style="color:#22c55e;">${r.patrones}</b></div>
            <div style="grid-column:1 / -1;">📊 Pares analizados: <b style="color:#22c55e;">${r.paresAnalizados}</b></div>
          </div>
        </div>

        <div style="background:#0f172a;border-radius:8px;padding:10px;margin-bottom:12px;">
          <div style="font-size:0.78rem;color:#38bdf8;font-weight:600;margin-bottom:8px;">
            ➕ Añadir par (foto + Excel)
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <label style="font-size:0.72rem;color:#cbd5e1;">
              📷 Foto:
              <input type="file" id="entrenarFoto" accept="image/*"
                style="display:block;margin-top:4px;width:100%;font-size:0.7rem;color:#cbd5e1;">
            </label>
            <label style="font-size:0.72rem;color:#cbd5e1;">
              📈 Excel (.xlsx):
              <input type="file" id="entrenarExcel" accept=".xlsx,.xls"
                style="display:block;margin-top:4px;width:100%;font-size:0.7rem;color:#cbd5e1;">
            </label>
            <button id="entrenarAddPar"
              style="background:#8B5CF6;color:white;border:none;border-radius:8px;padding:10px;font-size:0.78rem;font-weight:600;cursor:pointer;">
              ➕ Añadir par a la cola
            </button>
          </div>
        </div>

        <div id="entrenarCola" style="margin-bottom:12px;"></div>

        <button id="entrenarProcesar"
          style="background:#22c55e;color:white;border:none;border-radius:8px;padding:12px;width:100%;font-size:0.85rem;font-weight:700;cursor:pointer;margin-bottom:8px;">
          🚀 Procesar todo y aprender
        </button>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">
          <button id="entrenarReset"
            style="background:#ef4444;color:white;border:none;border-radius:8px;padding:8px;font-size:0.7rem;font-weight:600;cursor:pointer;">
            🗑️ Reset
          </button>
          <button id="entrenarExportar"
            style="background:#3b82f6;color:white;border:none;border-radius:8px;padding:8px;font-size:0.7rem;font-weight:600;cursor:pointer;">
            📤 Exportar
          </button>
          <button id="entrenarImportar"
            style="background:#f59e0b;color:white;border:none;border-radius:8px;padding:8px;font-size:0.7rem;font-weight:600;cursor:pointer;">
            📥 Importar
          </button>
        </div>

        <div id="entrenarLog" style="margin-top:12px;font-size:0.7rem;color:#94a3b8;font-family:monospace;max-height:200px;overflow-y:auto;background:#0f172a;border-radius:8px;padding:8px;"></div>
      </div>
    `;

    engancharEventos();
    renderCola();
  }

  // ----------------------------------------------------------
  // COLA DE PARES
  // ----------------------------------------------------------
  function renderCola() {
    const cola = document.getElementById('entrenarCola');
    if (!cola) return;

    if (paresPendientes.length === 0) {
      cola.innerHTML = '<div style="font-size:0.7rem;color:#64748b;text-align:center;padding:6px;">(Cola vacía)</div>';
      return;
    }

    cola.innerHTML = paresPendientes.map((p, i) => `
      <div style="display:flex;justify-content:space-between;align-items:center;background:#0f172a;border-radius:6px;padding:6px 8px;margin-bottom:4px;font-size:0.7rem;color:#cbd5e1;">
        <span>${i + 1}. ${p.nombre}</span>
        <button data-idx="${i}" class="entrenarQuitar"
          style="background:#ef4444;color:white;border:none;border-radius:4px;padding:2px 8px;font-size:0.65rem;cursor:pointer;">✖</button>
      </div>
    `).join('');

    cola.querySelectorAll('.entrenarQuitar').forEach(b => {
      b.addEventListener('click', () => {
        paresPendientes.splice(parseInt(b.dataset.idx), 1);
        renderCola();
      });
    });
  }

  // ----------------------------------------------------------
  // LOG
  // ----------------------------------------------------------
  function logEntrenar(msg) {
    const el = document.getElementById('entrenarLog');
    if (!el) return;
    const hora = new Date().toLocaleTimeString();
    el.innerHTML += `<div>[${hora}] ${msg}</div>`;
    el.scrollTop = el.scrollHeight;
  }

  // ----------------------------------------------------------
  // EVENTOS
  // ----------------------------------------------------------
  function engancharEventos() {
    const btnAdd = document.getElementById('entrenarAddPar');
    const btnProc = document.getElementById('entrenarProcesar');
    const btnReset = document.getElementById('entrenarReset');
    const btnExp = document.getElementById('entrenarExportar');
    const btnImp = document.getElementById('entrenarImportar');

    if (btnAdd) btnAdd.addEventListener('click', () => {
      const foto = document.getElementById('entrenarFoto').files[0];
      const excel = document.getElementById('entrenarExcel').files[0];
      if (!foto || !excel) { logEntrenar('⚠️ Selecciona foto y Excel'); return; }
      paresPendientes.push({
        fotoFile: foto,
        excelFile: excel,
        nombre: `${foto.name} + ${excel.name}`
      });
      document.getElementById('entrenarFoto').value = '';
      document.getElementById('entrenarExcel').value = '';
      renderCola();
      logEntrenar(`➕ Añadido par (${paresPendientes.length} en cola)`);
    });

    if (btnProc) btnProc.addEventListener('click', procesarTodo);

    if (btnReset) btnReset.addEventListener('click', () => {
      if (!confirm('¿Borrar TODO el aprendizaje?')) return;
      try { aprendizajeReset(); aprendizajeGuardar(); } catch (e) {}
      logEntrenar('🗑️ Aprendizaje reseteado');
      renderEntrenar();
    });

    if (btnExp) btnExp.addEventListener('click', () => {
      const json = aprendizajeExportar();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aprendizaje_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      logEntrenar('📤 Exportado JSON');
    });

    if (btnImp) btnImp.addEventListener('click', () => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = '.json';
      inp.onchange = async () => {
        const f = inp.files[0];
        if (!f) return;
        const txt = await f.text();
        try {
          const ok = aprendizajeImportar(txt);
          if (ok) { aprendizajeGuardar(); logEntrenar('📥 Importado'); renderEntrenar(); }
          else logEntrenar('❌ JSON inválido');
        } catch (e) {
          logEntrenar('❌ Error importando: ' + e.message);
        }
      };
      inp.click();
    });
  }

  // ----------------------------------------------------------
  // PIPELINE: procesar cada par (foto → OCR → comparar vs Excel)
  // ----------------------------------------------------------
  async function procesarTodo() {
    if (procesando) { logEntrenar('⏳ Ya hay un proceso en marcha'); return; }
    if (paresPendientes.length === 0) {
      logEntrenar('⚠️ No hay pares en la cola');
      return;
    }

    procesando = true;
    logEntrenar(`🚀 Procesando ${paresPendientes.length} par(es)...`);

    for (let i = 0; i < paresPendientes.length; i++) {
      const par = paresPendientes[i];
      logEntrenar(`--- Par ${i + 1}/${paresPendientes.length}: ${par.nombre} ---`);
      try {
        // 1) Leer Excel → matriz
        let matrizExcel = await leerExcelDesdeArchivo(par.excelFile);
        if (!matrizExcel) { logEntrenar('❌ No se pudo leer Excel'); continue; }
        if (typeof matrizExcelALimpia === 'function') {
          matrizExcel = matrizExcelALimpia(matrizExcel);
        }
        logEntrenar(`📈 Excel: ${matrizExcel.length} filas`);

        // 2) Correr OCR sobre la foto (función que se implementa en mensaje 4)
        if (typeof procesarFotoParaEntrenar !== 'function') {
          logEntrenar('⚠️ procesarFotoParaEntrenar() no existe todavía (mensaje 4)');
          continue;
        }
        const matrizOCR = await procesarFotoParaEntrenar(par.fotoFile);
        if (!matrizOCR) { logEntrenar('❌ OCR falló'); continue; }
        logEntrenar(`📷 OCR: ${matrizOCR.length} filas`);

        // 3) Analizar par
        aprendizajeAnalizarPar(matrizOCR, matrizExcel, par.nombre);
        logEntrenar('✅ Par analizado');

      } catch (e) {
        logEntrenar(`❌ Error: ${e.message}`);
      }
    }

    // 4) Guardar y refrescar
    try { aprendizajeGuardar(); } catch (e) {}
    logEntrenar('💾 Aprendizaje guardado');
    paresPendientes = [];
    renderCola();
    renderEntrenar();
    logEntrenar('🎉 Terminado');
    procesando = false;
  }

  // ----------------------------------------------------------
  // HOOK GLOBAL: para que app.js pueda abrir la pestaña Entrenar
  // ----------------------------------------------------------
  window.renderEntrenar = renderEntrenar;

  // Pintar al cargar (por si la pestaña Entrenar ya está en el DOM)
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('entrenarContenido')) {
      renderEntrenar();
    }
  });

})();
