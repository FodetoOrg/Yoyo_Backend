import admin from 'firebase-admin';

// // Initialize Firebase Admin
// const serviceAccount = require('./src/config/firebase-service-account.json');

import serviceAccountJson from './firebase-service-account.json';

const serviceAccount = serviceAccountJson as admin.ServiceAccount;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Generate Custom Token
async function generateToken(uid: string) {
  try {
    const customToken = await admin.auth().createCustomToken(uid);
    console.log('Custom Token:', customToken);
  } catch (error) {
    console.error('Error generating token:', error);
  }
}

// Replace this with the UID from emulator
const testUid = 'of5MJKB1IpxCxJqZVlWujDFOwC09';
generateToken(testUid);
