import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((response: unknown) => {
        let message = 'Request successful';

        // Primitive responses
        if (!response || typeof response !== 'object') {
          return {
            status: 'success',
            message,
            data: response,
          };
        }

        const body = response as Record<string, unknown>;
        const hasMessage = typeof body.message === 'string';

        if (hasMessage) {
          message = body.message as string;
        }

        // Prefer explicit data if present
        let payload: unknown = hasMessage && 'data' in body ? body.data : body;

        /**
         * 🔥 REMOVE DUPLICATE message INSIDE data
         */
        if (
          payload &&
          typeof payload === 'object' &&
          typeof (payload as Record<string, unknown>).message === 'string'
        ) {
          const rest = { ...(payload as Record<string, unknown>) };
          delete rest.message;
          payload = rest;
        }

        /**
         * CASE 1: TypeORM findAndCount → [rows, total]
         */
        if (Array.isArray(payload)) {
          const payloadArray = payload as unknown[];
          if (
            payloadArray.length === 2 &&
            Array.isArray(payloadArray[0]) &&
            typeof payloadArray[1] === 'number'
          ) {
            payload = {
              items: payloadArray[0],
              total: payloadArray[1],
            };
          }
        } else if (payload && typeof payload === 'object') {
          /**
           * CASE 2: buildPagination()
           * { data: [], pagination: {} }
           */
          const payloadObj = payload as Record<string, unknown>;
          const data = payloadObj.data;
          const hasDataArray = Array.isArray(data);
          const hasPagination = Boolean(payloadObj.pagination);

          if (hasDataArray && hasPagination) {
            const rest = { ...payloadObj };
            delete rest.data;
            delete rest.pagination;
            payload = {
              items: data,
              pagination: payloadObj.pagination,
              ...rest, // keep extras
            };
          }
        }

        /**
         * CASE 3: Only message, no data
         */
        if (
          hasMessage &&
          (!payload || Object.keys(payload as object).length === 0)
        ) {
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
