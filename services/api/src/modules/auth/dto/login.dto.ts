import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(120)
  correo!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(255)
  password!: string;
}