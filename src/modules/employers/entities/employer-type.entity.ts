import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum EmployerTypeEnum {
    HOME = 'HOME',
    STATIC = 'STATIC',
    REMOTE = 'REMOTE'
}

@Entity('employerTypes')
export class EmployerType {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({
        type: 'enum',
        enum: EmployerTypeEnum
    })
    name: EmployerTypeEnum;

    @Column('decimal', { nullable: true })
    defaultRate: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
} 