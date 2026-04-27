import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { Repository } from 'typeorm';
import { UsuarioEntity } from '../usuarios/usuario.entity';
import { ChangeInitialPasswordDto } from './dto/change-initial-password.dto';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';
import { LoginDto } from './dto/login.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly mailTransporter: Transporter | null;
  private readonly smtpFrom: string;
  private readonly webBaseUrl: string;
  private readonly resetTokenTtlMinutes: number;

  constructor(
    @InjectRepository(UsuarioEntity)
    private readonly usuariosRepository: Repository<UsuarioEntity>,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    // No lanzar en el constructor — SMTP es opcional; si falta, se detecta en tiempo de ejecución
    this.mailTransporter = this.initMailTransporter();
    this.smtpFrom = this.configService.get<string>('SMTP_FROM') || 'GestorDoc <no-reply@gestordoc.local>';
    this.webBaseUrl = this.configService.get<string>('WEB_BASE_URL') || 'http://127.0.0.1:3002';
    this.resetTokenTtlMinutes = Number(this.configService.get<string>('PASSWORD_RESET_TTL_MINUTES') || 30);
  }

  private initMailTransporter(): Transporter | null {
    const host = this.configService.get<string>('SMTP_HOST');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (!host || !user || !pass) {
      this.logger.warn('SMTP no configurado — las notificaciones por correo están deshabilitadas');
      return null;
    }

    return nodemailer.createTransport({
      host,
      port: Number(this.configService.get<string>('SMTP_PORT') || 587),
      secure: this.configService.get<string>('SMTP_SECURE') === 'true',
      auth: { user, pass },
    });
  }

  private hashResetToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private buildResetLink(token: string): string {
    const base = this.webBaseUrl.replace(/\/$/, '');
    return `${base}/reset-password?token=${encodeURIComponent(token)}`;
  }

  private async sendResetPasswordEmail(correo: string, nombre: string, resetLink: string): Promise<void> {
    if (!this.mailTransporter) {
      throw new InternalServerErrorException('No hay configuración SMTP para enviar el correo de restablecimiento');
    }

    const subject = 'Restablecimiento de contrasena - GestorDoc';
    const text = [
      `Hola ${nombre || 'usuario'},`,
      '',
      'Recibimos una solicitud para restablecer tu contrasena en GestorDoc.',
      'Para continuar, usa el siguiente enlace:',
      resetLink,
      '',
      `Este enlace vence en ${this.resetTokenTtlMinutes} minutos.`,
      'Si no solicitaste este cambio, puedes ignorar este mensaje.',
    ].join('\n');

    const html = `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
        <p>Hola ${nombre || 'usuario'},</p>
        <p>Recibimos una solicitud para restablecer tu contrasena en <strong>GestorDoc</strong>.</p>
        <p>Haz clic en este enlace para crear una nueva contrasena:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>Este enlace vence en ${this.resetTokenTtlMinutes} minutos.</p>
        <p>Si no solicitaste este cambio, puedes ignorar este mensaje.</p>
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

  async login(loginDto: LoginDto) {
    const correo = loginDto.correo.trim().toLowerCase();

    const usuario = await this.usuariosRepository
      .createQueryBuilder('usuario')
      .leftJoinAndSelect('usuario.rol', 'rol')
      .addSelect('usuario.passwordHash')
      .where('LOWER(usuario.correo) = :correo', { correo })
      .getOne();

    if (!usuario || !usuario.activo || !usuario.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordValido = await compare(loginDto.password, usuario.passwordHash);

    if (!passwordValido) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const token = this.jwtService.sign({
      sub: usuario.id,
      correo: usuario.correo,
    });

    return {
      token,
      usuario: {
        id: usuario.id,
        nombreCompleto: usuario.nombreCompleto,
        correo: usuario.correo,
        activo: usuario.activo,
        debeCambiarPassword: usuario.mustChangePassword,
        permisos: usuario.permisos ?? {},
        rol: {
          id: usuario.rol.id,
          nombre: usuario.rol.nombre,
          descripcion: usuario.rol.descripcion ?? null,
          activo: usuario.rol.activo,
          permisos: usuario.rol.permisos ?? {},
        },
      },
    };
  }

  async requestPasswordReset(requestPasswordResetDto: RequestPasswordResetDto) {
    const correo = requestPasswordResetDto.correo.trim().toLowerCase();

    const usuario = await this.usuariosRepository
      .createQueryBuilder('usuario')
      .addSelect('usuario.passwordResetTokenHash')
      .addSelect('usuario.passwordResetExpiresAt')
      .where('LOWER(usuario.correo) = :correo', { correo })
      .getOne();

    if (!usuario || !usuario.activo) {
      return {
        message: 'Si el correo existe, enviaremos un enlace de restablecimiento.',
      };
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashResetToken(token);
    const expiresAt = new Date(Date.now() + this.resetTokenTtlMinutes * 60 * 1000);

    await this.usuariosRepository.update(
      { id: usuario.id },
      {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: expiresAt,
      },
    );

    const link = this.buildResetLink(token);
    await this.sendResetPasswordEmail(usuario.correo, usuario.nombreCompleto, link);

    return {
      message: 'Si el correo existe, enviaremos un enlace de restablecimiento.',
    };
  }

  async confirmPasswordReset(confirmPasswordResetDto: ConfirmPasswordResetDto) {
    const token = confirmPasswordResetDto.token.trim();

    if (!token) {
      throw new BadRequestException('Token de restablecimiento invalido');
    }

    const tokenHash = this.hashResetToken(token);
    const ahora = new Date();

    const usuario = await this.usuariosRepository
      .createQueryBuilder('usuario')
      .addSelect('usuario.passwordHash')
      .addSelect('usuario.passwordResetTokenHash')
      .addSelect('usuario.passwordResetExpiresAt')
      .where('usuario.passwordResetTokenHash = :tokenHash', { tokenHash })
      .andWhere('usuario.passwordResetExpiresAt IS NOT NULL')
      .andWhere('usuario.passwordResetExpiresAt > :ahora', { ahora })
      .getOne();

    if (!usuario || !usuario.activo) {
      throw new BadRequestException('El enlace de restablecimiento no es valido o ya vencio');
    }

    const nuevoHash = await hash(confirmPasswordResetDto.newPassword, 12);

    await this.usuariosRepository.update(
      { id: usuario.id },
      {
        passwordHash: nuevoHash,
        mustChangePassword: false,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      },
    );

    return {
      message: 'Contrasena restablecida correctamente',
    };
  }

  async changeInitialPassword(changeInitialPasswordDto: ChangeInitialPasswordDto) {
    const correo = changeInitialPasswordDto.correo.trim().toLowerCase();

    const usuario = await this.usuariosRepository
      .createQueryBuilder('usuario')
      .addSelect('usuario.passwordHash')
      .where('LOWER(usuario.correo) = :correo', { correo })
      .getOne();

    if (!usuario || !usuario.activo || !usuario.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordActualValido = await compare(changeInitialPasswordDto.currentPassword, usuario.passwordHash);
    if (!passwordActualValido) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!usuario.mustChangePassword) {
      throw new BadRequestException('El usuario no requiere cambio inicial de contraseña');
    }

    if (changeInitialPasswordDto.currentPassword === changeInitialPasswordDto.newPassword) {
      throw new BadRequestException('La nueva contraseña debe ser diferente a la temporal');
    }

    const nuevoHash = await hash(changeInitialPasswordDto.newPassword, 12);

    await this.usuariosRepository.update(
      { id: usuario.id },
      {
        passwordHash: nuevoHash,
        mustChangePassword: false,
      },
    );

    return {
      message: 'Contraseña actualizada correctamente',
    };
  }
}