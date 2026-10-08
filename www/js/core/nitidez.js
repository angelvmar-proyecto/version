// ==============================================
// core/nitidez.js
// 25 filtros orientados a OCR (mejorar legibilidad de texto).
// Todos reciben (brillo, ancho, alto, ...params) y devuelven brillo.
// ==============================================

// --- Utilidad: clonar matriz de brillo ---
function nitClonar(brillo, ancho, alto) {
  const out = new Array(alto);
  for (let y = 0; y < alto; y++) {
    out[y] = new Array(ancho);
    for (let x = 0; x < ancho; x++) out[y][x] = brillo[y][x];
  }
  return out;
}

// --- Utilidad: clamp 0-255 ---
function nitClamp(v) {
  if (v < 0) return 0;
  if (v > 255) return 255;
  return v | 0;
}

// --- Utilidad: box blur rápido ---
function nitBoxBlur(brillo, ancho, alto, radio) {
  const out = new Array(alto);
  for (let y = 0; y < alto; y++) out[y] = new Array(ancho).fill(0);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      let suma = 0, count = 0;
      for (let dy = -radio; dy <= radio; dy++) {
        for (let dx = -radio; dx <= radio; dx++) {
          const yy = y + dy, xx = x + dx;
          if (yy >= 0 && yy < alto && xx >= 0 && xx < ancho) {
            suma += brillo[yy][xx];
            count++;
          }
        }
      }
      out[y][x] = suma / count;
    }
  }
  return out;
}

// --- Utilidad: gaussiano por separabilidad ---
function nitGaussiano(brillo, ancho, alto, sigma) {
  const radio = Math.max(1, Math.ceil(sigma * 3));
  const kernel = [];
  let suma = 0;
  for (let i = -radio; i <= radio; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel.push(v);
    suma += v;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= suma;

  // Horizontal
  const tmp = new Array(alto);
  for (let y = 0; y < alto; y++) {
    tmp[y] = new Array(ancho).fill(0);
    for (let x = 0; x < ancho; x++) {
      let acc = 0;
      for (let k = -radio; k <= radio; k++) {
        const xx = Math.min(ancho - 1, Math.max(0, x + k));
        acc += brillo[y][xx] * kernel[k + radio];
      }
      tmp[y][x] = acc;
    }
  }
  // Vertical
  const out = new Array(alto);
  for (let y = 0; y < alto; y++) {
    out[y] = new Array(ancho).fill(0);
    for (let x = 0; x < ancho; x++) {
      let acc = 0;
      for (let k = -radio; k <= radio; k++) {
        const yy = Math.min(alto - 1, Math.max(0, y + k));
        acc += tmp[yy][x] * kernel[k + radio];
      }
      out[y][x] = acc;
    }
  }
  return out;
}

// --- Utilidad: binarizar Otsu ---
function nitOtsu(brillo, ancho, alto) {
  const hist = new Array(256).fill(0);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) hist[brillo[y][x] | 0]++;
  }
  const total = ancho * alto;
  let sumTotal = 0;
  for (let i = 0; i < 256; i++) sumTotal += i * hist[i];
  let sumB = 0, wB = 0, maxVar = 0, umbral = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumTotal - sumB) / wF;
    const entreVar = wB * wF * (mB - mF) * (mB - mF);
    if (entreVar > maxVar) {
      maxVar = entreVar;
      umbral = t;
    }
  }
  return umbral;
}

// --- Utilidad: binarizar (devuelve 0/1) ---
function nitBinarizar(brillo, ancho, alto) {
  const umbral = nitOtsu(brillo, ancho, alto);
  const out = new Array(alto);
  for (let y = 0; y < alto; y++) {
    out[y] = new Array(ancho);
    for (let x = 0; x < ancho; x++) {
      out[y][x] = brillo[y][x] < umbral ? 1 : 0;
    }
  }
  return out;
}

