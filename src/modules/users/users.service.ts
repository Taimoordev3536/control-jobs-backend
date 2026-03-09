import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUUID } from 'class-validator';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Partner } from '../partners/entities/partner.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { AwsService } from '../aws/aws.service';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
    private readonly awsService: AwsService,
  ) { }

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
