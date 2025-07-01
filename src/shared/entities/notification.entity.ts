import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('cjobs_notificaciones')
export class Notification {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    role: string;

    @Column({ name: 'recipient_id' })
    recipientId: number;

    @Column()
    title: string;

    @Column({ type: 'text' })
    message: string;

    @Column({ name: 'is_read', default: false })
    isRead: boolean;

    @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;
} 