// ============================================
// FILTRO 1: Laplaciano sharpen
// resultado = original + alpha * Laplaciano
// ============================================
function nitLaplacianoSharpen(brillo, ancho, alto, alpha) {
  alpha = alpha || 0.5;
  const out = nitClonar(brillo, ancho, alto);
  for (let y = 1; y < alto - 1; y++) {
    for (let x = 1; x < ancho - 1; x++) {
      const lap =
        -1 * brillo[y - 1][x] - 1 * brillo[y + 1][x]
        - 1 * brillo[y][x - 1] - 1 * brillo[y][x + 1]
        + 4 * brillo[y][x];
      out[y][x] = nitClamp(brillo[y][x] + alpha * lap);
    }
  }
  return out;
}

// ============================================
// FILTRO 2: High-pass filter
// resultado = original + alpha * (original - blur)
// ============================================
function nitHighPass(brillo, ancho, alto, radio, alpha) {
  radio = radio || 3;
  alpha = alpha || 1.0;
  const blur = nitBoxBlur(brillo, ancho, alto, radio);
  const out = nitClonar(brillo, ancho, alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const hp = brillo[y][x] - blur[y][x];
      out[y][x] = nitClamp(brillo[y][x] + alpha * hp);
    }
  }
  return out;
}

// ============================================
// FILTRO 3: Unsharp adaptativo
// Solo aplica unsharp donde el gradiente supera un umbral.
// ============================================
function nitUnsharpAdaptativo(brillo, ancho, alto, radio, amount, umbralGradiente) {
  radio = radio || 2;
  amount = amount || 1.0;
  umbralGradiente = umbralGradiente || 15;
  const blur = nitBoxBlur(brillo, ancho, alto, radio);
  const out = nitClonar(brillo, ancho, alto);
  for (let y = 1; y < alto - 1; y++) {
    for (let x = 1; x < ancho - 1; x++) {
      const gx = Math.abs(brillo[y][x + 1] - brillo[y][x - 1]);
      const gy = Math.abs(brillo[y + 1][x] - brillo[y - 1][x]);
      const grad = gx + gy;
      if (grad > umbralGradiente) {
        const diff = brillo[y][x] - blur[y][x];
        out[y][x] = nitClamp(brillo[y][x] + amount * diff);
      }
    }
  }
  return out;
}

// ============================================
// FILTRO 4: Gabor multi-orientación
// Aplica Gabor en 4 ángulos y toma la respuesta máxima.
// ============================================
function nitGaborMulti(brillo, ancho, alto, freq, orientaciones) {
  freq = freq || 0.1;
  orientaciones = orientaciones || 4;
  const bin = nitBinarizar(brillo, ancho, alto);
  const out = nitClonar(brillo, ancho, alto);
  const sigma = 3;
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      let maxResp = 0;
      for (let o = 0; o < orientaciones; o++) {
        const theta = (Math.PI * o) / orientaciones;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        let real = 0, imag = 0;
        for (let dy = -sigma; dy <= sigma; dy++) {
          for (let dx = -sigma; dx <= sigma; dx++) {
            const yy = y + dy, xx = x + dx;
            if (yy < 0 || yy >= alto || xx < 0 || xx >= ancho) continue;
            const xr = dx * cosT + dy * sinT;
            const yr = -dx * sinT + dy * cosT;
            const env = Math.exp(-(xr * xr + yr * yr) / (2 * sigma * sigma));
            const carrier = Math.cos(2 * Math.PI * freq * xr);
            const v = bin[yy][xx];
            real += v * env * carrier;
            imag += v * env * Math.sin(2 * Math.PI * freq * xr);
          }
        }
        const resp = Math.sqrt(real * real + imag * imag);
        if (resp > maxResp) maxResp = resp;
      }
      // Mezclar: si Gabor responde, oscurecer el píxel (texto)
      out[y][x] = nitClamp(brillo[y][x] - maxResp * 50);
    }
  }
  return out;
}

