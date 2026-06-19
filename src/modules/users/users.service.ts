import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUUID } from 'class-validator';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { AdminUser } from './entities/admin-user.entity';
import { Partner } from '../partners/entities/partner.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateAdminMeDto } from './dto/update-admin-me.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { AwsService } from '../aws/aws.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { BaseResponse } from '../../common/interfaces/base-response.interface';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
    @InjectRepository(AdminUser)
    private adminUserRepository: Repository<AdminUser>,
    private readonly awsService: AwsService,
    private readonly cloudinaryService: CloudinaryService,
  ) { }

  // Find the AdminUser row for the given login user. Used by /users/admin/me/*
  // endpoints to scope read/write to the active admin without trusting the
  // payload's id directly.
  private async findAdminUserByUserId(userId: number): Promise<AdminUser> {
    let link = await this.adminUserRepository.findOne({
      where: { userId },
      order: { isDefault: 'DESC', id: 'ASC' },
    });
    if (!link) {
      link = await this.adminUserRepository.save(
        this.adminUserRepository.create({ userId, isDefault: true }),
      );
    }
    return link;
  }

  async getAdminMe(userId: number): Promise<BaseResponse<any>> {
    const admin = await this.findAdminUserByUserId(userId);
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    return {
      message: 'Admin profile retrieved',
      data: { ...admin, name: user?.name ?? '', email: user?.email ?? '' },
      isSuccess: true,
      statusCode: 200,
    };
  }

  async setAdminLogo(
    userId: number,
    file: Express.Multer.File,
  ): Promise<BaseResponse<{ logoUrl: string; logoPublicId: string }>> {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.mimetype)) {
      throw new BadRequestException('Logo must be PNG or JPEG');
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('Logo must be 2 MB or smaller');
    }

    const admin = await this.findAdminUserByUserId(userId);
    const oldPublicId = admin.logoPublicId;
    const uploaded = await this.cloudinaryService.uploadImage(
      file.buffer,
      'controljobs/admin-photos',
    );
    admin.logoPublicId = uploaded.publicId;
    admin.logoUrl = uploaded.secureUrl;
    await this.adminUserRepository.save(admin);

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

  async clearAdminLogo(userId: number): Promise<BaseResponse<null>> {
    const admin = await this.findAdminUserByUserId(userId);
    const oldPublicId = admin.logoPublicId;
    admin.logoPublicId = null;
    admin.logoUrl = null;
    await this.adminUserRepository.save(admin);
    if (oldPublicId) await this.cloudinaryService.deleteImage(oldPublicId);
    return {
      message: 'Logo removed',
      data: null,
      isSuccess: true,
      statusCode: 200,
    };
  }

  async updateAdminMe(
    userId: number,
    dto: UpdateAdminMeDto,
  ): Promise<BaseResponse<{ id: number; name: string; email: string }>> {
    const admin = await this.findAdminUserByUserId(userId);
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (dto.name !== undefined) user.name = dto.name;
    if (dto.email !== undefined) user.email = dto.email;
    await this.usersRepository.save(user);

    const profileFields = [
      'nif',
      'responsible',
      'address',
      'street',
      'streetNumber',
      'floorDoor',
      'postalCode',
      'city',
      'province',
      'country',
      'latitude',
      'longitude',
      'landline',
      'mobile',
    ] as const;
    for (const field of profileFields) {
      if (dto[field] !== undefined) admin[field] = dto[field] as never;
    }
    await this.adminUserRepository.save(admin);

    return {
      message: 'Profile updated',
      data: { id: user.id, name: user.name, email: user.email },
      isSuccess: true,
      statusCode: 200,
    };
  }

  async getMyProfile(userId: number): Promise<BaseResponse<{ name: string; email: string; alias: string | null }>> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return {
      message: 'Profile retrieved',
      data: { name: user.name, email: user.email, alias: user.alias ?? null },
      isSuccess: true,
      statusCode: 200,
    };
  }

  async updateMyProfile(
    userId: number,
    dto: UpdateMyProfileDto,
  ): Promise<BaseResponse<{ alias: string | null }>> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (dto.alias !== undefined) {
      const trimmed = dto.alias.trim();
      user.alias = trimmed ? trimmed : null;
    }
    await this.usersRepository.save(user);
    return {
      message: 'Profile updated',
      data: { alias: user.alias ?? null },
      isSuccess: true,
      statusCode: 200,
    };
  }

  async resolvePublicId(publicId: string): Promise<number> {
    const user = await this.usersRepository.findOne({ where: { publicId } });
    if (!user) throw new NotFoundException('User not found');
    return user.id;
  }

  private async resolvePartnerIdFromPublicId(idOrPublicId: string): Promise<number> {
    if (isUUID(idOrPublicId)) {
      const partner = await this.usersRepository.manager.findOne(Partner, { where: { publicId: idOrPublicId } });
      if (!partner) throw new NotFoundException(`Partner ${idOrPublicId} not found`);
      return partner.id;
    }
    const num = parseInt(idOrPublicId, 10);
    if (isNaN(num)) throw new NotFoundException(`Invalid partnerId: ${idOrPublicId}`);
    return num;
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const { partnerId: partnerIdRaw, ...rest } = createUserDto;
    const data: any = { ...rest };
    if (partnerIdRaw !== undefined) {
      data.partnerId = await this.resolvePartnerIdFromPublicId(String(partnerIdRaw));
    }
    const user = this.usersRepository.create(data as Partial<User>);
    return this.usersRepository.save(user);
  }

  async findByEmail(
    email: string,
    relations: string[] = [],
  ): Promise<User | null> {
    const user = await this.usersRepository.findOne({
      where: { email },
      relations: [...relations, 'role'], // Always include role relation
    });

    if (user && !user.role) {
      // Try to assign default worker role
      const workerRole = await this.rolesRepository.findOne({
        where: { value: 5 },
      });
      if (workerRole) {
        user.role = workerRole;
        await this.usersRepository.save(user);
      }
    }

    return user;
  }

  async findById(id: number, relations: string[] = []): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: [...relations, 'role'], // Always include role relation
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (!user.role) {
      // Try to assign default worker role
      const workerRole = await this.rolesRepository.findOne({
        where: { value: 5 },
      });
      if (workerRole) {
        user.role = workerRole;
        await this.usersRepository.save(user);
      }
    }

    return user;
  }

  async findByPublicId(publicId: string, relations: string[] = []): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { publicId },
      relations: [...relations, 'role'],
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.role) {
      const workerRole = await this.rolesRepository.findOne({ where: { value: 5 } });
      if (workerRole) {
        user.role = workerRole;
        await this.usersRepository.save(user);
      }
    }
    return user;
  }

  async getAllUsers(
    page: number = 1,
    limit: number = 10,
    search: string = '',
  ): Promise<{ users: User[]; total: number }> {
    const queryBuilder = this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role');

    if (search) {
      queryBuilder.where('user.name LIKE :search OR user.email LIKE :search', {
        search: `%${search}%`,
      });
    }

    const [users, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { users, total };
  }

  async updateRole(id: number, roleId: number): Promise<User> {
    const user = await this.findById(id);
    const role = await this.rolesRepository.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }
    user.role = role;
    return this.usersRepository.save(user);
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    await this.findById(id);
    const { partnerId: partnerIdRaw, ...rest } = updateUserDto;
    const data: any = { ...rest };
    if (partnerIdRaw !== undefined) {
      data.partnerId = await this.resolvePartnerIdFromPublicId(String(partnerIdRaw));
    }
    await this.usersRepository.update(id, data);
    return this.findById(id);
  }

  /**
   * Validate user password
   * @param plainPassword - Plain text password
   * @param hashedPassword - Hashed password
   * @returns True if password is valid
   */
  async validatePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      return false;
    }
  }

  /**
   * Find a user by ID
   * @param id - User ID
   * @returns User if found
   */
  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['role'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }
}
