# Sensie Architecture

## Technology Stack

### Core Framework
- **Next.js 15+** (App Router, React Server Components)
- **React 19**
- **TypeScript 5.7+**

### AI & Agents
- **Mastra 0.20+** - AI agent framework (same as Jack)
- **Vercel AI SDK 4.x** - LLM integration layer
- **Vercel AI Gateway** - Gateway for cost tracking, caching, and runtime model switching
- **Langfuse** - LLM observability and tracing

### LLM Model Strategy

**Default Models (User-Configurable):**

| Task | Default Model | Rationale |
|------|---------------|-----------|
| Teaching & Explanations | Claude Sonnet | Best quality without Opus cost |
| Question Generation | Claude Sonnet | Needs nuanced understanding |
| Answer Evaluation | Claude Sonnet | Critical for accurate feedback |
| Subtopic Suggestions | Claude Haiku | Simpler task, cost-effective |
| Hint Generation | Claude Haiku | Straightforward task |
| Gap Detection | Claude Sonnet | Requires deep analysis |

**Multi-Provider Support:**
- Anthropic (Claude Sonnet, Haiku, Opus)
- OpenAI (GPT-4o, GPT-4o-mini)
- User selects provider + model in Settings
- AI Gateway with Mastra enables runtime model switching

**Implementation:**
```typescript
// lib/ai/model-selector.ts
type TaskType = "teaching" | "question" | "evaluation" | "hint" | "simple";

function getModelForTask(task: TaskType, userPrefs: UserPreferences): Model {
  const provider = userPrefs.aiProvider; // "anthropic" | "openai"

  // User override - use their preferred model for everything
  if (userPrefs.preferredModel) {
    return getModel(provider, userPrefs.preferredModel);
  }

  // Default task-based selection
  const isSimpleTask = task === "hint" || task === "simple";

  if (provider === "anthropic") {
    return isSimpleTask ? "claude-haiku" : "claude-sonnet";
  } else {
    return isSimpleTask ? "gpt-4o-mini" : "gpt-4o";
  }
}
```

### Database & ORM
- **PostgreSQL** (Neon for production, Docker for local dev)
- **Prisma 6+** - Type-safe ORM with migrations
- **Neon Database** - Serverless Postgres (free tier compatible)

### UI & Styling
- **TailwindCSS 4** - Utility-first CSS
- **shadcn/ui** - Component library (radix-ui primitives)
- **Framer Motion** - Animations for progress visualizations

### Code Analysis
- **Claude Code Explore Agent** (via Task tool) - For codebase analysis when learning from repos
- **Tree-sitter** (future) - For advanced code parsing

### Authentication
- **Passphrase-based auth** (same as Jack)
- **bcrypt** - Password hashing
- **iron-session** - Encrypted session cookies

### Deployment
- **Vercel** - Hosting (free tier compatible)
- **GitHub Actions** - CI/CD for tests
- **Neon Database** - Production database

### Development Tools
- **Vitest** - Unit and integration testing
- **ESLint** - Code linting
- **Prettier** - Code formatting

