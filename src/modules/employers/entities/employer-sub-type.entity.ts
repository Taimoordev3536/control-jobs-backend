import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum EmployerSubTypeEnum {
    INDIVIDUAL = 'individual',
    FREELANCER = 'freelancer',
    COMPANY = 'company'
}

@Entity('employerSubTypes')
export class EmployerSubType {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({
        type: 'enum',
        enum: EmployerSubTypeEnum
    })
    name: EmployerSubTypeEnum;

    @Column('text')
    invoicingRules: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
} 