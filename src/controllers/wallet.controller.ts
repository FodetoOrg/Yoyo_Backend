
import { FastifyRequest, FastifyReply } from 'fastify';
import { WalletService } from '../services/wallet.service';

interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string;
    role: string;
    phone: string;
  };
}

export class WalletController {
  private walletService: WalletService;

  constructor() {
    this.walletService = new WalletService();
  }

  setFastify(fastify: any) {
    this.walletService.setFastify(fastify);
  }

  async getWallet(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const userId = request.user.id;
      const wallet = await this.walletService.getUserWallet(userId);

      return reply.code(200).send({
        success: true,
        data: {
          id: wallet.id,
          balance: wallet.balance,
          totalEarned: wallet.totalEarned,
          totalSpent: wallet.totalSpent,
          status: wallet.status
        }
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to fetch wallet'
      });
    }
  }

  async getWalletTransactions(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const userId = request.user.id;
      const { type, source, page = 1, limit = 10 } = request.query as any;

      const result = await this.walletService.getWalletTransactions(userId, {
        type,
        source,
        page: Number(page),
        limit: Number(limit)
      });

      return reply.code(200).send({
        success: true,
        data: result
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to fetch wallet transactions'
      });
    }
  }

  // Admin only - Credit user wallet
  async creditUserWallet(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { userId, amount, description } = request.body as any;
      const adminUserId = request.user.id;

      if (!userId || !amount || amount <= 0) {
        return reply.code(400).send({
          success: false,
          message: 'Invalid parameters'
        });
      }

      const result = await this.walletService.creditWallet({
        userId,
        amount,
        source: 'admin_credit',
        description: description || 'Admin credit',
        metadata: { creditedBy: adminUserId }
      });

      return reply.code(200).send({
        success: true,
        message: 'Wallet credited successfully',
        data: result
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        message: error.message || 'Failed to credit wallet'
      });
    }
  }
}
