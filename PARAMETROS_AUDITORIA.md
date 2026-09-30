# Auditoría de Parámetros - MAR Caribe v14

Fecha: 2026-09-30

---

## 1. ALGORITMOS ACTIVOS (7)

### 🟡 Óptica (`optica.js`)
**Qué hace:** Detecta líneas como VALLES en el perfil de brillo (líneas oscuras sobre fondo claro).
**Cómo funciona:**
1. Calcula perfil H (promedio de brillo por fila) y perfil V (por columna).
2. Suaviza con media móvil para eliminar ruido.
3. Busca valles (mínimos locales) con umbral adaptativo.
4. Aplica distancia mínima para evitar duplicados.

**Por qué está:** Es el algoritmo base. En tablas de Excel con bordes grises visibles, detecta la mayoría de líneas.

### 🔴🔵 Eco (`eco.js`)
**Qué hace:** Detecta líneas como PICOS en el cambio de brillo.
**Cómo funciona:**
1. Por cada fila/columna, mide el cambio máximo de brillo en una ventana V.
2. Los picos indican "aquí cambia bruscamente el brillo" → línea.
3. Busca el pico real (no el primer cruce).

**Por qué está:** Complementa a Óptica. Óptica ve el valle absoluto, Eco ve el cambio relativo. Juntos cubren líneas débiles que uno solo no ve.

### 🟣 A3 (`a3.js`)
**Qué hace:** Detecta líneas por SOBEL ORTOGONAL.
**Cómo funciona:**
1. Calcula el gradiente Sobel (Gx, Gy) de cada píxel.
2. Calcula la ortogonalidad: `|Gx|/(|Gx|+|Gy|)` para V, `|Gy|/(|Gx|+|Gy|)` para H.
3. Suma contribuciones solo donde la ortogonalidad > umbral.

**Por qué está:** Detecta líneas finas que no son valles claros. Útil en tablas densas. Pero también detecta bordes de texto → por eso tiene peso 0 en LIDAR.

### 💗 LVC (`lvc.js`)
**Qué hace:** Detecta columnas donde el brillo es consistente verticalmente.
**Cómo funciona:**
1. Por cada columna, cuenta cuántos píxeles tienen contraste con vecinos a ±V.
2. Si el ratio es alto → columna coherente → línea vertical.

**Por qué está:** Detecta líneas verticales débiles que otros no ven. Solo afecta a V (no tiene H por diseño).

### ✚ IO (`io.js`)
**Qué hace:** Detecta INTERSECCIONES ORTOGONALES.
**Cómo funciona:**
1. Toma las líneas H y V de Óptica.
2. Por cada par (V, H), verifica si hay un patrón "+" en la intersección.
3. Cuenta cruces por línea; solo acepta líneas con ≥N cruces.

**Por qué está:** Es el único que valida "línea existe porque cruza otras líneas". Resuelve casos donde una línea sola parece ruido pero su intersección es real.

### 💠 Continuidad (`continuidad.js`)
**Qué hace:** Detecta líneas por PÍXELES OSCUROS CONSECUTIVOS.
**Cómo funciona:**
1. Recorre cada fila/columna.
2. Cuenta el run más largo de píxeles con brillo < umbral (permitiendo gaps).
3. Acepta si ratio total y run máximo superan umbrales.

**Por qué está:** Es muy robusto. El texto tiene gaps grandes entre palabras → no pasa. Una línea real es continua. Resistente a la compresión WhatsApp.

### 🎨 Realce (`realce.js`)
**Qué hace:** Umbral adaptativo POR FILA/COLUMNA.
**Cómo funciona:**
1. Calcula min y max de brillo de cada fila/columna.
2. Si contraste (max-min) < mínimo → salta.
3. Si no, umbral local = min + (max-min) × factor.
4. Aplica ese umbral local para detectar la línea.

**Por qué está:** Captura líneas difusas con intensidad variable. Un umbral fijo falla si la línea está más clara en una zona.

