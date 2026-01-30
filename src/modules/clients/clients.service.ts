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

  findAll() {
    return this.clientRepo.find();
  }

  async findOne(id: number) {
    const client = await this.clientRepo.findOne({ where: { id } });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  async update(id: number, dto: UpdateClientDto) {
    const client = await this.findOne(id);
    Object.assign(client, dto);
    return this.clientRepo.save(client);
  }

  async remove(id: number) {
    // Remove all client-user links
    await this.clientUserRepo.delete({ clientId: id });
    // Remove all employer-client links
    await this.employerClientRepo.delete({ client: { id } });
    // Work centers cascade delete is handled by database constraints
    // (Add more deletes here for other related tables if needed)
    // Remove the client itself
    const client = await this.findOne(id);
    return this.clientRepo.remove(client);
  }

  async assignUser(dto: AssignClientUserDto) {
    const relation = this.clientUserRepo.create(dto);
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
      if (existingUser) throw new Error('Email already in use');
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
      const client = manager.create(Client, {
        name: dto.name,
        address: dto.address,
        landline: dto.landline,
        mobile: dto.mobile,
        email: dto.email,
        type: dto.type,
        code: dto.code,
        taxId: dto.taxId,
        status: dto.status || 'Active',
        observation: dto.observation,
        responsible: dto.responsible,
        accessAccountStatus: dto.accessAccountStatus,
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
      return { client: savedClient, user: savedUser };
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
    // Find all EmployerClient links for this employer
    const employerClients = await this.employerClientRepo.find({
      where: { employer: { id: employerId }, isActive: true },
      relations: ['client'],
    });
    // For each client, get the related user (for name)
    const clientIds = employerClients.map(ec => ec.client.id);

    // Also check if the current employer user is itself linked as a client (employer may also be a client)
    const ownClientRelations = await this.clientUserRepo.find({ where: { userId: employerUser.id } });
    const ownClientIds = ownClientRelations.map(cu => cu.clientId);

    // Merge client IDs (employer's clients + any client records where the current user is a client)
    const mergedClientIds = Array.from(new Set([...clientIds, ...ownClientIds]));

    const clientUsers = await this.clientUserRepo.find({
      where: mergedClientIds.length ? mergedClientIds.map(id => ({ clientId: id })) : undefined,
      relations: ['user'],
    });
    // Map clientId to user name
    const clientIdToUserName = new Map<number, string>();
    clientUsers.forEach(cu => {
      if (cu.isDefault && cu.user) {
        clientIdToUserName.set(cu.clientId, cu.user.name);
      }
    });
    // If the current user is also a client, add those client records to the list (avoid duplicates)
    if (ownClientIds.length) {
      const ownClients = await this.clientRepo.find({ where: ownClientIds.map(id => ({ id })) });
      ownClients.forEach(c => {
        if (!employerClients.some(ec => ec.client.id === c.id)) {
          // Push a synthetic EmployerClient-like object so mapping below can treat it the same
          employerClients.push({ employer: { id: employerId } as any, client: c, isActive: true } as any);
        }
      });
    }

    // Additionally, include the employer itself as a selectable "client" when relevant.
    // This allows an employer (company) to create jobs for their own workers using the employer as the client.
    try {
      const employer = await this.employerRepo.findOne({ where: { id: employerId } });
      if (employer) {
        // Check if an equivalent client record already exists (by name/address or id)
        const alreadyIncluded = employerClients.some(ec => {
          const c = ec.client;
          return (c.name && employer.name && c.name === employer.name) || (c.address && employer.address && c.address === employer.address) || (c.id === (employer as any).id);
        });

        if (!alreadyIncluded) {
          // Create a lightweight client-like object using employer fields so frontend can treat it the same
          const syntheticClient: any = {
            id: -(employer.id), // negative id to avoid collision with real client ids
            name: employer.name || '',
            address: employer.address || '',
            type: 'employer',
            responsible: employer.responsible || '',
            mobile: employer.mobile || '',
            status: 'Active',
          };

          employerClients.push({ employer: { id: employerId } as any, client: syntheticClient, isActive: true } as any);
        }
      }
    } catch (err) {
      // Non-fatal: if employer lookup fails, just continue without adding
      console.error('Error while including employer as client:', err?.message || err);
    }

    // Map to frontend expectations. Include `isSelf` when the client corresponds
    // to the current user (own client records) or when we added the synthetic
    // employer entry (negative id).
    return employerClients.map(ec => {
      const c = ec.client;
      const isSelf = ownClientIds.includes(c.id) || (typeof c.id === 'number' && c.id < 0);
      return {
        id: c.id,
        name: clientIdToUserName.get(c.id) || c.name || '',
        locality: c.address,
        type: c.type,
        responsible: c.responsible,
        telephones: c.mobile,
        asset: c.status === 'Active' ? 'yeah' : 'no',
        isSelf,
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
      name: clientIdToUserName.get(c.id) || c.name || '',
      locality: c.address,
      type: c.type,
      responsible: c.responsible,
      telephones: c.mobile,
      asset: c.status === 'Active' ? 'yeah' : 'no',
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
    name: employer.name,
    locality: employer.address,
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
