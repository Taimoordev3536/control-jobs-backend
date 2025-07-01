import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    canActivate(context: ExecutionContext) {
        console.log('JwtAuthGuard: Starting JWT validation');
        const request = context.switchToHttp().getRequest();
        console.log('JwtAuthGuard: Request headers:', request.headers);

        return super.canActivate(context);
    }

    handleRequest(err: any, user: any, info: any) {
        console.log('JwtAuthGuard: Handling request');
        console.log('JwtAuthGuard: Error:', err);
        console.log('JwtAuthGuard: User:', user);
        console.log('JwtAuthGuard: Info:', info);

        if (err || !user) {
            throw err || new UnauthorizedException('Invalid token or user not found');
        }
        return user;
    }
}
