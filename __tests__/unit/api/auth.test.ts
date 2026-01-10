import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as loginHandler } from '@/app/api/auth/login/route';
import { POST as logoutHandler } from '@/app/api/auth/logout/route';
import { POST as setupHandler, GET as checkSetupHandler } from '@/app/api/auth/setup/route';

// Mock auth module
vi.mock('@/lib/auth/auth', () => ({
  authenticateOwner: vi.fn(),
  authenticateVisitor: vi.fn(),
  setupOwner: vi.fn(),
  hasOwnerAccount: vi.fn(),
}));

// Mock session module
vi.mock('@/lib/auth/session', () => ({
  createSession: vi.fn(),
  destroySession: vi.fn(),
}));

function createMockRequest(body?: object): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/login', {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

describe('auth API routes', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should authenticate owner with passphrase', async () => {
      const { authenticateOwner } = await import('@/lib/auth/auth');
      const { createSession } = await import('@/lib/auth/session');

      (authenticateOwner as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        user: { id: 'owner-123', username: 'owner', role: 'OWNER' },
      });
      (createSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'owner-123',
        role: 'owner',
        expiresAt: Date.now() + 86400000,
      });

      const request = createMockRequest({ mode: 'owner', passphrase: 'test-passphrase' });
      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.role).toBe('owner');
    });

    it('should create visitor session', async () => {
      const { authenticateVisitor } = await import('@/lib/auth/auth');
      const { createSession } = await import('@/lib/auth/session');

      (authenticateVisitor as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        user: { id: 'visitor-123', username: 'visitor', role: 'VISITOR' },
      });
      (createSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'visitor-123',
        role: 'visitor',
        expiresAt: Date.now() + 86400000,
      });

      const request = createMockRequest({ mode: 'visitor' });
      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.role).toBe('visitor');
    });

    it('should reject invalid passphrase', async () => {
      const { authenticateOwner } = await import('@/lib/auth/auth');

      (authenticateOwner as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: 'Invalid passphrase.',
      });

      const request = createMockRequest({ mode: 'owner', passphrase: 'wrong' });
      const response = await loginHandler(request);

      expect(response.status).toBe(401);
    });

    it('should reject missing mode', async () => {
      const request = createMockRequest({ passphrase: 'test' });
      const response = await loginHandler(request);

      expect(response.status).toBe(400);
    });

    it('should reject owner mode without passphrase', async () => {
      const request = createMockRequest({ mode: 'owner' });
      const response = await loginHandler(request);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should destroy session', async () => {
      const { destroySession } = await import('@/lib/auth/session');
      (destroySession as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const response = await logoutHandler();

      expect(response.status).toBe(200);
      expect(destroySession).toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/setup', () => {
    it('should setup owner account', async () => {
      const { setupOwner } = await import('@/lib/auth/auth');
      const { createSession } = await import('@/lib/auth/session');

      (setupOwner as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: true,
        user: { id: 'owner-123', username: 'owner', role: 'OWNER' },
      });
      (createSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: 'owner-123',
        role: 'owner',
        expiresAt: Date.now() + 86400000,
      });

      const request = createMockRequest({ passphrase: 'new-passphrase-here' });
      const response = await setupHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should reject if owner exists', async () => {
      const { setupOwner } = await import('@/lib/auth/auth');

      (setupOwner as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: 'Owner account already exists.',
      });

      const request = createMockRequest({ passphrase: 'passphrase' });
      const response = await setupHandler(request);

      expect(response.status).toBe(400);
    });

    it('should reject without passphrase', async () => {
      const request = createMockRequest({});
      const response = await setupHandler(request);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/auth/setup', () => {
    it('should return setup status when owner exists', async () => {
      const { hasOwnerAccount } = await import('@/lib/auth/auth');
      (hasOwnerAccount as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const response = await checkSetupHandler();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ownerExists).toBe(true);
    });

    it('should return setup status when no owner', async () => {
      const { hasOwnerAccount } = await import('@/lib/auth/auth');
      (hasOwnerAccount as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const response = await checkSetupHandler();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.ownerExists).toBe(false);
    });
  });
});
