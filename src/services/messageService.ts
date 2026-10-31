/**
 * Message Service — Firebase Firestore implementation (Phase 2).
 *
 * Responsibilities:
 *  - Verify that the chat exists in MySQL (throws 404 if not found)
 *  - Verify that the senderId belongs to that chat in MySQL (throws 403 if not member)
 *  - Store the message in Cloud Firestore under chats/{chatId}/messages/{messageId}
 *  - Use serverTimestamp() from Firebase Admin SDK
 *  - Return created message ID and message information
 */

import admin from 'firebase-admin';
import { messagesCollection } from '../config/firebase';
import * as chatService from './chatService';
import type { SendMessageResponse } from '../types';

export async function sendMessage(
  chatId: string,
  senderId: string,
  text: string
): Promise<SendMessageResponse> {
  // 1. Verify chat exists in MySQL
  await chatService.assertChatExists(chatId);

  // 2. Verify sender is a member of this chat in MySQL
  await chatService.assertChatMember(chatId, senderId);

  // 3. Store message in Firestore: chats/{chatId}/messages/{messageId}
  const messagesRef = messagesCollection(chatId);
  const docRef = messagesRef.doc();
  const messageId = docRef.id;

  const writeResult = await docRef.set({
    senderId,
    text,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  const timestamp = writeResult.writeTime.toDate().toISOString();

  return {
    success: true,
    message: 'Message sent successfully',
    messageId,
    data: {
      messageId,
      chatId,
      senderId,
      text,
      timestamp,
    },
  };
}
