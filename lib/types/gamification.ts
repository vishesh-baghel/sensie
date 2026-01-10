import type {
  UserProgress as PrismaUserProgress,
  Badge as PrismaBadge,
  LearningAnalytics as PrismaLearningAnalytics,
} from '@prisma/client';

export type UserProgress = PrismaUserProgress;
export type Badge = PrismaBadge;
export type LearningAnalytics = PrismaLearningAnalytics;

// XP calculation types
export interface XPReward {
  action: XPAction;
  baseAmount: number;
  multiplier: number;
  totalXP: number;
}

export type XPAction =
  | 'correct_answer'
  | 'deep_answer'
  | 'no_hints'
  | 'concept_mastered'
  | 'subtopic_completed'
  | 'topic_completed'
  | 'review_completed'
  | 'streak_bonus';

// Level thresholds
export const LEVEL_THRESHOLDS: Record<number, number> = {
  1: 0,
  2: 100,
  3: 300,
  4: 600,
  5: 1000,
  6: 1500,
  7: 2100,
  8: 2800,
  9: 3600,
  10: 4500,
};

// Badge types
export type BadgeType =
  // Learning Milestones
  | 'first_blood'
  | 'bookworm'
  | 'on_fire_7'
  | 'on_fire_30'
  | 'centurion_100'
  // Mastery
  | 'white_belt_1'
  | 'yellow_belt_5'
  | 'green_belt_10'
  | 'black_belt_25'
  // Challenge
  | 'no_hints_subtopic'
  | 'perfectionist'
  | 'feynman_master_10';

export interface BadgeDefinition {
  type: BadgeType;
  name: string;
  description: string;
  icon: string;
  requirement: string;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    type: 'first_blood',
    name: 'First Blood',
    description: 'Answer your first question correctly',
    icon: '🎯',
    requirement: '1 correct answer',
  },
  {
    type: 'bookworm',
    name: 'Bookworm',
    description: 'Complete your first topic',
    icon: '📚',
    requirement: '1 topic completed',
  },
  {
    type: 'on_fire_7',
    name: 'On Fire',
    description: 'Maintain a 7-day learning streak',
    icon: '🔥',
    requirement: '7-day streak',
  },
  {
    type: 'on_fire_30',
    name: 'Unstoppable',
    description: 'Maintain a 30-day learning streak',
    icon: '💪',
    requirement: '30-day streak',
  },
  {
    type: 'no_hints_subtopic',
    name: 'Solo Master',
    description: 'Complete a subtopic without using any hints',
    icon: '🧠',
    requirement: 'No hints in subtopic',
  },
];

// Streak info for UI
export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date;
  streakFreezes: number;
  isAtRisk: boolean; // True if user hasn't learned today
}
