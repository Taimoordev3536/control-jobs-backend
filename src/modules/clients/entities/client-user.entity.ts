import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Client } from './client.entity';
import { User } from '../../users/entities/user.entity';
import { SubUserPermission } from '../../auth/enums/sub-user-permission.enum';

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

  @Column({
    name: 'permission',
    type: 'enum',
    enum: SubUserPermission,
    nullable: true,
  })
  permission: SubUserPermission | null;

  @Column({ name: 'parent_user_id', nullable: true })
  parentUserId: number | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'parent_user_id' })
  parentUser: User | null;
}