// ============================================
// FILTRO 5: Sobel sharpen
// ============================================
function nitSobelSharpen(brillo, ancho, alto, alpha) {
  alpha = alpha || 0.3;
  const out = nitClonar(brillo, ancho, alto);
  for (let y = 1; y < alto - 1; y++) {
    for (let x = 1; x < ancho - 1; x++) {
      const gx =
        -1 * brillo[y - 1][x - 1] + 1 * brillo[y - 1][x + 1]
        - 2 * brillo[y][x - 1] + 2 * brillo[y][x + 1]
        - 1 * brillo[y + 1][x - 1] + 1 * brillo[y + 1][x + 1];
      const gy =
        -1 * brillo[y - 1][x - 1] - 2 * brillo[y - 1][x] - 1 * brillo[y - 1][x + 1]
        + 1 * brillo[y + 1][x - 1] + 2 * brillo[y + 1][x] + 1 * brillo[y + 1][x + 1];
      const mag = Math.sqrt(gx * gx + gy * gy);
      out[y][x] = nitClamp(brillo[y][x] + alpha * mag);
    }
  }
  return out;
}

// ============================================
// FILTRO 6: Prewitt sharpen
// ============================================
function nitPrewitt(brillo, ancho, alto, alpha) {
  alpha = alpha || 0.3;
  const out = nitClonar(brillo, ancho, alto);
  for (let y = 1; y < alto - 1; y++) {
    for (let x = 1; x < ancho - 1; x++) {
      const gx =
        -1 * brillo[y - 1][x - 1] + 1 * brillo[y - 1][x + 1]
        - 1 * brillo[y][x - 1] + 1 * brillo[y][x + 1]
        - 1 * brillo[y + 1][x - 1] + 1 * brillo[y + 1][x + 1];
      const gy =
        -1 * brillo[y - 1][x - 1] - 1 * brillo[y - 1][x] - 1 * brillo[y - 1][x + 1]
        + 1 * brillo[y + 1][x - 1] + 1 * brillo[y + 1][x] + 1 * brillo[y + 1][x + 1];
      const mag = Math.sqrt(gx * gx + gy * gy);
      out[y][x] = nitClamp(brillo[y][x] + alpha * mag);
    }
  }
  return out;
}

// ============================================
// FILTRO 7: Kirsch (8 kernels direccionales)
// ============================================
function nitKirsch(brillo, ancho, alto, alpha) {
  alpha = alpha || 0.2;
  const kernels = [
    [[5,5,5],[-3,0,-3],[-3,-3,-3]],
    [[-3,5,5],[-3,0,5],[-3,-3,-3]],
    [[-3,-3,5],[-3,0,5],[-3,-3,5]],
    [[-3,-3,-3],[-3,0,5],[-3,5,5]],
    [[-3,-3,-3],[-3,0,-3],[5,5,5]],
    [[-3,-3,-3],[5,0,-3],[5,5,-3]],
    [[5,-3,-3],[5,0,-3],[5,-3,-3]],
    [[5,5,-3],[5,0,-3],[-3,-3,-3]]
  ];
  const out = nitClonar(brillo, ancho, alto);
  for (let y = 1; y < alto - 1; y++) {
    for (let x = 1; x < ancho - 1; x++) {
      let maxResp = 0;
      for (let k = 0; k < 8; k++) {
        let acc = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            acc += kernels[k][dy + 1][dx + 1] * brillo[y + dy][x + dx];
          }
        }
        if (Math.abs(acc) > maxResp) maxResp = Math.abs(acc);
      }
      out[y][x] = nitClamp(brillo[y][x] + alpha * maxResp);
    }
  }
  return out;
}

// ============================================
// FILTRO 8: Structure tensor coherence
// Realza zonas con orientación consistente (letras).
// ============================================
function nitEstructura(brillo, ancho, alto, alpha) {
  alpha = alpha || 0.5;
  const out = nitClonar(brillo, ancho, alto);
  const radio = 3;
  for (let y = 1; y < alto - 1; y++) {
    for (let x = 1; x < ancho - 1; x++) {
      const gx = (brillo[y][x + 1] - brillo[y][x - 1]) / 2;
      const gy = (brillo[y + 1][x] - brillo[y - 1][x]) / 2;
      let Jxx = 0, Jyy = 0, Jxy = 0, count = 0;
      for (let dy = -radio; dy <= radio; dy++) {
        for (let dx = -radio; dx <= radio; dx++) {
          const yy = y + dy, xx = x + dx;
          if (yy < 1 || yy >= alto - 1 || xx < 1 || xx >= ancho - 1) continue;
          const gx2 = (brillo[yy][xx + 1] - brillo[yy][xx - 1]) / 2;
          const gy2 = (brillo[yy + 1][xx] - brillo[yy - 1][xx]) / 2;
          Jxx += gx2 * gx2;
          Jyy += gy2 * gy2;
          Jxy += gx2 * gy2;
          count++;
        }
      }
      if (count > 0) {
        Jxx /= count; Jyy /= count; Jxy /= count;
      }
      const coherencia = Math.sqrt((Jxx - Jyy) * (Jxx - Jyy) + 4 * Jxy * Jxy);
      out[y][x] = nitClamp(brillo[y][x] + alpha * coherencia);
    }
  }
  return out;
}

