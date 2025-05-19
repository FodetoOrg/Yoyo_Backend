import { Database } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

export async function updateToFirebaseAuth(db: Database) {
  const d = drizzle(db);

  // Drop OTP table
  await db.exec('DROP TABLE IF EXISTS otps');

  // Update users table
  await db.exec(`
    -- Create temporary table with new schema
    CREATE TABLE users_new (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      phone TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      firebase_uid TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- Copy data from old table to new table
    -- Note: firebase_uid will be NULL initially and needs to be updated when users log in
    INSERT INTO users_new (id, email, name, phone, role, created_at, updated_at)
    SELECT id, 
           COALESCE(email, phone || '@temp.com') as email,
           name,
           phone,
           role,
           created_at,
           updated_at
    FROM users;

    -- Drop old table
    DROP TABLE users;

    -- Rename new table to users
    ALTER TABLE users_new RENAME TO users;

    -- Create indexes
    CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);
    CREATE INDEX idx_users_email ON users(email);
  `);

  console.log('✅ Updated schema to use Firebase authentication');
} 