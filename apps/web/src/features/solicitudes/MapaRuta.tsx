import { useMemo } from 'react';
import { buscarCiudad, ciudadToSVG, getClima, type ClimaInfo, type CondicionClima } from './colombiaData';

/* ─── Paths simplificados Colombia (viewBox 0 0 360 480) ── */
const COLOMBIA_PATH =
  'M 70,118 L 60,135 L 50,162 L 44,200 L 40,236 L 38,272 L 42,308 L 54,338 L 66,358 ' +
  'L 78,374 L 95,385 L 115,393 L 148,400 L 188,403 L 225,400 L 258,392 L 285,380 ' +
  'L 298,362 L 305,338 L 308,308 L 316,278 L 326,248 L 336,218 L 344,192 L 348,164 ' +
  'L 340,136 L 328,102 L 320,70 L 312,44 L 302,18 L 288,6 L 268,2 L 248,5 ' +
  'L 218,16 L 192,28 L 165,44 L 140,62 L 118,80 L 96,100 L 80,110 Z';

/* ─── Animación de lluvia (gotas SVG) ──────────────────────── */
function RainLayer({ intensa }: { intensa: boolean }) {
  const drops = useMemo(() => {
    const arr: { x: number; delay: number; dur: number; len: number }[] = [];
    const count = intensa ? 60 : 35;
    for (let i = 0; i < count; i++) {
      arr.push({
        x: (i * 73 + i * i * 3) % 370,
        delay: (i * 137) % 2000 / 1000,
        dur: intensa ? 0.6 + (i % 3) * 0.15 : 0.8 + (i % 4) * 0.2,
        len: intensa ? 14 + (i % 5) * 3 : 10 + (i % 4) * 2,
      });
    }
    return arr;
  }, [intensa]);

  return (
    <g className="mapa-lluvia-layer" opacity="0.7">
      {drops.map((d, i) => (
        <line
          key={i}
          x1={d.x} y1={-10}
          x2={d.x - 3} y2={-10 + d.len}
          stroke={intensa ? '#7ec8e3' : '#a8d4e6'}
          strokeWidth={intensa ? 1.5 : 1}
          className="mapa-gota"
          style={{ animationDelay: `${d.delay}s`, animationDuration: `${d.dur}s` }}
        />
      ))}
    </g>
  );
}

/* ─── Sol animado ──────────────────────────────────────────── */
function SunLayer() {
  return (
    <g className="mapa-sol-layer" transform="translate(310, 55)">
      <circle cx="0" cy="0" r="22" fill="#FFD700" opacity="0.9" className="mapa-sol-centro" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((ang, i) => (
        <line key={i}
          x1={Math.cos(ang * Math.PI / 180) * 28}
          y1={Math.sin(ang * Math.PI / 180) * 28}
          x2={Math.cos(ang * Math.PI / 180) * 38}
          y2={Math.sin(ang * Math.PI / 180) * 38}
          stroke="#FFD700" strokeWidth="3" strokeLinecap="round"
          className="mapa-sol-rayo"
        />
      ))}
    </g>
  );
}

/* ─── Nubes SVG ────────────────────────────────────────────── */
function CloudLayer({ oscuro }: { oscuro?: boolean }) {
  const fill = oscuro ? '#546e7a' : '#b0bec5';
  return (
    <g className="mapa-nubes-layer">
      <ellipse cx="60"  cy="28" rx="38" ry="16" fill={fill} opacity="0.75" className="mapa-nube nube-1" />
      <ellipse cx="88"  cy="22" rx="28" ry="12" fill={fill} opacity="0.7"  className="mapa-nube nube-1" />
      <ellipse cx="250" cy="20" rx="42" ry="17" fill={fill} opacity="0.7"  className="mapa-nube nube-2" />
      <ellipse cx="282" cy="14" rx="30" ry="13" fill={fill} opacity="0.65" className="mapa-nube nube-2" />
      <ellipse cx="155" cy="38" rx="32" ry="12" fill={fill} opacity="0.6"  className="mapa-nube nube-3" />
    </g>
  );
}

