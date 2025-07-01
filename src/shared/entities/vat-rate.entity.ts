import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('cjobs_IVASTAI')
export class VatRate {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'decimal', precision: 5, scale: 2 })
    rate: number;

    @Column()
    name: string;

    @Column({ default: true })
    isActive: boolean;
} 