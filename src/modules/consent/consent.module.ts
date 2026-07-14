import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationConsent } from './entities/location-consent.entity';
import { ConsentService } from './consent.service';
import { ConsentController } from './consent.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LocationConsent])],
  providers: [ConsentService],
  controllers: [ConsentController],
  exports: [ConsentService],
})
export class ConsentModule {}
