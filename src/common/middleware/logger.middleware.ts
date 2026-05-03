import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl } = req;
    const userAgent = req.get('user-agent') || '';
    const start = Date.now();

    this.logger.log(
      `Incoming Request: ${method} ${originalUrl} at ${new Date(start).toISOString()}`,
    );

    res.on('finish', () => {
      const { statusCode } = res;
      const end = Date.now();
      const duration = end - start;
      const contentLength = res.get('content-length') || 0;

      this.logger.log(
        `Response: ${method} ${originalUrl} ${statusCode} ${contentLength} - ${userAgent} Duration: ${duration}ms (Ended at ${new Date(end).toISOString()})`,
      );
    });

    next();
  }
}
