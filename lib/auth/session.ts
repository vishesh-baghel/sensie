import { getIronSession, IronSession } from 'iron-session';
import { cookies } from 'next/headers';
import type { SessionData } from './auth';

/**
 * Session management using iron-session
 *
 * Sessions are encrypted and stored in cookies
 */

/**
 * Session duration constants
 */
export const SESSION_DURATIONS = {
  OWNER: 60 * 60 * 24 * 7, // 1 week
  VISITOR: 60 * 60 * 24 * 1, // 1 day
};

/**
 * Session options for iron-session
 */
export const SESSION_OPTIONS = {
  password: process.env.SESSION_SECRET || 'this-is-a-dev-secret-min-32-chars!',
  cookieName: 'sensie_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: SESSION_DURATIONS.OWNER,
  },
};

/**
 * Iron session type with our session data
 */
type SensieSession = IronSession<SessionData>;

/**
 * Get the iron session instance
 */
async function getIronSessionInstance(): Promise<SensieSession> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, SESSION_OPTIONS);
}

/**
 * Create a new session
 */
export async function createSession(
  userId: string,
  role: 'owner' | 'visitor'
): Promise<SessionData> {
  const session = await getIronSessionInstance();
  const now = Date.now();
  const duration = role === 'owner' ? SESSION_DURATIONS.OWNER : SESSION_DURATIONS.VISITOR;

  session.userId = userId;
  session.role = role;
  session.createdAt = now;
  session.expiresAt = now + duration * 1000;

  await session.save();

  return {
    userId: session.userId,
    role: session.role,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  };
}

/**
 * Get current session from request
 */
export async function getSession(): Promise<SessionData | null> {
  const session = await getIronSessionInstance();

  if (!session.userId) {
    return null;
  }

  // Check if expired
  if (session.expiresAt && Date.now() > session.expiresAt) {
    await session.destroy();
    return null;
  }

  return {
    userId: session.userId,
    role: session.role,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  };
}

/**
 * Destroy current session (logout)
 */
export async function destroySession(): Promise<void> {
  const session = await getIronSessionInstance();
  session.destroy();
}

/**
 * Refresh session expiry
 */
export async function refreshSession(
  sessionData: SessionData
): Promise<SessionData> {
  const session = await getIronSessionInstance();
  const duration = sessionData.role === 'owner' ? SESSION_DURATIONS.OWNER : SESSION_DURATIONS.VISITOR;

  session.expiresAt = Date.now() + duration * 1000;
  await session.save();

  return {
    userId: session.userId,
    role: session.role,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  };
}

/**
 * Check if session is expired
 */
export function isSessionExpired(session: SessionData): boolean {
  return Date.now() > session.expiresAt;
}

/**
 * Get session expiry time
 */
export function getSessionExpiry(session: SessionData): Date {
  return new Date(session.expiresAt);
}
