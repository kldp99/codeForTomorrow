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

export type ChatType = 'ONE_TO_ONE';

@Entity('chats')
@Index('idx_chats_updated_at', ['updated_at'])
export class Chat {
  @PrimaryColumn({ type: 'char', length: 36 })
  id!: string;

  @Column({
    type: 'enum',
    enum: ['ONE_TO_ONE'],
    default: 'ONE_TO_ONE',
  })
  chat_type!: ChatType;

  @Column({ type: 'varchar', length: 73, unique: true })
  conversation_key!: string;

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

  @OneToMany(() => ChatMember, (cm) => cm.chat, { cascade: true })
  members!: ChatMember[];
}
