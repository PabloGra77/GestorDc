import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class DocumentoAdjuntoOpsDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  nombre!: string;

  /**
   * Nombre de archivo seguro: solo caracteres alfanuméricos, guiones, puntos y
   * guiones bajos. NO se permiten secuencias de path traversal (.. / /).
   */
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Matches(/^[a-zA-Z0-9_\-\.]+$/, {
    message: 'El nombre de archivo solo puede contener letras, números, guiones, puntos y guiones bajos',
  })
  archivo!: string;
}

export class SubmitCuentaCobroOpsDocumentosDto {
  @IsString()
  @MinLength(8)
  @MaxLength(50)
  numeroRadicado!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(30)
  numeroCc!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => DocumentoAdjuntoOpsDto)
  documentos!: DocumentoAdjuntoOpsDto[];
}

