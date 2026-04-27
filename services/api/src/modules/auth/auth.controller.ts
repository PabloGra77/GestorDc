import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { ChangeInitialPasswordDto } from './dto/change-initial-password.dto';
import { LoginDto } from './dto/login.dto';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Máximo 10 intentos de login por minuto por IP */
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /** Máximo 5 solicitudes de reset por minuto por IP */
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('password-reset/request')
  requestPasswordReset(@Body() requestPasswordResetDto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(requestPasswordResetDto);
  }

  /** Máximo 5 confirmaciones de reset por minuto por IP */
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('password-reset/confirm')
  confirmPasswordReset(@Body() confirmPasswordResetDto: ConfirmPasswordResetDto) {
    return this.authService.confirmPasswordReset(confirmPasswordResetDto);
  }

  /** Requiere sesión JWT activa — previene abuso sin sesión válida */
  @UseGuards(JwtAuthGuard)
  @Post('change-initial-password')
  changeInitialPassword(@Body() changeInitialPasswordDto: ChangeInitialPasswordDto) {
    return this.authService.changeInitialPassword(changeInitialPasswordDto);
  }
}
