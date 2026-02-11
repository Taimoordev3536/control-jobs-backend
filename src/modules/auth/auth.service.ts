import {
  Injectable,
  UnauthorizedException,
  Inject,
  forwardRef,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { Partner } from '../partners/entities/partner.entity';
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../users/entities/role.entity';
import * as bcrypt from 'bcrypt';
import { UserRole } from './enums/user-role.enum';
import { LoginDto } from './dto/login.dto';
import { BaseResponse } from '../../common/interfaces/base-response.interface';
import { EmailCheckerService } from '../../common/services/email-checker.service';
import { PartnerUser } from '../partners/entities/partner-user.entity';

@Injectable()
export class AuthService {
  constructor(
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
    private jwtService: JwtService,
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
    private readonly emailCheckerService: EmailCheckerService,
  @InjectRepository(Partner)
  private partnerRepository: Repository<Partner>,
  @InjectRepository(PartnerUser)
  private partnerUserRepository: Repository<PartnerUser>,
  @InjectRepository(EmployerUser)
  private employerUserRepository: Repository<EmployerUser>,
  ) { }

  /**
   * Register a new user
   * @param registerDto - Registration data
   * @returns Created user data
   */
  async register(registerDto: RegisterDto): Promise<BaseResponse> {
    try {
      // Check if email is unique
      await this.emailCheckerService.checkEmailUnique(registerDto.email);

      // Hash the password
      const hashedPassword = await bcrypt.hash(registerDto.password, 10);

      // Get the specified role or default to worker role (value: 5)
      const roleValue = registerDto.role || 5;
      const role = await this.rolesRepository.findOne({
        where: { value: roleValue },
      });

      if (!role) {
        throw new BadRequestException(`Invalid role value: ${roleValue}. Valid roles are: Admin(1), Partner(2), Employer(3), Client(4), Worker(5)`);
      }

      const user = await this.usersService.create({
        ...registerDto,
        name: registerDto.name,
        password: hashedPassword,
        roleId: role.id,
      });

      // Remove sensitive data
      const { password, ...userWithoutPassword } = user;

      return {
        message: 'User registered successfully',
        data: { user: userWithoutPassword },
        isSuccess: true,
        statusCode: 201,
        developerError: '',
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Login user
   * @param loginDto - Login credentials
   * @returns User data with token
   */
  async login(loginDto: LoginDto): Promise<BaseResponse> {
    try {
      const user = await this.usersService.findByEmail(loginDto.email);

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const passwordValid = await this.usersService.validatePassword(loginDto.password, user.password);

      if (!passwordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Attach entity id for each role
      let entityId = null;
      let partnerId = null;
      // Additional employer info to return in response/token when available
      let employerInfo: any = null;

      if (user.roleId === 2) { // Partner
        // Find the partner-user link for this user
        const partnerUser = await this.partnerUserRepository.findOne({ where: { userId: user.id } });
        if (partnerUser) {
          entityId = partnerUser.partnerId;
          partnerId = partnerUser.partnerId;
        }
      } else if (user.roleId === 3) { // Employer
        // Try to fetch employer record linked to this user via EmployerUser repository
        try {
          const eu = await this.employerUserRepository.findOne({ where: { user: { id: user.id } }, relations: ['employer'] });
          if (eu?.employer) employerInfo = eu.employer;
        } catch (e) {
          // ignore lookup errors
        }

        // If we have employer info, populate entityId with employer.id
        if (employerInfo && employerInfo.id) {
          entityId = employerInfo.id;
        } else {
          // default to user id if no employer entity found
          entityId = user.id;
        }
      } else if (user.roleId === 1) { // Admin
        entityId = user.id;
      } // Add more roles as needed

      const token = this.generateToken(user, { employerId: employerInfo?.id, employerSubTypeId: employerInfo?.subTypeId });

      // Remove sensitive data
      const { password, ...userWithoutPassword } = user;

      // Include employer subtype/type info in returned user when available
      const returnedUser: any = { ...userWithoutPassword, partnerId };
      if (employerInfo) {
        returnedUser.employer = {
          id: employerInfo.id,
          name: employerInfo.name,
          typeId: employerInfo.typeId,
          subTypeId: employerInfo.subTypeId,
        };
      }

      return {
        message: 'Login successful',
        data: { user: returnedUser, token },
        isSuccess: true,
        statusCode: 200,
        developerError: '',
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email, ['role']);
    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    if (!user.role) {
      return null;
    }

    return user;
  }

  /**
   * Get user profile
   * @param userId - User ID
   * @returns User profile data
   */
  async getProfile(userId: number): Promise<BaseResponse> {
    try {
      const user = await this.usersService.findOne(userId);

      // Remove sensitive data
      const { password, ...userWithoutPassword } = user;

      return {
        message: 'Profile retrieved successfully',
        data: userWithoutPassword,
        isSuccess: true,
        statusCode: 200,
        developerError: '',
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate JWT token
   * @param user - User data
   * @returns JWT token
   */
  private generateToken(user: any, extras?: { employerId?: number; employerSubTypeId?: number }): string {
    const payload: any = {
      sub: user.id,
      id: user.id,
      email: user.email,
      role: user.role,
      roleValue: user.roleValue,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    if (extras?.employerId) payload.employerId = extras.employerId;
    if (extras?.employerSubTypeId) payload.employerSubTypeId = extras.employerSubTypeId;

    return this.jwtService.sign(payload);
  }
}
