import { Controller, Get, Put, Body } from '@nestjs/common';
import { AdminConfigService } from './admin-config.service';
import { UpdateAdminConfigDto } from './dto/update-admin-config.dto';

@Controller('admin/config')
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
