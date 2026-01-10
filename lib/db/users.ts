import { prisma } from './client';
import type { User, UserPreferences, UserRole } from '@prisma/client';

/**
 * Create a new user
 */
export async function createUser(data: {
  username?: string;
  passphraseHash?: string;
  role?: UserRole;
}): Promise<User> {
  return prisma.user.create({
    data: {
      username: data.username,
      passphraseHash: data.passphraseHash,
      role: data.role || 'VISITOR',
    },
  });
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { id: userId },
  });
}

/**
 * Get user by username
 */
export async function getUserByUsername(username: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { username },
  });
}

/**
 * Get the owner user (there should only be one)
 */
export async function getOwnerUser(): Promise<User | null> {
  return prisma.user.findFirst({
    where: { role: 'OWNER' },
  });
}

/**
 * Check if an owner already exists
 */
export async function ownerExists(): Promise<boolean> {
  const owner = await prisma.user.findFirst({
    where: { role: 'OWNER' },
  });
  return !!owner;
}

/**
 * Delete a user
 */
export async function deleteUser(userId: string): Promise<void> {
  await prisma.user.delete({
    where: { id: userId },
  });
}

/**
 * Get or create user preferences
 */
export async function getUserPreferences(
  userId: string
): Promise<UserPreferences> {
  let prefs = await prisma.userPreferences.findUnique({
    where: { userId },
  });

  if (!prefs) {
    prefs = await prisma.userPreferences.create({
      data: { userId },
    });
  }

  return prefs;
}

/**
 * Update user preferences
 */
export async function updateUserPreferences(
  userId: string,
  data: Partial<Omit<UserPreferences, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<UserPreferences> {
  return prisma.userPreferences.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}
