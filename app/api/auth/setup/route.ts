import { NextRequest, NextResponse } from 'next/server';
import { setupOwner, hasOwnerAccount } from '@/lib/auth/auth';
import { createSession } from '@/lib/auth/session';

/**
 * POST /api/auth/setup
 * First-time owner account setup
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { passphrase, username } = body;

    if (!passphrase) {
      return NextResponse.json(
        { error: 'Passphrase is required' },
        { status: 400 }
      );
    }

    const result = await setupOwner(passphrase, username);
    if (!result.success || !result.user) {
      return NextResponse.json(
        { error: result.error || 'Setup failed' },
        { status: 400 }
      );
    }

    // Auto-login after setup
    const session = await createSession(result.user.id, 'owner');
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
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/setup
 * Check if owner account exists
 */
export async function GET(): Promise<NextResponse> {
  try {
    const ownerExists = await hasOwnerAccount();
    return NextResponse.json({ ownerExists });
  } catch (error) {
    console.error('Setup check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
