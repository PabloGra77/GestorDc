import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateCuentaCobroOpsDto } from './dto/create-cuenta-cobro-ops.dto';
import { CreateRadicadoDto } from './dto/create-radicado.dto';
import { SubmitCuentaCobroOpsDocumentosDto } from './dto/submit-cuenta-cobro-ops-documentos.dto';
import { RadicadosService } from './radicados.service';

@Controller('radicados')
export class RadicadosController {
  constructor(private readonly radicadosService: RadicadosService) {}

  /** Creación de radicado genérico — requiere sesión */
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createRadicadoDto: CreateRadicadoDto) {
    return this.radicadosService.create(createRadicadoDto);
  }

  @Post('cuentas-cobro-ops/solicitud')
  createCuentaCobroOpsSolicitud(@Body() dto: CreateCuentaCobroOpsDto) {
    return this.radicadosService.createCuentaCobroOpsSolicitud(dto);
  }

  @Get('cuentas-cobro-ops/verificar')
  verifyCuentaCobroOps(
    @Query('numero') numero?: string,
    @Query('cc') cc?: string,
  ) {
    return this.radicadosService.verifyCuentaCobroOps(numero, cc);
  }

  @Post('cuentas-cobro-ops/documentos')
  submitCuentaCobroOpsDocumentos(@Body() dto: SubmitCuentaCobroOpsDocumentosDto) {
    return this.radicadosService.submitCuentaCobroOpsDocumentos(dto);
  }

  @Get('verificar')
  verify(
    @Query('numero') numero?: string,
    @Query('referencia') referencia?: string,
  ) {
    return this.radicadosService.verify(numero, referencia);
  }
}
