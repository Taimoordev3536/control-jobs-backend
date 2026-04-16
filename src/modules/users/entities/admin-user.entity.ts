import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { SubUserPermission } from '../../auth/enums/sub-user-permission.enum';

@Entity('cjobs_admin_users')
export class AdminUser {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @Column({
    name: 'permission',
    type: 'enum',
    enum: SubUserPermission,
    nullable: true,
  })
  permission: SubUserPermission | null;

  @Column({ name: 'parent_user_id', nullable: true })
  parentUserId: number | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'parent_user_id' })
  parentUser: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
