import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getUserPreferences, updateUserPreferences } from '@/lib/db/users';

/**
 * GET /api/settings/preferences
 * Get user preferences for authenticated user
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const preferences = await getUserPreferences(session.userId);

    return NextResponse.json({
      success: true,
      data: {
        masteryThreshold: preferences.masteryThreshold,
        dailyReviewLimit: preferences.dailyReviewLimit,
        dailyGoal: preferences.dailyGoal,
        theme: preferences.theme,
        personalityLevel: preferences.personalityLevel,
        reviewReminders: preferences.reviewReminders,
        achievementAlerts: preferences.achievementAlerts,
      },
    });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/settings/preferences
 * Update user preferences
 *
 * Fixes Bug #9 (Mastery Threshold slider) and Bug #10 (Daily Review Limit)
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { masteryThreshold, dailyReviewLimit, dailyGoal, theme, personalityLevel } = body;

    // Validate masteryThreshold if provided
    if (masteryThreshold !== undefined) {
      if (typeof masteryThreshold !== 'number' || masteryThreshold < 50 || masteryThreshold > 100) {
        return NextResponse.json(
          { success: false, error: 'Mastery threshold must be between 50 and 100' },
          { status: 400 }
        );
      }
    }

    // Validate dailyReviewLimit if provided
    if (dailyReviewLimit !== undefined) {
      if (typeof dailyReviewLimit !== 'number' || dailyReviewLimit < 5 || dailyReviewLimit > 50) {
        return NextResponse.json(
          { success: false, error: 'Daily review limit must be between 5 and 50' },
          { status: 400 }
        );
      }
    }

    // Validate dailyGoal if provided
    if (dailyGoal !== undefined) {
      if (typeof dailyGoal !== 'number' || dailyGoal < 5 || dailyGoal > 120) {
        return NextResponse.json(
          { success: false, error: 'Daily goal must be between 5 and 120 minutes' },
          { status: 400 }
        );
      }
    }

    // Validate theme if provided
    if (theme !== undefined) {
      if (!['light', 'dark'].includes(theme)) {
        return NextResponse.json(
          { success: false, error: 'Theme must be "light" or "dark"' },
          { status: 400 }
        );
      }
    }

    // Validate personalityLevel if provided
    if (personalityLevel !== undefined) {
      if (!['full', 'balanced', 'minimal'].includes(personalityLevel)) {
        return NextResponse.json(
          { success: false, error: 'Personality level must be "full", "balanced", or "minimal"' },
          { status: 400 }
        );
      }
    }

    // Build update data object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (masteryThreshold !== undefined) updateData.masteryThreshold = masteryThreshold;
    if (dailyReviewLimit !== undefined) updateData.dailyReviewLimit = dailyReviewLimit;
    if (dailyGoal !== undefined) updateData.dailyGoal = dailyGoal;
    if (theme !== undefined) updateData.theme = theme;
    if (personalityLevel !== undefined) updateData.personalityLevel = personalityLevel;

    // Update preferences
    const updatedPreferences = await updateUserPreferences(session.userId, updateData);

    return NextResponse.json({
      success: true,
      data: {
        masteryThreshold: updatedPreferences.masteryThreshold,
        dailyReviewLimit: updatedPreferences.dailyReviewLimit,
        dailyGoal: updatedPreferences.dailyGoal,
        theme: updatedPreferences.theme,
        personalityLevel: updatedPreferences.personalityLevel,
      },
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
