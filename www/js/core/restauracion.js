// ==============================================
// core/restauracion.js
// Algoritmos de restauracion de imagen para
// compensar degradacion por compresion WhatsApp.
// ==============================================

function restaurarBilateral(brillo, ancho, alto, sigmaColor, sigmaSpace) {
  const radio = Math.min(15, Math.max(1, Math.ceil(sigmaSpace / 3)));
  const out = new Array(alto);
  const colorK = -0.5 / (sigmaColor * sigmaColor);
  const spaceK = -0.5 / (sigmaSpace * sigmaSpace);

  // Precompute spatial kernel
  const spatialSize = 2 * radio + 1;
  const spatial = new Float32Array(spatialSize * spatialSize);
  for (let dy = -radio; dy <= radio; dy++) {
    for (let dx = -radio; dx <= radio; dx++) {
      spatial[(dy + radio) * spatialSize + (dx + radio)] =
        Math.exp((dx * dx + dy * dy) * spaceK);
    }
  }

  for (let y = 0; y < alto; y++) {
    const fila = new Array(ancho);
    for (let x = 0; x < ancho; x++) {
      const centro = brillo[y][x];
      let suma = 0, pesoTotal = 0;
      const y0 = Math.max(0, y - radio), y1 = Math.min(alto - 1, y + radio);
      const x0 = Math.max(0, x - radio), x1 = Math.min(ancho - 1, x + radio);
      for (let yy = y0; yy <= y1; yy++) {
        for (let xx = x0; xx <= x1; xx++) {
          const v = brillo[yy][xx];
          const dc = v - centro;
          const colorW = Math.exp(dc * dc * colorK);
          const spaceW = spatial[(yy - y + radio) * spatialSize + (xx - x + radio)];
          const w = colorW * spaceW;
          suma += v * w;
          pesoTotal += w;
        }
      }
      fila[x] = Math.round(suma / pesoTotal);
    }
    out[y] = fila;
  }
  return out;
}

function restaurarContrast(brillo, ancho, alto, percBajo, percAlto) {
  const hist = new Array(256).fill(0);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) hist[brillo[y][x] | 0]++;
  }
  const total = ancho * alto;
  const limBajo = total * (percBajo / 100);
  const limAlto = total * (percAlto / 100);

  let acum = 0, minV = 0, maxV = 255;
  for (let i = 0; i < 256; i++) {
    acum += hist[i];
    if (acum >= limBajo) { minV = i; break; }
  }
  acum = 0;
  for (let i = 0; i < 256; i++) {
    acum += hist[i];
    if (acum >= limAlto) { maxV = i; break; }
  }

  const rango = Math.max(1, maxV - minV);
  const factor = 255 / rango;

  const out = new Array(alto);
  for (let y = 0; y < alto; y++) {
    const fila = new Array(ancho);
    for (let x = 0; x < ancho; x++) {
      let v = (brillo[y][x] - minV) * factor;
      if (v < 0) v = 0;
      else if (v > 255) v = 255;
      fila[x] = Math.round(v);
    }
    out[y] = fila;
  }
  return out;
}

function restaurarUnsharp(brillo, ancho, alto, radio, amount) {
  const blur = boxBlur(brillo, ancho, alto, radio);
  const out = new Array(alto);
  for (let y = 0; y < alto; y++) {
    const fila = new Array(ancho);
    for (let x = 0; x < ancho; x++) {
      const diff = brillo[y][x] - blur[y][x];
      let v = brillo[y][x] + amount * diff;
      if (v < 0) v = 0;
      else if (v > 255) v = 255;
      fila[x] = Math.round(v);
    }
    out[y] = fila;
  }
  return out;
}

function boxBlur(brillo, ancho, alto, radio) {
  if (radio < 1) return brillo;
  const integH = new Array(alto);
  for (let y = 0; y < alto; y++) {
    const acum = new Array(ancho + 1);
    acum[0] = 0;
    for (let x = 0; x < ancho; x++) acum[x + 1] = acum[x] + brillo[y][x];
    integH[y] = acum;
  }
  const tmp = new Array(alto);
  for (let y = 0; y < alto; y++) {
    const acum = integH[y];
    const fila = new Array(ancho);
    for (let x = 0; x < ancho; x++) {
      const ini = Math.max(0, x - radio);
      const fin = Math.min(ancho - 1, x + radio);
      fila[x] = (acum[fin + 1] - acum[ini]) / (fin - ini + 1);
    }
    tmp[y] = fila;
  }
  const integV = new Array(ancho);
  for (let x = 0; x < ancho; x++) {
    const acum = new Array(alto + 1);
    acum[0] = 0;
    for (let y = 0; y < alto; y++) acum[y + 1] = acum[y] + tmp[y][x];
    integV[x] = acum;
  }
  const out = new Array(alto);
  for (let y = 0; y < alto; y++) {
    const fila = new Array(ancho);
    for (let x = 0; x < ancho; x++) {
      const acum = integV[x];
      const ini = Math.max(0, y - radio);
      const fin = Math.min(alto - 1, y + radio);
      fila[x] = (acum[fin + 1] - acum[ini]) / (fin - ini + 1);
    }
    out[y] = fila;
  }
  return out;
}

