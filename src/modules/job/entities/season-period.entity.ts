import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Job } from './job.entity';
import { Season } from './shift.entity';

@Entity('season_period')
export class SeasonPeriod {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Job, { nullable: false })
  @JoinColumn({ name: 'job_id' })
  job: Job;

  @Column({ name: 'job_id' })
  jobId: number;

  @Column({ type: 'enum', enum: Season })
  season: Season;

  @Column({ type: 'date', name: 'start_date' })
  startDate: Date;

  @Column({ type: 'date', name: 'end_date' })
  endDate: Date;
}
