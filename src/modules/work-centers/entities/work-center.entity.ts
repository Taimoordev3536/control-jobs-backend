import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Client } from '../../clients/entities/client.entity';
import { Employer } from '../../employers/entities/employer.entity';
import { EmployerWorkCenter } from '../../employers/entities/employer-work-center.entity';

@Entity('work_center')
export class WorkCenter {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 100 })
    name: string;

    @Column({ length: 255 })
    address: string;

    @Column({ length: 100, nullable: true })
    contactName: string;

    @Column({ length: 20, nullable: true })
    contactPhone: string;

    @Column({ length: 100, nullable: true })
    contactEmail: string;

    @Column({ length: 20, nullable: true })
    landline: string;

    @Column({ name: 'client_id', nullable: true })
    clientId: number | null;

    @ManyToOne(() => Client)
    @JoinColumn({ name: 'client_id' })
    client: Client;

    // Optional employer ownership: a work center can belong to a client or to an employer
    @Column({ name: 'employer_id', nullable: true })
    employerId: number;

    @ManyToOne(() => Employer, { nullable: true })
    @JoinColumn({ name: 'employer_id' })
    employer: Employer;

    @Column({ name: 'postal_code', length: 20, nullable: true })
    postalCode: string;

    @OneToMany(() => EmployerWorkCenter, employerWorkCenter => employerWorkCenter.workCenter)
    employerWorkCenters: EmployerWorkCenter[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
} 