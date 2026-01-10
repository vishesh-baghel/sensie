import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  authenticateOwner,
  authenticateVisitor,
  isOwner,
  isVisitor,
  isSessionValid,
  getUserFromSession,
  setupOwner,
  hasOwnerAccount,
  changePassphrase,
  requireAuth,
} from '@/lib/auth/auth';
import type { SessionData } from '@/lib/auth/auth';

// Mock Prisma client
vi.mock('@/lib/db/client', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock passphrase module
vi.mock('@/lib/auth/passphrase', () => ({
  hashPassphrase: vi.fn().mockResolvedValue('hashed-passphrase'),
  verifyPassphrase: vi.fn().mockResolvedValue(true),
  validatePassphrase: vi.fn().mockReturnValue({ valid: true, errors: [] }),
}));

// Mock session module
vi.mock('@/lib/auth/session', () => ({
  isSessionExpired: vi.fn().mockReturnValue(false),
}));

describe('auth', () => {
  const mockOwnerSession: SessionData = {
    userId: 'owner-123',
    role: 'owner',
    createdAt: Date.now(),
    expiresAt: Date.now() + 60 * 60 * 24 * 7 * 1000,
  };

  const mockVisitorSession: SessionData = {
    userId: 'visitor-456',
    role: 'visitor',
    createdAt: Date.now(),
    expiresAt: Date.now() + 60 * 60 * 24 * 1000,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset mocks to default return values (vi.clearAllMocks only clears history)
    const { verifyPassphrase, validatePassphrase } = await import('@/lib/auth/passphrase');
    (verifyPassphrase as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (validatePassphrase as ReturnType<typeof vi.fn>).mockReturnValue({ valid: true, errors: [] });
    const { isSessionExpired } = await import('@/lib/auth/session');
    (isSessionExpired as ReturnType<typeof vi.fn>).mockReturnValue(false);
  });

  describe('authenticateOwner', () => {
    it('should authenticate with correct passphrase', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'owner-123',
        username: 'owner',
        role: 'OWNER',
        passphraseHash: 'hashed-passphrase',
        createdAt: new Date(),
      });

      const result = await authenticateOwner('correct-passphrase');

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.role).toBe('OWNER');
    });

    it('should fail with incorrect passphrase', async () => {
      const { prisma } = await import('@/lib/db/client');
      const { verifyPassphrase } = await import('@/lib/auth/passphrase');
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'owner-123',
        username: 'owner',
        role: 'OWNER',
        passphraseHash: 'hashed-passphrase',
        createdAt: new Date(),
      });
      (verifyPassphrase as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const result = await authenticateOwner('wrong-passphrase');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid passphrase.');
    });

    it('should fail if no owner exists', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await authenticateOwner('any-passphrase');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No owner account exists');
    });

    it('should fail if owner has no passphrase hash', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'owner-123',
        username: 'owner',
        role: 'OWNER',
        passphraseHash: null,
        createdAt: new Date(),
      });

      const result = await authenticateOwner('any-passphrase');

      expect(result.success).toBe(false);
      expect(result.error).toContain('no passphrase set');
    });
  });

  describe('authenticateVisitor', () => {
    it('should create visitor session', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'visitor-456',
        username: 'visitor_123456',
        role: 'VISITOR',
        createdAt: new Date(),
      });

      const result = await authenticateVisitor();

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.role).toBe('VISITOR');
    });
  });

  describe('isOwner', () => {
    it('should return true for owner session', () => {
      const result = isOwner(mockOwnerSession);
      expect(result).toBe(true);
    });

    it('should return false for visitor session', () => {
      const result = isOwner(mockVisitorSession);
      expect(result).toBe(false);
    });

    it('should return false for null session', () => {
      const result = isOwner(null);
      expect(result).toBe(false);
    });
  });

  describe('isVisitor', () => {
    it('should return true for visitor session', () => {
      const result = isVisitor(mockVisitorSession);
      expect(result).toBe(true);
    });

    it('should return false for owner session', () => {
      const result = isVisitor(mockOwnerSession);
      expect(result).toBe(false);
    });
  });

  describe('isSessionValid', () => {
    it('should return true for valid session', () => {
      const result = isSessionValid(mockOwnerSession);
      expect(result).toBe(true);
    });

    it('should return false for expired session', async () => {
      const { isSessionExpired } = await import('@/lib/auth/session');
      (isSessionExpired as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const expiredSession: SessionData = {
        ...mockOwnerSession,
        expiresAt: Date.now() - 1000,
      };
      const result = isSessionValid(expiredSession);
      expect(result).toBe(false);
    });

    it('should return false for null session', () => {
      const result = isSessionValid(null);
      expect(result).toBe(false);
    });

    it('should return false for session without userId', () => {
      const invalidSession = { ...mockOwnerSession, userId: '' };
      const result = isSessionValid(invalidSession as SessionData);
      expect(result).toBe(false);
    });
  });

  describe('getUserFromSession', () => {
    it('should return user from valid session', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'owner-123',
        username: 'owner',
        role: 'OWNER',
        createdAt: new Date(),
      });

      const result = await getUserFromSession(mockOwnerSession);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('owner-123');
    });

    it('should return null for non-existent user', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await getUserFromSession(mockOwnerSession);

      expect(result).toBeNull();
    });
  });

  describe('setupOwner', () => {
    it('should create owner account', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'owner-123',
        username: 'owner',
        role: 'OWNER',
        passphraseHash: 'hashed',
        createdAt: new Date(),
      });

      const result = await setupOwner('valid-passphrase-here');

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
    });

    it('should fail if owner already exists', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'existing-owner',
        role: 'OWNER',
      });

      const result = await setupOwner('passphrase');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should fail with invalid passphrase', async () => {
      const { prisma } = await import('@/lib/db/client');
      const { validatePassphrase } = await import('@/lib/auth/passphrase');
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (validatePassphrase as ReturnType<typeof vi.fn>).mockReturnValue({
        valid: false,
        errors: ['Too short'],
      });

      const result = await setupOwner('bad');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Too short');
    });
  });

  describe('hasOwnerAccount', () => {
    it('should return true if owner exists', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'owner-123',
        role: 'OWNER',
      });

      const result = await hasOwnerAccount();

      expect(result).toBe(true);
    });

    it('should return false if no owner', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await hasOwnerAccount();

      expect(result).toBe(false);
    });
  });

  describe('changePassphrase', () => {
    it('should change passphrase with correct current', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'owner-123',
        username: 'owner',
        role: 'OWNER',
        passphraseHash: 'current-hash',
        createdAt: new Date(),
      });
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await changePassphrase('current', 'new-passphrase-here');

      expect(result.success).toBe(true);
    });

    it('should fail with incorrect current passphrase', async () => {
      const { prisma } = await import('@/lib/db/client');
      const { verifyPassphrase } = await import('@/lib/auth/passphrase');
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'owner-123',
        username: 'owner',
        role: 'OWNER',
        passphraseHash: 'current-hash',
        createdAt: new Date(),
      });
      (verifyPassphrase as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const result = await changePassphrase('wrong', 'new-passphrase');

      expect(result.success).toBe(false);
      expect(result.error).toContain('incorrect');
    });
  });

  describe('requireAuth', () => {
    it('should allow owner session', () => {
      const result = requireAuth(mockOwnerSession);
      expect(result.authorized).toBe(true);
    });

    it('should allow visitor session', () => {
      const result = requireAuth(mockVisitorSession);
      expect(result.authorized).toBe(true);
    });

    it('should require owner role when specified', () => {
      const result = requireAuth(mockVisitorSession, 'owner');
      expect(result.authorized).toBe(false);
      expect(result.error).toContain('Owner access required');
    });

    it('should reject null session', () => {
      const result = requireAuth(null);
      expect(result.authorized).toBe(false);
      expect(result.error).toContain('Not authenticated');
    });

    it('should reject expired session', async () => {
      const { isSessionExpired } = await import('@/lib/auth/session');
      (isSessionExpired as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const result = requireAuth(mockOwnerSession);
      expect(result.authorized).toBe(false);
      expect(result.error).toContain('expired');
    });
  });
});
