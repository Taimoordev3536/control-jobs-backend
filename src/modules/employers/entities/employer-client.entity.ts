import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Employer } from './employer.entity';
import { Client } from '../../clients/entities/client.entity';

@Entity('employerClients')
export class EmployerClient {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Employer, { onDelete: 'CASCADE' })
    employer: Employer;

    @ManyToOne(() => Client, { onDelete: 'CASCADE' })
    client: Client;

    @Column({ default: true })
    isActive: boolean;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt: Date;
    
} 