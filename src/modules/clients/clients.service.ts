import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Client } from './entities/client.entity';
import { ClientUser } from './entities/client-user.entity';
import { UpdateClientDto } from './dto/update-client.dto';
import { AssignClientUserDto } from './dto/assign-client-user.dto';
import { User } from '../users/entities/user.entity';
import { Employer } from '../employers/entities/employer.entity';
import { EmployerClient } from '../employers/entities/employer-client.entity';
import { Role } from '../users/entities/role.entity';
import * as bcrypt from 'bcryptjs';
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { randomBytes } from 'crypto';
import { EmailService } from '../../common/services/email.service';
import { In } from 'typeorm';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
    @InjectRepository(ClientUser)
    private clientUserRepo: Repository<ClientUser>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(Employer)
    private employerRepo: Repository<Employer>,
    @InjectRepository(EmployerClient)
    private employerClientRepo: Repository<EmployerClient>,
    private dataSource: DataSource,
  private readonly emailService: EmailService,
  ) {}

  async resolvePublicId(publicId: string): Promise<number> {
    const client = await this.clientRepo.findOne({ where: { publicId } });
    if (!client) throw new NotFoundException('Client not found');
    return client.id;
  }

  findAll() {
    return this.clientRepo.find();
  }

  // Internal: returns raw entity for update/delete operations
  private async findOneEntity(id: number): Promise<Client> {
    const client = await this.clientRepo.findOne({ where: { id } });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  // Public: returns client with email for API responses
  async findOne(id: number) {
    const client = await this.findOneEntity(id);

    // Fetch associated user email via client_user link
    const clientUser = await this.clientUserRepo.findOne({
      where: { clientId: id },
      relations: ['user'],
    });
    const email = clientUser?.user?.email || '';

    return { ...client, email };
  }

  async findByPublicId(publicId: string) {
    const client = await this.clientRepo.findOne({ where: { publicId } });
    if (!client) throw new NotFoundException('Client not found');
    const clientUser = await this.clientUserRepo.findOne({
      where: { clientId: client.id },
      relations: ['user'],
    });
    const email = clientUser?.user?.email || '';
    return { ...client, email };
  }

  async update(id: number, dto: UpdateClientDto) {
    const client = await this.findOneEntity(id);
    // Strip id, userId, and email to prevent overwriting primary key / saving non-entity fields
    const { id: _id, userId: _userId, email: _email, ...safeDto } = dto as any;
    Object.assign(client, safeDto);
    return this.clientRepo.save(client);
  }

  async updateByPublicId(publicId: string, dto: UpdateClientDto) {
    const client = await this.clientRepo.findOne({ where: { publicId } });
    if (!client) throw new NotFoundException('Client not found');
    const { id: _id, userId: _userId, email: _email, ...safeDto } = dto as any;
    Object.assign(client, safeDto);
    return this.clientRepo.save(client);
  }

  async remove(id: number) {
    // Find linked users before deleting the links
    const clientUserLinks = await this.clientUserRepo.find({
      where: { clientId: id },
    });
    const linkedUserIds = clientUserLinks.map((cu) => cu.userId);

    // Remove all client-user links
    await this.clientUserRepo.delete({ clientId: id });
    // Remove all employer-client links
    await this.employerClientRepo.delete({ client: { id } });
    // Work centers cascade delete is handled by database constraints
    // Remove the client itself
    const client = await this.findOneEntity(id);
    await this.clientRepo.remove(client);

    // Delete orphaned users (not linked to any other entity)
    for (const userId of linkedUserIds) {
      await this.deleteOrphanedUser(userId);
    }

    return client;
  }

  async removeByPublicId(publicId: string) {
    const client = await this.clientRepo.findOne({ where: { publicId } });
    if (!client) throw new NotFoundException('Client not found');
    return this.remove(client.id);
  }

  /**
   * Delete a user if they are not linked to any client, employer, or worker
   */
  private async deleteOrphanedUser(userId: number) {
    // Check if user is still linked to any client
    const clientLink = await this.clientUserRepo.findOne({ where: { userId } });
    if (clientLink) return;

    // Check if user is linked to any employer
    const employerLink = await this.dataSource
      .getRepository(EmployerUser)
      .findOne({ where: { user: { id: userId } } });
    if (employerLink) return;

    // Check if user is linked to any worker (WorkerUser)
    const workerLink = await this.dataSource
      .query(`SELECT 1 FROM "workers_users" WHERE "userId" = $1 LIMIT 1`, [userId]);
    if (workerLink && workerLink.length > 0) return;

    // User is orphaned — safe to delete
    await this.userRepo.delete(userId);
  }

  async assignUser(dto: AssignClientUserDto) {
    const clientId = await this.resolvePublicId(dto.clientId);
    const user = await this.userRepo.findOne({ where: { publicId: dto.userId } });
    if (!user) throw new NotFoundException(`User ${dto.userId} not found`);
    const relation = this.clientUserRepo.create({ clientId, userId: user.id, isDefault: dto.isDefault });
    return this.clientUserRepo.save(relation);
  }

  async getUsersByClient(clientId: number) {
    return this.clientUserRepo.find({
      where: { clientId },
      relations: ['user'],
    });
  }

  /**
   * Create a client/customer by employer
   * @param dto - DTO with client info, user info, employerId
   * @param employerUser - The user performing the action (must be employer)
   */
  async createByEmployer(dto: any, employerUser: User) {
    // Only allow employer role
    const employerRole = await this.roleRepo.findOne({ where: { value: 3 } });
    if (!employerUser || employerUser.roleId !== employerRole.id) {
      throw new Error('Only employer can add clients');
    }
    return this.dataSource.transaction(async (manager) => {
      // 1. Create user for client
      const existingUser = await manager.findOne(User, {
        where: { email: dto.email },
      });
      if (existingUser) throw new Error('Email ya utilizado');
      const clientRole = await manager.findOne(Role, { where: { value: 4 } }); // 4 = Client
      if (!clientRole) throw new Error('Client role not found');
      // ✅ Auto-generate password
      const rawPassword = randomBytes(6).toString('base64').slice(0, 10); // Generates a 10-char password
      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      console.log(`Generated password for Client: ${rawPassword}`);
      const user = manager.create(User, {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        roleId: clientRole.id,
      });
      const savedUser = await manager.save(User, user);
      // 2. Find employer via EmployerUser
      const allEmployerUserLinks = await manager.find(EmployerUser, {
        where: { user: { id: employerUser.id } },
        relations: ['employer'],
      });
      const employerUserLink = await manager.findOne(EmployerUser, {
        where: { user: { id: employerUser.id } },
        relations: ['employer'],
      });
      if (!employerUserLink || !employerUserLink.employer) throw new Error('Employer not found for this user');
      const employerId = employerUserLink.employer.id;
      // 3. Create client (only required fields)
      console.log('[CreateClient] Address components received:', {
        address: dto.address,
        street: dto.street,
        streetNumber: dto.streetNumber,
        city: dto.city,
        province: dto.province,
        country: dto.country,
        postalCode: dto.postalCode,
        latitude: dto.latitude,
        longitude: dto.longitude,
      });
      const client = manager.create(Client, {
        name: dto.name,
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
        landline: dto.landline,
        mobile: dto.mobile,
        type: dto.type,
        code: dto.code,
        taxId: dto.taxId,
        status: dto.status || 'Active',
        observation: dto.observation,
        responsible: dto.responsible,
        accessAccountStatus: dto.accessAccountStatus,
        active: dto.active !== undefined ? dto.active : true,
        userId: savedUser.id,
      });
      const savedClient = await manager.save(Client, client);
      // 4. Link employer and client
      const employerClient = manager.create(EmployerClient, {
        employer: { id: employerId } as any,
        client: { id: savedClient.id } as any,
        isActive: true,
      });
      await manager.save(EmployerClient, employerClient);
      // 5. Link user and client
      const clientUser = manager.create(ClientUser, {
        clientId: savedClient.id,
        userId: savedUser.id,
        isDefault: true,
      });
      await manager.save(ClientUser, clientUser);
      // Send credentials email if accessAccountStatus is 'request'
      if (dto.accessAccountStatus === 'request') {
        try {
          const emailTo = dto.accessEmail || dto.email;
          await this.emailService.sendUserCredentials(
            emailTo,
            dto.name,
            rawPassword,
            'client',
            dto.email,
          );
        } catch (emailError) {
          console.error('Failed to send client credentials email:', emailError?.message || emailError);
        }
      }
      // Re-fetch to get DB-generated publicId (uuid_generate_v4)
      const fullClient = await manager.findOne(Client, { where: { id: savedClient.id } });
      return { client: fullClient, user: savedUser };
    });
  }

  /**
   * Get all clients for a given employer user
   * @param employerUser - The user performing the action (must be employer)
   */
  async findAllByEmployerUser(employerUser: User) {
    // Find employerId for this user
    const employerUserLink = await this.dataSource.getRepository(EmployerUser).findOne({
      where: { user: { id: employerUser.id } },
      relations: ['employer'],
    });
    if (!employerUserLink || !employerUserLink.employer) throw new Error('Employer not found for this user');
    const employerId = employerUserLink.employer.id;

    // Find all EmployerClient links for this employer (only real clients)
    const employerClients = await this.employerClientRepo.find({
      where: { employer: { id: employerId }, isActive: true },
      relations: ['client'],
    });

    // For each client, get the related user (for name)
    const clientIds = employerClients.map(ec => ec.client.id);

    const clientUsers = clientIds.length
      ? await this.clientUserRepo.find({
          where: clientIds.map(id => ({ clientId: id })),
          relations: ['user'],
        })
      : [];

    // Map clientId to user name
    const clientIdToUserName = new Map<number, string>();
    clientUsers.forEach(cu => {
      if (cu.isDefault && cu.user) {
        clientIdToUserName.set(cu.clientId, cu.user.name);
      }
    });

    // NOTE: The employer itself is NOT included here. Employers are not clients.
    // The employer only appears as a selectable pseudo-client in the "Add Job"
    // modal via the dedicated /client/for-add-job endpoint.

    // Map to frontend expectations (only real clients)
    return employerClients.map(ec => {
      const c = ec.client;
      return {
        id: c.id,
        publicId: c.publicId,
        name: c.name || clientIdToUserName.get(c.id) || '',
        city: c.city || '',
        type: c.type,
        responsible: c.responsible,
        landline: c.landline,
        mobile: c.mobile,
        active: c.active,
        asset: c.active ? 'yeah' : 'no',
      };
    });
  }


    //clients And employer for add job (Select client dropdown)
  async findClientsForAddJob(employerUser: User) {
  // Find employer for this user
  const employerUserLink = await this.dataSource.getRepository(EmployerUser).findOne({
    where: { user: { id: employerUser.id } },
    relations: ['employer'],
  });
  if (!employerUserLink || !employerUserLink.employer) {
    throw new Error('Employer not found for this user');
  }
  const employerId = employerUserLink.employer.id;

  // Get employer's active clients
  const employerClients = await this.employerClientRepo.find({
    where: { employer: { id: employerId }, isActive: true },
    relations: ['client'],
  });

  // Collect all client IDs
  const clientIds = employerClients.map(ec => ec.client.id);

  // Check if user is directly a client
  const ownClientRelations = await this.clientUserRepo.find({
    where: { userId: employerUser.id },
  });
  const ownClientIds = ownClientRelations.map(cu => cu.clientId);

  // Merge client IDs
  const mergedClientIds = Array.from(new Set([...clientIds, ...ownClientIds]));

  // Fetch client → default user mappings
  const clientUsers = await this.clientUserRepo.find({
    where: mergedClientIds.length
      ? mergedClientIds.map(id => ({ clientId: id }))
      : undefined,
    relations: ['user'],
  });

  const clientIdToUserName = new Map<number, string>();
  clientUsers.forEach(cu => {
    if (cu.isDefault && cu.user) {
      clientIdToUserName.set(cu.clientId, cu.user.name);
    }
  });

  // Final client list
  const result = employerClients.map(ec => {
    const c = ec.client;
    return {
      id: c.id,
      publicId: c.publicId,
      name: clientIdToUserName.get(c.id) || c.name || '',
      city: c.city || '',
      type: c.type,
      responsible: c.responsible,
      telephones: c.mobile,
      asset: c.active ? 'yeah' : 'no',
      isSelf: ownClientIds.includes(c.id),
      isEmployer: false,
    };
  });

  // Add the employer itself as a pseudo-client
  const employer = employerUserLink.employer;
  // Represent the employer as a pseudo-client using a negative id to avoid
  // collision with real client ids and to keep the id numeric (frontend
  // expects numeric ids). The frontend can detect isEmployer or id < 0.
  result.push({
    id: -(employer.id),
    publicId: employer.publicId,
    name: employer.name,
    city: employer.address || '',
    type: 'employer',
    responsible: employer.responsible,
    telephones: employer.mobile,
    asset: 'yeah',
    isSelf: true,
    isEmployer: true,
  });

  return result;
}




  
  /**
   * Get all work centers for a given client.
   * @param clientId - The client ID
   */
  
  // async getWorkCentersByClient(clientId: number) {
  // const client = await this.clientRepo.findOne({ where: { id: clientId } });
  // if (!client) throw new NotFoundException('Client not found');

  // // Return actual work centers for this client
  // const workCenters = await this.workCenterRepo.find({ where: { clientId } });
  // return workCenters;
  // }

  // Work center methods moved to WorkCentersService




}
