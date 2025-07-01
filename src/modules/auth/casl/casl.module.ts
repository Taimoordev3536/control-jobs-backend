import { Module } from '@nestjs/common';
import { AbilityFactory } from './ability.factory';
import { CaslGuard } from '../guards/casl.guard';

@Module({
  providers: [AbilityFactory, CaslGuard],
  exports: [AbilityFactory, CaslGuard],
})
export class CaslModule {}
