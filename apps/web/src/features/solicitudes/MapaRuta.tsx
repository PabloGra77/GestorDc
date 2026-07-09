import { useEffect, useMemo, useRef } from 'react';
import { buscarCiudad, ciudadToSVG, getClima, type ClimaInfo, type CondicionClima } from './colombiaData';

/*
 * Colombia outline — 32 puntos geográficos reales (viewBox 0 0 360 480)
 * Fórmula: x = (lng + 79) / 12.1 * 360  |  y = (12.5 - lat) / 16.7 * 480
 *
 * Sentido horario desde Punta Gallinas (extremo norte):
 *   → borde Venezuela (sur) → borde Brasil (SO) → borde Perú (NO) →
 *   → borde Ecuador (O) → costa Pacífico (N) → costa Caribe (E) → cierre
 */
const COLOMBIA_PATH =
  'M 219,1 ' +                // Punta Gallinas  12.47°N -71.65°W
  'L 228,19 ' +               // inicio borde Venezuela  11.7°N -71.3°W
  'L 208,72 ' +               // borde Venezuela medio  10°N -72°W
  'L 193,129 ' +              // Cúcuta / Norte Santander  8°N -72.5°W
  'L 247,158 ' +              // Arauca  7°N -70.7°W
  'L 330,180 ' +              // Puerto Carreño / Vichada  6.2°N -67.9°W
  'L 357,236 ' +              // borde Venezuela E  4°N -67°W
  'L 357,302 ' +              // esquina Brasil-Venezuela  2°N -67°W
  'L 295,347 ' +              // borde Brasil  0.5°N -69.1°W
  'L 270,480 ' +              // Leticia / esquina Perú-Brasil  -4.2°S -69.9°W
  'L 196,432 ' +              // borde Perú medio  -2°S -72.9°W
  'L 150,380 ' +              // borde Perú O  -0.5°S -75.3°W
  'L 113,359 ' +              // esquina Perú-Ecuador  0°N -75.5°W
  'L 110,332 ' +              // borde Ecuador E  1°N -75.5°W
  'L 41,335 ' +               // Ipiales / borde Ecuador  0.9°N -77.6°W
  'L 12,326 ' +               // borde Ecuador-Pacífico  1°N -78.6°W
  'L 7,308 ' +                // Tumaco  1.8°N -78.75°W
  'L 26,278 ' +               // costa Pacífico  3°N -78.2°W
  'L 57,248 ' +               // Buenaventura  3.88°N -77.08°W
  'L 50,212 ' +               // costa Pacífico  5.4°N -77.4°W
  'L 42,201 ' +               // Cabo Corrientes  5.6°N -77.6°W
  'L 48,181 ' +               // Bahía Solano  6.2°N -77.4°W
  'L 48,152 ' +               // borde Panamá  7.2°N -77.4°W
  'L 60,132 ' +               // Golfo de Urabá S  8.1°N -76.8°W
  'L 66,118 ' +               // Golfo de Urabá N  8.5°N -76.6°W
  'L 78,98 ' +                // Arboletes  8.85°N -76.3°W
  'L 104,61 ' +               // Cartagena  10.4°N -75.5°W
  'L 125,44 ' +               // Barranquilla  11°N -74.8°W
  'L 148,39 ' +               // Santa Marta  11.24°N -74.2°W
  'L 182,28 ' +               // Riohacha  11.54°N -72.9°W
  'L 202,9 ' +                // Cabo de la Vela  12.2°N -72.2°W
  'Z';                        // cierre → Punta Gallinas

/* ─── Overlay de clima en todo el módulo ─────────────────── */
function WeatherOverlay({ condicion }: { condicion: CondicionClima | undefined }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !condicion) return;

    const esLluvia   = condicion === 'lluvioso';
    const esTormenta = condicion === 'tormenta';
    if (!esLluvia && !esTormenta) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    /* gotas */
    type Gota = { x: number; y: number; len: number; spd: number; op: number };
    const gotas: Gota[] = Array.from({ length: esTormenta ? 180 : 90 }, () => ({
      x:   Math.random() * window.innerWidth,
      y:   Math.random() * window.innerHeight,
      len: esTormenta ? 18 + Math.random() * 14 : 10 + Math.random() * 10,
      spd: esTormenta ? 18 + Math.random() * 12 : 10 + Math.random() * 8,
      op:  0.25 + Math.random() * 0.25,
    }));

    const color = esTormenta ? '140,200,230' : '170,215,245';

    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      gotas.forEach((g) => {
        ctx.beginPath();
        ctx.moveTo(g.x, g.y);
        ctx.lineTo(g.x - g.len * 0.18, g.y + g.len);
        ctx.strokeStyle = `rgba(${color},${g.op})`;
        ctx.lineWidth   = esTormenta ? 1.4 : 1;
        ctx.stroke();
        g.y += g.spd;
        if (g.y > canvas.height + g.len) {
          g.y = -g.len;
          g.x = Math.random() * canvas.width;
        }
      });
      animRef.current = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [condicion]);

  if (condicion !== 'lluvioso' && condicion !== 'tormenta') return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9998,
        opacity: 1,
      }}
    />
  );
}

