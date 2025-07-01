import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Worker } from './worker.entity';
import { User } from '../../users/entities/user.entity';

@Entity('workers_users')
export class WorkerUser {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  workerId: number;

  @ManyToOne(() => Worker)
  @JoinColumn({ name: 'workerId' })
  worker: Worker;

  @Column()
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;
}
