# TRASPASO DE CHAT — MAR Caribe v13

## Fecha del cierre
27 de septiembre de 2026

## Proyecto
MAR Caribe — App Capacitor que lee tablas desde fotos de WhatsApp
y las convierte en tabla HTML editable + exportable.

Repo: https://github.com/angelvmar-proyecto/version
Ruta local: ~/version
Build: GitHub Actions (workflow build-apk.yml)

## STACK
- Capacitor 8 + Android SDK
- ML Kit nativo (TextRecognition plugin capawesome)
- Filesystem plugin para celdas PNG temporales
- SheetJS (xlsx.full.min.js) para leer Excel
- localStorage + Filesystem.Documents para persistencia

## ARCHIVOS CLAVE
www/index.html              ← tabs: Imagen, Tabla, Entrenar
www/js/config.js            ← parámetros + CONFIG_ESC (escalado)
www/js/utilidades.js        ← clusterLineas (para consolidar)
www/js/preprocesamiento.js
www/js/deteccion.js         ← 8 algoritmos de detección
www/js/lidar.js             ← votación
www/js/dibujo.js            ← capas visuales (8 colores)
www/js/retina.js
www/js/excel-lector.js
www/js/aprendizaje.js
www/js/aprendizaje-ui.js    ← pestaña Entrenar
www/js/ocr.js               ← ML Kit + pipeline
www/js/panel-ajustes.js
www/js/exportar.js          ← exportación CSV/Excel
www/js/app.js               ← orquestador + escalarConfig
www/js/capa-export.js       ← (botón Capas → 8 PNG + JSON)

## ALGORITMOS DE DETECCION (8 total)
1. Óptica (proyección)         🟡 amarillo #FFD700
2. Eco (cambio brillo)         🔴🔵 rojo/azul
3. A3 (Sobel ortogonalidad)    🟣 morado #8B5CF6
4. LVC (coherencia vertical)   💗 rosa #ec4899
5. OPENV (opening morfológico) 🔷 cian #22d3ee
6. ML (mínimo local)           🟢 verde lima #84cc16
7. WS (whitespace/espacios)    🟠 naranja #f97316
8. IO (intersección ortogonal) ✚ amarillo oscuro #eab308
LIDAR: votación de los 8     ⚫ negro grueso

## ESTADO ACTUAL DE PARÁMETROS (importante)
CONFIG_ESC escala por imagen. Los parámetros que SÍ escalan:
- OPTICA_DISTANCIA_MIN_V/H  (ancho × 0.0075, alto × 0.0109)
- ECO_DISTANCIA_MIN_V/H     (ancho × 0.0125, alto × 0.0131)
- ECO_VENTANA               (ancho × 0.003)
- A3_DISTANCIA_MIN          (dimMin × 0.006)
- LVC_DISTANCIA_MIN         (ancho × 0.006)
- LVC_VENTANA               (ancho × 0.00125)
- OPENV_DISTANCIA_MIN       (ancho × 0.006)
- OPENV_KERNEL_ALTO         (alto × 0.029)
- LIDAR_AGRUPAR_DIST        (ancho × 0.008)  ← CAMBIADO (era 0.0025)
- LIDAR_MARGEN_BORDE        (ancho × 0.005)
- ML_DISTANCIA_MIN          (ancho × 0.006)
- WS_DISTANCIA_MIN          (ancho × 0.006)
- WS_ANCHO_MIN              (ancho × 0.003)
- WS_ANCHO_MAX              (ancho × 0.035)
- RANGO_AJUSTE              (ancho × 0.00125)

Parámetros críticos actuales:
- ECO_UMBRAL_V: 30 (era 42)
- ECO_CONTINUIDAD: 0.35 (era 0.55)
- A3_UMBRAL_MAGNITUD: 130 (era 180)
- A3_COBERTURA_MINIMA: 0.35 (era 0.50)
- IO_UMBRAL_CRUCE: 200 (era 140)
- IO_CRUCES_MIN: 5 → PENdiente bajar a 3
- RETINA_GLOBAL_ACTIVO: false
- RETINA_ACTIVO: false
- CRR_ACTIVO: false
- BS_ACTIVO: false
- DET_BLUR_ACTIVO: false

## TEST QUE ESTÁ ACTIVO
- **Test-1**: cluster Optica antes de LIDAR (radio ancho × 0.04)
  → devuelve PROMEDIO del cluster (no 2 bordes)
- **Test-2**: A3 FUERA de votos V (disparaba 137 falsos en Sept 1)
- **OPTICA-B**: cluster Óptica cuenta DOBLE en votación
  → votarLineas(opticaV, ecoV, opticaV, distV, lvcV)
  (alg 1 + alg 3 = mismo cluster, consolida 2 votos)

