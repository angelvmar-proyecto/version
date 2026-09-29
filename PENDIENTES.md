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
