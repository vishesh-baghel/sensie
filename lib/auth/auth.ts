import type { User } from '@/lib/types';
import { prisma } from '@/lib/db/client';
import { hashPassphrase, verifyPassphrase, validatePassphrase } from './passphrase';
import { isSessionExpired } from './session';

/**
 * Core authentication logic
 *
 * Auth modes:
 * - Owner: Full access via passphrase (stored as bcrypt hash)
 * - Visitor: Limited access, no passphrase needed
 */

/**
 * Auth result returned from authentication
 */
export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

/**
 * Session data stored in iron-session
 */
export interface SessionData {
  userId: string;
  role: 'owner' | 'visitor';
  createdAt: number;
  expiresAt: number;
}

/**
 * Authenticate user with passphrase (owner mode)
 */
export async function authenticateOwner(passphrase: string): Promise<AuthResult> {
  const owner = await prisma.user.findFirst({
    where: { role: 'OWNER' },
  });

  if (!owner) {
    return { success: false, error: 'No owner account exists. Please set up first.' };
  }

  if (!owner.passphraseHash) {
    return { success: false, error: 'Owner account has no passphrase set.' };
  }

  const valid = await verifyPassphrase(passphrase, owner.passphraseHash);
  if (!valid) {
    return { success: false, error: 'Invalid passphrase.' };
  }

  return {
    success: true,
    user: {
      id: owner.id,
      username: owner.username || 'owner',
      role: 'OWNER',
      createdAt: owner.createdAt,
    },
  };
}

/**
 * Create or get visitor session
 */
export async function authenticateVisitor(): Promise<AuthResult> {
  // Create a new visitor user for each session
  const visitor = await prisma.user.create({
    data: {
      username: `visitor_${Date.now()}`,
      role: 'VISITOR',
    },
  });

  return {
    success: true,
    user: {
      id: visitor.id,
      username: visitor.username || 'visitor',
      role: 'VISITOR',
      createdAt: visitor.createdAt,
    },
  };
}

/**
 * Check if current user is the owner
 */
export function isOwner(session: SessionData | null): boolean {
  return session?.role === 'owner';
}

/**
 * Check if current user is a visitor
 */
export function isVisitor(session: SessionData | null): boolean {
  return session?.role === 'visitor';
}

/**
 * Validate session is still valid
 */
export function isSessionValid(session: SessionData | null): boolean {
  if (!session) return false;
  if (!session.userId) return false;
  return !isSessionExpired(session);
}

/**
 * Get user from session
 */
export async function getUserFromSession(
  session: SessionData
): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });

  if (!user) return null;

  return {
    id: user.id,
    username: user.username || 'user',
    role: user.role as 'OWNER' | 'VISITOR',
    createdAt: user.createdAt,
  };
}

/**
 * Setup owner account (first-time setup)
 */
export async function setupOwner(
  passphrase: string,
  username?: string
): Promise<AuthResult> {
  // Check if owner already exists
  const existingOwner = await prisma.user.findFirst({
    where: { role: 'OWNER' },
  });

  if (existingOwner) {
    return { success: false, error: 'Owner account already exists.' };
  }

  // Validate passphrase
  const validation = validatePassphrase(passphrase);
  if (!validation.valid) {
    return { success: false, error: validation.errors.join(' ') };
  }

  // Hash and create owner
  const passphraseHash = await hashPassphrase(passphrase);
  const owner = await prisma.user.create({
    data: {
      username: username || 'owner',
      role: 'OWNER',
      passphraseHash,
    },
  });

  return {
    success: true,
    user: {
      id: owner.id,
      username: owner.username || 'owner',
      role: 'OWNER',
      createdAt: owner.createdAt,
    },
  };
}

/**
 * Check if owner account exists
 */
export async function hasOwnerAccount(): Promise<boolean> {
  const owner = await prisma.user.findFirst({
    where: { role: 'OWNER' },
  });
  return !!owner;
}

/**
 * Change owner passphrase
 */
export async function changePassphrase(
  currentPassphrase: string,
  newPassphrase: string
): Promise<{ success: boolean; error?: string }> {
  // First authenticate with current passphrase
  const authResult = await authenticateOwner(currentPassphrase);
  if (!authResult.success || !authResult.user) {
    return { success: false, error: 'Current passphrase is incorrect.' };
  }

  // Validate new passphrase
  const validation = validatePassphrase(newPassphrase);
  if (!validation.valid) {
    return { success: false, error: validation.errors.join(' ') };
  }

  // Hash and update
  const passphraseHash = await hashPassphrase(newPassphrase);
  await prisma.user.update({
    where: { id: authResult.user.id },
    data: { passphraseHash },
  });

  return { success: true };
}

/**
 * Require auth middleware helper
 */
export function requireAuth(
  session: SessionData | null,
  requiredRole?: 'owner' | 'visitor'
): { authorized: boolean; error?: string } {
  if (!session) {
    return { authorized: false, error: 'Not authenticated.' };
  }

  if (!isSessionValid(session)) {
    return { authorized: false, error: 'Session expired.' };
  }

  // If a specific role is required
  if (requiredRole === 'owner' && session.role !== 'owner') {
    return { authorized: false, error: 'Owner access required.' };
  }

  return { authorized: true };
}
