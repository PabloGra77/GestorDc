import { IsString, MaxLength, MinLength } from 'class-validator';

export class ConfirmPasswordResetDto {
  @IsString()
  @MinLength(32)
  @MaxLength(255)
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(255)
  newPassword!: string;
}