console.log('core/nitidez.js: 8 filtros sharpen cargados');

// ============================================
// FILTRO 9: Richardson-Lucy (deconvolución)
// Recupera detalle borroso asumiendo PSF gaussiano.
// ============================================
function nitRichardsonLucy(brillo, ancho, alto, iteraciones, sigma) {
  iteraciones = iteraciones || 5;
  sigma = sigma || 1.0;
  let estim = nitClonar(brillo, ancho, alto);
  for (let it = 0; it < iteraciones; it++) {
    const conv = nitGaussiano(estim, ancho, alto, sigma);
    const ratio = new Array(alto);
    for (let y = 0; y < alto; y++) {
      ratio[y] = new Array(ancho);
      for (let x = 0; x < ancho; x++) {
        ratio[y][x] = brillo[y][x] / Math.max(1, conv[y][x]);
      }
    }
    const convRatio = nitGaussiano(ratio, ancho, alto, sigma);
    for (let y = 0; y < alto; y++) {
      for (let x = 0; x < ancho; x++) {
        estim[y][x] = nitClamp(estim[y][x] * convRatio[y][x]);
      }
    }
  }
  return estim;
}

// ============================================
// FILTRO 10: Wiener filter (simplificado)
// ============================================
function nitWiener(brillo, ancho, alto, K) {
  K = K || 0.01;
  const blur = nitGaussiano(brillo, ancho, alto, 1.0);
  const out = nitClonar(brillo, ancho, alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const num = brillo[y][x];
      const den = blur[y][x];
      const w = num * den / (den * den + K * 255 * 255);
      out[y][x] = nitClamp(num + 0.5 * (num - blur[y][x]) + w);
    }
  }
  return out;
}

// ============================================
// FILTRO 11: Tikhonov regularizado
// ============================================
function nitTikhonov(brillo, ancho, alto, lambda) {
  lambda = lambda || 0.1;
  const laplaciano = nitClonar(brillo, ancho, alto);
  for (let y = 1; y < alto - 1; y++) {
    for (let x = 1; x < ancho - 1; x++) {
      laplaciano[y][x] =
        brillo[y - 1][x] + brillo[y + 1][x] +
        brillo[y][x - 1] + brillo[y][x + 1] -
        4 * brillo[y][x];
    }
  }
  const out = nitClonar(brillo, ancho, alto);
  for (let y = 1; y < alto - 1; y++) {
    for (let x = 1; x < ancho - 1; x++) {
      out[y][x] = nitClamp(brillo[y][x] - lambda * laplaciano[y][x]);
    }
  }
  return out;
}

// ============================================
// FILTRO 12: Non-Local Means (simplificado)
// ============================================
function nitNonLocalMeans(brillo, ancho, alto, h, ventana) {
  h = h || 10;
  ventana = ventana || 3;
  const patch = 2;
  const out = nitClonar(brillo, ancho, alto);
  const h2 = h * h;
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      let sumaPesos = 0;
      let sumaVal = 0;
      for (let dy = -ventana; dy <= ventana; dy++) {
        for (let dx = -ventana; dx <= ventana; dx++) {
          const yy = y + dy, xx = x + dx;
          if (yy - patch < 0 || yy + patch >= alto || xx - patch < 0 || xx + patch >= ancho) continue;
          // Distancia entre parches
          let dist = 0;
          for (let py = -patch; py <= patch; py++) {
            for (let px = -patch; px <= patch; px++) {
              const v1 = brillo[y + py][x + px];
              const v2 = brillo[yy + py][xx + px];
              dist += (v1 - v2) * (v1 - v2);
            }
          }
          dist /= ((2 * patch + 1) * (2 * patch + 1));
          const peso = Math.exp(-Math.max(0, dist - 2 * h2) / h2);
          sumaPesos += peso;
          sumaVal += peso * brillo[yy][xx];
        }
      }
      out[y][x] = sumaPesos > 0 ? nitClamp(sumaVal / sumaPesos) : brillo[y][x];
    }
  }
  return out;
}

