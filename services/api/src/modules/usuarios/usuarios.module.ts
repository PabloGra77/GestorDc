import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleEntity } from '../roles/role.entity';
import { UsuarioEntity } from './usuario.entity';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

@Module({
  imports: [TypeOrmModule.forFeature([UsuarioEntity, RoleEntity])],
  controllers: [UsuariosController],
  providers: [UsuariosService],
  exports: [UsuariosService, TypeOrmModule],
})
export class UsuariosModule {}
