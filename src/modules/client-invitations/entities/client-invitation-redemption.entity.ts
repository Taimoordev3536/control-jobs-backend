import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { ClientInvitation } from './client-invitation.entity';
import { Client } from '../../clients/entities/client.entity';
import { User } from '../../users/entities/user.entity';

@Entity('cjobs_client_invitation_redemptions')
export class ClientInvitationRedemption {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ClientInvitation, (inv) => inv.redemptions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invitation_id' })
  invitation: ClientInvitation;

  @Column({ name: 'invitation_id' })
  invitationId: number;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'redeemed_client_id' })
  redeemedClient: Client;

  @Column({ name: 'redeemed_client_id' })
  redeemedClientId: number;

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
