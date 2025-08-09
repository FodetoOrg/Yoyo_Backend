// @ts-nocheck
import { FastifyInstance } from 'fastify';

export class DetailsService {
  private fastify: FastifyInstance;

  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  async getRoomDetails(roomId: string) {
    const db = this.fastify.db;

    // Get room basic information
    const roomQuery = `
      SELECT r.*, h.name as hotel_name, h.address as hotel_address, h.city as hotel_city
      FROM rooms r
      JOIN hotels h ON r.hotel_id = h.id
      WHERE r.id = $1
    `;
    const roomResult = await db.query(roomQuery, [roomId]);

    if (roomResult.rows.length === 0) {
      throw new Error('Room not found');
    }

    const room = roomResult.rows[0];

    // Get all bookings for this room
    const bookingsQuery = `
      SELECT b.*, u.name as user_name, u.phone as user_phone
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      WHERE b.room_id = $1
      ORDER BY b.created_at DESC
    `;
    const bookingsResult = await db.query(bookingsQuery, [roomId]);

    // Get all payments related to this room's bookings
    const paymentsQuery = `
      SELECT p.*, b.booking_id, u.name as user_name
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      JOIN users u ON b.user_id = u.id
      WHERE b.room_id = $1
      ORDER BY p.created_at DESC
    `;
    const paymentsResult = await db.query(paymentsQuery, [roomId]);

    // Get room addons
    const addonsQuery = `
      SELECT ra.*, a.name as addon_name, a.description as addon_description, a.price as addon_price
      FROM room_addons ra
      JOIN addons a ON ra.addon_id = a.id
      WHERE ra.room_id = $1
    `;
    const addonsResult = await db.query(addonsQuery, [roomId]);

    // Get refunds related to this room's bookings
    const refundsQuery = `
      SELECT r.*, b.booking_id, u.name as user_name
      FROM refunds r
      JOIN bookings b ON r.booking_id = b.id
      JOIN users u ON b.user_id = u.id
      WHERE b.room_id = $1
      ORDER BY r.created_at DESC
    `;
    const refundsResult = await db.query(refundsQuery, [roomId]);

    // Calculate statistics
    const totalBookings = bookingsResult.rows.length;
    const totalRevenue = paymentsResult.rows
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    const totalRefunds = refundsResult.rows
      .filter(r => r.status === 'processed')
      .reduce((sum, r) => sum + parseFloat(r.refund_amount || 0), 0);

    return {
      room: {
        ...room,
        amenities: room.amenities ? JSON.parse(room.amenities) : [],
        images: room.images ? JSON.parse(room.images) : []
      },
      bookings: bookingsResult.rows,
      payments: paymentsResult.rows,
      addons: addonsResult.rows,
      refunds: refundsResult.rows,
      statistics: {
        totalBookings,
        totalRevenue,
        totalRefunds,
        netRevenue: totalRevenue - totalRefunds
      }
    };
  }

