import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminConfigController } from './admin-config.controller';
import { AdminConfigService } from './admin-config.service';
import { AdminConfig } from './entities/admin-config.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AdminConfig])],
  controllers: [AdminConfigController],
  providers: [AdminConfigService],
})
export class AdminConfigModule {}
