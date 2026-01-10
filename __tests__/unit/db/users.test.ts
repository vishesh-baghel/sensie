import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createUser,
  getUserById,
  getUserByUsername,
  getOwnerUser,
  ownerExists,
  deleteUser,
  getUserPreferences,
  updateUserPreferences,
} from '@/lib/db/users';

// Mock Prisma client
vi.mock('@/lib/db/client', () => ({
  prisma: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    userPreferences: {
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

describe('users db module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create a user with default VISITOR role', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        passphraseHash: 'hashedpassword',
        role: 'VISITOR',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      const result = await createUser({
        username: 'testuser',
        passphraseHash: 'hashedpassword',
      });

      expect(result).toEqual(mockUser);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          username: 'testuser',
          passphraseHash: 'hashedpassword',
          role: 'VISITOR',
        },
      });
    });

    it('should create owner user', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockOwner = {
        id: 'owner-123',
        username: 'owner',
        passphraseHash: 'hashedpassword',
        role: 'OWNER',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (prisma.user.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockOwner);

      const result = await createUser({
        username: 'owner',
        passphraseHash: 'hashedpassword',
        role: 'OWNER',
      });

      expect(result.role).toBe('OWNER');
    });
  });

  describe('getUserById', () => {
    it('should return user by id', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockUser = { id: 'user-123', username: 'testuser', role: 'VISITOR' };
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      const result = await getUserById('user-123');

      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
    });

    it('should return null for non-existent user', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await getUserById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getUserByUsername', () => {
    it('should return user by username', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockUser = { id: 'user-123', username: 'testuser', role: 'VISITOR' };
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      const result = await getUserByUsername('testuser');

      expect(result).toEqual(mockUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { username: 'testuser' },
      });
    });
  });

  describe('getOwnerUser', () => {
    it('should return the owner user', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockOwner = { id: 'owner-123', username: 'owner', role: 'OWNER' };
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(mockOwner);

      const result = await getOwnerUser();

      expect(result).toEqual(mockOwner);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { role: 'OWNER' },
      });
    });

    it('should return null if no owner exists', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await getOwnerUser();

      expect(result).toBeNull();
    });
  });

  describe('ownerExists', () => {
    it('should return true if owner exists', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'owner-123' });

      const result = await ownerExists();

      expect(result).toBe(true);
    });

    it('should return false if no owner exists', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await ownerExists();

      expect(result).toBe(false);
    });
  });

  describe('deleteUser', () => {
    it('should delete user by id', async () => {
      const { prisma } = await import('@/lib/db/client');
      (prisma.user.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await deleteUser('user-123');

      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
    });
  });

  describe('getUserPreferences', () => {
    it('should return existing preferences', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockPrefs = { id: 'pref-123', userId: 'user-123', masteryThreshold: 70 };
      (prisma.userPreferences.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockPrefs);

      const result = await getUserPreferences('user-123');

      expect(result).toEqual(mockPrefs);
    });

    it('should create default preferences if none exist', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockPrefs = { id: 'pref-123', userId: 'user-123', masteryThreshold: 70 };
      (prisma.userPreferences.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.userPreferences.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockPrefs);

      const result = await getUserPreferences('user-123');

      expect(result).toEqual(mockPrefs);
      expect(prisma.userPreferences.create).toHaveBeenCalledWith({
        data: { userId: 'user-123' },
      });
    });
  });

  describe('updateUserPreferences', () => {
    it('should update mastery threshold', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockPrefs = { id: 'pref-123', userId: 'user-123', masteryThreshold: 90 };
      (prisma.userPreferences.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(mockPrefs);

      const result = await updateUserPreferences('user-123', { masteryThreshold: 90 });

      expect(result.masteryThreshold).toBe(90);
      expect(prisma.userPreferences.upsert).toHaveBeenCalled();
    });

    it('should update AI provider preference', async () => {
      const { prisma } = await import('@/lib/db/client');
      const mockPrefs = { id: 'pref-123', userId: 'user-123', preferredAiProvider: 'OPENAI' };
      (prisma.userPreferences.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(mockPrefs);

      const result = await updateUserPreferences('user-123', { preferredAiProvider: 'OPENAI' });

      expect(result.preferredAiProvider).toBe('OPENAI');
    });
  });
});
