import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { isUUID } from 'class-validator';
import { WorkCenter } from './entities/work-center.entity';
import { CreateWorkCenterDto } from './dto/create-work-center.dto';
import { UpdateWorkCenterDto } from './dto/update-work-center.dto';
import { QueryWorkCenterDto } from './dto/query-work-center.dto';
import { User } from '../users/entities/user.entity';
import { Client } from '../clients/entities/client.entity';
import { Employer } from '../employers/entities/employer.entity';
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { EmployerClient } from '../employers/entities/employer-client.entity';

// Fixed: Removed relations loading that was causing 500 errors
@Injectable()
export class WorkCentersService {
  constructor(
    @InjectRepository(WorkCenter)
    private workCenterRepo: Repository<WorkCenter>,
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
    @InjectRepository(Employer)
    private employerRepo: Repository<Employer>,
    @InjectRepository(EmployerUser)
    private employerUserRepo: Repository<EmployerUser>,
    @InjectRepository(EmployerClient)
    private employerClientRepo: Repository<EmployerClient>,
  ) {}

  async resolvePublicId(publicId: string): Promise<number> {
    const wc = await this.workCenterRepo.findOne({ where: { publicId } });
    if (!wc) throw new NotFoundException('Work center not found');
    return wc.id;
  }

  private async resolveEmployerIdFromPublicId(idOrPublicId: string): Promise<number> {
    if (isUUID(idOrPublicId)) {
      const employer = await this.employerRepo.findOne({ where: { publicId: idOrPublicId } });
      if (!employer) throw new NotFoundException(`Employer ${idOrPublicId} not found`);
      return employer.id;
    }
    const num = parseInt(idOrPublicId, 10);
    if (isNaN(num)) throw new BadRequestException(`Invalid employerId: ${idOrPublicId}`);
    return num;
  }

  /**
   * Create a new work center
   */
  async create(dto: CreateWorkCenterDto, user: User): Promise<WorkCenter> {
    // Get employer for the authenticated user
    const employerUserLink = await this.employerUserRepo.findOne({
      where: { user: { id: user.id } },
      relations: ['employer'],
    });

    if (!employerUserLink || !employerUserLink.employer) {
      throw new ForbiddenException('Only employer users can create work centers');
    }

    const employerId = employerUserLink.employer.id;

    // If clientId (UUID) is provided, resolve to numeric and verify employer has access
    let numericClientId: number | null = null;
    if (dto.clientId) {
      const client = await this.clientRepo.findOne({ where: { publicId: dto.clientId } });
      if (!client) {
        throw new NotFoundException('Client not found');
      }
      numericClientId = client.id;

      // Verify employer-client association
      const association = await this.employerClientRepo.findOne({
        where: { 
          employer: { id: employerId }, 
          client: { id: numericClientId }, 
          isActive: true 
        },
      });

      if (!association) {
        throw new ForbiddenException('Employer is not associated with this client');
      }
    }

    // Determine ownership
    const workCenterData: Partial<WorkCenter> = {
      name: dto.name,
      address: dto.address,
      street: dto.street,
      streetNumber: dto.streetNumber,
      floor: dto.floor,
      locality: dto.locality,
      province: dto.province,
      country: dto.country,
      contactName: dto.contactName,
      contactPhone: dto.contactPhone,
      contactEmail: dto.contactEmail,
      landline: dto.landline,
      postalCode: dto.postalCode,
      // GPS proximity enforcement fields (auto-populated from Google Places on the frontend)
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      gpsRadius: dto.gpsRadius ?? 100,
    };

    // If dto.employerId is provided and matches the acting employer, create employer-owned
    const resolvedEmployerId = dto.employerId ? await this.resolveEmployerIdFromPublicId(String(dto.employerId)) : null;
    if (resolvedEmployerId && resolvedEmployerId === employerId) {
      workCenterData.employerId = employerId;
      workCenterData.clientId = null;
    } else if (numericClientId) {
      // Create client-owned work center
      workCenterData.clientId = numericClientId;
      workCenterData.employerId = null;
    } else {
      // Default to employer-owned
      workCenterData.employerId = employerId;
      workCenterData.clientId = null;
    }

    const workCenter = this.workCenterRepo.create(workCenterData);
    return await this.workCenterRepo.save(workCenter);
  }

