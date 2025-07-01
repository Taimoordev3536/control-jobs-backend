import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Client } from './client.entity';
import { User } from '../../users/entities/user.entity';

@Entity('clients_users')
export class ClientUser {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  clientId: number;

  @ManyToOne(() => Client)
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ default: false })
  isDefault: boolean;
}
