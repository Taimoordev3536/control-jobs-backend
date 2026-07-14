import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Index,
} from 'typeorm';

// Per-employer survey settings (e.g. how long responses are kept).
@Entity('cjobs_survey_form_settings')
export class SurveyFormSettings {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'employer_id', unique: true })
  @Index()
  employerId: number;

  // Auto-delete responses older than this many days (null = keep indefinitely).
  @Column({ name: 'retention_days', type: 'int', nullable: true })
  retentionDays: number | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
