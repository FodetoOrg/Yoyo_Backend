import { FastifyInstance } from "fastify";
import { invoices, bookings, hotels, users } from "../models/schema";
import { eq, and, desc, between } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { NotFoundError } from "../types/errors";

interface InvoiceCreateParams {
  bookingId: string;
  userId: string;
  hotelId: string;
  amount: number;
  tax?: number;
  dueDate: Date;
}

interface InvoiceFilters {
  hotelId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export class InvoiceService {
  private fastify!: FastifyInstance;

  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  // Get invoices with filters
  async getInvoices(filters: InvoiceFilters = {}) {
    const db = this.fastify.db;
    const { hotelId, status, startDate, endDate, page = 1, limit = 10 } = filters;

    let whereConditions: any[] = [];

    if (hotelId) {
      whereConditions.push(eq(invoices.hotelId, hotelId));
    }

    if (status) {
      whereConditions.push(eq(invoices.status, status));
    }

    if (startDate && endDate) {
      whereConditions.push(between(invoices.createdAt, startDate, endDate));
    }

    const invoiceList = await db.query.invoices.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      with: {
        booking: true,
        user: true,
        hotel: true,
      },
      orderBy: [desc(invoices.createdAt)],
      limit,
      offset: (page - 1) * limit,
    });

    // Get total count
    const totalInvoices = await db.query.invoices.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
    });

    return {
      invoices: invoiceList.map(invoice => ({
        id: invoice.id,
        bookingId: invoice.bookingId,
        amount: invoice.amount,
        tax: invoice.tax,
        totalAmount: invoice.totalAmount,
        status: invoice.status,
        dueDate: invoice.dueDate,
        paidDate: invoice.paidDate,
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt,
        booking: {
          id: invoice.booking.id,
          checkInDate: invoice.booking.checkInDate,
          checkOutDate: invoice.booking.checkOutDate,
          totalAmount: invoice.booking.totalAmount,
        },
        user: {
          id: invoice.user.id,
          name: invoice.user.name,
          phone: invoice.user.phone,
        },
        hotel: {
          id: invoice.hotel.id,
          name: invoice.hotel.name,
        },
      })),
      total: totalInvoices.length,
      page,
      limit,
      totalPages: Math.ceil(totalInvoices.length / limit),
    };
  }

  // Get invoice by ID
  async getInvoiceById(id: string) {
    const db = this.fastify.db;
    
    const invoice = await db.query.invoices.findFirst({
      where: eq(invoices.id, id),
      with: {
        booking: true,
        user: true,
        hotel: true,
      },
    });

    if (!invoice) {
      throw new NotFoundError(`Invoice with id ${id} not found`);
    }

    return {
      id: invoice.id,
      bookingId: invoice.bookingId,
      amount: invoice.amount,
      tax: invoice.tax,
      totalAmount: invoice.totalAmount,
      status: invoice.status,
      dueDate: invoice.dueDate,
      paidDate: invoice.paidDate,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
      booking: {
        id: invoice.booking.id,
        checkInDate: invoice.booking.checkInDate,
        checkOutDate: invoice.booking.checkOutDate,
        totalAmount: invoice.booking.totalAmount,
        guestCount: invoice.booking.guestCount,
      },
      user: {
        id: invoice.user.id,
        name: invoice.user.name,
        phone: invoice.user.phone,
        email: invoice.user.email,
      },
      hotel: {
        id: invoice.hotel.id,
        name: invoice.hotel.name,
        address: invoice.hotel.address,
      },
    };
  }

  // Create invoice
  async createInvoice(data: InvoiceCreateParams) {
    const db = this.fastify.db;
    const invoiceId = uuidv4();
    
    const tax = data.tax || (data.amount * 0.18); // 18% GST by default
    const totalAmount = data.amount + tax;

    await db.insert(invoices).values({
      id: invoiceId,
      bookingId: data.bookingId,
      userId: data.userId,
      hotelId: data.hotelId,
      amount: data.amount,
      tax,
      totalAmount,
      dueDate: data.dueDate,
    });

    return await this.getInvoiceById(invoiceId);
  }

  // Update invoice status
  async updateInvoiceStatus(id: string, status: string, paidDate?: Date) {
    const db = this.fastify.db;
    
    await this.getInvoiceById(id); // Check if exists

    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'paid' && paidDate) {
      updateData.paidDate = paidDate;
    }

    await db
      .update(invoices)
      .set(updateData)
      .where(eq(invoices.id, id));

    return await this.getInvoiceById(id);
  }

  // Generate invoice from booking
  async generateInvoiceFromBooking(bookingId: string) {
    const db = this.fastify.db;
    
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
    });

    if (!booking) {
      throw new NotFoundError(`Booking with id ${bookingId} not found`);
    }

    // Check if invoice already exists
    const existingInvoice = await db.query.invoices.findFirst({
      where: eq(invoices.bookingId, bookingId),
    });

    if (existingInvoice) {
      return existingInvoice;
    }

    // Create due date (7 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    return await this.createInvoice({
      bookingId: booking.id,
      userId: booking.userId,
      hotelId: booking.hotelId,
      amount: booking.totalAmount,
      dueDate,
    });
  }
}