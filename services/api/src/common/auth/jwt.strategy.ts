import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { UsuarioEntity } from '../../modules/usuarios/usuario.entity';

export interface JwtPayload {
  sub: number;
  correo: string;
}

/**
 * Estrategia Passport JWT.
 * Valida el token Bearer y devuelve el usuario activo de la BD.
 * El objeto retornado queda disponible como `request.user` en los controladores.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(UsuarioEntity)
    private readonly usuariosRepository: Repository<UsuarioEntity>,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<UsuarioEntity> {
    const usuario = await this.usuariosRepository.findOne({
      where: { id: payload.sub, activo: true },
    });

    if (!usuario) {
      throw new UnauthorizedException('Sesión no válida o usuario inactivo');
    }

    return usuario;
  }
}
