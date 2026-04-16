import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('cjobs_impersonation_log')
export class ImpersonationLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'impersonator_user_id' })
  impersonatorUserId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'impersonator_user_id' })
  impersonatorUser: User;

  @Column({ name: 'impersonator_role', length: 50 })
  impersonatorRole: string;

  @Column({ name: 'target_user_id' })
  targetUserId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'target_user_id' })
  targetUser: User;

  @Column({ name: 'target_role', length: 50 })
  targetRole: string;

  @Column({ name: 'target_entity_id', nullable: true })
  targetEntityId: number;

  @Column({ name: 'target_entity_type', length: 50, nullable: true })
  targetEntityType: string;

  @Column({ name: 'ip_address', length: 45, nullable: true })
  ipAddress: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
