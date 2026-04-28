import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Partner } from '../../partners/entities/partner.entity';
import { User } from '../../users/entities/user.entity';
import { Employer } from '../../employers/entities/employer.entity';

export type InvitationStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'EXPIRED'
  | 'REVOKED';

@Entity('cjobs_employer_invitations')
export class EmployerInvitation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'public_id', type: 'uuid', unique: true, default: () => 'uuid_generate_v4()' })
  publicId: string;

  @Column({ length: 255 })
  email: string;

  @ManyToOne(() => Partner, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'partner_id' })
  partner: Partner;

  @Column({ name: 'partner_id' })
  partnerId: number;

  @Column({ name: 'trial_days', default: 15 })
  trialDays: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'issued_by_user_id' })
  issuedByUser: User;

  @Column({ name: 'issued_by_user_id' })
  issuedByUserId: number;

  @Column({ length: 20, default: 'PENDING' })
  status: InvitationStatus;

  @Column({ name: 'accepted_at', type: 'timestamp', nullable: true })
  acceptedAt: Date | null;

  @ManyToOne(() => Employer, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'accepted_employer_id' })
  acceptedEmployer: Employer | null;

  @Column({ name: 'accepted_employer_id', nullable: true })
  acceptedEmployerId: number | null;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
