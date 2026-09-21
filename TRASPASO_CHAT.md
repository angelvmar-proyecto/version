# TRASPASO DE CHAT — MAR Caribe v13

## Fecha del cierre
21 de septiembre de 2026

## Proyecto
MAR Caribe — App Capacitor que lee tablas desde fotos de WhatsApp
y las convierte en tabla HTML editable + exportable.

Repo: https://github.com/angelvmar-proyecto/version
Ruta local: ~/version
Build: GitHub Actions (workflow build-apk.yml)

## STACK
- Capacitor 8 + Android SDK
- ML Kit nativo (TextRecognition plugin de capawesome)
- Filesystem plugin para guardar celdas como PNG temporales
- SheetJS (xlsx.full.min.js) en www/lib/ para leer Excel
- localStorage + Filesystem.Documents para persistencia

## ARCHIVOS CLAVE
www/index.html
www/js/config.js            ← parámetros centralizados
www/js/utilidades.js
www/js/preprocesamiento.js
www/js/deteccion.js         ← Óptica + A3 + Ecografía
www/js/lidar.js             ← votación + auto-bordes
www/js/dibujo.js
www/js/retina.js            ← aplicarRetina (por celda) + aplicarRetinaGlobal
www/js/excel-lector.js      ← lee .xlsx con SheetJS
www/js/aprendizaje.js       ← módulo de aprendizaje (fase 2 completa)
www/js/ocr.js               ← ML Kit + Filesystem + pipeline
www/js/panel-ajustes.js
www/js/exportar.js          ← exportación análisis + handlers CSV/Excel (pendiente verificar)
www/js/app.js               ← orquestador + UI

## PARÁMETROS CALIBRADOS ACTUALES (config.js)
OPTICA_UMBRAL_ADAPTATIVO: 0.30
OPTICA_DISTANCIA_MIN_H:   15
OPTICA_DISTANCIA_MIN_V:   12
A3_UMBRAL_MAGNITUD:       130
A3_UMBRAL_ORTOGONALIDAD:  0.75
A3_COBERTURA_MINIMA:      0.20
LIDAR_ECO_ALTO:           60
LIDAR_AGRUPAR_DIST:       4  (fix adaptativo: max(4, ancho/300))
LIDAR_MARGEN_BORDE:       8
OCR_MARGEN_CELDA:         3
OCR_BINARIZAR:            false
OCR_FILA0_ENCABEZADO:     false
RETINA_ACTIVO:            true
RETINA_GLOBAL_ACTIVO:     true
APRENDIZAJE_ACTIVO:       false (se activa al final de fase 2)

## LO QUE YA ESTÁ CERRADO
1. ✅ Retinal global funcional (aplicarRetinaGlobal existe en retina.js)
2. ✅ Verticales detectadas correctamente (Óptica 37→50 con ajustes)
3. ✅ Auto-bordes agresivos (columna izquierda aparece)
4. ✅ OCR v2 (margen celda, contraste percentil, binarizado off)
5. ✅ Consistencia cruzada (mayoría corrige minorías)
6. ✅ Excel-lector + aprendizaje.js base
7. ✅ Capacitor 8 + ML Kit + Filesystem

## LO QUE QUEDA PENDIENTE

### A) Modos de OCR — ANÁLISIS COMPLETO, REFINAMIENTO PENDIENTE
Se probaron los 3 modos sobre la misma imagen (55×21, 1155 celdas):
- ⚡ RÁPIDO:  276s, 19 correcciones, mejor calidad observada
- 📊 MEDIO:   442s, 15 correcciones, corta columnas
- 🎯 PRECISO: 305s, 10 correcciones, corta columnas severo

DECISIÓN ACTUAL: RÁPIDO es el mejor pero los otros 2 NO se descartan.
El usuario quiere REFINARLOS MÁS ADELANTE (no cerrar el tema).
Hipótesis de por qué fallan:
- Cortes de columnas por escalarInteligente o bsLocalCelda
- Corrupción de caracteres por binarizado + retinal forzado
- El retinal por celda puede estar metiendo artefactos (:, $, L fantasma)

### B) Fase 2 del aprendizaje con Excel — EN CURSO
Estado actual de los 5 mensajes planeados:

✅ Mensaje 1: www/js/aprendizaje.js reescrito COMPLETO
   - Persistencia dual (localStorage + Documents/aprendizaje.json)
   - Aplicación automática con umbral ≥2 apariciones
   - API completa para la UI

✅ Mensaje 2: www/index.html actualizado
   - Pestaña 🎓 Entrenar añadida
   - <div id="tab-entrenar"> y <div id="entrenarContenido"> añadidos
   - NO se añadió el <script src="js/aprendizaje-ui.js"> todavía (opción C)

⏳ Mensaje 3 (SIGUIENTE): www/js/aprendizaje-ui.js COMPLETO + sed para añadir el <script> en index.html

⏳ Mensaje 4: www/js/ocr.js — enganchar aprendizajeAplicar() en el pipeline antes de mostrarTabla

⏳ Mensaje 5: commit + push + test con 1 par

### C) Detección de encabezado — NO IMPLEMENTADO
Pendiente: detectar fila 0 como <thead> con heurísticas (altura, centrado, mayúsculas).

### D) Verificar exportación CSV/Excel
app.js no tiene handlers para btnCSV, btnExcel, btnCopiar.
exportar.js tiene un handler solo para btnExportar (exporta HTML con imagen+log).
Falta ver si los otros botones tienen handler.

## DECISIONES TOMADAS PARA EL APRENDIZAJE
1. Persistencia: AMBOS (localStorage + Documents/aprendizaje.json)
2. Aplicación: AUTOMÁTICO siempre (sin toggle en UI)
3. Umbral de confianza para aplicar sustitución: ≥2 apariciones
4. Pares del usuario: 1 hoy, 5-10 mañana en el trabajo

## FLUJO DE APRENDIZAJE
1. Usuario abre pestaña 🎓 Entrenar
2. Carga 1 foto + 1 Excel por par
3. Pulsa "🚀 Procesar todo y aprender"
4. El sistema corre OCR sobre cada foto + compara vs Excel
5. Detecta sustituciones (2→Z, 0→O, etc.), diccionarios por columna, patrones
6. Guarda el aprendizaje en localStorage + Documents/aprendizaje.json
7. En próximos OCR, las reglas se aplican automáticamente
8. Log muestra: "🎓 Aprendizaje: N celdas corregidas"

## PRÓXIMOS PASOS AL ABRIR CHAT NUEVO
1. Decir "estoy listo para el mensaje 3"
2. Verificar con git status que index.html tiene los cambios del mensaje 2
3. Ejecutar el cat > de aprendizaje-ui.js
4. Ejecutar el sed para añadir <script src="js/aprendizaje-ui.js"> en index.html
5. Verificar con grep que todo está en su lugar
6. Seguir con el mensaje 4 (integración en ocr.js)

## COMANDOS DE VERIFICACIÓN RÁPIDA
# Confirmar que estamos donde pensamos
cd ~/version && git status && grep -c '<script src=' www/index.html

# Confirmar que fase 2 está a medias correctamente
grep -n 'data-tab="entrenar"' www/index.html           # debe aparecer
grep -n 'entrenarContenido' www/index.html             # debe aparecer
ls -lh www/js/aprendizaje-ui.js                        # NO debe existir aún

# Confirmar que aprendizaje.js tiene lo de fase 2
grep -c 'aprendizajeAplicar\|APRENDIZAJE_UMBRAL_CONFIANZA' www/js/aprendizaje.js   # debe ser > 0
