import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock auth modules
vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/db/users', () => ({
  getUserPreferences: vi.fn(),
  updateUserPreferences: vi.fn(),
}));

/**
 * Test suite for Bug #9 (Mastery Threshold slider) and Bug #10 (Daily Review Limit)
 * These tests verify that the settings API endpoints work correctly.
 */
describe('settings API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  function createMockRequest(
    method: string,
    body?: object,
    url = 'http://localhost:3000/api/settings/preferences'
  ): NextRequest {
    return new NextRequest(url, {
      method,
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  describe('GET /api/settings/preferences', () => {
    it('should return user preferences for authenticated user', async () => {
      // Arrange
      const { getSession } = await import('@/lib/auth/session');
      const { getUserPreferences } = await import('@/lib/db/users');

      (getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'user-123',
        role: 'owner',
      });

      (getUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'pref-123',
        userId: 'user-123',
        masteryThreshold: 80,
        dailyReviewLimit: 20,
        theme: 'dark',
      });

      // Act
      const { GET } = await import('@/app/api/settings/preferences/route');
      const response = await GET();
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.masteryThreshold).toBe(80);
      expect(data.data.dailyReviewLimit).toBe(20);
    });

    it('should return 401 for unauthenticated user', async () => {
      // Arrange
      const { getSession } = await import('@/lib/auth/session');
      (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      // Act
      const { GET } = await import('@/app/api/settings/preferences/route');
      const response = await GET();

      // Assert
      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /api/settings/preferences', () => {
    it('should update mastery threshold (Bug #9)', async () => {
      // Arrange
      const { getSession } = await import('@/lib/auth/session');
      const { updateUserPreferences } = await import('@/lib/db/users');

      (getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'user-123',
        role: 'owner',
      });

      (updateUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'pref-123',
        userId: 'user-123',
        masteryThreshold: 70,
        dailyReviewLimit: 20,
      });

      // Act
      const { PATCH } = await import('@/app/api/settings/preferences/route');
      const request = createMockRequest('PATCH', { masteryThreshold: 70 });
      const response = await PATCH(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.masteryThreshold).toBe(70);
      expect(updateUserPreferences).toHaveBeenCalledWith('user-123', { masteryThreshold: 70 });
    });

    it('should update daily review limit (Bug #10)', async () => {
      // Arrange
      const { getSession } = await import('@/lib/auth/session');
      const { updateUserPreferences } = await import('@/lib/db/users');

      (getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'user-123',
        role: 'owner',
      });

      (updateUserPreferences as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'pref-123',
        userId: 'user-123',
        masteryThreshold: 80,
        dailyReviewLimit: 30,
      });

      // Act
      const { PATCH } = await import('@/app/api/settings/preferences/route');
      const request = createMockRequest('PATCH', { dailyReviewLimit: 30 });
      const response = await PATCH(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.dailyReviewLimit).toBe(30);
      expect(updateUserPreferences).toHaveBeenCalledWith('user-123', { dailyReviewLimit: 30 });
    });

    it('should reject invalid mastery threshold values', async () => {
      // Arrange
      const { getSession } = await import('@/lib/auth/session');
      (getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'user-123',
        role: 'owner',
      });

      // Act
      const { PATCH } = await import('@/app/api/settings/preferences/route');
      const request = createMockRequest('PATCH', { masteryThreshold: 110 }); // Invalid: > 100
      const response = await PATCH(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('should reject invalid daily review limit values', async () => {
      // Arrange
      const { getSession } = await import('@/lib/auth/session');
      (getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'user-123',
        role: 'owner',
      });

      // Act
      const { PATCH } = await import('@/app/api/settings/preferences/route');
      const request = createMockRequest('PATCH', { dailyReviewLimit: 100 }); // Invalid: > 50
      const response = await PATCH(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('should return 401 for unauthenticated user', async () => {
      // Arrange
      const { getSession } = await import('@/lib/auth/session');
      (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      // Act
      const { PATCH } = await import('@/app/api/settings/preferences/route');
      const request = createMockRequest('PATCH', { masteryThreshold: 70 });
      const response = await PATCH(request);

      // Assert
      expect(response.status).toBe(401);
    });
  });
});
