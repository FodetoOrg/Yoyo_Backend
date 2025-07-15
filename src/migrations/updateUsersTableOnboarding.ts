import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { sql } from 'drizzle-orm';
import { config } from 'dotenv';

// Load environment variables
config();

const dbUrl = process.env.TURSO_DB_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!dbUrl) {
  console.error('TURSO_DB_URL environment variable is required');
  process.exit(1);
}

async function main() {
  console.log('Connecting to Turso DB...');
  
  const client = createClient({
    url: dbUrl,
    authToken: authToken,
  });

  const db = drizzle(client);

  console.log('Updating users table for onboarding and phone+role uniqueness...');

  try {
    // Step 1: Add hasOnboarded column
    await db.run(sql`
      ALTER TABLE users ADD COLUMN has_onboarded INTEGER NOT NULL DEFAULT 0;
    `);
    console.log('✅ Added has_onboarded column');

    // Step 2: Update existing users based on role
    await db.run(sql`
      UPDATE users 
      SET has_onboarded = 1 
      WHERE role IN ('hotel', 'superAdmin', 'staff');
    `);
    console.log('✅ Set hasOnboarded=true for hotel/superAdmin/staff users');

    // Step 3: Drop existing unique constraint on phone
    await db.run(sql`
      CREATE TABLE users_new (
        id TEXT PRIMARY KEY,
        email TEXT,
        name TEXT,
        phone TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        has_onboarded INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        firebase_uid TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        UNIQUE(phone, role)
      );
    `);
    console.log('✅ Created new users table with phone+role unique constraint');

    // Step 4: Copy data from old table to new table
    await db.run(sql`
      INSERT INTO users_new (
        id, email, name, phone, role, has_onboarded, status, 
        firebase_uid, created_at, updated_at
      )
      SELECT 
        id, email, name, phone, role, has_onboarded, status,
        firebase_uid, created_at, updated_at
      FROM users;
    `);
    console.log('✅ Copied data to new table');

    // Step 5: Drop old table and rename new table
    await db.run(sql`DROP TABLE users;`);
    await db.run(sql`ALTER TABLE users_new RENAME TO users;`);
    console.log('✅ Replaced old table with new table');

    // Step 6: Recreate indexes
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_users_phone_role ON users(phone, role);`);
    console.log('✅ Recreated indexes');

    console.log('🎉 Users table migration completed successfully!');
    console.log('');
    console.log('Changes made:');
    console.log('- ✅ Added has_onboarded column (default: false)');
    console.log('- ✅ Set has_onboarded=true for existing hotel/superAdmin/staff users');
    console.log('- ✅ Changed unique constraint from phone to phone+role combination');
    console.log('- ✅ Same phone number can now have different roles');

  } catch (error) {
    console.error('❌ Error updating users table:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('Database connection closed');
  }
}

main();