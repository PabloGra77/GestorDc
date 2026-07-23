import { useEffect, useState } from 'react';
import { api } from '../../services/http/api';

interface ViajeEspecifico {
  origen: string;
  destino: string;
  tipo: 'aereo' | 'terrestre';
  precio: number;
}

interface Tarifas {
  precioAereo: number;
  precioTerrestre: number;
  precioDesayuno: number;
  precioAlmuerzo: number;
  precioCena: number;
  precioHospedaje: number;
  viajesEspecificos: ViajeEspecifico[];
}

function fmt(v: number) { return v === 0 ? '' : String(v); }
function parse(s: string) { return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0; }

export function TarifasViaticosPanel() {
  const [aereo, setAereo] = useState('');
  const [terrestre, setTerrestre] = useState('');
  const [desayuno, setDesayuno] = useState('');
  const [almuerzo, setAlmuerzo] = useState('');
  const [cena, setCena] = useState('');
  const [hospedaje, setHospedaje] = useState('');
  const [viajes, setViajes] = useState<ViajeEspecifico[]>([]);

  /* nuevo viaje */
  const [nOrigen, setNOrigen] = useState('');
  const [nDestino, setNDestino] = useState('');
  const [nTipo, setNTipo] = useState<'aereo' | 'terrestre'>('aereo');
  const [nPrecio, setNPrecio] = useState('');

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  useEffect(() => {
    api.get<Tarifas>('/admin/tarifas-viaticos')
      .then((r) => {
        setAereo(fmt(r.data.precioAereo));
        setTerrestre(fmt(r.data.precioTerrestre));
        setDesayuno(fmt(r.data.precioDesayuno));
        setAlmuerzo(fmt(r.data.precioAlmuerzo));
        setCena(fmt(r.data.precioCena));
        setHospedaje(fmt(r.data.precioHospedaje));
        setViajes(r.data.viajesEspecificos ?? []);
      })
      .catch(() => setErr('No se pudo cargar la configuración de tarifas.'))
      .finally(() => setCargando(false));
  }, []);

  function agregarViaje() {
    const o = nOrigen.trim();
    const d = nDestino.trim();
    if (!o || !d) { setErr('Ingresa origen y destino del viaje.'); return; }
    const p = parse(nPrecio);
    setViajes((prev) => [...prev, { origen: o, destino: d, tipo: nTipo, precio: p }]);
    setNOrigen(''); setNDestino(''); setNTipo('aereo'); setNPrecio('');
    setErr('');
  }

  function eliminarViaje(i: number) {
    setViajes((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function guardar() {
    setErr(''); setOk('');
    setGuardando(true);
    try {
      await api.post('/admin/tarifas-viaticos', {
        precioAereo: parse(aereo),
        precioTerrestre: parse(terrestre),
        precioDesayuno: parse(desayuno),
        precioAlmuerzo: parse(almuerzo),
        precioCena: parse(cena),
        precioHospedaje: parse(hospedaje),
        viajesEspecificos: viajes,
      });
      setOk('Tarifas guardadas correctamente.');
    } catch (ex: unknown) {
      const m = (ex as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErr(m || 'Error al guardar las tarifas.');
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <div className="admin-loading">Cargando tarifas…</div>;

  const Campo = ({
    label, hint, value, onChange,
  }: { label: string; hint: string; value: string; onChange: (v: string) => void }) => (
    <div className="tarifa-campo">
      <label className="tarifa-label">{label}</label>
      <p className="leg-config-hint">{hint}</p>
      <div className="leg-monto-row">
        <span className="leg-monto-prefix">$</span>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          placeholder="0"
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ''))}
        />
      </div>
    </div>
  );

  return (
    <div className="admin-module-content leg-config">
      <h2>Tarifas de Viáticos</h2>
      <p className="leg-config-desc">
        Define los valores fijos que se aplican automáticamente al calcular una solicitud de viático.
        Puedes configurar tarifas generales y también precios específicos por ruta.
      </p>

      {err && <div className="admin-error">{err}</div>}
      {ok && <div className="admin-success">{ok}</div>}

      {/* Tarifas generales */}
      <section className="leg-config-section">
        <h3>Transporte — tarifas generales</h3>
        <p className="leg-config-hint">Se usan cuando no hay un precio configurado para la ruta específica.</p>
        <div className="tarifa-grid">
          <Campo label="Viaje aéreo" hint="Por tiquete." value={aereo} onChange={setAereo} />
          <Campo label="Viaje terrestre" hint="Por tiquete." value={terrestre} onChange={setTerrestre} />
        </div>
      </section>

      {/* Viajes específicos */}
      <section className="leg-config-section">
        <h3>Viajes específicos por ruta</h3>
        <p className="leg-config-hint">
          Si una ruta tiene un precio fijo diferente a la tarifa general, agrégala aquí.
          El formulario usará este precio automáticamente cuando el profesional seleccione esas ciudades.
        </p>

        {viajes.length > 0 && (
          <table className="tarifa-rutas-tabla">
            <thead>
              <tr>
                <th>Origen</th>
                <th>Destino</th>
                <th>Tipo</th>
                <th>Precio</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {viajes.map((v, i) => (
                <tr key={i}>
                  <td>{v.origen}</td>
                  <td>{v.destino}</td>
                  <td>{v.tipo === 'aereo' ? '✈ Aéreo' : '🚌 Terrestre'}</td>
                  <td>${v.precio.toLocaleString('es-CO')}</td>
                  <td>
                    <button type="button" className="tipos-eliminar-btn" onClick={() => eliminarViaje(i)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="tarifa-ruta-form">
          <input
            type="text"
            placeholder="Ciudad origen"
            value={nOrigen}
            onChange={(e) => setNOrigen(e.target.value)}
          />
          <input
            type="text"
            placeholder="Ciudad destino"
            value={nDestino}
            onChange={(e) => setNDestino(e.target.value)}
          />
          <select value={nTipo} onChange={(e) => setNTipo(e.target.value as 'aereo' | 'terrestre')}>
            <option value="aereo">✈ Aéreo</option>
            <option value="terrestre">🚌 Terrestre</option>
          </select>
          <div className="leg-monto-row">
            <span className="leg-monto-prefix">$</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Precio"
              value={nPrecio}
              onChange={(e) => setNPrecio(e.target.value.replace(/[^0-9.,]/g, ''))}
            />
          </div>
          <button type="button" className="admin-ghost-button" onClick={agregarViaje}>
            + Agregar ruta
          </button>
        </div>
      </section>

      {/* Alimentación */}
      <section className="leg-config-section">
        <h3>Alimentación</h3>
        <div className="tarifa-grid">
          <Campo label="Desayuno" hint="Por día." value={desayuno} onChange={setDesayuno} />
          <Campo label="Almuerzo" hint="Por día." value={almuerzo} onChange={setAlmuerzo} />
          <Campo label="Cena" hint="Por día." value={cena} onChange={setCena} />
        </div>
      </section>

      {/* Hospedaje */}
      <section className="leg-config-section">
        <h3>Hospedaje</h3>
        <Campo label="Valor por noche" hint="Tarifa reconocida por cada noche." value={hospedaje} onChange={setHospedaje} />
      </section>

      <div className="leg-config-footer">
        <button type="button" className="admin-primary-button" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar tarifas'}
        </button>
      </div>
    </div>
  );
}
