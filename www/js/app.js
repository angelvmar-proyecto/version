const lienzo = document.getElementById('lienzo');
const ctx = lienzo.getContext('2d');
const logs = document.getElementById('logs');
const areaImagen = document.getElementById('areaImagen');

let imagenOriginal = null;
let escala = 1;
let lineasH = [];
let lineasV = [];
let motorOCR = null;

function log(texto) {
  logs.innerHTML += `<div>${new Date().toLocaleTimeString()} — ${texto}</div>`;
  logs.scrollTop = logs.scrollHeight;
}

function dibujarTodo() {
  if (!imagenOriginal) return;
  lienzo.width = imagenOriginal.width * escala;
  lienzo.height = imagenOriginal.height * escala;
  ctx.scale(escala, escala);
  ctx.drawImage(imagenOriginal, 0, 0);
  ctx.setTransform(1,0,0,1,0,0);
  ctx.scale(escala, escala);
  ctx.strokeStyle = '#ff0000';
  ctx.lineWidth = 1.5 / escala;
  lineasH.forEach(y => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(imagenOriginal.width, y); ctx.stroke(); });
  lineasV.forEach(x => { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, imagenOriginal.height); ctx.stroke(); });
}

document.getElementById('btnCargar').addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = e => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    log(`Cargando: ${archivo.name} (${Math.round(archivo.size/1024)} KB)`);
    const lector = new FileReader();
    lector.onload = evt => {
      const img = new Image();
      img.onload = () => {
        imagenOriginal = img;
        escala = Math.min(areaImagen.clientWidth / img.width, 1);
        lineasH = []; lineasV = [];
        dibujarTodo();
        log(`✅ Imagen: ${img.width}×${img.height} | Escala: ${Math.round(escala*100)}%`);
      };
      img.src = evt.target.result;
    };
    lector.readAsDataURL(archivo);
  };
  input.click();
});

document.getElementById('btnZoomMas').addEventListener('click', () => { escala *= 1.3; dibujarTodo(); log(`Zoom: ${Math.round(escala*100)}%`); });
document.getElementById('btnZoomMenos').addEventListener('click', () => { escala /= 1.3; dibujarTodo(); log(`Zoom: ${Math.round(escala*100)}%`); });

document.getElementById('btnDetectar').addEventListener('click', () => {
  if (!imagenOriginal) { log('⚠️ Carga una imagen primero'); return; }
  log('🔍 Detectando líneas...');
  lineasH = []; lineasV = [];
  const ancho = imagenOriginal.width;
  const alto = imagenOriginal.height;
  const filas = 10; const cols = 21;
  for (let i = 0; i <= filas; i++) lineasH.push(Math.round(alto * i / filas));
  for (let i = 0; i <= cols; i++) lineasV.push(Math.round(ancho * i / cols));
  dibujarTodo();
  log(`✅ ${lineasH.length} líneas H / ${lineasV.length} líneas V`);
});

document.getElementById('btnLeer').addEventListener('click', async () => {
  if (!imagenOriginal) { log('⚠️ Carga una imagen primero'); return; }
  log('📖 Iniciando Tesseract...');
  if (!motorOCR) {
    motorOCR = await Tesseract.createWorker('spa+eng');
    log('✅ Tesseract listo');
  }
  log('🔄 Procesando...');
  const { data: { text } } = await motorOCR.recognize(lienzo);
  log(`📝 Texto extraído:\n${text}`);
});

document.getElementById('btnExportar').addEventListener('click', () => {
  log('📋 Función en desarrollo');
});

log('✅ Aplicación MAR Caribe inicializada');
