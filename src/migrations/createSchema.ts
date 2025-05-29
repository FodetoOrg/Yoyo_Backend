import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { sql } from 'drizzle-orm';
import * as schema from '../models/schema';
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

  console.log('Creating schema...');

  try {
    // Create tables in order to handle dependencies correctly
    
    // Create users table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT,
        phone TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        firebase_uid TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);
    console.log('Users table created');

    // Create staff table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS staff (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        department TEXT,
        position TEXT,
        joining_date INTEGER NOT NULL DEFAULT (unixepoch()),
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    console.log('Staff table created');

    // Create staff permissions table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS staff_permissions (
        id TEXT PRIMARY KEY,
        staff_id TEXT NOT NULL,
        permission_key TEXT NOT NULL,
        permission_value TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
      )
    `);
    console.log('Staff permissions table created');

    // Create otps table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS otps (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        phone TEXT NOT NULL,
        otp TEXT NOT NULL,
        verified INTEGER NOT NULL DEFAULT 0,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    console.log('OTPs table created');

    // Create hotels table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS hotels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        address TEXT NOT NULL,
        city TEXT NOT NULL,
        state TEXT,
        country TEXT NOT NULL,
        zip_code TEXT,
        star_rating INTEGER,
        amenities TEXT,
        owner_id TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (owner_id) REFERENCES users(id)
      )
    `);
    console.log('Hotels table created');

    // Create hotel_images table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS hotel_images (
        id TEXT PRIMARY KEY,
        hotel_id TEXT NOT NULL,
        url TEXT NOT NULL,
        is_primary INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
      )
    `);
    console.log('Hotel images table created');

    // Create rooms table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        hotel_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        max_guests INTEGER NOT NULL DEFAULT 1,
        price_per_night REAL NOT NULL,
        price_per_hour REAL,
        room_type TEXT NOT NULL,
        amenities TEXT,
        available INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE
      )
    `);
    console.log('Rooms table created');

    // Create room_images table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS room_images (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        url TEXT NOT NULL,
        is_primary INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
      )
    `);
    console.log('Room images table created');

    // Create bookings table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        hotel_id TEXT NOT NULL,
        room_id TEXT NOT NULL,
        check_in_date INTEGER NOT NULL,
        check_out_date INTEGER NOT NULL,
        booking_type TEXT NOT NULL DEFAULT 'daily',
        total_hours INTEGER,
        guest_count INTEGER NOT NULL DEFAULT 1,
        total_amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        payment_status TEXT NOT NULL DEFAULT 'pending',
        booking_date INTEGER NOT NULL DEFAULT (unixepoch()),
        special_requests TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (hotel_id) REFERENCES hotels(id),
        FOREIGN KEY (room_id) REFERENCES rooms(id)
      )
    `);
    console.log('Bookings table created');

    // Create payments table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        booking_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'INR',
        payment_method TEXT,
        razorpay_payment_id TEXT,
        razorpay_order_id TEXT,
        razorpay_signature TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        transaction_date INTEGER NOT NULL DEFAULT (unixepoch()),
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (booking_id) REFERENCES bookings(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    console.log('Payments table created');

    // Create reviews table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        hotel_id TEXT NOT NULL,
        booking_id TEXT,
        rating INTEGER NOT NULL,
        comment TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (hotel_id) REFERENCES hotels(id),
        FOREIGN KEY (booking_id) REFERENCES bookings(id)
      )
    `);
    console.log('Reviews table created');

    console.log('Schema creation completed successfully');

    // Create indexes for performance
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_hotels_city ON hotels(city)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_bookings_hotel_id ON bookings(hotel_id)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_rooms_hotel_id ON rooms(hotel_id)`);
    
    // Create indexes for staff tables
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_staff_user_id ON staff(user_id)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_staff_permissions_staff_id ON staff_permissions(staff_id)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_staff_permissions_key ON staff_permissions(permission_key)`);
    
    console.log('Indexes created');

  } catch (error) {
    console.error('Error creating schema:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('Database connection closed');
  }
}

main();