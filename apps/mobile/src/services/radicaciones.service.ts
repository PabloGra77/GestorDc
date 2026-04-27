import { api } from './api';
import type {
  CreateCuentaCobroOpsResponse,
  VerifyCuentaCobroOpsResponse,
} from '../types/radicado';

export interface CreateCuentaCobroOpsPayload {
  correoSolicitado: string;
  numeroCcSolicitado: string;
  nombreSolicitado?: string;
  documentosSolicitados: string[];
  observaciones?: string;
  datosPlantilla?: Record<string, unknown>;
}

export interface SubmitCuentaCobroOpsDocumentosPayload {
  numeroRadicado: string;
  numeroCc: string;
  documentos: Array<{ nombre: string; archivo: string }>;
}

export async function createCuentaCobroOpsSolicitud(
  payload: CreateCuentaCobroOpsPayload,
): Promise<CreateCuentaCobroOpsResponse> {
  const response = await api.post<CreateCuentaCobroOpsResponse>(
    '/radicados/cuentas-cobro-ops/solicitud',
    payload,
  );
  return response.data;
}

export async function verifyCuentaCobroOps(
  numero: string,
  cc: string,
): Promise<VerifyCuentaCobroOpsResponse> {
  const response = await api.get<VerifyCuentaCobroOpsResponse>(
    '/radicados/cuentas-cobro-ops/verificar',
    { params: { numero, cc } },
  );
  return response.data;
}

export async function submitCuentaCobroOpsDocumentos(
  payload: SubmitCuentaCobroOpsDocumentosPayload,
): Promise<{ ok: boolean; message: string; numero: string; estado: string }> {
  const response = await api.post<{
    ok: boolean;
    message: string;
    numero: string;
    estado: string;
  }>('/radicados/cuentas-cobro-ops/documentos', payload);
  return response.data;
}
