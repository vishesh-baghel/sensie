# Sensie

Your personal AI learning sensei - teaches through Socratic questioning with Master Roshi energy.

## Features

- **Socratic Teaching**: Learn through guided questions, not direct answers
- **Spaced Repetition**: FSRS algorithm ensures long-term retention
- **Adaptive Difficulty**: Questions adjust to your performance
- **Progress Tracking**: Visual mastery progression
- **Master Roshi Personality**: Wise, eccentric, demanding but encouraging

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

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **AI Agent**: Mastra framework
- **Database**: PostgreSQL + Prisma (Neon)
- **LLM**: OpenAI/Anthropic via AI SDK
- **Styling**: TailwindCSS + shadcn/ui
- **Testing**: Vitest

## Development

```bash
pnpm dev          # Start dev server
pnpm test         # Run tests
pnpm db:studio    # Open Prisma Studio
```

## Architecture

See `CLAUDE.md` for detailed architecture documentation.

## License

MIT