## System Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      USER INTERFACE                          │
│  (Next.js App Router, React Server Components)              │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Chat View   │  │ Progress View│  │ Commands Bar │      │
│  │  (Hybrid)    │  │ (Dashboard)  │  │ (/progress)  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
└─────────┼──────────────────┼──────────────────┼──────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      API ROUTES (App Router)                 │
│                                                              │
│  /api/chat/message    - Send message, get Sensie response   │
│  /api/topics          - CRUD for learning topics            │
│  /api/topics/[id]/start - Start learning a topic            │
│  /api/progress        - Get progress for topic              │
│  /api/questions       - Generate/answer questions           │
│  /api/review          - Spaced repetition reviews           │
│  /api/quiz            - Quiz generation and scoring         │
│  /api/codebase        - Analyze repository for learning     │
│  /api/auth            - Login, signup, visitor mode         │
│  /api/cron            - Scheduled jobs (review reminders)   │
│                                                              │
└─────────┬───────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                     BUSINESS LOGIC LAYER                     │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │             MASTRA AGENTS                              │ │
│  │                                                        │ │
│  │  ┌──────────────────┐  ┌──────────────────┐          │ │
│  │  │  Sensie Agent    │  │  Question Agent  │          │ │
│  │  │  (Main Teacher)  │  │  (Generates Qs)  │          │ │
│  │  └────────┬─────────┘  └────────┬─────────┘          │ │
│  │           │                      │                     │ │
│  │           │  ┌───────────────────┴───────────────┐    │ │
│  │           │  │  Socratic Engine                  │    │ │
│  │           │  │  (Guides through questions)       │    │ │
│  │           │  └───────────────┬───────────────────┘    │ │
│  │           │                  │                         │ │
│  │           └──────────────────┘                         │ │
│  │                      │                                 │ │
│  └──────────────────────┼─────────────────────────────────┘ │
│                         │                                   │
│  ┌──────────────────────┼─────────────────────────────────┐ │
│  │  LEARNING ENGINE                                       │ │
│  │                      │                                 │ │
│  │  ┌──────────────┐   ▼   ┌──────────────┐             │ │
│  │  │   Spaced     │ Context │ Difficulty   │            │ │
│  │  │  Repetition  │ Builder │  Adjuster    │            │ │
│  │  └──────────────┘       └──────────────┘             │ │
│  │                                                        │ │
│  │  ┌──────────────┐       ┌──────────────┐             │ │
│  │  │  Gap         │       │  Progress     │            │ │
│  │  │  Detector    │       │  Tracker      │            │ │
│  │  └──────────────┘       └──────────────┘             │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  CONTENT PROVIDERS                                     │ │
│  │                                                        │ │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │ │
│  │  │  LLM Lessons │ │ Web Scraper  │ │  Codebase    │  │ │
│  │  │  Generator   │ │ (Articles)   │ │  Analyzer    │  │ │
│  │  └──────────────┘ └──────────────┘ └──────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────┬────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                      DATA LAYER                              │
│                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │  Prisma ORM    │  │  PostgreSQL    │  │  Langfuse    │  │
│  │  (Type-safe)   │  │  (Neon DB)     │  │  (Traces)    │  │
│  └────────────────┘  └────────────────┘  └──────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Database Schema Overview

See `DATABASE_SCHEMA.md` for detailed schema. High-level entities:

### Core Entities
- **User** - Owner or visitor
- **Topic** - Learning topic (e.g., "Rust", "System Design")
- **Subtopic** - Hierarchical breakdown (e.g., "Ownership" under "Rust")
- **Question** - Socratic questions for testing understanding
- **Answer** - User answers to questions
- **Concept** - Core concepts within subtopics
- **Review** - Spaced repetition review sessions
- **Mastery** - Progress tracking per topic/subtopic

### Supporting Entities
- **LearningResource** - Web articles, docs, videos
- **CodebaseAnalysis** - Cached analysis of repositories
- **Project** - User's projects (for project-based learning)
- **LearningSession** - Chat sessions focused on current topic

### Session Persistence

**Principle:** Resume exactly where you left off - same question, same context.

When user closes browser mid-session, we persist:
```typescript
interface SessionState {
  topicId: string;
  subtopicId: string;
  conceptId: string;

  // Exact position
  currentQuestionId: string;
  currentQuestionAttempts: number;
  hintsUsed: number;

  // Context for resumption
  lastMessageId: string;
  // Note: Full conversation history is persisted, not just a summary
}
```

**LLM Context Window Strategy:**

All conversation history is persisted to the database, but for LLM calls we use a sliding window:

```typescript
const LLM_CONTEXT_WINDOW_SIZE = 15; // Last 15 messages

async function getLLMContext(sessionId: string, topicId: string): Promise<Message[]> {
  // Only fetch messages for the current topic (avoid context pollution)
  const messages = await prisma.message.findMany({
    where: {
      sessionId,
      // Topic-scoped to avoid mixing contexts
    },
    orderBy: { createdAt: 'desc' },
    take: LLM_CONTEXT_WINDOW_SIZE
  });

  return messages.reverse(); // Chronological order for LLM
}
```

**Key Decisions:**
- **All history persisted**: User can scroll back through entire conversation
- **Sliding window for LLM**: Only last 15 messages sent to LLM to prevent hallucinations
- **Topic-scoped context**: Messages from other topics not included in LLM context
- **No draft answers**: Incomplete/unsent answers are not saved
- **Concurrent sessions allowed**: Multiple browser tabs work independently, sync on refresh

**Resume Flow:**
```
User returns after closing browser
  ↓
Load SessionState from database
  ↓
Sensie: "Welcome back, apprentice! We were working on [concept].
        Let me remind you where we left off..."
  ↓
Show brief recap (last 2-3 messages)
  ↓
Re-ask the exact question they were on
  ↓
Continue as if no interruption
```

