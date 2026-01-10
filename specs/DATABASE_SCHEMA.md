# Sensie Database Schema

## Overview

This document defines the complete database schema for Sensie using Prisma ORM with PostgreSQL.

## Design Principles

1. **Learning-First:** Schema optimized for tracking learning progress
2. **Hierarchical:** Topics → Subtopics → Concepts → Questions
3. **Temporal:** Track when things were learned and reviewed
4. **Flexible:** JSONB for dynamic data (SRS parameters, analytics)
5. **Performance:** Strategic indexes on frequently queried fields
6. **Cascading:** Proper cascade deletes for data cleanup

## Complete Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================================
// USER & AUTH
// ============================================================================

model User {
  id        String   @id @default(cuid())
  username  String   @unique
  password  String   // bcrypt hashed
  isOwner   Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Visitor mode flag
  allowVisitorMode Boolean @default(true)

  // Relationships
  topics              Topic[]
  learningSessionsessions    LearningSession[]
  answers             Answer[]
  reviews             Review[]
  projects            Project[]
  codebaseAnalyses    CodebaseAnalysis[]

  @@index([username])
}

// ============================================================================
// LEARNING HIERARCHY
// ============================================================================

model Topic {
  id          String   @id @default(cuid())
  userId      String
  name        String
  description String?
  status      TopicStatus @default(QUEUED)

  // Progress tracking
  masteryPercentage Float   @default(0) // 0-100

  // Metadata
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  startedAt   DateTime?
  completedAt DateTime?

  // Relationships
  user            User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  subtopics       Subtopic[]
  learningSession LearningSession?
  reviews         Review[]
  resources       LearningResource[]

  @@unique([userId, name])
  @@index([userId, status])
}

enum TopicStatus {
  QUEUED      // Added to learning queue
  ACTIVE      // Currently learning (max 2-3 at a time)
  COMPLETED   // Mastered (hit user's mastery threshold)
  ARCHIVED    // Hidden from view, preserved for reference
}

model Subtopic {
  id          String   @id @default(cuid())
  topicId     String
  name        String
  description String?
  order       Int      // For sequential unlocking

  // Progress tracking
  masteryPercentage Float   @default(0)
  isLocked          Boolean @default(true) // Unlocks when previous subtopic is completed

  // Metadata
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  completedAt DateTime?

  // Relationships
  topic     Topic     @relation(fields: [topicId], references: [id], onDelete: Cascade)
  concepts  Concept[]

  @@unique([topicId, name])
  @@index([topicId, order])
}

model Concept {
  id          String   @id @default(cuid())
  subtopicId  String
  name        String
  explanation String   @db.Text // LLM-generated explanation

  // Examples and analogies
  codeExamples String[] // Array of code snippets
  analogies    String[] // Simple explanations

  // Progress tracking
  isMastered  Boolean  @default(false)

  // Metadata
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  masteredAt  DateTime?

  // Relationships
  subtopic      Subtopic   @relation(fields: [subtopicId], references: [id], onDelete: Cascade)
  questions     Question[]
  prerequisites Concept[]  @relation("ConceptPrerequisites")
  dependents    Concept[]  @relation("ConceptPrerequisites")

  @@unique([subtopicId, name])
  @@index([subtopicId, isMastered])
}

// ============================================================================
// QUESTIONS & ANSWERS (Socratic Method)
// ============================================================================

model Question {
  id         String       @id @default(cuid())
  conceptId  String
  text       String       @db.Text
  type       QuestionType
  difficulty Int          @default(2) // 1-5

  // Socratic elements
  expectedElements String[]  // Key points that should be in answer
  hints            String[]  // Progressive hints
  followUpPrompts  String[]  // If answer is shallow

  // Metadata
  createdAt DateTime @default(now())

  // Relationships
  concept Concept  @relation(fields: [conceptId], references: [id], onDelete: Cascade)
  answers Answer[]

  @@index([conceptId, difficulty])
}

enum QuestionType {
  RECALL        // "What is X?"
  UNDERSTANDING // "Why does X work?"
  APPLICATION   // "How would you use X?"
  ANALYSIS      // "Compare X and Y"
  SYNTHESIS     // "Combine X and Y to solve Z"
}

