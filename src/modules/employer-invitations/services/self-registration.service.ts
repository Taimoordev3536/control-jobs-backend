import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Partner } from '../../partners/entities/partner.entity';
import { EmployersService } from '../../employers/employers.service';
import { SelfRegisterEmployerDto } from '../dto/self-register.dto';
import { EmailVerificationService } from '../../../common/services/email-verification.service';

@Injectable()
export class SelfRegistrationService {
  private readonly logger = new Logger(SelfRegistrationService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Partner)
    private readonly partnerRepo: Repository<Partner>,
    private readonly configService: ConfigService,
    private readonly employersService: EmployersService,
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  /**
   * Public self-registration. Creates a new Employer + User under the
   * platform's "system" partner (configured via SYSTEM_PARTNER_ID).
   * Sends a verification email; the user must confirm before logging in.
   */
  async register(
    dto: SelfRegisterEmployerDto,
    _deviceInfo?: string | null,
    _ipAddress?: string | null,
  ): Promise<{
    requiresEmailVerification: true;
    email: string;
    employerId: number;
  }> {
    // ---- Honeypot ----
    if (dto.website && dto.website.trim().length > 0) {
      this.logger.warn(`Honeypot triggered for self-register email=${dto.email}`);
      // Pretend success to discourage further attempts — but don't actually create anything.
      throw new BadRequestException('Invalid submission');
    }

    // ---- Resolve system partner ----
    const systemPartnerIdRaw = this.configService.get<string>('SYSTEM_PARTNER_ID');
    const systemPartnerId = Number(systemPartnerIdRaw);
    if (!Number.isFinite(systemPartnerId) || systemPartnerId <= 0) {
      this.logger.error('SYSTEM_PARTNER_ID is not configured');
      throw new BadRequestException('Self-registration is currently disabled');
    }
    const partner = await this.partnerRepo.findOne({ where: { id: systemPartnerId } });
    if (!partner) {
      this.logger.error(`SYSTEM_PARTNER_ID=${systemPartnerId} does not exist`);
      throw new BadRequestException('Self-registration is currently misconfigured');
    }

    // ---- Email duplicate check ----
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new BadRequestException('An account already exists with this email');
    }

    // ---- Delegate to EmployersService.create (snapshots rates, sets trial) ----
    const result = await this.employersService.create({
      name: dto.name,
      taxId: dto.taxId,
      address: dto.address,
      street: dto.street,
      streetNumber: dto.streetNumber,
      floorDoor: dto.floorDoor,
      postalCode: dto.postalCode,
      city: dto.city,
      province: dto.province,
      country: dto.country,
      latitude: dto.latitude,
      longitude: dto.longitude,
      partnerId: String(systemPartnerId),  // forced; client value ignored
      phone: dto.phone || dto.mobile,
      mobile: dto.mobile,
      landline: dto.landline,
      typeId: dto.typeId,
      subTypeId: dto.subTypeId,
      discount: 0,                          // forced 0 for self-signups
      paymentMethodId: null,
      accountIban: '',
      bicSwift: '',
      probationPeriod: '15',
      responsible: dto.responsible || dto.name,
      accessAccountStatus: 'request',
      accessEmail: dto.email,
      user: {
        email: dto.email,
        password: dto.password,
      },
    } as any);

    const employerId = (result?.data as any)?.id;

    const newUser = await this.userRepo.findOne({ where: { email: dto.email } });
    if (!newUser) {
      throw new BadRequestException('Account created but user lookup failed');
    }

    await this.emailVerificationService.issueToken(
      newUser.id,
      dto.responsible || dto.name,
    );

    return {
      requiresEmailVerification: true,
      email: newUser.email,
      employerId,
    };
  }
}