**Implementation:**
```typescript
// Save on every message/answer
async function saveSessionState(session: LearningSession) {
  await prisma.learningSession.update({
    where: { id: session.id },
    data: {
      currentQuestionId: session.currentQuestion.id,
      currentAttempts: session.attempts,
      hintsUsed: session.hintsUsed,
      lastActivity: new Date()
    }
  });
}

// Resume on page load
async function resumeSession(userId: string): Promise<ResumeContext> {
  const session = await prisma.learningSession.findFirst({
    where: { userId, isActive: true },
    include: { messages: { take: 3, orderBy: { createdAt: 'desc' } } }
  });

  if (!session) return null;

  return {
    session,
    resumeMessage: buildResumeMessage(session),
    currentQuestion: await getQuestion(session.currentQuestionId)
  };
}
```

### Relationships
```
User (1) ──> (N) Topic
Topic (1) ──> (N) Subtopic
Subtopic (1) ──> (N) Concept
Concept (1) ──> (N) Question
Question (1) ──> (N) Answer
Topic (1) ──> (N) Review
Topic (1) ──> (1) Mastery
```

## Mastra Agent Architecture

### 1. Sensie Agent (Main Teacher)

**File:** `lib/mastra/sensie-agent.ts`

**Purpose:** Primary teaching agent, orchestrates learning flow

**Functions:**
```typescript
teachConcept(conceptId: string): Promise<{
  explanation: string;
  examples: CodeExample[];
  analogies: string[];
}>

askSocraticQuestion(context: SocraticContext): Promise<{
  question: string;
  expectedAnswerElements: string[];
  hints: string[];
}>

evaluateAnswer(answer: string, question: Question): Promise<{
  isCorrect: boolean;
  feedback: string;
  followUpQuestion?: string;
  gapDetected?: string; // If foundational gap found
}>

suggestNextConcept(topicId: string, userId: string): Promise<{
  nextConceptId: string;
  reasoning: string;
}>
```

**Prompts:** See `lib/mastra/prompts/sensie-prompts.ts`

### 2. Question Generator Agent

**File:** `lib/mastra/question-agent.ts`

**Purpose:** Generates Socratic questions based on concept and user level

**Question Generation Strategy (Hybrid Approach):**

```typescript
const INITIAL_BATCH_SIZE = 4;
const QUESTIONS_PER_SUBTOPIC = 10;

async function generateQuestionsForSubtopic(
  subtopic: Subtopic,
  userLevel: number
): Promise<Question[]> {
  // 1. Generate initial batch of 3-4 questions upfront
  const initialQuestions = await generateBatch(subtopic, INITIAL_BATCH_SIZE, userLevel);

  // 2. Remaining questions generated adaptively based on:
  //    - Which concepts user struggled with
  //    - Answer patterns (shallow vs deep understanding)
  //    - Difficulty adjustments needed

  return initialQuestions;
}

async function generateAdaptiveQuestion(
  subtopic: Subtopic,
  previousAnswers: Answer[],
  userLevel: number
): Promise<Question> {
  // Analyze where user is struggling
  const weakAreas = analyzeWeakAreas(previousAnswers);

  // Generate targeted question for weak areas
  return await generateTargetedQuestion(subtopic, weakAreas, userLevel);
}
```

**Why Hybrid:**
- Initial batch provides immediate questions (no latency)
- Adaptive questions target actual gaps (personalized learning)
- Balance between efficiency and personalization

**Functions:**
```typescript
generateQuestions(concept: Concept, difficulty: number): Promise<Question[]>

generateFollowUp(
  originalQuestion: Question,
  userAnswer: string
): Promise<Question>

generateQuiz(topicId: string, questionCount: number): Promise<Quiz>
```

### 3. Codebase Analyzer (Specialized)

**File:** `lib/mastra/codebase-agent.ts`

**Purpose:** Analyzes repositories to teach by example

**Functions:**
```typescript
analyzeRepository(repoUrl: string, learningGoal: string): Promise<{
  keyFiles: string[];
  patterns: string[];
  teachingPath: TeachingPath;
}>

explainCodeSnippet(
  code: string,
  context: string,
  userLevel: number
): Promise<{
  explanation: string;
  keyConcepts: string[];
  relatedTopics: string[];
}>
```

**Implementation:** Uses Task tool with Explore agent for efficient codebase exploration

