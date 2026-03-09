import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Task } from './task.entity';
import { Worker } from '../../workers/entities/worker.entity';
import {Job} from '../../job/entities/job.entity'

// task-history.entity.ts
@Entity()
export class TaskHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'public_id', type: 'uuid', unique: true, default: () => 'uuid_generate_v4()' })
  publicId: string;

  @Column()
  taskId: number;

  @Column() // Add this field
  jobId: number;

  @Column({ type: 'date' })
  date: Date;

  @Column({ default: false })
  isCompleted: boolean;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ nullable: true })
  completedByWorkerId: number;

  @ManyToOne(() => Task, (task) => task.taskHistories)
  task: Task;

  @ManyToOne(() => Worker, (worker) => worker.taskHistories)
  completedBy: Worker;

  @ManyToOne(() => Job, (job) => job.taskHistories) // Add relation to Job
  job: Job;
}


