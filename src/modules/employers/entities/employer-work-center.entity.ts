import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Employer } from './employer.entity';
import { WorkCenter } from '../../work-centers/entities/work-center.entity';

@Entity('employerWorkCenters')
export class EmployerWorkCenter {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Employer, { onDelete: 'CASCADE' })
    employer: Employer;

    @ManyToOne(() => WorkCenter, { onDelete: 'CASCADE' })
    workCenter: WorkCenter;

    @Column({ name: 'is_active', default: true })
    isActive: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
} 