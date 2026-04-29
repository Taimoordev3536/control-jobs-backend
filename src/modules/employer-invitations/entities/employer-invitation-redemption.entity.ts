import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { EmployerInvitation } from './employer-invitation.entity';
import { Employer } from '../../employers/entities/employer.entity';
import { User } from '../../users/entities/user.entity';

@Entity('cjobs_employer_invitation_redemptions')
export class EmployerInvitationRedemption {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => EmployerInvitation, (inv) => inv.redemptions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invitation_id' })
  invitation: EmployerInvitation;

  @Column({ name: 'invitation_id' })
  invitationId: number;

  @ManyToOne(() => Employer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'redeemed_employer_id' })
  redeemedEmployer: Employer;

  @Column({ name: 'redeemed_employer_id' })
  redeemedEmployerId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'redeemed_user_id' })
  redeemedUser: User;

  @Column({ name: 'redeemed_user_id' })
  redeemedUserId: number;

  @Column({ name: 'redeemed_email', length: 255 })
  redeemedEmail: string;

  @CreateDateColumn({ name: 'redeemed_at' })
  redeemedAt: Date;
}
