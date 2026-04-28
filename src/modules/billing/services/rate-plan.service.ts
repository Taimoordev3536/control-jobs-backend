import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RatePlan } from '../entities/rate-plan.entity';
import { EmployerSubType } from '../../employers/entities/employer-sub-type.entity';
import { EmployerType } from '../../employers/entities/employer-type.entity';

@Injectable()
export class RatePlanService {
  constructor(
    @InjectRepository(RatePlan)
    private readonly ratePlanRepo: Repository<RatePlan>,
    @InjectRepository(EmployerSubType)
    private readonly subTypeRepo: Repository<EmployerSubType>,
    @InjectRepository(EmployerType)
    private readonly typeRepo: Repository<EmployerType>,
  ) {}

  findAllActive(): Promise<RatePlan[]> {
    return this.ratePlanRepo.find({
      where: { isActive: true },
      order: { id: 'ASC' },
    });
  }

  findAll(): Promise<RatePlan[]> {
    return this.ratePlanRepo.find({ order: { id: 'ASC' } });
  }

  /**
   * Resolve the rate plan that matches a given (subTypeId, typeId) combination.
   * Returns null if no active plan matches — caller decides how to handle that
   * (signup rejects with 422, preview returns null gracefully).
   */
  async findMatch(
    subTypeId: number,
    typeId: number,
  ): Promise<RatePlan | null> {
    const [subType, type] = await Promise.all([
      this.subTypeRepo.findOne({ where: { id: subTypeId } }),
      this.typeRepo.findOne({ where: { id: typeId } }),
    ]);
    if (!subType || !type) return null;

    const plans = await this.findAllActive();
    return (
      plans.find(
        (p) =>
          p.tariffType === String(type.name) &&
          p.subTypes.split(',').includes(String(subType.name)),
      ) ?? null
    );
  }

  async findById(id: number): Promise<RatePlan> {
    const plan = await this.ratePlanRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException(`Rate plan ${id} not found`);
    return plan;
  }

  async update(id: number, partial: Partial<RatePlan>): Promise<RatePlan> {
    const plan = await this.findById(id);
    Object.assign(plan, partial);
    return this.ratePlanRepo.save(plan);
  }
}
