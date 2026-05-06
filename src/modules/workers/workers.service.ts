import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BaseResponse } from '../../common/interfaces/base-response.interface';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Worker } from './entities/worker.entity';
import { WorkerUser } from './entities/worker-user.entity';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { AssignWorkerUserDto } from './dto/assign-worker-user.dto';
import { User } from '../../modules/users/entities/user.entity';
import { Role } from '../users/entities/role.entity';
import { Employer } from '../../modules/employers/entities/employer.entity';
import { EmployerWorker } from '../../modules/employers/entities/employer-worker.entity';
import { EmployerUser } from '../../modules/employers/entities/employer-user.entity';
import { Client } from '../clients/entities/client.entity';
import { Job } from '../job/entities/job.entity';
import { In } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { EmailService } from '../../common/services/email.service';

@Injectable()
export class WorkersService {
  constructor(
    @InjectRepository(Worker)
    private workerRepo: Repository<Worker>,
    @InjectRepository(WorkerUser)
    private workerUserRepo: Repository<WorkerUser>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(Employer)
    private employerRepo: Repository<Employer>,
    @InjectRepository(EmployerWorker)
    private employerWorkerRepo: Repository<EmployerWorker>,
    private dataSource: DataSource,
    private readonly emailService: EmailService,
    private readonly cloudinaryService: CloudinaryService,
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
    @InjectRepository(Job)
    private jobRepo: Repository<Job>,
  ) {}

  // Workers connected to a client *via the jobs they are assigned to*. This
  // is read-only / informational — the same worker may legitimately appear
  // under several clients if their jobs span multiple clients. Deduped by
  // worker.id, with full row fields for the Workers tab table.
  async getWorkersByClientPublicId(publicId: string) {
    const client = await this.clientRepo.findOne({ where: { publicId } });
    if (!client) {
      return {
        message: 'Client not found',
        data: [],
        isSuccess: false,
        statusCode: 404,
        developerError: `Client with publicId ${publicId} not found`,
      };
    }

    const jobs = await this.jobRepo.find({
      where: { client: { id: client.id } },
      relations: ['workers'],
    });

    const workerIds = [
      ...new Set(jobs.flatMap((j) => (j.workers || []).map((w) => w.id))),
    ];
    if (workerIds.length === 0) {
      return {
        message: 'No workers connected to this client',
        data: [],
        isSuccess: true,
        statusCode: 200,
      };
    }

    const workers = await this.workerRepo.find({ where: { id: In(workerIds) } });

    // The Worker→User link in this codebase is the `workers_users` junction
    // table — Worker.user_id is null on production rows. Pull the linked
    // user via the junction so we can compose a display name.
    const links = await this.workerUserRepo.find({
      where: { workerId: In(workerIds) },
      relations: ['user'],
    });
    const workerIdToUser = new Map<number, User>();
    for (const link of links) {
      if (link.workerId && link.user) workerIdToUser.set(link.workerId, link.user);
    }

    const composeName = (u?: User | null): string | null => {
      if (!u) return null;
      const trimmed = (u.name || '').trim();
      if (trimmed) return trimmed;
      const fn = (u.firstName || '').trim();
      const ln = (u.lastName || '').trim();
      const joined = [fn, ln].filter(Boolean).join(' ');
      if (joined) return joined;
      return u.email || null;
    };

    const data = workers.map((w) => ({
      id: w.id,
      publicId: w.publicId,
      code: w.code,
      name: composeName(workerIdToUser.get(w.id)),
      occupation: w.occupation || null,
      mobile: w.mobile || null,
      city: w.city || null,
      postalCode: w.postalCode || null,
      logoUrl: w.logoUrl || null,
    }));

    return {
      message: 'Workers connected via jobs',
      data,
      isSuccess: true,
      statusCode: 200,
    };
  }

  async resolvePublicId(publicId: string): Promise<number> {
    const worker = await this.workerRepo.findOne({ where: { publicId } });
    if (!worker) throw new NotFoundException('Worker not found');
    return worker.id;
  }