function restaurarMediana(brillo, ancho, alto, radio) {
  if (radio < 1) return brillo;
  const out = new Array(alto);
  const ventana = (2 * radio + 1) * (2 * radio + 1);
  const buffer = new Array(ventana);

  for (let y = 0; y < alto; y++) {
    const fila = new Array(ancho);
    for (let x = 0; x < ancho; x++) {
      let k = 0;
      const y0 = Math.max(0, y - radio), y1 = Math.min(alto - 1, y + radio);
      const x0 = Math.max(0, x - radio), x1 = Math.min(ancho - 1, x + radio);
      for (let yy = y0; yy <= y1; yy++) {
        for (let xx = x0; xx <= x1; xx++) buffer[k++] = brillo[yy][xx];
      }
      const sub = buffer.slice(0, k).sort(function(a, b) { return a - b; });
      fila[x] = sub[Math.floor(sub.length / 2)];
    }
    out[y] = fila;
  }
  return out;
}

function restaurarGaussiano(brillo, ancho, alto, sigma) {
  const radio = Math.max(1, Math.round(sigma * 2));
  const tmp = boxBlur(brillo, ancho, alto, radio);
  return boxBlur(tmp, ancho, alto, radio);
}

function restaurarCLAHE(brillo, ancho, alto, tiles, clip) {
  if (typeof aplicarCLAHE === 'function') {
    return aplicarCLAHE(brillo, ancho, alto, tiles, clip);
  }
  return brillo;
}

function restaurarDeBlock(brillo, ancho, alto, blockSize) {
  const out = new Array(alto);
  for (let y = 0; y < alto; y++) out[y] = brillo[y].slice();

  for (let by = blockSize; by < alto; by += blockSize) {
    for (let x = 0; x < ancho; x++) {
      const a = brillo[by - 1][x];
      const b = brillo[by][x];
      const dif = Math.abs(a - b);
      if (dif < 30) {
        const prom = Math.round((a + b) / 2);
        out[by - 1][x] = prom;
        out[by][x] = prom;
      }
    }
  }
  for (let bx = blockSize; bx < ancho; bx += blockSize) {
    for (let y = 0; y < alto; y++) {
      const a = brillo[y][bx - 1];
      const b = brillo[y][bx];
      const dif = Math.abs(a - b);
      if (dif < 30) {
        const prom = Math.round((a + b) / 2);
        out[y][bx - 1] = prom;
        out[y][bx] = prom;
      }
    }
  }
  return out;
}

function restaurarBinarizar(brillo, ancho, alto) {
  const hist = new Array(256).fill(0);
  for (let y = 0; y < alto; y++)
    for (let x = 0; x < ancho; x++) hist[brillo[y][x] | 0]++;
  const total = ancho * alto;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, maxVar = 0, umbral = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) * (mB - mF);
    if (varBetween > maxVar) { maxVar = varBetween; umbral = t; }
  }
  if (maxVar === 0) umbral = 128;
  const out = new Array(alto);
  for (let y = 0; y < alto; y++) {
    const fila = new Array(ancho);
    for (let x = 0; x < ancho; x++) fila[x] = brillo[y][x] < umbral ? 0 : 255;
    out[y] = fila;
  }
  return out;
}

function restaurarGuided(brillo, ancho, alto, radio, eps) {
  const n = ancho * alto;

  const I = new Float32Array(n);
  const p = new Float32Array(n);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const v = brillo[y][x];
      I[y * ancho + x] = v;
      p[y * ancho + x] = v;
    }
  }

  const meanI  = guidedBoxBlur(I, ancho, alto, radio);
  const meanP  = guidedBoxBlur(p, ancho, alto, radio);
  const corrI  = guidedBoxBlur(multiplicarArr(I, I), ancho, alto, radio);
  const corrIp = guidedBoxBlur(multiplicarArr(I, p), ancho, alto, radio);

  const a = new Float32Array(n);
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const varI = corrI[i] - meanI[i] * meanI[i];
    const covIp = corrIp[i] - meanI[i] * meanP[i];
    a[i] = covIp / (varI + eps);
    b[i] = meanP[i] - a[i] * meanI[i];
  }

  const meanA = guidedBoxBlur(a, ancho, alto, radio);
  const meanB = guidedBoxBlur(b, ancho, alto, radio);

  const out = new Array(alto);
  for (let y = 0; y < alto; y++) {
    const fila = new Array(ancho);
    for (let x = 0; x < ancho; x++) {
      const idx = y * ancho + x;
      let v = meanA[idx] * I[idx] + meanB[idx];
      if (v < 0) v = 0;
      else if (v > 255) v = 255;
      fila[x] = Math.round(v);
    }
    out[y] = fila;
  }
  return out;
}

function multiplicarArr(a, b) {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] * b[i];
  return out;
}

function guidedBoxBlur(arr, ancho, alto, radio) {
  if (radio < 1) return arr.slice();
  const tmp = new Float32Array(arr.length);
  for (let y = 0; y < alto; y++) {
    const base = y * ancho;
    const acum = new Float32Array(ancho + 1);
    for (let x = 0; x < ancho; x++) acum[x + 1] = acum[x] + arr[base + x];
    for (let x = 0; x < ancho; x++) {
      const ini = Math.max(0, x - radio);
      const fin = Math.min(ancho - 1, x + radio);
      tmp[base + x] = (acum[fin + 1] - acum[ini]) / (fin - ini + 1);
    }
  }
  const out = new Float32Array(arr.length);
  for (let x = 0; x < ancho; x++) {
    const acum = new Float32Array(alto + 1);
    for (let y = 0; y < alto; y++) acum[y + 1] = acum[y] + tmp[y * ancho + x];
    for (let y = 0; y < alto; y++) {
      const ini = Math.max(0, y - radio);
      const fin = Math.min(alto - 1, y + radio);
      out[y * ancho + x] = (acum[fin + 1] - acum[ini]) / (fin - ini + 1);
    }
  }
  return out;
}

console.log('core/restauracion.js cargado');
