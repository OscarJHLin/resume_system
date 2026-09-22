import Fastify from 'fastify';
import { defaultDbPath, openDatabase } from './db/client.js';
import { Store } from './db/store.js';
import { registerHealthRoutes } from './modules/health.js';
import { registerApiRoutes } from './routes/api.js';

export function buildApp(dbPath: string = defaultDbPath()) {
  const db = openDatabase(dbPath);
  const store = new Store(db);
  store.ensureDefaultProfile();

  const app = Fastify({ logger: true });
  return { app, store, db, async start() {
    await registerHealthRoutes(app);
    await registerApiRoutes(app, store);
    return app;
  }};
}

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '127.0.0.1';

async function main() {
  const { app, start } = buildApp();
  await start();
  await app.listen({ port: PORT, host: HOST });
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
