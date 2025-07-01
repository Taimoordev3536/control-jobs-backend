import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReceiptsService } from './receipts.service';
import { ReceiptsController } from './receipts.controller';

import { UsersModule } from '../users/users.module';
import { AwsModule } from '../aws/aws.module';
import { Receipt } from './receipts.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Receipt]),
    UsersModule, // For user-related operations
    AwsModule, // For S3 image uploads
  ],
  providers: [ReceiptsService],
  controllers: [ReceiptsController],
  exports: [ReceiptsService],
})
export class ReceiptsModule {}
