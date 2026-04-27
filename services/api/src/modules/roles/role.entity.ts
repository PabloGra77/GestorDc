import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { UsuarioEntity } from '../usuarios/usuario.entity';

@Entity({ name: 'roles' })
export class RoleEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 80, unique: true })
  nombre!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  descripcion?: string | null;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  permisos!: Record<string, string[]>;

  @OneToMany(() => UsuarioEntity, (usuario) => usuario.rol)
  usuarios!: UsuarioEntity[];
}
