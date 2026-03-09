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
      map((response) => {
        let message = 'Request successful';

        // Primitive responses
        if (!response || typeof response !== 'object') {
          return {
            status: 'success',
            message,
            data: response,
          };
        }

        const hasMessage = typeof response.message === 'string';

        if (hasMessage) {
          message = response.message;
        }

        // Prefer explicit data if present
        let payload =
          hasMessage && 'data' in response ? response.data : response;

        /**
         * 🔥 REMOVE DUPLICATE message INSIDE data
         */
        if (
          payload &&
          typeof payload === 'object' &&
          typeof payload.message === 'string'
        ) {
          const { message: _discard, ...rest } = payload;
          payload = rest;
        }

        /**
         * CASE 1: TypeORM findAndCount → [rows, total]
         */
        if (
          Array.isArray(payload) &&
          payload.length === 2 &&
          Array.isArray(payload[0]) &&
          typeof payload[1] === 'number'
        ) {
          payload = {
            items: payload[0],
            total: payload[1],
          };
        } else if (
          /**
           * CASE 2: buildPagination()
           * { data: [], pagination: {} }
           */
          payload &&
          typeof payload === 'object' &&
          Array.isArray(payload.data) &&
          payload.pagination
        ) {
          const { data, pagination, ...rest } = payload;
          payload = {
            items: data,
            pagination,
            ...rest, // keep extras
          };
        }

        /**
         * CASE 3: Only message, no data
         */
        if (hasMessage && (!payload || Object.keys(payload).length === 0)) {
          payload = null;
        }

        return {
          status: 'success',
          message,
          data: payload,
        };
      }),
    );
  }
}
