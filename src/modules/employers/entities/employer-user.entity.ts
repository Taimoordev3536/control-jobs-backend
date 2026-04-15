import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Employer } from './employer.entity';
import { User } from '../../users/entities/user.entity';
import { SubUserPermission } from '../../auth/enums/sub-user-permission.enum';

@Entity('employerUsers')
export class EmployerUser {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Employer, { onDelete: 'CASCADE' })
  employer: Employer;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ default: false })
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
