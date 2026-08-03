import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';

interface RequestLike {
  method?: string;
  originalUrl?: string;
}

interface ResponseLike {
  on(event: string, listener: () => void): unknown;
  statusCode?: number;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<RequestLike>();
    const res = context.switchToHttp().getResponse<ResponseLike>();

    const { method, originalUrl } = req;
    const start = Date.now();

    // ✅ LISTEN TO REAL RESPONSE END
    res.on('finish', () => {
      const statusCode = res.statusCode ?? 0;
      const duration = Date.now() - start;

      if (statusCode >= 500) {
        this.logger.error(
          `${method} ${originalUrl} ${statusCode} - ${duration}ms`,
        );
      } else if (statusCode >= 400) {
        this.logger.warn(
          `${method} ${originalUrl} ${statusCode} - ${duration}ms`,
        );
      } else {
        this.logger.log(
          `${method} ${originalUrl} ${statusCode} - ${duration}ms`,
        );
      }
    });

    return next.handle();
  }
}
