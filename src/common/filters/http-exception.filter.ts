import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { BaseResponse } from '../interfaces/base-response.interface';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: any, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        const status =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        const errorResponse: BaseResponse = {
            message: exception?.response?.message || exception.message || 'Internal server error',
            data: null,
            isSuccess: false,
            statusCode: status,
            developerError: process.env.NODE_ENV === 'development' ? exception.stack : '',
        };

        response.status(status).json(errorResponse);
    }
} 