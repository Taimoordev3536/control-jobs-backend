import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
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

    // If clientId is provided, verify employer has access to that client
    if (dto.clientId) {
      const client = await this.clientRepo.findOne({ where: { id: dto.clientId } });
      if (!client) {
        throw new NotFoundException('Client not found');
      }

      // Verify employer-client association
      const association = await this.employerClientRepo.findOne({
        where: { 
          employer: { id: employerId }, 
          client: { id: dto.clientId }, 
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
    };

    // If dto.employerId is provided and matches the acting employer, create employer-owned
    if (dto.employerId && dto.employerId === employerId) {
      workCenterData.employerId = employerId;
      workCenterData.clientId = null;
    } else if (dto.clientId) {
      // Create client-owned work center
      workCenterData.clientId = dto.clientId;
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

    console.log('🔍 Fetching work centers for employerId:', employerId);
    console.log('🔍 Query filters:', query);

    // Simple approach: If clientId filter is provided, get client's work centers
    // Otherwise, get employer's work centers
    let whereCondition: any = {};
    
    if (query.clientId) {
      console.log('🔍 Filtering by clientId:', query.clientId);
      
      // Verify employer has access to this client
      const association = await this.employerClientRepo.findOne({
        where: { 
          employer: { id: employerId }, 
          client: { id: query.clientId },
          isActive: true 
        },
      });

      console.log('🔍 Employer-Client association found:', association ? 'YES' : 'NO');
      if (association) {
        console.log('🔍 Association details:', { 
          id: association.id, 
          employerId: association.employer?.id, 
          clientId: association.client?.id 
        });
      }

      if (!association) {
        console.log('❌ Employer does not have access to this client');
        return { data: [], total: 0 };
      }

      whereCondition.clientId = query.clientId;
    } else {
      // Get employer-owned work centers (where clientId is null)
      whereCondition.employerId = employerId;
      whereCondition.clientId = null;
    }

    console.log('🔍 About to query with whereCondition:', whereCondition);

    try {
      const workCenters = await this.workCenterRepo.find({ 
        where: whereCondition,
        order: { createdAt: 'DESC' }
      });

      console.log('✅ Found work centers:', workCenters.length);
      console.log('📋 Work centers:', workCenters.map(wc => ({ 
        id: wc.id, 
        name: wc.name, 
        employerId: wc.employerId, 
        clientId: wc.clientId 
      })));

      return { 
        data: workCenters, 
        total: workCenters.length 
      };
    } catch (error) {
      console.error('❌ Error querying work centers:', error);
      throw error;
    }
  }

  /**
   * Find one work center by ID
   */
  async findOne(id: number, user: User): Promise<WorkCenter> {
    const workCenter = await this.workCenterRepo.findOne({
      where: { id },
    });

    if (!workCenter) {
      throw new NotFoundException('Work center not found');
    }

    // Verify access
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
      contactEmail: dto.contactEmail ?? workCenter.contactEmail,
      landline: dto.landline ?? workCenter.landline,
      postalCode: dto.postalCode ?? workCenter.postalCode,
      observations: dto.observations ?? workCenter.observations,
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
