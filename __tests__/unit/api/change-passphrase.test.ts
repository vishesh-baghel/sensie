import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock auth modules
vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/auth/auth', () => ({
  changePassphrase: vi.fn(),
}));

/**
 * Test suite for Bug #11 (Change Passphrase non-functional)
 * These tests verify that the change passphrase API endpoint works correctly.
 */
describe('change passphrase API route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  function createMockRequest(body?: object): NextRequest {
    return new NextRequest('http://localhost:3000/api/auth/change-passphrase', {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  describe('POST /api/auth/change-passphrase', () => {
    it('should change passphrase with valid credentials (Bug #11)', async () => {
      // Arrange
      const { getSession } = await import('@/lib/auth/session');
      const { changePassphrase } = await import('@/lib/auth/auth');

      (getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'owner-123',
        role: 'owner',
      });

      (changePassphrase as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
      });

      // Act
      const { POST } = await import('@/app/api/auth/change-passphrase/route');
      const request = createMockRequest({
        currentPassphrase: 'old-passphrase',
        newPassphrase: 'new-secure-passphrase-123',
      });
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(changePassphrase).toHaveBeenCalledWith(
        'old-passphrase',
        'new-secure-passphrase-123'
      );
    });

    it('should return error for incorrect current passphrase', async () => {
      // Arrange
      const { getSession } = await import('@/lib/auth/session');
      const { changePassphrase } = await import('@/lib/auth/auth');

      (getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'owner-123',
        role: 'owner',
      });

      (changePassphrase as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: 'Current passphrase is incorrect.',
      });

      // Act
      const { POST } = await import('@/app/api/auth/change-passphrase/route');
      const request = createMockRequest({
        currentPassphrase: 'wrong-passphrase',
        newPassphrase: 'new-secure-passphrase-123',
      });
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('incorrect');
    });

    it('should return error for invalid new passphrase', async () => {
      // Arrange
      const { getSession } = await import('@/lib/auth/session');
      const { changePassphrase } = await import('@/lib/auth/auth');

      (getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'owner-123',
        role: 'owner',
      });

      (changePassphrase as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: 'Passphrase must be at least 8 characters.',
      });

      // Act
      const { POST } = await import('@/app/api/auth/change-passphrase/route');
      const request = createMockRequest({
        currentPassphrase: 'old-passphrase',
        newPassphrase: 'short',
      });
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should return 400 for missing fields', async () => {
      // Arrange
      const { getSession } = await import('@/lib/auth/session');

      (getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'owner-123',
        role: 'owner',
      });

      // Act - missing newPassphrase
      const { POST } = await import('@/app/api/auth/change-passphrase/route');
      const request = createMockRequest({
        currentPassphrase: 'old-passphrase',
      });
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('should return 401 for unauthenticated user', async () => {
      // Arrange
      const { getSession } = await import('@/lib/auth/session');
      (getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      // Act
      const { POST } = await import('@/app/api/auth/change-passphrase/route');
      const request = createMockRequest({
        currentPassphrase: 'old',
        newPassphrase: 'new-secure-passphrase',
      });
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(401);
    });

    it('should return 403 for visitor trying to change passphrase', async () => {
      // Arrange
      const { getSession } = await import('@/lib/auth/session');

      (getSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'visitor-123',
        role: 'visitor',
      });

      // Act
      const { POST } = await import('@/app/api/auth/change-passphrase/route');
      const request = createMockRequest({
        currentPassphrase: 'old',
        newPassphrase: 'new-secure-passphrase',
      });
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(403);
    });
  });
});
