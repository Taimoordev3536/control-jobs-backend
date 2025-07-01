export interface BaseResponse<T = any> {
    message: string;
    data: T;
    isSuccess: boolean;
    statusCode: number;
    developerError?: string;
} 