import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

@Entity('cjobs_employer_holidays')
@Index('uq_employer_holiday', ['employerId', 'date'], { unique: true })
export class EmployerHoliday {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'public_id', type: 'uuid', unique: true, default: () => 'uuid_generate_v4()' })
  publicId: string;

  @Column({ name: 'employer_id' })
  employerId: number;

  @Column({ type: 'date' })
  date: string;

  @Column({ length: 120, nullable: true })
  name: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
