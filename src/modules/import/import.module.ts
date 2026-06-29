import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employer } from '../employers/entities/employer.entity';
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { EmployerType } from '../employers/entities/employer-type.entity';
import { EmployerSubType } from '../employers/entities/employer-sub-type.entity';
import { Partner } from '../partners/entities/partner.entity';
import { PartnerTier } from '../partners/entities/partner-type.entity';
import { Role } from '../users/entities/role.entity';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { ClientsModule } from '../clients/clients.module';
import { WorkersModule } from '../workers/workers.module';
import { PartnersModule } from '../partners/partners.module';
import { EmployersModule } from '../employers/employers.module';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employer,
      EmployerUser,
      EmployerType,
      EmployerSubType,
      Partner,
      PartnerTier,
      Role,
      User,
    ]),
    UsersModule,
    ClientsModule,
    WorkersModule,
    PartnersModule,
    EmployersModule,
  ],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
