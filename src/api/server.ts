import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import Fastify from 'fastify';
import path from 'path';
import { apiRoutes } from './routes/api';
import { adminRoutes } from './routes/admin';
import { authRoutes } from './routes/auth';
import { economyRoutes } from './routes/economy';
import { gamesRoutes } from './routes/games';
import { liveRoutes } from './live';

export async function startWebServer() {
  const app = Fastify();
  const port = Number(process.env.WEB_PORT ?? 3001);
  const webPath = path.resolve(process.cwd(), 'web');

  await app.register(cors, { origin: true, credentials: true });
  await app.register(websocket);
  await app.register(fastifyStatic, {
    root: webPath,
    prefix: '/',
  });

  await app.register(authRoutes);
  await app.register(apiRoutes);
  await app.register(adminRoutes);
  await app.register(gamesRoutes);
  await app.register(economyRoutes);
  await app.register(liveRoutes);

  // SPA catch-all: serve index.html for any non-API/non-static route
  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api/') || request.url.startsWith('/auth/')) {
      reply.code(404).send({ error: 'Not Found', statusCode: 404 });
      return;
    }
    return reply.sendFile('index.html');
  });

  await app.listen({ port, host: '0.0.0.0' });
  console.log(`🌐 Web dashboard live on http://localhost:${port}`);

  return { app, port };
}
