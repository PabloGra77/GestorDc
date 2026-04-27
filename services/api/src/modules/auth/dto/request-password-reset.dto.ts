import { IsEmail, MaxLength } from 'class-validator';

export class RequestPasswordResetDto {
  @IsEmail()
  @MaxLength(120)
  correo!: string;
}
