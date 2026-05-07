import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Request,
  Ip,
  Headers,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ImpersonateDto } from './dto/impersonate.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { BaseResponse } from '../../common/interfaces/base-response.interface';
import { RefreshTokenService } from './services/refresh-token.service';

interface RefreshDto {
  refreshToken: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly refreshTokenService: RefreshTokenService,
  ) { }

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
  async login(
    @Body() loginDto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<BaseResponse> {
    return this.authService.login(loginDto, userAgent ?? null, ip ?? null);
  }

  @Post('refresh')
  async refresh(
    @Body() body: RefreshDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<BaseResponse> {
    return this.authService.refresh(body.refreshToken, userAgent ?? null, ip ?? null);
  }

  @Post('logout')
  async logout(@Body() body: RefreshDto): Promise<BaseResponse> {
    return this.authService.logout(body?.refreshToken || null);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  async logoutAll(@Request() req): Promise<BaseResponse> {
    await this.refreshTokenService.revokeAllForUser(req.user.id);
    return {
      message: 'All sessions revoked',
      data: null,
      isSuccess: true,
      statusCode: 200,
      developerError: '',
    };
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
