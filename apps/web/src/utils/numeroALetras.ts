/**
 * Convierte numero entero a letras en espanol colombiano.
 * Ejemplo: 100 -> "cien", 1500 -> "mil quinientos"
 */
const UNIDADES = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
const ESPECIALES = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve'];
const DECENAS = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function menorDeCien(n: number): string {
  if (n < 10) return UNIDADES[n];
  if (n < 20) return ESPECIALES[n - 10];
  if (n < 30) {
    const u = n - 20;
    return u === 0 ? 'veinte' : `veinti${UNIDADES[u].replace('uno', 'uno')}`;
  }
  const d = Math.floor(n / 10);
  const u = n % 10;
  if (u === 0) return DECENAS[d];
  return `${DECENAS[d]} y ${UNIDADES[u]}`;
}

function menorDeMil(n: number): string {
  if (n === 100) return 'cien';
  if (n < 100) return menorDeCien(n);
  const c = Math.floor(n / 100);
  const resto = n % 100;
  return resto === 0 ? CENTENAS[c] : `${CENTENAS[c]} ${menorDeCien(resto)}`;
}

function enteroALetras(n: number): string {
  if (n === 0) return 'cero';
  if (n < 1000) return menorDeMil(n);
  if (n < 1_000_000) {
    const miles = Math.floor(n / 1000);
    const resto = n % 1000;
    const prefijo = miles === 1 ? 'mil' : `${menorDeMil(miles)} mil`;
    return resto === 0 ? prefijo : `${prefijo} ${menorDeMil(resto)}`;
  }
  if (n < 1_000_000_000) {
    const mill = Math.floor(n / 1_000_000);
    const resto = n % 1_000_000;
    const prefijo = mill === 1 ? 'un millon' : `${enteroALetras(mill)} millones`;
    return resto === 0 ? prefijo : `${prefijo} ${enteroALetras(resto)}`;
  }
  const milMill = Math.floor(n / 1_000_000_000);
  const resto = n % 1_000_000_000;
  const prefijo = milMill === 1 ? 'mil millones' : `${enteroALetras(milMill)} mil millones`;
  return resto === 0 ? prefijo : `${prefijo} ${enteroALetras(resto)}`;
}

/** Convierte un valor numerico a "X pesos" o "X pesos con Y centavos". */
export function numeroAPesosEnLetras(valor: string | number): string {
  const limpio = String(valor).replace(/[^0-9.,]/g, '').replace(',', '.');
  if (!limpio) return '';
  const num = Number(limpio);
  if (!Number.isFinite(num)) return '';
  const entero = Math.floor(Math.abs(num));
  if (!Number.isSafeInteger(entero)) return '';

  let texto = enteroALetras(entero)
    .replace(/veintiuno$/g, 'veintiun')
    .replace(/ y uno$/g, ' y un')
    .replace(/ uno$/g, ' un');

  texto = `${texto} ${entero === 1 ? 'peso' : 'pesos'}`;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Formatea numero con separador de miles (col): 1500000 -> "1.500.000" */
export function formatearMiles(valor: string | number): string {
  const limpio = String(valor).replace(/\D/g, '');
  if (!limpio) return '';
  return new Intl.NumberFormat('es-CO').format(Number(limpio));
}
