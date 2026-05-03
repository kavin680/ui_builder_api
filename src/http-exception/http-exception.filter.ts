import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Catch()
export class HttpExceptionFilter<T> implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: T, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: any = 'Internal server error';
    let errorCode = 'INTERNAL_ERROR';
    let errorDetails: any = null;

    const requestId = request['requestId'];

    // We log the full exception object (including stack trace) internally. 
    // This is crucial for debugging production issues via logs without 
    // exposing internal system details to the API consumer.
    this.logger.error(`[requestId=${requestId}] [${new Date().toISOString()}] ${request.method} ${request.url} - Error:`, exception);

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else {
        message = (res as any).message || 'An error occurred';
        if (Array.isArray((res as any).message)) {
          // Normalize validation errors
          errorDetails = (res as any).message.map((msg: string) => {
            const [field] = msg.split(' ');
            return { field: field.toLowerCase(), message: msg };
          });
          message = 'Validation failed';
          errorCode = 'VALIDATION_ERROR';
        }
      }
      errorCode = errorCode === 'VALIDATION_ERROR' ? errorCode : (res as any).error || 'HTTP_ERROR';
    } 
    // Handle Prisma Known Request Errors
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          errorCode = 'UNIQUE_CONSTRAINT';
          const rawTarget = exception.meta?.target;
          const targets = Array.isArray(rawTarget) ? rawTarget : (typeof rawTarget === 'string' ? [rawTarget] : []);
          const friendlyFields = targets.map(t => this.formatFriendlyName(t));
          
          message = friendlyFields.length > 0 
            ? `A record with this ${friendlyFields.join(' and ')} already exists.` 
            : 'The record already exists';

          errorDetails = {
            fields: friendlyFields,
            message: `This value already exists and must be unique.`,
          };
          break;
        case 'P2003':
          status = HttpStatus.BAD_REQUEST;
          errorCode = 'FOREIGN_KEY_CONSTRAINT';
          message = 'Foreign key constraint failed';
          errorDetails = {
            field: (exception.meta?.field_name as string) || 'unknown',
            message: 'Invalid reference to a related record',
          };
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message = 'The requested record was not found';
          errorCode = 'NOT_FOUND';
          break;
        default:
          message = 'A database error occurred';
          errorCode = `DB_ERROR_${exception.code}`;
          break;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      errorCode = (exception as any).code || 'INTERNAL_ERROR';
    } else {
      // Catch-all for non-Error objects (rare in JS but possible)
      message = String(exception);
    }

    response.status(status).json({
      success: false,
      message,
      data: null,
      error: {
        code: errorCode,
        details: errorDetails,
      },
      statusCode: status,
      requestId,
    });
  }

  private formatFriendlyName(text: string): string {
    if (!text) return 'Unknown field';
    let clean = text
      .split('_')
      .filter((p) => p !== 'key' && p !== 'fkey' && p !== 'unique')
      .join(' ');
    
    return clean.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  }
}
