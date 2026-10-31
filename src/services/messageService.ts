/**
 * Message Service — Firebase Firestore implementation (Phase 2).
 *
 * Responsibilities:
 *  - Verify that the chat exists in MySQL (throws 404 if not found)
 *  - Verify that the senderId belongs to that chat in MySQL (throws 403 if not member)
 *  - Store the message in Cloud Firestore under chats/{chatId}/messages/{messageId}
 *  - Use serverTimestamp() from Firebase Admin SDK
 *  - Return created message ID and message information
 *  - Retrieve messages with Firestore query limits and cursor-based pagination
 */

import admin from 'firebase-admin';
import { messagesCollection, lastSeenCollection } from '../config/firebase';
import { AppError } from '../utils/AppError';
import * as chatService from './chatService';
import type {
  SendMessageResponse,
  GetMessagesResponse,
  ChatMessageItem,
  PaginationOptions,
  MarkMessageReadResponse,
  UpdateLastSeenResponse,
} from '../types';

/**
 * Send a message in a chat.
 * Verifies chat and sender membership in MySQL, then stores in Firestore.
 */
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

/**
 * Retrieve messages for a chat with cursor-based pagination.
 *
 * 1. Verifies chat exists in MySQL.
 * 2. Verifies requester is a member in MySQL.
 * 3. Queries Firestore with orderBy('timestamp', 'desc') and limit(limit + 1).
 * 4. Reverses the page so results are returned in chronological ascending order.
 * 5. Returns hasMore and nextCursor.
 */
export async function getMessages(
  chatId: string,
  requesterId: string,
  options: PaginationOptions
): Promise<GetMessagesResponse> {
  const limit = options.limit > 0 ? options.limit : 50;
  const cursor = options.cursor || options.before;

  // 1. Verify chat exists in MySQL
  await chatService.assertChatExists(chatId);

  // 2. Verify requester is a member of this chat in MySQL
  await chatService.assertChatMember(chatId, requesterId);

  // 3. Prepare Firestore query
  const messagesRef = messagesCollection(chatId);
  let firestoreQuery = messagesRef.orderBy('timestamp', 'desc');

  // Handle cursor-based pagination
  if (cursor) {
    const cursorDoc = await messagesRef.doc(cursor).get();
    if (!cursorDoc.exists) {
      throw AppError.badRequest(
        `Cursor message "${cursor}" does not exist in this chat`,
        'INVALID_CURSOR'
      );
    }
    firestoreQuery = firestoreQuery.startAfter(cursorDoc);
  }

  // Fetch limit + 1 documents to determine if there are more
  firestoreQuery = firestoreQuery.limit(limit + 1);
  const snapshot = await firestoreQuery.get();
  const docs = snapshot.docs;

  const hasMore = docs.length > limit;
  const pageDocs = hasMore ? docs.slice(0, limit) : docs;

  // Next cursor is the ID of the oldest message in the descending page
  const nextCursor = hasMore && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null;

  // Map to ChatMessageItem
  const messages: ChatMessageItem[] = pageDocs.map((doc) => {
    const data = doc.data();
    let timestampStr = '';
    if (data.timestamp && typeof data.timestamp.toDate === 'function') {
      timestampStr = data.timestamp.toDate().toISOString();
    } else if (data.timestamp instanceof Date) {
      timestampStr = data.timestamp.toISOString();
    } else if (typeof data.timestamp === 'string') {
      timestampStr = data.timestamp;
    } else {
      timestampStr = new Date().toISOString();
    }

    return {
      messageId: doc.id,
      chatId,
      senderId: data.senderId,
      text: data.text,
      timestamp: timestampStr,
    };
  });

  // Reverse so the client receives them in chronological ascending order
  messages.reverse();

  return {
    success: true,
    messages,
    hasMore,
    nextCursor,
  };
}

/**
 * Mark a message as read by a chat participant.
 *
 * 1. Verifies chat exists in MySQL (404 if not found).
 * 2. Verifies user belongs to the chat in MySQL (403 if not member).
 * 3. Verifies message exists in Firestore under chats/{chatId}/messages/{messageId} (404 if not found).
 * 4. Checks if read receipt already exists for this user:
 *    - If exists: returns existing receipt idempotently without overwriting readAt.
 *    - If new: writes read receipt to chats/{chatId}/messages/{messageId}/readReceipts/{userId}.
 * 5. Does not modify the original message document.
 */
