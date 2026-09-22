import type { FastifyInstance } from 'fastify';

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({
    ok: true,
    service: 'resume-server',
    phase: 'scaffold',
    persistence: 'sqlite-file',
  }));
}
