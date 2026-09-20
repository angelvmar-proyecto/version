# MAR Caribe - Notas de mejoras futuras

Este archivo documenta ideas, investigaciones y técnicas que podrían
implementarse en el futuro. NO son urgentes, pero son valiosas.

---

## 🧠 Modelo de Retina Bioinspirado como Prefiltro OCR

**Fecha de investigación:** 20 de septiembre de 2026
**Estado:** Idea validada científicamente, pendiente de implementación
**Prioridad:** Media-baja (explorar después de que lo esencial funcione)

### ¿Qué es?

Un modelo computacional que imita el comportamiento de la retina de los
mamíferos. Específicamente reproduce dos funciones:

1. **Adaptación natural al contraste:** La retina ajusta su respuesta
   según la iluminación local, mejorando la visibilidad de detalles en
   zonas oscuras o claras.

2. **Realce de contornos:** Las células parvocelulares de la retina
   acentúan los bordes de los objetos, facilitando la segmentación de
   caracteres.

### ¿Cómo se aplica al OCR?

Se usa como **paso de preprocesamiento (prefiltering)** antes de pasar
la imagen al motor de OCR. La idea es que la imagen llegue al OCR con:

- Mejor contraste local
- Bordes de texto más definidos
- Ruido de fondo reducido

### Evidencia científica

**Paper clave:**
> Kern, J.; Cubillos, F. "A Bio-Inspired Retinal Model as a Prefiltering
> Step Applied to Letter and Number Recognition on Chilean Vehicle
> License Plates". *Applied Sciences*, 2024, 14(12), 5011.
> https://www.mdpi.com/2076-3417/14/12/5011

**Resultado principal:**
El estudio demostró una **reducción en la tasa de error** en el
reconocimiento de caracteres cuando se aplica este modelo como paso de
preprocesamiento, comparado con no usarlo.

**Dominio de aplicación probado:**
Matrículas de vehículos chilenos (texto corto, alta variabilidad de
iluminación). Es un caso análogo al de tablas fotografiadas en condiciones
variables.

### Implementación de referencia

**OpenCV** incluye una implementación llamada `cv::bioinspired::Retina`:

- Documentación oficial: https://docs.opencv.org/4.x/d6/d2c/classcv_1_1bioinspired_1_1Retina.html
- Es una implementación en C++ (con bindings a Java y Python)
- Parámetros ajustables documentados:
  - `photoreceptorsLocalAdaptationSensitivity`
  - `horizontalCellsGain`
  - `ganglionCellsSensitivity`
  - `parvoGain`
  - `parvoSpatialConstant`
  - (entre otros)

**NO existe** una versión en JavaScript lista para usar.

### Estado actual en MAR Caribe

**NO implementado.** Las razones:

1. **Complejidad de portar el modelo a JS:** Requiere reescribir la
   arquitectura completa de capas de la retina. Sería un proyecto de
   semanas.

2. **Funciones ya cubiertas parcialmente:** El pipeline actual ya incluye
   `Contraste Adaptativo` y `Binarización Adaptativa`, que cumplen
   funciones análogas al modelo retinal.

3. **Beneficio marginal incierto:** La validación científica se hizo con
   matrículas, no con tablas de texto. El impacto real en este dominio
   específico no está medido.

4. **El cuello de botella actual NO es el OCR:** ML Kit está reconociendo
   bien. El problema principal es la **detección de líneas** (fusión de
   columnas), no la calidad del OCR.

### Plan de implementación futura

**Fase 1 - Emulación ligera (1-2 días de trabajo):**

En lugar de portar el modelo completo, implementar una **versión
simplificada** que capture la esencia del comportamiento retinal:

- Ajuste de contraste local por bloques (ya existe, refinar)
- Realce de bordes de texto mediante convolución con kernel específico
- Aplicar SOLO cuando la densidad de contraste sea baja
  (zonas oscuras o borrosas)
- Todo en JavaScript, sin dependencias externas

**Fase 2 - Modelo completo (2-4 semanas, solo si la Fase 1 da resultados):**

- Portar el modelo de OpenCV a JavaScript
- O buscar wrapper de WebAssembly de OpenCV
- Añadir como paso opcional en el pipeline de OCR
- Comparar resultados con/sin el modelo

**Fase 3 - Validación (1 semana):**

- Probar con las tablas que ya tenemos
- Medir mejora real (si la hay)
- Documentar parámetros óptimos por tipo de tabla

### Cómo activarlo (cuando se implemente)

Diseño propuesto:

- **Config:** nueva opción `OCR_RETINA_ACTIVO: false` en `config.js`
- **UI:** toggle opcional en la sección OCR
- **Default:** desactivado (no debe interferir con el pipeline actual)
- **Log:** indicar si se aplicó o no, y qué efecto tuvo

### Referencias adicionales

- **Retina bioinspirada en OpenCV:**
  https://docs.opencv.org/4.x/d6/d2c/classcv_1_1bioinspired_1_1Retina.html

- **Estudios relacionados:**
  - Modelos de retina para visión artificial (desde 2000s)
  - Aplicaciones en preprocesamiento de OCR (2010s-actualidad)
  - Uso combinado con CNN, SNN y OCR tradicional

### Decisión pendiente

Antes de implementar, hacer un **experimento controlado**:

1. Tomar 3-5 tablas difíciles (texto borroso, poco contraste)
2. Procesarlas con el pipeline actual
3. Procesarlas con pipeline + versión simplificada de retina
4. Comparar tasa de aciertos del OCR
5. Decidir si vale la pena la implementación completa

**Solo si la mejora es > 5% vale la pena el esfuerzo.**

---

## 📋 Otras ideas pendientes (para no olvidar)

### Encabezado de tabla

- Detectar la primera fila como encabezado
- Heurísticas: altura, color, texto corto, mayúsculas
- Marcar con `th` en vez de `td`
- Aplicar whitelist diferente (sin números largos)

### Pasos individuales funcionales

- Cada botón (Óptica, A3, Ecografía, LIDAR) ejecuta SOLO su algoritmo
- Muestra solo sus líneas
- Permite ver qué detecta cada uno
- Diagnóstico visual por algoritmo

### Ajuste de parámetros en vivo

- Panel con sliders por algoritmo
- Botón "Guardar" persistente
- Botón "Reset" a defaults
- Aplicar cambios sin recompilar

### Modo auto por tipo de tabla

- Detectar características al cargar
- Elegir parámetros automáticamente
- Guardar ajustes que funcionan
- Perfiles por tipo (calendario, lista, texto denso, etc.)

### Interpolación de líneas faltantes

- Si una columna tiene línea en fila 1 pero no en fila 5, proyectar
- Recuperar columnas en tablas uniformes
- Opcional, activable por si falla

### OCR sobre tabla completa (sin recortar)

- Alternativa al recorte por celdas
- Pasar la tabla completa a ML Kit
- Asignar texto a celdas por coordenadas
- Útil cuando la detección de líneas falla

---

## 📅 Historial de cambios

- **2026-09-20:** Creación del archivo con documentación del modelo retinal
  bioinspirado y otras ideas pendientes.