model Answer {
  id         String   @id @default(cuid())
  questionId String
  userId     String
  sessionId  String   // Link to learning session

  // Answer data
  text       String   @db.Text
  isCorrect  Boolean
  depth      AnswerDepth

  // Metadata
  hintsUsed      Int      @default(0)
  timeToAnswer   Int?     // Seconds
  attemptNumber  Int      @default(1) // How many attempts for this question

  // Privacy (for visitor mode)
  isPrivate  Boolean  @default(false) // Owner can mark answers as private

  createdAt DateTime @default(now())

  // Relationships
  question Question        @relation(fields: [questionId], references: [id], onDelete: Cascade)
  user     User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  session  LearningSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([userId, questionId])
  @@index([sessionId])
}

enum AnswerDepth {
  NONE    // Completely wrong
  SHALLOW // Correct but lacks depth
  DEEP    // Correct with good understanding
}

// ============================================================================
// LEARNING SESSIONS (Chat)
// ============================================================================

model LearningSession {
  id         String   @id @default(cuid())
  userId     String
  topicId    String   @unique // One active session per topic

  // Session state
  currentSubtopicId  String?
  currentConceptId   String?
  currentQuestionId  String?  // For exact resume
  isActive           Boolean @default(true)

  // Skip tracking (3 max per session)
  skipsUsed          Int      @default(0)
  skippedQuestionIds String[] // Questions to revisit before unlocking next subtopic

  // Attempt tracking for current question
  currentAttempts    Int      @default(0)
  hintsUsed          Int      @default(0)

  // Metadata
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  lastActivity DateTime @default(now())
  endedAt      DateTime?

  // Relationships
  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  topic    Topic     @relation(fields: [topicId], references: [id], onDelete: Cascade)
  messages Message[]
  answers  Answer[]

  @@index([userId, isActive])
}

model Message {
  id        String   @id @default(cuid())
  sessionId String
  role      MessageRole
  content   String   @db.Text

  // Message metadata
  metadata  Json?    // For question IDs, feedback, etc.

  createdAt DateTime @default(now())

  // Relationships
  session LearningSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId, createdAt])
}

enum MessageRole {
  SENSIE // Sensie's message
  USER   // User's message
  SYSTEM // System messages (concept unlocked, etc.)
}

// ============================================================================
// SPACED REPETITION
// ============================================================================

model Review {
  id     String     @id @default(cuid())
  userId String

  // What's being reviewed (can be topic, subtopic, or concept)
  topicId    String
  subtopicId String?
  conceptId  String?
  type       ReviewType

  // FSRS Algorithm Parameters (ts-fsrs library)
  // See: https://github.com/open-spaced-repetition/ts-fsrs
  stability    Float    @default(0)   // How well the memory is retained
  difficulty   Float    @default(0)   // How hard the card is
  elapsedDays  Int      @default(0)   // Days since last review
  scheduledDays Int     @default(0)   // Days until next review
  reps         Int      @default(0)   // Number of successful reviews
  lapses       Int      @default(0)   // Number of times forgotten
  state        Int      @default(0)   // FSRS state: New(0), Learning(1), Review(2), Relearning(3)

  // Scheduling
  lastReviewed DateTime?
  nextReview   DateTime              // Card due date
  status       ReviewStatus @default(NEW)

  // Performance tracking
  lastRating   Int?                  // FSRS Rating: Again(1), Hard(2), Good(3), Easy(4)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relationships
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  topic Topic @relation(fields: [topicId], references: [id], onDelete: Cascade)

  @@index([userId, nextReview, status])
  @@index([userId, status])
}

enum ReviewType {
  TOPIC
  SUBTOPIC
  CONCEPT
}

enum ReviewStatus {
  NEW       // Never reviewed
  LEARNING  // In learning phase (short intervals)
  GRADUATED // Mastered (long intervals)
  LAPSED    // Forgotten, needs re-learning
}

// ============================================================================
// LEARNING RESOURCES (Web, Code, Projects)
// ============================================================================

