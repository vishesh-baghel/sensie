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
 * Delete all learning data for a user (keeps user account and preferences)
 * This allows the user to start fresh without losing their account
 */
export async function deleteUserLearningData(userId: string): Promise<void> {
  // Delete in order to respect foreign key constraints
  // Topics cascade delete: Subtopics -> Concepts -> Questions
  // LearningSession cascade delete: Messages
  await prisma.$transaction([
    // Delete answers (references questions and users)
    prisma.answer.deleteMany({ where: { userId } }),
    // Delete reviews
    prisma.review.deleteMany({ where: { userId } }),
    // Delete learning sessions (cascades to messages)
    prisma.learningSession.deleteMany({ where: { userId } }),
    // Delete topics (cascades to subtopics -> concepts -> questions)
    prisma.topic.deleteMany({ where: { userId } }),
    // Delete progress tracking
    prisma.userProgress.deleteMany({ where: { userId } }),
    // Delete badges
    prisma.badge.deleteMany({ where: { userId } }),
    // Delete analytics
    prisma.learningAnalytics.deleteMany({ where: { userId } }),
    // Delete Feynman exercises
    prisma.feynmanExercise.deleteMany({ where: { userId } }),
    // Delete knowledge gap records
    prisma.knowledgeGapRecord.deleteMany({ where: { userId } }),
  ]);
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
