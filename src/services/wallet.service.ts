
import { FastifyInstance } from 'fastify';
import { eq, and, desc, sql } from 'drizzle-orm';
import { wallets, walletTransactions, users, refunds, payments, bookings } from '../models/schema';
import { v4 as uuidv4 } from 'uuid';

export class WalletService {
  private fastify: FastifyInstance;

  constructor() {}

  setFastify(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  // Create wallet for user
  async createWallet(userId: string) {
    const db = this.fastify.db;
    const walletId = uuidv4();

    try {
      const existingWallet = await db.query.wallets.findFirst({
        where: eq(wallets.userId, userId)
      });

      if (existingWallet) {
        return existingWallet;
      }

      const [wallet] = await db.insert(wallets).values({
        id: walletId,
        userId,
        balance: 0,
        totalEarned: 0,
        totalSpent: 0,
        status: 'active'
      }).returning();

      return wallet;
    } catch (error) {
      console.error('Error creating wallet:', error);
      throw new Error('Failed to create wallet');
    }
  }

  // Get user wallet
  async getUserWallet(userId: string) {
    const db = this.fastify.db;

    const wallet = await db.query.wallets.findFirst({
      where: eq(wallets.userId, userId),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            phone: true
          }
        }
      }
    });

    if (!wallet) {
      return await this.createWallet(userId);
    }

    return wallet;
  }

  // Add money to wallet (from refund)
  async creditWallet(params: {
    userId: string;
    amount: number;
    source: string;
    description: string;
    referenceId?: string;
    referenceType?: string;
    metadata?: any;
  }) {
    const db = this.fastify.db;

    return await db.transaction(async (tx) => {
      // Get or create wallet
      let wallet = await tx.query.wallets.findFirst({
        where: eq(wallets.userId, params.userId)
      });

      if (!wallet) {
        const walletId = uuidv4();
        [wallet] = await tx.insert(wallets).values({
          id: walletId,
          userId: params.userId,
          balance: 0,
          totalEarned: 0,
          totalSpent: 0,
          status: 'active'
        }).returning();
      }

      const newBalance = wallet.balance + params.amount;
      const newTotalEarned = wallet.totalEarned + params.amount;

      // Update wallet balance
      await tx.update(wallets)
        .set({
          balance: newBalance,
          totalEarned: newTotalEarned,
          updatedAt: new Date()
        })
        .where(eq(wallets.id, wallet.id));

      // Create transaction record
      const transactionId = uuidv4();
      await tx.insert(walletTransactions).values({
        id: transactionId,
        walletId: wallet.id,
        userId: params.userId,
        type: 'credit',
        source: params.source,
        amount: params.amount,
        balanceAfter: newBalance,
        description: params.description,
        referenceId: params.referenceId,
        referenceType: params.referenceType,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null
      });

      return {
        transactionId,
        newBalance,
        amount: params.amount
      };
    });
  }

  // Deduct money from wallet (for payment)
  async debitWallet(params: {
    userId: string;
    amount: number;
    source: string;
    description: string;
    referenceId?: string;
    referenceType?: string;
    metadata?: any;
  }) {
    const db = this.fastify.db;

    return await db.transaction(async (tx) => {
      const wallet = await tx.query.wallets.findFirst({
        where: eq(wallets.userId, params.userId)
      });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      if (wallet.balance < params.amount) {
        throw new Error('Insufficient wallet balance');
      }

      const newBalance = wallet.balance - params.amount;
      const newTotalSpent = wallet.totalSpent + params.amount;

      // Update wallet balance
      await tx.update(wallets)
        .set({
          balance: newBalance,
          totalSpent: newTotalSpent,
          updatedAt: new Date()
        })
        .where(eq(wallets.id, wallet.id));

      // Create transaction record
      const transactionId = uuidv4();
      await tx.insert(walletTransactions).values({
        id: transactionId,
        walletId: wallet.id,
        userId: params.userId,
        type: 'debit',
        source: params.source,
        amount: params.amount,
        balanceAfter: newBalance,
        description: params.description,
        referenceId: params.referenceId,
        referenceType: params.referenceType,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null
      });

      return {
        transactionId,
        newBalance,
        amount: params.amount
      };
    });
  }

  // Get wallet transactions
  async getWalletTransactions(userId: string, filters: {
    type?: string;
    source?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const db = this.fastify.db;
    const { type, source, page = 1, limit = 10 } = filters;

    // Get wallet first
    const wallet = await this.getUserWallet(userId);

    let whereConditions: any[] = [eq(walletTransactions.userId, userId)];

    if (type) {
      whereConditions.push(eq(walletTransactions.type, type));
    }

    if (source) {
      whereConditions.push(eq(walletTransactions.source, source));
    }

    const transactions = await db.query.walletTransactions.findMany({
      where: and(...whereConditions),
      orderBy: [desc(walletTransactions.createdAt)],
      limit,
      offset: (page - 1) * limit
    });

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(walletTransactions)
      .where(and(...whereConditions));

    const total = totalResult[0]?.count || 0;

    return {
      wallet: {
        id: wallet.id,
        balance: wallet.balance,
        totalEarned: wallet.totalEarned,
        totalSpent: wallet.totalSpent
      },
      transactions: transactions.map(t => ({
        ...t,
        metadata: t.metadata ? JSON.parse(t.metadata) : null
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}
import { FastifyInstance } from "fastify";
import { eq, and, desc, sum } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { wallets, walletUsages, users, payments, bookings } from "../models/schema";

export class WalletService {
  constructor(private fastify: FastifyInstance) {}

  // Create wallet for user
  async createWallet(userId: string) {
    const db = this.fastify.db;
    
    const walletId = uuidv4();
    await db.insert(wallets).values({
      id: walletId,
      userId,
      balance: 0,
      totalEarned: 0,
      totalUsed: 0,
    });

    return walletId;
  }

  // Get user wallet
  async getUserWallet(userId: string) {
    const db = this.fastify.db;
    
    let wallet = await db.query.wallets.findFirst({
      where: eq(wallets.userId, userId),
    });

    // Create wallet if doesn't exist
    if (!wallet) {
      const walletId = await this.createWallet(userId);
      wallet = await db.query.wallets.findFirst({
        where: eq(wallets.id, walletId),
      });
    }

    return wallet;
  }

  // Add money to wallet (from refunds)
  async addToWallet(userId: string, amount: number, source: string, refundId?: string) {
    const db = this.fastify.db;
    
    const wallet = await this.getUserWallet(userId);
    if (!wallet) throw new Error('Wallet not found');

    await db.update(wallets)
      .set({
        balance: wallet.balance + amount,
        totalEarned: wallet.totalEarned + amount,
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, wallet.id));

    return { success: true, newBalance: wallet.balance + amount };
  }

  // Use wallet money for payment
  async useWalletForPayment(params: {
    userId: string;
    bookingId: string;
    paymentId: string;
    amountToUse: number;
    description?: string;
  }) {
    const db = this.fastify.db;
    
    return await db.transaction(async (tx) => {
      // Get wallet
      const wallet = await tx.query.wallets.findFirst({
        where: eq(wallets.userId, params.userId),
      });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      if (wallet.balance < params.amountToUse) {
        throw new Error(`Insufficient wallet balance. Available: ₹${wallet.balance}`);
      }

      // Update wallet balance
      const newBalance = wallet.balance - params.amountToUse;
      await tx.update(wallets)
        .set({
          balance: newBalance,
          totalUsed: wallet.totalUsed + params.amountToUse,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id));

      // Create wallet usage record
      const usageId = uuidv4();
      await tx.insert(walletUsages).values({
        id: usageId,
        userId: params.userId,
        walletId: wallet.id,
        bookingId: params.bookingId,
        paymentId: params.paymentId,
        amountUsed: params.amountToUse,
        remainingWalletBalance: newBalance,
        usageType: 'payment',
        description: params.description || `Used for booking payment`,
      });

      return {
        success: true,
        amountUsed: params.amountToUse,
        remainingBalance: newBalance,
        usageId,
      };
    });
  }

  // Get wallet usage history
  async getWalletUsageHistory(userId: string, page: number = 1, limit: number = 10) {
    const db = this.fastify.db;
    const offset = (page - 1) * limit;

    const usages = await db.query.walletUsages.findMany({
      where: eq(walletUsages.userId, userId),
      orderBy: [desc(walletUsages.createdAt)],
      limit,
      offset,
      with: {
        booking: {
          with: {
            hotel: true,
            room: true,
          },
        },
        payment: true,
      },
    });

    const total = await db
      .select({ count: sum(walletUsages.id) })
      .from(walletUsages)
      .where(eq(walletUsages.userId, userId));

    return {
      usages,
      total: Number(total[0]?.count || 0),
      page,
      limit,
      totalPages: Math.ceil(Number(total[0]?.count || 0) / limit),
    };
  }
}
