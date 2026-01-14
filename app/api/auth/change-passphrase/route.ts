import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { changePassphrase } from '@/lib/auth/auth';

/**
 * POST /api/auth/change-passphrase
 * Change owner passphrase
 *
 * Fixes Bug #11 (Change Passphrase non-functional)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();

    // Check if user is authenticated
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Only owners can change passphrase
    if (session.role !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Only owner can change passphrase' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { currentPassphrase, newPassphrase } = body;

    // Validate required fields
    if (!currentPassphrase || !newPassphrase) {
      return NextResponse.json(
        { success: false, error: 'Both current and new passphrase are required' },
        { status: 400 }
      );
    }

    // Call the changePassphrase function from auth module
    const result = await changePassphrase(currentPassphrase, newPassphrase);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to change passphrase' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Passphrase changed successfully',
    });
  } catch (error) {
    console.error('Error changing passphrase:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
