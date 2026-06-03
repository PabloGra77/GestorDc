import { useCallback, useEffect, useRef, useState } from 'react';

interface SignaturePadProps {
  /** dataURL inicial (si ya hay firma) */
  value?: string | null;
  /** Devuelve dataURL PNG o '' si vacia */
  onChange: (dataUrl: string) => void;
  label?: string;
  height?: number;
}

/**
 * Canvas firma con soporte mouse + touch (movil con dedo o lapiz) +
 * opcion de adjuntar imagen.
 */
export function SignaturePad({ value, onChange, label = 'Firma', height = 180 }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawing = useRef(false);
  const [hasContent, setHasContent] = useState<boolean>(Boolean(value));
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.2;
    ctxRef.current = ctx;
    // Si ya hay valor, dibujarlo
    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        ctx.drawImage(img, 0, 0, canvas.width / dpr, canvas.height / dpr);
        setHasContent(true);
      };
      img.src = value;
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    }
  }, [value, height]);

  useEffect(() => {
    setupCanvas();
    const onResize = () => setupCanvas();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setupCanvas]);

  function getPos(e: PointerEvent | React.PointerEvent): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: (e as PointerEvent).clientX - rect.left, y: (e as PointerEvent).clientY - rect.top };
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const ctx = ctxRef.current;
    if (!ctx) return;
    drawing.current = true;
    canvasRef.current?.setPointerCapture(e.pointerId);
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasContent(true);
  }

  function endDraw() {
    if (!drawing.current) return;
    drawing.current = false;
    emitir();
  }

  function emitir() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!hasContent) {
      onChange('');
      return;
    }
    // Recortar a PNG y devolver dataURL
    const dataUrl = canvas.toDataURL('image/png');
    onChange(dataUrl);
  }

  function limpiar() {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasContent(false);
    onChange('');
  }

  function subirImagen(file: File) {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      // Pintar al canvas
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      if (!canvas || !ctx) return;
      const img = new Image();
      img.onload = () => {
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.width / dpr;
        const h = canvas.height / dpr;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        // Mantener proporcion
        const ratio = Math.min(w / img.width, h / img.height);
        const drawW = img.width * ratio;
        const drawH = img.height * ratio;
        ctx.drawImage(img, (w - drawW) / 2, (h - drawH) / 2, drawW, drawH);
        setHasContent(true);
        onChange(canvas.toDataURL('image/png'));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="signature-pad">
      <div className="signature-pad-header">
        <label>{label}</label>
        <div className="signature-pad-actions">
          <button type="button" className="signature-btn" onClick={() => fileInputRef.current?.click()}>
            📎 Subir imagen
          </button>
          <button type="button" className="signature-btn signature-btn-clear" onClick={limpiar}>
            ✕ Limpiar
          </button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) subirImagen(f);
          e.target.value = '';
        }}
      />
      <canvas
        ref={canvasRef}
        className="signature-canvas"
        onPointerDown={startDraw}
        onPointerMove={move}
        onPointerUp={endDraw}
        onPointerCancel={endDraw}
        onPointerLeave={endDraw}
        style={{ touchAction: 'none', width: '100%' }}
      />
      <small className="signature-hint">
        Firma con el dedo, lápiz táctil o ratón. También puedes adjuntar una imagen de tu firma.
      </small>
    </div>
  );
}
