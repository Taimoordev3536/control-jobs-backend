import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Employer } from './employer.entity';
import { Worker } from '../../workers/entities/worker.entity';

@Entity('employerWorkers')
export class EmployerWorker {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Employer, { onDelete: 'CASCADE' })
    employer: Employer;

    @ManyToOne(() => Worker, { onDelete: 'CASCADE' })
    worker: Worker;

    @Column({ default: true })
    isActive: boolean;

    // @Column({ type: 'date', nullable: true })
    // startDate: Date;

    // @Column({ type: 'date', nullable: true })
    // endDate: Date;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
} 