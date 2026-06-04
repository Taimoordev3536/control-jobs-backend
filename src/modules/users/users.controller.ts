import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Body,
  Request,
  Put,
  Patch,
  Post,
  Delete,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CaslGuard } from '../auth/guards/casl.guard';
import { CheckPolicies } from '../auth/decorators/check-policies.decorator';
import { User } from './entities/user.entity';
import { AppAbility } from '../auth/casl/ability.factory';
import { BaseDto } from '../auth/dto/base.dto';
import { UserRole } from '../auth/enums/user-role.enum';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateAdminMeDto } from './dto/update-admin-me.dto';
import { Action } from '../auth/enums/action.enum';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard, CaslGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Get()
  @Roles(UserRole.Admin)
  @CheckPolicies((ability: AppAbility) => ability.can(Action.ManageUsers, 'all'))
  async getAllUsers(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
    @Query('search') search: string = '',
  ) {
    const { users } = await this.usersService.getAllUsers(page, limit, search);
    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role?.name,
      roleValue: user.role?.value,
    }));
  }

  @Get('dashboard')
  @CheckPolicies((ability: AppAbility) => ability.can(Action.ViewDashboard, User))
  async getDashboard(@Request() req) {
    const user = req.user;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role ? {
        id: user.role.id,
        name: user.role.name,
        value: user.role.value,
      } : null,
    };
  }

  @Put(':id/role')
  @Roles(UserRole.Admin)
  @CheckPolicies((ability: AppAbility) => ability.can(Action.ManageRoles, 'all'))
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRoleDto: UpdateRoleDto,
  ) {
    const numericId = await this.usersService.resolvePublicId(id);
    return this.usersService.updateRole(numericId, updateRoleDto.role);
  }

  // Admin self-service: read own profile (so the dropdown can fetch logoUrl).
  @Get('admin/me')
  @Roles(UserRole.Admin)
  async getAdminMe(@Request() req) {
    return this.usersService.getAdminMe(req.user.id);
  }

  @Patch('admin/me')
  @Roles(UserRole.Admin)
  async updateAdminMe(@Request() req, @Body() dto: UpdateAdminMeDto) {
    return this.usersService.updateAdminMe(req.user.id, dto);
  }

  // Admin self-service: upload/remove personal photo.
  @Post('admin/me/logo')
  @Roles(UserRole.Admin)
  @UseInterceptors(FileInterceptor('file'))
  async uploadAdminLogo(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.usersService.setAdminLogo(req.user.id, file);
  }

  @Delete('admin/me/logo')
  @Roles(UserRole.Admin)
  async deleteAdminLogo(@Request() req) {
    return this.usersService.clearAdminLogo(req.user.id);
  }
}
