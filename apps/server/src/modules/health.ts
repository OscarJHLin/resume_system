import type { FastifyInstance } from 'fastify';

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({
    ok: true,
    service: 'resume-server',
    phase: 'S5',
    persistence: 'sqlite-file',
  }));
}
