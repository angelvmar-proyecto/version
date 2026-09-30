# Fórmulas de Escalado Universal - MAR Caribe v14

## Problema original
Los parámetros eran valores fijos en píxeles (ej: 13, 20, 35) calibrados para una imagen específica (990×1600).
Al aplicarlos a otras imágenes con tamaños muy diferentes, el resultado es incorrecto.

## Solución: fórmulas proporcionales
Todos los parámetros de distancia/tamaño se calculan como **proporciones** del ancho/alto de la imagen.
Los umbrales de brillo se calculan como **percentiles del histograma** de la imagen real.

## Referencia de calibración original: 990×1600

| Parámetro | Antes (mágico) | Fórmula | En 990×1600 | En 1280×768 |
|---|---|---|---|---|
| OPTICA_DISTANCIA_MIN_H | 13 | alto × 0.008 | 13 | 6 |
| OPTICA_DISTANCIA_MIN_V | 7 | ancho × 0.007 | 7 | 9 |
| OPTICA_SUAVIZADO | 20 | alto × 0.0125 | 20 | 10 |
| ECO_VENTANA | 3 | ancho × 0.003 | 3 | 4 |
| ECO_DISTANCIA_MIN_H | 18 | alto × 0.011 | 18 | 8 |
| ECO_DISTANCIA_MIN_V | 20 | ancho × 0.020 | 20 | 26 |
| A3_DISTANCIA_MIN | 10 | min(A,H) × 0.010 | 10 | 8 |
| LVC_VENTANA | 2 | ancho × 0.002 | 2 | 3 |
| LVC_DISTANCIA_MIN | 10 | ancho × 0.010 | 10 | 13 |
| IO_VENTANA_CRUCE | 4 | min(A,H) × 0.004 | 4 | 3 |
| IO_DISTANCIA_MIN | 10 | min(A,H) × 0.010 | 10 | 8 |
| CONT_GAP_MAX | 35 | max(A,H) × 0.022 | 35 | 28 |
| CONT_DISTANCIA_MIN_H | 15 | alto × 0.009 | 14 | 7 |
| CONT_DISTANCIA_MIN_V | 8 | ancho × 0.008 | 8 | 10 |
| REALCE_GAP_MAX | 30 | max(A,H) × 0.019 | 30 | 24 |
| REALCE_DISTANCIA_MIN_H | 12 | alto × 0.0075 | 12 | 6 |
| REALCE_DISTANCIA_MIN_V | 10 | ancho × 0.010 | 10 | 13 |
| LIDAR_DIST_AGRUPAR_H | 12 | alto × 0.0075 | 12 | 6 |
| LIDAR_DIST_AGRUPAR_V | 12 | ancho × 0.012 | 12 | 15 |
| LIDAR_HUECO_MIN | 60 | max(A,H) × 0.0375 | 60 | 48 |
| LIDAR_HUECO_BORDE | 15 | min(A,H) × 0.015 | 15 | 12 |

## Umbrales de brillo → percentiles del histograma

| Parámetro | Antes | Nuevo método |
|---|---|---|
| CONT_UMBRAL_OSCURO_H | 210 | percentil(0.85) |
| CONT_UMBRAL_OSCURO_V | 225 | percentil(0.85) |
| IO_UMBRAL_CRUCE | 220 | percentil(0.85) |
| ECO_UMBRAL_H | 38 | (p90-p10) × 0.22 |
| ECO_UMBRAL_V | 30 | (p90-p10) × 0.18 |
| REALCE_CONTRASTE_MIN | 35 | (p90-p10) × 0.20 |
| LVC_UMBRAL_DIF | 6 | (p90-p10) × 0.035 |
| A3_UMBRAL_MAGNITUD | 130 | (p90-p10) × 0.75 |

## Cómo se aplica

1. Al cargar la imagen: `escalarConfig(ancho, alto)` calcula todos los parámetros escalables.
2. Al calcular el brillo: `calcularUmbralesBrillo(brillo, ancho, alto)` calcula los umbrales del histograma.
3. Los algoritmos usan `window.CONFIG_ESC.*` en vez de `CONFIG.*`.
4. Si algo falla, el valor original de CONFIG queda como fallback.
