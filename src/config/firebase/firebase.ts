import admin from 'firebase-admin';
import serviceAccountJson from './firebase-service-account.json';

const serviceAccount = serviceAccountJson as admin.ServiceAccount;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default admin;
