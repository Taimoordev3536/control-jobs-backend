import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { Employer } from '../../modules/employers/entities/employer.entity';
import { PartnerUser } from '../../modules/partners/entities/partner-user.entity';
import { DuplicateEmailException } from '../exceptions/duplicate-email.exception';

@Injectable()
export class EmailCheckerService {
    constructor(
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(PartnerUser)
        private readonly partnerUserRepository: Repository<PartnerUser>,
        @InjectRepository(Employer)
        private readonly employerRepository: Repository<Employer>,
    ) { }

    /**
     * Check if email is unique across all entities
     * @param email - Email to check
     * @throws DuplicateEmailException if email is already registered
     */
    async checkEmailUnique(email: string): Promise<void> {
        const [user, partnerUser] = await Promise.all([
            this.userRepository.findOne({ where: { email } }),
            this.partnerUserRepository.findOne({
                where: { user: { email } },
                relations: ['user']
            })
        ]);

        if (user || partnerUser) {
            throw new DuplicateEmailException(email);
        }
    }

    /**
     * Check if email is unique for a specific user type
     * @param email - Email to check
     * @returns boolean indicating if email is unique
     */
    async isEmailUnique(email: string): Promise<boolean> {
        try {
            await this.checkEmailUnique(email);
            return true;
        } catch (error) {
            if (error instanceof DuplicateEmailException) {
                return false;
            }
            throw error;
        }
    }
} 