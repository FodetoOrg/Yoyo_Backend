
import { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';

export async function removeCouponColumnsFromBookings(fastify: FastifyInstance) {
  const db = fastify.db;
  
  try {
    // Remove coupon_id column
    await db.run(sql`
      ALTER TABLE bookings DROP COLUMN coupon_id
    `);
    
    // Remove discount_amount column  
    await db.run(sql`
      ALTER TABLE bookings DROP COLUMN discount_amount
    `);
    
    console.log('Successfully removed coupon columns from bookings table');
  } catch (error) {
    console.error('Error removing coupon columns from bookings table:', error);
    // Note: SQLite doesn't support DROP COLUMN in all versions
    // You might need to recreate the table if this fails
    throw error;
  }
}
