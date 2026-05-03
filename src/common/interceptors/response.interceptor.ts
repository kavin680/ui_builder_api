import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RESULT_MESSAGE_KEY } from '../decorators/result-message.decorator';

export interface Response<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
  error: null;
  statusCode: number;
  requestId: string;
  excessiveData?: boolean;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
  constructor(private reflector: Reflector) { }

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();
    const response = httpContext.getResponse();
    const statusCode = response.statusCode;
    const requestId = request['requestId'];

    const decoratorMessage = this.reflector.getAllAndOverride<string>(
      RESULT_MESSAGE_KEY,
      [context.getHandler(), context.getClass()],
    );

    return next.handle().pipe(
      map((result) => {
        // Support for responses that already include meta (e.g. { data, meta })
        const data = result?.data !== undefined ? result.data : result;
        const meta = result?.meta;
        const excessiveData = result?.excessiveData || false;

        // Extract message from data if it exists, otherwise use decorator or default
        const message = decoratorMessage || result?.message || 'Request successful';

        // Final data unwrapping
        let finalData = data;
        if (data && typeof data === 'object') {
          // If the original data was just {message, ...}, we already extracted the message
          if (data.message && Object.keys(data).length === 2 && data.processedConfigs) {
            finalData = data.processedConfigs;
          }
        }

        return {
          success: true,
          message,
          data: finalData,
          excessiveData,
          ...(meta && { meta }),
          error: null,
          statusCode,
          requestId,
        };
      }),
    );
  }
}
