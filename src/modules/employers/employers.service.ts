// employers/employers.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employer } from './entities/employer.entity';
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

@Injectable()
export class EmployersService {
  constructor(
    @InjectRepository(Employer)
    private readonly employerRepository: Repository<Employer>,
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
  ) {}

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

  async create(
    createEmployerDto: CreateEmployerDto,
  ): Promise<BaseResponse<Employer>> {
    // Validate all relationships exist
    const [type, subType, paymentMethod] = await Promise.all([
      this.employerTypeRepository.findOneBy({ id: createEmployerDto.typeId }),
      this.employerSubTypeRepository.findOneBy({
        id: createEmployerDto.subTypeId,
      }),
      this.paymentMethodRepository.findOneBy({
        id: createEmployerDto.paymentMethodId,
      }),
    ]);

    if (!type) throw new BadRequestException('Invalid employer type');
    if (!subType) throw new BadRequestException('Invalid employer sub-type');
    if (!paymentMethod) throw new BadRequestException('Invalid payment method');

    try {
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
            partnerId: await this.resolvePartnerIdFromPublicId(createEmployerDto.partnerId),
            phone: createEmployerDto.phone,
            mobile: createEmployerDto.mobile,
            landline: createEmployerDto.landline,
            typeId: createEmployerDto.typeId,
            subTypeId: createEmployerDto.subTypeId,
            fee: createEmployerDto.fee,
            discount: createEmployerDto.discount,
            paymentMethodId: createEmployerDto.paymentMethodId,
            accountIban: createEmployerDto.accountIban,
            bicSwift: createEmployerDto.bicSwift,
            probationPeriod: createEmployerDto.probationPeriod,
            responsible: createEmployerDto.responsible,
            accessAccountStatus: createEmployerDto.accessAccountStatus,
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

          // ✅ Auto-generate password (consistent with partner creation)
          const rawPassword = randomBytes(6).toString('base64').slice(0, 10); // Generates a 10-char password
          const hashedPassword = await bcrypt.hash(rawPassword, 10);
          console.log(`Generated password for employer: ${rawPassword}`);

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
        fee: e.fee,
        createdAt: e.createdAt,
        paymentMethod: e.paymentMethod?.name || null,
        partnerName: e.partner?.name || null, // Added partner name
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
        data: { ...employer, email, partnerId: partnerPublicId || employer.partnerId },
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
          const updatedEmployer = await manager.save(Employer, {
            ...employer,
            ...resolvedData,
          });

          // If user data is provided, update the linked user
          if (userData) {
            const employerUser = await manager.findOne(EmployerUser, {
              where: { employer: { id } },
              relations: ['user'],
            });

            if (employerUser) {
              const user = employerUser.user;
              if (userData.email && userData.email !== user.email) {
                const existingUser = await manager.findOne(User, {
                  where: { email: userData.email },
                });
                if (existingUser && existingUser.id !== user.id) {
                  throw new BadRequestException('Email already in use');
                }
              }

              const updatedUser = await manager.save(User, {
                ...user,
                email: userData.email || user.email,
                firstName: userData.firstName || user.firstName,
                lastName: userData.lastName || user.lastName,
                name: employerData.name || user.name,
                ...(userData.password
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
