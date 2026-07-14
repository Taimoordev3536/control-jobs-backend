import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Invoice } from '../billing/entities/invoice.entity';
import { Autofactura } from '../billing/entities/autofactura.entity';
import { BankOperation } from '../billing/entities/bank-operation.entity';
import { Employer } from '../employers/entities/employer.entity';
import { EmployerInvitation } from '../employer-invitations/entities/employer-invitation.entity';
import { SupportTicket } from '../support/entities/support-ticket.entity';
import { Suggestion } from '../support/entities/suggestion.entity';
import { User } from '../users/entities/user.entity';
import { EmployersModule } from '../employers/employers.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Invoice,
      Autofactura,
      BankOperation,
      Employer,
      EmployerInvitation,
      SupportTicket,
      Suggestion,
      User,
    ]),
    EmployersModule,
    BillingModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
