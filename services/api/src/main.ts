import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Solo loguear errores y advertencias en producción
    logger:
      process.env['APP_ENV'] === 'production'
        ? ['error', 'warn']
        : ['log', 'error', 'warn', 'debug'],
  });

  // ── Seguridad HTTP ─────────────────────────────────────────────────────────
  // Headers de seguridad: X-Content-Type-Options, X-Frame-Options, HSTS, etc.
  app.use(helmet());

  // Limitar tamaño del body para prevenir ataques de payload masivo
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { extended: false, limit: '1mb' });

  // CORS — solo permite el origen configurado (frontend)
  const allowedOrigin = (
    process.env['WEB_BASE_URL'] || 'http://127.0.0.1:3002'
  ).replace(/\/$/, '');

  app.enableCors({
    origin: allowedOrigin,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });

  // ── Pipeline global ────────────────────────────────────────────────────────
  app.setGlobalPrefix('api', {
    exclude: [{ path: '/', method: RequestMethod.GET }],
  });

  // Filtro global — impide que stack traces o detalles internos lleguen al cliente
  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env['APP_PORT'] || 3001);
  await app.listen(port, '0.0.0.0');
}

bootstrap();
