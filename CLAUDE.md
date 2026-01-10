# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Overview

Sensie is an AI-powered learning agent that teaches through Socratic questioning. It has a "Master Roshi" personality - wise, eccentric, demanding but encouraging. Sensie guides users through topics without giving direct answers, instead challenging them to think and demonstrate understanding.

**Core Value Proposition:** Unlike traditional learning tools that give answers, Sensie forces deep understanding through questions, tracks mastery with spaced repetition, and adapts difficulty based on performance.

## Essential Commands

### Development
```bash
pnpm dev                 # Start Next.js dev server (localhost:3000)
pnpm build              # Build for production (includes Prisma generate + migrate)
pnpm start              # Run production build
```

### Database
```bash
pnpm db:generate        # Generate Prisma client
pnpm db:migrate         # Run migrations in dev
pnpm db:push            # Push schema without migration
pnpm db:studio          # Open Prisma Studio
```

### Testing
```bash
pnpm test               # Run all tests once
pnpm test:watch         # Run tests in watch mode
pnpm test:unit          # Run only unit tests (__tests__/unit)
pnpm test:integration   # Run only integration tests (__tests__/integration)
pnpm test:ci            # Run tests with coverage
```

## Architecture

### Core System Flow

1. **Topic Creation** -> User provides topic name + optional goal -> Learning path generated
2. **Socratic Teaching** -> Sensie asks questions about current concept
3. **Answer Evaluation** -> LLM evaluates answer depth (shallow/moderate/deep)
4. **Progress Tracking** -> Mastery % updated based on performance
5. **Spaced Repetition** -> FSRS algorithm schedules reviews
6. **Difficulty Adaptation** -> Questions get harder/easier based on accuracy

### Key Components

#### Learning Engine (`lib/learning/`)
- **socratic-engine.ts**: Core question generation and answer evaluation
- **spaced-repetition.ts**: FSRS algorithm implementation for review scheduling
- **progress-tracker.ts**: Mastery calculation with weighted factors
- **difficulty-adjuster.ts**: Adaptive difficulty based on performance
- **learning-path-generator.ts**: Creates subtopic structure from topic name
- **gap-detector.ts**: Identifies knowledge gaps from wrong answers
- **content-cache.ts**: Caches concept explanations for efficiency

#### Mastra Agents (`lib/mastra/`)
- **sensie-agent.ts**: Main teaching agent with Socratic method
- **question-agent.ts**: Generates questions at appropriate difficulty
- **prompts.ts**: System prompts with Master Roshi personality
- **schemas.ts**: Zod schemas for structured AI outputs
- **context.ts**: Builds context for agents from DB

#### Database Layer (`lib/db/`)
Each file provides typed CRUD operations:
- **users.ts**: User management (owner/visitor)
- **topics.ts**: Learning topics with status tracking
- **subtopics.ts**: Hierarchical breakdown of topics
- **concepts.ts**: Detailed explanations with code examples
- **questions.ts**: Socratic questions storage
- **answers.ts**: User answers with evaluation
- **sessions.ts**: Learning session management
- **reviews.ts**: Spaced repetition items
- **progress.ts**: XP, levels, streaks (skeleton for MVP)

#### Personality (`lib/personality/`)
- **constants.ts**: All Master Roshi phrases and anime references
- **utils.ts**: Helper functions for personality in responses

### Database Schema Key Points

- **User**: Single owner + visitor mode (no full account needed)
- **Topic**: Status enum (QUEUED, ACTIVE, COMPLETED, ARCHIVED), max 3 active
- **Subtopic**: Hierarchical, can be locked until prerequisites done
- **Concept**: Core explanation content with cached examples
- **Question**: Socratic questions with difficulty levels (1-5)
- **Answer**: User responses with depth evaluation
- **Review**: FSRS card fields for spaced repetition
- **LearningSession**: Chat history and state

### Environment Variables

Required in `.env`:
- `DATABASE_URL`: Neon pooled connection
- `DATABASE_URL_UNPOOLED`: Direct connection for migrations
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`: LLM provider
- `SESSION_SECRET`: For iron-session (min 32 chars)
- `LANGFUSE_*`: LLM observability (optional)

## Important Patterns

### The Socratic Method Flow
1. Sensie presents concept context (not full explanation)
2. Asks Socratic question requiring thought
3. User answers in their own words
4. LLM evaluates: correct? shallow/moderate/deep?
5. If wrong -> guiding question to fill gap
6. If shallow -> follow-up for deeper understanding
7. If deep -> celebrate, move to next concept
8. Never give direct answers until user demonstrates understanding

### Topic Limit Enforcement
- Max 3 active topics at once
- Users must complete or archive before starting new
- Prevents shallow learning across too many topics

### Spaced Repetition (FSRS)
- Uses `ts-fsrs` library for FSRS-5 algorithm
- Reviews scheduled based on difficulty and retention
- Max 20 reviews per session to prevent fatigue

### Difficulty Adaptation
- Questions have difficulty 1-5
- Performance tracked over rolling window
- Accuracy > 80% -> increase difficulty
- Accuracy < 50% -> decrease difficulty
- Hint usage penalizes score

### Commands (Slash Commands)
- `/progress` - Show current topic progress
- `/topics` - List all topics
- `/hint` - Get progressive hint (3 levels)
- `/skip` - Skip question (3 max per session)
- `/break` - Save progress and pause
- `/review` - Start spaced repetition review
- `/quiz` - Start quiz on current topic

## Testing Strategy

- Unit tests in `__tests__/unit/`
- Integration tests in `__tests__/integration/`
- Default test runs unit tests only
- Environment: happy-dom
- TDD approach: Write tests before implementation

## Path Aliases

Uses TypeScript path alias `@/` -> repository root
```typescript
import { prisma } from '@/lib/db/client';
import { socraticEngine } from '@/lib/learning/socratic-engine';
```

## Deployment Notes

- Vercel deployment (free tier)
- Build command runs `prisma generate && prisma migrate deploy && next build`
- Requires Neon database (free tier)
- Set all env vars in Vercel dashboard
