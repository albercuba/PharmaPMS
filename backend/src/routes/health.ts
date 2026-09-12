import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';

export function registerHealthRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
) {
  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/ready', async (request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', database: 'ok' };
    } catch (error) {
      request.log.error({ err: error }, 'readiness database check failed');
      return reply
        .code(503)
        .send({ status: 'not_ready', database: 'unavailable' });
    }
  });
}
