import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard JWT — protege rutas que requieren sesión autenticada.
 * Extrae y valida el token Bearer del header Authorization.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
