import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Employer } from '../../employers/entities/employer.entity';
import { User } from '../../users/entities/user.entity';
import { WorkerInvitationRedemption } from './worker-invitation-redemption.entity';

export type WorkerInvitationStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'EXPIRED'
  | 'REVOKED';

@Entity('cjobs_worker_invitations')
export class WorkerInvitation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'public_id', type: 'uuid', unique: true, default: () => 'uuid_generate_v4()' })
  publicId: string;

  @Column({ length: 255, default: '' })
  description: string;

  @Column({ length: 120, default: '' })
  occupation: string;

  @ManyToOne(() => Employer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employer_id' })
  employer: Employer;

  @Column({ name: 'employer_id' })
  employerId: number;

  @Column({ name: 'max_redemptions', type: 'int', nullable: true })
  maxRedemptions: number | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'issued_by_user_id' })
  issuedByUser: User;

  @Column({ name: 'issued_by_user_id' })
  issuedByUserId: number;

  @Column({ length: 20, default: 'PENDING' })
  status: WorkerInvitationStatus;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(
    () => WorkerInvitationRedemption,
    (redemption) => redemption.invitation,
  )
  redemptions: WorkerInvitationRedemption[];
}
