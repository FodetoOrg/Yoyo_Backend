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

  console.log('Seeding notification templates...');
  
  try {
    const templates = [
      {
        id: uuidv4(),
        key: 'payment_order_created',
        name: 'Payment Order Created',
        description: 'Sent when a payment order is created',
        pushTitle: 'Payment Order Created',
        pushBody: 'Your payment order for {{hotelName}} has been created. Amount: ₹{{amount}}',
        emailSubject: 'Payment Order Created - {{hotelName}}',
        emailHtml: `
          <h2>Payment Order Created</h2>
          <p>Your payment order has been created successfully.</p>
          <p><strong>Hotel:</strong> {{hotelName}}</p>
          <p><strong>Amount:</strong> ₹{{amount}}</p>
          <p><strong>Order ID:</strong> {{orderId}}</p>
          <p>Please complete the payment within 15 minutes.</p>
        `,
        smsText: 'Payment order created for {{hotelName}}. Amount: ₹{{amount}}. Complete payment within 15 minutes.',
        inAppTitle: 'Payment Order Created',
        inAppMessage: 'Your payment order for {{hotelName}} has been created. Amount: ₹{{amount}}',
        channels: JSON.stringify(['push', 'in_app']),
        priority: 2,
        variables: JSON.stringify(['hotelName', 'amount', 'orderId', 'bookingId']),
      },
      {
        id: uuidv4(),
        key: 'payment_success',
        name: 'Payment Successful',
        description: 'Sent when payment is completed successfully',
        pushTitle: 'Payment Successful! 🎉',
        pushBody: 'Your payment of ₹{{amount}} for {{hotelName}} was successful. Booking confirmed!',
        emailSubject: 'Payment Successful - Booking Confirmed',
        emailHtml: `
          <h2>Payment Successful! 🎉</h2>
          <p>Your payment has been processed successfully.</p>
          <p><strong>Hotel:</strong> {{hotelName}}</p>
          <p><strong>Amount:</strong> ₹{{amount}}</p>
          <p><strong>Payment ID:</strong> {{paymentId}}</p>
          <p><strong>Booking ID:</strong> {{bookingId}}</p>
          <p>Your booking is now confirmed. Have a great stay!</p>
        `,
        smsText: 'Payment successful! ₹{{amount}} paid for {{hotelName}}. Booking confirmed. Booking ID: {{bookingId}}',
        inAppTitle: 'Payment Successful! 🎉',
        inAppMessage: 'Your payment of ₹{{amount}} for {{hotelName}} was successful. Booking confirmed!',
        channels: JSON.stringify(['push', 'email', 'sms', 'in_app']),
        priority: 1,
        variables: JSON.stringify(['hotelName', 'amount', 'paymentId', 'bookingId']),
      },
      {
        id: uuidv4(),
        key: 'payment_failed',
        name: 'Payment Failed',
        description: 'Sent when payment fails',
        pushTitle: 'Payment Failed',
        pushBody: 'Your payment for {{hotelName}} failed. Please try again.',
        emailSubject: 'Payment Failed - Please Try Again',
        emailHtml: `
          <h2>Payment Failed</h2>
          <p>Unfortunately, your payment could not be processed.</p>
          <p><strong>Booking ID:</strong> {{bookingId}}</p>
          <p><strong>Error:</strong> {{error}}</p>
          <p>Please try again or contact support if the issue persists.</p>
        `,
        smsText: 'Payment failed for booking {{bookingId}}. Please try again.',
        inAppTitle: 'Payment Failed',
        inAppMessage: 'Your payment failed. Please try again.',
        channels: JSON.stringify(['push', 'email', 'in_app']),
        priority: 2,
        variables: JSON.stringify(['bookingId', 'error']),
      },
      {
        id: uuidv4(),
        key: 'new_booking_hotel',
        name: 'New Booking (Hotel)',
        description: 'Sent to hotel admin when new booking is received',
        pushTitle: 'New Booking Received! 📋',
        pushBody: 'New booking from {{guestName}} for ₹{{amount}}',
        emailSubject: 'New Booking Received',
        emailHtml: `
          <h2>New Booking Received! 📋</h2>
          <p>You have received a new booking.</p>
          <p><strong>Guest:</strong> {{guestName}}</p>
          <p><strong>Amount:</strong> ₹{{amount}}</p>
          <p><strong>Check-in:</strong> {{checkIn}}</p>
          <p><strong>Booking ID:</strong> {{bookingId}}</p>
          <p>Please prepare for the guest's arrival.</p>
        `,
        inAppTitle: 'New Booking Received! 📋',
        inAppMessage: 'New booking from {{guestName}} for ₹{{amount}}',
        channels: JSON.stringify(['push', 'email', 'in_app']),
        priority: 2,
        variables: JSON.stringify(['guestName', 'amount', 'checkIn', 'bookingId']),
      },
      {
        id: uuidv4(),
        key: 'refund_processed',
        name: 'Refund Processed',
        description: 'Sent when refund is processed',
        pushTitle: 'Refund Processed 💰',
        pushBody: 'Your refund of ₹{{amount}} has been processed',
        emailSubject: 'Refund Processed',
        emailHtml: `
          <h2>Refund Processed 💰</h2>
          <p>Your refund has been processed successfully.</p>
          <p><strong>Amount:</strong> ₹{{amount}}</p>
          <p><strong>Booking ID:</strong> {{bookingId}}</p>
          <p><strong>Reason:</strong> {{reason}}</p>
          <p><strong>Refund ID:</strong> {{refundId}}</p>
          <p>The amount will be credited to your original payment method within 5-7 business days.</p>
        `,
        smsText: 'Refund of ₹{{amount}} processed for booking {{bookingId}}. Amount will be credited in 5-7 days.',
        inAppTitle: 'Refund Processed 💰',
        inAppMessage: 'Your refund of ₹{{amount}} has been processed',
        channels: JSON.stringify(['push', 'email', 'sms', 'in_app']),
        priority: 2,
        variables: JSON.stringify(['amount', 'bookingId', 'reason', 'refundId']),
      },
      {
        id: uuidv4(),
        key: 'admin_payment_initiated',
        name: 'Admin Payment Initiated',
        description: 'Sent when admin initiates a payment',
        pushTitle: 'Payment Initiated 💳',
        pushBody: 'A payment of ₹{{amount}} has been initiated for you',
        emailSubject: 'Payment Initiated',
        emailHtml: `
          <h2>Payment Initiated 💳</h2>
          <p>A payment has been initiated for you.</p>
          <p><strong>Amount:</strong> ₹{{amount}}</p>
          <p><strong>Type:</strong> {{type}}</p>
          <p><strong>Reason:</strong> {{reason}}</p>
          <p><strong>Payment ID:</strong> {{paymentId}}</p>
          <p>You will receive the payment shortly.</p>
        `,
        inAppTitle: 'Payment Initiated 💳',
        inAppMessage: 'A payment of ₹{{amount}} has been initiated for you',
        channels: JSON.stringify(['push', 'email', 'in_app']),
        priority: 3,
        variables: JSON.stringify(['amount', 'type', 'reason', 'paymentId']),
      },
      {
        id: uuidv4(),
        key: 'offline_payment_received',
        name: 'Offline Payment Received',
        description: 'Sent when offline payment is recorded',
        pushTitle: 'Payment Received ✅',
        pushBody: 'Your {{paymentType}} payment of ₹{{amount}} has been received',
        emailSubject: 'Payment Received - {{hotelName}}',
        emailHtml: `
          <h2>Payment Received ✅</h2>
          <p>We have received your payment.</p>
          <p><strong>Amount:</strong> ₹{{amount}}</p>
          <p><strong>Payment Type:</strong> {{paymentType}}</p>
          <p><strong>Receipt Number:</strong> {{receiptNumber}}</p>
          <p><strong>Hotel:</strong> {{hotelName}}</p>
          <p><strong>Booking ID:</strong> {{bookingId}}</p>
          <p>Thank you for your payment!</p>
        `,
        smsText: 'Payment of ₹{{amount}} received for booking {{bookingId}}. Receipt: {{receiptNumber}}',
        inAppTitle: 'Payment Received ✅',
        inAppMessage: 'Your {{paymentType}} payment of ₹{{amount}} has been received',
        channels: JSON.stringify(['push', 'email', 'sms', 'in_app']),
        priority: 2,
        variables: JSON.stringify(['amount', 'paymentType', 'receiptNumber', 'hotelName', 'bookingId']),
      },
      {
        id: uuidv4(),
        key: 'booking_confirmed_offline',
        name: 'Booking Confirmed (Offline Payment)',
        description: 'Sent when booking is confirmed with offline payment',
        pushTitle: 'Booking Confirmed! 🎉',
        pushBody: 'Your booking at {{hotelName}} is confirmed. Payment due: {{paymentDueDate}}',
        emailSubject: 'Booking Confirmed - {{hotelName}}',
        emailHtml: `
          <h2>Booking Confirmed! 🎉</h2>
          <p>Your booking has been confirmed.</p>
          <p><strong>Hotel:</strong> {{hotelName}}</p>
          <p><strong>Check-in:</strong> {{checkIn}}</p>
          <p><strong>Check-out:</strong> {{checkOut}}</p>
          <p><strong>Total Amount:</strong> ₹{{totalAmount}}</p>
          <p><strong>Payment Due:</strong> {{paymentDueDate}}</p>
          <p><strong>Booking ID:</strong> {{bookingId}}</p>
          <p>Please make the payment before the due date.</p>
        `,
        smsText: 'Booking confirmed at {{hotelName}}. Payment of ₹{{totalAmount}} due by {{paymentDueDate}}. Booking ID: {{bookingId}}',
        inAppTitle: 'Booking Confirmed! 🎉',
        inAppMessage: 'Your booking at {{hotelName}} is confirmed. Payment due: {{paymentDueDate}}',
        channels: JSON.stringify(['push', 'email', 'sms', 'in_app']),
        priority: 1,
        variables: JSON.stringify(['hotelName', 'checkIn', 'checkOut', 'totalAmount', 'paymentDueDate', 'bookingId']),
      },
    ];

    for (const template of templates) {
      await db.insert(schema.notificationTemplates).values(template).onConflictDoNothing();
    }

    console.log('Notification templates seeded successfully');
    
  } catch (error) {
    console.error('Error seeding notification templates:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('Database connection closed');
  }
}

main();