  async getPaymentDetails(paymentId: string) {
    const db = this.fastify.db;

    // Get payment with all related information
    const paymentQuery = `
      SELECT 
        p.*,
        b.id as booking_id, b.check_in, b.check_out, b.total_amount as booking_amount, b.status as booking_status,
        u.id as user_id, u.name as user_name, u.phone as user_phone, u.email as user_email,
        r.id as room_id, r.name as room_name, r.room_number, r.capacity as room_capacity, r.bed_type,
        h.id as hotel_id, h.name as hotel_name, h.address as hotel_address, h.city as hotel_city
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      JOIN users u ON b.user_id = u.id
      JOIN rooms r ON b.room_id = r.id
      JOIN hotels h ON r.hotel_id = h.id
      WHERE p.id = $1
    `;
    const paymentResult = await db.query(paymentQuery, [paymentId]);

    if (paymentResult.rows.length === 0) {
      throw new Error('Payment not found');
    }

    const payment = paymentResult.rows[0];

    // Get booking addons if any
    const addonsQuery = `
      SELECT ba.*, a.name as addon_name, a.description as addon_description
      FROM booking_addons ba
      JOIN addons a ON ba.addon_id = a.id
      WHERE ba.booking_id = $1
    `;
    const addonsResult = await db.query(addonsQuery, [payment.booking_id]);

    // Get payment order details if exists
    const orderQuery = `
      SELECT * FROM payment_orders WHERE payment_id = $1
    `;
    const orderResult = await db.query(orderQuery, [paymentId]);

    return {
      payment: {
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        payment_mode: payment.payment_mode,
        razorpay_payment_id: payment.razorpay_payment_id,
        razorpay_order_id: payment.razorpay_order_id,
        created_at: payment.created_at,
        updated_at: payment.updated_at
      },
      booking: {
        id: payment.booking_id,
        check_in: payment.check_in,
        check_out: payment.check_out,
        total_amount: payment.booking_amount,
        status: payment.booking_status,
        addons: addonsResult.rows
      },
      user: {
        id: payment.user_id,
        name: payment.user_name,
        phone: payment.user_phone,
        email: payment.user_email
      },
      room: {
        id: payment.room_id,
        name: payment.room_name,
        room_number: payment.room_number,
        capacity: payment.room_capacity,
        bed_type: payment.bed_type
      },
      hotel: {
        id: payment.hotel_id,
        name: payment.hotel_name,
        address: payment.hotel_address,
        city: payment.hotel_city
      },
      order: orderResult.rows[0] || null
    };
  }

  async getRefundDetails(refundId: string) {
    const db = this.fastify.db;

    // Get refund with all related information
    const refundQuery = `
      SELECT 
        rf.*,
        b.id as booking_id, b.check_in, b.check_out, b.total_amount as booking_amount, b.status as booking_status,
        u.id as user_id, u.name as user_name, u.phone as user_phone, u.email as user_email,
        r.id as room_id, r.name as room_name, r.room_number, r.capacity as room_capacity, r.bed_type,
        h.id as hotel_id, h.name as hotel_name, h.address as hotel_address, h.city as hotel_city,
        processed_user.name as processed_by_name
      FROM refunds rf
      JOIN bookings b ON rf.booking_id = b.id
      JOIN users u ON b.user_id = u.id
      JOIN rooms r ON b.room_id = r.id
      JOIN hotels h ON r.hotel_id = h.id
      LEFT JOIN users processed_user ON rf.processed_by = processed_user.id
      WHERE rf.id = $1
    `;
    const refundResult = await db.query(refundQuery, [refundId]);

    if (refundResult.rows.length === 0) {
      throw new Error('Refund not found');
    }

    const refund = refundResult.rows[0];

    // Get original payment details
    const paymentQuery = `
      SELECT * FROM payments WHERE booking_id = $1 ORDER BY created_at DESC LIMIT 1
    `;
    const paymentResult = await db.query(paymentQuery, [refund.booking_id]);

    // Get booking addons if any
    const addonsQuery = `
      SELECT ba.*, a.name as addon_name, a.description as addon_description
      FROM booking_addons ba
      JOIN addons a ON ba.addon_id = a.id
      WHERE ba.booking_id = $1
    `;
    const addonsResult = await db.query(addonsQuery, [refund.booking_id]);

    return {
      refund: {
        id: refund.id,
        refund_amount: refund.refund_amount,
        refund_reason: refund.refund_reason,
        refund_type: refund.refund_type,
        status: refund.status,
        processed_by_name: refund.processed_by_name,
        rejection_reason: refund.rejection_reason,
        bank_details: refund.bank_details,
        created_at: refund.created_at,
        processed_at: refund.processed_at
      },
      booking: {
        id: refund.booking_id,
        check_in: refund.check_in,
        check_out: refund.check_out,
        total_amount: refund.booking_amount,
        status: refund.booking_status,
        addons: addonsResult.rows
      },
      user: {
        id: refund.user_id,
        name: refund.user_name,
        phone: refund.user_phone,
        email: refund.user_email
      },
      room: {
        id: refund.room_id,
        name: refund.room_name,
        room_number: refund.room_number,
        capacity: refund.room_capacity,
        bed_type: refund.bed_type
      },
      hotel: {
        id: refund.hotel_id,
        name: refund.hotel_name,
        address: refund.hotel_address,
        city: refund.hotel_city
      },
      original_payment: paymentResult.rows[0] || null
    };
  }

