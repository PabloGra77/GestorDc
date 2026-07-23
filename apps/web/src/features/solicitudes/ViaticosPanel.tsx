import { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/http/api';
import { formatearMiles } from '../../utils/numeroALetras';
import { SignaturePad } from '../../components/SignaturePad';
import { DEPTOS } from './colombiaData';
import { MapaRuta } from './MapaRuta';

/* ─── Tipos ─────────────────────────────────────────────────── */
interface ViajeEspecifico {
  origen: string;
  destino: string;
  tipo: 'aereo' | 'terrestre';
  precio?: number;              /* campo legado */
  precioTransporte?: number;
  precioDesayuno?: number;
  precioAlmuerzo?: number;
  precioCena?: number;
  precioHospedaje?: number;
}

interface TarifasViaticos {
  precioAereo: number;
  precioTerrestre: number;
  precioDesayuno: number;
  precioAlmuerzo: number;
  precioCena: number;
  precioHospedaje: number;
  viajesEspecificos: ViajeEspecifico[];
}

interface TarifasRuta {
  especifico: boolean;
  precioTransporte: number;
  precioDesayuno: number;
  precioAlmuerzo: number;
  precioCena: number;
  precioHospedaje: number;
}

interface UsuarioSugerido { id: number; nombreCompleto: string; rol: string; area: string | null; }

/* ─── Helper: todas las tarifas para una ruta ─────────────── */
function getTarifasRuta(
  tarifas: TarifasViaticos | null,
  tipo: 'aereo' | 'terrestre',
  origen: string,
  destino: string,
): TarifasRuta {
  const gen: TarifasRuta = {
    especifico: false,
    precioTransporte: tipo === 'aereo' ? (tarifas?.precioAereo ?? 0) : (tarifas?.precioTerrestre ?? 0),
    precioDesayuno:  tarifas?.precioDesayuno  ?? 0,
    precioAlmuerzo:  tarifas?.precioAlmuerzo  ?? 0,
    precioCena:      tarifas?.precioCena       ?? 0,
    precioHospedaje: tarifas?.precioHospedaje  ?? 0,
  };
  if (!tarifas || !origen || !destino) return gen;
  const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const match = (tarifas.viajesEspecificos ?? []).find(
    (v) => v.tipo === tipo && norm(v.origen) === norm(origen) && norm(v.destino) === norm(destino),
  );
  if (!match) return gen;
  return {
    especifico: true,
    precioTransporte: match.precioTransporte ?? match.precio ?? gen.precioTransporte,
    precioDesayuno:   match.precioDesayuno  ?? gen.precioDesayuno,
    precioAlmuerzo:   match.precioAlmuerzo  ?? gen.precioAlmuerzo,
    precioCena:       match.precioCena       ?? gen.precioCena,
    precioHospedaje:  match.precioHospedaje  ?? gen.precioHospedaje,
  };
}

/* ─── Bloque de tipo de transporte ─────────────────────────── */
function TipoTransporteBloque({
  titulo, tipo, onTipo, tarifasRuta, tarifasCargadas,
}: {
  titulo: string;
  tipo: 'aereo' | 'terrestre';
  onTipo: (v: 'aereo' | 'terrestre') => void;
  tarifasRuta: TarifasRuta;
  tarifasCargadas: boolean;
}) {
  return (
    <div className="viatico-tiquete-bloque">
      <div className="viatico-tiquete-titulo">{titulo}</div>
      <div className="leg-field">
        <label>Tipo de transporte *</label>
        <div className="viaticos-tipo-transport-row">
          <button type="button" className={`viatico-tr-btn${tipo === 'aereo' ? ' selected' : ''}`} onClick={() => onTipo('aereo')}>
            ✈ Aéreo
          </button>
          <button type="button" className={`viatico-tr-btn${tipo === 'terrestre' ? ' selected' : ''}`} onClick={() => onTipo('terrestre')}>
            🚌 Terrestre
          </button>
        </div>
      </div>
      <div className="viatico-tarifa-fija-display">
        <span>{tarifasRuta.especifico ? 'Precio de ruta específica:' : `Tarifa ${tipo === 'aereo' ? 'aéreo' : 'terrestre'}:`}</span>
        <strong>{tarifasCargadas ? `$${formatearMiles(tarifasRuta.precioTransporte)} COP` : 'Cargando…'}</strong>
        {tarifasRuta.especifico && <span className="viatico-ruta-badge">Ruta configurada</span>}
      </div>
    </div>
  );
}

/* ─── Panel Viáticos ────────────────────────────────────────── */
export function ViaticosPanel({ onCreada, areaId }: { onCreada?: (info: { id: number; numeroRadicado: string }) => void; areaId?: number }) {
  const [paso, setPaso] = useState<1 | 2 | 3 | 4 | 5>(1);

  const [tarifas, setTarifas] = useState<TarifasViaticos | null>(null);

  /* Paso 1 */
  const [autorizadorInput, setAutorizadorInput] = useState('');
  const [autorizadorId, setAutorizadorId] = useState(0);
  const [autorizadorNombre, setAutorizadorNombre] = useState('');
  const [usuarios, setUsuarios] = useState<UsuarioSugerido[]>([]);
  const [showSugeridos, setShowSugeridos] = useState(false);
  const [motivoViaje, setMotivoViaje] = useState('');

  /* Paso 2 */
  const [ciudadOrigen, setCiudadOrigen] = useState('');
  const [ciudadDestino, setCiudadDestino] = useState('');
  const [deptoOrigen, setDeptoOrigen] = useState('');
  const [deptoDestino, setDeptoDestino] = useState('');
  const [esIdaVuelta, setEsIdaVuelta] = useState(true);
  const [fechaIda, setFechaIda] = useState('');
  const [fechaRegreso, setFechaRegreso] = useState('');

  /* Paso 3 — tipo de transporte */
  const [tipoTrIda, setTipoTrIda] = useState<'aereo' | 'terrestre'>('aereo');
  const [tipoTrVuelta, setTipoTrVuelta] = useState<'aereo' | 'terrestre'>('aereo');

  /* Paso 4 — hospedaje */
  const [tieneHospedaje, setTieneHospedaje] = useState(false);
  const [hotelNombre, setHotelNombre] = useState('');
  const [hotelEntrada, setHotelEntrada] = useState('');
  const [hotelSalida, setHotelSalida] = useState('');

  /* Paso 4 — alimentación */
  const [diasDesayuno, setDiasDesayuno] = useState('');
  const [diasAlmuerzo, setDiasAlmuerzo] = useState('');
  const [diasCena, setDiasCena] = useState('');

  /* Paso 5 */
  const [firma, setFirma] = useState('');

  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.get<TarifasViaticos>('/tarifas-viaticos').then((r) => setTarifas(r.data)).catch(() => {});
    api.get<UsuarioSugerido[]>('/usuarios/nombres').then((r) => setUsuarios(r.data)).catch(() => {});
  }, []);

  const sugeridos = useMemo(() => {
    const term = autorizadorInput.trim().toLowerCase();
    if (term.length < 2) return [];
    return usuarios.filter((u) => u.nombreCompleto.toLowerCase().includes(term)).slice(0, 8);
  }, [autorizadorInput, usuarios]);

  function elegirAutorizador(u: UsuarioSugerido) {
    setAutorizadorId(u.id);
    setAutorizadorNombre(u.nombreCompleto);
    setAutorizadorInput(u.nombreCompleto);
    setShowSugeridos(false);
  }

  /* Tarifas según ruta (específica si existe, si no general) */
  const tarifasIda    = getTarifasRuta(tarifas, tipoTrIda,    ciudadOrigen, ciudadDestino);
  const tarifasVuelta = getTarifasRuta(tarifas, tipoTrVuelta, ciudadDestino, ciudadOrigen);

  const precioTrIda    = tarifasIda.precioTransporte;
  const precioTrVuelta = tarifasVuelta.precioTransporte;

  const totalTransporte = useMemo(() => precioTrIda + (esIdaVuelta ? precioTrVuelta : 0),
    [precioTrIda, precioTrVuelta, esIdaVuelta]);

  const noches = useMemo(() => {
    if (!tieneHospedaje || !hotelEntrada || !hotelSalida) return 0;
    return Math.max(0, Math.round((new Date(hotelSalida).getTime() - new Date(hotelEntrada).getTime()) / 86400000));
  }, [tieneHospedaje, hotelEntrada, hotelSalida]);

  const precioHospedaje = tarifasIda.precioHospedaje;
  const totalHospedaje  = useMemo(() => tieneHospedaje ? precioHospedaje * noches : 0,
    [tieneHospedaje, precioHospedaje, noches]);

  const precioDesayuno = tarifasIda.precioDesayuno;
  const precioAlmuerzo = tarifasIda.precioAlmuerzo;
  const precioCena     = tarifasIda.precioCena;

  const totalComidas = useMemo(() =>
    (parseInt(diasDesayuno) || 0) * precioDesayuno
  + (parseInt(diasAlmuerzo) || 0) * precioAlmuerzo
  + (parseInt(diasCena)     || 0) * precioCena,
    [diasDesayuno, diasAlmuerzo, diasCena, precioDesayuno, precioAlmuerzo, precioCena]);

  const totalGeneral = useMemo(() => totalTransporte + totalHospedaje + totalComidas,
    [totalTransporte, totalHospedaje, totalComidas]);

  function validarPaso(): string {
    if (paso === 1) {
      if (!autorizadorId) return 'Selecciona el autorizador del viaje de la lista';
      if (autorizadorInput.trim() !== autorizadorNombre) return 'Selecciona el autorizador de la lista de sugerencias';
      if (!motivoViaje.trim()) return 'Describe el motivo o propósito del viaje';
    }
    if (paso === 2) {
      if (!ciudadOrigen) return 'Selecciona la ciudad de origen';
      if (!ciudadDestino) return 'Selecciona la ciudad de destino';
      if (ciudadOrigen === ciudadDestino) return 'Origen y destino deben ser diferentes';
      if (!fechaIda) return 'Indica la fecha de ida';
      if (esIdaVuelta && !fechaRegreso) return 'Indica la fecha de regreso';
      if (esIdaVuelta && fechaRegreso && fechaRegreso < fechaIda) return 'La fecha de regreso debe ser posterior a la de ida';
    }
    if (paso === 4) {
      if (tieneHospedaje) {
        if (!hotelNombre.trim()) return 'Ingresa el nombre del hotel';
        if (!hotelEntrada || !hotelSalida) return 'Ingresa las fechas de entrada y salida del hotel';
      }
    }
    if (paso === 5) {
      if (!firma) return 'La firma digital es obligatoria';
    }
    return '';
  }

  function siguiente() { const e = validarPaso(); if (e) { setErr(e); return; } setErr(''); setPaso((p) => Math.min(5, p + 1) as 1|2|3|4|5); }
  function anterior() { setErr(''); setPaso((p) => Math.max(1, p - 1) as 1|2|3|4|5); }

  function resetear() {
    setPaso(1);
    setAutorizadorInput(''); setAutorizadorId(0); setAutorizadorNombre(''); setMotivoViaje('');
    setCiudadOrigen(''); setCiudadDestino(''); setDeptoOrigen(''); setDeptoDestino('');
    setFechaIda(''); setFechaRegreso(''); setEsIdaVuelta(true);
    setTipoTrIda('aereo'); setTipoTrVuelta('aereo');
    setTieneHospedaje(false); setHotelNombre(''); setHotelEntrada(''); setHotelSalida('');
    setDiasDesayuno(''); setDiasAlmuerzo(''); setDiasCena('');
    setFirma(''); setMsg('');
  }

  async function enviar() {
    const e = validarPaso();
    if (e) { setErr(e); return; }
    setErr('');
    setEnviando(true);
    try {
      const norm = (s: string) => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
      const tipos = await api.get<Array<{ id: number; slug: string; nombre: string }>>('/tipos');
      const tipo = tipos.data.find((t) => norm(t.slug) === 'viaticos' || norm(t.nombre).includes('viatico'));
      if (!tipo) {
        setErr('No se encontró el tipo "Solicitud de Viático". El administrador debe verificar que exista.');
        return;
      }

      const tiqueteIda = { tipo: tipoTrIda, valor: String(precioTrIda) };
      const tiqueteVuelta = esIdaVuelta ? { tipo: tipoTrVuelta, valor: String(precioTrVuelta) } : null;

      const r = await api.post<{ id: number; numeroRadicado: string }>('/solicitudes', {
        tipoSolicitudId: tipo.id,
        ...(areaId ? { areaSeleccionadaId: areaId } : {}),
        datos: {
          motivoViaje,
          autorizadorId: String(autorizadorId),
          autorizadorNombre,
          ciudadOrigen,
          ciudadDestino,
          esIdaVuelta: String(esIdaVuelta),
          fechaIda,
          fechaRegreso: esIdaVuelta ? fechaRegreso : '',
          tiqueteIda: JSON.stringify(tiqueteIda),
          tiqueteVuelta: tiqueteVuelta ? JSON.stringify(tiqueteVuelta) : '',
          tieneHospedaje: String(tieneHospedaje),
          hotelNombre: tieneHospedaje ? hotelNombre : '',
          hotelEntrada: tieneHospedaje ? hotelEntrada : '',
          hotelSalida:  tieneHospedaje ? hotelSalida  : '',
          hotelNoches:  tieneHospedaje ? String(noches) : '0',
          hotelValorNoche: tieneHospedaje ? String(precioHospedaje) : '0',
          diasDesayuno, valorDesayuno: String(precioDesayuno),
          diasAlmuerzo, valorAlmuerzo: String(precioAlmuerzo),
          diasCena,     valorCena:     String(precioCena),
          totalTransporte: String(totalTransporte),
          totalHospedaje:  String(totalHospedaje),
          totalComidas:    String(totalComidas),
          totalGeneral:    String(totalGeneral),
        },
        documentos: {},
        firmas: { profesional: firma },
      });
      setMsg(`¡Viático radicado exitosamente! Radicado: ${r.data.numeroRadicado}`);
      onCreada?.({ id: r.data.id, numeroRadicado: r.data.numeroRadicado });
    } catch (ex: unknown) {
      const m = (ex as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErr(m || 'Error al enviar la solicitud. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  const PASOS = ['Autorización', 'Detalles del viaje', 'Transporte', 'Hospedaje y comidas', 'Resumen y firma'];

  if (msg) {
    return (
      <div className="leg-success card-surface">
        <div className="leg-success-icon">✓</div>
        <h3>Viático radicado</h3>
        <p>{msg}</p>
        <p className="leg-success-note">Puedes hacer seguimiento en <strong>Mis solicitudes</strong>.</p>
        <button type="button" className="admin-primary-button" onClick={resetear}>Nueva solicitud</button>
      </div>
    );
  }

  return (
    <div className="leg-panel">
      {/* Stepper */}
      <div className="leg-stepper" role="list">
        {PASOS.map((label, i) => (
          <div key={i} role="listitem" className={`leg-step${paso === i + 1 ? ' active' : ''}${paso > i + 1 ? ' done' : ''}`}>
            <span className="leg-step-num">{paso > i + 1 ? '✓' : i + 1}</span>
            <span className="leg-step-label">{label}</span>
          </div>
        ))}
      </div>

      {err && <div className="admin-error" role="alert">{err}</div>}

      {/* ── PASO 1: Autorización ── */}
      {paso === 1 && (
        <div className="leg-form card-surface">
          <h3>Autorización del viaje</h3>

          <div className="leg-field">
            <label>Motivo / propósito del viaje *</label>
            <textarea value={motivoViaje} onChange={(e) => setMotivoViaje(e.target.value)}
              rows={2} placeholder="Ej: Visita a cliente, capacitación, reunión con proveedor…" />
          </div>

          <div className="leg-field leg-autocomplete-wrap" style={{ marginTop: 16 }}>
            <label>¿Quién autorizó el viaje? *</label>
            <input type="text" value={autorizadorInput}
              onChange={(e) => { setAutorizadorInput(e.target.value); setAutorizadorId(0); setAutorizadorNombre(''); setShowSugeridos(true); }}
              onFocus={() => setShowSugeridos(true)}
              onBlur={() => setTimeout(() => setShowSugeridos(false), 150)}
              placeholder="Escribe el nombre del director o gerente que autorizó…"
              autoComplete="off" />
            {autorizadorId > 0 && <span className="leg-autorizado-ok">✓ {autorizadorNombre}</span>}
            {showSugeridos && sugeridos.length > 0 && (
              <div className="leg-sugeridos" role="listbox">
                {sugeridos.map((u) => (
                  <button key={u.id} type="button" className="leg-sugerido-item" onMouseDown={() => elegirAutorizador(u)}>
                    <strong>{u.nombreCompleto}</strong>
                    <span>{u.rol}{u.area ? ` · ${u.area}` : ''}</span>
                  </button>
                ))}
              </div>
            )}
            {showSugeridos && autorizadorInput.length >= 2 && sugeridos.length === 0 && (
              <div className="leg-sugeridos">
                <span className="leg-sin-resultados">Sin coincidencias para "{autorizadorInput}"</span>
              </div>
            )}
          </div>

          <div className="leg-actions">
            <button type="button" className="admin-primary-button" onClick={siguiente}>
              Continuar → Detalles del viaje
            </button>
          </div>
        </div>
      )}

      {/* ── PASO 2: Detalles del viaje ── */}
      {paso === 2 && (
        <div className="leg-form card-surface">
          <h3>Detalles del viaje</h3>

          <div className="leg-field">
            <label>Tipo de viaje *</label>
            <div className="leg-radio-group">
              <label className="leg-radio-item">
                <input type="radio" name="esIdaVuelta" checked={esIdaVuelta} onChange={() => setEsIdaVuelta(true)} />
                <strong>Ida y vuelta</strong>
              </label>
              <label className="leg-radio-item">
                <input type="radio" name="esIdaVuelta" checked={!esIdaVuelta} onChange={() => { setEsIdaVuelta(false); setFechaRegreso(''); }} />
                <strong>Solo ida</strong>
              </label>
            </div>
          </div>

          <div className="viaje-ciudad-grid">
            <div className="viaje-ciudad-bloque">
              <div className="leg-field">
                <label>Departamento de origen *</label>
                <select value={deptoOrigen} onChange={(e) => { setDeptoOrigen(e.target.value); setCiudadOrigen(''); }} required>
                  <option value="">— Departamento —</option>
                  {DEPTOS.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                </select>
              </div>
              <div className="leg-field">
                <label>Ciudad de origen *</label>
                <select value={ciudadOrigen} onChange={(e) => setCiudadOrigen(e.target.value)} required disabled={!deptoOrigen}>
                  <option value="">— Ciudad —</option>
                  {(DEPTOS.find((d) => d.id === deptoOrigen)?.ciudades ?? []).map((c) => (
                    <option key={c.nombre} value={c.nombre}>{c.nombre}{c.iata ? ` (${c.iata})` : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="viaje-ciudad-bloque">
              <div className="leg-field">
                <label>Departamento de destino *</label>
                <select value={deptoDestino} onChange={(e) => { setDeptoDestino(e.target.value); setCiudadDestino(''); }} required>
                  <option value="">— Departamento —</option>
                  {DEPTOS.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                </select>
              </div>
              <div className="leg-field">
                <label>Ciudad de destino *</label>
                <select value={ciudadDestino} onChange={(e) => setCiudadDestino(e.target.value)} required disabled={!deptoDestino}>
                  <option value="">— Ciudad —</option>
                  {(DEPTOS.find((d) => d.id === deptoDestino)?.ciudades ?? []).map((c) => (
                    <option key={c.nombre} value={c.nombre}>{c.nombre}{c.iata ? ` (${c.iata})` : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="leg-field">
              <label>Fecha de ida *</label>
              <input type="date" value={fechaIda} onChange={(e) => setFechaIda(e.target.value)} required />
            </div>
            {esIdaVuelta && (
              <div className="leg-field">
                <label>Fecha de regreso *</label>
                <input type="date" value={fechaRegreso} min={fechaIda}
                  onChange={(e) => setFechaRegreso(e.target.value)} required />
              </div>
            )}
          </div>

          {(ciudadOrigen || ciudadDestino) && (
            <MapaRuta origen={ciudadOrigen} destino={ciudadDestino} fecha={fechaIda || new Date().toISOString().slice(0, 10)} />
          )}

          <div className="leg-actions">
            <button type="button" className="admin-ghost-button" onClick={anterior}>← Atrás</button>
            <button type="button" className="admin-primary-button" onClick={siguiente}>
              Continuar → Transporte
            </button>
          </div>
        </div>
      )}

      {/* ── PASO 3: Transporte ── */}
      {paso === 3 && (
        <div className="leg-form card-surface">
          <h3>Transporte</h3>
          <p className="leg-nota">Selecciona el tipo de transporte. Las tarifas están configuradas por el administrador.</p>

          {!tarifas && <p className="admin-help-text">Cargando tarifas…</p>}
          {tarifas && (tarifas.precioAereo === 0 && tarifas.precioTerrestre === 0) && (
            <div className="viatico-anticipo-aviso">
              El administrador aún no ha configurado las tarifas de viáticos. Los valores aparecerán en $0.
            </div>
          )}

          <TipoTransporteBloque
            titulo={esIdaVuelta ? '🛫 Ida' : '🛫 Tiquete'}
            tipo={tipoTrIda}
            onTipo={setTipoTrIda}
            tarifasRuta={tarifasIda}
            tarifasCargadas={tarifas !== null}
          />

          {esIdaVuelta && (
            <TipoTransporteBloque
              titulo="🛬 Regreso"
              tipo={tipoTrVuelta}
              onTipo={setTipoTrVuelta}
              tarifasRuta={tarifasVuelta}
              tarifasCargadas={tarifas !== null}
            />
          )}

          {totalTransporte > 0 && (
            <div className="viatico-total-linea">
              ✈ Total transporte: <strong>${formatearMiles(totalTransporte)} COP</strong>
            </div>
          )}

          <div className="leg-actions">
            <button type="button" className="admin-ghost-button" onClick={anterior}>← Atrás</button>
            <button type="button" className="admin-primary-button" onClick={siguiente}>
              Continuar → Hospedaje y comidas
            </button>
          </div>
        </div>
      )}

      {/* ── PASO 4: Hospedaje y alimentación ── */}
      {paso === 4 && (
        <div className="leg-form card-surface">
          <h3>Hospedaje y alimentación</h3>
          <p className="leg-nota">Indica los días y noches estimados. Los valores son las tarifas fijas configuradas.</p>

          {/* HOSPEDAJE */}
          <div className="viaticos-seccion-titulo">🏨 Hospedaje</div>
          <div className="leg-field">
            <label className="viaticos-check-label">
              <input type="checkbox" checked={tieneHospedaje} onChange={(e) => setTieneHospedaje(e.target.checked)} />
              El viaje requerirá hospedaje
            </label>
          </div>

          {tieneHospedaje && (
            <>
              <div className="leg-gasto-fields">
                <div className="leg-field">
                  <label>Nombre del hotel *</label>
                  <input type="text" value={hotelNombre} onChange={(e) => setHotelNombre(e.target.value)}
                    placeholder="Ej: Hotel Dann Carlton" required />
                </div>
                <div className="leg-field">
                  <label>Fecha de entrada *</label>
                  <input type="date" value={hotelEntrada} min={fechaIda}
                    onChange={(e) => setHotelEntrada(e.target.value)} required />
                </div>
                <div className="leg-field">
                  <label>Fecha de salida *</label>
                  <input type="date" value={hotelSalida} min={hotelEntrada}
                    onChange={(e) => setHotelSalida(e.target.value)} required />
                </div>
              </div>
              {noches > 0 && (
                <div className="viatico-total-linea">
                  🏨 {noches} noche(s) × ${formatearMiles(precioHospedaje)}/noche = <strong>${formatearMiles(totalHospedaje)}</strong>
                </div>
              )}
              {noches === 0 && hotelEntrada && hotelSalida && (
                <p className="leg-nota" style={{ color: 'var(--error, #c0392b)' }}>La fecha de salida debe ser posterior a la de entrada.</p>
              )}
            </>
          )}

          {/* ALIMENTACIÓN */}
          <div className="viaticos-seccion-titulo" style={{ marginTop: 24 }}>🍽 Alimentación</div>
          <p className="leg-nota">Indica el número de días por tipo de comida. Las tarifas son fijas.</p>

          <div className="viaticos-comidas-grid">
            {([
              { key: 'desayuno', icon: '☀️', label: 'Desayunos', dias: diasDesayuno, setDias: setDiasDesayuno, precio: tarifas?.precioDesayuno ?? 0 },
              { key: 'almuerzo', icon: '🌤',  label: 'Almuerzos', dias: diasAlmuerzo, setDias: setDiasAlmuerzo, precio: tarifas?.precioAlmuerzo ?? 0 },
              { key: 'cena',    icon: '🌙',   label: 'Cenas',     dias: diasCena,     setDias: setDiasCena,     precio: tarifas?.precioCena     ?? 0 },
            ] as Array<{ key: string; icon: string; label: string; dias: string; setDias: (v: string) => void; precio: number }>).map(({ key, icon, label, dias, setDias, precio }) => (
              <div key={key} className="viaticos-comida-item">
                <div className="viaticos-comida-header">
                  <span>{icon}</span>
                  <strong>{label}</strong>
                </div>
                <div className="viaticos-comida-inputs">
                  <input type="number" min="0" max="30" value={dias} onChange={(e) => setDias(e.target.value)} placeholder="Días" />
                  <span className="viaticos-comida-x">× ${formatearMiles(precio)}/día</span>
                </div>
                {(parseInt(dias) || 0) > 0 && precio > 0 && (
                  <div className="viaticos-comida-subtotal">
                    = ${formatearMiles((parseInt(dias) || 0) * precio)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {totalComidas > 0 && (
            <div className="viatico-total-linea">
              🍽 Total alimentación: <strong>${formatearMiles(totalComidas)}</strong>
            </div>
          )}

          <div className="leg-actions">
            <button type="button" className="admin-ghost-button" onClick={anterior}>← Atrás</button>
            <button type="button" className="admin-primary-button" onClick={siguiente}>
              Continuar → Resumen y firma
            </button>
          </div>
        </div>
      )}

      {/* ── PASO 5: Resumen y firma ── */}
      {paso === 5 && (
        <div className="leg-form card-surface">
          <h3>Resumen y firma</h3>

          <div className="leg-resumen-final">
            <h4>Autorización</h4>
            <div className="leg-resumen-row"><span>Autorizado por:</span> <strong>{autorizadorNombre}</strong></div>
            <div className="leg-resumen-row"><span>Motivo:</span> <strong>{motivoViaje}</strong></div>

            <h4>Ruta</h4>
            <div className="leg-resumen-row">
              <span>Trayecto:</span>
              <strong>{ciudadOrigen} → {ciudadDestino}{esIdaVuelta ? ' (ida y vuelta)' : ' (solo ida)'}</strong>
            </div>
            <div className="leg-resumen-row"><span>Fecha ida:</span> <strong>{fechaIda}</strong></div>
            {esIdaVuelta && <div className="leg-resumen-row"><span>Fecha regreso:</span> <strong>{fechaRegreso}</strong></div>}

            <h4>Transporte</h4>
            <div className="leg-resumen-row">
              <span>Ida:</span>
              <strong>{tipoTrIda === 'aereo' ? '✈ Aéreo' : '🚌 Terrestre'} — ${formatearMiles(precioTrIda)}</strong>
            </div>
            {esIdaVuelta && (
              <div className="leg-resumen-row">
                <span>Regreso:</span>
                <strong>{tipoTrVuelta === 'aereo' ? '✈ Aéreo' : '🚌 Terrestre'} — ${formatearMiles(precioTrVuelta)}</strong>
              </div>
            )}

            {tieneHospedaje && (
              <>
                <h4>Hospedaje</h4>
                <div className="leg-resumen-row"><span>Hotel:</span> <strong>{hotelNombre}</strong></div>
                <div className="leg-resumen-row">
                  <span>Costo:</span>
                  <strong>{noches} noche(s) × ${formatearMiles(precioHospedaje)} = ${formatearMiles(totalHospedaje)}</strong>
                </div>
              </>
            )}

            {totalComidas > 0 && (
              <>
                <h4>Alimentación</h4>
                {(parseInt(diasDesayuno) || 0) > 0 && <div className="leg-resumen-row"><span>Desayunos:</span> <strong>{diasDesayuno} × ${formatearMiles(tarifas?.precioDesayuno ?? 0)} = ${formatearMiles((parseInt(diasDesayuno)||0)*(tarifas?.precioDesayuno??0))}</strong></div>}
                {(parseInt(diasAlmuerzo) || 0) > 0 && <div className="leg-resumen-row"><span>Almuerzos:</span> <strong>{diasAlmuerzo} × ${formatearMiles(tarifas?.precioAlmuerzo ?? 0)} = ${formatearMiles((parseInt(diasAlmuerzo)||0)*(tarifas?.precioAlmuerzo??0))}</strong></div>}
                {(parseInt(diasCena)     || 0) > 0 && <div className="leg-resumen-row"><span>Cenas:</span>     <strong>{diasCena}     × ${formatearMiles(tarifas?.precioCena     ?? 0)} = ${formatearMiles((parseInt(diasCena)    ||0)*(tarifas?.precioCena    ??0))}</strong></div>}
              </>
            )}

            <div className="leg-resumen-total-line">
              <span>TOTAL SOLICITADO:</span>
              <strong>${formatearMiles(totalGeneral)} COP</strong>
            </div>
          </div>

          <div className="leg-field">
            <label>Firma del solicitante *</label>
            <p className="leg-nota">Al firmar, declaras que el viaje está autorizado y la información es correcta.</p>
            <SignaturePad value={firma} onChange={setFirma} />
          </div>

          <div className="leg-actions">
            <button type="button" className="admin-ghost-button" onClick={anterior}>← Atrás</button>
            <button type="button" className="admin-primary-button" onClick={enviar} disabled={enviando}>
              {enviando ? 'Enviando…' : 'Solicitar viático'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
