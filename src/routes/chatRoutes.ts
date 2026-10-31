/**
 * API Routes — Phase 1 (MySQL only)
 *
 * User routes:
 *   POST   /api/v1/user              — create a user
 *   GET    /api/v1/user/:userId      — get a user by ID
 *   GET    /api/v1/user/:userId/chats — list all chats for a user
 *
 * Chat routes:
 *   POST   /api/v1/chat/create       — create or get a 1:1 chat
 *
 * Firebase message routes (Phase 2 — not yet implemented):
 *   POST   /api/v1/chat/:chatId/message/send
 *   GET    /api/v1/chat/:chatId/messages
 *   POST   /api/v1/chat/:chatId/message/:messageId/read
 *   POST   /api/v1/chat/:chatId/lastseen
 */

import { Router } from 'express';
import * as chatController from '../controllers/chatController';
import * as userController from '../controllers/userController';
import { validate } from '../middleware/validate';
import {
  createUserSchema,
  createChatSchema,
  userIdParamSchema,
  chatIdParamSchema,
  sendMessageSchema,
} from '../validators/schemas';

const router = Router();

// ─── User Routes ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/user
 * Create a new user. Returns 201 with the generated userId.
 */
router.post(
  '/user',
  validate(createUserSchema, 'body'),
  userController.createUser
);

/**
 * GET /api/v1/user/:userId
 * Retrieve a user by UUID. Returns 404 if not found.
 */
router.get(
  '/user/:userId',
  validate(userIdParamSchema, 'params'),
  userController.getUserById
);

/**
 * GET /api/v1/user/:userId/chats
 * List all chats for a user, ordered by latest updated time.
 * Returns member IDs for each chat.
 */
router.get(
  '/user/:userId/chats',
  validate(userIdParamSchema, 'params'),
  chatController.getUserChats
);

// ─── Chat Routes ──────────────────────────────────────────────────────────────

/**
 * POST /api/v1/chat/create
 * Create or retrieve an existing 1:1 chat between two users.
 * Returns 201 if created, 200 if already exists.
 * Same chat is always returned regardless of userAId/userBId order.
 */
router.post(
  '/chat/create',
  validate(createChatSchema, 'body'),
  chatController.createChat
);

/**
 * POST /api/v1/chat/:chatId/message/send
 * Send a message in a chat.
 * 1. Validates chatId and body (senderId, text).
 * 2. Verifies chat exists and sender is a member using MySQL.
 * 3. Stores message in Firestore: chats/{chatId}/messages/{messageId}.
 */
router.post(
  '/chat/:chatId/message/send',
  validate(chatIdParamSchema, 'params'),
  validate(sendMessageSchema, 'body'),
  chatController.sendMessage
);

// ─── Isolated Connection Test Route (Non-production only) ───────────────────
import { v4 as uuidv4 } from 'uuid';
import { getFirestore } from '../config/firebase';
import { config } from '../config/env';

if (config.env !== 'production') {
  /**
   * GET /api/v1/test/firestore
   * Diagnostic endpoint to test writing & reading from Firestore.
   * By default, does NOT delete the document so it remains visible in Firebase Console.
   * Pass ?cleanup=true to delete after testing.
   */
  router.get('/test/firestore', async (req, res, next) => {
    try {
      const db = getFirestore();
      const firestoreAny = db as unknown as { projectId?: string; _projectId?: string; databaseId?: string; _databaseId?: string };
      const projectId = firestoreAny.projectId || firestoreAny._projectId || 'codefortomorrow-57d8e';
      const databaseId = firestoreAny.databaseId || firestoreAny._databaseId || '(default)';
      const shouldCleanup = req.query.cleanup === 'true';
      const testDocId = `test_${uuidv4()}`;
      const docRef = db.collection('connection_tests').doc(testDocId);
      const testData = {
        testId: testDocId,
        message: 'Firestore connection test from Chat Backend',
        testedAt: new Date().toISOString(),
      };

      // Server-side diagnostic logs (never logging secrets)
      console.log('\n[Firestore Diagnostic] ─── Starting Firestore Write/Read Test ───');
      console.log(`[Firestore Diagnostic] Project ID:    ${projectId}`);
      console.log(`[Firestore Diagnostic] Database ID:   ${databaseId}`);
      console.log(`[Firestore Diagnostic] Document Path: ${docRef.path}`);

      // 1. Await write operation and capture write metadata
      const writeResult = await docRef.set(testData);
      const writeTime = writeResult.writeTime.toDate().toISOString();
      console.log(`[Firestore Diagnostic] Write status:  SUCCESS (WriteTime: ${writeTime})`);

      // 2. Read back
      const snapshot = await docRef.get();
      const retrieved = snapshot.data();
      console.log(`[Firestore Diagnostic] Read status:   SUCCESS (Document exists: ${snapshot.exists})`);

      // 3. Clean up only if explicitly requested
      if (shouldCleanup) {
        await docRef.delete();
        console.log('[Firestore Diagnostic] Cleanup:       Document deleted as requested (?cleanup=true)');
      } else {
        console.log('[Firestore Diagnostic] Persistence:   Document retained for Firebase Console verification');
      }
      console.log('[Firestore Diagnostic] ────────────────────────────────────────────────\n');

      res.status(200).json({
        success: true,
        message: shouldCleanup
          ? 'Firestore connection verified and test document cleaned up.'
          : 'Firestore connection verified successfully. Document retained so you can view it in the Firebase Console.',
        diagnostic: {
          projectId,
          databaseId,
          collection: 'connection_tests',
          documentId: testDocId,
          documentPath: docRef.path,
          writeTime,
          persistedInConsole: !shouldCleanup,
          firebaseConsoleUrl: `https://console.firebase.google.com/project/${projectId}/firestore/databases/-default-/data/~2Fconnection_tests~2F${testDocId}`,
        },
        data: {
          written: testData,
          retrieved,
        },
      });
    } catch (err) {
      console.error('[Firestore Diagnostic] ❌ Error:', err);
      next(err);
    }
  });
}

// ─── Future Firebase Routes (Phase 2 placeholder) ────────────────────────────
// router.post('/chat/:chatId/message/send',   ...);
// router.get('/chat/:chatId/messages',        ...);
// router.post('/chat/:chatId/message/:messageId/read', ...);
// router.post('/chat/:chatId/lastseen',       ...);

export default router;