### ⚫ LIDAR (`lidar.js`)
**Qué hace:** VOTA entre todos los algoritmos para decidir la línea final.
**Cómo funciona:**
1. Recoge TODAS las candidatas H y V de los 7 algoritmos.
2. Agrupa las que están a <distanciaAgrup (12px).
3. Suma los pesos de los algoritmos que la detectaron.
4. Acepta si la suma ≥ minVotos (2).
5. Rellena huecos con candidatos votados por 2+ algoritmos.

---

## 2. ALGORITMOS DESCARTADOS (4)

### 🔷 OPENV - Opening Vertical Morfológico (descartado)
**Qué hacía:** Aplicaba opening (erosión + dilatación) con kernel vertical para detectar líneas verticales largas.
**Por qué se quitó:** Todas sus líneas ya las detectaba Óptica o LVC. Cero aporte único. En el análisis daba 12V pero todas coincidían.

### 🟢 ML - Mínimo Local (descartado)
**Qué hacía:** Detectaba mínimos locales en el perfil de brillo (líneas delgadas/oscilantes).
**Por qué se quitó:** Igual que OPENV. Sus 14V coincidían con las de Óptica. Redundante.

### 🟠 WS - Whitespace (descartado - PENDIENTE REINTEGRAR)
**Qué hacía:** Detecta espacios blancos entre columnas. **En tablas SIN bordes dibujados, es el único que funciona.**
**Por qué se quitó:** En tablas con bordes visibles, era redundante. El usuario lo vio naranja pocas veces.
**PENDIENTE:** Reintegrarlo para el caso de tablas SIN bordes. Es prioritario porque el usuario indicó que esas tablas son frecuentes.

### 🩸 Frangi (descartado)
**Qué hacía:** Filtro Vesselness (diseñado para vasos sanguíneos en microscopía). Usa matriz Hessiana multiescala.
**Por qué se quitó:**
- **Lentísimo:** 2 segundos por imagen (vs 100-200ms de los demás).
- **Confunde texto con líneas:** El doble renglón tiene firma Hessiana similar a línea.
- **Detectaba 80H falsas** en una tabla de 67 filas reales.
- Sin multiescala real, solo funciona con σ=2.5. No compensa la complejidad.

---

## 3. AUDITORÍA DE PARÁMETROS

### Clasificación:
- 🟥 **NÚMERO MÁGICO:** Valor fijo en px. No escala con el tamaño de imagen. Debe convertirse a fórmula.
- 🟨 **UMBRAL ABSOLUTO:** Valor 0-255 fijo. Puede no funcionar en imágenes oscuras/claras.
- 🟩 **RATIO:** Valor 0-1. Escala bien por definición.
- 🟦 **CONTEO:** Entero pequeño (2, 3, 5). Generalmente OK.
- ⬜ **COLOR/CONFIG:** No requiere auditoría.

---

### 🟡 ÓPTICA

| Parámetro | Valor | Tipo | Qué hace | Veredicto |
|---|---|---|---|---|
| `OPTICA_UMBRAL_ADAPTATIVO` | 0.30 | 🟩 | Factor del umbral adaptativo. Umbral = mediana_top30 × (1+0.30). | ✅ Mantener |
| `OPTICA_DISTANCIA_MIN_H` | 13 | 🟥 | Distancia mínima entre dos H. | Convertir a `alto × 0.008` |
| `OPTICA_DISTANCIA_MIN_V` | 7 | 🟥 | Distancia mínima entre dos V. | Convertir a `ancho × 0.007` |
| `OPTICA_SUAVIZADO` | 20 | 🟥 | Radio del suavizado (media móvil). | Convertir a `alto × 0.0125` |

### 🔴🔵 ECO

| Parámetro | Valor | Tipo | Qué hace | Veredicto |
|---|---|---|---|---|
| `ECO_VENTANA` | 3 | 🟥 | Ventana de búsqueda del máximo contraste. | Convertir a `ancho × 0.003` |
| `ECO_UMBRAL_H` | 38 | 🟨 | Contraste mínimo para aceptar H. | Convertir a ratio de contraste global |
| `ECO_UMBRAL_V` | 30 | 🟨 | Contraste mínimo para aceptar V. | Convertir a ratio de contraste global |
| `ECO_CONTINUIDAD` | 0.35 | 🟩 | Ratio mínimo de píxeles con contraste. | ✅ Mantener |
| `ECO_DISTANCIA_MIN_H` | 18 | 🟥 | Distancia mínima entre H. | Convertir a `alto × 0.011` |
| `ECO_DISTANCIA_MIN_V` | 20 | 🟥 | Distancia mínima entre V. | Convertir a `ancho × 0.020` |

