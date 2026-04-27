import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangeInitialPasswordDto {
  @IsEmail()
  @MaxLength(120)
  correo!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(255)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(255)
  newPassword!: string;
}
