import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { Chat } from './Chat';
import { User } from './User';

@Entity('chat_members')
@Unique('uq_chat_members_chat_user', ['chat_id', 'user_id'])
export class ChatMember {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: number;

  @Index('idx_chat_members_chat_id')
  @Column({ type: 'char', length: 36 })
  chat_id!: string;

  @Index('idx_chat_members_user_id')
  @Column({ type: 'char', length: 36 })
  user_id!: string;

  @CreateDateColumn({
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  joined_at!: Date;

  @ManyToOne(() => Chat, (c) => c.members, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'chat_id' })
  chat!: Chat;

  @ManyToOne(() => User, (u) => u.members, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
