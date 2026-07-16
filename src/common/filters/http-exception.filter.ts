import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { BaseResponse } from '../interfaces/base-response.interface';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger('HttpExceptionFilter');

    catch(exception: any, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        const status =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        // Only messages carried by an intentional HttpException are meant for
        // the user. Any other error (DB driver errors, runtime failures) must
        // not leak internal details such as
        // `duplicate key value violates unique constraint "PK_..."`.
        let message: any;
        if (exception instanceof HttpException) {
            const res = exception.getResponse();
            message =
                (typeof res === 'object' && res !== null
                    ? (res as any).message
                    : res) || exception.message;
        } else {
            // Log the real cause server-side so it's still debuggable, but send
            // the client a generic, translatable message.
            this.logger.error(exception?.message || 'Unhandled error', exception?.stack);
            message = 'unexpectedError';
        }

        const errorResponse: BaseResponse = {
            message,
            data: null,
            isSuccess: false,
            statusCode: status,
            developerError: process.env.NODE_ENV === 'development' ? exception.stack : '',
        };

        response.status(status).json(errorResponse);
    }
}