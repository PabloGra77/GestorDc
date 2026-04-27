import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateRadicadoDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  numero?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(80)
  referencia!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  asunto?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(150, { each: true })
  para?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(150, { each: true })
  cc?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  mensaje?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  adjuntos?: string[];
}
