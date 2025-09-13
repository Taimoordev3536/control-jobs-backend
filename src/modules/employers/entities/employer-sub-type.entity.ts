import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum EmployerSubTypeEnum {
    Individual = 'Individual',
    SelfEmployed = 'Self-Employed',
    Company = 'Company'
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

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
} 