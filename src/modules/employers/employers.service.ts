// employers/employers.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employer } from './entities/employer.entity';
import { EmployerHoliday } from './entities/employer-holiday.entity';
import { CreateEmployerDto } from './dto/create-employer.dto';
import { BaseResponse } from '../../common/interfaces/base-response.interface';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/entities/user.entity';
import { EmployerUser } from './entities/employer-user.entity';
import { EmployerType } from './entities/employer-type.entity';
import { EmployerSubType } from './entities/employer-sub-type.entity';
import { PaymentMethod } from '../../shared/entities/payment-method.entity';
import { UpdateEmployerDto } from './dto/update-employer.dto';
import { Role } from '../users/entities/role.entity';
import { Partner } from '../partners/entities/partner.entity';
import { isUUID } from 'class-validator';
import { randomBytes } from 'crypto';
import { EmailService } from '../../common/services/email.service';
import { RatePlanService } from '../billing/services/rate-plan.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { PaymentMethodsService } from '../payment-methods/payment-methods.service';

@Injectable()
export class EmployersService {
  constructor(
    @InjectRepository(Employer)
    private readonly employerRepository: Repository<Employer>,
    @InjectRepository(EmployerHoliday)
    private readonly holidayRepository: Repository<EmployerHoliday>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(EmployerUser)
    private readonly employerUserRepository: Repository<EmployerUser>,
    @InjectRepository(EmployerType)
    private readonly employerTypeRepository: Repository<EmployerType>,
    @InjectRepository(EmployerSubType)
    private readonly employerSubTypeRepository: Repository<EmployerSubType>,
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepository: Repository<PaymentMethod>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly emailService: EmailService,
    @Inject(forwardRef(() => RatePlanService))
    private readonly ratePlanService: RatePlanService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly paymentMethodsService: PaymentMethodsService,
  ) {}

  // Resolve the Employer.id linked to a given User.id via the EmployerUser
  // junction. JWT's `sub`/`id` is the User.id — `findOne` and `update` operate
  // on Employer.id, so all "me"-scoped employer endpoints must go through
  // this helper. (Without it, looking up `Employer where id = user.id` only
  // finds the right row by accident when the two numeric ids coincide.)
  async findEmployerIdByUserId(userId: number): Promise<number> {
    const link = await this.employerUserRepository.findOne({
      where: { user: { id: userId } },
      relations: ['employer'],
    });
    if (!link?.employer?.id) {
      throw new NotFoundException('No employer is linked to the current user');
    }
    return link.employer.id;
  }

  // "Me"-scoped variant of findOne: the old path did 4 sequential queries
  // (employerUser+employer, then employer again, employerUser+user again,
  // then partner) — each paying the remote-DB round trip. One joined query
  // returns the identical payload.
  async getMe(userId: number): Promise<BaseResponse<any>> {
    const link = await this.employerUserRepository
      .createQueryBuilder('eu')
      .innerJoinAndSelect('eu.employer', 'employer')
      .leftJoinAndSelect('eu.user', 'user')
      .leftJoinAndMapOne(
        'employer.__partner',
        Partner,
        'partner',
        'partner.id = employer."partnerId"',
      )
      .where('user.id = :userId', { userId })
      .getOne();

    if (!link?.employer) {
      throw new NotFoundException('No employer is linked to the current user');
    }

    const employer = link.employer as any;
    const partner: Partner | undefined = employer.__partner;
    delete employer.__partner;

    return {
      message: 'Employer retrieved successfully',
      data: {
        ...employer,
        email: link.user?.email || null,
        partnerId: partner?.publicId || employer.partnerId,
        trialDaysRemaining: computeTrialDaysRemaining(employer.trialEndsAt),
      },
      isSuccess: true,
      statusCode: 200,
      developerError: '',
    };
  }

  async getMyTariffs(userId: number) {
    const id = await this.findEmployerIdByUserId(userId);
    const e = await this.employerRepository.findOne({ where: { id } });
    if (!e) throw new NotFoundException('Employer not found');
    const n = (v: any) => (v != null ? Number(v) : null);
    return {
      billing: { fixedAmount: n(e.defBillingFixedAmount), hoursLabel: e.defBillingHoursLabel || 'Horas de servicio', hourRate: n(e.defBillingHourRate), vatPct: n(e.defBillingVatPct) ?? 21 },
      salary: { fixedAmount: n(e.defSalaryFixedAmount), hoursLabel: e.defSalaryHoursLabel || 'Horas de trabajo', hourRate: n(e.defSalaryHourRate) },
    };
  }

