import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateUsuarioDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  primerNombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  segundoNombre?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  primerApellido?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  segundoApellido?: string;

  @IsOptional()
  @IsString()
  @IsIn(['CC', 'CE', 'TI', 'PP', 'NIT'])
  tipoDocumento?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(30)
  numeroDocumento?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  nombreCompleto?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  correo?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  area?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(255)
  password?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(255)
  passwordHash?: string;

  @IsOptional()
  @IsInt()
  rolId?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsObject()
  permisos?: Record<string, string[]>;
}