### 🟣 A3

| Parámetro | Valor | Tipo | Qué hace | Veredicto |
|---|---|---|---|---|
| `A3_UMBRAL_MAGNITUD` | 130 | 🟨 | Magnitud mínima del gradiente Sobel. | Convertir a percentil del histograma |
| `A3_UMBRAL_ORTOGONALIDAD` | 0.75 | 🟩 | Ratio mínimo de ortogonalidad. | ✅ Mantener |
| `A3_COBERTURA_MINIMA` | 0.35 | 🟩 | Cobertura mínima de la línea. | ✅ Mantener |
| `A3_DISTANCIA_MIN` | 10 | 🟥 | Distancia mínima entre líneas. | Convertir a `min(ancho,alto) × 0.008` |

### 💗 LVC

| Parámetro | Valor | Tipo | Qué hace | Veredicto |
|---|---|---|---|---|
| `LVC_VENTANA` | 2 | 🟥 | Radio de comparación de brillo. | Convertir a `ancho × 0.002` |
| `LVC_UMBRAL_DIF` | 6 | 🟨 | Diferencia mínima de brillo entre columnas. | Convertir a contraste global × 0.05 |
| `LVC_COHERENCIA_MIN` | 0.35 | 🟩 | Ratio mínimo de coherencia vertical. | ✅ Mantener |
| `LVC_DISTANCIA_MIN` | 10 | 🟥 | Distancia mínima entre V. | Convertir a `ancho × 0.010` |

### ✚ IO

| Parámetro | Valor | Tipo | Qué hace | Veredicto |
|---|---|---|---|---|
| `IO_VENTANA_CRUCE` | 4 | 🟥 | Radio alrededor del cruce a verificar. | Convertir a `min(ancho,alto) × 0.004` |
| `IO_UMBRAL_CRUCE` | 220 | 🟨 | Brillo máximo para píxel "oscuro" en cruce. | Convertir a percentil 80 del brillo |
| `IO_CRUCES_MIN` | 2 | 🟦 | Cruces mínimos para aceptar línea. | ✅ Mantener (concepto no escala) |
| `IO_DISTANCIA_MIN` | 10 | 🟥 | Distancia mínima entre líneas. | Convertir a `min(ancho,alto) × 0.008` |

### 💠 CONTINUIDAD

| Parámetro | Valor | Tipo | Qué hace | Veredicto |
|---|---|---|---|---|
| `CONT_UMBRAL_OSCURO_H` | 210 | 🟨 | Brillo máximo para píxel "oscuro" en H. | Convertir a percentil 85 |
| `CONT_RATIO_MIN_H` | 0.55 | 🟩 | Ratio mínimo de píxeles oscuros en H. | ✅ Mantener |
| `CONT_RUN_MIN_H` | 0.40 | 🟩 | Run continuo mínimo en H. | ✅ Mantener |
| `CONT_UMBRAL_OSCURO_V` | 225 | 🟨 | Brillo máximo para píxel "oscuro" en V. | Convertir a percentil 85 |
| `CONT_RATIO_MIN_V` | 0.35 | 🟩 | Ratio mínimo de píxeles oscuros en V. | ✅ Mantener |
| `CONT_RUN_MIN_V` | 0.25 | 🟩 | Run continuo mínimo en V. | ✅ Mantener |
| `CONT_GAP_MAX` | 35 | 🟥 | Gap máximo permitido entre píxeles consecutivos. | Convertir a `max(ancho,alto) × 0.035` |
| `CONT_DISTANCIA_MIN_H` | 15 | 🟥 | Distancia mínima entre H. | Convertir a `alto × 0.009` |
| `CONT_DISTANCIA_MIN_V` | 8 | 🟥 | Distancia mínima entre V. | Convertir a `ancho × 0.008` |

