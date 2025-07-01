import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { BaseResponse } from '../../common/interfaces/base-response.interface';
import { AdminConfig } from './entities/admin-config.entity';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
    constructor(private readonly adminService: AdminService) { }

    /**
     * Get admin configuration
     * @returns Admin configuration data
     */
    @Get('config')
    @Roles(1) // Admin role
    async getConfig(): Promise<BaseResponse<AdminConfig>> {
        return this.adminService.getConfig();
    }

    /**
     * Update admin configuration
     * @param updateData - Configuration update data
     * @returns Updated configuration data
     */
    @Patch('config')
    @Roles(1) // Admin role
    async updateConfig(@Body() updateData: Partial<AdminConfig>): Promise<BaseResponse<AdminConfig>> {
        return this.adminService.updateConfig(updateData);
    }
} 