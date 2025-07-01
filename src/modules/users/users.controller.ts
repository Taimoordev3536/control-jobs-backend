import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  Body,
  Request,
  Put,
} from '@nestjs/common';
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
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRoleDto: UpdateRoleDto,
  ) {
    return this.usersService.updateRole(id, updateRoleDto.role);
  }
}