  async updateMyTariffs(userId: number, body: { billing?: any; salary?: any }) {
    const id = await this.findEmployerIdByUserId(userId);
    const e = await this.employerRepository.findOne({ where: { id } });
    if (!e) throw new NotFoundException('Employer not found');
    const s = (v: any) => (v == null || v === '' ? null : String(v));
    if (body.billing) {
      if (body.billing.fixedAmount !== undefined) e.defBillingFixedAmount = s(body.billing.fixedAmount);
      if (body.billing.hoursLabel !== undefined) e.defBillingHoursLabel = body.billing.hoursLabel || 'Horas de servicio';
      if (body.billing.hourRate !== undefined) e.defBillingHourRate = s(body.billing.hourRate);
      if (body.billing.vatPct !== undefined) e.defBillingVatPct = String(body.billing.vatPct ?? 0);
    }
    if (body.salary) {
      if (body.salary.fixedAmount !== undefined) e.defSalaryFixedAmount = s(body.salary.fixedAmount);
      if (body.salary.hoursLabel !== undefined) e.defSalaryHoursLabel = body.salary.hoursLabel || 'Horas de trabajo';
      if (body.salary.hourRate !== undefined) e.defSalaryHourRate = s(body.salary.hourRate);
    }
    await this.employerRepository.save(e);
    return this.getMyTariffs(userId);
  }

  async getMyHolidays(userId: number) {
    const employerId = await this.findEmployerIdByUserId(userId);
    const rows = await this.holidayRepository.find({ where: { employerId }, order: { date: 'ASC' } });
    return rows.map((h) => ({ id: h.publicId, date: h.date, name: h.name }));
  }

  async addMyHoliday(userId: number, body: { date?: string; name?: string }) {
    const employerId = await this.findEmployerIdByUserId(userId);
    if (!body.date) throw new BadRequestException('date is required');
    const existing = await this.holidayRepository.findOne({ where: { employerId, date: body.date } });
    if (existing) {
      existing.name = body.name || existing.name;
      await this.holidayRepository.save(existing);
      return { id: existing.publicId, date: existing.date, name: existing.name };
    }
    const rec = this.holidayRepository.create({ employerId, date: body.date, name: body.name || null });
    const saved = await this.holidayRepository.save(rec);
    return { id: saved.publicId, date: saved.date, name: saved.name };
  }

  async deleteMyHoliday(userId: number, publicId: string) {
    const employerId = await this.findEmployerIdByUserId(userId);
    const h = await this.holidayRepository.findOne({ where: { publicId, employerId } });
    if (!h) throw new NotFoundException('Holiday not found');
    await this.holidayRepository.delete(h.id);
    return { isSuccess: true };
  }

