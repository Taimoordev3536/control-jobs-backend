import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Partner } from './entities/partner.entity';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { BaseResponse } from '../../common/interfaces/base-response.interface';
import { PartnerUser } from './entities/partner-user.entity';
import { User } from '../users/entities/user.entity';
import { PartnerTier } from './entities/partner-type.entity';
import { EmailService } from '../../common/services/email.service';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

@Injectable()
export class PartnersService {
  constructor(
    @InjectRepository(Partner)
    private readonly partnerRepository: Repository<Partner>,
    @InjectRepository(PartnerUser)
    private readonly partnerUserRepository: Repository<PartnerUser>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PartnerTier)
    private readonly partnerTierRepository: Repository<PartnerTier>,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Create a new partner
   * @param createPartnerDto - Partner creation data
   * @returns Created partner data
   */
  async create(
    createPartnerDto: CreatePartnerDto,
  ): Promise<BaseResponse<Partner> & { generatedPassword: string }> {
    try {
      console.log(
        'Creating partner with tier ID:',
        createPartnerDto.partnerTierId,
      );

      // Validate partner tier
      const partnerTier = await this.partnerTierRepository.findOne({
        where: { id: createPartnerDto.partnerTierId },
      });

      if (!partnerTier) {
        const allTiers = await this.partnerTierRepository.find();
        console.log('Available partner tiers:', allTiers);
        throw new BadRequestException(
          `Partner tier with ID ${createPartnerDto.partnerTierId} not found`,
        );
      }

      // Check for existing user by email
      const existingUser = await this.userRepository.findOne({
        where: { email: createPartnerDto.email },
      });

      if (existingUser) {
        throw new BadRequestException('Email already in use');
      }

      // ✅ Auto-generate password
      const rawPassword = randomBytes(6).toString('base64').slice(0, 10); // Generates a 10-char password
      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      console.log(`Generated password for partner: ${rawPassword}`);

      // Create user
      const user = this.userRepository.create({
        name: createPartnerDto.name,
        email: createPartnerDto.email,
        password: hashedPassword,
        roleId: 2, // Partner role
      });
      const savedUser = await this.userRepository.save(user);

      // Create partner
      const partner = this.partnerRepository.create({
        name: createPartnerDto.name,
        address: createPartnerDto.address,
        // addressFloorDoor: createPartnerDto.addressFloorDoor,
        landline: createPartnerDto.landline, // ✅ New
        mobile: createPartnerDto.mobile,
        email: createPartnerDto.email,
        taxId: createPartnerDto.nif,
        typeOfPartner: createPartnerDto.typeOfPartner,
        commission: createPartnerDto.commission,
        retention: createPartnerDto.retention,
        paymentMethod: createPartnerDto.paymentMethod,
        accountIban: createPartnerDto.accountIban,
        bicSwift: createPartnerDto.bicSwift,
        partnerTierId: createPartnerDto.partnerTierId,
        defaultPaymentMethodId: createPartnerDto.defaultPaymentMethodId,
        responsible: createPartnerDto.responsible, // ✅ New
        accessAccountStatus: createPartnerDto.accessAccountStatus ?? 'postpone', // ✅ New with fallback
      });
      const savedPartner = await this.partnerRepository.save(partner);

      // Create partner-user relationship
      const partnerUser = this.partnerUserRepository.create({
        partnerId: savedPartner.id,
        userId: savedUser.id,
        isDefault: true,
      });
      await this.partnerUserRepository.save(partnerUser);

      // Send email with credentials if accessAccountStatus is 'request'
      if (createPartnerDto.accessAccountStatus === 'request') {
        try {
          // Use accessEmail if provided, otherwise use the partner's email
          const emailToSendTo = createPartnerDto.accessEmail || createPartnerDto.email;
          
          // Always use the partner's main email as the login email, regardless of where we send the notification
          await this.emailService.sendUserCredentials(
            emailToSendTo,  // Send TO this email address
            createPartnerDto.name,
            rawPassword,
            'partner',
            createPartnerDto.email  // This is the actual login email
          );
          console.log(`Email with credentials sent to: ${emailToSendTo}`);
        } catch (emailError) {
          console.error('Failed to send email with credentials:', emailError);
          // Continue with the process even if email sending fails
        }
      }

      return {
        message: createPartnerDto.accessAccountStatus === 'request' 
          ? 'Partner created successfully and credentials sent by email' 
          : 'Partner created successfully',
        data: savedPartner, // Keep the original partner data
        generatedPassword: rawPassword, // Add password as separate field
        isSuccess: true,
        statusCode: 201,
        developerError: '',
      };
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Get all partners
   * @returns List of all partners
   */
  async findAll(): Promise<BaseResponse<Partner[]>> {
    try {
      const partners = await this.partnerRepository.find({
        relations: [
          'partnerTier',
          'defaultPaymentMethod',
          'partnerUsers',
          'partnerUsers.user',
        ],
      });
      return {
        message: 'Partners retrieved successfully',
        data: partners,
        isSuccess: true,
        statusCode: 200,
        developerError: '',
      };
    } catch (error) {
      throw new BadRequestException(
        'Failed to retrieve partners: ' + error.message,
      );
    }
  }

  /**
   * Get a partner by ID
   * @param id - Partner ID
   * @returns Partner data
   */
  async findOne(id: number): Promise<BaseResponse<Partner>> {
    try {
      const partner = await this.partnerRepository.findOne({
        where: { id },
        relations: [
          'partnerTier',
          'defaultPaymentMethod',
          'partnerUsers',
          'partnerUsers.user',
        ],
      });

      if (!partner) {
        throw new NotFoundException(`Partner with ID ${id} not found`);
      }

      return {
        message: 'Partner retrieved successfully',
        data: partner,
        isSuccess: true,
        statusCode: 200,
        developerError: '',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to retrieve partner: ' + error.message,
      );
    }
  }

  /**
   * Update a partner
   * @param id - Partner ID
   * @param updatePartnerDto - Partner update data
   * @returns Updated partner data
   */
  async update(
    id: number,
    updatePartnerDto: UpdatePartnerDto,
  ): Promise<BaseResponse<Partner>> {
    try {
      const partner = await this.partnerRepository.findOne({
        where: { id },
        relations: ['partnerUsers', 'partnerUsers.user'],
      });

      if (!partner) {
        throw new NotFoundException(`Partner with ID ${id} not found`);
      }

      // Update partner details
      const updatedPartner = await this.partnerRepository.save({
        ...partner,
        name: updatePartnerDto.name || partner.name,
        address: updatePartnerDto.address || partner.address,
        // addressFloorDoor: updatePartnerDto.addressFloorDoor || partner.addressFloorDoor,
        mobile: updatePartnerDto.mobile || partner.mobile,
        email: updatePartnerDto.email || partner.email,
        taxId: updatePartnerDto.nif || partner.taxId,
        typeOfPartner: updatePartnerDto.typeOfPartner || partner.typeOfPartner,
        commission: updatePartnerDto.commission || partner.commission,
        retention: updatePartnerDto.retention || partner.retention,
        paymentMethod: updatePartnerDto.paymentMethod || partner.paymentMethod,
        accountIban: updatePartnerDto.accountIban || partner.accountIban,
        bicSwift: updatePartnerDto.bicSwift || partner.bicSwift,
        partnerTierId: updatePartnerDto.partnerTierId || partner.partnerTierId,
        defaultPaymentMethodId:
          updatePartnerDto.defaultPaymentMethodId ||
          partner.defaultPaymentMethodId,
      });

      // If email is being updated, update the associated user
      if (updatePartnerDto.email) {
        const defaultPartnerUser = partner.partnerUsers.find(
          (pu) => pu.isDefault,
        );
        if (defaultPartnerUser) {
          await this.userRepository.update(defaultPartnerUser.userId, {
            email: updatePartnerDto.email,
          });
        }
      }

      return {
        message: 'Partner updated successfully',
        data: updatedPartner,
        isSuccess: true,
        statusCode: 200,
        developerError: '',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to update partner: ' + error.message,
      );
    }
  }

  /**
   * Delete a partner
   * @param id - Partner ID
   * @returns Success message
   */
  async remove(id: number): Promise<BaseResponse<null>> {
    try {
      const partner = await this.partnerRepository.findOne({
        where: { id },
        relations: ['partnerUsers'],
      });

      if (!partner) {
        throw new NotFoundException(`Partner with ID ${id} not found`);
      }

      // Delete associated users
      for (const partnerUser of partner.partnerUsers) {
        await this.userRepository.delete(partnerUser.userId);
      }

      // Delete partner
      await this.partnerRepository.remove(partner);

      return {
        message: 'Partner deleted successfully',
        data: null,
        isSuccess: true,
        statusCode: 200,
        developerError: '',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to delete partner: ' + error.message,
      );
    }
  }

  /**
   * Get all partner tiers
   * @returns List of all partner tiers
   */
  async findAllTiers(): Promise<BaseResponse<PartnerTier[]>> {
    try {
      const tiers = await this.partnerTierRepository.find();
      return {
        message: 'Partner tiers retrieved successfully',
        data: tiers,
        isSuccess: true,
        statusCode: 200,
        developerError: '',
      };
    } catch (error) {
      throw new BadRequestException(
        'Failed to retrieve partner tiers: ' + error.message,
      );
    }
  }
}
