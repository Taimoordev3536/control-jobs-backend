import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class PassportLocalHelperGuard extends AuthGuard('local-helper') {}