  async setLogo(
    id: number,
    file: Express.Multer.File,
  ): Promise<BaseResponse<{ logoUrl: string; logoPublicId: string }>> {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.mimetype)) {
      throw new BadRequestException('Logo must be PNG or JPEG');
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('Logo must be 2 MB or smaller');
    }

    const employer = await this.employerRepository.findOne({ where: { id } });
    if (!employer) throw new NotFoundException(`Employer ${id} not found`);

    const oldPublicId = employer.logoPublicId;
    const uploaded = await this.cloudinaryService.uploadImage(
      file.buffer,
      'controljobs/employer-logos',
    );
    employer.logoPublicId = uploaded.publicId;
    employer.logoUrl = uploaded.secureUrl;
    await this.employerRepository.save(employer);

    if (oldPublicId && oldPublicId !== uploaded.publicId) {
      await this.cloudinaryService.deleteImage(oldPublicId);
    }

    return {
      message: 'Logo updated',
      data: { logoUrl: uploaded.secureUrl, logoPublicId: uploaded.publicId },
      isSuccess: true,
      statusCode: 200,
    };
  }

  // Records the moment an employer adds (or changes) their payment method.
  // If they were sitting in AWAITING_PAYMENT_METHOD after a trial-end, this
  // also flips them to ACTIVE so the next monthly cron picks them up. The
  // captured timestamp is what the cron + preview prorate from.
  async recordPaymentMethod(
    employerId: number,
    paymentMethodId: number,
  ): Promise<BaseResponse<{ paymentMethodAddedAt: string; billingStatus: string }>> {
    const employer = await this.employerRepository.findOne({
      where: { id: employerId },
    });
    if (!employer) throw new NotFoundException(`Employer ${employerId} not found`);

    await this.paymentMethodsService.assertEligible(paymentMethodId, 'SELF_SERVICE');

    employer.paymentMethodId = paymentMethodId;
    employer.paymentMethodAddedAt = new Date();
    if (employer.billingStatus === 'AWAITING_PAYMENT_METHOD') {
      employer.billingStatus = 'ACTIVE';
    }
    await this.employerRepository.save(employer);

    return {
      message: 'Payment method recorded',
      data: {
        paymentMethodAddedAt: employer.paymentMethodAddedAt.toISOString(),
        billingStatus: employer.billingStatus,
      },
      isSuccess: true,
      statusCode: 200,
    };
  }

  async cancelSubscription(
    employerId: number,
  ): Promise<BaseResponse<{ billingStatus: string; cancelledAt: string }>> {
    const employer = await this.employerRepository.findOne({ where: { id: employerId } });
    if (!employer) throw new NotFoundException(`Employer ${employerId} not found`);
    if (employer.billingStatus === 'CANCELLED') {
      throw new BadRequestException('Subscription already cancelled');
    }
    employer.billingStatus = 'CANCELLED';
    await this.employerRepository.save(employer);
    return {
      message: 'Subscription cancelled',
      data: { billingStatus: 'CANCELLED', cancelledAt: new Date().toISOString() },
      isSuccess: true,
      statusCode: 200,
    };
  }

  async clearLogo(id: number): Promise<BaseResponse<null>> {
    const employer = await this.employerRepository.findOne({ where: { id } });
    if (!employer) throw new NotFoundException(`Employer ${id} not found`);

    const oldPublicId = employer.logoPublicId;
    employer.logoPublicId = null;
    employer.logoUrl = null;
    await this.employerRepository.save(employer);
    if (oldPublicId) await this.cloudinaryService.deleteImage(oldPublicId);

    return {
      message: 'Logo removed',
      data: null,
      isSuccess: true,
      statusCode: 200,
    };
  }

  async setProfilePhoto(
    id: number,
    file: Express.Multer.File,
  ): Promise<
    BaseResponse<{ profilePhotoUrl: string; profilePhotoPublicId: string }>
  > {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.mimetype)) {
      throw new BadRequestException('Profile photo must be PNG or JPEG');
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('Profile photo must be 2 MB or smaller');
    }

    const employer = await this.employerRepository.findOne({ where: { id } });
    if (!employer) throw new NotFoundException(`Employer ${id} not found`);

    const oldPublicId = employer.profilePhotoPublicId;
    const uploaded = await this.cloudinaryService.uploadImage(
      file.buffer,
      'controljobs/employer-profile-photos',
    );
    employer.profilePhotoPublicId = uploaded.publicId;
    employer.profilePhotoUrl = uploaded.secureUrl;
    await this.employerRepository.save(employer);

    if (oldPublicId && oldPublicId !== uploaded.publicId) {
      await this.cloudinaryService.deleteImage(oldPublicId);
    }

    return {
      message: 'Profile photo updated',
      data: {
        profilePhotoUrl: uploaded.secureUrl,
        profilePhotoPublicId: uploaded.publicId,
      },
      isSuccess: true,
      statusCode: 200,
    };
  }

  async clearProfilePhoto(id: number): Promise<BaseResponse<null>> {
    const employer = await this.employerRepository.findOne({ where: { id } });
    if (!employer) throw new NotFoundException(`Employer ${id} not found`);

    const oldPublicId = employer.profilePhotoPublicId;
    employer.profilePhotoPublicId = null;
    employer.profilePhotoUrl = null;
    await this.employerRepository.save(employer);
    if (oldPublicId) await this.cloudinaryService.deleteImage(oldPublicId);

    return {
      message: 'Profile photo removed',
      data: null,
      isSuccess: true,
      statusCode: 200,
    };
  }

  async resolvePublicId(publicId: string): Promise<number> {
    const employer = await this.employerRepository.findOne({ where: { publicId } });
    if (!employer) throw new NotFoundException('Employer not found');
    return employer.id;
  }

  private async resolvePartnerIdFromPublicId(idOrPublicId: string): Promise<number> {
    if (isUUID(idOrPublicId)) {
      const partner = await this.employerRepository.manager.findOne(Partner, { where: { publicId: idOrPublicId } });
      if (!partner) throw new NotFoundException(`Partner ${idOrPublicId} not found`);
      return partner.id;
    }
    const num = parseInt(idOrPublicId, 10);
    if (isNaN(num)) throw new BadRequestException(`Invalid partnerId: ${idOrPublicId}`);
    return num;
  }

  // ControlJobs (taxId='SYSTEM') is exempt and accepts 0–100. Any other
  // partner caps the discount at their own commission %.
  private async assertDiscountWithinCap(
    partnerId: number,
    discount: number | undefined | null,
  ): Promise<void> {
    if (discount === undefined || discount === null) return;
    const partner = await this.employerRepository.manager.findOne(Partner, {
      where: { id: partnerId },
    });
    if (!partner) throw new NotFoundException(`Partner ${partnerId} not found`);
    if (partner.taxId === 'SYSTEM') return;
    const cap = Number(partner.commission ?? 0);
    if (Number(discount) > cap) {
      throw new BadRequestException(
        `El descuento no puede exceder la comisión del ${cap}%`,
      );
    }
  }

  async create(
    createEmployerDto: CreateEmployerDto,
  ): Promise<BaseResponse<Employer>> {
    // Validate all relationships exist. paymentMethodId is now optional —
    // invitation-link signups intentionally leave it null (collected later
    // via the AWAITING_PAYMENT_METHOD flow). When the caller does pass an
    // id, we still verify it points at a real row.
    const [type, subType] = await Promise.all([
      this.employerTypeRepository.findOneBy({ id: createEmployerDto.typeId }),
      this.employerSubTypeRepository.findOneBy({
        id: createEmployerDto.subTypeId,
      }),
    ]);

    if (!type) throw new BadRequestException('Invalid employer type');
    if (!subType) throw new BadRequestException('Invalid employer sub-type');
    await this.paymentMethodsService.assertEligible(
      createEmployerDto.paymentMethodId ?? null,
      'ADMIN_ASSIGN',
    );

    // Resolve the matching rate plan so we can snapshot the rates onto the
    // new employer. Future price changes won't retroactively affect them.
    const ratePlan = await this.ratePlanService.findMatch(
      createEmployerDto.subTypeId,
      createEmployerDto.typeId,
    );

    // Compute trial_ends_at from probationPeriod (parsed as integer days,
    // default 0 = no trial = ACTIVE immediately).
    const trialDays = parseTrialDays(createEmployerDto.probationPeriod);
    const trialEndsAt = trialDays > 0 ? addDays(new Date(), trialDays) : null;
    const billingStatus = trialDays > 0 ? 'TRIAL' : 'ACTIVE';

    try {
      const resolvedPartnerId = await this.resolvePartnerIdFromPublicId(
        createEmployerDto.partnerId,
      );
      await this.assertDiscountWithinCap(
        resolvedPartnerId,
        createEmployerDto.discount,
      );

      // Start a transaction
      return await this.employerRepository.manager.transaction(
        async (manager) => {
          // Create employer (no email field anymore)
          const employer = manager.create(Employer, {
            name: createEmployerDto.name,
            taxId: createEmployerDto.taxId,
            address: createEmployerDto.address,
            street: createEmployerDto.street,
            streetNumber: createEmployerDto.streetNumber,
            floorDoor: createEmployerDto.floorDoor,
            postalCode: createEmployerDto.postalCode,
            city: createEmployerDto.city,
            province: createEmployerDto.province,
            country: createEmployerDto.country,
            latitude: createEmployerDto.latitude,
            longitude: createEmployerDto.longitude,
            partnerId: resolvedPartnerId,
            phone: createEmployerDto.phone,
            mobile: createEmployerDto.mobile,
            landline: createEmployerDto.landline,
            typeId: createEmployerDto.typeId,
            subTypeId: createEmployerDto.subTypeId,
            discount: createEmployerDto.discount,
            paymentMethodId: createEmployerDto.paymentMethodId ?? null,
            accountIban: createEmployerDto.accountIban,
            bicSwift: createEmployerDto.bicSwift,
            cardLast4: createEmployerDto.cardLast4 ?? null,
            paypalEmail: createEmployerDto.paypalEmail ?? null,
            probationPeriod: createEmployerDto.probationPeriod,
            responsible: createEmployerDto.responsible,
            accessAccountStatus: createEmployerDto.accessAccountStatus,
            // Plan binding only — actual rates are read live from
            // cjobs_rate_plans at billing time so admin price changes apply
            // simultaneously to all customers (after the 30-day notice).
            ratePlanId: ratePlan?.id ?? null,
            trialEndsAt,
            billingStatus,
          });

          const savedEmployer = await manager.save(Employer, employer);

          // Check if user email is already in use (now required field)
          const existingUser = await this.userRepository.findOne({
            where: { email: createEmployerDto.user.email },
          });
          if (existingUser) {
            throw new BadRequestException('Email already in use');
          }

          // Get employer role
          const employerRole = await this.roleRepository.findOne({
            where: { value: 3 }, // 3 is the value for Employer role
          });
          if (!employerRole) {
            throw new BadRequestException('Employer role not found');
          }

          // If the caller supplies a password (Method 2 invitation flow,
          // where the employer chose their own), use it. Otherwise auto-
          // generate one and email it (Method 1 admin/partner flow).
          const providedPassword = (createEmployerDto as any)?.user?.password;
          const rawPassword =
            typeof providedPassword === 'string' && providedPassword.length >= 8
              ? providedPassword
              : randomBytes(6).toString('base64').slice(0, 10);
          const hashedPassword = await bcrypt.hash(rawPassword, 10);

          // Create user (now required)
          const user = manager.create(User, {
            email: createEmployerDto.user.email,
            password: hashedPassword,
            firstName: createEmployerDto.user.firstName,
            lastName: createEmployerDto.user.lastName,
            roleId: employerRole.id,
            name: createEmployerDto.name, // Use employer name as user name
          });
          const savedUser = await manager.save(User, user);

          // Create employer-user link
          const employerUser = manager.create(EmployerUser, {
            employer: savedEmployer,
            user: savedUser,
            isDefault: true,
          });
          await manager.save(EmployerUser, employerUser);

          // Send credentials email if accessAccountStatus is 'request'
          if (createEmployerDto.accessAccountStatus === 'request') {
            try {
              // Use accessEmail if provided, otherwise use the main email
              const emailTo = createEmployerDto.accessEmail || createEmployerDto.user.email;
              
              // Send credentials to the specified email, but use the main email as login
              await this.emailService.sendUserCredentials(
                emailTo,
                createEmployerDto.name,
                rawPassword,
                'employer',
                createEmployerDto.user.email // This is the actual login email
              );
            } catch (emailError) {
              console.error('Failed to send employer credentials email:', emailError.message);
              // Continue with the process even if email fails
            }
          }

          return {
            message: 'Employer created successfully',
            data: {
              ...savedEmployer,
              generatedPassword: rawPassword, // Include the raw password in response
            },
            isSuccess: true,
            statusCode: 201,
            developerError: '',
          };
        },
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to create employer: ' + error.message,
      );
    }
  }

  /**
   * Get all employers
   * @returns List of all employers
   */
  async findAll(partnerId?: number): Promise<BaseResponse<any[]>> {
    try {
      const where: any = {};
      if (partnerId) {
        where.partnerId = partnerId;
      }
      const employers = await this.employerRepository.find({
        where,
        relations: ['type', 'subType', 'paymentMethod', 'partner'], // Added 'partner'
      });

      // Map to include names
      const mapped = employers.map((e) => ({
        id: e.id,
        publicId: e.publicId,
        name: e.name,
        class: e.subType?.name || null,
        type: e.type?.name || null,
        createdAt: e.createdAt,
        paymentMethod: e.paymentMethod?.name || null,
        partnerName: e.partner?.name || null, // Added partner name
        trialDaysRemaining: computeTrialDaysRemaining(e.trialEndsAt),
        // ...add any other fields you want to expose
      }));

      return {
        message: 'Employers retrieved successfully',
        data: mapped,
        isSuccess: true,
        statusCode: 200,
        developerError: '',
      };
    } catch (error) {
      throw new BadRequestException(
        'Failed to retrieve employers: ' + error.message,
      );
    }
  }

  /**
   * Get an employer by ID
   * @param id - Employer ID
   * @returns Employer data
   */
  async findOne(id: number): Promise<BaseResponse<any>> {
    try {
      const employer = await this.employerRepository.findOne({ where: { id } });
      if (!employer) {
        throw new NotFoundException(`Employer with ID ${id} not found`);
      }

      // Fetch the linked user's email via EmployerUser relation
      let email: string | null = null;
      const employerUser = await this.employerUserRepository.findOne({
        where: { employer: { id } },
        relations: ['user'],
      });
      if (employerUser?.user) {
        email = employerUser.user.email || null;
      }

      // Resolve numeric partnerId to partner publicId for frontend
      let partnerPublicId: string | null = null;
      if (employer.partnerId) {
        const partner = await this.employerRepository.manager.findOne(Partner, { where: { id: employer.partnerId } });
        if (partner) partnerPublicId = partner.publicId;
      }

      return {
        message: 'Employer retrieved successfully',
        data: {
          ...employer,
          email,
          partnerId: partnerPublicId || employer.partnerId,
          trialDaysRemaining: computeTrialDaysRemaining(employer.trialEndsAt),
        },
        isSuccess: true,
        statusCode: 200,
        developerError: '',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to retrieve employer: ' + error.message,
      );
    }
  }

  async findByPublicId(publicId: string): Promise<BaseResponse<any>> {
    const employer = await this.employerRepository.findOne({ where: { publicId } });
    if (!employer) throw new NotFoundException('Employer not found');
    return this.findOne(employer.id);
  }

  /**
   * Update an employer
   * @param id - Employer ID
   * @param updateEmployerDto - Employer update data
   * @returns Updated employer data
   */
  async update(
    id: number,
    updateEmployerDto: UpdateEmployerDto,
  ): Promise<BaseResponse<Employer>> {
    try {
      return await this.employerRepository.manager.transaction(
        async (manager) => {
          const employer = await manager.findOne(Employer, { where: { id } });
          if (!employer) {
            throw new NotFoundException(`Employer with ID ${id} not found`);
          }

          // Update employer data
          const { user: userData, partnerId: partnerIdRaw, ...employerData } = updateEmployerDto;
          const resolvedData: any = { ...employerData };
          if (partnerIdRaw !== undefined) {
            resolvedData.partnerId = await this.resolvePartnerIdFromPublicId(String(partnerIdRaw));
          }
          // If discount or partner is changing, re-validate against the
          // (possibly new) partner's commission cap.
          if (
            resolvedData.discount !== undefined ||
            resolvedData.partnerId !== undefined
          ) {
            const effectivePartnerId =
              resolvedData.partnerId ?? employer.partnerId;
            const effectiveDiscount =
              resolvedData.discount !== undefined
                ? resolvedData.discount
                : employer.discount;
            await this.assertDiscountWithinCap(
              effectivePartnerId,
              effectiveDiscount,
            );
          }

          if (resolvedData.paymentMethodId !== undefined) {
            await this.paymentMethodsService.assertEligible(
              resolvedData.paymentMethodId,
              'ADMIN_ASSIGN',
            );
          }

          const typeChanging =
            resolvedData.typeId !== undefined &&
            Number(resolvedData.typeId) !== Number(employer.typeId);
          const subTypeChanging =
            resolvedData.subTypeId !== undefined &&
            Number(resolvedData.subTypeId) !== Number(employer.subTypeId);
          if (typeChanging || subTypeChanging) {
            const newSubTypeId = Number(resolvedData.subTypeId ?? employer.subTypeId);
            const newTypeId = Number(resolvedData.typeId ?? employer.typeId);
            const match = await this.ratePlanService.findMatch(newSubTypeId, newTypeId);
            if (!match) {
              throw new BadRequestException(
                'No active rate plan for this Clase/Tarifa combination',
              );
            }
            const effective = this.ratePlanService.getEffectiveRates(match);
            resolvedData.ratePlanId = match.id;
            resolvedData.monthlyFixedRate = effective.monthlyFixed;
            resolvedData.perWorkCenterRate = effective.perWorkCenter;
            resolvedData.perWorkerRate = effective.perWorker;
          }

          // Recompute trial end from today when the trial period is edited;
          // skip non-TRIAL/ACTIVE accounts so a cancelled one isn't revived.
          if (resolvedData.probationPeriod !== undefined) {
            const newTrialDays = parseTrialDays(resolvedData.probationPeriod);
            const reschedulable =
              employer.billingStatus === 'TRIAL' ||
              employer.billingStatus === 'ACTIVE';
            if (reschedulable) {
              resolvedData.trialEndsAt =
                newTrialDays > 0 ? addDays(new Date(), newTrialDays) : null;
              resolvedData.billingStatus = newTrialDays > 0 ? 'TRIAL' : 'ACTIVE';
            }
          }

          const updatedEmployer = await manager.save(Employer, {
            ...employer,
            ...resolvedData,
          });

          // Keep the linked user's display name in sync with the employer
          // name (the header/profile reads user.name), and apply any account
          // changes (email / names / password) when provided. Sync the name
          // even when no `user` payload is sent — otherwise a name-only edit
          // leaves user.name stale until an unrelated email change.
          const nameChanged =
            employerData.name !== undefined && employerData.name !== employer.name;
          if (userData || nameChanged) {
            const employerUser = await manager.findOne(EmployerUser, {
              where: { employer: { id } },
              relations: ['user'],
            });

            if (employerUser) {
              const user = employerUser.user;
              if (userData?.email && userData.email !== user.email) {
                const existingUser = await manager.findOne(User, {
                  where: { email: userData.email },
                });
                if (existingUser && existingUser.id !== user.id) {
                  throw new BadRequestException('Email already in use');
                }
              }

              await manager.save(User, {
                ...user,
                email: userData?.email || user.email,
                firstName: userData?.firstName || user.firstName,
                lastName: userData?.lastName || user.lastName,
                name: employerData.name || user.name,
                ...(userData?.password
                  ? { password: await bcrypt.hash(userData.password, 10) }
                  : {}),
              });
            }
          }

          return {
            message: 'Employer updated successfully',
            data: updatedEmployer,
            isSuccess: true,
            statusCode: 200,
            developerError: '',
          };
        },
      );
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to update employer: ' + error.message,
      );
    }
  }

  /**
   * Delete an employer
   * @param id - Employer ID
   * @returns Success message
   */
  async remove(id: number): Promise<BaseResponse<null>> {
    try {
      return await this.employerRepository.manager.transaction(
        async (manager) => {
          const employer = await manager.findOne(Employer, {
            where: { id },
            relations: ['employerUsers', 'employerUsers.user'],
          });

          if (!employer) {
            throw new NotFoundException(`Employer with ID ${id} not found`);
          }

          // Delete the employer (this will cascade delete employerUsers due to onDelete: 'CASCADE')
          await manager.remove(Employer, employer);

          // Delete associated users if they are not linked to other employers
          for (const employerUser of employer.employerUsers) {
            const user = employerUser.user;
            const otherEmployerUsers = await manager.find(EmployerUser, {
              where: { user: { id: user.id } },
            });

            // If user is not linked to any other employers, delete the user
            if (otherEmployerUsers.length === 0) {
              await manager.remove(User, user);
            }
          }

          return {
            message: 'Employer deleted successfully',
            data: null,
            isSuccess: true,
            statusCode: 200,
            developerError: '',
          };
        },
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to delete employer: ' + error.message,
      );
    }
  }
}

function parseTrialDays(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 365); // hard cap so a typo can't create a 100-year trial
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function computeTrialDaysRemaining(trialEndsAt: Date | null | undefined): number {
  if (!trialEndsAt) return 0;
  const end = new Date(trialEndsAt).getTime();
  const diffMs = end - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}
