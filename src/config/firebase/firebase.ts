import admin, { ServiceAccount } from 'firebase-admin';
import serviceAccountJson from './firebase-service-account.json';

const base64Cred = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
if (!base64Cred) {
  throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set in environment variables");
}

const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
if (!bucketName) {
  throw new Error('FIREBASE_STORAGE_BUCKET is not set in environment variables');
}

const decoded = Buffer.from(base64Cred, 'base64').toString('utf8');
const serviceAccount = JSON.parse(decoded);

if (!admin.apps.length && serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as ServiceAccount),
    storageBucket: bucketName,
  });
}

// Upload to storage function
export const uploadToStorage = async (
  file: Buffer,
  key: string,
  contentType: string
): Promise<string> => {
  const bucket = admin.storage().bucket();
  const remoteFile = bucket.file(key);
  
  await remoteFile.save(file, {
    metadata: { contentType },
    public: true,
  });
  
  return `https://storage.googleapis.com/${bucket.name}/${key}`;
};

export default admin;