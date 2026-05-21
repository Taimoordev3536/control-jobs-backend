import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString } from 'class-validator';
import { CreateWorkerDto } from './create-worker.dto';

export class UpdateWorkerDto extends PartialType(CreateWorkerDto) {
  @IsString()
  @IsOptional()
  code?: string;
}
