import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { RadicadosModule } from './modules/radicados/radicados.module';
import { RolesModule } from './modules/roles/roles.module';
import { RootController } from './root.controller';
import { UsuariosModule } from './modules/usuarios/usuarios.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Rate limiting global — configurable por endpoint
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // ventana de 1 minuto
        limit: 120, // 120 peticiones por minuto por IP (límite general)
      },
    ]),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: Number(configService.get<string>('DB_PORT')),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: configService.get<string>('DB_SYNCHRONIZE') === 'true',
        logging: configService.get<string>('DB_LOGGING') === 'true',
        retryAttempts: 10,
        retryDelay: 3000,
      }),
    }),

    AuthModule,
    RolesModule,
    UsuariosModule,
    RadicadosModule,
  ],
  controllers: [RootController, HealthController],
  providers: [],
})
export class AppModule {}