// ============================================
// FILTRO 13: Total Variation (ROF simplificado)
// ============================================
function nitTotalVariation(brillo, ancho, alto, lambda, iteraciones) {
  lambda = lambda || 0.1;
  iteraciones = iteraciones || 5;
  let u = nitClonar(brillo, ancho, alto);
  for (let it = 0; it < iteraciones; it++) {
    const nuevo = nitClonar(u, ancho, alto);
    for (let y = 1; y < alto - 1; y++) {
      for (let x = 1; x < ancho - 1; x++) {
        const ux = (u[y][x + 1] - u[y][x - 1]) / 2;
        const uy = (u[y + 1][x] - u[y - 1][x]) / 2;
        const grad = Math.sqrt(ux * ux + uy * uy + 1e-6);
        const div = (u[y][x + 1] + u[y][x - 1] + u[y + 1][x] + u[y - 1][x] - 4 * u[y][x]);
        nuevo[y][x] = nitClamp(u[y][x] + lambda * (div / grad));
      }
    }
    u = nuevo;
  }
  return u;
}

// ============================================
// FILTRO 14: Bilateral mejorado (pre-sharpen)
// ============================================
function nitBilateralPlus(brillo, ancho, alto, sigmaC, sigmaS) {
  sigmaC = sigmaC || 30;
  sigmaS = sigmaS || 2;
  const pre = nitLaplacianoSharpen(brillo, ancho, alto, 0.3);
  const out = nitClonar(pre, ancho, alto);
  const radio = Math.ceil(sigmaS * 2);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      let sumaPesos = 0, sumaVal = 0;
      const centro = pre[y][x];
      for (let dy = -radio; dy <= radio; dy++) {
        for (let dx = -radio; dx <= radio; dx++) {
          const yy = y + dy, xx = x + dx;
          if (yy < 0 || yy >= alto || xx < 0 || xx >= ancho) continue;
          const dColor = pre[yy][xx] - centro;
          const dEspacio = dy * dy + dx * dx;
          const peso = Math.exp(-dColor * dColor / (2 * sigmaC * sigmaC)) *
                       Math.exp(-dEspacio / (2 * sigmaS * sigmaS));
          sumaPesos += peso;
          sumaVal += peso * pre[yy][xx];
        }
      }
      out[y][x] = sumaPesos > 0 ? nitClamp(sumaVal / sumaPesos) : centro;
    }
  }
  return out;
}

// ============================================
// FILTRO 15: Mediana + unsharp suave
// ============================================
function nitMedianaPlus(brillo, ancho, alto, radio) {
  radio = radio || 1;
  const mediana = new Array(alto);
  for (let y = 0; y < alto; y++) {
    mediana[y] = new Array(ancho);
    for (let x = 0; x < ancho; x++) {
      const vals = [];
      for (let dy = -radio; dy <= radio; dy++) {
        for (let dx = -radio; dx <= radio; dx++) {
          const yy = Math.min(alto - 1, Math.max(0, y + dy));
          const xx = Math.min(ancho - 1, Math.max(0, x + dx));
          vals.push(brillo[yy][xx]);
        }
      }
      vals.sort(function(a, b) { return a - b; });
      mediana[y][x] = vals[Math.floor(vals.length / 2)];
    }
  }
  // Unsharp suave sobre la mediana
  const blur = nitBoxBlur(mediana, ancho, alto, 1);
  const out = nitClonar(mediana, ancho, alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      out[y][x] = nitClamp(mediana[y][x] + 0.5 * (mediana[y][x] - blur[y][x]));
    }
  }
  return out;
}

