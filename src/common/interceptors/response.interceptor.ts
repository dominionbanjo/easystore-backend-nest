import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // If the response is an object
        if (data && typeof data === 'object') {
          const hasMessage = typeof data.message === 'string';

          // Case 1: ONLY message
          if (hasMessage && Object.keys(data).length === 1) {
            return {
              status: 'success',
              message: data.message,
              data: null,
            };
          }

          // Case 2: Has message + more fields
          if (hasMessage) {
            const { message, ...rest } = data; // remove message from data
            return {
              status: 'success',
              message,
              data: Object.keys(rest).length ? rest : null,
            };
          }

          // Case 3: No message → use default
          return {
            status: 'success',
            message: 'Request successful',
            data,
          };
        }

        // For non-objects (string, number, boolean)
        return {
          status: 'success',
          message: 'Request successful',
          data,
        };
      }),
    );
  }
}
