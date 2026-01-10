import { NextRequest, NextResponse } from 'next/server';
import { authenticateOwner, authenticateVisitor } from '@/lib/auth/auth';
import { createSession } from '@/lib/auth/session';
import { authLogger } from '@/lib/observability/logger';

/**
 * POST /api/auth/login
 * Authenticate user with passphrase (owner) or create visitor session
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { mode, passphrase } = body;

    if (mode === 'owner') {
      authLogger.info('Owner login attempt');

      if (!passphrase) {
        return NextResponse.json(
          { error: 'Passphrase is required' },
          { status: 400 }
        );
      }

      const result = await authenticateOwner(passphrase);
      if (!result.success || !result.user) {
        authLogger.warn('Owner login failed', { error: result.error });
        return NextResponse.json(
          { error: result.error || 'Authentication failed' },
          { status: 401 }
        );
      }

      const session = await createSession(result.user.id, 'owner');
      authLogger.info('Owner login successful', { userId: result.user.id });

      return NextResponse.json({
        success: true,
        user: {
          id: result.user.id,
          username: result.user.username,
          role: 'owner',
        },
        session: {
          expiresAt: session.expiresAt,
        },
      });
    } else if (mode === 'visitor') {
      authLogger.info('Visitor session requested');

      const result = await authenticateVisitor();
      if (!result.success || !result.user) {
        authLogger.error('Visitor session creation failed', result.error);
        return NextResponse.json(
          { error: result.error || 'Failed to create visitor session' },
          { status: 500 }
        );
      }

      const session = await createSession(result.user.id, 'visitor');
      authLogger.info('Visitor session created', { userId: result.user.id });

      return NextResponse.json({
        success: true,
        user: {
          id: result.user.id,
          username: result.user.username,
          role: 'visitor',
        },
        session: {
          expiresAt: session.expiresAt,
        },
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid mode. Use "owner" or "visitor"' },
        { status: 400 }
      );
    }
  } catch (error) {
    authLogger.error('Login error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
