import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Client } from '../../clients/entities/client.entity';
import { EmployerWorkCenter } from '../../employers/entities/employer-work-center.entity';

@Entity('cjobs_centrosTrabajo')
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

    @Column({ name: 'client_id' })
    clientId: number;

    @ManyToOne(() => Client)
    @JoinColumn({ name: 'client_id' })
    client: Client;

    @OneToMany(() => EmployerWorkCenter, employerWorkCenter => employerWorkCenter.workCenter)
    employerWorkCenters: EmployerWorkCenter[];

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
} 