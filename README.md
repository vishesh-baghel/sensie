# Sensie

Your personal AI learning sensei - teaches through Socratic questioning with Master Roshi energy.

**Status:** MVP Development
**Cost:** ~$10/month to run
**Deployment:** Single Next.js app (Vercel)

## The Problem

Learning with AI often means getting answers handed to you. You read, you forget, you move on. No real understanding, no retention.

## The Solution

Sensie teaches through questions, not answers. Like Master Roshi training Goku - demanding but encouraging. It forces you to think, articulate your understanding, and actually remember what you learn.

## Features

- **Socratic Teaching**: Learn through guided questions, not direct answers
- **Spaced Repetition**: FSRS algorithm ensures long-term retention
- **Adaptive Difficulty**: Questions adjust to your performance
- **Progress Tracking**: Visual mastery progression
- **Master Roshi Personality**: Wise, eccentric, demanding but encouraging

## How It Works

1. **Pick a topic** - Tell Sensie what you want to learn
2. **Answer questions** - Sensie asks Socratic questions, you explain in your own words
3. **Get feedback** - Not just right/wrong, but depth of understanding
4. **Review later** - Spaced repetition schedules reviews at optimal intervals
5. **Master it** - Track your progress as concepts move to long-term memory

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **AI Agent**: Mastra framework
- **Database**: PostgreSQL + Prisma (Neon)
- **LLM**: OpenAI/Anthropic via AI SDK
- **Spaced Repetition**: ts-fsrs (FSRS-5 algorithm)
- **Styling**: TailwindCSS + shadcn/ui
- **Testing**: Vitest

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your database and API keys

# Run database migrations
pnpm db:migrate

# Start development server
pnpm dev
```

## Development Commands

```bash
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm test             # Run all tests
pnpm test:unit        # Unit tests only
pnpm test:integration # Integration tests only
pnpm test:e2e         # E2E tests
pnpm db:migrate       # Run database migrations
pnpm db:studio        # Open Prisma Studio
```

## Commands (Slash Commands)

During a learning session:
- `/progress` - Show current topic progress
- `/topics` - List all your topics
- `/hint` - Get a hint (3 levels, use sparingly)
- `/skip` - Skip question (max 3 per session)
- `/break` - Save progress and pause
- `/review` - Start spaced repetition review
- `/quiz` - Start quiz on current topic

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon pooled connection |
| `DATABASE_URL_UNPOOLED` | Yes | Direct connection for migrations |
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `SESSION_SECRET` | Yes | 32+ char secret for sessions |
| `LANGFUSE_*` | No | LLM observability (optional) |

## Project Structure

```
sensie/
├── CLAUDE.md                   # AI assistant guidance
├── src/
│   ├── app/                    # Next.js app router
│   ├── lib/
│   │   ├── mastra/             # Mastra agents
│   │   ├── learning/           # Learning engine
│   │   │   ├── socratic-engine.ts
│   │   │   ├── spaced-repetition.ts
│   │   │   ├── difficulty-adjuster.ts
│   │   │   └── progress-tracker.ts
│   │   ├── db/                 # Database layer
│   │   └── personality/        # Master Roshi phrases
│   └── components/             # React components
└── prisma/
    └── schema.prisma           # Database schema
```

## The Learning Loop

1. Sensie presents concept context (not the full answer)
2. Asks a Socratic question requiring thought
3. You answer in your own words
4. LLM evaluates: correct? shallow/moderate/deep understanding?
5. If wrong -> guiding question to fill the gap
6. If shallow -> follow-up for deeper understanding
7. If deep -> celebrate, move to next concept
8. Reviews scheduled based on difficulty and retention

## Difficulty Adaptation

- Questions have difficulty levels 1-5
- Performance tracked over rolling window
- Accuracy > 80% -> questions get harder
- Accuracy < 50% -> questions get easier
- Hint usage affects difficulty scoring

## Architecture

See `CLAUDE.md` for detailed architecture documentation including:
- Database schema
- Mastra agent configuration
- Learning engine details
- API routes
- Testing strategy

## License

MIT
