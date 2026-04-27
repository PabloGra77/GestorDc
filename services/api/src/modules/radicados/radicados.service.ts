import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as nodemailer from 'nodemailer';
import { UsuarioEntity } from '../usuarios/usuario.entity';
import { CreateCuentaCobroOpsDto } from './dto/create-cuenta-cobro-ops.dto';
import { CreateRadicadoDto } from './dto/create-radicado.dto';
import { SubmitCuentaCobroOpsDocumentosDto } from './dto/submit-cuenta-cobro-ops-documentos.dto';
import { RadicadoEntity } from './radicado.entity';

@Injectable()
export class RadicadosService {
  private readonly logger = new Logger(RadicadosService.name);

  constructor(
    @InjectRepository(RadicadoEntity)
    private readonly radicadosRepository: Repository<RadicadoEntity>,
    @InjectRepository(UsuarioEntity)
    private readonly usuariosRepository: Repository<UsuarioEntity>,
    private readonly configService: ConfigService,
  ) {}

  private esCorreoValido(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  private normalizarCc(value: string): string {
    return value.replace(/[^0-9]/g, '');
  }

  private async resolverCorreos(destinatarios?: string[]): Promise<string[]> {
    if (!destinatarios || destinatarios.length === 0) {
      return [];
    }

    const resultado = new Set<string>();

    for (const rawItem of destinatarios) {
      const item = rawItem?.trim();
      if (!item) {
        continue;
      }

      if (this.esCorreoValido(item)) {
        resultado.add(item.toLowerCase());
        continue;
      }

      const usuario = await this.usuariosRepository
        .createQueryBuilder('usuario')
        .where('LOWER(usuario.nombre_completo) = LOWER(:nombre)', { nombre: item })
        .orWhere('LOWER(usuario.correo) = LOWER(:correo)', { correo: item })
        .getOne();

      if (usuario?.correo) {
        resultado.add(usuario.correo.toLowerCase());
      }
    }

    return [...resultado];
  }

  private async enviarCorreoRadicado(params: {
    numero: string;
    referencia: string;
    asunto: string;
    mensaje: string;
    para: string[];
    cc: string[];
    adjuntos: string[];
  }) {
    const host = this.configService.get<string>('SMTP_HOST');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const from = this.configService.get<string>('SMTP_FROM') || user;
    const port = Number(this.configService.get<string>('SMTP_PORT') || '587');
    const secure = String(this.configService.get<string>('SMTP_SECURE') || 'false') === 'true';

    if (!host || !user || !pass || !from) {
      this.logger.warn('SMTP no configurado completamente. Se omite envio de correo.');
      return;
    }

    if (params.para.length === 0) {
      return;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    const adjuntosTexto =
      params.adjuntos.length > 0 ? `\n\nAdjuntos registrados:\n- ${params.adjuntos.join('\n- ')}` : '';

    const text = [
      'Gestor Documental - Notificacion de solicitud',
      '',
      `Radicado: ${params.numero}`,
      `Referencia: ${params.referencia}`,
      '',
      `Mensaje: ${params.mensaje || '(sin mensaje adicional)'}`,
      adjuntosTexto,
    ].join('\n');

    await transporter.sendMail({
      from,
      to: params.para,
      cc: params.cc.length > 0 ? params.cc : undefined,
      subject: `[Radicado ${params.numero}] ${params.asunto || params.referencia}`,
      text,
    });
  }

  private async buildTransporter() {
    const host = this.configService.get<string>('SMTP_HOST');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const from = this.configService.get<string>('SMTP_FROM') || user;
    const port = Number(this.configService.get<string>('SMTP_PORT') || '587');
    const secure = String(this.configService.get<string>('SMTP_SECURE') || 'false') === 'true';

    if (!host || !user || !pass || !from) {
      return null;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    return { transporter, from };
  }

  private async enviarCorreoSolicitudCuentaCobroOps(params: {
    numero: string;
    referencia: string;
    correoSolicitado: string;
    numeroCcSolicitado: string;
    documentosSolicitados: string[];
    observaciones?: string;
  }) {
    const mail = await this.buildTransporter();
    if (!mail) {
      this.logger.warn('SMTP no configurado completamente. Se omite envio de correo OPS.');
      return;
    }

    const webBaseUrl = this.configService.get<string>('WEB_BASE_URL') || 'http://127.0.0.1:3002';
    const linkCarga = `${webBaseUrl}/radicacion-cuenta-cobro-ops?radicado=${encodeURIComponent(params.numero)}`;

    const text = [
      'Gestor Documental - Solicitud de radicacion de cuenta de cobro OPS',
      '',
      `Numero de radicado: ${params.numero}`,
      `Referencia: ${params.referencia}`,
      '',
      'Documentos solicitados:',
      ...params.documentosSolicitados.map((item) => `- ${item}`),
      '',
      `Ingresa al siguiente enlace para cargar los soportes: ${linkCarga}`,
      `Debes verificarte con tu numero de CC: ${params.numeroCcSolicitado}`,
      '',
      `Observaciones: ${params.observaciones?.trim() || 'Sin observaciones adicionales'}`,
    ].join('\n');

    await mail.transporter.sendMail({
      from: mail.from,
      to: params.correoSolicitado,
      subject: `[OPS - Cuenta de cobro] Radicado ${params.numero}`,
      text,
    });
  }

  private async generarReferenciaOpsUnica(cc: string): Promise<string> {
    for (let intento = 0; intento < 8; intento += 1) {
      const semilla = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
      const referencia = `OPS-CC-${cc}-${semilla}`;
      const existe = await this.radicadosRepository.findOne({ where: { referencia } });
      if (!existe) {
        return referencia;
      }
    }

    throw new ConflictException('No fue posible generar una referencia OPS unica');
  }

  private async generarNumeroRadicadoUnico(): Promise<string> {
    for (let intento = 0; intento < 12; intento += 1) {
      const ahora = new Date();
      const yyyy = ahora.getUTCFullYear();
      const mm = String(ahora.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(ahora.getUTCDate()).padStart(2, '0');
      const hh = String(ahora.getUTCHours()).padStart(2, '0');
      const mi = String(ahora.getUTCMinutes()).padStart(2, '0');
      const ss = String(ahora.getUTCSeconds()).padStart(2, '0');
      const aleatorio = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
      const candidato = `RAD-${yyyy}${mm}${dd}-${hh}${mi}${ss}-${aleatorio}`;

      const existe = await this.radicadosRepository.findOne({
        where: { numero: candidato },
      });

      if (!existe) {
        return candidato;
      }
    }

    throw new ConflictException('No fue posible generar un numero de radicado unico');
  }

  async create(createRadicadoDto: CreateRadicadoDto): Promise<RadicadoEntity> {
    const numeroManual = createRadicadoDto.numero?.trim().toUpperCase();
    const numero = numeroManual || (await this.generarNumeroRadicadoUnico());
    const referencia = createRadicadoDto.referencia.trim().toUpperCase();
    const asuntoNormalizado = createRadicadoDto.asunto?.trim() || null;

    const existente = await this.radicadosRepository.findOne({
      where: numeroManual ? [{ numero }, { referencia }] : [{ referencia }],
    });

    if (existente) {
      if (numeroManual && existente.numero === numero) {
        throw new ConflictException('Ya existe un radicado con ese numero');
      }

      throw new ConflictException('Ya existe un radicado con esa referencia');
    }

    const radicado = this.radicadosRepository.create({
      numero,
      referencia,
      asunto: asuntoNormalizado,
      estado: 'Radicado',
      tipo: 'General',
    });

    const radicadoGuardado = await this.radicadosRepository.save(radicado);

    try {
      const para = await this.resolverCorreos(createRadicadoDto.para);
      const cc = await this.resolverCorreos(createRadicadoDto.cc);
      await this.enviarCorreoRadicado({
        numero,
        referencia,
        asunto: asuntoNormalizado || referencia,
        mensaje: createRadicadoDto.mensaje?.trim() || '',
        para,
        cc,
        adjuntos: createRadicadoDto.adjuntos || [],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`No fue posible enviar correo de radicado ${numero}: ${message}`);
    }

    return radicadoGuardado;
  }

  async createCuentaCobroOpsSolicitud(dto: CreateCuentaCobroOpsDto) {
    const numero = await this.generarNumeroRadicadoUnico();
    const correoSolicitado = dto.correoSolicitado.trim().toLowerCase();
    const numeroCcSolicitado = this.normalizarCc(dto.numeroCcSolicitado);
    const documentosSolicitados = dto.documentosSolicitados
      .map((item) => item.trim())
      .filter(Boolean);

    if (!this.esCorreoValido(correoSolicitado)) {
      throw new BadRequestException('Correo solicitado invalido');
    }

    if (!numeroCcSolicitado || numeroCcSolicitado.length < 5) {
      throw new BadRequestException('Numero de CC invalido');
    }

    if (documentosSolicitados.length === 0) {
      throw new BadRequestException('Debes incluir al menos un documento solicitado');
    }

    const referencia = await this.generarReferenciaOpsUnica(numeroCcSolicitado);

    const radicado = this.radicadosRepository.create({
      numero,
      referencia,
      asunto: `Cuenta de cobro OPS - ${dto.nombreSolicitado?.trim() || numeroCcSolicitado}`,
      estado: 'Solicitud OPS enviada',
      tipo: 'CuentaCobroOPS',
      solicitanteCorreo: correoSolicitado,
      solicitanteCc: numeroCcSolicitado,
      documentosSolicitados,
      documentosAdjuntos: [],
      datosPlantilla: dto.datosPlantilla || null,
    });

    const guardado = await this.radicadosRepository.save(radicado);

    try {
      await this.enviarCorreoSolicitudCuentaCobroOps({
        numero,
        referencia,
        correoSolicitado,
        numeroCcSolicitado,
        documentosSolicitados,
        observaciones: dto.observaciones,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`No fue posible enviar correo OPS ${numero}: ${message}`);
    }

    const webBaseUrl = this.configService.get<string>('WEB_BASE_URL') || 'http://127.0.0.1:3002';

    return {
      id: guardado.id,
      numero: guardado.numero,
      referencia: guardado.referencia,
      estado: guardado.estado,
      linkCarga: `${webBaseUrl}/radicacion-cuenta-cobro-ops?radicado=${encodeURIComponent(guardado.numero)}`,
      correoSolicitado,
      documentosSolicitados,
    };
  }

  async verifyCuentaCobroOps(numero?: string, cc?: string) {
    const numeroNormalizado = numero?.trim().toUpperCase();
    const ccNormalizado = this.normalizarCc(cc?.trim() || '');

    if (!numeroNormalizado || !ccNormalizado) {
      throw new BadRequestException('Debes enviar numero de radicado y numero de CC');
    }

    const radicado = await this.radicadosRepository.findOne({
      where: {
        numero: numeroNormalizado,
        tipo: 'CuentaCobroOPS',
      },
    });

    if (!radicado) {
      return { existe: false, autorizado: false, message: 'No existe una solicitud OPS con ese radicado.' };
    }

    if ((radicado.solicitanteCc || '') !== ccNormalizado) {
      return { existe: true, autorizado: false, message: 'El numero de CC no coincide con la solicitud.' };
    }

    return {
      existe: true,
      autorizado: true,
      numero: radicado.numero,
      referencia: radicado.referencia,
      estado: radicado.estado,
      documentosSolicitados: radicado.documentosSolicitados || [],
      documentosAdjuntos: radicado.documentosAdjuntos || [],
    };
  }

  async submitCuentaCobroOpsDocumentos(dto: SubmitCuentaCobroOpsDocumentosDto) {
    const numero = dto.numeroRadicado.trim().toUpperCase();
    const cc = this.normalizarCc(dto.numeroCc);

    const radicado = await this.radicadosRepository.findOne({
      where: {
        numero,
        tipo: 'CuentaCobroOPS',
      },
    });

    if (!radicado) {
      throw new BadRequestException('No existe una solicitud OPS con ese radicado');
    }

    if ((radicado.solicitanteCc || '') !== cc) {
      throw new BadRequestException('El numero de CC no coincide con la solicitud');
    }

    const ahora = new Date().toISOString();
    const documentosAdjuntos = dto.documentos.map((item) => ({
      nombre: item.nombre.trim(),
      archivo: item.archivo.trim(),
      cargadoEn: ahora,
    }));

    radicado.documentosAdjuntos = documentosAdjuntos;
    radicado.estado = 'Docs OPS cargados';

    await this.radicadosRepository.save(radicado);

    return {
      ok: true,
      message: 'Documentos cargados correctamente. Pendiente validacion del solicitante.',
      numero: radicado.numero,
      estado: radicado.estado,
    };
  }

  async verify(numero?: string, referencia?: string): Promise<{
    existe: boolean;
    radicado?: RadicadoEntity;
  }> {
    const numeroNormalizado = numero?.trim().toUpperCase();
    const referenciaNormalizada = referencia?.trim().toUpperCase();

    if (!numeroNormalizado && !referenciaNormalizada) {
      throw new BadRequestException('Debes enviar numero o referencia para verificar');
    }

    const condiciones = [] as Array<{ numero?: string; referencia?: string }>;

    if (numeroNormalizado) {
      condiciones.push({ numero: numeroNormalizado });
    }

    if (referenciaNormalizada) {
      condiciones.push({ referencia: referenciaNormalizada });
    }

    const radicado = await this.radicadosRepository.findOne({
      where: condiciones,
      order: { id: 'DESC' },
    });

    if (!radicado) {
      return { existe: false };
    }

    return {
      existe: true,
      radicado,
    };
  }
}