  async getCustomerDetails(customerId: string) {
    const db = this.fastify.db;

    // Get customer basic information
    const customerQuery = `
      SELECT 
        u.id, u.name, u.phone, u.email, u.created_at,
        w.balance as wallet_balance, w.total_earned, w.total_spent
      FROM users u
      LEFT JOIN wallets w ON u.id = w.user_id
      WHERE u.id = $1
    `;
    const customerResult = await db.query(customerQuery, [customerId]);

    if (customerResult.rows.length === 0) {
      throw new Error('Customer not found');
    }

    const customer = customerResult.rows[0];

    // Get all bookings
    const bookingsQuery = `
      SELECT 
        b.id, b.check_in_date, b.check_out_date, b.total_amount, 
        b.status, b.payment_status, b.created_at,
        h.name as hotel_name, h.city as hotel_city,
        r.name as room_name, r.room_number
      FROM bookings b
      JOIN hotels h ON b.hotel_id = h.id
      JOIN rooms r ON b.room_id = r.id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC
    `;
    const bookingsResult = await db.query(bookingsQuery, [customerId]);

    // Get all payments
    const paymentsQuery = `
      SELECT 
        p.id, p.amount, p.payment_method, p.payment_mode, 
        p.status, p.transaction_date, p.created_at,
        b.id as booking_id
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      WHERE p.user_id = $1
      ORDER BY p.created_at DESC
    `;
    const paymentsResult = await db.query(paymentsQuery, [customerId]);

    // Get all refunds
    const refundsQuery = `
      SELECT 
        r.id, r.refund_amount, r.refund_reason, r.refund_type,
        r.status, r.created_at, r.processed_at,
        b.id as booking_id
      FROM refunds r
      JOIN bookings b ON r.booking_id = b.id
      WHERE r.user_id = $1
      ORDER BY r.created_at DESC
    `;
    const refundsResult = await db.query(refundsQuery, [customerId]);

    // Get wallet transactions
    const walletTransactionsQuery = `
      SELECT 
        wt.id, wt.type, wt.source, wt.amount, wt.balance_after,
        wt.description, wt.reference_type, wt.created_at
      FROM wallet_transactions wt
      WHERE wt.user_id = $1
      ORDER BY wt.created_at DESC
      LIMIT 20
    `;
    const walletTransactionsResult = await db.query(walletTransactionsQuery, [customerId]);

    // Calculate statistics
    const totalBookings = bookingsResult.rows.length;
    const totalSpent = paymentsResult.rows
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);
    const totalRefunds = refundsResult.rows
      .filter(r => r.status === 'processed')
      .reduce((sum, r) => sum + r.refund_amount, 0);

