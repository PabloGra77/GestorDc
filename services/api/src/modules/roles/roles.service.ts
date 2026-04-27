import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RoleEntity } from './role.entity';
import { PermisosPorModulo, ROLES_PERMISSIONS_CATALOG } from './roles-permissions.catalog';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly rolesRepository: Repository<RoleEntity>,
  ) {}

  private normalizarPermisos(permisos?: PermisosPorModulo): PermisosPorModulo {
    if (!permisos || typeof permisos !== 'object') {
      return {};
    }

    const normalizado: PermisosPorModulo = {};

    for (const [modulo, disponibles] of Object.entries(ROLES_PERMISSIONS_CATALOG)) {
      const solicitados = Array.isArray(permisos[modulo]) ? permisos[modulo] : [];
      const disponiblesSet = new Set(disponibles as readonly string[]);
      const permitidos = solicitados.filter((permiso) => disponiblesSet.has(permiso));

      if (permitidos.length > 0) {
        normalizado[modulo] = [...new Set(permitidos)];
      }
    }

    return normalizado;
  }

  async create(createRoleDto: CreateRoleDto): Promise<RoleEntity> {
    const existente = await this.rolesRepository.findOne({
      where: { nombre: createRoleDto.nombre.trim() },
    });

    if (existente) {
      throw new ConflictException('Ya existe un rol con ese nombre');
    }

    const role = this.rolesRepository.create({
      nombre: createRoleDto.nombre.trim(),
      descripcion: createRoleDto.descripcion?.trim() || null,
      activo: createRoleDto.activo ?? true,
      permisos: this.normalizarPermisos(createRoleDto.permisos),
    });

    return this.rolesRepository.save(role);
  }

  async findAll(): Promise<RoleEntity[]> {
    return this.rolesRepository.find({
      order: { id: 'ASC' },
    });
  }

  async findOne(id: number): Promise<RoleEntity> {
    const role = await this.rolesRepository.findOne({
      where: { id },
    });

    if (!role) {
      throw new NotFoundException('Rol no encontrado');
    }

    return role;
  }

  async update(id: number, updateRoleDto: UpdateRoleDto): Promise<RoleEntity> {
    const role = await this.findOne(id);

    if (updateRoleDto.nombre && updateRoleDto.nombre.trim() !== role.nombre) {
      const existente = await this.rolesRepository.findOne({
        where: { nombre: updateRoleDto.nombre.trim() },
      });

      if (existente && existente.id !== id) {
        throw new ConflictException('Ya existe un rol con ese nombre');
      }
    }

    role.nombre = updateRoleDto.nombre?.trim() ?? role.nombre;
    role.descripcion =
      updateRoleDto.descripcion !== undefined
        ? updateRoleDto.descripcion?.trim() || null
        : role.descripcion;
    role.activo = updateRoleDto.activo ?? role.activo;
    role.permisos =
      updateRoleDto.permisos !== undefined
        ? this.normalizarPermisos(updateRoleDto.permisos)
        : role.permisos;

    return this.rolesRepository.save(role);
  }
}
