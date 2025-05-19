import admin from 'firebase-admin';
import serviceAccountJson from './firebase-service-account.json';

// // Import Service Account Key
// const serviceAccount = require('./firebase-service-account.json');

// Initialize Firebase Admin SDK
const serviceAccount = serviceAccountJson as admin.ServiceAccount;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});


if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    console.log('🔥 Using Firebase Auth Emulator:', process.env.FIREBASE_AUTH_EMULATOR_HOST);
  }else{
    console.log('not using emulator');
  }

export default admin;