  async findWorkerIdByUserId(userId: number): Promise<number> {
    const link = await this.workerUserRepo.findOne({ where: { userId } });
    if (link?.workerId) return link.workerId;
    // Fallback: legacy workers may be linked directly via Worker.user.id.
    const direct = await this.workerRepo.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });
    if (direct?.id) return direct.id;
    throw new NotFoundException('No worker is linked to the current user');
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

    const worker = await this.workerRepo.findOne({ where: { id } });
    if (!worker) throw new NotFoundException(`Worker ${id} not found`);

    const oldPublicId = worker.logoPublicId;
    const uploaded = await this.cloudinaryService.uploadImage(
      file.buffer,
      'controljobs/worker-photos',
    );
    worker.logoPublicId = uploaded.publicId;
    worker.logoUrl = uploaded.secureUrl;
    await this.workerRepo.save(worker);

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

  async clearLogo(id: number): Promise<BaseResponse<null>> {
    const worker = await this.workerRepo.findOne({ where: { id } });
    if (!worker) throw new NotFoundException(`Worker ${id} not found`);

    const oldPublicId = worker.logoPublicId;
    worker.logoPublicId = null;
    worker.logoUrl = null;
    await this.workerRepo.save(worker);
    if (oldPublicId) await this.cloudinaryService.deleteImage(oldPublicId);

    return {
      message: 'Logo removed',
      data: null,
      isSuccess: true,
      statusCode: 200,
    };
  }

  findAll() {
    return this.workerRepo.find();
  }

  async findOne(id: number) {
    const worker = await this.workerRepo.findOne({ where: { id } });
    if (!worker) throw new NotFoundException('Worker not found');

    // Fetch linked user name and email
    const workerUser = await this.workerUserRepo.findOne({
      where: { workerId: id },
      relations: ['user'],
    });
    const name = workerUser?.user?.name || '';
    const email = workerUser?.user?.email || '';

    return { ...worker, name, email };
  }

  async findByPublicId(publicId: string) {
    const worker = await this.workerRepo.findOne({ where: { publicId } });
    if (!worker) throw new NotFoundException('Worker not found');
    const workerUser = await this.workerUserRepo.findOne({
      where: { workerId: worker.id },
      relations: ['user'],
    });
    const name = workerUser?.user?.name || '';
    const email = workerUser?.user?.email || '';
    return { ...worker, name, email };
  }

  async update(id: number, dto: UpdateWorkerDto) {
    const worker = await this.workerRepo.findOne({ where: { id } });
    if (!worker) throw new NotFoundException('Worker not found');

    // Extract user-level fields before assigning to worker entity
    const { email, accessEmail, name, ...workerFields } = dto as any;
    Object.assign(worker, workerFields);
    await this.workerRepo.save(worker);

    // Update linked user's email/name if provided
    if (email !== undefined || name !== undefined) {
      const workerUser = await this.workerUserRepo.findOne({
        where: { workerId: id },
        relations: ['user'],
      });
      if (workerUser?.user) {
        if (email !== undefined) workerUser.user.email = email;
        if (name !== undefined) workerUser.user.name = name;
        await this.userRepo.save(workerUser.user);
      }
    }

    return this.findOne(id);
  }

  async updateByPublicId(publicId: string, dto: UpdateWorkerDto) {
    const worker = await this.workerRepo.findOne({ where: { publicId } });
    if (!worker) throw new NotFoundException('Worker not found');

    // Extract user-level fields before assigning to worker entity
    const { email, accessEmail, name, ...workerFields } = dto as any;
    Object.assign(worker, workerFields);
    await this.workerRepo.save(worker);

    // Update linked user's email/name if provided
    if (email !== undefined || name !== undefined) {
      const workerUser = await this.workerUserRepo.findOne({
        where: { workerId: worker.id },
        relations: ['user'],
      });
      if (workerUser?.user) {
        if (email !== undefined) workerUser.user.email = email;
        if (name !== undefined) workerUser.user.name = name;
        await this.userRepo.save(workerUser.user);
      }
    }

    return this.findByPublicId(publicId);
  }

  async remove(id: number) {
    // Find linked users before deleting the links
    const workerUserLinks = await this.workerUserRepo.find({
      where: { workerId: id },
    });
    const linkedUserIds = workerUserLinks.map((wu) => wu.userId);

    // Remove all worker-user links
    await this.workerUserRepo.delete({ workerId: id });
    // Remove all employer-worker links
    await this.employerWorkerRepo.delete({ worker: { id } });
    // Remove the worker itself
    const worker = await this.workerRepo.findOne({ where: { id } });
    if (!worker) throw new NotFoundException('Worker not found');
    await this.workerRepo.remove(worker);

    // Delete orphaned users (not linked to any other entity)
    for (const userId of linkedUserIds) {
      await this.deleteOrphanedUser(userId);
    }

    return worker;
  }

  async removeByPublicId(publicId: string) {
    const worker = await this.workerRepo.findOne({ where: { publicId } });
    if (!worker) throw new NotFoundException('Worker not found');
    return this.remove(worker.id);
  }

  /**
   * Delete a user if they are not linked to any worker, client, or employer
   */
  private async deleteOrphanedUser(userId: number) {
    // Check if user is still linked to any worker
    const workerLink = await this.workerUserRepo.findOne({ where: { userId } });
    if (workerLink) return;

    // Check if user is linked to any client
    const clientLink = await this.dataSource
      .query(`SELECT 1 FROM "clients_users" WHERE "userId" = $1 LIMIT 1`, [userId]);
    if (clientLink && clientLink.length > 0) return;

    // Check if user is linked to any employer
    const employerLink = await this.dataSource
      .getRepository(EmployerUser)
      .findOne({ where: { user: { id: userId } } });
    if (employerLink) return;

    // User is orphaned — safe to delete
    await this.userRepo.delete(userId);
  }

  async assignUser(dto: AssignWorkerUserDto) {
    const workerId = await this.resolvePublicId(dto.workerId);
    const user = await this.userRepo.findOne({ where: { publicId: dto.userId } });
    if (!user) throw new NotFoundException(`User ${dto.userId} not found`);
    const relation = this.workerUserRepo.create({ workerId, userId: user.id });
    return this.workerUserRepo.save(relation);
  }

  async getUsersByWorker(workerId: number) {
    return this.workerUserRepo.find({
      where: { workerId },
      relations: ['user'],
    });
  }

  /**
   * Create a worker by employer
   * @param dto - Worker creation data
   * @param employerUser - The user performing the action (must be employer)
   */
  async createByEmployer(dto: CreateWorkerDto, employerUser: User) {
    // Only allow employer role
    const employerRole = await this.roleRepo.findOne({ where: { value: 3 } });
    if (!employerUser || employerUser.roleId !== employerRole.id) {
      throw new Error('Only employer can add workers');
    }
    return this.dataSource.transaction(async (manager) => {
      // 1. Create user for worker
      const existingUser = await manager.findOne(User, {
        where: { email: dto.email },
      });
      if (existingUser) throw new Error('Email ya utilizado');
      const workerRole = await manager.findOne(Role, { where: { value: 5 } }); // 5 = Worker
      if (!workerRole) throw new Error('Worker role not found');
      // Auto-generate password (or set default)
      const rawPassword = 'Worker' + Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      console.log(`Generated password for worker: ${rawPassword}`);
      const user = manager.create(User, {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        roleId: workerRole.id,
      });
      const savedUser = await manager.save(User, user);
      // 2. Find employer via EmployerUser
      const employerUserLink = await manager.findOne(EmployerUser, {
        where: { user: { id: employerUser.id } },
        relations: ['employer'],
      });
      if (!employerUserLink || !employerUserLink.employer) throw new Error('Employer not found for this user');
      const employerId = employerUserLink.employer.id;
      // 3. Create worker (only required fields)
      let genderEntity = null;
      if (dto.gender) {
        genderEntity = await manager.findOne('Gender', { where: { id: Number(dto.gender) } });
      }
      const worker = manager.create(Worker, {
        code: dto.code,
        landline: dto.landline,
        mobile: dto.mobile,
        nif: dto.nif,
        naf: dto.naf,
        occupation: dto.occupation,
        birthday: dto.birthday,
        gender: genderEntity,
        accessAccountStatus: dto.accessAccountStatus || 'postpone',
        active: true,
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
      });
      const savedWorker = await manager.save(Worker, worker);
      // 4. Link employer and worker
      const employerWorker = manager.create('EmployerWorker', {
        employer: { id: employerId } as any,
        worker: { id: savedWorker.id } as any,
        isActive: true,
      });
      await manager.save('EmployerWorker', employerWorker);
      // 5. Link user and worker
      const workerUser = manager.create(WorkerUser, {
        workerId: savedWorker.id,
        userId: savedUser.id,
      });
      await manager.save(WorkerUser, workerUser);

      // Send credentials email if accessAccountStatus is 'request'
      if ((dto as any).accessAccountStatus === 'request') {
        try {
          const emailTo = (dto as any).accessEmail || dto.email;
          await this.emailService.sendUserCredentials(
            emailTo,
            dto.name,
            rawPassword,
            'worker',
            dto.email,
          );
        } catch (emailError) {
          console.error('Failed to send worker credentials email:', emailError?.message || emailError);
        }
      }

      // Re-fetch to get DB-generated publicId (uuid_generate_v4)
      const fullWorker = await manager.findOne(Worker, { where: { id: savedWorker.id } });
      return { worker: fullWorker, user: savedUser };
    });
  }

  /**
   * Get all workers for a given employer user
   * @param employerUser - The user performing the action (must be employer)
   */
  async findAllByEmployer(employerUser: User) {
    // Find employerId for this user
    const employerUserLink = await this.dataSource.getRepository(EmployerUser).findOne({
      where: { user: { id: employerUser.id } },
      relations: ['employer'],
    });
    if (!employerUserLink || !employerUserLink.employer) throw new Error('Employer not found for this user');
    const employerId = employerUserLink.employer.id;
    // Find all EmployerWorker links for this employer
    const employerWorkers = await this.employerWorkerRepo.find({
      where: { employer: { id: employerId }, isActive: true },
      relations: ['worker'],
    });
    // For each worker, get the related user (for name)
    const workerIds = employerWorkers.map(ew => ew.worker.id);
    const workerUsers = await this.workerUserRepo.find({
      where: workerIds.length ? workerIds.map(id => ({ workerId: id })) : undefined,
      relations: ['user'],
    });
    // Map workerId to user name
    const workerIdToUserName = new Map<number, string>();
    workerUsers.forEach(wu => {
      if (wu.user) {
        workerIdToUserName.set(wu.workerId, wu.user.name);
      }
    });
    // Map to frontend expectations
    return employerWorkers.map(ew => {
      const w = ew.worker;
      // Combine landline and mobile for telephones
      let telephones = '';
      if (w.landline && w.mobile) {
        telephones = `${w.landline} | ${w.mobile}`;
      } else if (w.landline) {
        telephones = w.landline;
      } else if (w.mobile) {
        telephones = w.mobile;
      }
      // Asset: always 'yeah' or 'no'
      let asset = 'no';
      if (typeof w.asset === 'string') {
        asset = w.asset.toLowerCase() === 'yeah' ? 'yeah' : 'no';
      } else if (w.active) {
        asset = 'yeah';
      }
      return {
        id: w.id,
        publicId: w.publicId,
        name: workerIdToUserName.get(w.id) || '',
        occupation: w.occupation,
        landline: w.landline || '',
        mobile: w.mobile || '',
        telephones,
        address: (w as any).address || '',
        street: (w as any).street || '',
        streetNumber: (w as any).streetNumber || '',
        floorDoor: (w as any).floorDoor || '',
        postalCode: (w as any).postalCode || '',
        city: (w as any).city || '',
        province: (w as any).province || '',
        country: (w as any).country || '',
        latitude: (w as any).latitude || null,
        longitude: (w as any).longitude || null,
        asset,
      };
    });
  }
}