/* ─── Relámpagos ───────────────────────────────────────────── */
function LightningLayer() {
  return (
    <g className="mapa-lightning-layer">
      <polyline points="120,60 112,85 122,85 110,115" stroke="#FFE500" strokeWidth="2.5"
        fill="none" strokeLinecap="round" strokeLinejoin="round" className="mapa-rayo" />
      <polyline points="260,45 253,70 262,70 251,98" stroke="#FFE500" strokeWidth="2"
        fill="none" strokeLinecap="round" strokeLinejoin="round" className="mapa-rayo"
        style={{ animationDelay: '0.7s' }} />
    </g>
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

/* ─── Fondo según clima ────────────────────────────────────── */
function bgClass(c?: CondicionClima): string {
  if (!c) return '';
  return `mapa-bg-${c}`;
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

  const [ox, oy] = ciudadO ? ciudadToSVG(ciudadO.lat, ciudadO.lng) : [0, 0];
  const [dx, dy] = ciudadD ? ciudadToSVG(ciudadD.lat, ciudadD.lng) : [0, 0];

  const midX = (ox + dx) / 2;
  const midY = (oy + dy) / 2 - Math.abs(dx - ox) * 0.35;

  const condicionDom: CondicionClima | undefined =
    climaD?.condicion ?? climaO?.condicion;

  if (!ciudadO && !ciudadD) return null;

  const esSanAndres = origen === 'San Andrés' || destino === 'San Andrés';

  return (
    <div className={`mapa-ruta-wrapper ${bgClass(condicionDom)}`}>
      {/* Header clima */}
      <div className="mapa-clima-row">
        {climaO && <ClimaCard label={origen}  clima={climaO} />}
        {climaO && climaD && <div className="mapa-clima-sep">→</div>}
        {climaD && <ClimaCard label={destino} clima={climaD} />}
      </div>

      {/* Mapa SVG */}
      <div className="mapa-svg-container">
        <svg viewBox="0 0 360 480" className="mapa-svg" aria-label="Mapa de Colombia">
          {/* Fondo cielo dinámico */}
          <defs>
            <radialGradient id="skyGrad" cx="50%" cy="0%" r="100%">
              <stop offset="0%"   stopColor={condicionDom === 'soleado' ? '#87CEEB' : condicionDom === 'tormenta' ? '#263238' : '#455a64'} />
              <stop offset="100%" stopColor={condicionDom === 'soleado' ? '#e0f4ff' : condicionDom === 'tormenta' ? '#1a2327' : '#37474f'} />
            </radialGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="shadow">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.3" />
            </filter>
          </defs>

          <rect width="360" height="480" fill="url(#skyGrad)" />

          {/* Efectos de clima */}
          {(condicionDom === 'soleado') && <SunLayer />}
          {(condicionDom === 'parcialmente_nublado') && <><SunLayer /><CloudLayer /></>}
          {(condicionDom === 'nublado') && <CloudLayer oscuro />}
          {(condicionDom === 'lluvioso') && <><CloudLayer oscuro /><RainLayer intensa={false} /></>}
          {(condicionDom === 'tormenta') && <><CloudLayer oscuro /><RainLayer intensa={true} /><LightningLayer /></>}

          {/* Colombia outline */}
          <path d={COLOMBIA_PATH}
            fill={condicionDom === 'tormenta' ? '#2e4a3e' : condicionDom === 'lluvioso' ? '#3a5a4a' : '#2d6a4f'}
            stroke={condicionDom === 'tormenta' ? '#4caf50' : '#52b788'}
            strokeWidth="1.5"
            filter="url(#shadow)"
          />

          {/* Grilla de puntos (ciudades menores) */}
          {[
            [163,242],[113,195],[82,282],[116,66],[139,48],[194,167],[158,39],[215,143],
            [109,239],[115,231],[110,248],[125,251],[122,298],[177,260],[57,351],[190,63],
            [103,116],[201,30],[119,99],[79,313],[186,217],[77,212],[272,168],[218,223],
            [112,339],[381,196],[201,107],[155,325],[63,366],[282,392],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="2" fill="#52b788" opacity="0.5" />
          ))}

          {/* Ruta curva entre ciudades */}
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
              <circle cx={ox} cy={oy} r="10" fill="#4CAF50" opacity="0.25" className="mapa-pulse" />
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
              <circle cx={dx} cy={dy} r="10" fill="#f44336" opacity="0.25" className="mapa-pulse" />
              <circle cx={dx} cy={dy} r="6"  fill="#f44336" />
              <circle cx={dx} cy={dy} r="3"  fill="#fff" />
              <text x={dx} y={dy - 14} textAnchor="middle" fontSize="9" fill="#fff" fontWeight="bold">
                {destino.length > 12 ? destino.slice(0, 11) + '…' : destino}
              </text>
            </g>
          )}

          {/* Nota San Andrés (isla offshore) */}
          {esSanAndres && (
            <g>
              <rect x="5" y="5" width="95" height="32" rx="6" fill="#1565C0" opacity="0.85" />
              <text x="52" y="17" textAnchor="middle" fontSize="8" fill="#fff" fontWeight="bold">🏝 San Andrés</text>
              <text x="52" y="29" textAnchor="middle" fontSize="7" fill="#90CAF9">Isla en el Caribe</text>
            </g>
          )}

          {/* Etiqueta distancia */}
          {ciudadO && ciudadD && (
            <g>
              <rect x={midX - 32} y={midY - 12} width="64" height="18" rx="9"
                fill="rgba(0,0,0,0.55)" />
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
  );
}
