
import { FastifyInstance } from 'fastify';
import { WalletController } from '../controllers/wallet.controller';

export async function walletRoutes(fastify: FastifyInstance) {
  const walletController = new WalletController();
  walletController.setFastify(fastify);

  // User wallet routes
  fastify.get('/wallet', {
    onRequest: [fastify.authenticate],
    schema: {
      tags: ['wallet'],
      summary: 'Get user wallet details'
    }
  }, walletController.getWallet.bind(walletController));

  fastify.get('/wallet/transactions', {
    onRequest: [fastify.authenticate],
    schema: {
      tags: ['wallet'],
      summary: 'Get wallet transactions',
      querystring: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['credit', 'debit'] },
          source: { type: 'string' },
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 10 }
        }
      }
    }
  }, walletController.getWalletTransactions.bind(walletController));

  // Admin routes
  fastify.post('/admin/wallet/credit', {
    onRequest: [fastify.authenticate],
    schema: {
      tags: ['wallet'],
      summary: 'Credit user wallet (Admin only)',
      body: {
        type: 'object',
        required: ['userId', 'amount'],
        properties: {
          userId: { type: 'string' },
          amount: { type: 'number', minimum: 0.01 },
          description: { type: 'string' }
        }
      }
    }
  }, walletController.creditUserWallet.bind(walletController));
}
import { FastifyInstance } from 'fastify';
import { WalletController } from '../controllers/wallet.controller';

export default async function walletRoutes(fastify: FastifyInstance) {
  const walletController = new WalletController(fastify);

  // Get user wallet
  fastify.get('/wallet', {
    preHandler: [fastify.authenticate],
    handler: walletController.getUserWallet.bind(walletController),
  });

  // Get wallet usage history
  fastify.get('/wallet/usage-history', {
    preHandler: [fastify.authenticate],
    handler: walletController.getWalletUsageHistory.bind(walletController),
  });
}
