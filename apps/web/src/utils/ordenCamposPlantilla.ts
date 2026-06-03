/**
 * Ordena los campos del formulario según el orden visual de los bloques
 * de la plantilla PDF (de arriba a abajo, por coordenada y).
 *
 * Si un campo tiene un bloque `campo` en la plantilla que lo referencia
 * (por `campoKey`), su posición la determina el `y` (y luego `x`) de ese
 * bloque. Si no tiene bloque, va al final en su orden original.
 */

interface CampoMin {
  key: string;
  group?: string;
}

interface BloqueCampoMin {
  tipo: string;
  campoKey?: string;
  pagina?: number;
  y?: number;
  x?: number;
}

interface PlantillaPdfMin {
  bloques?: BloqueCampoMin[];
}

export function ordenarCamposPorPlantilla<T extends CampoMin>(
  campos: T[],
  plantilla: PlantillaPdfMin | null | undefined,
): T[] {
  if (!plantilla || !Array.isArray(plantilla.bloques) || plantilla.bloques.length === 0) {
    return campos;
  }
  const bloquesCampo = plantilla.bloques.filter((b) => b.tipo === 'campo' && b.campoKey);
  if (bloquesCampo.length === 0) return campos;

  // Mapa key → score (página * 10000 + y * 10 + x)
  const score = new Map<string, number>();
  for (const b of bloquesCampo) {
    const pag = (b.pagina ?? 1) * 100000;
    const yy = (b.y ?? 0) * 100;
    const xx = b.x ?? 0;
    const s = pag + yy + xx;
    // Si hay varios bloques para la misma key, conserva el primero (menor score)
    const prev = score.get(b.campoKey as string);
    if (prev === undefined || s < prev) {
      score.set(b.campoKey as string, s);
    }
  }

  const conBloque = campos.filter((c) => score.has(c.key));
  const sinBloque = campos.filter((c) => !score.has(c.key));

  conBloque.sort((a, b) => (score.get(a.key) ?? 0) - (score.get(b.key) ?? 0));

  return [...conBloque, ...sinBloque];
}