  /**
   * Find all work centers with optional filters
   */
  async findAll(query: QueryWorkCenterDto, user: User): Promise<{ data: WorkCenter[]; total: number }> {
    // Get employer for the authenticated user
    const employerUserLink = await this.employerUserRepo.findOne({
      where: { user: { id: user.id } },
      relations: ['employer'],
    });

    if (!employerUserLink || !employerUserLink.employer) {
      throw new ForbiddenException('Only employer users can view work centers');
    }

    const employerId = employerUserLink.employer.id;

    // Simple approach: If clientId filter is provided, get client's work centers
    // Otherwise, get employer's work centers
    let whereCondition: any = {};
    
    if (query.clientId) {
      // Resolve clientId: if it looks like a UUID query by publicId, otherwise by numeric id
      // This avoids PostgreSQL type errors when a numeric string is passed to a UUID column
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let client: any = null;
      if (uuidRegex.test(query.clientId)) {
        client = await this.clientRepo.findOne({ where: { publicId: query.clientId } });
      } else {
        const numericId = parseInt(query.clientId, 10);
        if (!isNaN(numericId)) {
          client = await this.clientRepo.findOne({ where: { id: numericId } });
        }
      }
      if (!client) return { data: [], total: 0 };
      const numericClientId = client.id;
      
      // Verify employer has access to this client
      const association = await this.employerClientRepo.findOne({
        where: { 
          employer: { id: employerId }, 
          client: { id: numericClientId },
          isActive: true 
        },
      });

      if (!association) {
        return { data: [], total: 0 };
      }

      whereCondition.clientId = numericClientId;
    } else {
      // Get employer-owned work centers (where clientId is null)
      whereCondition.employerId = employerId;
      whereCondition.clientId = null;
    }

    try {
      const workCenters = await this.workCenterRepo.find({ 
        where: whereCondition,
        order: { createdAt: 'DESC' }
      });

      return { 
        data: workCenters, 
        total: workCenters.length 
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find one work center by ID
   */
  async findOne(id: number, user: User): Promise<WorkCenter> {
    const workCenter = await this.workCenterRepo.findOne({
      where: { id },
      relations: ['employer', 'client'],
    });

    if (!workCenter) {
      throw new NotFoundException('Work center not found');
    }

    // If no direct employer but has a client, resolve employer via employerClients bridge
    if (!workCenter.employer && workCenter.clientId) {
      const link = await this.employerClientRepo.findOne({
        where: { client: { id: workCenter.clientId }, isActive: true },
        relations: ['employer'],
      });
      if (link?.employer) {
        workCenter.employer = link.employer;
      }
    }

    // Verify access
    await this.verifyAccess(workCenter, user);

    return workCenter;
  }

  async findByPublicId(publicId: string, user: User): Promise<WorkCenter> {
    const workCenter = await this.workCenterRepo.findOne({ where: { publicId } });
    if (!workCenter) throw new NotFoundException('Work center not found');
    await this.verifyAccess(workCenter, user);
    return workCenter;
  }

  /**
   * Update a work center
   */
  async update(id: number, dto: UpdateWorkCenterDto, user: User): Promise<WorkCenter> {
    const workCenter = await this.findOne(id, user);

    // Update fields
    Object.assign(workCenter, {
      name: dto.name ?? workCenter.name,
      address: dto.address ?? workCenter.address,
      street: dto.street ?? workCenter.street,
      streetNumber: dto.streetNumber ?? workCenter.streetNumber,
      floor: dto.floor ?? workCenter.floor,
      locality: dto.locality ?? workCenter.locality,
      province: dto.province ?? workCenter.province,
      country: dto.country ?? workCenter.country,
      contactName: dto.contactName ?? workCenter.contactName,
      contactPhone: dto.contactPhone ?? workCenter.contactPhone,
      // Use `=== undefined` (not `??`) so an explicit `null` from the client clears
      // the existing email. With `??`, sending null would silently keep the old value.
      contactEmail: dto.contactEmail === undefined ? workCenter.contactEmail : dto.contactEmail,
      landline: dto.landline ?? workCenter.landline,
      postalCode: dto.postalCode ?? workCenter.postalCode,
      observations: dto.observations ?? workCenter.observations,
      latitude: dto.latitude !== undefined ? dto.latitude : workCenter.latitude,
      longitude: dto.longitude !== undefined ? dto.longitude : workCenter.longitude,
      gpsRadius: dto.gpsRadius ?? workCenter.gpsRadius,
    });

    return await this.workCenterRepo.save(workCenter);
  }

  /**
   * Delete a work center
   * Fixed: Use snake_case for database column name
   */
  async remove(id: number, user: User): Promise<{ message: string }> {
    const workCenter = await this.findOne(id, user);

    // Check if work center is being used by jobs in the many-to-many relationship
    const jobCount = await this.workCenterRepo.manager
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('job_work_centers', 'jwc')
      .where('jwc.work_center_id = :id', { id })
      .getRawOne();

    if (jobCount && parseInt(jobCount.count) > 0) {
      throw new BadRequestException('Cannot delete work center that is assigned to jobs');
    }

    // Also check for old workCenterId column (legacy constraint)
    const legacyJobCount = await this.workCenterRepo.manager
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('job', 'j')
      .where('j."workCenterId" = :id', { id })
      .getRawOne();

    if (legacyJobCount && parseInt(legacyJobCount.count) > 0) {
      // Clear the legacy workCenterId references before deletion
      await this.workCenterRepo.manager
        .createQueryBuilder()
        .update('job')
        .set({ workCenterId: null })
        .where('"workCenterId" = :id', { id })
        .execute();
    }

    await this.workCenterRepo.remove(workCenter);

    return { message: 'Work center deleted successfully' };
  }

  /**
   * Verify user has access to work center
   */
  private async verifyAccess(workCenter: WorkCenter, user: User): Promise<void> {
    const employerUserLink = await this.employerUserRepo.findOne({
      where: { user: { id: user.id } },
      relations: ['employer'],
    });

    if (!employerUserLink || !employerUserLink.employer) {
      throw new ForbiddenException('Access denied');
    }

    const employerId = employerUserLink.employer.id;

    // Allow access if:
    // 1. Employer owns the work center
    if (workCenter.employerId === employerId) {
      return;
    }

    // 2. Work center belongs to a client the employer has access to
    if (workCenter.clientId) {
      const association = await this.employerClientRepo.findOne({
        where: {
          employer: { id: employerId },
          client: { id: workCenter.clientId },
          isActive: true,
        },
      });

      if (association) {
        return;
      }
    }

    throw new ForbiddenException('Access denied to this work center');
  }
}