// ============================================
// FILTRO 16: Top-hat (realza estructuras claras)
// ============================================
function nitTopHat(brillo, ancho, alto, radio) {
  radio = radio || 3;
  // Erosión + dilatación = apertura
  const erosion = new Array(alto);
  for (let y = 0; y < alto; y++) {
    erosion[y] = new Array(ancho);
    for (let x = 0; x < ancho; x++) {
      let minV = 255;
      for (let dy = -radio; dy <= radio; dy++) {
        for (let dx = -radio; dx <= radio; dx++) {
          const yy = Math.min(alto - 1, Math.max(0, y + dy));
          const xx = Math.min(ancho - 1, Math.max(0, x + dx));
          if (brillo[yy][xx] < minV) minV = brillo[yy][xx];
        }
      }
      erosion[y][x] = minV;
    }
  }
  const apertura = new Array(alto);
  for (let y = 0; y < alto; y++) {
    apertura[y] = new Array(ancho);
    for (let x = 0; x < ancho; x++) {
      let maxV = 0;
      for (let dy = -radio; dy <= radio; dy++) {
        for (let dx = -radio; dx <= radio; dx++) {
          const yy = Math.min(alto - 1, Math.max(0, y + dy));
          const xx = Math.min(ancho - 1, Math.max(0, x + dx));
          if (erosion[yy][xx] > maxV) maxV = erosion[yy][xx];
        }
      }
      apertura[y][x] = maxV;
    }
  }
  // Top-hat = original - apertura
  const out = nitClonar(brillo, ancho, alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      out[y][x] = nitClamp(brillo[y][x] - apertura[y][x]);
    }
  }
  return out;
}

// ============================================
// FILTRO 17: Black-hat (realza estructuras oscuras)
// ============================================
function nitBlackHat(brillo, ancho, alto, radio) {
  radio = radio || 3;
  // Dilatación
  const dilat = new Array(alto);
  for (let y = 0; y < alto; y++) {
    dilat[y] = new Array(ancho);
    for (let x = 0; x < ancho; x++) {
      let maxV = 0;
      for (let dy = -radio; dy <= radio; dy++) {
        for (let dx = -radio; dx <= radio; dx++) {
          const yy = Math.min(alto - 1, Math.max(0, y + dy));
          const xx = Math.min(ancho - 1, Math.max(0, x + dx));
          if (brillo[yy][xx] > maxV) maxV = brillo[yy][xx];
        }
      }
      dilat[y][x] = maxV;
    }
  }
  // Cierre = erosión de la dilatación
  const cierre = new Array(alto);
  for (let y = 0; y < alto; y++) {
    cierre[y] = new Array(ancho);
    for (let x = 0; x < ancho; x++) {
      let minV = 255;
      for (let dy = -radio; dy <= radio; dy++) {
        for (let dx = -radio; dx <= radio; dx++) {
          const yy = Math.min(alto - 1, Math.max(0, y + dy));
          const xx = Math.min(ancho - 1, Math.max(0, x + dx));
          if (dilat[yy][xx] < minV) minV = dilat[yy][xx];
        }
      }
      cierre[y][x] = minV;
    }
  }
  // Black-hat = cierre - original
  const out = nitClonar(brillo, ancho, alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      out[y][x] = nitClamp(255 - (cierre[y][x] - brillo[y][x]));
    }
  }
  return out;
}

// ============================================
// FILTRO 18: Gradiente morfológico
// ============================================
function nitGradienteMorfologico(brillo, ancho, alto, radio) {
  radio = radio || 2;
  const out = nitClonar(brillo, ancho, alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      let minV = 255, maxV = 0;
      for (let dy = -radio; dy <= radio; dy++) {
        for (let dx = -radio; dx <= radio; dx++) {
          const yy = Math.min(alto - 1, Math.max(0, y + dy));
          const xx = Math.min(ancho - 1, Math.max(0, x + dx));
          const v = brillo[yy][xx];
          if (v < minV) minV = v;
          if (v > maxV) maxV = v;
        }
      }
      out[y][x] = nitClamp(255 - (maxV - minV));
    }
  }
  return out;
}

