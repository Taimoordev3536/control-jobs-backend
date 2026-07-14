import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { WorkerInvitation } from './worker-invitation.entity';
import { Worker } from '../../workers/entities/worker.entity';
import { User } from '../../users/entities/user.entity';

@Entity('cjobs_worker_invitation_redemptions')
export class WorkerInvitationRedemption {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => WorkerInvitation, (inv) => inv.redemptions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invitation_id' })
  invitation: WorkerInvitation;

  @Column({ name: 'invitation_id' })
  invitationId: number;

  @ManyToOne(() => Worker, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'redeemed_worker_id' })
  redeemedWorker: Worker;

  @Column({ name: 'redeemed_worker_id' })
  redeemedWorkerId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'redeemed_user_id' })
  redeemedUser: User;

  @Column({ name: 'redeemed_user_id' })
  redeemedUserId: number;

  @Column({ name: 'redeemed_email', length: 255 })
  redeemedEmail: string;

  @CreateDateColumn({ name: 'redeemed_at', type: 'timestamptz' })
  redeemedAt: Date;
}
