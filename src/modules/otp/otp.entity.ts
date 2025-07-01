import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { User } from '../users/entities/user.entity';

@Entity()
export class OTP {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  userId!: number;

  @Column()
  otp!: string;

  @Column()
  expiresAt!: Date;

  @Column()
  intent!: 'register' | 'login';

  @Column()
  createdAt!: Date;

  @ManyToOne(() => User, (user) => user.id)
  user!: User; // Already fixed previously
}
