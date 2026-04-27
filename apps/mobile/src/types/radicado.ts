export interface Radicado {
  id: number;
  numero: string;
  referencia: string;
  asunto?: string | null;
  estado: string;
  creadoEn: string;
  actualizadoEn: string;
}

export interface CreateCuentaCobroOpsResponse {
  id: number;
  numero: string;
  referencia: string;
  estado: string;
  linkCarga: string;
  correoSolicitado: string;
  documentosSolicitados: string[];
}

export interface VerifyCuentaCobroOpsResponse {
  existe: boolean;
  autorizado: boolean;
  message?: string;
  numero?: string;
  referencia?: string;
  estado?: string;
  documentosSolicitados?: string[];
  documentosAdjuntos?: Array<{ nombre: string; archivo: string; cargadoEn: string }>;
}