## Learning Engine Components

### 1. Socratic Engine

**File:** `lib/learning/socratic-engine.ts`

**Purpose:** Implements Socratic method questioning flow

**Algorithm:**
```typescript
class SocraticEngine {
  async conductDialogue(
    concept: Concept,
    user: User
  ): Promise<SocraticSession> {
    // 1. Ask initial question
    const question = await this.generateInitialQuestion(concept);

    // 2. Loop: answer → evaluate → follow-up
    while (!session.conceptMastered) {
      const answer = await this.getUserAnswer();
      const evaluation = await this.evaluateAnswer(answer, question);

      if (evaluation.isCorrect) {
        // Ask deeper question
        question = await this.generateDeeperQuestion(concept, session);
      } else {
        // Detect gap, ask guiding question
        const gap = await this.detectGap(answer, concept);
        question = await this.generateGuidingQuestion(gap);
      }
    }

    return session;
  }
}
```

### 2. Spaced Repetition Scheduler

**File:** `lib/learning/spaced-repetition.ts`

**Purpose:** Implements spaced repetition using the FSRS algorithm via `ts-fsrs` library

**Library:** `ts-fsrs` (npm package) - Modern spaced repetition algorithm used by Anki

**Why FSRS over SM-2:**
- More accurate retention predictions
- Better handling of varying difficulty
- Active development and maintenance
- Used by Anki (industry standard)

**Implementation:**
```typescript
import { fsrs, createEmptyCard, Rating } from 'ts-fsrs';

class SpacedRepetitionScheduler {
  private f = fsrs(); // Initialize with default parameters

  scheduleReview(card: Card, rating: Rating): Card {
    const schedulingCards = this.f.repeat(card, new Date());
    return schedulingCards[rating].card;
  }

  getReviewsDue(userId: string): Promise<Review[]> {
    // Fetch all items where card.due <= now
    // Order by: oldest due first (FSRS default)
  }
}

// Rating scale:
// Rating.Again (1) - Complete failure
// Rating.Hard (2) - Recalled with difficulty
// Rating.Good (3) - Recalled correctly
// Rating.Easy (4) - Recalled instantly
```

**Review Prioritization:** Oldest due first (per FSRS algorithm)

### 3. Difficulty Adjuster

**File:** `lib/learning/difficulty-adjuster.ts`

**Purpose:** Adapts question difficulty based on user performance

**Algorithm:**
```typescript
class DifficultyAdjuster {
  adjustDifficulty(
    currentDifficulty: number,
    recentAnswers: Answer[]
  ): number {
    // Calculate accuracy rate from recent answers
    const accuracyRate = this.calculateAccuracy(recentAnswers);

    // Adjust difficulty:
    // 80%+ accuracy → increase difficulty
    // 50-80% accuracy → maintain difficulty
    // <50% accuracy → decrease difficulty

    return newDifficulty;
  }
}
```

**Difficulty Levels:**
- Level 1: Basic recall questions
- Level 2: Understanding questions (why/how)
- Level 3: Application questions (use in new context)
- Level 4: Analysis questions (compare/contrast)
- Level 5: Synthesis questions (combine concepts)

### 4. Gap Detector

**File:** `lib/learning/gap-detector.ts`

**Purpose:** Identifies foundational knowledge gaps

**Algorithm:**
```typescript
class GapDetector {
  async detectGaps(
    incorrectAnswers: Answer[],
    concept: Concept
  ): Promise<Concept[]> {
    // Analyze incorrect answers
    // Identify which foundational concepts are missing
    // Use LLM to understand misconceptions

    return prerequisiteConcepts;
  }
}
```

### 5. Progress Tracker

**File:** `lib/learning/progress-tracker.ts`

**Purpose:** Calculates and updates mastery levels

**Mastery Calculation:**
```typescript
class ProgressTracker {
  calculateMastery(topicId: string, userId: string): Promise<number> {
    // Factors:
    // 1. Questions answered correctly (60% weight)
    // 2. Concepts completed (20% weight)
    // 3. Review performance (10% weight)
    // 4. Time since last activity (10% weight, decay factor)

    return masteryPercentage; // 0-100
  }
}
```

### 6. Learning Path Generator

**File:** `lib/learning/learning-path-generator.ts`

**Purpose:** Creates learning path when user starts a new topic (Sensie controls, user trusts)

