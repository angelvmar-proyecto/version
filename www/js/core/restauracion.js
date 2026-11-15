// ==============================================
// core/restauracion.js
// Algoritmos de restauración de imagen.
// Incluye: brillos, Retinex, Flatten, Mediana rápida, etc.
// ==============================================

(function() {
  'use strict';

  // ============================================
  // HELPERS INTERNOS
  // ============================================

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

  // ============================================
  // FILTROS DE RESTAURACIÓN
  // ============================================

  function restaurarBilateral(brillo, ancho, alto, sigmaColor, sigmaSpace) {
    const radio = Math.min(15, Math.max(1, Math.ceil(sigmaSpace / 3)));
    const out = new Array(alto);
    const colorK = -0.5 / (sigmaColor * sigmaColor);
    const spaceK = -0.5 / (sigmaSpace * sigmaSpace);
    const spatialSize = 2 * radio + 1;
    const spatial = new Float32Array(spatialSize * spatialSize);
    for (let dy = -radio; dy <= radio; dy++) {
      for (let dx = -radio; dx <= radio; dx++) {
        spatial[(dy + radio) * spatialSize + (dx + radio)] = Math.exp((dx * dx + dy * dy) * spaceK);
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
            const w = Math.exp(dc * dc * colorK) * spatial[(yy - y + radio) * spatialSize + (xx - x + radio)];
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
    for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) hist[brillo[y][x] | 0]++;
    const total = ancho * alto;
    const limBajo = total * (percBajo / 100);
    const limAlto = total * (percAlto / 100);
    let acum = 0, minV = 0, maxV = 255;
    for (let i = 0; i < 256; i++) { acum += hist[i]; if (acum >= limBajo) { minV = i; break; } }
    acum = 0;
    for (let i = 0; i < 256; i++) { acum += hist[i]; if (acum >= limAlto) { maxV = i; break; } }
    const rango = Math.max(1, maxV - minV);
    const factor = 255 / rango;
    const out = new Array(alto);
    for (let y = 0; y < alto; y++) {
      const fila = new Array(ancho);
      for (let x = 0; x < ancho; x++) {
        let v = (brillo[y][x] - minV) * factor;
        fila[x] = v < 0 ? 0 : (v > 255 ? 255 : Math.round(v));
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
        fila[x] = v < 0 ? 0 : (v > 255 ? 255 : Math.round(v));
      }
      out[y] = fila;
    }
    return out;
  }

  // Mediana RÁPIDA (histograma)
  function restaurarMediana(brillo, ancho, alto, radio) {
    if (radio < 1) return brillo;
    const out = new Array(alto);
    const hist = new Array(256);
    for (let y = 0; y < alto; y++) {
      const fila = new Array(ancho);
      for (let x = 0; x < ancho; x++) {
        for (let i = 0; i < 256; i++) hist[i] = 0;
        let count = 0;
        const y0 = Math.max(0, y - radio), y1 = Math.min(alto - 1, y + radio);
        const x0 = Math.max(0, x - radio), x1 = Math.min(ancho - 1, x + radio);
        for (let yy = y0; yy <= y1; yy++) {
          for (let xx = x0; xx <= x1; xx++) { hist[brillo[yy][xx] | 0]++; count++; }
        }
        let acumulado = 0, mediana = 128;
        const mitad = Math.floor(count / 2);
        for (let i = 0; i < 256; i++) { acumulado += hist[i]; if (acumulado > mitad) { mediana = i; break; } }
        fila[x] = mediana;
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
    if (typeof window.aplicarCLAHE === 'function') return window.aplicarCLAHE(brillo, ancho, alto, tiles, clip);
    return brillo;
  }

  function restaurarDeBlock(brillo, ancho, alto, blockSize) {
    const out = new Array(alto);
    for (let y = 0; y < alto; y++) out[y] = brillo[y].slice();
    for (let by = blockSize; by < alto; by += blockSize) {
      for (let x = 0; x < ancho; x++) {
        const a = brillo[by - 1][x], b = brillo[by][x];
        if (Math.abs(a - b) < 30) { const p = Math.round((a + b) / 2); out[by - 1][x] = p; out[by][x] = p; }
      }
    }
    for (let bx = blockSize; bx < ancho; bx += blockSize) {
      for (let y = 0; y < alto; y++) {
        const a = brillo[y][bx - 1], b = brillo[y][bx];
        if (Math.abs(a - b) < 30) { const p = Math.round((a + b) / 2); out[y][bx - 1] = p; out[y][bx] = p; }
      }
    }
    return out;
  }

  function restaurarBinarizar(brillo, ancho, alto) {
    const hist = new Array(256).fill(0);
    for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) hist[brillo[y][x] | 0]++;
    const total = ancho * alto;
    let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, maxVar = 0, umbral = 128;
    for (let t = 0; t < 256; t++) {
      wB += hist[t]; if (wB === 0) continue;
      const wF = total - wB; if (wF === 0) break;
      sumB += t * hist[t];
      const mB = sumB / wB, mF = (sum - sumB) / wF;
      const v = wB * wF * (mB - mF) * (mB - mF);
      if (v > maxVar) { maxVar = v; umbral = t; }
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
    const I = new Float32Array(n), p = new Float32Array(n);
    for (let y = 0; y < alto; y++) for (let x = 0; x < ancho; x++) { const v = brillo[y][x]; I[y * ancho + x] = v; p[y * ancho + x] = v; }
    const meanI = guidedBoxBlur(I, ancho, alto, radio);
    const meanP = guidedBoxBlur(p, ancho, alto, radio);
    const corrI = guidedBoxBlur(multiplicarArr(I, I), ancho, alto, radio);
    const corrIp = guidedBoxBlur(multiplicarArr(I, p), ancho, alto, radio);
    const a = new Float32Array(n), b = new Float32Array(n);
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
        fila[x] = v < 0 ? 0 : (v > 255 ? 255 : Math.round(v));
      }
      out[y] = fila;
    }
    return out;
  }

  function multiplicarArr(a, b) { const o = new Float32Array(a.length); for (let i = 0; i < a.length; i++) o[i] = a[i] * b[i]; return o; }

  function guidedBoxBlur(arr, ancho, alto, radio) {
    if (radio < 1) return arr.slice();
    const tmp = new Float32Array(arr.length);
    for (let y = 0; y < alto; y++) {
      const base = y * ancho;
      const acum = new Float32Array(ancho + 1);
      for (let x = 0; x < ancho; x++) acum[x + 1] = acum[x] + arr[base + x];
      for (let x = 0; x < ancho; x++) {
        const ini = Math.max(0, x - radio), fin = Math.min(ancho - 1, x + radio);
        tmp[base + x] = (acum[fin + 1] - acum[ini]) / (fin - ini + 1);
      }
    }
    const out = new Float32Array(arr.length);
    for (let x = 0; x < ancho; x++) {
      const acum = new Float32Array(alto + 1);
      for (let y = 0; y < alto; y++) acum[y + 1] = acum[y] + tmp[y * ancho + x];
      for (let y = 0; y < alto; y++) {
        const ini = Math.max(0, y - radio), fin = Math.min(alto - 1, y + radio);
        out[y * ancho + x] = (acum[fin + 1] - acum[ini]) / (fin - ini + 1);
      }
    }
    return out;
  }

  function restaurarFlattenIluminacion(brillo, ancho, alto) {
    const radioFondo = Math.max(20, Math.round(Math.min(ancho, alto) * 0.15));
    const fondo = boxBlur(brillo, ancho, alto, radioFondo);
    const out = new Array(alto);
    for (let y = 0; y < alto; y++) {
      const fila = new Array(ancho);
      for (let x = 0; x < ancho; x++) {
        const f = fondo[y][x];
        if (f > 10) {
          const v = (brillo[y][x] / f) * 255;
          fila[x] = v < 0 ? 0 : (v > 255 ? 255 : Math.round(v));
        } else fila[x] = brillo[y][x];
      }
      out[y] = fila;
    }
    return out;
  }

  // ============================================
  // NUEVOS FILTROS: BRILLOS + RETINEX
  // ============================================

  function restaurarQuitarBrillos(brillo, ancho, alto) {
    const out = new Array(alto);
    for (let y = 0; y < alto; y++) out[y] = brillo[y].slice();
    const umbralBrillo = 230;
    const radioBusqueda = 3;
    for (let y = 1; y < alto - 1; y++) {
      for (let x = 1; x < ancho - 1; x++) {
        if (brillo[y][x] > umbralBrillo) {
          let suma = 0, count = 0;
          const y0 = Math.max(0, y - radioBusqueda), y1 = Math.min(alto - 1, y + radioBusqueda);
          const x0 = Math.max(0, x - radioBusqueda), x1 = Math.min(ancho - 1, x + radioBusqueda);
          for (let yy = y0; yy <= y1; yy++) {
            for (let xx = x0; xx <= x1; xx++) {
              if (brillo[yy][xx] <= umbralBrillo) { suma += brillo[yy][xx]; count++; }
            }
          }
          if (count >= 3) out[y][x] = Math.round(suma / count);
        }
      }
    }
    return out;
  }

  function restaurarRetinex(brillo, ancho, alto) {
    const radio = Math.max(20, Math.round(Math.min(ancho, alto) * 0.15));
    const iluminacion = boxBlur(brillo, ancho, alto, radio);
    const out = new Array(alto);
    for (let y = 0; y < alto; y++) {
      out[y] = new Array(ancho);
      for (let x = 0; x < ancho; x++) {
        const v = Math.max(1, brillo[y][x]);
        const i = Math.max(1, iluminacion[y][x]);
        const reflectancia = Math.log(v) - Math.log(i);
        let valorFinal = Math.round((reflectancia * 128) + 128);
        if (valorFinal < 0) valorFinal = 0;
        if (valorFinal > 255) valorFinal = 255;
        out[y][x] = valorFinal;
      }
    }
    return out;
  }

  // ============================================
  // EXPORTAR
  // ============================================
  window.restaurarBilateral = restaurarBilateral;
  window.restaurarContrast = restaurarContrast;
  window.restaurarUnsharp = restaurarUnsharp;
  window.restaurarMediana = restaurarMediana;
  window.restaurarGaussiano = restaurarGaussiano;
  window.restaurarCLAHE = restaurarCLAHE;
  window.restaurarDeBlock = restaurarDeBlock;
  window.restaurarBinarizar = restaurarBinarizar;
  window.restaurarGuided = restaurarGuided;
  window.restaurarFlattenIluminacion = restaurarFlattenIluminacion;
  window.restaurarQuitarBrillos = restaurarQuitarBrillos;
  window.restaurarRetinex = restaurarRetinex;

  console.log('[core] restauracion.js cargado (con brillos + retinex)');
})();
