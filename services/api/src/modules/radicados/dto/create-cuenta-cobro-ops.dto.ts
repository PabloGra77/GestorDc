import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCuentaCobroOpsDto {
  @IsEmail()
  @MaxLength(150)
  correoSolicitado!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(30)
  numeroCcSolicitado!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombreSolicitado?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  documentosSolicitados!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observaciones?: string;

  /**
   * Datos de plantilla: objeto plano con campos de negocio.
   * Se limita su tamaño serializado a 32 KB para prevenir payloads abusivos.
   */
  @IsOptional()
  @IsObject()
  @ValidateIf((o: CreateCuentaCobroOpsDto) => o.datosPlantilla !== undefined)
  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined) return value;
    const serialized = JSON.stringify(value);
    if (serialized.length > 32768) {
      throw new Error('datosPlantilla excede el tamaño permitido (32 KB)');
    }
    return value;
  })
  datosPlantilla?: Record<string, unknown>;
}

