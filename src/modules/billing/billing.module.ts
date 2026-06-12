import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { RatePlan } from './entities/rate-plan.entity';
import { Invoice } from './entities/invoice.entity';
import { InvoiceWorkCenter } from './entities/invoice-workcenter.entity';
import { InvoiceWorker } from './entities/invoice-worker.entity';
import { InvoiceLine } from './entities/invoice-line.entity';
import { EmployerSubType } from '../employers/entities/employer-sub-type.entity';
import { EmployerType } from '../employers/entities/employer-type.entity';
import { Employer } from '../employers/entities/employer.entity';
import { EmployerWorker } from '../employers/entities/employer-worker.entity';
import { EmployerWorkCenter } from '../employers/entities/employer-work-center.entity';
import { WorkerUser } from '../workers/entities/worker-user.entity';
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { Partner } from '../partners/entities/partner.entity';
import { PartnerUser } from '../partners/entities/partner-user.entity';
import { PartnerTier } from '../partners/entities/partner-type.entity';
import { AdminConfig } from '../admin/entities/admin-config.entity';
import { PaymentMethod } from '../../shared/entities/payment-method.entity';
import { PricingService } from './services/pricing.service';
import { RatePlanService } from './services/rate-plan.service';
import { BillingPreviewService } from './services/billing-preview.service';
import { InvoiceService } from './services/invoice.service';
import { InvoicePdfService } from './services/invoice-pdf.service';
import { BillingCronService } from './services/billing-cron.service';
import { BillingAccessService } from './services/billing-access.service';
import { RatePlansController } from './controllers/rate-plans.controller';
import { BillingController } from './controllers/billing.controller';
import { InvoicesController } from './controllers/invoices.controller';
import { EmployersModule } from '../employers/employers.module';
import { CommonModule } from '../../common/common.module';
import { AlertsModule } from '../realtime/alerts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RatePlan,
      Invoice,
      InvoiceWorkCenter,
      InvoiceWorker,
      InvoiceLine,
      EmployerSubType,
      EmployerType,
      Employer,
      EmployerWorker,
      EmployerWorkCenter,
      WorkerUser,
      EmployerUser,
      Partner,
      PartnerUser,
      PartnerTier,
      AdminConfig,
      PaymentMethod,
    ]),
    ScheduleModule.forRoot(),
    forwardRef(() => EmployersModule),
    CommonModule,
    AlertsModule,
  ],
  controllers: [RatePlansController, BillingController, InvoicesController],
  providers: [
    PricingService,
    RatePlanService,
    BillingPreviewService,
    InvoiceService,
    InvoicePdfService,
    BillingCronService,
    BillingAccessService,
  ],
  exports: [
    PricingService,
    RatePlanService,
    BillingPreviewService,
    InvoiceService,
    InvoicePdfService,
    BillingAccessService,
  ],
})
export class BillingModule {}
