/**
 * DataSource para TypeORM CLI (migraciones).
 *
 * USO:
 *   npm run migration:generate -- src/db/migrations/NombreMigracion
 *   npm run migration:run
 *   npm run migration:revert
 *
 * Este archivo NO se usa en runtime — solo lo usa la CLI de TypeORM.
 * El DataSource de runtime vive en app.module.ts (TypeOrmModule.forRootAsync).
 *
 * Para que funcione, debe existir un .env cargado con las variables DB_*.
 * La CLI carga dotenv automáticamente a través del script "typeorm" en package.json.
 */
import 'reflect-metadata';
import { config } from 'dotenv';
import { join } from 'path';
import { DataSource } from 'typeorm';

// Cargar variables de entorno del .env local
config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  // Siempre false en el datasource de CLI — las migraciones controlan el esquema
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',

  // Entidades: TypeORM las escanea para generar/comparar el esquema
  entities: [join(__dirname, '..', 'modules', '**', '*.entity.{ts,js}')],

  // Migraciones
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  migrationsTableName: 'typeorm_migrations',
});
