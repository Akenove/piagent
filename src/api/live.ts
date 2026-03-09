import { EventEmitter } from 'events';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? 'collective-dev-secret';

export interface LiveEvent {
  type: string;
  payload: Record<string, unknown>;
  createdAt: number;
}

interface JwtUser {
  discordId: string;
  username: string;
}

class LiveBus extends EventEmitter {
  emitEvent(type: string, payload: Record<string, unknown>): void {
    this.emit('event', { type, payload, createdAt: Date.now() } as LiveEvent);
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce<Record<string, string>>((acc, part) => {
    const [k, ...rest] = part.trim().split('=');
    acc[k] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

function getJwtUser(request: FastifyRequest): JwtUser | null {
  const token = parseCookies(request.headers.cookie).collective_token;
  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET) as JwtUser;
  } catch {
    return null;
  }
}

export const liveBus = new LiveBus();

export const liveRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/events', { websocket: true }, (connection: any, request) => {
    const user = getJwtUser(request);
    if (!user) {
      connection.socket.close(1008, 'Unauthorized');
      return;
    }

    const ws = connection.socket;

    const onEvent = (event: unknown) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(event));
      }
    };

    liveBus.on('event', onEvent);
    const heartbeat = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'ping', createdAt: Date.now(), payload: {} }));
      }
    }, 15000);

    ws.send(JSON.stringify({ type: 'connected', createdAt: Date.now(), payload: { discordId: user.discordId } }));

    ws.on('close', () => {
      clearInterval(heartbeat);
      liveBus.off('event', onEvent);
    });
  });
};
