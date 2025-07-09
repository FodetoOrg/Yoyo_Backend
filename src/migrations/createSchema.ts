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

    // Create room types table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS room_types (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);
    console.log('Room types table created');

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
        commission_rate REAL NOT NULL DEFAULT 10,
        status TEXT NOT NULL DEFAULT 'active',
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
        room_number TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        room_type_id TEXT,
        max_guests INTEGER NOT NULL DEFAULT 1,
        bed_type TEXT,
        size REAL,
        floor INTEGER,
        price_per_night REAL NOT NULL,
        price_per_hour REAL,
        is_hourly_booking INTEGER NOT NULL DEFAULT 0,
        is_daily_booking INTEGER NOT NULL DEFAULT 1,
        amenities TEXT,
        status TEXT NOT NULL DEFAULT 'available',
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (hotel_id) REFERENCES hotels(id) ON DELETE CASCADE,
        FOREIGN KEY (room_type_id) REFERENCES room_types(id)
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

    // Create invoices table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        booking_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        hotel_id TEXT NOT NULL,
        amount REAL NOT NULL,
        tax REAL NOT NULL DEFAULT 0,
        total_amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        due_date INTEGER NOT NULL,
        paid_date INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (booking_id) REFERENCES bookings(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (hotel_id) REFERENCES hotels(id)
      )
    `);
    console.log('Invoices table created');

    // Create coupons table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS coupons (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        description TEXT,
        discount_type TEXT NOT NULL,
        discount_value REAL NOT NULL,
        max_discount_amount REAL,
        min_order_amount REAL DEFAULT 0,
        valid_from INTEGER NOT NULL,
        valid_to INTEGER NOT NULL,
        usage_limit INTEGER,
        used_count INTEGER NOT NULL DEFAULT 0,
        price_increase_percentage REAL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);
    console.log('Coupons table created');

    // Create coupon mappings table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS coupon_mappings (
        id TEXT PRIMARY KEY,
        coupon_id TEXT NOT NULL,
        city_id TEXT,
        hotel_id TEXT,
        room_type_id TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
        FOREIGN KEY (city_id) REFERENCES cities(id),
        FOREIGN KEY (hotel_id) REFERENCES hotels(id),
        FOREIGN KEY (room_type_id) REFERENCES room_types(id)
      )
    `);
    console.log('Coupon mappings table created');

    // Create revenue records table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS revenue_records (
        id TEXT PRIMARY KEY,
        hotel_id TEXT NOT NULL,
        period TEXT NOT NULL,
        total_revenue REAL NOT NULL,
        commission_rate REAL NOT NULL,
        commission_amount REAL NOT NULL,
        payable_amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        due_date INTEGER NOT NULL,
        paid_date INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (hotel_id) REFERENCES hotels(id)
      )
    `);
    console.log('Revenue records table created');

    // Create price adjustments table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS price_adjustments (
        id TEXT PRIMARY KEY,
        cities TEXT,
        hotels TEXT,
        room_types TEXT,
        adjustment_type TEXT NOT NULL,
        adjustment_value REAL NOT NULL,
        reason TEXT,
        effective_date INTEGER NOT NULL,
        expiry_date INTEGER,
        status TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);
    console.log('Price adjustments table created');

    // Create notifications table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'info',
        data TEXT,
        read INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    console.log('Notifications table created');

    // Create notification queue table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS notification_queue (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 5,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        data TEXT,
        push_token TEXT,
        email TEXT,
        phone TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        scheduled_at INTEGER,
        process_after INTEGER NOT NULL DEFAULT (unixepoch()),
        sent_at INTEGER,
        failed_at INTEGER,
        error TEXT,
        response TEXT,
        source TEXT,
        source_id TEXT,
        batch_id TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    console.log('Notification queue table created');

    // Create notification templates table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS notification_templates (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        push_title TEXT,
        push_body TEXT,
        email_subject TEXT,
        email_html TEXT,
        email_text TEXT,
        sms_text TEXT,
        in_app_title TEXT,
        in_app_message TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        priority INTEGER NOT NULL DEFAULT 5,
        channels TEXT NOT NULL DEFAULT '["in_app"]',
        variables TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);
    console.log('Notification templates table created');

    // Create user notification preferences table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS user_notification_preferences (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        push_enabled INTEGER NOT NULL DEFAULT 1,
        email_enabled INTEGER NOT NULL DEFAULT 1,
        sms_enabled INTEGER NOT NULL DEFAULT 0,
        booking_notifications INTEGER NOT NULL DEFAULT 1,
        payment_notifications INTEGER NOT NULL DEFAULT 1,
        promotional_notifications INTEGER NOT NULL DEFAULT 0,
        system_notifications INTEGER NOT NULL DEFAULT 1,
        quiet_hours_start TEXT DEFAULT '22:00',
        quiet_hours_end TEXT DEFAULT '08:00',
        timezone TEXT DEFAULT 'Asia/Kolkata',
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    console.log('User notification preferences table created');

    // Create payment orders table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS payment_orders (
        id TEXT PRIMARY KEY,
        booking_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        razorpay_order_id TEXT NOT NULL UNIQUE,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'INR',
        status TEXT NOT NULL DEFAULT 'created',
        receipt TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (booking_id) REFERENCES bookings(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    console.log('Payment orders table created');

    // Create payment webhooks table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS payment_webhooks (
        id TEXT PRIMARY KEY,
        razorpay_event_id TEXT NOT NULL UNIQUE,
        event TEXT NOT NULL,
        payment_id TEXT,
        order_id TEXT,
        signature TEXT NOT NULL,
        payload TEXT NOT NULL,
        processed INTEGER NOT NULL DEFAULT 0,
        processed_at INTEGER,
        error TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);
    console.log('Payment webhooks table created');

    // Create admin payments table
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS admin_payments (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        from_user_id TEXT,
        to_user_id TEXT,
        hotel_id TEXT,
        booking_id TEXT,
        revenue_record_id TEXT,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'INR',
        method TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        reference TEXT,
        reason TEXT,
        metadata TEXT,
        processed_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (from_user_id) REFERENCES users(id),
        FOREIGN KEY (to_user_id) REFERENCES users(id),
        FOREIGN KEY (booking_id) REFERENCES bookings(id)
      )
    `);
    console.log('Admin payments table created');

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
    
    // Create indexes for new tables
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_rooms_room_type_id ON rooms(room_type_id)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_invoices_booking_id ON invoices(booking_id)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_invoices_hotel_id ON invoices(hotel_id)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_coupon_mappings_coupon_id ON coupon_mappings(coupon_id)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_revenue_records_hotel_id ON revenue_records(hotel_id)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_revenue_records_period ON revenue_records(period)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read)`);
    
    // Create indexes for notification queue
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_notification_queue_user_id ON notification_queue(user_id)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_notification_queue_priority ON notification_queue(priority)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_notification_queue_process_after ON notification_queue(process_after)`);
    
    // Create indexes for payment tables
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_payment_orders_booking_id ON payment_orders(booking_id)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id ON payment_orders(user_id)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_payment_orders_razorpay_order_id ON payment_orders(razorpay_order_id)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_payment_webhooks_event_id ON payment_webhooks(razorpay_event_id)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_admin_payments_type ON admin_payments(type)`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_admin_payments_status ON admin_payments(status)`);
    
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