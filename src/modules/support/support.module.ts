import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportTicket } from './entities/support-ticket.entity';
import { Suggestion } from './entities/suggestion.entity';
import { User } from '../users/entities/user.entity';
import { AlertsModule } from '../realtime/alerts.module';
import { AuditModule } from '../audit/audit.module';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
  imports: [TypeOrmModule.forFeature([SupportTicket, Suggestion, User]), AlertsModule, AuditModule],
  controllers: [SupportController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
