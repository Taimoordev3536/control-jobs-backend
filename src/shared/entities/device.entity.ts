import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('cjobs_usuariosFcm')
export class Device {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'user_id' })
    userId: number;

    @Column({ name: 'firebase_token' })
    firebaseToken: string;

    @Column({ name: 'device_type', nullable: true })
    deviceType: string;

    @Column({ name: 'last_used', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
    lastUsed: Date;
} 