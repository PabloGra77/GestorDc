import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Filtro global de excepciones.
 * Garantiza que los errores nunca expongan stack traces ni detalles internos
 * al cliente. Solo devuelve información sanitizada.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Error interno del servidor';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        if (typeof resObj['message'] === 'string') {
          message = resObj['message'];
        } else if (Array.isArray(resObj['message'])) {
          message = resObj['message'] as string[];
        }
      }
    } else {
      // Error no controlado — loguear internamente sin exponer al cliente
      this.logger.error(
        `Excepción no controlada en ${request.method} ${request.url}: ` +
          (exception instanceof Error ? exception.message : String(exception)),
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
