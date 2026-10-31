import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { config } from '../config/env';

let app: admin.app.App | null = null;
let db: FirebaseFirestore.Firestore | null = null;

/**
 * Initialise Firebase Admin SDK (idempotent – safe to call multiple times).
 * Priority:
 *   1. FIREBASE_SERVICE_ACCOUNT_PATH – path to a service-account JSON file
 *   2. Individual env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */
function initFirebase(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.apps[0] as admin.app.App;
  }

  let credential: admin.credential.Credential;

  const saPath = config.firebase.serviceAccountPath;

  if (saPath) {
    const projectRoot = path.resolve(__dirname, '../../');
    const resolvedPath = path.isAbsolute(saPath)
      ? saPath
      : path.resolve(projectRoot, saPath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(
        `[Firebase] Service account file not found at: ${resolvedPath}\n` +
        'Set FIREBASE_SERVICE_ACCOUNT_PATH or use inline env vars.'
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8')) as admin.ServiceAccount;
    credential = admin.credential.cert(serviceAccount);
    console.log('[Firebase] Initialised using service account file.');
  } else if (config.firebase.projectId && config.firebase.clientEmail && config.firebase.privateKey) {
    credential = admin.credential.cert({
      projectId: config.firebase.projectId,
      clientEmail: config.firebase.clientEmail,
      privateKey: config.firebase.privateKey,
    });
    console.log('[Firebase] Initialised using inline env credentials.');
  } else {
    throw new Error(
      '[Firebase] No credentials found.\n' +
      'Provide FIREBASE_SERVICE_ACCOUNT_PATH or set FIREBASE_PROJECT_ID, ' +
      'FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in .env'
    );
  }

  return admin.initializeApp({ credential });
}

/**
 * Returns the Firestore singleton.
 */
export function getFirestore(): FirebaseFirestore.Firestore {
  if (!db) {
    app = initFirebase();
    db = admin.firestore();
    db.settings({ ignoreUndefinedProperties: true });
    console.log('[Firestore] Client ready.');
  }
  return db;
}

/**
 * Shorthand for the `messages` sub-collection inside a chat document.
 */
export function messagesCollection(
  chatId: string
): FirebaseFirestore.CollectionReference<FirebaseFirestore.DocumentData> {
  return getFirestore().collection('chats').doc(chatId).collection('messages');
}

/**
 * Shorthand for the `lastSeen` sub-collection inside a chat document:
 * chats/{chatId}/lastSeen
 */
export function lastSeenCollection(
  chatId: string
): FirebaseFirestore.CollectionReference<FirebaseFirestore.DocumentData> {
  return getFirestore().collection('chats').doc(chatId).collection('lastSeen');
}