console.log('core/nitidez.js: +10 filtros (deconvolución/denoise/morfología básica)');

// ============================================
// FILTRO 19: Cierre morfológico pequeño (denoise)
// ============================================
function nitCierrePequeno(brillo, ancho, alto, radio) {
  radio = radio || 1;
  const dilat = new Array(alto);
  for (let y = 0; y < alto; y++) {
    dilat[y] = new Array(ancho);
    for (let x = 0; x < ancho; x++) {
      let maxV = 0;
      for (let dy = -radio; dy <= radio; dy++) {
        for (let dx = -radio; dx <= radio; dx++) {
          const yy = Math.min(alto - 1, Math.max(0, y + dy));
          const xx = Math.min(ancho - 1, Math.max(0, x + dx));
          if (brillo[yy][xx] > maxV) maxV = brillo[yy][xx];
        }
      }
      dilat[y][x] = maxV;
    }
  }
  const out = new Array(alto);
  for (let y = 0; y < alto; y++) {
    out[y] = new Array(ancho);
    for (let x = 0; x < ancho; x++) {
      let minV = 255;
      for (let dy = -radio; dy <= radio; dy++) {
        for (let dx = -radio; dx <= radio; dx++) {
          const yy = Math.min(alto - 1, Math.max(0, y + dy));
          const xx = Math.min(ancho - 1, Math.max(0, x + dx));
          if (dilat[yy][xx] < minV) minV = dilat[yy][xx];
        }
      }
      out[y][x] = minV;
    }
  }
  return out;
}

// ============================================
// FILTRO 20: Fourier High-Pass (simplificado con blur gaussiano)
// ============================================
function nitFourierHighPass(brillo, ancho, alto, radio) {
  radio = radio || 5;
  const blur = nitGaussiano(brillo, ancho, alto, radio / 2);
  const out = nitClonar(brillo, ancho, alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      out[y][x] = nitClamp(brillo[y][x] - blur[y][x] + 128);
    }
  }
  return out;
}

// ============================================
// FILTRO 21: Wavelet Haar (denoise + realce)
// ============================================
function nitWaveletHaar(brillo, ancho, alto, nivel) {
  nivel = nivel || 2;
  let actual = nitClonar(brillo, ancho, alto);
  let w = ancho, h = alto;
  for (let n = 0; n < nivel; n++) {
    const nuevo = nitClonar(actual, ancho, alto);
    // Aproximación horizontal
    const aproxH = new Array(alto);
    for (let y = 0; y < alto; y++) {
      aproxH[y] = new Array(ancho);
      for (let x = 0; x < Math.floor(w / 2); x++) {
        const a = actual[y][2 * x];
        const b = actual[y][2 * x + 1];
        aproxH[y][x] = (a + b) / 2;
        aproxH[y][Math.floor(w / 2) + x] = (a - b) / 2;
      }
      if (w % 2 === 1) aproxH[y][w - 1] = actual[y][w - 1];
    }
    // Aproximación vertical
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < Math.floor(h / 2); y++) {
        const a = aproxH[2 * y][x];
        const b = aproxH[2 * y + 1][x];
        nuevo[y][x] = (a + b) / 2;
        nuevo[Math.floor(h / 2) + y][x] = (a - b) / 2;
      }
      if (h % 2 === 1) nuevo[h - 1][x] = aproxH[h - 1][x];
    }
    // Umbral suave sobre detalles
    for (let y = 0; y < alto; y++) {
      for (let x = 0; x < ancho; x++) {
        if (x >= w / 2 || y >= h / 2) {
          if (Math.abs(nuevo[y][x]) < 3) nuevo[y][x] = 0;
        }
      }
    }
    actual = nuevo;
    w = Math.ceil(w / 2);
    h = Math.ceil(h / 2);
  }
  return actual;
}

// ============================================
// FILTRO 22: Fourier Bandpass (simulado)
// ============================================
function nitFourierBandpass(brillo, ancho, alto, rMin, rMax) {
  rMin = rMin || 2;
  rMax = rMax || 8;
  const blurSuave = nitGaussiano(brillo, ancho, alto, rMax / 2);
  const blurFuerte = nitGaussiano(brillo, ancho, alto, rMin / 2);
  const out = nitClonar(brillo, ancho, alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const banda = blurSuave[y][x] - blurFuerte[y][x];
      out[y][x] = nitClamp(brillo[y][x] + 1.5 * banda);
    }
  }
  return out;
}

