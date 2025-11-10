import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Job } from './job.entity';
import { Season } from './shift.entity';
import { Shift } from './shift.entity';

@Entity('seasonal_schedule')
export class SeasonalSchedule {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Job, job => job.seasonalSchedules, { nullable: false })
  @JoinColumn({ name: 'job_id' })
  job: Job;

  @Column({ name: 'job_id' })
  jobId: number;

  @Column({ type: 'enum', enum: Season, enumName: 'season_enum', nullable: false })
  season: Season;

  // Store only Day-Month (DD-MM). We intentionally do not store year because
  // seasonal schedules repeat every year.
  @Column({ type: 'varchar', length: 5, nullable: true, name: 'start_date' })
  startDate?: string | null;

  // Store only Day-Month (DD-MM)
  @Column({ type: 'varchar', length: 5, nullable: true, name: 'end_date' })
  endDate?: string | null;

  @Column({ type: 'integer', name: 'total_week_hours', default: 0 })
  totalWeekHours: number;

  @OneToMany(() => Shift, shift => shift.seasonalSchedule, { cascade: true })
  shifts: Shift[];
}