/* ─── Tarjeta de clima ─────────────────────────────────────── */
function ClimaCard({ label, clima }: { label: string; clima: ClimaInfo }) {
  return (
    <div className={`mapa-clima-card clima-${clima.condicion}`}>
      <div className="mapa-clima-emoji">{clima.emoji}</div>
      <div className="mapa-clima-body">
        <div className="mapa-clima-label">{label}</div>
        <div className="mapa-clima-temp">{clima.temperatura}°C</div>
        <div className="mapa-clima-desc">{clima.descripcion}</div>
        <div className="mapa-clima-meta">
          💧 {clima.humedad}% · 💨 {clima.viento} km/h
        </div>
      </div>
    </div>
  );
}

/* ─── Info aeropuerto/terminal ─────────────────────────────── */
function InfraestructuraTag({ ciudad }: { ciudad: string }) {
  const c = buscarCiudad(ciudad);
  if (!c) return null;
  return (
    <div className="mapa-infra">
      {c.aeropuerto && (
        <span className="mapa-infra-tag mapa-infra-aero">
          ✈ {c.aeropuerto}{c.iata ? ` (${c.iata})` : ''}
        </span>
      )}
      {c.terminal && (
        <span className="mapa-infra-tag mapa-infra-term">
          🚌 {c.terminal}
        </span>
      )}
      {!c.aeropuerto && !c.terminal && (
        <span className="mapa-infra-tag mapa-infra-none">
          Sin aeropuerto propio
        </span>
      )}
    </div>
  );
}

/* ─── Componente principal ─────────────────────────────────── */
interface MapaRutaProps {
  origen: string;
  destino: string;
  fecha: string;
}

