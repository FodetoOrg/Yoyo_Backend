// src/controllers/payment.controller.ts
import type { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { PaymentService } from "../services/payment.service";
// Adjust this import path to your actual Drizzle schema location:
import { bookings } from "../models/schema";

// ===== Zod Schemas =====
const createPaymentOrderSchema = z.object({
  bookingId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  currency: z.string().default("INR"),
  walletAmount: z.coerce.number()
    .min(0, 'Amount must be ≥ 0')   // or .nonnegative()
    .optional()
    .default(0)
});

const verifyPaymentSchema = z.object({
  razorpayPaymentId: z.string(),
  razorpayOrderId: z.string(),
  razorpaySignature: z.string(),
});

const createHotelPaymentSchema = z.object({
  type: z.enum(["hotel_payment", "user_refund"]),
  toUserId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  method: z.string(), // e.g., "wallet", "bank_transfer"
  reason: z.string().optional(),
  hotelId: z.string().uuid().optional(),
  bookingId: z.string().uuid().optional(),
  revenueRecordId: z.string().uuid().optional(),
  metadata: z.any().optional(),
});

const processRefundSchema = z.object({
  bookingId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  reason: z.string().min(1),
});

const recordOfflinePaymentSchema = z.object({
  bookingId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  paymentMethod: z.string().min(1), // cash, card, upi, bank_transfer, etc.
  receivedBy: z.string().min(1), // Staff member who received payment
  receiptNumber: z.string().optional(),
  transactionDate: z
    .union([z.string().datetime(), z.coerce.date()])
    .optional(), // allow ISO string or Date
  notes: z.string().optional(),
});

const processWalletPaymentSchema = z.object({
  bookingId: z.string().uuid(),
  walletAmount: z.coerce.number().min(0).default(0),
  // Whatever you receive back from Razorpay (optional if only wallet):
  razorpayPaymentDetails: z
    .object({
      razorpayPaymentId: z.string(),
      razorpayOrderId: z.string(),
      razorpaySignature: z.string(),
    })
    .partial()
    .optional(),
});

export class PaymentController {
  private paymentService: PaymentService;

  constructor() {
    this.paymentService = new PaymentService();
  }

  setFastify(fastify: any) {
    this.paymentService.setFastify(fastify);
  }

  // ---- Create payment order ----
  async createPaymentOrder(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { bookingId, amount, currency, walletAmount } = createPaymentOrderSchema.parse(
        (request as any).body
      );
      const userId = (request as any).user.id;

      const order = await this.paymentService.createPaymentOrder({
        bookingId,
        userId,
        amount,
        currency,
        walletAmount
      });

      return reply.code(201).send({
        success: true,
        message: "Payment order created successfully",
        data: order,
      });
    } catch (error: any) {
      request.log.error(error);

      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: "Validation error",
          errors: error.errors,
        });
      }

      return reply.code(500).send({
        success: false,
        message: error?.message || "Failed to create payment order",
      });
    }
  }

  // ---- Verify payment ----
  async verifyPayment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const paymentData = verifyPaymentSchema.parse((request as any).body);

      const result = await this.paymentService.verifyPayment(paymentData);

      // Trigger immediate notification for payment success
      await this.paymentService.sendPaymentSuccessNotifications(result.paymentId, result.bookingId, result.amount);

      return reply.code(200).send({
        success: true,
        message: "Payment verified successfully",
        data: result,
      });
    } catch (error: any) {
      request.log.error(error);

      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: "Validation error",
          errors: error.errors,
        });
      }

      return reply.code(400).send({
        success: false,
        message: error?.message || "Payment verification failed",
      });
    }
  }

  // ---- Razorpay webhook ----
  async handleWebhook(request: FastifyRequest, reply: FastifyReply) {
    try {
      const signature = (request.headers["x-razorpay-signature"] ||
        request.headers["X-Razorpay-Signature"]) as string;
      const payload = JSON.stringify((request as any).body);

      await this.paymentService.handleWebhook(signature, payload);

      return reply.code(200).send({ success: true });
    } catch (error: any) {
      request.log.error(error);
      return reply.code(400).send({
        success: false,
        message: error?.message || "Webhook processing failed",
      });
    }
  }

  // ---- Create hotel payment (Super admin only) ----
  async createHotelPayment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const paymentData = createHotelPaymentSchema.parse((request as any).body);
      const fromUserId = (request as any).user.id;

      const result = await this.paymentService.createHotelPayment({
        ...paymentData,
        fromUserId,
      });

      return reply.code(201).send({
        success: true,
        message: "Payment initiated successfully",
        data: result,
      });
    } catch (error: any) {
      request.log.error(error);

      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: "Validation error",
          errors: error.errors,
        });
      }

      return reply.code(500).send({
        success: false,
        message: error?.message || "Failed to initiate payment",
      });
    }
  }

  // ---- Process refund (Super admin only) ----
  async processRefund(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { bookingId, amount, reason } = processRefundSchema.parse(
        (request as any).body
      );
      const adminUserId = (request as any).user.id;

      const result = await this.paymentService.processRefund(
        bookingId,
        amount,
        reason,
        adminUserId
      );

      return reply.code(200).send({
        success: true,
        message: "Refund processed successfully",
        data: result,
      });
    } catch (error: any) {
      request.log.error(error);

      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: "Validation error",
          errors: error.errors,
        });
      }

      return reply.code(500).send({
        success: false,
        message: error?.message || "Failed to process refund",
      });
    }
  }

  // ---- Get payment history ----
  async getPaymentHistory(request: FastifyRequest, reply: FastifyReply) {
    try {
      const q = (request as any).query ?? {};
      const bookingId: string | undefined = q.bookingId;
      const status: string | undefined = q.status;
      const paymentMode: string | undefined = q.paymentMode;
      const page = Number(q.page ?? 1);
      const limit = Number(q.limit ?? 10);

      const userId = (request as any).user.id;
      const userRole = (request as any).user.role;

      const result = await this.paymentService.getPaymentHistory({
        userId: userRole === "user" ? userId : undefined, // Only filter by userId for regular users
        bookingId,
        status,
        paymentMode,
        page,
        limit,
      });

      return reply.code(200).send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        message: "Failed to fetch payment history",
      });
    }
  }

  // ---- Get payment history (by hotel) ----
  async getPaymentHistoryForHotel(request: FastifyRequest, reply: FastifyReply) {
    try {
      const q = (request as any).query ?? {};
      const bookingId: string | undefined = q.bookingId;
      const status: string | undefined = q.status;
      const paymentMode: string | undefined = q.paymentMode;
      const page = Number(q.page ?? 1);
      const limit = Number(q.limit ?? 10);

      const params = (request as any).params ?? {};
      const hotelId: string = params.id;

      const userId = (request as any).user.id;
      const userRole = (request as any).user.role;

      const result = await this.paymentService.getPaymentHistory({
        userId: userRole === "user" ? userId : undefined,
        bookingId,
        status,
        paymentMode,
        page,
        limit,
        hotelId,
      });

      return reply.code(200).send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        message: "Failed to fetch payment history",
      });
    }
  }

  // ---- Record offline payment ----
  async recordOfflinePayment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const parsed = recordOfflinePaymentSchema.parse((request as any).body);
      const recordedBy = (request as any).user.id;

      const processedData = {
        ...parsed,
        recordedBy,
        transactionDate: parsed.transactionDate
          ? new Date(parsed.transactionDate as any)
          : undefined,
      };

      const result = await this.paymentService.recordOfflinePayment(
        processedData
      );

      return reply.code(201).send({
        success: true,
        message: "Offline payment recorded successfully",
        data: result,
      });
    } catch (error: any) {
      request.log.error(error);

      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          message: "Validation error",
          errors: error.errors,
        });
      }

      return reply.code(500).send({
        success: false,
        message: error?.message || "Failed to record offline payment",
      });
    }
  }

  // ---- Process combined Wallet + Online payment ----
  async processWalletPayment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { bookingId, walletAmount, razorpayPaymentDetails } =
        processWalletPaymentSchema.parse((request as any).body);

      const userId = (request as any).user.id;

      // Get booking to compute remaining amount (using service's fastify.db)
      const fastify = (this.paymentService as any).fastify;
      if (!fastify?.db) {
        return reply.code(500).send({
          success: false,
          message: "Database connection unavailable",
        });
      }

      const booking = await fastify.db.query.bookings.findFirst({
        where: eq(bookings.id, bookingId),
      });

      if (!booking) {
        return reply.code(404).send({
          success: false,
          message: "Booking not found",
        });
      }

      const totalAmount = Number(booking.totalAmount || 0);
      const remainingAmount = totalAmount - walletAmount;

      if (remainingAmount < 0) {
        return reply.code(400).send({
          success: false,
          message: "Wallet amount cannot exceed total booking amount",
        });
      }

      const result = await this.paymentService.processWalletPayment({
        bookingId,
        userId,
        walletAmount,
        remainingAmount,
        razorpayPaymentDetails,
      });

      // Trigger immediate notification for payment success
      await this.paymentService.sendPaymentSuccessNotifications(bookingId, result.paymentId, result.amount);

      return reply.code(200).send({
        success: true,
        message: "Payment processed successfully",
        data: result,
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        message: error?.message || "Failed to process wallet payment",
      });
    }
  }
}