import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';
import { join } from 'path';

let serviceAccount;

try {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 'firebase-adminsdk.json';
  const fileContents = readFileSync(join(process.cwd(), serviceAccountPath), 'utf8');
  serviceAccount = JSON.parse(fileContents);
} catch (err) {
  console.warn(
    '⚠️  Could not load Firebase Service Account from file. Firebase Admin may not initialize properly if default credentials are not set.',
  );
}

if (!getApps().length) {
  if (serviceAccount) {
    initializeApp({
      credential: cert(serviceAccount),
    });
  } else {
    initializeApp();
  }
}

export const firebaseAuth = getAuth();
