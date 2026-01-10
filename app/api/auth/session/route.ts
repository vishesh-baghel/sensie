import { NextResponse } from 'next/server';
import { getSession, isSessionExpired } from '@/lib/auth/session';

/**
 * GET /api/auth/session
 * Get current session status
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({
        authenticated: false,
        session: null,
      });
    }

    if (isSessionExpired(session)) {
      return NextResponse.json({
        authenticated: false,
        session: null,
        reason: 'Session expired',
      });
    }

    return NextResponse.json({
      authenticated: true,
      session: {
        userId: session.userId,
        role: session.role,
        expiresAt: session.expiresAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    );
  }
}
