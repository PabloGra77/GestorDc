import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { hash } from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { Repository } from 'typeorm';
import { ROLES_PERMISSIONS_CATALOG } from '../roles/roles-permissions.catalog';
import { RoleEntity } from '../roles/role.entity';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UsuarioEntity } from './usuario.entity';

@Injectable()
export class UsuariosService {
  private readonly logger = new Logger(UsuariosService.name);
  private readonly mailTransporter: Transporter | null;
  private readonly smtpFrom: string;
  private readonly webBaseUrl: string;
  private readonly defaultTempPassword: string;

  constructor(
    @InjectRepository(UsuarioEntity)
    private readonly usuariosRepository: Repository<UsuarioEntity>,
    @InjectRepository(RoleEntity)
    private readonly rolesRepository: Repository<RoleEntity>,
    private readonly configService: ConfigService,
  ) {
    // No lanzar en el constructor — SMTP es opcional; si falta se detecta en tiempo de ejecución
    this.mailTransporter = this.initMailTransporter();
    this.smtpFrom = this.configService.get<string>('SMTP_FROM') || 'GestorDoc <no-reply@gestordoc.local>';
    this.webBaseUrl = this.configService.get<string>('WEB_BASE_URL') || 'http://127.0.0.1:3002';
    this.defaultTempPassword = this.configService.get<string>('DEFAULT_USER_PASSWORD') || 'Temporal2026!';
  }

  private initMailTransporter(): Transporter | null {
    const host = this.configService.get<string>('SMTP_HOST');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (!host || !user || !pass) {
      this.logger.warn('SMTP no configurado — las notificaciones de creación de usuario están deshabilitadas');
      return null;
    }

    return nodemailer.createTransport({
      host,
      port: Number(this.configService.get<string>('SMTP_PORT') || 587),
      secure: this.configService.get<string>('SMTP_SECURE') === 'true',
      auth: { user, pass },
    });
  }

  private async enviarCorreoBienvenida(
    correo: string,
    nombreCompleto: string,
    passwordTemporal: string,
  ): Promise<void> {
    if (!this.mailTransporter) {
      throw new InternalServerErrorException('No hay configuración SMTP para notificar la creación del usuario');
    }
    const firstAccessLink = `${this.webBaseUrl.replace(/\/$/, '')}/login`;
    const subject = 'Creación de usuario - GestorDoc';
    const text = [
      `Hola ${nombreCompleto},`,
      '',
      'Se realizó la creación de tu usuario en la plataforma GestorDoc.',
      `Usuario: ${correo}`,
      `Contraseña temporal: ${passwordTemporal}`,
      '',
      'Al ingresar por primera vez debes cambiar tu contraseña.',
      `Acceso: ${firstAccessLink}`,
    ].join('\n');

    const html = `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
        <p>Hola ${nombreCompleto},</p>
        <p>Se realizó la creación de tu usuario en la plataforma <strong>GestorDoc</strong>.</p>
        <p><strong>Usuario:</strong> ${correo}<br/><strong>Contraseña temporal:</strong> ${passwordTemporal}</p>
        <p>Al ingresar por primera vez debes cambiar tu contraseña.</p>
        <p><a href="${firstAccessLink}">Ir a iniciar sesión</a></p>
      </div>
    `;

    await this.mailTransporter.sendMail({
      from: this.smtpFrom,
      to: correo,
      subject,
      text,
      html,
    });
  }

  private normalizarPermisos(permisos?: Record<string, string[]>): Record<string, string[]> {
    if (!permisos || typeof permisos !== 'object') {
      return {};
    }

    const normalizado: Record<string, string[]> = {};

    for (const [modulo, disponibles] of Object.entries(ROLES_PERMISSIONS_CATALOG)) {
      const solicitados = Array.isArray(permisos[modulo]) ? permisos[modulo] : [];
      const disponiblesSet = new Set(disponibles as readonly string[]);
      const permitidos = solicitados.filter((permiso) => disponiblesSet.has(permiso));

      if (permitidos.length > 0) {
        normalizado[modulo] = [...new Set(permitidos)];
      }
    }

    return normalizado;
  }

  private async obtenerPasswordHash(dto: {
    password?: string;
    passwordHash?: string;
  }): Promise<string | null> {
    const rawPassword = dto.password?.trim() || dto.passwordHash?.trim();

    if (!rawPassword) {
      return null;
    }

    return hash(rawPassword, 12);
  }

