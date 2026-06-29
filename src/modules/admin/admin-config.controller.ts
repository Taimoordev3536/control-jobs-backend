import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import { AdminConfigService } from './admin-config.service';
import { UpdateAdminConfigDto } from './dto/update-admin-config.dto';

@Controller('admin/config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.Admin)
export class AdminConfigController {
  constructor(private readonly adminConfigService: AdminConfigService) {}

  @Get()
  getConfig() {
    return this.adminConfigService.getConfig();
  }

  @Put()
  updateConfig(@Body() dto: UpdateAdminConfigDto) {
    return this.adminConfigService.updateConfig(dto);
  }
}
