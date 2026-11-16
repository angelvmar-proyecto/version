    // --- EXPERIMENTO DIRECTO + LOG DIAGNÓSTICO ---
    if (!window.__DIAG_LOG) window.__DIAG_LOG = [];
    const _origLog = console.log;
    const _origWarn = console.warn;
    console.log = function() {
      _origLog.apply(console, arguments);
      try {
        const msg = Array.prototype.slice.call(arguments).join(' ');
        if (msg.indexOf('[DIAG-') === 0 || msg.indexOf('[EXP]') === 0) window.__DIAG_LOG.push(msg);
      } catch (e) {}
    };
    console.warn = function() {
      _origWarn.apply(console, arguments);
      try {
        const msg = Array.prototype.slice.call(arguments).join(' ');
        if (msg.indexOf('[DIAG-') === 0 || msg.indexOf('[EXP]') === 0) window.__DIAG_LOG.push('WARN ' + msg);
      } catch (e) {}
    };

    el('chkExperimentoDirecto').onchange = function(e) {
      window.__EXPERIMENTO_DIRECTO = !!e.target.checked;
      console.log('[EXP] Modo directo forzado: ' + window.__EXPERIMENTO_DIRECTO);
    };

    el('btnVerLog').onclick = function() {
      const pre = el('logContenido');
      pre.textContent = (window.__DIAG_LOG && window.__DIAG_LOG.length)
        ? window.__DIAG_LOG.join('\n')
        : '(sin logs todavía. Ejecuta un OCR primero.)';
      el('modalLog').style.display = 'block';
    };
    el('btnCerrarLog').onclick = function() { el('modalLog').style.display = 'none'; };
    el('btnCopiarLog').onclick = function() {
      const txt = el('logContenido').textContent || '';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(function() { alert('Log copiado'); }, function() { alert('No se pudo copiar'); });
      } else {
        const ta = document.createElement('textarea');
        ta.value = txt; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); alert('Log copiado'); } catch (e) { alert('No se pudo copiar'); }
        document.body.removeChild(ta);
      }
    };
