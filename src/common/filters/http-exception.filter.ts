import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const message =
      typeof rawResponse === 'object' && rawResponse !== null && 'message' in rawResponse
        ? (rawResponse as any).message
        : exception instanceof Error
        ? exception.message
        : 'An internal server error occurred.';

    this.logger.error(
      `HTTP ${status} Error on ${request.method} ${request.url}: ${
        exception instanceof Error ? exception.stack : JSON.stringify(exception)
      }`
    );

    // Never leak stack traces or internal raw error details to client in production
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: Array.isArray(message) ? message.join(', ') : message,
      error: status >= 500 ? 'Internal Server Error' : 'Bad Request',
    });
  }
}
