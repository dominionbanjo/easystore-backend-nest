import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    const { method, originalUrl } = req;
    const start = Date.now();

    let statusCode = null; // track correct status

    return next.handle().pipe(
      catchError((err) => {
        // extract correct HTTP status
        statusCode = err.getStatus ? err.getStatus() : 500;

        this.logger.error(
          `${method} ${originalUrl} ${statusCode} - ${Date.now() - start}ms`,
        );

        return throwError(() => err);
      }),

      finalize(() => {
        // only log success here
        if (!statusCode) {
          statusCode = res.statusCode;
          this.logger.log(
            `${method} ${originalUrl} ${statusCode} - ${Date.now() - start}ms`,
          );
        }
      }),
    );
  }
}
