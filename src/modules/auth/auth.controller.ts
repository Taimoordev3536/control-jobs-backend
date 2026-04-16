import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Request,
  Ip,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ImpersonateDto } from './dto/impersonate.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { BaseResponse } from '../../common/interfaces/base-response.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  /**
   * Register a new user
   * @param registerDto - Registration data
   * @returns Created user data with token
   */
  @Post('register')
  async register(@Body() registerDto: RegisterDto): Promise<BaseResponse> {
    return this.authService.register(registerDto);
  }

  /**
   * Login user
   * @param loginDto - Login credentials
   * @returns User data with token
   */
  @Post('login')
  async login(@Body() loginDto: LoginDto): Promise<BaseResponse> {
    return this.authService.login(loginDto);
  }

  /**
   * Get user profile
   * @param req - Request object with user data
   * @returns User profile data
   */
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req): Promise<BaseResponse> {
    return this.authService.getProfile(req.user.id);
  }

  /**
   * Returns the current session's sub-user context (if the caller is a sub-user).
   * Used by the frontend to decide whether to hide edit buttons and the Users menu.
   */
  @UseGuards(JwtAuthGuard)
  @Get('me/sub-user-context')
  async getSubUserContext(@Request() req): Promise<BaseResponse> {
    const subUser = req.user?.subUser || { isSubUser: false };
    return {
      isSuccess: true,
      statusCode: 200,
      message: 'Sub-user context',
      data: subUser,
      developerError: '',
    };
  }

  /**
   * Returns the current session's impersonation context.
   * Used by the frontend to show the impersonation banner.
   */
  @UseGuards(JwtAuthGuard)
  @Get('me/impersonation-context')
  async getImpersonationContext(@Request() req): Promise<BaseResponse> {
    const impersonation = req.user?.impersonation || { isImpersonating: false };
    return {
      isSuccess: true,
      statusCode: 200,
      message: 'Impersonation context',
      data: impersonation,
      developerError: '',
    };
  }

  /**
   * Impersonate a child user. Opens an impersonated session for the target user.
   * Only Admin(1), Partner(2), Employer(3) can impersonate.
   * Admin → Partner, Employer
   * Partner → Employer (own only)
   * Employer → Client, Worker (own only)
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(1, 2, 3)
  @Post('impersonate')
  async impersonate(
    @Request() req,
    @Body() dto: ImpersonateDto,
    @Ip() ip: string,
  ): Promise<BaseResponse> {
    return this.authService.impersonate(req.user, dto, ip);
  }
}