**Design Principle:** Users can't judge what to skip - they don't yet understand the topic. A student learning "Giving Feedback" doesn't know if "Active Listening" is skippable. Trust the sensei.

**Flow:**
```typescript
class LearningPathGenerator {
  async generatePath(
    topicName: string,
    userGoal?: string // For tailoring examples, not skipping content
  ): Promise<LearningPath> {
    // 1. Identify domain (technical, soft-skills, career)
    // 2. Generate subtopic hierarchy with LLM
    // 3. Order by prerequisites
    // 4. Return path (view-only, no user edits)
  }

  async createTopicFromPath(path: LearningPath, userId: string): Promise<Topic> {
    // Create Topic/Subtopic records
    // Path is finalized - no modifications allowed
    // User goal stored for example tailoring only
  }
}
```

**Supported Domains:**
- Technical: Programming, system design, DevOps
- Soft Skills: Communication, teamwork, leadership, emotional intelligence
- Career: Interviewing, negotiation, portfolio building

## Content Caching Strategy

**Principle:** "Core content cached, examples/analogies fresh per session"

### Cached vs Fresh Content

| Content Type | Cached? | Reason |
|--------------|---------|--------|
| Core explanations | Yes | Stable, reduces costs |
| Key points | Yes | Rarely change |
| Common misconceptions | Yes | Curated knowledge |
| Code examples | No | Variety aids learning |
| Analogies | No | Fresh connections each session |
| Questions | No | Prevent memorization |
| Difficulty adjustments | No | User-specific |

### Implementation

**File:** `lib/learning/content-cache.ts`

```typescript
class ContentCache {
  // Database-backed cache for explanations
  async getOrCreate(conceptId: string): Promise<CachedContent> {
    const cached = await prisma.conceptCache.findUnique({
      where: { conceptId }
    });

    if (cached && !this.isStale(cached)) {
      return cached;
    }

    // Generate and cache
    const fresh = await this.generateWithLLM(conceptId);
    await prisma.conceptCache.upsert({
      where: { conceptId },
      create: { conceptId, ...fresh, cachedAt: new Date() },
      update: { ...fresh, cachedAt: new Date() }
    });

    return fresh;
  }

  private isStale(cached: CachedContent): boolean {
    return daysSince(cached.cachedAt) > 30;
  }
}
```

### Cache Invalidation Triggers

1. **Manual:** User requests "refresh explanation"
2. **Time-based:** Cache older than 30 days
3. **Quality-based:** Low question accuracy for concept
4. **Version-based:** Curriculum update increments version

## API Design

### Chat API

**POST /api/chat/message**
```typescript
Request:
{
  message: string;
  sessionId?: string; // Current learning session
  topicId?: string; // Active topic
}

Response:
{
  response: string; // Sensie's response
  sessionId: string;
  nextAction?: {
    type: "question" | "concept" | "quiz";
    data: any;
  };
}
```

### Topics API

**GET /api/topics**
```typescript
Response:
{
  topics: {
    id: string;
    name: string;
    status: "active" | "completed" | "queued";
    mastery: number; // 0-100
    subtopics: {
      id: string;
      name: string;
      mastery: number;
      locked: boolean;
    }[];
  }[];
}
```

**POST /api/topics/[id]/start**
```typescript
Request:
{
  topicId: string;
  learningGoal?: string;
}

Response:
{
  sessionId: string;
  initialMessage: string; // Sensie's intro
  firstQuestion?: Question;
}
```

### Questions API

**POST /api/questions/answer**
```typescript
Request:
{
  questionId: string;
  answer: string;
  sessionId: string;
}

Response:
{
  isCorrect: boolean;
  feedback: string;
  followUpQuestion?: Question;
  gapDetected?: {
    conceptId: string;
    conceptName: string;
    message: string;
  };
  masteryUpdate?: {
    topicId: string;
    newMastery: number;
  };
}
```

### Progress API

**GET /api/progress?topicId={id}**
```typescript
Response:
{
  topic: string;
  mastery: number;
  subtopics: {
    name: string;
    mastery: number;
    conceptsCompleted: number;
    totalConcepts: number;
  }[];
  nextReview?: Date;
  questionsAnswered: number;
  questionsCorrect: number;
}
```

### Review API

**GET /api/review/due**
```typescript
Response:
{
  reviews: {
    topicId: string;
    topicName: string;
    subtopicId?: string;
    subtopicName?: string;
    dueDate: Date;
    lastReviewed: Date;
  }[];
}
```

