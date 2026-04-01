import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (
        typeof exceptionResponse === 'object' &&
        'message' in exceptionResponse
      ) {
        const raw = (exceptionResponse as any).message;

        if (Array.isArray(raw)) {
          return response.status(status).json({
            success: false,
            statusCode: status,
            message: 'Ошибка валидации',
            errors: raw,
          });
        }

        return response.status(status).json({
          success: false,
          statusCode: status,
          message: raw,
        });
      }

      return response.status(status).json({
        success: false,
        statusCode: status,
        message:
          typeof exceptionResponse === 'string'
            ? exceptionResponse
            : 'Произошла ошибка',
      });
    }

    return response.status(500).json({
      success: false,
      statusCode: 500,
      message: 'Внутренняя ошибка сервера',
    });
  }
}
