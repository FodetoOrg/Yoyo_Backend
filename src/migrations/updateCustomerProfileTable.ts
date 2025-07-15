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

  console.log('Updating customer_profiles table for onboarding...');

  try {
    // Add skippedOnboarding column to customer_profiles table
    await db.run(sql`
      ALTER TABLE customer_profiles 
      ADD COLUMN skipped_onboarding INTEGER NOT NULL DEFAULT 0;
    `);
    console.log('✅ Added skipped_onboarding column to customer_profiles table');

    console.log('🎉 Customer profiles table migration completed successfully!');
    console.log('');
    console.log('Changes made:');
    console.log('- ✅ Added skipped_onboarding column (default: false)');
    console.log('- ✅ Existing profiles will have skipped_onboarding = false');

  } catch (error) {
    console.error('❌ Error updating customer_profiles table:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('Database connection closed');
  }
}

main();