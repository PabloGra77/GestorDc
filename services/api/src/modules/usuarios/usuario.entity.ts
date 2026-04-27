import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { RoleEntity } from '../roles/role.entity';

@Entity({ name: 'usuarios' })
export class UsuarioEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'primer_nombre', type: 'varchar', length: 60, nullable: true })
  primerNombre?: string | null;

  @Column({ name: 'segundo_nombre', type: 'varchar', length: 60, nullable: true })
  segundoNombre?: string | null;

  @Column({ name: 'primer_apellido', type: 'varchar', length: 60, nullable: true })
  primerApellido?: string | null;

  @Column({ name: 'segundo_apellido', type: 'varchar', length: 60, nullable: true })
  segundoApellido?: string | null;

  @Column({ name: 'tipo_documento', type: 'varchar', length: 10, nullable: true })
  tipoDocumento?: string | null;

  @Column({ name: 'numero_documento', type: 'varchar', length: 30, nullable: true })
  numeroDocumento?: string | null;

  @Column({ name: 'nombre_completo', type: 'varchar', length: 150 })
  nombreCompleto!: string;

  @Column({ type: 'varchar', length: 120, unique: true })
  correo!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  area?: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  permisos!: Record<string, string[]>;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true, select: false })
  passwordHash?: string | null;

  @Column({ name: 'must_change_password', type: 'boolean', default: true })
  mustChangePassword!: boolean;

  @Column({ name: 'password_reset_token_hash', type: 'varchar', length: 255, nullable: true, select: false })
  passwordResetTokenHash?: string | null;

  @Column({ name: 'password_reset_expires_at', type: 'timestamptz', nullable: true, select: false })
  passwordResetExpiresAt?: Date | null;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @Column({ name: 'rol_id', type: 'int' })
  rolId!: number;

  @ManyToOne(() => RoleEntity, (rol) => rol.usuarios, {
    nullable: false,
    eager: true,
  })
  @JoinColumn({ name: 'rol_id' })
  rol!: RoleEntity;
}