export async function markMessageRead(
  chatId: string,
  messageId: string,
  userId: string
): Promise<MarkMessageReadResponse> {
  // 1. Verify chat exists in MySQL
  await chatService.assertChatExists(chatId);

  // 2. Verify user is a member of this chat in MySQL
  await chatService.assertChatMember(chatId, userId);

  // 3. Verify message exists in Firestore
  const messageRef = messagesCollection(chatId).doc(messageId);
  const messageSnap = await messageRef.get();
  if (!messageSnap.exists) {
    throw AppError.notFound(`Message ${messageId} in chat ${chatId}`);
  }

  // 4. Reference read receipt in subcollection: chats/{chatId}/messages/{messageId}/readReceipts/{userId}
  const receiptRef = messageRef.collection('readReceipts').doc(userId);
  const receiptSnap = await receiptRef.get();

  if (receiptSnap.exists) {
    const data = receiptSnap.data();
    let readAtStr = '';
    if (data?.readAt && typeof data.readAt.toDate === 'function') {
      readAtStr = data.readAt.toDate().toISOString();
    } else if (data?.readAt instanceof Date) {
      readAtStr = data.readAt.toISOString();
    } else if (typeof data?.readAt === 'string') {
      readAtStr = data.readAt;
    } else {
      readAtStr = new Date().toISOString();
    }

    return {
      success: true,
      message: 'Message already marked as read',
      data: {
        chatId,
        messageId,
        userId,
        readAt: readAtStr,
        isNew: false,
      },
    };
  }

  // 5. Store new read receipt with Firestore server timestamp
  await receiptRef.set({
    userId,
    readAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const savedSnap = await receiptRef.get();
  const savedData = savedSnap.data();
  let readAtStr = '';
  if (savedData?.readAt && typeof savedData.readAt.toDate === 'function') {
    readAtStr = savedData.readAt.toDate().toISOString();
  } else if (savedData?.readAt instanceof Date) {
    readAtStr = savedData.readAt.toISOString();
  } else if (typeof savedData?.readAt === 'string') {
    readAtStr = savedData.readAt;
  } else {
    readAtStr = new Date().toISOString();
  }

  return {
    success: true,
    message: 'Message marked as read successfully',
    data: {
      chatId,
      messageId,
      userId,
      readAt: readAtStr,
      isNew: true,
    },
  };
}

/**
 * Helper function to extract epoch milliseconds from Firestore timestamp, Date, string, or number.
 */
function getTimestampMillis(ts: unknown): number {
  if (!ts) return 0;
  if (typeof (ts as { toMillis?: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  if (typeof (ts as { toDate?: () => Date }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate().getTime();
  }
  if (ts instanceof Date) {
    return ts.getTime();
  }
  if (typeof ts === 'string' || typeof ts === 'number') {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }
  return 0;
}

/**
 * Update the last seen message for a user in a chat.
 *
 * 1. Verifies chat exists in MySQL (404).
 * 2. Verifies user belongs to the chat in MySQL (403).
 * 3. Verifies message exists in Firestore under chats/{chatId}/messages/{messageId} (404).
 * 4. Ensures the user cannot move last-seen backwards to an older message (400).
 * 5. Updates/maintains exactly one document per user at chats/{chatId}/lastSeen/{userId}.
 */
export async function updateLastSeen(
  chatId: string,
  userId: string,
  messageId: string
): Promise<UpdateLastSeenResponse> {
  // 1. Verify chat exists in MySQL
  await chatService.assertChatExists(chatId);

  // 2. Verify user is a member of this chat in MySQL
  await chatService.assertChatMember(chatId, userId);

  // 3. Verify target message exists in Firestore
  const messagesRef = messagesCollection(chatId);
  const targetMessageSnap = await messagesRef.doc(messageId).get();
  if (!targetMessageSnap.exists) {
    throw AppError.notFound(`Message ${messageId} in chat ${chatId}`);
  }

  const targetMessageData = targetMessageSnap.data();
  const targetTimestampMs = getTimestampMillis(targetMessageData?.timestamp);

  // 4. Retrieve current lastSeen document: chats/{chatId}/lastSeen/{userId}
  const lastSeenRef = lastSeenCollection(chatId).doc(userId);
  const lastSeenSnap = await lastSeenRef.get();

  if (lastSeenSnap.exists) {
    const currentData = lastSeenSnap.data();
    const currentMessageId = currentData?.messageId;

    if (currentMessageId === messageId) {
      // Idempotent: last-seen already points to this message
      let lastSeenAtStr = '';
      if (currentData?.lastSeenAt && typeof currentData.lastSeenAt.toDate === 'function') {
        lastSeenAtStr = currentData.lastSeenAt.toDate().toISOString();
      } else if (currentData?.lastSeenAt instanceof Date) {
        lastSeenAtStr = currentData.lastSeenAt.toISOString();
      } else if (typeof currentData?.lastSeenAt === 'string') {
        lastSeenAtStr = currentData.lastSeenAt;
      } else {
        lastSeenAtStr = new Date().toISOString();
      }

      return {
        success: true,
        message: 'Last seen is already up to date',
        data: {
          chatId,
          userId,
          messageId,
          lastSeenAt: lastSeenAtStr,
        },
      };
    }

    // Check if the target message is older than the current last seen message
    if (currentMessageId) {
      const currentMsgSnap = await messagesRef.doc(currentMessageId).get();
      if (currentMsgSnap.exists) {
        const currentTimestampMs = getTimestampMillis(currentMsgSnap.data()?.timestamp);
        if (targetTimestampMs < currentTimestampMs) {
          throw AppError.badRequest(
            'Cannot move last seen backwards to an older message',
            'INVALID_LAST_SEEN_ORDER'
          );
        }
      }
    }
  }

  // 5. Store / update lastSeen document
  await lastSeenRef.set({
    userId,
    messageId,
    lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const savedSnap = await lastSeenRef.get();
  const savedData = savedSnap.data();
  let lastSeenAtStr = '';
  if (savedData?.lastSeenAt && typeof savedData.lastSeenAt.toDate === 'function') {
    lastSeenAtStr = savedData.lastSeenAt.toDate().toISOString();
  } else if (savedData?.lastSeenAt instanceof Date) {
    lastSeenAtStr = savedData.lastSeenAt.toISOString();
  } else if (typeof savedData?.lastSeenAt === 'string') {
    lastSeenAtStr = savedData.lastSeenAt;
  } else {
    lastSeenAtStr = new Date().toISOString();
  }

  return {
    success: true,
    message: 'Last seen updated successfully',
    data: {
      chatId,
      userId,
      messageId,
      lastSeenAt: lastSeenAtStr,
    },
  };
}
