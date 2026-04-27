import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuarioEntity } from '../usuarios/usuario.entity';
import { RadicadoEntity } from './radicado.entity';
import { RadicadosController } from './radicados.controller';
import { RadicadosService } from './radicados.service';

@Module({
  imports: [TypeOrmModule.forFeature([RadicadoEntity, UsuarioEntity])],
  controllers: [RadicadosController],
  providers: [RadicadosService],
})
export class RadicadosModule {}
