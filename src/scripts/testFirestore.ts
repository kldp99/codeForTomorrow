/**
 * Standalone Firestore Connectivity Test Script.
 *
 * Verifies:
 *  1. Firebase Admin SDK initializes successfully using the service account credentials.
 *  2. A test document can be written to the `connection_tests` collection.
 *  3. The written document can be read back and verified.
 *  4. Cleans up the test document.
 *
 * Usage:
 *  npm run test:firestore
 */

import { v4 as uuidv4 } from 'uuid';
import { getFirestore } from '../config/firebase';

async function runFirestoreTest(): Promise<void> {
  console.log('\n🔥 ─── Testing Firebase Admin & Firestore Connectivity ───\n');

  try {
    // 1. Initialize Firestore
    console.log('[1/4] Initializing Firebase Admin SDK & Firestore…');
    const db = getFirestore();
    console.log('      ✔ Firestore client initialized successfully.');

    // 2. Write test document
    const testDocId = `test_${uuidv4()}`;
    const testCollection = db.collection('connection_tests');
    const testData = {
      testId: testDocId,
      message: 'Firestore connection test from Chat Backend',
      createdAt: new Date().toISOString(),
      status: 'active',
    };

    console.log(`[2/4] Writing test document to "connection_tests/${testDocId}"…`);
    await testCollection.doc(testDocId).set(testData);
    console.log('      ✔ Test document written successfully.');

    // 3. Read back test document
    console.log(`[3/4] Reading back document "connection_tests/${testDocId}"…`);
    const docSnapshot = await testCollection.doc(testDocId).get();

    if (!docSnapshot.exists) {
      throw new Error(`Document ${testDocId} was not found after write!`);
    }

    const fetchedData = docSnapshot.data();
    console.log('      ✔ Document retrieved successfully:');
    console.log('      ', JSON.stringify(fetchedData, null, 2));

    if (fetchedData?.testId !== testData.testId) {
      throw new Error('Data mismatch between written and read document.');
    }

    // 4. Persistence / Clean up
    const cleanup = process.argv.includes('--cleanup');
    const firestoreAny = db as unknown as { projectId?: string; _projectId?: string };
    const projectId = firestoreAny.projectId || firestoreAny._projectId || 'codefortomorrow-57d8e';

    if (cleanup) {
      console.log(`[4/4] Cleaning up test document…`);
      await testCollection.doc(testDocId).delete();
      console.log('      ✔ Test document deleted successfully.');
    } else {
      console.log(`[4/4] Document retained for Firebase Console verification:`);
      console.log(`      Collection:  connection_tests`);
      console.log(`      Document ID: ${testDocId}`);
      console.log(`      Console URL: https://console.firebase.google.com/project/${projectId}/firestore/databases/-default-/data/~2Fconnection_tests~2F${testDocId}`);
      console.log(`      (To delete next time, run: npm run test:firestore -- --cleanup)`);
    }

    console.log('\n✅ ─── All Firestore Connection Tests Passed! ───\n');
    process.exit(0);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('\n❌ Firestore Connection Test Failed:\n', errorMsg);
    if (err instanceof Error && err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

void runFirestoreTest();

