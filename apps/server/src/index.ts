import path from 'node:path';
import fs from 'node:fs';
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import fastifyStatic from '@fastify/static';
import { defaultDbPath, openDatabase } from './db/client.js';
import { Store } from './db/store.js';
import { registerHealthRoutes } from './modules/health.js';
import { registerApiRoutes } from './routes/api.js';
import { loadTemplateRegistry } from './modules/template/registry.js';

/** 8 MiB: photo uploads send base64 JSON (5MB image ≈ 6.7MB payload). */
const BODY_LIMIT = 8 * 1024 * 1024;

export function buildApp(dbPath: string = defaultDbPath()) {
  loadTemplateRegistry();
  const db = openDatabase(dbPath);
  const store = new Store(db, dbPath);

  const app = Fastify({ logger: true, bodyLimit: BODY_LIMIT });
  return {
    app,
    store,
    db,
    async start() {
      await registerHealthRoutes(app);
      await registerApiRoutes(app, store);
      await registerStaticIfConfigured(app);
      return app;
    },
  };
}

async function registerStaticIfConfigured(app: FastifyInstance): Promise<void> {
  const staticDir = process.env.RESUME_STATIC_DIR;
  if (!staticDir) return;
  const root = path.resolve(staticDir);
  if (!fs.existsSync(root)) {
    app.log.warn(`RESUME_STATIC_DIR missing: ${root}`);
    return;
  }
  await app.register(fastifyStatic, {
    root,
    prefix: '/',
    wildcard: false,
  });
  app.setNotFoundHandler((req: FastifyRequest, reply: FastifyReply) => {
    if (req.url.startsWith('/api') || req.url.startsWith('/health')) {
      return reply.code(404).send({ error: 'not_found' });
    }
    return reply.sendFile('index.html');
  });
}

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '127.0.0.1';

async function main() {
  const dbPath = defaultDbPath();
  const { app, start } = buildApp(dbPath);
  await start();
  await app.listen({ port: PORT, host: HOST });
  app.log.info(
    `resume-server db=${dbPath} static=${process.env.RESUME_STATIC_DIR ?? '(none)'}`,
  );
}

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('index.ts') ||
    process.argv[1].endsWith('index.js'));

if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
