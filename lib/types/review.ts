import type {
  Review as PrismaReview,
  ReviewType,
  ReviewStatus,
} from '@prisma/client';

// Re-export Prisma enums
export { ReviewType, ReviewStatus };

export type Review = PrismaReview;

// FSRS types (compatible with ts-fsrs)
export type Rating = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy

export interface Card {
  due: Date;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: State;
  last_review?: Date;
}

export enum State {
  New = 0,
  Learning = 1,
  Review = 2,
  Relearning = 3,
}

// Review item for UI
export interface ReviewItem {
  id: string;
  userId: string;
  topicId: string;
  topicName: string;
  subtopicId?: string;
  subtopicName?: string;
  conceptId?: string;
  conceptName?: string;
  type: ReviewType;
  dueDate: Date;
  status: ReviewStatus;
  lastReviewed?: Date;
}

// Review session
export interface ReviewSession {
  items: ReviewItem[];
  currentIndex: number;
  totalItems: number;
  completedItems: number;
  ratings: Map<string, Rating>;
}

// Review result after completing a session
export interface ReviewResult {
  reviewId: string;
  rating: Rating;
  nextReviewDate: Date;
  newStatus: ReviewStatus;
}
