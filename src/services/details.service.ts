
import { sql, eq, desc, and } from 'drizzle-orm';
import { FastifyInstance } from 'fastify';
import { rooms, hotels, bookings, users, payments, refunds, addons, roomAddons, bookingAddons, paymentOrders, wallets, walletTransactions, walletUsages } from '../models/schema';

export class DetailsService {
  private fastify: FastifyInstance;

  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  async getRoomDetails(roomId: string) {
    const db = this.fastify.db;

    // Get room with hotel information
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
      with: {
        hotel: true
      }
    });

    if (!room) {
      throw new Error('Room not found');
    }

    // Get all bookings for this room
    const roomBookings = await db.query.bookings.findMany({
      where: eq(bookings.roomId, roomId),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            phone: true
          }
        }
      },
      orderBy: [desc(bookings.createdAt)]
    });

    // Get all payments related to this room's bookings
    const bookingIds = roomBookings.map(b => b.id);
    const roomPayments = bookingIds.length > 0 ? await db.query.payments.findMany({
      where: sql`${payments.bookingId} IN ${bookingIds}`,
      with: {
        user: {
          columns: {
            id: true,
            name: true
          }
        },
        booking: {
          columns: {
            id: true
          }
        }
      },
      orderBy: [desc(payments.createdAt)]
    }) : [];

    // Get refunds related to this room's bookings
    const roomRefunds = bookingIds.length > 0 ? await db.query.refunds.findMany({
      where: sql`${refunds.bookingId} IN ${bookingIds}`,
      with: {
        user: {
          columns: {
            id: true,
            name: true
          }
        },
        booking: {
          columns: {
            id: true
          }
        }
      },
      orderBy: [desc(refunds.createdAt)]
    }) : [];

    // Calculate statistics
    const totalBookings = roomBookings.length;
    const totalRevenue = roomPayments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalRefunds = roomRefunds
      .filter(r => r.status === 'processed')
      .reduce((sum, r) => sum + (r.refundAmount || 0), 0);

    return {
      room: {
        ...room,
        amenities: room.amenities ? JSON.parse(room.amenities) : [],
        images: room.images ? JSON.parse(room.images) : []
      },
      bookings: roomBookings,
      payments: roomPayments,
      refunds: roomRefunds,
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
    const payment = await db.query.payments.findFirst({
      where: eq(payments.id, paymentId),
      with: {
        booking: {
          with: {
            user: true,
            room: true,
            hotel: true
          }
        }
      }
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    // Get booking addons if any
    const addonsForBooking = await db.query.bookingAddons.findMany({
      where: eq(bookingAddons.bookingId, payment.bookingId),
      with: {
        addon: true
      }
    });

    // Get payment order details if exists
    const order = await db.query.paymentOrders.findFirst({
      where: eq(paymentOrders.razorpayOrderId, payment.razorpayOrderId || '')
    });

    return {
      payment: {
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        paymentMode: payment.paymentMode,
        razorpayPaymentId: payment.razorpayPaymentId,
        razorpayOrderId: payment.razorpayOrderId,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt
      },
      booking: {
        id: payment.booking.id,
        checkInDate: payment.booking.checkInDate,
        checkOutDate: payment.booking.checkOutDate,
        totalAmount: payment.booking.totalAmount,
        status: payment.booking.status,
        addons: addonsForBooking
      },
      user: {
        id: payment.booking.user.id,
        name: payment.booking.user.name,
        phone: payment.booking.user.phone
      },
      room: {
        id: payment.booking.room.id,
        name: payment.booking.room.name,
        roomNumber: payment.booking.room.roomNumber,
        capacity: payment.booking.room.capacity,
        bedType: payment.booking.room.bedType
      },
      hotel: {
        id: payment.booking.hotel.id,
        name: payment.booking.hotel.name,
        address: payment.booking.hotel.address,
        city: payment.booking.hotel.city
      },
      order: order || null
    };
  }

  async getRefundDetails(refundId: string) {
    const db = this.fastify.db;

    // Get refund with all related information
    const refund = await db.query.refunds.findFirst({
      where: eq(refunds.id, refundId),
      with: {
        booking: {
          with: {
            user: true,
            room: true,
            hotel: true
          }
        }
      }
    });

    if (!refund) {
      throw new Error('Refund not found');
    }

    // Get original payment details
    const originalPayment = await db.query.payments.findFirst({
      where: eq(payments.bookingId, refund.bookingId),
      orderBy: [desc(payments.createdAt)]
    });

    // Get booking addons if any
    const addonsForBooking = await db.query.bookingAddons.findMany({
      where: eq(bookingAddons.bookingId, refund.bookingId),
      with: {
        addon: true
      }
    });

    return {
      refund: {
        id: refund.id,
        refundAmount: refund.refundAmount,
        refundReason: refund.refundReason,
        refundType: refund.refundType,
        status: refund.status,
        rejectionReason: refund.rejectionReason,
        createdAt: refund.createdAt,
        processedAt: refund.processedAt
      },
      booking: {
        id: refund.booking.id,
        checkInDate: refund.booking.checkInDate,
        checkOutDate: refund.booking.checkOutDate,
        totalAmount: refund.booking.totalAmount,
        status: refund.booking.status,
        addons: addonsForBooking
      },
      user: {
        id: refund.booking.user.id,
        name: refund.booking.user.name,
        phone: refund.booking.user.phone
      },
      room: {
        id: refund.booking.room.id,
        name: refund.booking.room.name,
        roomNumber: refund.booking.room.roomNumber,
        capacity: refund.booking.room.capacity,
        bedType: refund.booking.room.bedType
      },
      hotel: {
        id: refund.booking.hotel.id,
        name: refund.booking.hotel.name,
        address: refund.booking.hotel.address,
        city: refund.booking.hotel.city
      },
      originalPayment: originalPayment || null
    };
  }

  async getCustomerDetails(customerId: string) {
    const db = this.fastify.db;

    // Get customer basic information
    const customer = await db.query.users.findFirst({
      where: eq(users.id, customerId),
      with: {
        wallet: true
      }
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    // Get all bookings
    const customerBookings = await db.query.bookings.findMany({
      where: eq(bookings.userId, customerId),
      with: {
        hotel: {
          columns: {
            id: true,
            name: true,
            city: true
          }
        },
        room: {
          columns: {
            id: true,
            name: true,
            roomNumber: true
          }
        }
      },
      orderBy: [desc(bookings.createdAt)]
    });

    // Get all payments
    const customerPayments = await db.query.payments.findMany({
      where: eq(payments.userId, customerId),
      with: {
        booking: {
          columns: {
            id: true
          }
        }
      },
      orderBy: [desc(payments.createdAt)]
    });

    // Get all refunds
    const customerRefunds = await db.query.refunds.findMany({
      where: eq(refunds.userId, customerId),
      with: {
        booking: {
          columns: {
            id: true
          }
        }
      },
      orderBy: [desc(refunds.createdAt)]
    });

    // Get wallet transactions
    const walletTransactionsList = await db.query.walletTransactions.findMany({
      where: eq(walletTransactions.userId, customerId),
      orderBy: [desc(walletTransactions.createdAt)],
      limit: 20
    });

    // Get wallet usage history
    const walletUsagesList = await db.query.walletUsages.findMany({
      where: eq(walletUsages.userId, customerId),
      with: {
        booking: {
          with: {
            hotel: true,
            room: true
          }
        },
        payment: true
      },
      orderBy: [desc(walletUsages.createdAt)]
    });

    // Calculate statistics
    const totalBookings = customerBookings.length;
    const totalSpent = customerPayments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalRefunds = customerRefunds
      .filter(r => r.status === 'processed')
      .reduce((sum, r) => sum + (r.refundAmount || 0), 0);

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        joinedDate: customer.createdAt,
        walletBalance: customer.wallet?.balance || 0,
        totalWalletEarned: customer.wallet?.totalEarned || 0,
        totalWalletSpent: customer.wallet?.totalSpent || 0
      },
      wallet: customer.wallet?.balance || 0,
      walletUsages: walletUsagesList,
      statistics: {
        totalBookings,
        totalSpent,
        totalRefunds,
        totalWalletUsages: walletUsagesList.length,
        totalAmountPaid: customerPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0),
        totalRefundAmount: customerRefunds.reduce((sum, refund) => sum + (refund.refundAmount || 0), 0),
        totalWalletUsed: walletUsagesList.reduce((sum, usage) => sum + (usage.amountUsed || 0), 0),
        currentWalletBalance: customer.wallet?.balance || 0
      },
      bookings: customerBookings,
      payments: customerPayments,
      refunds: customerRefunds,
      walletTransactions: walletTransactionsList
    };
  }

  async getAddonDetails(addonId: string) {
    const db = this.fastify.db;

    // Get addon basic information
    const addon = await db.query.addons.findFirst({
      where: eq(addons.id, addonId),
      with: {
        hotel: true
      }
    });

    if (!addon) {
      throw new Error('Addon not found');
    }

    // Get bookings where this addon was used
    const addonUsages = await db.query.bookingAddons.findMany({
      where: eq(bookingAddons.addonId, addonId),
      with: {
        booking: {
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                phone: true
              }
            },
            room: {
              columns: {
                id: true,
                name: true,
                roomNumber: true
              }
            }
          }
        }
      },
      orderBy: [desc(bookingAddons.createdAt)]
    });

    // Calculate statistics
    const totalUsageCount = addonUsages.length;
    const totalQuantitySold = addonUsages.reduce((sum, ba) => sum + (ba.quantity || 0), 0);
    const totalRevenue = addonUsages.reduce((sum, ba) => sum + (ba.totalPrice || 0), 0);

    return {
      addon: {
        id: addon.id,
        name: addon.name,
        description: addon.description,
        price: addon.price,
        category: addon.category,
        status: addon.status,
        hotelName: addon.hotel.name,
        hotelId: addon.hotel.id,
        createdAt: addon.createdAt
      },
      statistics: {
        totalUsageCount,
        totalQuantitySold,
        totalRevenue,
        averageQuantityPerBooking: totalUsageCount > 0 ? totalQuantitySold / totalUsageCount : 0
      },
      usageHistory: addonUsages,
      monthlyUsage: [] // You can implement monthly aggregation if needed
    };
  }

  async getHotelDetails(hotelId: string) {
    const db = this.fastify.db;

    // Get hotel basic information
    const hotel = await db.query.hotels.findFirst({
      where: eq(hotels.id, hotelId)
    });

    if (!hotel) {
      throw new Error('Hotel not found');
    }

    // Get all available rooms
    const hotelRooms = await db.query.rooms.findMany({
      where: eq(rooms.hotelId, hotelId),
      orderBy: [rooms.roomNumber]
    });

    // Get all hotel addons
    const hotelAddons = await db.query.addons.findMany({
      where: eq(addons.hotelId, hotelId),
      orderBy: [addons.name]
    });

    // Get recent bookings
    const recentBookings = await db.query.bookings.findMany({
      where: eq(bookings.hotelId, hotelId),
      with: {
        user: {
          columns: {
            id: true,
            name: true
          }
        },
        room: {
          columns: {
            id: true,
            name: true,
            roomNumber: true
          }
        }
      },
      orderBy: [desc(bookings.createdAt)],
      limit: 10
    });

    // Get booking statistics
    const allHotelBookings = await db.query.bookings.findMany({
      where: eq(bookings.hotelId, hotelId)
    });

    const confirmedBookings = allHotelBookings.filter(b => b.status === 'confirmed').length;
    const cancelledBookings = allHotelBookings.filter(b => b.status === 'cancelled').length;
    const completedBookings = allHotelBookings.filter(b => b.status === 'completed').length;

    // Get payment statistics for this hotel
    const hotelBookingIds = allHotelBookings.map(b => b.id);
    const hotelPayments = hotelBookingIds.length > 0 ? await db.query.payments.findMany({
      where: sql`${payments.bookingId} IN ${hotelBookingIds}`
    }) : [];

    const totalRevenue = hotelPayments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const successfulPayments = hotelPayments.filter(p => p.status === 'completed').length;
    const failedPayments = hotelPayments.filter(p => p.status === 'failed').length;

    // Get refund statistics
    const hotelRefunds = hotelBookingIds.length > 0 ? await db.query.refunds.findMany({
      where: sql`${refunds.bookingId} IN ${hotelBookingIds}`
    }) : [];

    const totalRefunded = hotelRefunds
      .filter(r => r.status === 'processed')
      .reduce((sum, r) => sum + (r.refundAmount || 0), 0);
    const processedRefunds = hotelRefunds.filter(r => r.status === 'processed').length;
    const pendingRefunds = hotelRefunds.filter(r => r.status === 'pending').length;

    // Get recent payments
    const recentPayments = hotelPayments
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    return {
      hotel: {
        ...hotel,
        amenities: hotel.amenities ? JSON.parse(hotel.amenities) : [],
        images: hotel.images ? JSON.parse(hotel.images) : []
      },
      rooms: hotelRooms.map(room => ({
        ...room,
        amenities: room.amenities ? JSON.parse(room.amenities) : [],
        images: room.images ? JSON.parse(room.images) : []
      })),
      statistics: {
        bookings: {
          totalBookings: allHotelBookings.length,
          confirmedBookings,
          cancelledBookings,
          completedBookings
        },
        payments: {
          totalPayments: hotelPayments.length,
          totalRevenue,
          successfulPayments,
          failedPayments
        },
        refunds: {
          totalRefunds: hotelRefunds.length,
          totalRefunded,
          processedRefunds,
          pendingRefunds
        },
        totalRooms: hotelRooms.length,
        availableRooms: hotelRooms.filter(r => r.status === 'available').length
      },
      addons: hotelAddons,
      recentActivity: {
        bookings: recentBookings,
        payments: recentPayments
      }
    };
  }
}