## RESULTADOS CON ESTOS CAMBIOS (última prueba)
Sept 23 (990x1600):
- Óptica: 63V → cluster 20V
- LIDAR: 16V
- Celdas: 56 × 15 = 840
- ✚ IO: 4V, 17H (con umbral 200)
- Meta: ~22V

Sept 1 (1600x1377):
- Óptica: 53V → cluster 18V
- LIDAR: 25V
- Celdas: 53 × 24 = 1272
- ✚ IO: 0V (umbral 140 en ese momento)
- Meta: ~22V

## LO QUE FUNCIONA
- Detección de líneas con 8 algoritmos
- Escalado automático de parámetros por tamaño
- Capas visuales + export PNG por capa (botón 📦 Capas)
- OCR con ML Kit (modo Rápido ~270s/1155 celdas)
- Aprendizaje con Excel (fase 2)
- Consistencia cruzada entre celdas
- Exportar CSV/Excel/Copiar

## LO QUE QUEDA PENDIENTE
### A) IO detecta pocas verticales en Sept 23
- `✚ IO: 4V, 17H` con umbral 200 y crucesMin 5
- **Siguiente paso**: bajar `IO_CRUCES_MIN: 5 → 3`
- Si con eso sube a ~18-22V → integrar IO a votación LIDAR
- Si sigue bajo → subir `IO_VENTANA_CRUCE: 3 → 5` (tolerar desalineaciones)

### B) LIDAR Sept 23 da 16V (deberían ser 22)
- Cluster da 20V pero LIDAR solo acepta 16
- Las 4 que se pierden no coinciden con otros algoritmos (Sept 23 tiene líneas muy borrosas)
- **Siguiente paso**: integrar IO cuando dé ~18V. Con Óptica (doble) + IO → debería subir a ~20-22

### C) Modos de OCR (Rápido/Medio/Preciso) - REFINAMIENTO
- Rápido es el mejor pero Medio y Preciso cortan columnas
- Hipótesis: binarizado + retinal forzado meten artefactos
- Decidido: NO cerrar el tema, refinar más adelante

### D) Detección de encabezado (fila 0 → thead)
- Pendiente: heurísticas por altura, mayúsculas, centrado
- `OCR_FILA0_ENCABEZADO: false` actualmente

### E) Exportación CSV/Excel
- Handlers en exportar.js existen
- Falta verificar que funcionan en APK

### F) Calibrador manual (diseñado, no implementado)
Diseño aprobado por el usuario:
- Pestaña 🎯 Calibrar nueva
- Canvas con imagen ORIGINAL (sin filtros)
- Zoom, pan, pinch
- Botón 🔒 Bloquear (evitar mover por error)
- Botón ↔️ Modo Vertical / ↕️ Modo Horizontal
- Cada toque añade una línea
- Botón Borrar última / Limpiar
- Exportar JSON con posiciones reales
- Propósito: SOLO para calibrar parámetros (no para ajustar por imagen)

## DECISIONES IMPORTANTES
1. **No escalar más parámetros absolutos** — ya están todos los de píxeles
2. **No bajar votos mínimos de LIDAR globalmente** — mete fantasmas
3. **IO es la solución para Sept 23** — pero necesita umbral y crucesMin ajustados
4. **Los algoritmos son conceptualmente correctos**, el problema era la mezcla de calibrados + fijos
5. **Meta universal**: ~22V en cualquier imagen de tabla de 21 columnas

## PRÓXIMOS PASOS AL ABRIR CHAT NUEVO
1. Decir "estoy listo, continúa con el ajuste de IO"
2. Verificar con git status que todo está commiteado
3. Bajar `IO_CRUCES_MIN: 5 → 3`
4. Rebuild + prueba Sept 23 y Sept 1
5. Si IO ~18-22V → integrarlo a votación LIDAR
6. Iterar hasta Sept 23 y Sept 1 ambos ~22V
7. Luego: implementar calibrador (F)
8. Luego: pasar a horizontales

## COMANDOS DE VERIFICACIÓN RÁPIDA
cd ~/version && git status && git log --oneline -5
cd ~/version && grep -n 'IO_CRUCES_MIN\|IO_UMBRAL_CRUCE\|LIDAR_AGRUPAR_DIST' www/js/config.js www/js/app.js
cd ~/version && node -c www/js/config.js && node -c www/js/app.js && echo "OK"

## CONTEXTO DEL USUARIO
- Uso del 60% en pantalla para copiar tablas de Excel → WhatsApp (Ctrl+C / Ctrl+V)
- Múltiples imágenes del mismo Excel pero días diferentes
- Todas las imágenes vienen del mismo WhatsApp (misma compresión)
- Necesita robustez para cualquier tabla similar
- NO quiere ajustar por imagen (debe ser universal)
