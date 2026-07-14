import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Client } from '../../clients/entities/client.entity';
import { Employer } from '../../employers/entities/employer.entity';
import { EmployerWorkCenter } from '../../employers/entities/employer-work-center.entity';

// Fixed column name mappings for address components
@Entity('work_center')
export class WorkCenter {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'public_id', type: 'uuid', unique: true, default: () => 'uuid_generate_v4()' })
    publicId: string;

    @Column({ length: 100 })
    name: string;

    @Column({ length: 255 })
    address: string;

    @Column({ name: 'street', length: 100, nullable: true })
    street: string;

    @Column({ name: 'street_number', length: 20, nullable: true })
    streetNumber: string;

    @Column({ name: 'floor', length: 50, nullable: true })
    floor: string;

    @Column({ name: 'locality', length: 100, nullable: true })
    locality: string;

    @Column({ name: 'province', length: 100, nullable: true })
    province: string;

    @Column({ name: 'country', length: 100, nullable: true })
    country: string;

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

    @Column({ type: 'text', nullable: true })
    observations: string;

    @Column({ name: 'latitude', type: 'decimal', precision: 10, scale: 8, nullable: true })
    latitude: number | null;

    @Column({ name: 'longitude', type: 'decimal', precision: 11, scale: 8, nullable: true })
    longitude: number | null;

    @Column({ name: 'gps_radius', type: 'integer', default: 100 })
    gpsRadius: number;

    @Column({ name: 'is_gps_active', type: 'boolean', default: false })
    isGpsActive: boolean;

    @Column({ name: 'is_qrcode_active', type: 'boolean', default: false })
    isQrcodeActive: boolean;

    @Column({ name: 'is_ip_active', type: 'boolean', default: false })
    isIpActive: boolean;

    @Column({ name: 'allowed_ip', type: 'varchar', length: 45, nullable: true })
    allowedIp: string | null;

    @OneToMany(() => EmployerWorkCenter, employerWorkCenter => employerWorkCenter.workCenter)
    employerWorkCenters: EmployerWorkCenter[];

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt: Date;
} 