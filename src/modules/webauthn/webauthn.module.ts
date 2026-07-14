import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceCredential } from './entities/device-credential.entity';
import { WebauthnService } from './webauthn.service';
import { WebauthnController } from './webauthn.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DeviceCredential])],
  providers: [WebauthnService],
  controllers: [WebauthnController],
  exports: [WebauthnService],
})
export class WebauthnModule {}
