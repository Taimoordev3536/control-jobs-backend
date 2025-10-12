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

  @Column({ type: 'date', nullable: true, name: 'start_date' })
  startDate?: Date;

  @Column({ type: 'date', nullable: true, name: 'end_date' })
  endDate?: Date;

  @OneToMany(() => Shift, shift => shift.seasonalSchedule, { cascade: true })
  shifts: Shift[];
}
