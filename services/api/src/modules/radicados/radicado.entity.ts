import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'radicados' })
@Index('UQ_radicados_numero', ['numero'], { unique: true })
@Index('UQ_radicados_referencia', ['referencia'], { unique: true })
export class RadicadoEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 50 })
  numero!: string;

  @Column({ type: 'varchar', length: 80 })
  referencia!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  asunto?: string | null;

  @Column({ type: 'varchar', length: 30, default: 'Radicado' })
  estado!: string;

  @Column({ type: 'varchar', length: 30, default: 'General' })
  tipo!: string;

  @Column({ name: 'solicitante_correo', type: 'varchar', length: 150, nullable: true })
  solicitanteCorreo?: string | null;

  @Column({ name: 'solicitante_cc', type: 'varchar', length: 30, nullable: true })
  solicitanteCc?: string | null;

  @Column({ name: 'documentos_solicitados', type: 'jsonb', nullable: true })
  documentosSolicitados?: string[] | null;

  @Column({ name: 'documentos_adjuntos', type: 'jsonb', nullable: true })
  documentosAdjuntos?: Array<{ nombre: string; archivo: string; cargadoEn: string }> | null;

  @Column({ name: 'datos_plantilla', type: 'jsonb', nullable: true })
  datosPlantilla?: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'creado_en', type: 'timestamp with time zone' })
  creadoEn!: Date;

  @UpdateDateColumn({ name: 'actualizado_en', type: 'timestamp with time zone' })
  actualizadoEn!: Date;
}