**POST /api/review/start**
```typescript
Request:
{
  reviewIds: string[]; // Multiple reviews in one session
}

Response:
{
  sessionId: string;
  questions: Question[];
  totalQuestions: number;
}
```

### Codebase API

**POST /api/codebase/analyze**
```typescript
Request:
{
  repoUrl: string;
  learningGoal: string; // "Learn async patterns in Tokio"
}

Response:
{
  analysisId: string;
  status: "analyzing" | "complete";
  teachingPath?: {
    steps: {
      file: string;
      concept: string;
      order: number;
    }[];
  };
}
```

## File Structure

```
packages/sensie/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── signup/
│   ├── (main)/
│   │   ├── chat/              # Main chat interface
│   │   ├── progress/          # Progress dashboard
│   │   ├── topics/            # Topics overview
│   │   └── review/            # Review sessions
│   ├── api/
│   │   ├── auth/
│   │   ├── chat/
│   │   ├── topics/
│   │   ├── questions/
│   │   ├── progress/
│   │   ├── review/
│   │   ├── quiz/
│   │   ├── codebase/
│   │   └── cron/
│   ├── layout.tsx
│   └── page.tsx               # Landing/home
├── lib/
│   ├── mastra/
│   │   ├── sensie-agent.ts    # Main teacher agent
│   │   ├── question-agent.ts  # Question generator
│   │   ├── codebase-agent.ts  # Codebase analyzer
│   │   ├── prompts/
│   │   │   ├── sensie-prompts.ts
│   │   │   ├── question-prompts.ts
│   │   │   └── socratic-prompts.ts
│   │   └── schemas.ts         # Zod schemas for structured output
│   ├── learning/
│   │   ├── socratic-engine.ts
│   │   ├── spaced-repetition.ts
│   │   ├── difficulty-adjuster.ts
│   │   ├── gap-detector.ts
│   │   └── progress-tracker.ts
│   ├── db/
│   │   ├── client.ts
│   │   ├── users.ts
│   │   ├── topics.ts
│   │   ├── subtopics.ts
│   │   ├── concepts.ts
│   │   ├── questions.ts
│   │   ├── answers.ts
│   │   ├── reviews.ts
│   │   ├── mastery.ts
│   │   └── sessions.ts
│   ├── personality/
│   │   ├── constants.ts       # All personality strings
│   │   └── utils.ts           # Helper functions
│   ├── auth/
│   │   ├── passphrase.ts
│   │   └── session.ts
│   └── observability/
│       └── langfuse.ts
├── components/
│   ├── chat/
│   │   ├── chat-interface.tsx
│   │   ├── message-list.tsx
│   │   ├── input-area.tsx
│   │   └── command-palette.tsx
│   ├── progress/
│   │   ├── progress-tree.tsx
│   │   ├── mastery-gauge.tsx
│   │   └── review-calendar.tsx
│   ├── topics/
│   │   ├── topic-card.tsx
│   │   └── topic-list.tsx
│   └── ui/                    # shadcn components
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── __tests__/
│   ├── unit/
│   └── integration/
├── specs/                     # This directory
│   ├── OVERVIEW.md
│   ├── PERSONALITY.md
│   ├── ARCHITECTURE.md        # This file
│   ├── LEARNING_ENGINE.md
│   ├── UI_UX.md
│   ├── DATABASE_SCHEMA.md
│   ├── FEATURES.md
│   └── CROSS_AGENT_INTEGRATION.md
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── README.md
```

## Key Dependencies

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",

    "@mastra/core": "^0.20.0",
    "@ai-sdk/openai": "^1.0.0",
    "@ai-sdk/anthropic": "^1.0.0",
    "ai": "^4.0.0",

    "@prisma/client": "^6.0.0",

    "zod": "^3.23.0",
    "bcrypt": "^5.1.1",
    "iron-session": "^8.0.0",

    "ts-fsrs": "^4.0.0",

    "langfuse": "^3.0.0",

    "framer-motion": "^11.0.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^19.0.0",
    "typescript": "^5.7.0",

    "prisma": "^6.0.0",

    "vitest": "^2.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "happy-dom": "^12.0.0",

    "eslint": "^8.0.0",
    "eslint-config-next": "^15.0.0",
    "prettier": "^3.0.0",

    "tailwindcss": "^4.0.0",
    "postcss": "^8.0.0",
    "autoprefixer": "^10.0.0"
  }
}
```

## Environment Variables

```bash
# Database
DATABASE_URL="postgresql://..."              # Neon pooled connection
DATABASE_URL_UNPOOLED="postgresql://..."     # Direct connection for migrations

