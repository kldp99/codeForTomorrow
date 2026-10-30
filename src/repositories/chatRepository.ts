import { In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AppDataSource } from '../database/data-source';
import { Chat, ChatMember } from '../entities';
import type { ChatListItem } from '../types';

export function getChatRepository() {
  return AppDataSource.getRepository(Chat);
}

export function getChatMemberRepository() {
  return AppDataSource.getRepository(ChatMember);
}

/**
 * Build a deterministic, order-independent key for a 1:1 chat.
 */
export function buildConversationKey(userAId: string, userBId: string): string {
  const [lesser, greater] = [userAId, userBId].sort();
  return `${lesser}_${greater}`;
}

/**
 * Find an existing 1:1 chat by conversation_key using TypeORM findOne.
 */
export async function findChatByConversationKey(
  conversationKey: string
): Promise<Chat | null> {
  const repo = getChatRepository();
  return await repo.findOne({ where: { conversation_key: conversationKey } });
}

/**
 * Retrieve a single chat by its ID using TypeORM findOneBy.
 */
export async function findChatById(chatId: string): Promise<Chat | null> {
  const repo = getChatRepository();
  return await repo.findOneBy({ id: chatId });
}

/**
 * Create a new 1:1 chat and its two members in a transaction (no raw SQL).
 */
export async function createChatWithMembers(
  userAId: string,
  userBId: string,
  conversationKey: string
): Promise<Chat> {
  return await AppDataSource.transaction(async (manager) => {
    const chat = manager.create(Chat, {
      id: uuidv4(),
      chat_type: 'ONE_TO_ONE',
      conversation_key: conversationKey,
    });
    await manager.save(chat);

    const memberA = manager.create(ChatMember, {
      chat_id: chat.id,
      user_id: userAId,
    });
    const memberB = manager.create(ChatMember, {
      chat_id: chat.id,
      user_id: userBId,
    });

    await manager.save([memberA, memberB]);
    return chat;
  });
}

/**
 * Get all chats a user is a member of, including member user IDs.
 * Uses TypeORM relations and entity finders (no raw SQL).
 */
export async function getUserChatsWithMembers(
  userId: string
): Promise<ChatListItem[]> {
  const memberRepo = getChatMemberRepository();

  // 1. Find all chat memberships for this user
  const userMemberships = await memberRepo.find({
    where: { user_id: userId },
    select: { chat_id: true },
  });

  const chatIds = userMemberships.map((m) => m.chat_id);
  if (chatIds.length === 0) {
    return [];
  }

  // 2. Fetch the chats and load the members relation
  const chatRepo = getChatRepository();
  const chats = await chatRepo.find({
    where: { id: In(chatIds) },
    relations: {
      members: true,
    },
    order: {
      updated_at: 'DESC',
    },
  });

  return chats.map((chat) => ({
    chatId: chat.id,
    chatType: chat.chat_type,
    members: (chat.members || []).map((m) => m.user_id),
    createdAt: chat.created_at.toISOString(),
  }));
}

/**
 * Get the members of a specific chat.
 */
export async function getChatMembers(chatId: string): Promise<ChatMember[]> {
  const memberRepo = getChatMemberRepository();
  return await memberRepo.findBy({ chat_id: chatId });
}
