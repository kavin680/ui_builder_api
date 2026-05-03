import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    constructor(
        @InjectPinoLogger(LoggingInterceptor.name)
        private readonly logger: PinoLogger
    ) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const req = context.switchToHttp().getRequest();
        const { method, url } = req;
        const start = Date.now();

        return next.handle().pipe(
            tap(() => {
                const duration = Date.now() - start;
                this.logger.info({
                    method,
                    url,
                    duration: `${duration}ms`,
                    type: 'DOMAIN_LOG'
                }, 'Request processed');
            }),
        );
    }
}