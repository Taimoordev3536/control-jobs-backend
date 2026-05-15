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
import { ClientInvitationRedemption } from './client-invitation-redemption.entity';

export type ClientInvitationStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'EXPIRED'
  | 'REVOKED';

@Entity('cjobs_client_invitations')
export class ClientInvitation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'public_id', type: 'uuid', unique: true, default: () => 'uuid_generate_v4()' })
  publicId: string;

  @Column({ length: 255, default: '' })
  description: string;

  @Column({ length: 20, default: 'company' })
  type: 'company' | 'particular';

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
  status: ClientInvitationStatus;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(
    () => ClientInvitationRedemption,
    (redemption) => redemption.invitation,
  )
  redemptions: ClientInvitationRedemption[];
}
