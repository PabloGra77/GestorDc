import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  createCuentaCobroOpsSolicitud,
  submitCuentaCobroOpsDocumentos,
  verifyCuentaCobroOps,
} from '../../services/radicaciones.service';
import type { RootStackParamList } from '../../navigation';
import { Colors, Radius, Spacing, Typography } from '../../theme';

// ─── Utilidad: número a pesos en letras ────────────────────────────────────────

const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const ONCE_A_DIECINUEVE = ['ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
const DECENAS = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function convertirMenorDeCien(n: number): string {
  if (n === 0) return '';
  if (n < 10) return UNIDADES[n];
  if (n === 10) return 'DIEZ';
  if (n < 20) return ONCE_A_DIECINUEVE[n - 11];
  if (n === 20) return 'VEINTE';
  if (n < 30) return 'VEINTI' + UNIDADES[n - 20];
  const dec = Math.floor(n / 10);
  const uni = n % 10;
  return DECENAS[dec] + (uni !== 0 ? ' Y ' + UNIDADES[uni] : '');
}

function convertirMenorDeMil(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';
  const cen = Math.floor(n / 100);
  const resto = n % 100;
  const parteDecenas = convertirMenorDeCien(resto);
  return CENTENAS[cen] + (parteDecenas ? ' ' + parteDecenas : '');
}

function convertirEnteroALetras(n: number): string {
  if (n === 0) return 'CERO';
  if (n < 0) return 'MENOS ' + convertirEnteroALetras(-n);

  const billones = Math.floor(n / 1_000_000_000);
  const millones = Math.floor((n % 1_000_000_000) / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1_000);
  const resto = n % 1_000;

  const partes: string[] = [];

  if (billones) {
    partes.push(
      billones === 1
        ? 'MIL MILLONES'
        : convertirEnteroALetras(billones) + ' MIL MILLONES',
    );
  }
  if (millones) {
    partes.push(
      millones === 1
        ? 'UN MILLÓN'
        : convertirMenorDeMil(millones) + ' MILLONES',
    );
  }
  if (miles) {
    partes.push(miles === 1 ? 'MIL' : convertirEnteroALetras(miles) + ' MIL');
  }
  if (resto) {
    partes.push(convertirMenorDeMil(resto));
  }

  return partes.join(' ');
}

function numeroAPesosEnLetras(valor: number): string {
  if (isNaN(valor) || valor < 0) return '';
  const entero = Math.floor(valor);
  const centavos = Math.round((valor - entero) * 100);
  const letrasEntero = convertirEnteroALetras(entero);
  const letrasCentavos = centavos > 0 ? ` CON ${String(centavos).padStart(2, '0')}/100` : ' CON 00/100';
  return `${letrasEntero} PESOS${letrasCentavos} M/CTE`;
}

// ─── Constantes del formulario ─────────────────────────────────────────────────

const ERON_OPTIONS = [
  'ERON Fresno',
  'ERON Honda',
  'ERON Ibague',
  'ERON Espinal',
  'ERON Melgar',
  'ERON Chaparral',
];

const DOCUMENTOS_REQUERIDOS = [
  'Cuenta de cobro firmada',
  'RUT',
  'Planilla seguridad social',
];

const FILE_NAME_REGEX = /^[a-zA-Z0-9_\-\.]+$/;

type Turno = { fecha: string; numero: string; eron: string };
type DatosPlantilla = {
  establecimiento: string;
  mesRadicado: string;
  ultimaFechaMes: string;
  nombreAuxiliar: string;
  cedula: string;
  lugarExpedicionCedula: string;
  valorNumero: string;
  valorLetras: string;
  objetoContractual: string;
  fechaInicioContrato: string;
  eps: string;
  nombreCoordinadora: string;
  notaAclaratoria: string;
  telefonoContacto: string;
  correoContacto: string;
  firmaDigitalObligatoria: boolean;
  observaciones: string;
};

const DATOS_PLANTILLA_INIT: DatosPlantilla = {
  establecimiento: '',
  mesRadicado: '',
  ultimaFechaMes: '',
  nombreAuxiliar: '',
  cedula: '',
  lugarExpedicionCedula: '',
  valorNumero: '',
  valorLetras: '',
  objetoContractual: '',
  fechaInicioContrato: '',
  eps: '',
  nombreCoordinadora: '',
  notaAclaratoria: '',
  telefonoContacto: '',
  correoContacto: '',
  firmaDigitalObligatoria: false,
  observaciones: '',
};

type Props = NativeStackScreenProps<RootStackParamList, 'OpsCuentaCobro'>;

type Step = 'verificar' | 'solicitud' | 'documentos' | 'completado';

export function OpsCuentaCobroScreen({ navigation, route }: Props) {
  const radicadoParam = route.params?.radicado ?? '';
  const [step, setStep] = useState<Step>('verificar');

  // Paso 1 — verificar
  const [numeroRadicado, setNumeroRadicado] = useState(radicadoParam);
  const [numeroCc, setNumeroCc] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [errorVerificar, setErrorVerificar] = useState('');
  const [radicadoVerificado, setRadicadoVerificado] = useState<Record<string, unknown> | null>(null);

  // Paso 2 — solicitud
  const [datos, setDatos] = useState<DatosPlantilla>(DATOS_PLANTILLA_INIT);
  const [turnos, setTurnos] = useState<Turno[]>([{ fecha: '', numero: '', eron: ERON_OPTIONS[0] }]);
  const [enviando, setEnviando] = useState(false);
  const [errorSolicitud, setErrorSolicitud] = useState('');
  const [radicadoCreado, setRadicadoCreado] = useState('');

  // Paso 3 — documentos
  const [archivos, setArchivos] = useState<Record<string, string>>(() =>
    Object.fromEntries(DOCUMENTOS_REQUERIDOS.map((d) => [d, ''])),
  );
  const [subiendoDocs, setSubiendoDocs] = useState(false);
  const [errorDocs, setErrorDocs] = useState('');

  // Auto-generar valorLetras cuando cambia valorNumero
  useEffect(() => {
    const num = parseFloat(datos.valorNumero.replace(/[.,]/g, '.'));
    if (!isNaN(num) && num >= 0) {
      setDatos((prev) => ({ ...prev, valorLetras: numeroAPesosEnLetras(num) }));
    } else {
      setDatos((prev) => ({ ...prev, valorLetras: '' }));
    }
  }, [datos.valorNumero]);

  // ─── Paso 1: Verificar radicado ────────────────────────────────────────────

  async function handleVerificar() {
    setErrorVerificar('');
    if (!numeroRadicado.trim() || !numeroCc.trim()) {
      setErrorVerificar('Ingresa el número de radicado y tu número de cédula.');
      return;
    }
    setVerificando(true);
    try {
      const res = await verifyCuentaCobroOps({ numeroRadicado: numeroRadicado.trim(), numeroCc: numeroCc.trim() });
      setRadicadoVerificado(res as unknown as Record<string, unknown>);
    } catch (err) {
      const axErr = err as { response?: { data?: { message?: string } } };
      setErrorVerificar(axErr?.response?.data?.message ?? 'No se encontró el radicado o los datos no coinciden.');
    } finally {
      setVerificando(false);
    }
  }

  // ─── Paso 2: Crear solicitud ───────────────────────────────────────────────

  async function handleEnviarSolicitud() {
    setErrorSolicitud('');
    if (!datos.establecimiento.trim() || !datos.nombreAuxiliar.trim() || !datos.cedula.trim()) {
      setErrorSolicitud('Completa al menos establecimiento, nombre del auxiliar y cédula.');
      return;
    }
    setEnviando(true);
    try {
      const turnosFiltrados = turnos.filter((t) => t.fecha && t.numero);
      const payload = {
        ...datos,
        firmaDigitalObligatoria: datos.firmaDigitalObligatoria,
        turnos: turnosFiltrados,
        documentosRequeridos: DOCUMENTOS_REQUERIDOS,
        canalOrigen: 'mobile' as const,
      };
      const res = await createCuentaCobroOpsSolicitud(payload as Parameters<typeof createCuentaCobroOpsSolicitud>[0]);
      const radicadoNuevo = (res as unknown as { numeroRadicado?: string }).numeroRadicado ?? 'N/A';
      setRadicadoCreado(radicadoNuevo);
      setNumeroRadicado(radicadoNuevo);
      setStep('documentos');
    } catch (err) {
      const axErr = err as { response?: { data?: { message?: string } } };
      setErrorSolicitud(axErr?.response?.data?.message ?? 'No se pudo crear la solicitud. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  // ─── Paso 3: Subir documentos ─────────────────────────────────────────────

  async function handleSubirDocumentos() {
    setErrorDocs('');
    for (const doc of DOCUMENTOS_REQUERIDOS) {
      if (!archivos[doc]?.trim()) {
        setErrorDocs(`Falta el nombre de archivo para: ${doc}`);
        return;
      }
      if (!FILE_NAME_REGEX.test(archivos[doc].trim())) {
        setErrorDocs(`Nombre de archivo inválido para "${doc}". Solo letras, números, guiones, puntos y barras bajas.`);
        return;
      }
    }
    setSubiendoDocs(true);
    try {
      await submitCuentaCobroOpsDocumentos({
        numeroRadicado: radicadoCreado || numeroRadicado,
        numeroCc: datos.cedula || numeroCc,
        documentos: DOCUMENTOS_REQUERIDOS.map((nombre) => ({
          nombre,
          archivo: archivos[nombre].trim(),
        })),
      });
      setStep('completado');
    } catch (err) {
      const axErr = err as { response?: { data?: { message?: string } } };
      setErrorDocs(axErr?.response?.data?.message ?? 'No se pudieron registrar los documentos.');
    } finally {
      setSubiendoDocs(false);
    }
  }

  // ─── Helpers de UI ────────────────────────────────────────────────────────

  function Campo({ label, value, onChange, keyboardType = 'default', placeholder = '', multiline = false }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric' | 'decimal-pad';
    placeholder?: string;
    multiline?: boolean;
  }) {
    return (
      <View style={fieldStyles.group}>
        <Text style={fieldStyles.label}>{label}</Text>
        <TextInput
          style={[fieldStyles.input, multiline && { minHeight: 72, textAlignVertical: 'top' }]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          keyboardType={keyboardType}
          multiline={multiline}
        />
      </View>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Volver</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Cuenta de cobro OPS</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Stepper */}
        <View style={styles.stepper}>
          {(['verificar', 'solicitud', 'documentos', 'completado'] as Step[]).map((s, i) => {
            const steps: Step[] = ['verificar', 'solicitud', 'documentos', 'completado'];
            const current = steps.indexOf(step);
            const idx = steps.indexOf(s);
            const isActive = idx === current;
            const isDone = idx < current;
            return (
              <View key={s} style={styles.stepItem}>
                <View style={[styles.stepDot, isActive && styles.stepDotActive, isDone && styles.stepDotDone]}>
                  <Text style={[styles.stepNumber, (isActive || isDone) && styles.stepNumberActive]}>{i + 1}</Text>
                </View>
                {i < 3 && <View style={[styles.stepLine, isDone && styles.stepLineDone]} />}
              </View>
            );
          })}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* ── STEP: Verificar ─────────────────────────────────────────── */}
          {step === 'verificar' && (
            <View>
              <Text style={styles.stepTitle}>Verificar o solicitar radicado</Text>

              <Campo label="Número de radicado (si ya tienes uno)" value={numeroRadicado} onChange={setNumeroRadicado} placeholder="Ej. RAD-2024-0001" />
              <Campo label="Número de cédula" value={numeroCc} onChange={setNumeroCc} keyboardType="numeric" placeholder="Sin puntos ni espacios" />

              {errorVerificar ? <View style={styles.alertBox}><Text style={styles.alertText}>{errorVerificar}</Text></View> : null}

              {radicadoVerificado && (
                <View style={styles.successBox}>
                  <Text style={styles.successTitle}>Radicado encontrado</Text>
                  {Object.entries(radicadoVerificado).map(([k, v]) => (
                    <Text key={k} style={styles.successRow}><Text style={{ fontWeight: '600' }}>{k}:</Text> {String(v)}</Text>
                  ))}
                </View>
              )}

              <Pressable
                style={({ pressed }) => [styles.primaryButton, pressed && styles.btnPressed, verificando && styles.btnDisabled]}
                onPress={handleVerificar}
                disabled={verificando}
              >
                {verificando ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Verificar radicado</Text>}
              </Pressable>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>o</Text>
                <View style={styles.dividerLine} />
              </View>

              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.btnPressed]}
                onPress={() => setStep('solicitud')}
              >
                <Text style={styles.secondaryButtonText}>Crear nueva solicitud</Text>
              </Pressable>
            </View>
          )}

          {/* ── STEP: Solicitud ─────────────────────────────────────────── */}
          {step === 'solicitud' && (
            <View>
              <Text style={styles.stepTitle}>Datos de la solicitud</Text>

              <Campo label="Establecimiento" value={datos.establecimiento} onChange={(v) => setDatos(p => ({ ...p, establecimiento: v }))} />
              <Campo label="Mes radicado" value={datos.mesRadicado} onChange={(v) => setDatos(p => ({ ...p, mesRadicado: v }))} placeholder="Ej. Enero 2025" />
              <Campo label="Última fecha del mes" value={datos.ultimaFechaMes} onChange={(v) => setDatos(p => ({ ...p, ultimaFechaMes: v }))} placeholder="DD/MM/AAAA" />
              <Campo label="Nombre del auxiliar" value={datos.nombreAuxiliar} onChange={(v) => setDatos(p => ({ ...p, nombreAuxiliar: v }))} />
              <Campo label="Cédula" value={datos.cedula} onChange={(v) => setDatos(p => ({ ...p, cedula: v }))} keyboardType="numeric" />
              <Campo label="Lugar de expedición de cédula" value={datos.lugarExpedicionCedula} onChange={(v) => setDatos(p => ({ ...p, lugarExpedicionCedula: v }))} />
              <Campo label="Valor en números (COP)" value={datos.valorNumero} onChange={(v) => setDatos(p => ({ ...p, valorNumero: v }))} keyboardType="decimal-pad" placeholder="Ej. 1500000" />
              {datos.valorLetras ? (
                <View style={styles.infoBox}>
                  <Text style={styles.infoBoxLabel}>Valor en letras:</Text>
                  <Text style={styles.infoBoxText}>{datos.valorLetras}</Text>
                </View>
              ) : null}
              <Campo label="Objeto contractual" value={datos.objetoContractual} onChange={(v) => setDatos(p => ({ ...p, objetoContractual: v }))} multiline />
              <Campo label="Fecha inicio del contrato" value={datos.fechaInicioContrato} onChange={(v) => setDatos(p => ({ ...p, fechaInicioContrato: v }))} placeholder="DD/MM/AAAA" />
              <Campo label="EPS" value={datos.eps} onChange={(v) => setDatos(p => ({ ...p, eps: v }))} />
              <Campo label="Nombre de la coordinadora" value={datos.nombreCoordinadora} onChange={(v) => setDatos(p => ({ ...p, nombreCoordinadora: v }))} />
              <Campo label="Nota aclaratoria" value={datos.notaAclaratoria} onChange={(v) => setDatos(p => ({ ...p, notaAclaratoria: v }))} multiline />
              <Campo label="Teléfono de contacto" value={datos.telefonoContacto} onChange={(v) => setDatos(p => ({ ...p, telefonoContacto: v }))} keyboardType="phone-pad" />
              <Campo label="Correo de contacto" value={datos.correoContacto} onChange={(v) => setDatos(p => ({ ...p, correoContacto: v }))} keyboardType="email-address" />
              <Campo label="Observaciones" value={datos.observaciones} onChange={(v) => setDatos(p => ({ ...p, observaciones: v }))} multiline />

              {/* Firma digital */}
              <View style={fieldStyles.group}>
                <View style={styles.switchRow}>
                  <Text style={fieldStyles.label}>Firma digital obligatoria</Text>
                  <Switch
                    value={datos.firmaDigitalObligatoria}
                    onValueChange={(v) => setDatos(p => ({ ...p, firmaDigitalObligatoria: v }))}
                    trackColor={{ true: Colors.primary }}
                  />
                </View>
              </View>

              {/* Turnos */}
              <Text style={[styles.stepTitle, { marginBottom: Spacing.sm }]}>Turnos</Text>
              {turnos.map((t, i) => (
                <View key={i} style={styles.turnoRow}>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={[fieldStyles.input, { marginBottom: 6 }]}
                      placeholder="Fecha (DD/MM/AAAA)"
                      placeholderTextColor={Colors.textMuted}
                      value={t.fecha}
                      onChangeText={(v) => setTurnos(prev => prev.map((x, j) => j === i ? { ...x, fecha: v } : x))}
                    />
                    <TextInput
                      style={[fieldStyles.input, { marginBottom: 6 }]}
                      placeholder="Número de turno"
                      placeholderTextColor={Colors.textMuted}
                      value={t.numero}
                      onChangeText={(v) => setTurnos(prev => prev.map((x, j) => j === i ? { ...x, numero: v } : x))}
                      keyboardType="numeric"
                    />
                    <View style={styles.eronSelector}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {ERON_OPTIONS.map((eron) => (
                          <Pressable
                            key={eron}
                            style={[styles.eronChip, t.eron === eron && styles.eronChipActive]}
                            onPress={() => setTurnos(prev => prev.map((x, j) => j === i ? { ...x, eron } : x))}
                          >
                            <Text style={[styles.eronChipText, t.eron === eron && styles.eronChipTextActive]}>
                              {eron.replace('ERON ', '')}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                  {turnos.length > 1 && (
                    <Pressable style={styles.removeTurno} onPress={() => setTurnos(prev => prev.filter((_, j) => j !== i))}>
                      <Text style={styles.removeTurnoText}>✕</Text>
                    </Pressable>
                  )}
                </View>
              ))}

              <Pressable
                style={styles.addTurnoButton}
                onPress={() => setTurnos(prev => [...prev, { fecha: '', numero: '', eron: ERON_OPTIONS[0] }])}
              >
                <Text style={styles.addTurnoText}>+ Agregar turno</Text>
              </Pressable>

              {errorSolicitud ? <View style={styles.alertBox}><Text style={styles.alertText}>{errorSolicitud}</Text></View> : null}

              <Pressable
                style={({ pressed }) => [styles.primaryButton, pressed && styles.btnPressed, enviando && styles.btnDisabled]}
                onPress={handleEnviarSolicitud}
                disabled={enviando}
              >
                {enviando ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Enviar solicitud</Text>}
              </Pressable>

              <Pressable style={[styles.secondaryButton, { marginTop: Spacing.sm }]} onPress={() => setStep('verificar')}>
                <Text style={styles.secondaryButtonText}>← Atrás</Text>
              </Pressable>
            </View>
          )}

          {/* ── STEP: Documentos ─────────────────────────────────────────── */}
          {step === 'documentos' && (
            <View>
              <Text style={styles.stepTitle}>Cargar documentos</Text>
              {radicadoCreado ? (
                <View style={styles.successBox}>
                  <Text style={styles.successTitle}>Solicitud creada</Text>
                  <Text style={styles.successRow}>Número de radicado: <Text style={{ fontWeight: '700', color: Colors.primary }}>{radicadoCreado}</Text></Text>
                </View>
              ) : null}
              <Text style={styles.bodyText}>
                Ingresa el nombre exacto del archivo (incluyendo extensión) para cada documento requerido. Solo se permiten letras, números, guiones, puntos y barras bajas.
              </Text>

              {DOCUMENTOS_REQUERIDOS.map((doc) => (
                <View key={doc} style={fieldStyles.group}>
                  <Text style={fieldStyles.label}>{doc}</Text>
                  <TextInput
                    style={fieldStyles.input}
                    placeholder="Ej. cuenta_cobro_enero_2025.pdf"
                    placeholderTextColor={Colors.textMuted}
                    value={archivos[doc]}
                    onChangeText={(v) => setArchivos(prev => ({ ...prev, [doc]: v }))}
                    autoCapitalize="none"
                  />
                </View>
              ))}

              {errorDocs ? <View style={styles.alertBox}><Text style={styles.alertText}>{errorDocs}</Text></View> : null}

              <Pressable
                style={({ pressed }) => [styles.primaryButton, pressed && styles.btnPressed, subiendoDocs && styles.btnDisabled]}
                onPress={handleSubirDocumentos}
                disabled={subiendoDocs}
              >
                {subiendoDocs ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Confirmar documentos</Text>}
              </Pressable>
            </View>
          )}

          {/* ── STEP: Completado ─────────────────────────────────────────── */}
          {step === 'completado' && (
            <View style={styles.completedContainer}>
              <View style={styles.completedIcon}>
                <Text style={{ fontSize: 48 }}>✓</Text>
              </View>
              <Text style={styles.completedTitle}>¡Radicado completado!</Text>
              <Text style={styles.completedSubtitle}>
                Tu solicitud fue radicada correctamente. Guarda el número de radicado para hacer seguimiento.
              </Text>
              {radicadoCreado ? (
                <View style={styles.radicadoBadge}>
                  <Text style={styles.radicadoBadgeLabel}>Número de radicado</Text>
                  <Text style={styles.radicadoBadgeValue}>{radicadoCreado}</Text>
                </View>
              ) : null}

              <Pressable
                style={[styles.primaryButton, { marginTop: Spacing.xl }]}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.primaryButtonText}>Finalizar</Text>
              </Pressable>

              <Pressable
                style={[styles.secondaryButton, { marginTop: Spacing.sm }]}
                onPress={() => {
                  setStep('verificar');
                  setNumeroRadicado('');
                  setNumeroCc('');
                  setDatos(DATOS_PLANTILLA_INIT);
                  setTurnos([{ fecha: '', numero: '', eron: ERON_OPTIONS[0] }]);
                  setRadicadoCreado('');
                  setRadicadoVerificado(null);
                  setArchivos(Object.fromEntries(DOCUMENTOS_REQUERIDOS.map((d) => [d, ''])));
                }}
              >
                <Text style={styles.secondaryButtonText}>Nueva solicitud</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const fieldStyles = StyleSheet.create({
  group: { marginBottom: Spacing.md },
  label: { ...Typography.label, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    padding: 14, fontSize: 15, color: Colors.text, backgroundColor: Colors.surface,
  },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backText: { color: Colors.primary, fontSize: 15, fontWeight: '500' },
  headerTitle: { ...Typography.heading, fontSize: 16 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl * 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, backgroundColor: Colors.surface },
  stepItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  stepDotActive: { backgroundColor: Colors.primary },
  stepDotDone: { backgroundColor: Colors.success },
  stepNumber: { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  stepNumberActive: { color: '#fff' },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.border },
  stepLineDone: { backgroundColor: Colors.success },
  stepTitle: { ...Typography.heading, marginBottom: Spacing.lg },
  alertBox: { backgroundColor: Colors.errorLight, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.md },
  alertText: { color: Colors.error, fontSize: 14 },
  successBox: { backgroundColor: Colors.successLight, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md },
  successTitle: { fontSize: 14, fontWeight: '700', color: Colors.success, marginBottom: 4 },
  successRow: { fontSize: 13, color: Colors.text, marginBottom: 2 },
  infoBox: { backgroundColor: Colors.primaryLight, borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.md },
  infoBoxLabel: { fontSize: 12, fontWeight: '600', color: Colors.primary, marginBottom: 4 },
  infoBoxText: { fontSize: 13, color: Colors.text },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  turnoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  eronSelector: { flexDirection: 'row', marginTop: 4 },
  eronChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, marginRight: 6, backgroundColor: Colors.surface },
  eronChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  eronChipText: { fontSize: 12, color: Colors.textSecondary },
  eronChipTextActive: { color: '#fff', fontWeight: '600' },
  removeTurno: { marginLeft: Spacing.sm, padding: 6 },
  removeTurnoText: { color: Colors.error, fontSize: 18 },
  addTurnoButton: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.primary, borderRadius: Radius.md, padding: 12, alignItems: 'center', marginBottom: Spacing.lg },
  addTurnoText: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  primaryButton: { backgroundColor: Colors.primary, borderRadius: Radius.md, padding: 16, alignItems: 'center', marginTop: Spacing.xs },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryButton: { borderWidth: 1.5, borderColor: Colors.primary, borderRadius: Radius.md, padding: 14, alignItems: 'center' },
  secondaryButtonText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
  btnPressed: { opacity: 0.85 },
  btnDisabled: { opacity: 0.6 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { marginHorizontal: Spacing.sm, color: Colors.textMuted, fontSize: 13 },
  bodyText: { ...Typography.body, marginBottom: Spacing.md },
  completedContainer: { alignItems: 'center', paddingTop: Spacing.xl },
  completedIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.successLight, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg },
  completedTitle: { ...Typography.title, textAlign: 'center', marginBottom: Spacing.sm },
  completedSubtitle: { ...Typography.subtitle, textAlign: 'center', marginBottom: Spacing.lg },
  radicadoBadge: { backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center' },
  radicadoBadgeLabel: { fontSize: 12, color: Colors.primary, fontWeight: '600', marginBottom: 4 },
  radicadoBadgeValue: { fontSize: 22, fontWeight: '700', color: Colors.primary },
});
