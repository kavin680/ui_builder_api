import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = randomUUID();
    
    // Attach to request object for use in interceptors/filters and Pino logging
    req['id'] = requestId; // Pino-standard
    req['requestId'] = requestId; // Internal consistency
    
    // Also attach to response headers for client-side traceability
    res.setHeader('X-Request-ID', requestId);
    
    next();
  }
}
