import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailCheckerService } from './services/email-checker.service';
import { User } from '../modules/users/entities/user.entity';
import { PartnerUser } from '../modules/partners/entities/partner-user.entity';
import { Employer } from '../modules/employers/entities/employer.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            User,
            PartnerUser,
            Employer
        ])
    ],
    providers: [EmailCheckerService],
    exports: [EmailCheckerService],
})
export class CommonModule { } 