export function MapaRuta({ origen, destino, fecha }: MapaRutaProps) {
  const ciudadO = useMemo(() => buscarCiudad(origen),  [origen]);
  const ciudadD = useMemo(() => buscarCiudad(destino), [destino]);

  const climaO = useMemo(() => ciudadO && fecha ? getClima(ciudadO, fecha) : null, [ciudadO, fecha]);
  const climaD = useMemo(() => ciudadD && fecha ? getClima(ciudadD, fecha) : null, [ciudadD, fecha]);

  const condicionDom: CondicionClima | undefined = climaD?.condicion ?? climaO?.condicion;

  /* Cambia el fondo de la página según el clima */
  useEffect(() => {
    if (condicionDom) document.body.dataset.weather = condicionDom;
    return () => { delete document.body.dataset.weather; };
  }, [condicionDom]);

  const [ox, oy] = ciudadO ? ciudadToSVG(ciudadO.lat, ciudadO.lng) : [0, 0];
  const [dx, dy] = ciudadD ? ciudadToSVG(ciudadD.lat, ciudadD.lng) : [0, 0];

  const midX = (ox + dx) / 2;
  const midY = (oy + dy) / 2 - Math.abs(dx - ox) * 0.35;

  if (!ciudadO && !ciudadD) return null;

  const esSanAndres = origen === 'San Andrés' || destino === 'San Andrés';

  return (
    <>
      {/* Overlay de lluvia — cubre toda la pantalla */}
      <WeatherOverlay condicion={condicionDom} />

      <div className={`mapa-ruta-wrapper mapa-bg-${condicionDom ?? 'default'}`}>
        {/* Tarjetas de clima */}
        <div className="mapa-clima-row">
          {climaO && <ClimaCard label={origen}  clima={climaO} />}
          {climaO && climaD && <div className="mapa-clima-sep">→</div>}
          {climaD && <ClimaCard label={destino} clima={climaD} />}
        </div>

        {/* Mapa SVG — solo muestra la geografía y la ruta */}
        <div className="mapa-svg-container">
          <svg viewBox="0 0 360 480" className="mapa-svg" aria-label="Mapa de Colombia">
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="shadow">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.4" />
              </filter>
              <linearGradient id="mapGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor="#1a3a28" />
                <stop offset="100%" stopColor="#0d2a1c" />
              </linearGradient>
            </defs>

            {/* Fondo */}
            <rect width="360" height="480" fill="#0a1a28" />

            {/* Colombia outline */}
            <path d={COLOMBIA_PATH}
              fill="url(#mapGrad)"
              stroke="#3a7a5a"
              strokeWidth="1.5"
              filter="url(#shadow)"
            />

            {/* Ciudades secundarias */}
            {[
              [147,224],[102,180],[74,261],[125,44],[104,61],[51,325],
              [175,155],[193,133],[159,240],[112,232],[98,221],[104,214],
              [111,275],[99,229],[71,289],[143,36],[182,28],
            ].map(([cx, cy], i) => (
              <circle key={i} cx={cx} cy={cy} r="2" fill="#52b788" opacity="0.45" />
            ))}

            {/* Ruta curva */}
            {ciudadO && ciudadD && (
              <path
                d={`M ${ox},${oy} Q ${midX},${midY} ${dx},${dy}`}
                fill="none"
                stroke="#FFD700"
                strokeWidth="2.5"
                strokeDasharray="6 4"
                opacity="0.9"
                className="mapa-ruta-linea"
                filter="url(#glow)"
              />
            )}

            {/* Marcador origen */}
            {ciudadO && (
              <g filter="url(#glow)">
                <circle cx={ox} cy={oy} r="10" fill="#4CAF50" opacity="0.2" className="mapa-pulse" />
                <circle cx={ox} cy={oy} r="6"  fill="#4CAF50" />
                <circle cx={ox} cy={oy} r="3"  fill="#fff" />
                <text x={ox} y={oy - 14} textAnchor="middle" fontSize="9" fill="#fff" fontWeight="bold">
                  {origen.length > 12 ? origen.slice(0, 11) + '…' : origen}
                </text>
              </g>
            )}

            {/* Marcador destino */}
            {ciudadD && (
              <g filter="url(#glow)">
                <circle cx={dx} cy={dy} r="10" fill="#f44336" opacity="0.2" className="mapa-pulse" />
                <circle cx={dx} cy={dy} r="6"  fill="#f44336" />
                <circle cx={dx} cy={dy} r="3"  fill="#fff" />
                <text x={dx} y={dy - 14} textAnchor="middle" fontSize="9" fill="#fff" fontWeight="bold">
                  {destino.length > 12 ? destino.slice(0, 11) + '…' : destino}
                </text>
              </g>
            )}

            {/* San Andrés — isla offshore */}
            {esSanAndres && (
              <g>
                <rect x="5" y="5" width="95" height="32" rx="6" fill="#1565C0" opacity="0.85" />
                <text x="52" y="17" textAnchor="middle" fontSize="8" fill="#fff" fontWeight="bold">🏝 San Andrés</text>
                <text x="52" y="29" textAnchor="middle" fontSize="7" fill="#90CAF9">Isla en el Caribe</text>
              </g>
            )}

            {/* Etiqueta ruta */}
            {ciudadO && ciudadD && (
              <g>
                <rect x={midX - 34} y={midY - 12} width="68" height="18" rx="9" fill="rgba(0,0,0,0.6)" />
                <text x={midX} y={midY + 1} textAnchor="middle" fontSize="9" fill="#FFD700" fontWeight="bold">
                  ✈ {origen.slice(0, 3).toUpperCase()} → {destino.slice(0, 3).toUpperCase()}
                </text>
              </g>
            )}

            {/* Leyenda */}
            <g transform="translate(8, 455)">
              <circle cx="8"  cy="8" r="5" fill="#4CAF50" />
              <text x="16" y="12" fontSize="8" fill="#ccc">Origen</text>
              <circle cx="60" cy="8" r="5" fill="#f44336" />
              <text x="68" y="12" fontSize="8" fill="#ccc">Destino</text>
            </g>
          </svg>
        </div>

        {/* Infraestructura */}
        <div className="mapa-infra-row">
          {ciudadO && (
            <div className="mapa-infra-ciudad">
              <div className="mapa-infra-ciudad-nombre">📍 {origen}</div>
              <InfraestructuraTag ciudad={origen} />
            </div>
          )}
          {ciudadD && (
            <div className="mapa-infra-ciudad">
              <div className="mapa-infra-ciudad-nombre">📍 {destino}</div>
              <InfraestructuraTag ciudad={destino} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
