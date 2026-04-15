import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SubUsersService } from './sub-users.service';
import { CreateSubUserDto } from './dto/create-sub-user.dto';
import { UpdateSubUserDto } from './dto/update-sub-user.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { UserRole } from '../auth/enums/user-role.enum';

@Controller('sub-users')
export class SubUsersController {
  constructor(private readonly service: SubUsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Partner, UserRole.Employer, UserRole.Client)
  async list(@Request() req) {
    const data = await this.service.list(req.user);
    return { isSuccess: true, statusCode: 200, message: 'Sub-users retrieved', data };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Partner, UserRole.Employer, UserRole.Client)
  async create(@Request() req, @Body() dto: CreateSubUserDto) {
    const data = await this.service.create(req.user, dto);
    return { isSuccess: true, statusCode: 201, message: 'Sub-user invited', data };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Partner, UserRole.Employer, UserRole.Client)
  async update(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubUserDto,
  ) {
    const data = await this.service.update(req.user, id, dto);
    return { isSuccess: true, statusCode: 200, message: 'Sub-user updated', data };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Partner, UserRole.Employer, UserRole.Client)
  async remove(@Request() req, @Param('id', ParseIntPipe) id: number) {
    const data = await this.service.remove(req.user, id);
    return { isSuccess: true, statusCode: 200, message: 'Sub-user deactivated', data };
  }

  @Post(':id/reset-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Partner, UserRole.Employer, UserRole.Client)
  async resetPassword(@Request() req, @Param('id', ParseIntPipe) id: number) {
    const data = await this.service.resetPassword(req.user, id);
    return { isSuccess: true, statusCode: 200, message: 'Password reset link generated', data };
  }

  @Post(':id/resend-invite')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.Partner, UserRole.Employer, UserRole.Client)
  async resendInvite(@Request() req, @Param('id', ParseIntPipe) id: number) {
    const data = await this.service.resendInvite(req.user, id);
    return { isSuccess: true, statusCode: 200, message: 'Invite re-generated', data };
  }

  // Public — consumed by the invite-acceptance page (no JWT guard; token is in body).
  @Post('accept-invite')
  async acceptInvite(@Body() dto: AcceptInviteDto) {
    const data = await this.service.acceptInvite(dto.token, dto.password);
    return { isSuccess: true, statusCode: 200, message: 'Invite accepted', data };
  }
}
