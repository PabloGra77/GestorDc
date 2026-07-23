import { useEffect, useState } from 'react';
import { api } from '../../services/http/api';

interface Tarifas {
  precioAereo: number;
  precioTerrestre: number;
  precioDesayuno: number;
  precioAlmuerzo: number;
  precioCena: number;
  precioHospedaje: number;
}

function fmt(v: number) {
  return v === 0 ? '' : String(v);
}

function parse(s: string) {
  return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
}

export function TarifasViaticosPanel() {
  const [aereo, setAereo] = useState('');
  const [terrestre, setTerrestre] = useState('');
  const [desayuno, setDesayuno] = useState('');
  const [almuerzo, setAlmuerzo] = useState('');
  const [cena, setCena] = useState('');
  const [hospedaje, setHospedaje] = useState('');
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
      })
      .catch(() => setErr('No se pudo cargar la configuración de tarifas.'))
      .finally(() => setCargando(false));
  }, []);

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
        Estos precios los ve el solicitante al momento de diligenciar su solicitud.
      </p>

      {err && <div className="admin-error">{err}</div>}
      {ok && <div className="admin-success">{ok}</div>}

      <section className="leg-config-section">
        <h3>Transporte</h3>
        <div className="tarifa-grid">
          <Campo
            label="Viaje aéreo"
            hint="Valor fijo por trayecto en avión."
            value={aereo}
            onChange={setAereo}
          />
          <Campo
            label="Viaje terrestre"
            hint="Valor fijo por trayecto en bus / carro."
            value={terrestre}
            onChange={setTerrestre}
          />
        </div>
      </section>

      <section className="leg-config-section">
        <h3>Alimentación</h3>
        <div className="tarifa-grid">
          <Campo
            label="Desayuno"
            hint="Valor reconocido por cada desayuno."
            value={desayuno}
            onChange={setDesayuno}
          />
          <Campo
            label="Almuerzo"
            hint="Valor reconocido por cada almuerzo."
            value={almuerzo}
            onChange={setAlmuerzo}
          />
          <Campo
            label="Cena"
            hint="Valor reconocido por cada cena."
            value={cena}
            onChange={setCena}
          />
        </div>
      </section>

      <section className="leg-config-section">
        <h3>Hospedaje</h3>
        <Campo
          label="Valor por noche"
          hint="Tarifa reconocida por cada noche de alojamiento."
          value={hospedaje}
          onChange={setHospedaje}
        />
      </section>

      <div className="leg-config-footer">
        <button type="button" className="admin-primary-button" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar tarifas'}
        </button>
      </div>
    </div>
  );
}