// ============================================
// FILTRO 23: Gamma adaptativa local
// ============================================
function nitGammaAdaptativaLocal(brillo, ancho, alto, radio) {
  radio = radio || 15;
  const blur = nitBoxBlur(brillo, ancho, alto, radio);
  const out = nitClonar(brillo, ancho, alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const local = blur[y][x];
      const v = brillo[y][x];
      // Gamma local: si la zona es oscura, gamma < 1 (aclara); si clara, gamma > 1
      const gamma = local < 128 ? 0.8 : 1.2;
      const norm = v / 255;
      out[y][x] = nitClamp(255 * Math.pow(norm, gamma));
    }
  }
  return out;
}

// ============================================
// FILTRO 24: Dark Channel Prior (quita bruma)
// ============================================
function nitDarkChannel(brillo, ancho, alto, radio) {
  radio = radio || 5;
  const dark = new Array(alto);
  for (let y = 0; y < alto; y++) {
    dark[y] = new Array(ancho);
    for (let x = 0; x < ancho; x++) {
      let minV = 255;
      for (let dy = -radio; dy <= radio; dy++) {
        for (let dx = -radio; dx <= radio; dx++) {
          const yy = Math.min(alto - 1, Math.max(0, y + dy));
          const xx = Math.min(ancho - 1, Math.max(0, x + dx));
          if (brillo[yy][xx] < minV) minV = brillo[yy][xx];
        }
      }
      dark[y][x] = minV;
    }
  }
  const out = nitClonar(brillo, ancho, alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const d = dark[y][x];
      const t = Math.max(0.3, 1 - 0.9 * (d / 255));
      out[y][x] = nitClamp((brillo[y][x] - 0.1 * 255) / t + 0.1 * 255);
    }
  }
  return out;
}

// ============================================
// FILTRO 25: Contraste local
// ============================================
function nitContrasteLocal(brillo, ancho, alto, radio, alpha) {
  radio = radio || 10;
  alpha = alpha || 1.5;
  const blur = nitBoxBlur(brillo, ancho, alto, radio);
  const out = nitClonar(brillo, ancho, alto);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const local = blur[y][x];
      const v = brillo[y][x];
      const diff = v - local;
      out[y][x] = nitClamp(local + alpha * diff);
    }
  }
  return out;
}

// ============================================
// EXPORTAR a window
// ============================================
window.nitLaplacianoSharpen = nitLaplacianoSharpen;
window.nitHighPass = nitHighPass;
window.nitUnsharpAdaptativo = nitUnsharpAdaptativo;
window.nitGaborMulti = nitGaborMulti;
window.nitSobelSharpen = nitSobelSharpen;
window.nitPrewitt = nitPrewitt;
window.nitKirsch = nitKirsch;
window.nitEstructura = nitEstructura;
window.nitRichardsonLucy = nitRichardsonLucy;
window.nitWiener = nitWiener;
window.nitTikhonov = nitTikhonov;
window.nitNonLocalMeans = nitNonLocalMeans;
window.nitTotalVariation = nitTotalVariation;
window.nitBilateralPlus = nitBilateralPlus;
window.nitMedianaPlus = nitMedianaPlus;
window.nitTopHat = nitTopHat;
window.nitBlackHat = nitBlackHat;
window.nitGradienteMorfologico = nitGradienteMorfologico;
window.nitCierrePequeno = nitCierrePequeno;
window.nitFourierHighPass = nitFourierHighPass;
window.nitWaveletHaar = nitWaveletHaar;
window.nitFourierBandpass = nitFourierBandpass;
window.nitGammaAdaptativaLocal = nitGammaAdaptativaLocal;
window.nitDarkChannel = nitDarkChannel;
window.nitContrasteLocal = nitContrasteLocal;

console.log('core/nitidez.js: 25 filtros completos cargados');