model LearningResource {
  id      String       @id @default(cuid())
  topicId String
  type    ResourceType

  // Resource data
  title       String
  url         String?
  content     String?  @db.Text
  summary     String?  @db.Text // AI-generated summary

  // Metadata
  relevanceScore Float?   // 0-1 (how relevant to topic)
  createdAt      DateTime @default(now())

  // Relationships
  topic Topic @relation(fields: [topicId], references: [id], onDelete: Cascade)

  @@index([topicId, type])
}

enum ResourceType {
  ARTICLE        // Web article
  DOCUMENTATION  // Official docs
  VIDEO          // YouTube, etc.
  CODEBASE       // GitHub repo
  USER_PROVIDED  // User-shared resource
}

model CodebaseAnalysis {
  id          String   @id @default(cuid())
  userId      String
  repoUrl     String
  learningGoal String  @db.Text

  // Analysis results
  status        AnalysisStatus @default(ANALYZING)
  keyFiles      String[]
  patterns      String[]
  teachingPath  Json?          // Structured teaching path

  // Cache
  analysisData  Json?          // Full analysis for re-use

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relationships
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, repoUrl])
}

enum AnalysisStatus {
  ANALYZING
  COMPLETE
  FAILED
}

// ============================================================================
// PROJECTS (For Project-Based Learning)
// ============================================================================

model Project {
  id          String   @id @default(cuid())
  userId      String
  name        String
  description String?  @db.Text
  repoUrl     String?

  // Learning context
  relatedTopics String[] // Topic IDs this project uses
  skillLevel    Int      @default(1) // 1-5

  // Progress
  status      ProjectStatus @default(PLANNED)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relationships
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, status])
}

enum ProjectStatus {
  PLANNED
  IN_PROGRESS
  COMPLETED
}

// ============================================================================
// ANALYTICS & TRACKING
// ============================================================================

model LearningAnalytics {
  id     String   @id @default(cuid())
  userId String
  date   DateTime @default(now())

  // Daily metrics
  questionsAnswered Int @default(0)
  questionsCorrect  Int @default(0)
  conceptsMastered  Int @default(0)
  reviewsCompleted  Int @default(0)
  timeSpent         Int @default(0) // Minutes
  xpEarned          Int @default(0) // XP earned today

  // Streaks
  currentStreak Int @default(0)
  longestStreak Int @default(0)

  @@unique([userId, date])
  @@index([userId, date])
}

// ============================================================================
// GAMIFICATION
// ============================================================================

