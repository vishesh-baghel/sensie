import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth/session';

/**
 * POST /api/auth/logout
 * Destroy current session
 */
export async function POST(): Promise<NextResponse> {
  try {
    await destroySession();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
