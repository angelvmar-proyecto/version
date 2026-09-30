# MAR Caribe v14 - Pendientes

## Fase 4 - LIDAR (votacion)
- [ ] Integrar los 6 algoritmos en votacion
- [ ] Pesos por algoritmo segun fiabilidad (por definir con pruebas)
- [ ] Filtro de duplicados (lineas a <15px se fusionan)
- [ ] Relleno de huecos con IO (buscar candidatos en zonas >60px sin linea)

## Fase 5 - Grid Validator (validacion estructural)
- [ ] Algoritmo que valida si las lineas forman una rejilla coherente
- [ ] Descartar lineas con baja longitud (subrayados, ruido)
- [ ] Descartar lineas con baja continuidad (texto, puntos)
- [ ] Validar conexiones: una V real cruza varias H reales
- [ ] Rechazar lineas que caen en medio de zonas de texto
- [ ] Este paso reemplaza/complementa el filtro de huecos simple

## Fase 6 - OCR (optimizacion con Connected Components)
- [ ] Aplicar Connected Components (CC) antes del OCR en cada celda:
      - Eliminar fragmentos de lineas de tabla en los bordes del recorte
      - Detectar celdas vacias sin llamar al OCR (ahorra ~70% tiempo)
      - Reconstruir caracteres rotos por compresion WhatsApp
      - Rectificar orientacion del texto (angulo de linea base)
- [ ] Medir mejora: precision antes vs despues


## Fase C - Post-procesamiento por espaciamiento regular
**Inspirado en CRF (Conditional Random Fields), pero simplificado.**

### Concepto
Después de LIDAR, validar que las líneas detectadas forman un patrón de espaciamiento coherente.

### Reglas propuestas
1. Calcular las distancias entre líneas consecutivas.
2. Obtener la MEDIANA de esas distancias (ej: 30px en una tabla regular).
3. Reglas de limpieza:
   - Si dos líneas están a < 0.5 × mediana → eliminar la de menor voto.
   - Si un hueco es > 1.5 × mediana → buscar línea candidata en el centro.
   - Si un hueco es > 2.5 × mediana → buscar 2 líneas candidatas.
4. Validar que después del filtro el patrón sea más regular.

### Por qué funciona
- Tablas reales tienen espaciamiento regular (aunque variable entre filas, es consistente).
- CRF explota esto con probabilidades; nosotros con reglas explícitas.
- Es equivalente al 90% del resultado de CRF sin necesitar entrenamiento.

### Diferencia con CRF real
- CRF: modelo probabilístico que aprende los pesos de un dataset etiquetado.
- Regular Spacing: reglas explícitas basadas en la mediana.
- CRF necesita ~500+ imágenes etiquetadas para entrenar. Nosotros con 4 vamos bien.
- Viterbi + CRF son ~500 líneas más. Regular Spacing son ~50 líneas.

### Cuándo aplicarlo
Solo después de que LIDAR y las fórmulas escaladas estén afinadas.
Si LIDAR ya da el 95% de aciertos, el post-procesamiento se vuelve opcional.

## Fase 7 - Panel Multi-imagen
- [ ] Cargar 3+ imagenes a la vez
- [ ] Correr analisis en todas en paralelo
- [ ] Comparar resultados lado a lado (misma cantidad de lineas detectadas)
- [ ] Exportar CSV comparativo
- [ ] Validar que parametros funcionan para todas (universalidad)

## Fase 8 - Ajuste universal de parametros
- [ ] Con el panel multi-imagen, encontrar valores que funcionen
      para multiples tablas sin reajustar
- [ ] Documentar la formula de escalado correcta por tamano de imagen

## Ideas adicionales consideradas
- [ ] Algoritmos de microscopia (Frangi multiescala) - descartado por ahora
      porque el texto multilinea da falsos positivos
- [ ] Connected Components como 7mo algoritmo de deteccion
      (se solapa con Continuidad, evaluar si aporta)
- [ ] Vision por computadora con IA (YOLO, Detectron) - descartado
      por peso de dependencias en APK

## Notas
- La app usa Capacitor + Android SDK
- Build via GitHub Actions (workflow build-apk.yml)
- Almacenamiento via Filesystem plugin de Capacitor
- OCR via ML Kit (capawesome plugin)

## Fecha
28 de septiembre de 2026
