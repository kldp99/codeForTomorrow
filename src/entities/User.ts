import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ChatMember } from './ChatMember';

@Entity('users')
export class User {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Index('idx_users_email')
  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  email!: string | null;

  @CreateDateColumn({
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  created_at!: Date;

  @UpdateDateColumn({
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
    onUpdate: 'CURRENT_TIMESTAMP(3)',
  })
  updated_at!: Date;

  @OneToMany(() => ChatMember, (cm) => cm.user)
  members!: ChatMember[];
}