model UserProgress {
  id     String @id @default(cuid())
  userId String @unique

  // XP and Level
  totalXP      Int @default(0)
  currentLevel Int @default(1) // 1-10

  // Streaks
  currentStreak    Int      @default(0)
  longestStreak    Int      @default(0)
  lastActivityDate DateTime @default(now())
  streakFreezes    Int      @default(0) // Earned streak freezes available

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Badge {
  id          String   @id @default(cuid())
  userId      String
  badgeType   String   // "first_blood", "bookworm", "on_fire_7", etc.
  earnedAt    DateTime @default(now())

  // Badge metadata
  name        String   // "First Blood"
  description String   // "Answer your first question correctly"
  icon        String   // "🎯"

  @@unique([userId, badgeType])
  @@index([userId])
}

// Badge types (for reference, not stored in DB):
// Learning Milestones: first_blood, bookworm, on_fire_7, on_fire_30, centurion_100
// Mastery: white_belt_1, yellow_belt_5, green_belt_10, black_belt_25
// Skill-Specific: rustacean, communicator, architect
// Challenge: no_hints_subtopic, perfectionist, feynman_master_10

// ============================================================================
// CONFIGURATION
// ============================================================================

model UserPreferences {
  id     String @id @default(cuid())
  userId String @unique

  // Learning preferences
  dailyGoal            Int     @default(30)   // Minutes per day
  reviewFrequency      String  @default("daily") // daily, weekly
  difficultyPreference Int     @default(3)    // 1-5
  masteryThreshold     Int     @default(80)   // 50, 70, 80, 90, or 100 - when is topic "mastered"

  // AI Model preferences (user-configurable)
  aiProvider     String  @default("anthropic") // "anthropic" | "openai"
  preferredModel String? // null = use task-based defaults, or override like "claude-opus"

  // UI preferences
  theme             String  @default("dark")
  personalityLevel  String  @default("full") // full, balanced, minimal

  // Notifications (In-App Only - no email/push)
  reviewReminders   Boolean @default(true)  // Show review badge in UI
  achievementAlerts Boolean @default(true)  // Show celebration modals

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ============================================================================
// CONTENT CACHING (Core explanations cached, examples fresh)
// ============================================================================

model ConceptCache {
  id        String   @id @default(cuid())
  conceptId String   @unique

  // Cached content (stable explanations)
  coreExplanation      String   @db.Text
  keyPoints            String[] // Essential facts
  commonMisconceptions String[] // What learners often get wrong
  prerequisites        String[] // Required prior knowledge

  // Cache metadata
  cacheVersion Int      @default(1)  // Increment on curriculum updates
  cachedAt     DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([conceptId])
}
```

## Indexes Strategy

**High-Priority Indexes (Query Performance):**
```prisma
// User queries
@@index([username])                     // Login lookup

// Topic queries
@@index([userId, status])               // Active topics for user
@@index([userId, name])                 // Topic search

// Subtopic queries
@@index([topicId, order])               // Sequential loading

// Concept queries
@@index([subtopicId, isMastered])       // Progress tracking

// Question queries
@@index([conceptId, difficulty])        // Adaptive questioning

// Answer queries
@@index([userId, questionId])           // Answer lookup
@@index([sessionId])                    // Session answers

// Review queries (CRITICAL)
@@index([userId, nextReview, status])   // Due reviews
@@index([userId, status])               // Review dashboard

// Resource queries
@@index([topicId, type])                // Resource filtering

// Session queries
@@index([userId, isActive])             // Active sessions
@@index([sessionId, createdAt])         // Message history
```

## Data Flow Examples

### 1. Starting a New Topic

```sql
-- 1. Create topic
INSERT INTO Topic (userId, name, status)
VALUES ('user123', 'Rust', 'ACTIVE');

-- 2. Create subtopics (in order)
INSERT INTO Subtopic (topicId, name, order, isLocked)
VALUES
  ('topic456', 'Ownership', 1, false),  -- First subtopic unlocked
  ('topic456', 'Borrowing', 2, true),   -- Locked
  ('topic456', 'Lifetimes', 3, true);   -- Locked

-- 3. Create learning session
INSERT INTO LearningSession (userId, topicId, currentSubtopicId)
VALUES ('user123', 'topic456', 'subtopic789');

-- 4. Generate initial questions for first concept
INSERT INTO Question (conceptId, text, type, difficulty)
VALUES ('concept001', 'What is a memory address?', 'RECALL', 1);
```

### 2. Answering a Question

```sql
-- 1. Record answer
INSERT INTO Answer (questionId, userId, sessionId, text, isCorrect, depth)
VALUES ('q123', 'user123', 'session456', 'Memory address is...', true, 'DEEP');

-- 2. Update concept mastery (if all questions correct)
UPDATE Concept
SET isMastered = true, masteredAt = NOW()
WHERE id = 'concept001';

-- 3. Update subtopic mastery
UPDATE Subtopic
SET masteryPercentage =
  (SELECT (COUNT(*) FILTER (WHERE isMastered) * 100.0 / COUNT(*))
   FROM Concept WHERE subtopicId = 'subtopic789')
WHERE id = 'subtopic789';

-- 4. Update topic mastery
UPDATE Topic
SET masteryPercentage =
  (SELECT AVG(masteryPercentage) FROM Subtopic WHERE topicId = 'topic456')
WHERE id = 'topic456';

-- 5. Unlock next subtopic (if current is completed)
UPDATE Subtopic
SET isLocked = false
WHERE topicId = 'topic456'
  AND order = (SELECT order + 1 FROM Subtopic WHERE id = 'subtopic789');
```

### 3. Scheduling a Review (Using ts-fsrs)

```typescript
import { fsrs, createEmptyCard, Rating } from 'ts-fsrs';

// 1. Create new review card
const f = fsrs();
const card = createEmptyCard();

// Insert into database
await prisma.review.create({
  data: {
    userId: 'user123',
    topicId: 'topic456',
    subtopicId: 'subtopic789',
    type: 'SUBTOPIC',
    nextReview: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    state: card.state,
  }
});

// 2. Later: Record review result
const schedulingCards = f.repeat(card, new Date());
const nextCard = schedulingCards[Rating.Good].card; // User rated "Good"

await prisma.review.update({
  where: { id: 'review123' },
  data: {
    lastReviewed: new Date(),
    lastRating: Rating.Good,
    nextReview: nextCard.due,
    stability: nextCard.stability,
    difficulty: nextCard.difficulty,
    reps: nextCard.reps,
    lapses: nextCard.lapses,
    state: nextCard.state,
    status: nextCard.state === 2 ? 'GRADUATED' : 'LEARNING', // State 2 = Review
  }
});
```

## Calculated Fields (Not Stored)

These are computed on-demand:

```typescript
// Mastery percentage (recalculated on answer submission)
const topicMastery = await prisma.topic.findUnique({
  where: { id },
  include: { subtopics: { include: { concepts: true } } }
});

const mastery = calculateMastery(topicMastery);

// Review streak
const streak = await prisma.learningAnalytics.aggregate({
  where: { userId, reviewsCompleted: { gt: 0 } },
  _count: true,
  orderBy: { date: 'desc' }
});

// Questions answered today
const todayStats = await prisma.answer.aggregate({
  where: {
    userId,
    createdAt: { gte: startOfDay(new Date()) }
  },
  _count: true
});
```

## Database Migrations

**Initial Migration:**
```bash
npx prisma migrate dev --name init
```

**After Schema Changes:**
```bash
npx prisma migrate dev --name add_codebase_analysis
```

**Production:**
```bash
npx prisma migrate deploy
```

## Seeding (Development & Visitor Mode)

**Seed Script:** `prisma/seed.ts`

```typescript
async function seed() {
  // 1. Create owner user
  const owner = await prisma.user.create({
    data: {
      username: 'vishesh',
      password: await bcrypt.hash(process.env.SEED_PASSWORD!, 10),
      isOwner: true,
    }
  });

  // 2. Create sample topics for visitor mode
  const rustTopic = await prisma.topic.create({
    data: {
      userId: owner.id,
      name: 'Rust',
      status: 'ACTIVE',
      masteryPercentage: 75,
      subtopics: {
        create: [
          {
            name: 'Ownership',
            order: 1,
            isLocked: false,
            masteryPercentage: 100,
            concepts: {
              create: [
                {
                  name: 'Memory Addresses',
                  explanation: '...',
                  isMastered: true,
                  questions: {
                    create: [
                      {
                        text: 'What is a memory address?',
                        type: 'RECALL',
                        difficulty: 1,
                        expectedElements: ['location', 'memory', 'pointer'],
                        hints: ['Think about how programs find data...']
                      }
                    ]
                  }
                }
              ]
            }
          }
        ]
      }
    }
  });

  // 3. Create sample answers
  // 4. Create reviews
  // 5. Create analytics
}
```

## Database Size Estimates

**Single User (1 Year):**
- Topics: ~10 (1 KB) = 10 KB
- Subtopics: ~50 (2 KB) = 100 KB
- Concepts: ~200 (5 KB) = 1 MB
- Questions: ~1,000 (3 KB) = 3 MB
- Answers: ~5,000 (2 KB) = 10 MB
- Messages: ~10,000 (1 KB) = 10 MB
- Reviews: ~500 (1 KB) = 500 KB
- **Total: ~25 MB per user per year**

**Neon Free Tier:** 500 MB (supports ~20 users)

## Backup & Recovery

**Neon Automatic Backups:**
- Point-in-time recovery (7 days on free tier)
- Manual backups via `pg_dump`

**Backup Command:**
```bash
pg_dump $DATABASE_URL_UNPOOLED > backup.sql
```

**Restore Command:**
```bash
psql $DATABASE_URL_UNPOOLED < backup.sql
```

---

**Next Steps:**
1. Implement Prisma schema
2. Create migration
3. Seed database for development
4. Build typed DB query layer (lib/db/)
5. Test queries with realistic data volume

**Last Updated:** 2026-01-04