### 🎨 REALCE

| Parámetro | Valor | Tipo | Qué hace | Veredicto |
|---|---|---|---|---|
| `REALCE_CONTRASTE_MIN` | 35 | 🟨 | Contraste mínimo (max-min) para procesar fila/columna. | Convertir a ratio del rango global |
| `REALCE_UMBRAL_FACTOR` | 0.5 | 🟩 | Factor para umbral local = min + (max-min)×factor. | ✅ Mantener |
| `REALCE_MIN_RUN_H` | 0.50 | 🟩 | Run mínimo en H. | ✅ Mantener |
| `REALCE_MIN_RUN_V` | 0.45 | 🟩 | Run mínimo en V. | ✅ Mantener |
| `REALCE_GAP_MAX` | 30 | 🟥 | Gap máximo permitido. | Convertir a `max(ancho,alto) × 0.030` |
| `REALCE_DISTANCIA_MIN_H` | 12 | 🟥 | Distancia mínima H. | Convertir a `alto × 0.007` |
| `REALCE_DISTANCIA_MIN_V` | 10 | 🟥 | Distancia mínima V. | Convertir a `ancho × 0.010` |

### ⚫ LIDAR

| Parámetro | Valor | Tipo | Qué hace | Veredicto |
|---|---|---|---|---|
| `LIDAR_DIST_AGRUPAR_H` | 12 | 🟥 | Distancia de agrupación de votos H. | Convertir a `alto × 0.0075` |
| `LIDAR_DIST_AGRUPAR_V` | 12 | 🟥 | Distancia de agrupación de votos V. | Convertir a `ancho × 0.012` |
| `LIDAR_MIN_VOTOS` | 2 | 🟦 | Votos mínimos para aceptar línea. | ✅ Mantener (concepto no escala) |
| `LIDAR_PESOS` | obj | ⬜ | Peso por algoritmo. | ✅ Mantener (decisión de diseño) |
| `LIDAR_HUECO_MIN` | 60 | 🟥 | Tamaño mínimo de hueco a rellenar. | Convertir a `max(ancho,alto) × 0.06` |
| `LIDAR_HUECO_BORDE` | 15 | 🟥 | Distancia mínima al borde del hueco. | Convertir a `min(ancho,alto) × 0.015` |

---

## 4. RESUMEN DE CONVERSIONES

### 🟥 A convertir a fórmula: 23 parámetros
### 🟨 A convertir a ratio del histograma: 8 parámetros
### 🟩 Ya son ratios (mantener): 18 parámetros
### 🟦 Conteos (mantener): 3 parámetros
### ⬜ Config: 1 parámetro

---

## 5. FILOSOFÍA DE ESCALADO

**Para que un parámetro sea universal:**
1. Nunca usar valores fijos en píxeles.
2. Usar proporciones del tamaño de la imagen:
   - `ancho × factor` para H
   - `alto × factor` para V
   - `min(ancho,alto) × factor` para isotrópico
3. Los umbrales de brillo (0-255) deben usar el histograma de la imagen real.
4. Los conteos y ratios ya son universales por definición.

**Ejemplo:**
- ❌ `CONT_GAP_MAX: 35px` (número mágico)
- ✅ `CONT_GAP_MAX: max(ancho,alto) × 0.035` (fórmula)
  - En 990×1600 → 56px
  - En 612×846 → 30px
  - En 1600×1377 → 56px
  - En 1280×768 → 45px

**Cuando una imagen nueva llegue:**
- Fórmula calcula valores automáticamente.
- Sin ajustar nada. Eso es universal.

---

## 6. PENDIENTES ADICIONALES

- [ ] Reintegrar algoritmo WS para tablas sin bordes.
- [ ] Crear modo "Con bordes" vs "Sin bordes" según la imagen.
- [ ] Runner automático de barrido (100 combinaciones).
- [ ] Guardar resultados en JSON para análisis.
