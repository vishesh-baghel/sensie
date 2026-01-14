import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { deleteUserLearningData } from '@/lib/db/users';

/**
 * DELETE /api/settings/delete-all
 * Delete all learning data (topics, progress, sessions, etc.)
 * Keeps user account and preferences so user can start fresh
 */
export async function DELETE(): Promise<NextResponse> {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Delete all learning data but keep user account
    await deleteUserLearningData(session.userId);

    return NextResponse.json({
      success: true,
      message: 'All learning data deleted successfully. Your account is preserved.',
    });
  } catch (error) {
    console.error('Error deleting user data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete data' },
      { status: 500 }
    );
  }
}