    // Get wallet usage history
    const walletUsages = await db.query.walletUsages.findMany({
      where: eq(walletUsages.userId, customerId),
      orderBy: [desc(walletUsages.createdAt)],
      with: {
        booking: {
          with: {
            hotel: true,
            room: true,
          }
        },
        payment: true,
      }
    });

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        joined_date: customer.created_at,
        wallet_balance: customer.wallet_balance || 0,
        total_wallet_earned: customer.total_earned || 0,
        total_wallet_spent: customer.total_spent || 0
      },
      wallet: customer.wallet_balance,
      walletUsages,
      statistics: {
        total_bookings: totalBookings,
        total_spent: totalSpent,
        total_refunds: totalRefunds,
        totalWalletUsages: walletUsages.length,
        totalAmountPaid: paymentsResult.rows.reduce((sum, payment) => sum + payment.amount, 0),
        totalRefundAmount: refundsResult.rows.reduce((sum, refund) => sum + refund.refund_amount, 0),
        totalWalletUsed: walletUsages.reduce((sum, usage) => sum + usage.amount, 0),
        currentWalletBalance: customer.wallet_balance || 0,
      },
      bookings: bookingsResult.rows,
      payments: paymentsResult.rows,
      refunds: refundsResult.rows,
      wallet_transactions: walletTransactionsResult.rows
    };
  }

  async getAddonDetails(addonId: string) {
    const db = this.fastify.db;

    // Get addon basic information
    const addonQuery = `
      SELECT 
        a.id, a.name, a.description, a.price, a.category,
        a.status, a.created_at, a.updated_at,
        h.name as hotel_name, h.id as hotel_id
      FROM addons a
      JOIN hotels h ON a.hotel_id = h.id
      WHERE a.id = $1
    `;
    const addonResult = await db.query(addonQuery, [addonId]);

    if (addonResult.rows.length === 0) {
      throw new Error('Addon not found');
    }

    const addon = addonResult.rows[0];

    // Get bookings where this addon was used
    const bookingAddonsQuery = `
      SELECT 
        ba.quantity, ba.total_price, ba.created_at,
        b.id as booking_id, b.check_in_date, b.check_out_date,
        b.total_amount as booking_total,
        u.name as customer_name, u.phone as customer_phone,
        r.name as room_name, r.room_number
      FROM booking_addons ba
      JOIN bookings b ON ba.booking_id = b.id
      JOIN users u ON b.user_id = u.id
      JOIN rooms r ON b.room_id = r.id
      WHERE ba.addon_id = $1
      ORDER BY ba.created_at DESC
    `;
    const bookingAddonsResult = await db.query(bookingAddonsQuery, [addonId]);

    // Calculate statistics
    const totalUsageCount = bookingAddonsResult.rows.length;
    const totalQuantitySold = bookingAddonsResult.rows.reduce((sum, ba) => sum + ba.quantity, 0);
    const totalRevenue = bookingAddonsResult.rows.reduce((sum, ba) => sum + ba.total_price, 0);

    // Usage by month (last 12 months)
    const monthlyUsageQuery = `
      SELECT 
        strftime('%Y-%m', ba.created_at) as month,
        COUNT(*) as usage_count,
        SUM(ba.quantity) as total_quantity,
        SUM(ba.total_price) as revenue
      FROM booking_addons ba
      WHERE ba.addon_id = $1 
        AND ba.created_at >= date('now', '-12 months')
      GROUP BY strftime('%Y-%m', ba.created_at)
      ORDER BY month DESC
    `;
    const monthlyUsageResult = await db.query(monthlyUsageQuery, [addonId]);

    return {
      addon: {
        id: addon.id,
        name: addon.name,
        description: addon.description,
        price: addon.price,
        category: addon.category,
        status: addon.status,
        hotel_name: addon.hotel_name,
        hotel_id: addon.hotel_id,
        created_at: addon.created_at
      },
      statistics: {
        total_usage_count: totalUsageCount,
        total_quantity_sold: totalQuantitySold,
        total_revenue: totalRevenue,
        average_quantity_per_booking: totalUsageCount > 0 ? totalQuantitySold / totalUsageCount : 0
      },
      usage_history: bookingAddonsResult.rows,
      monthly_usage: monthlyUsageResult.rows
    };
  }

  async getHotelDetails(hotelId: string) {
    const db = this.fastify.db;

    // Get hotel basic information
    const hotelQuery = `
      SELECT * FROM hotels WHERE id = $1
    `;
    const hotelResult = await db.query(hotelQuery, [hotelId]);

    if (hotelResult.rows.length === 0) {
      throw new Error('Hotel not found');
    }

    const hotel = hotelResult.rows[0];

    // Get all available rooms
    const roomsQuery = `
      SELECT * FROM rooms WHERE hotel_id = $1 ORDER BY room_number
    `;
    const roomsResult = await db.query(roomsQuery, [hotelId]);

    // Get booking statistics
    const bookingStatsQuery = `
      SELECT 
        COUNT(*) as total_bookings,
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_bookings,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_bookings,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_bookings
      FROM bookings b
      JOIN rooms r ON b.room_id = r.id
      WHERE r.hotel_id = $1
    `;
    const bookingStatsResult = await db.query(bookingStatsQuery, [hotelId]);

    // Get payment statistics
    const paymentStatsQuery = `
      SELECT 
        COUNT(*) as total_payments,
        SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END) as total_revenue,
        COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as successful_payments,
        COUNT(CASE WHEN p.status = 'failed' THEN 1 END) as failed_payments
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      JOIN rooms r ON b.room_id = r.id
      WHERE r.hotel_id = $1
    `;
    const paymentStatsResult = await db.query(paymentStatsQuery, [hotelId]);

    // Get refund statistics
    const refundStatsQuery = `
      SELECT 
        COUNT(*) as total_refunds,
        SUM(CASE WHEN rf.status = 'processed' THEN rf.refund_amount ELSE 0 END) as total_refunded,
        COUNT(CASE WHEN rf.status = 'processed' THEN 1 END) as processed_refunds,
        COUNT(CASE WHEN rf.status = 'pending' THEN 1 END) as pending_refunds
      FROM refunds rf
      JOIN bookings b ON rf.booking_id = b.id
      JOIN rooms r ON b.room_id = r.id
      WHERE r.hotel_id = $1
    `;
    const refundStatsResult = await db.query(refundStatsQuery, [hotelId]);

    // Get all hotel addons
    const addonsQuery = `
      SELECT * FROM addons WHERE hotel_id = $1 ORDER BY name
    `;
    const addonsResult = await db.query(addonsQuery, [hotelId]);

    // Get recent bookings
    const recentBookingsQuery = `
      SELECT b.*, u.name as user_name, r.name as room_name, r.room_number
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN rooms r ON b.room_id = r.id
      WHERE r.hotel_id = $1
      ORDER BY b.created_at DESC
      LIMIT 10
    `;
    const recentBookingsResult = await db.query(recentBookingsQuery, [hotelId]);

    // Get recent payments
    const recentPaymentsQuery = `
      SELECT p.*, b.id as booking_id, u.name as user_name
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      JOIN users u ON b.user_id = u.id
      JOIN rooms r ON b.room_id = r.id
      WHERE r.hotel_id = $1
      ORDER BY p.created_at DESC
      LIMIT 10
    `;
    const recentPaymentsResult = await db.query(recentPaymentsQuery, [hotelId]);

    return {
      hotel: {
        ...hotel,
        amenities: hotel.amenities ? JSON.parse(hotel.amenities) : [],
        images: hotel.images ? JSON.parse(hotel.images) : []
      },
      rooms: roomsResult.rows.map(room => ({
        ...room,
        amenities: room.amenities ? JSON.parse(room.amenities) : [],
        images: room.images ? JSON.parse(room.images) : []
      })),
      statistics: {
        bookings: bookingStatsResult.rows[0],
        payments: paymentStatsResult.rows[0],
        refunds: refundStatsResult.rows[0],
        totalRooms: roomsResult.rows.length,
        availableRooms: roomsResult.rows.filter(r => r.status === 'available').length
      },
      addons: addonsResult.rows,
      recentActivity: {
        bookings: recentBookingsResult.rows,
        payments: recentPaymentsResult.rows
      }
    };
  }
}