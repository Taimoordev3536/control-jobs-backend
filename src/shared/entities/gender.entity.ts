import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('gender')
export class Gender {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50 })
  name: string;
}
