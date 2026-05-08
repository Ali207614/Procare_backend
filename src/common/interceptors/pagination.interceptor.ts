import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class PaginationInterceptor<T> implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data: { rows: T[]; total: number; limit: number; offset: number }) => {
        if (data && Array.isArray(data.rows) && typeof data.total === 'number') {
          return {
            meta: {
              total: data.total,
              limit: data.limit,
              offset: data.offset,
            },
            data: data.rows,
          };
        }
        return data;
      }),
    );
  }
}
