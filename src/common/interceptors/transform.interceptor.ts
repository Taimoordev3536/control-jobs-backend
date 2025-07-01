import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseResponse } from '../interfaces/base-response.interface';

@Injectable()
export class TransformInterceptor<T>
    implements NestInterceptor<T, BaseResponse<T>> {
    intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Observable<BaseResponse<T>> {
        return next.handle().pipe(
            map((data) => ({
                message: data?.message || 'Success',
                data: data?.data || data || {},
                isSuccess: true,
                statusCode: context.switchToHttp().getResponse().statusCode || HttpStatus.OK,
                developerError: '',
            })),
        );
    }
} 