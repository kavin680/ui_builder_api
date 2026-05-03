import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class BigIntInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => this.serialize(data, new WeakSet())));
  }

  private serialize(obj: any, visited: WeakSet<any>): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'bigint') {
      return obj.toString();
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    // Defensive check: Do not serialize circular or massive complex objects (like Express Response)
    if (visited.has(obj)) {
      return '[Circular]';
    }

    // Skip serialization for complex objects like internal Request/Response
    if (obj.constructor && obj.constructor.name !== 'Object' && !Array.isArray(obj)) {
      // If it's a date or other known simple object, return as is
      if (obj instanceof Date) return obj;

      // SPECIFIC SAFEGUARD: Handle Decimal objects safely by converting to string
      // This prevents JSON.stringify from hitting Decimal.prototype.toJSON and failing
      if (obj.constructor.name === 'Decimal') return obj.toString();

      return obj;
    }

    visited.add(obj);

    if (Array.isArray(obj)) {
      return obj.map((item) => this.serialize(item, visited));
    }

    const newObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        newObj[key] = this.serialize(obj[key], visited);
      }
    }
    return newObj;
  }
}

