import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminConfig } from './entities/admin-config.entity';
import { UpdateAdminConfigDto } from './dto/update-admin-config.dto';

@Injectable()
export class AdminConfigService {
  constructor(
    @InjectRepository(AdminConfig)
    private readonly configRepo: Repository<AdminConfig>,
  ) {}

  async getConfig(): Promise<AdminConfig> {
  const config = await this.configRepo.findOne({ where: {} });
  if (!config) {
    throw new NotFoundException('System configuration not found');
  }
  return config;
}

async updateConfig(dto: UpdateAdminConfigDto): Promise<AdminConfig> {
  const existing = await this.configRepo.findOne({ where: {} });
  if (!existing) {
    const created = this.configRepo.create(dto);
    return this.configRepo.save(created);
  }

  Object.assign(existing, dto);
  return this.configRepo.save(existing);
}
}