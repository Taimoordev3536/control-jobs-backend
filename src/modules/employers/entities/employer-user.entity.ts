import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Employer } from './employer.entity';
import { User } from '../../users/entities/user.entity';

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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
