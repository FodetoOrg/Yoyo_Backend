import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '../models/schema';
import { v4 as uuidv4 } from 'uuid';
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

  const db = drizzle(client, { schema });

  console.log('Seeding database...');
  
  try {
    // Create admin user
    const adminId = uuidv4();
    await db.insert(schema.users).values({
      id: adminId,
      email: 'admin@example.com',
      name: 'Admin User',
      phone: '+911234567890',
      role: 'admin',
      firebaseUid: 'firebase_admin_' + uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoNothing();
    console.log('Admin user created');

    // Create hotel owner
    const ownerId = uuidv4();
    await db.insert(schema.users).values({
      id: ownerId,
      email: 'owner@example.com',
      name: 'Hotel Owner',
      phone: '+919876543210',
      role: 'hotel_owner',
      firebaseUid: 'firebase_owner_' + uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoNothing();
    console.log('Hotel owner created');

    // Create regular user
    const userId = uuidv4();
    await db.insert(schema.users).values({
      id: userId,
      email: 'user@example.com',
      name: 'Regular User',
      phone: '+919988776655',
      role: 'user',
      firebaseUid: 'firebase_user_' + uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoNothing();
    console.log('Regular user created');

    // Create some hotels
    const hotel1Id = uuidv4();
    await db.insert(schema.hotels).values({
      id: hotel1Id,
      name: 'Luxury Palace Hotel',
      description: 'A luxurious 5-star hotel in the heart of the city with world-class amenities and exceptional service.',
      address: '123 Main Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      zipCode: '400001',
      starRating: 5,
      amenities: JSON.stringify(['Swimming Pool', 'Spa', 'Gym', 'Restaurant', 'Room Service', 'Free Wi-Fi']),
      ownerId: ownerId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoNothing();
    console.log('Hotel 1 created');

    const hotel2Id = uuidv4();
    await db.insert(schema.hotels).values({
      id: hotel2Id,
      name: 'Business Comfort Inn',
      description: 'A modern business hotel with comfortable rooms and excellent meeting facilities.',
      address: '456 Commercial Avenue',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      zipCode: '560001',
      starRating: 4,
      amenities: JSON.stringify(['Business Center', 'Conference Rooms', 'Restaurant', 'Free Wi-Fi', 'Airport Shuttle']),
      ownerId: ownerId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoNothing();
    console.log('Hotel 2 created');

    // Add hotel images
    await db.insert(schema.hotelImages).values({
      id: uuidv4(),
      hotelId: hotel1Id,
      url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945',
      isPrimary: true,
      createdAt: new Date(),
    }).onConflictDoNothing();

    await db.insert(schema.hotelImages).values({
      id: uuidv4(),
      hotelId: hotel2Id,
      url: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa',
      isPrimary: true,
      createdAt: new Date(),
    }).onConflictDoNothing();
    console.log('Hotel images added');

    // Create rooms for hotel 1
    const room1Id = uuidv4();
    await db.insert(schema.rooms).values({
      id: room1Id,
      hotelId: hotel1Id,
      name: 'Deluxe Suite',
      description: 'Spacious suite with a king-size bed, sitting area, and luxury bathroom.',
      maxGuests: 2,
      pricePerNight: 15000,
      pricePerHour: 2000,
      roomType: 'suite',
      amenities: JSON.stringify(['King Bed', 'Bathtub', 'Sea View', 'Mini Bar', 'Air Conditioning']),
      available: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoNothing();

    const room2Id = uuidv4();
    await db.insert(schema.rooms).values({
      id: room2Id,
      hotelId: hotel1Id,
      name: 'Family Room',
      description: 'Perfect for families with two queen beds and extra space.',
      maxGuests: 4,
      pricePerNight: 18000,
      roomType: 'family',
      amenities: JSON.stringify(['Two Queen Beds', 'Bathtub', 'City View', 'Mini Bar', 'Air Conditioning']),
      available: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoNothing();
    console.log('Rooms for hotel 1 created');

    // Create rooms for hotel 2
    const room3Id = uuidv4();
    await db.insert(schema.rooms).values({
      id: room3Id,
      hotelId: hotel2Id,
      name: 'Business Single',
      description: 'Compact room for business travelers with all necessary amenities.',
      maxGuests: 1,
      pricePerNight: 8000,
      pricePerHour: 1200,
      roomType: 'single',
      amenities: JSON.stringify(['Work Desk', 'Fast Wi-Fi', 'Coffee Maker', 'Air Conditioning']),
      available: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoNothing();

    const room4Id = uuidv4();
    await db.insert(schema.rooms).values({
      id: room4Id,
      hotelId: hotel2Id,
      name: 'Executive Double',
      description: 'Spacious room with a queen bed and business facilities.',
      maxGuests: 2,
      pricePerNight: 12000,
      pricePerHour: 1800,
      roomType: 'double',
      amenities: JSON.stringify(['Queen Bed', 'Work Desk', 'Fast Wi-Fi', 'Coffee Maker', 'City View', 'Air Conditioning']),
      available: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoNothing();
    console.log('Rooms for hotel 2 created');

    // Add room images
    await db.insert(schema.roomImages).values({
      id: uuidv4(),
      roomId: room1Id,
      url: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461',
      isPrimary: true,
      createdAt: new Date(),
    }).onConflictDoNothing();

    await db.insert(schema.roomImages).values({
      id: uuidv4(),
      roomId: room2Id,
      url: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a',
      isPrimary: true,
      createdAt: new Date(),
    }).onConflictDoNothing();

    await db.insert(schema.roomImages).values({
      id: uuidv4(),
      roomId: room3Id,
      url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427',
      isPrimary: true,
      createdAt: new Date(),
    }).onConflictDoNothing();

    await db.insert(schema.roomImages).values({
      id: uuidv4(),
      roomId: room4Id,
      url: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39',
      isPrimary: true,
      createdAt: new Date(),
    }).onConflictDoNothing();
    console.log('Room images added');

    // Create a sample booking
    const bookingId = uuidv4();
    const checkIn = new Date();
    const checkOut = new Date();
    checkOut.setDate(checkOut.getDate() + 2);

    await db.insert(schema.bookings).values({
      id: bookingId,
      userId,
      hotelId: hotel1Id,
      roomId: room1Id,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      bookingType: 'daily',
      guestCount: 2,
      totalAmount: 30000,
      status: 'confirmed',
      paymentStatus: 'completed',
      specialRequests: 'Early check-in requested',
      bookingDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoNothing();
    console.log('Sample booking created');

    // Create a sample payment
    await db.insert(schema.payments).values({
      id: uuidv4(),
      bookingId,
      userId,
      amount: 30000,
      currency: 'INR',
      paymentMethod: 'credit_card',
      status: 'completed',
      transactionDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoNothing();
    console.log('Sample payment created');

    // Create a sample review
    await db.insert(schema.reviews).values({
      id: uuidv4(),
      userId,
      hotelId: hotel1Id,
      bookingId,
      rating: 5,
      comment: 'Excellent stay! The staff was very friendly and the room was clean and comfortable.',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoNothing();
    console.log('Sample review created');

    console.log('Database seeded successfully');
    
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('Database connection closed');
  }
}

main();