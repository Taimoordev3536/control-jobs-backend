import { AwsService } from './aws.service';
import { Module } from '@nestjs/common';

@Module({
  imports: [],
  controllers: [],
  providers: [AwsService],
  exports: [AwsService],
})
export class AwsModule {}
