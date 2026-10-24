// ==============================================
// core/tabla_inferencia.js
// Inferencia de líneas verticales basada en los
// gaps (espacios) entre los elementos del OCR.
// ==============================================

// Analiza los elementos de todas las filas y encuentra posiciones X
// donde hay un espacio grande entre palabras consecutivas.
function tabInferirCandidatosV(elementosPorFila, anchoImagen, umbralGap) {
  umbralGap = umbralGap || 20;
  const candidatos = [];

  for (const fila of elementosPorFila) {
    if (!fila || fila.length < 2) continue;
    
    // Ordenar por posición X
    const ordenados = fila.slice().sort(function(a, b) { return a.absLeft - b.absLeft; });

    for (let i = 0; i < ordenados.length - 1; i++) {
      const actual = ordenados[i];
      const siguiente = ordenados[i + 1];
      
      const gap = siguiente.absLeft - actual.absRight;
      
      // Si el espacio es mayor al umbral, es un candidato a columna
      if (gap > umbralGap) {
        // Guardamos el punto medio del espacio
        candidatos.push(actual.absRight + (gap / 2));
      }
    }
  }

  return candidatos;
}

// Agrupa candidatos que están muy cerca (ej. < 30px) en un solo punto promedio
function tabClusterizarV(candidatos, tolerancia) {
  tolerancia = tolerancia || 30;
  if (candidatos.length === 0) return [];

  candidatos.sort(function(a, b) { return a - b; });

  const clusters = [];
  let grupo = [candidatos[0]];

  for (let i = 1; i < candidatos.length; i++) {
    if (candidatos[i] - grupo[grupo.length - 1] < tolerancia) {
      grupo.push(candidatos[i]);
    } else {
      // Promediar el grupo y guardarlo
      let suma = 0;
      for (const v of grupo) suma += v;
      clusters.push(suma / grupo.length);
      grupo = [candidatos[i]];
    }
  }
  // Último grupo
  let suma = 0;
  for (const v of grupo) suma += v;
  clusters.push(suma / grupo.length);

  return clusters;
}

// Filtra las V inferidas: solo deja las que aparecen en >= 30% de las filas
function tabFiltrarVConsenso(candidatos, numFilas, umbralRatio) {
  umbralRatio = umbralRatio || 0.3;
  if (numFilas === 0) return [];
  
  // Necesitamos saber cuántas veces aparece cada valor.
  // Como ya están agrupados en clusters, cada valor es representativo de un grupo.
  // Pero para hacer consenso real, hacemos un segundo agrupamiento.
  const clusters = tabClusterizarV(candidatos, 30);
  const resultado = [];

  for (const c of clusters) {
    let count = 0;
    for (const cand of candidatos) {
      if (Math.abs(cand - c) < 30) count++;
    }
    if (count / numFilas >= umbralRatio) {
      resultado.push(c);
    }
  }
  return resultado;
}

// Combina las V del detector (Realce) con las inferidas.
// Si están cerca, se promedian. Si no, se agregan.
function tabCombinarV(vDetector, vInferidas, tolerancia) {
  tolerancia = tolerancia || 30;
  const combinadas = [];
  
  // Copiar las del detector
  for (const v of vDetector) combinadas.push({ pos: v, origen: 'detector' });

  // Evaluar las inferidas
  for (const vInf of vInferidas) {
    let cerca = false;
    for (const c of combinadas) {
      if (Math.abs(c.pos - vInf) < tolerancia) {
        // Si ya existe una cerca, promediamos para afinar
        c.pos = (c.pos + vInf) / 2;
        c.origen = 'validada';
        cerca = true;
        break;
      }
    }
    if (!cerca) {
      // Si es inferida y no tiene detector cerca, la agregamos
      combinadas.push({ pos: vInf, origen: 'inferida' });
    }
  }

  // Ordenar por posición
  combinadas.sort(function(a, b) { return a.pos - b.pos; });
  return combinadas.map(function(c) { return c.pos; });
}

window.tabInferirCandidatosV = tabInferirCandidatosV;
window.tabClusterizarV = tabClusterizarV;
window.tabFiltrarVConsenso = tabFiltrarVConsenso;
window.tabCombinarV = tabCombinarV;

console.log('core/tabla_inferencia.js cargado');
