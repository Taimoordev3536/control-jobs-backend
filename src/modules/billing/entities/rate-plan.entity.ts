import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * The price book. Each row defines a tariff for a (subType, tariffType) combination.
 * `subTypes` is a CSV of allowed Clase keys (e.g. "COMPANY,FREELANCER") so a single
 * row can apply to multiple Clase values.
 */
@Entity('cjobs_rate_plans')
export class RatePlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 50 })
  code: string;

  @Column({ length: 100 })
  label: string;

  @Column({ name: 'sub_types', length: 100 })
  subTypes: string;

  @Column({ name: 'tariff_type', length: 20 })
  tariffType: string;

  @Column({ name: 'monthly_fixed', type: 'decimal', precision: 8, scale: 2 })
  monthlyFixed: number;

  @Column({ name: 'per_workcenter', type: 'decimal', precision: 8, scale: 2 })
  perWorkCenter: number;

  @Column({ name: 'per_worker', type: 'decimal', precision: 8, scale: 2 })
  perWorker: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
