import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminConfig } from './entities/admin-config.entity';
import { BaseResponse } from '../../common/interfaces/base-response.interface';

@Injectable()
export class AdminService {
    constructor(
        @InjectRepository(AdminConfig)
        private readonly adminConfigRepository: Repository<AdminConfig>,
    ) { }

    /**
     * Get admin configuration
     * @returns Admin configuration data
     */
    async getConfig(): Promise<BaseResponse<AdminConfig>> {
        const config = await this.adminConfigRepository.findOne({
            where: { id: 1 },
        });

        if (!config) {
            throw new NotFoundException('Admin configuration not found');
        }

        return {
            message: 'Admin configuration retrieved successfully',
            data: config,
            isSuccess: true,
            statusCode: 200,
            developerError: '',
        };
    }

    /**
     * Update admin configuration
     * @param updateData - Configuration update data
     * @returns Updated configuration data
     */
    async updateConfig(updateData: Partial<AdminConfig>): Promise<BaseResponse<AdminConfig>> {
        const config = await this.adminConfigRepository.findOne({
            where: { id: 1 },
        });

        if (!config) {
            throw new NotFoundException('Admin configuration not found');
        }

        Object.assign(config, updateData);
        const updatedConfig = await this.adminConfigRepository.save(config);

        return {
            message: 'Admin configuration updated successfully',
            data: updatedConfig,
            isSuccess: true,
            statusCode: 200,
            developerError: '',
        };
    }
} 