  async create(createUsuarioDto: CreateUsuarioDto): Promise<UsuarioEntity> {
    const correo = createUsuarioDto.correo.trim().toLowerCase();
    const nombreCompleto =
      createUsuarioDto.nombreCompleto?.trim() ||
      [
        createUsuarioDto.primerNombre,
        createUsuarioDto.segundoNombre,
        createUsuarioDto.primerApellido,
        createUsuarioDto.segundoApellido,
      ]
        .map((item) => item?.trim() || '')
        .filter(Boolean)
        .join(' ');

    const usuarioExistente = await this.usuariosRepository.findOne({
      where: { correo },
    });

    if (usuarioExistente) {
      throw new ConflictException('Ya existe un usuario con ese correo');
    }

    const rol = await this.rolesRepository.findOne({
      where: { id: createUsuarioDto.rolId },
    });

    if (!rol) {
      throw new NotFoundException('El rol indicado no existe');
    }

    const passwordTemporal = this.defaultTempPassword;
    const passwordHashTemporal = await hash(passwordTemporal, 12);

    const usuario = this.usuariosRepository.create({
      primerNombre: createUsuarioDto.primerNombre.trim(),
      segundoNombre: createUsuarioDto.segundoNombre?.trim() || null,
      primerApellido: createUsuarioDto.primerApellido.trim(),
      segundoApellido: createUsuarioDto.segundoApellido?.trim() || null,
      tipoDocumento: createUsuarioDto.tipoDocumento.trim().toUpperCase(),
      numeroDocumento: createUsuarioDto.numeroDocumento.trim(),
      nombreCompleto,
      correo,
      area: createUsuarioDto.area?.trim() || rol.nombre,
      permisos:
        rol.nombre.trim().toLowerCase() === 'administrador'
          ? {}
          : this.normalizarPermisos(createUsuarioDto.permisos),
      passwordHash: passwordHashTemporal,
      mustChangePassword: true,
      activo: createUsuarioDto.activo ?? true,
      rolId: rol.id,
    });

    const usuarioCreado = await this.usuariosRepository.save(usuario);

    try {
      await this.enviarCorreoBienvenida(correo, nombreCompleto, passwordTemporal);
    } catch {
      await this.usuariosRepository.delete({ id: usuarioCreado.id });
      throw new InternalServerErrorException(
        'No se pudo enviar el correo de bienvenida. El usuario no fue creado.',
      );
    }

    return usuarioCreado;
  }

  async findAll(): Promise<UsuarioEntity[]> {
    return this.usuariosRepository.find({
      order: { id: 'ASC' },
    });
  }

  async findOne(id: number): Promise<UsuarioEntity> {
    const usuario = await this.usuariosRepository.findOne({
      where: { id },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return usuario;
  }

  async update(id: number, updateUsuarioDto: UpdateUsuarioDto): Promise<UsuarioEntity> {
    const usuario = await this.findOne(id);
    let rolObjetivo = usuario.rol;

    if (updateUsuarioDto.correo) {
      const correo = updateUsuarioDto.correo.trim().toLowerCase();

      const existente = await this.usuariosRepository.findOne({
        where: { correo },
      });

      if (existente && existente.id !== id) {
        throw new ConflictException('Ya existe un usuario con ese correo');
      }

      usuario.correo = correo;
    }

    if (updateUsuarioDto.rolId !== undefined) {
      const rol = await this.rolesRepository.findOne({
        where: { id: updateUsuarioDto.rolId },
      });

      if (!rol) {
        throw new NotFoundException('El rol indicado no existe');
      }

      usuario.rolId = rol.id;
      rolObjetivo = rol;
    }

    if (updateUsuarioDto.permisos !== undefined) {
      const esAdministrador = rolObjetivo?.nombre?.trim().toLowerCase() === 'administrador';
      if (esAdministrador) {
        throw new ForbiddenException('No está permitido modificar permisos de usuarios con rol Administrador');
      }

      usuario.permisos = this.normalizarPermisos(updateUsuarioDto.permisos);
    }

    usuario.primerNombre = updateUsuarioDto.primerNombre?.trim() ?? usuario.primerNombre;
    usuario.segundoNombre = updateUsuarioDto.segundoNombre?.trim() ?? usuario.segundoNombre;
    usuario.primerApellido = updateUsuarioDto.primerApellido?.trim() ?? usuario.primerApellido;
    usuario.segundoApellido = updateUsuarioDto.segundoApellido?.trim() ?? usuario.segundoApellido;
    usuario.tipoDocumento = updateUsuarioDto.tipoDocumento?.trim().toUpperCase() ?? usuario.tipoDocumento;
    usuario.numeroDocumento = updateUsuarioDto.numeroDocumento?.trim() ?? usuario.numeroDocumento;
    usuario.area = updateUsuarioDto.area?.trim() ?? usuario.area;
    usuario.nombreCompleto =
      updateUsuarioDto.nombreCompleto?.trim() ||
      [usuario.primerNombre, usuario.segundoNombre, usuario.primerApellido, usuario.segundoApellido]
        .map((item) => item?.trim() || '')
        .filter(Boolean)
        .join(' ') ||
      usuario.nombreCompleto;
    if (updateUsuarioDto.password !== undefined || updateUsuarioDto.passwordHash !== undefined) {
      usuario.passwordHash = await this.obtenerPasswordHash(updateUsuarioDto);
      usuario.mustChangePassword = true;
    }
    usuario.activo = updateUsuarioDto.activo ?? usuario.activo;

    return this.usuariosRepository.save(usuario);
  }
}
