// Fælles for api'ets moduler: sessions-cookien, den indloggede bruger og afviste commands.

import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Refusal } from '@maw/contracts';

export const SESSION_COOKIE = 'maw_session';
/** Feature-032: "The user stays signed in on the device until Log out." 400 dage er det længste, browsere tillader. */
const SESSION_MAX_AGE = 400 * 24 * 60 * 60;

declare module 'fastify' {
  interface FastifyRequest {
    /** Den indloggede bruger, sat af Accounts. */
    userId?: string;
  }
}

export function readCookie(request: FastifyRequest, name: string): string | undefined {
  for (const part of (request.headers.cookie ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return undefined;
}

/** HttpOnly og SameSite=Lax, men ikke Secure: spillet kører over HTTP på lokalnettet (planen, afsnit 3). */
export function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.header('set-cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`);
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.header('set-cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export function refuse(reply: FastifyReply, status: number, refusal: Refusal): FastifyReply {
  return reply.code(status).send(refusal);
}

/** Svar på en forespørgsel, der ikke kunne komme fra webappen (forkerte felter). */
export const INVALID = { message: 'Invalid request.' };

export function requireUser(request: FastifyRequest, reply: FastifyReply): string | null {
  if (!request.userId) {
    void reply.code(401).send({ message: 'Sign in first.' });
    return null;
  }
  return request.userId;
}