# AI
AI_GATEWAY_API_KEY="..."                     # Vercel AI Gateway (optional)
OPENAI_API_KEY="..."                         # Fallback if no gateway
LANGFUSE_SECRET_KEY="..."                    # LLM observability
LANGFUSE_PUBLIC_KEY="..."
LANGFUSE_BASE_URL="https://cloud.langfuse.com"

# Auth
AGENT_PASSPHRASE_HASH="..."                  # bcrypt hash of owner passphrase
ALLOW_SIGNUP="true"                          # Enable/disable signup (auto-disable after owner)

# Cron
CRON_SECRET="..."                            # Authenticate cron jobs

# Optional: Cross-Agent (Future)
OVERSEER_URL="https://my-overseer.vercel.app"
OVERSEER_JWT_SECRET="..."
```

## Observability & Monitoring

### Langfuse Tracing

**Traces for:**
- Concept teaching (input: concept, output: explanation)
- Socratic questioning (input: context, output: question)
- Answer evaluation (input: answer, output: feedback)
- Gap detection (input: wrong answers, output: gaps)
- Difficulty adjustment (input: performance, output: new difficulty)

**Implementation:**
```typescript
import { langfuse } from '@/lib/observability/langfuse';

const trace = langfuse.trace({
  name: 'teach-concept',
  userId: user.id,
  metadata: { conceptId, topicId }
});

const generation = trace.generation({
  name: 'generate-explanation',
  model: 'gpt-4o',
  input: { concept, userLevel },
  output: explanation
});
```

### Error Handling

**LLM Failure Strategy:**
```typescript
const MAX_LLM_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function callLLMWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= MAX_LLM_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === MAX_LLM_RETRIES) {
        throw error; // Show user-facing error after all retries
      }
      await sleep(RETRY_DELAY_MS * attempt); // Exponential backoff
    }
  }
}
```

**Error Handling Principles:**
- **Retry silently**: Up to 3 retries before showing error to user
- **Stay in character**: All user-facing errors use Sensie personality
- **Include debug info**: Collapsible technical details for troubleshooting
- **Graceful degradation**: If LLM unavailable, show cached content where possible

**API Error Handling:**
- API routes use try/catch with proper status codes
- Database errors logged with context
- LLM failures have fallback responses after retries exhausted
- User-facing errors use Sensie personality (see UI_UX.md for error message templates)

## Performance Considerations

### Database Queries
- Use Prisma's `include` judiciously (avoid N+1)
- Index frequently queried fields (userId, topicId, status)
- Cache mastery calculations (recompute only on answer submission)

### LLM Calls
- Cache common explanations (concept explanations don't change often)
- Use streaming for long responses
- Prefer smaller models for simple tasks (question generation)
- Use AI Gateway for cost tracking

### Codebase Analysis
- Cache analyzed repositories (store in DB)
- Use Task tool with Explore agent (efficient)
- Limit analysis depth (key files only, not entire repo)

## Security

### Authentication
- Passphrase-based (bcrypt hashed)
- HTTP-only session cookies (iron-session)
- CSRF protection via SameSite cookies

### Data Protection
- User data isolated by userId
- Visitor mode uses separate queries (no PII)
- Database uses Row Level Security policies (future with Neon)

### API Protection
- Rate limiting on expensive endpoints (codebase analysis)
- CRON_SECRET for scheduled jobs
- Input validation with Zod schemas

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      VERCEL (Edge Network)                   │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Next.js App (Serverless Functions)                    │ │
│  │  - API Routes (auto-scaled)                            │ │
│  │  - React Server Components                             │ │
│  │  - Static assets (CDN)                                 │ │
│  └────────┬───────────────────────────────────────────────┘ │
│           │                                                  │
└───────────┼──────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│              NEON DATABASE (Serverless Postgres)             │
│  - Auto-scaling                                              │
│  - Connection pooling                                        │
│  - Free tier: 0.5 GB storage                                │
└──────────────────────────────────────────────────────────────┘
```

---

**Next Steps:**
1. Review architecture for feedback
2. Design detailed database schema
3. Implement learning engine algorithms
4. Build Mastra agents
5. Create UI components

**Last Updated:** 2026-01-04
