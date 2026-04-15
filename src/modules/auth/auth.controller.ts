import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
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
}
