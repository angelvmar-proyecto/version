// ==============================================
// core/preprocesamiento_avanzado.js
// Gamma Correction + CLAHE para mejorar lineas debiles.
// ==============================================

/**
 * Gamma Correction: oscurece medios tonos.
 * nuevo = 255 * (v/255)^gamma
 * gamma > 1 -> oscurece (util para lineas grises)
 */
function aplicarGamma(brillo, ancho, alto, gamma) {
  const tabla = new Array(256);
  for (let v = 0; v < 256; v++) {
    tabla[v] = Math.round(255 * Math.pow(v / 255, gamma));
  }
  const res = new Array(alto);
  for (let y = 0; y < alto; y++) {
    const fila = new Array(ancho);
    for (let x = 0; x < ancho; x++) {
      fila[x] = tabla[brillo[y][x]];
    }
    res[y] = fila;
  }
  return res;
}

/**
 * CLAHE simplificado: ecualizacion adaptativa por tiles con clip.
 * Divide la imagen en tiles x tiles, ecualiza cada uno, interpola bilineal.
 */
function aplicarCLAHE(brillo, ancho, alto, numTiles, clipFactor) {
  const tileW = Math.max(4, Math.floor(ancho / numTiles));
  const tileH = Math.max(4, Math.floor(alto / numTiles));
  const cols = Math.ceil(ancho / tileW);
  const rows = Math.ceil(alto / tileH);

  // 1. Calcular mapeos locales por tile
  const mapas = [];
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const x0 = tx * tileW;
      const y0 = ty * tileH;
      const x1 = Math.min(ancho, x0 + tileW);
      const y1 = Math.min(alto, y0 + tileH);

      const hist = new Array(256).fill(0);
      let count = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          hist[brillo[y][x]]++;
          count++;
        }
      }

      // Clip: limitar cada bin
      const clipLimit = Math.max(1, Math.round(clipFactor * count / 256));
      let exceso = 0;
      for (let i = 0; i < 256; i++) {
        if (hist[i] > clipLimit) {
          exceso += hist[i] - clipLimit;
          hist[i] = clipLimit;
        }
      }
      // Redistribuir exceso uniformemente
      const suma = Math.floor(exceso / 256);
      for (let i = 0; i < 256; i++) hist[i] += suma;

      // CDF
      const mapa = new Array(256);
      let acum = 0;
      for (let i = 0; i < 256; i++) {
        acum += hist[i];
        mapa[i] = Math.round(255 * acum / count);
      }
      mapas.push({ tx: tx, ty: ty, mapa: mapa });
    }
  }

  // 2. Interpolar bilinealmente
  const res = new Array(alto);
  for (let y = 0; y < alto; y++) {
    res[y] = new Array(ancho);
    const ty = Math.min(rows - 1, Math.floor(y / tileH));
    const dy = (y - ty * tileH) / tileH;
    for (let x = 0; x < ancho; x++) {
      const tx = Math.min(cols - 1, Math.floor(x / tileW));
      const dx = (x - tx * tileW) / tileW;

      const getM = function(txi, tyi) {
        txi = Math.max(0, Math.min(cols - 1, txi));
        tyi = Math.max(0, Math.min(rows - 1, tyi));
        return mapas[tyi * cols + txi].mapa;
      };

      const v = brillo[y][x];
      const m00 = getM(tx, ty)[v];
      const m10 = getM(tx + 1, ty)[v];
      const m01 = getM(tx, ty + 1)[v];
      const m11 = getM(tx + 1, ty + 1)[v];

      const top = m00 * (1 - dx) + m10 * dx;
      const bot = m01 * (1 - dx) + m11 * dx;
      res[y][x] = Math.round(top * (1 - dy) + bot * dy);
    }
  }
  return res;
}

console.log('core/preprocesamiento_avanzado.js cargado');
