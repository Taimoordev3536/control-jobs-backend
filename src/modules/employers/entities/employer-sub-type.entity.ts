import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum EmployerSubTypeEnum {
    INDIVIDUAL = 'INDIVIDUAL',
    FREELANCER = 'FREELANCER',
    COMPANY = 'COMPANY'
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

   @Column('text', { nullable: true })
   invoicingRules: string;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt: Date;
} 