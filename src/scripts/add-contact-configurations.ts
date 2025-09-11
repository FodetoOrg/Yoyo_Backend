// @ts-nocheck
import { createClient } from "@libsql/client/node";
import { drizzle } from 'drizzle-orm/libsql';
import { configurations } from '../models/schema';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function addContactConfigurations() {
  const dbUrl = process.env.TURSO_DB_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!dbUrl) {
    throw new Error('TURSO_DB_URL environment variable is not set');
  }

  const client = createClient({
    url: dbUrl,
    authToken: authToken,
  });

  const db = drizzle(client);

  const contactConfigurations = [
    {
      key: 'general_inquiries_phone',
      value: '',
      type: 'string',
      description: 'Phone number for general inquiries',
      category: 'contact'
    },
    {
      key: 'general_inquiries_email',
      value: '',
      type: 'string',
      description: 'Email address for general inquiries',
      category: 'contact'
    },
    {
      key: 'support_phone',
      value: '',
      type: 'string',
      description: 'Phone number for customer support',
      category: 'contact'
    },
    {
      key: 'support_email',
      value: '',
      type: 'string',
      description: 'Email address for customer support',
      category: 'contact'
    }
  ];

  console.log('Adding contact configurations...');

  for (const config of contactConfigurations) {
    try {
      // Check if configuration already exists
      const existing = await db.select()
        .from(configurations)
        .where(eq(configurations.key, config.key))
        .limit(1);

      if (existing.length === 0) {
        // Insert new configuration
        await db.insert(configurations)
          .values({
            id: uuidv4(),
            key: config.key,
            value: config.value,
            type: config.type,
            description: config.description,
            category: config.category,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        console.log(`✅ Added configuration: ${config.key}`);
      } else {
        console.log(`⏭️  Configuration already exists: ${config.key}`);
      }
    } catch (error) {
      console.error(`❌ Error adding configuration ${config.key}:`, error);
    }
  }

  await client.close();
  console.log('✨ Contact configurations setup complete!');
}

// Run the script
addContactConfigurations().catch(console.error);
