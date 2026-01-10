# Sensie Cross-Agent Integration

## Overview

This document specifies how Sensie integrates with other agents in the personal AI ecosystem through the Overseer orchestration layer.

**Current Status:** PLACEHOLDER - Overseer does not exist yet. This spec defines the interface and expected behavior for future integration.

**Implementation Timeline:** Post-MVP Phase 3 (Months 7-9)

---

## Integration Architecture

### Without Overseer (MVP - Standalone Mode)

```
┌─────────────────────────────────────────┐
│             SENSIE                      │
│  (Completely self-contained)            │
│                                         │
│  • Learning topics                      │
│  • Progress tracking                    │
│  • Spaced repetition                    │
│  • No external dependencies             │
└─────────────────────────────────────────┘
```

**Behavior:**
- Sensie works fully standalone
- No cross-agent features visible
- No broken/locked features (clean UX)
- Focus on learning effectiveness

### With Overseer (Phase 3 - Connected Mode)

```
┌─────────────────────────────────────────────────────────────┐
│                        OVERSEER                             │
│  (Central context and orchestration layer)                  │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Context    │  │ Preferences  │  │  Analytics   │     │
│  │   Store      │  │   Store      │  │   Engine     │     │
│  └──────┬───────┘  └──────────────┘  └──────────────┘     │
│         │                                                   │
│  ┌──────▼──────┐                  ┌─────────────┐          │
│  │   LLM       │                  │   REST      │          │
│  │   Router    │                  │   API       │          │
│  │ (relevance) │                  │ (on-demand) │          │
│  └──────┬──────┘                  └──────┬──────┘          │
│         │ PUSH                           │ PULL             │
└─────────┼────────────────────────────────┼─────────────────┘
          │                                │
          ▼                                ▼
┌─────────────────────────────────────────────────────────────┐
│                     SENSIE                                  │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Cached Context from Overseer                          │ │
│  │  • User's active projects (from Code Review agent)    │ │
│  │  • Content creation topics (from Jack)                │ │
│  │  • Personal preferences (from Overseer)               │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Context Shared with Overseer                          │ │
│  │  • Current learning topics + progress                  │ │
│  │  • Skills acquired + proficiency levels                │ │
│  │  • Knowledge gaps identified                           │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Context Shared by Sensie

### 1. Learning Topics & Progress

**What Sensie Shares:**
```json
{
  "agent": "sensie",
  "contextType": "learning_progress",
  "timestamp": "2026-01-04T10:30:00Z",
  "data": {
    "activeTopics": [
      {
        "id": "topic_123",
        "name": "Rust",
        "mastery": 75,
        "status": "active",
        "currentSubtopic": "Borrowing",
        "lastActivity": "2026-01-04T09:00:00Z"
      },
      {
        "id": "topic_456",
        "name": "System Design",
        "mastery": 30,
        "status": "active",
        "currentSubtopic": "Caching Strategies",
        "lastActivity": "2026-01-03T14:00:00Z"
      }
    ],
    "completedTopics": [
      {
        "id": "topic_789",
        "name": "JavaScript Closures",
        "mastery": 90,
        "completedAt": "2025-12-20T10:00:00Z"
      }
    ],
    "upcomingReviews": [
      {
        "topicName": "JavaScript Closures",
        "dueDate": "2026-01-05T00:00:00Z"
      }
    ]
  }
}
```

**Why Other Agents Care:**
- **Jack:** Can suggest content ideas based on learning topics
  - "You're learning Rust → Thread idea: My first week with Rust"
- **Code Review Agent:** Knows skill level for better feedback
  - "User is beginner in Rust → Provide explanatory reviews"
- **Overseer Dashboard:** Shows unified learning progress

### 2. Skills Acquired & Proficiency

**What Sensie Shares:**
```json
{
  "agent": "sensie",
  "contextType": "skill_proficiency",
  "timestamp": "2026-01-04T10:30:00Z",
  "data": {
    "skills": [
      {
        "name": "Rust Ownership",
        "category": "programming",
        "proficiency": "proficient", // beginner, intermediate, proficient, expert
        "masteryPercentage": 85,
        "lastPracticed": "2026-01-04T09:00:00Z"
      },
      {
        "name": "System Design - Caching",
        "category": "architecture",
        "proficiency": "intermediate",
        "masteryPercentage": 60,
        "lastPracticed": "2026-01-03T14:00:00Z"
      }
    ],
    "skillTree": {
      "Rust": {
        "Ownership": 85,
        "Borrowing": 60,
        "Lifetimes": 0
      }
    }
  }
}
```

**Why Other Agents Care:**
- **Code Review Agent:** Tailor feedback to skill level
- **Project Suggestion Agent (future):** Suggest projects matching skills
- **Overseer Analytics:** Track skill growth over time

### 3. Knowledge Gaps Identified

**What Sensie Shares:**
```json
{
  "agent": "sensie",
  "contextType": "knowledge_gaps",
  "timestamp": "2026-01-04T10:30:00Z",
  "data": {
    "gaps": [
      {
        "concept": "Rust Lifetime Annotations",
        "severity": "moderate",
        "detectedAt": "2026-01-04T09:30:00Z",
        "evidence": "User struggled with lifetime parameters in function signatures",
        "prerequisitesNeeded": ["Borrowing", "References"]
      },
      {
        "concept": "Database Indexing Strategy",
        "severity": "minor",
        "detectedAt": "2026-01-03T14:00:00Z",
        "evidence": "Incorrect answer about composite indexes"
      }
    ]
  }
}
```

**Why Other Agents Care:**
- **Code Review Agent:** Flag potential issues in code related to gaps
- **Overseer:** Suggest targeted learning to fill gaps

---

## Context Received by Sensie

### 1. Active Projects (from Code Review Agent)

**What Sensie Receives:**
```json
{
  "agent": "code-review",
  "contextType": "active_projects",
  "data": {
    "projects": [
      {
        "name": "personal-website",
        "technologies": ["Next.js", "TypeScript", "TailwindCSS"],
        "status": "active",
        "lastCommit": "2026-01-03T18:00:00Z"
      },
      {
        "name": "rust-cli-tool",
        "technologies": ["Rust", "Clap"],
        "status": "active",
        "lastCommit": "2026-01-04T08:00:00Z"
      }
    ]
  }
}
```

**How Sensie Uses It:**
- Suggest project-based learning aligned with active projects
  - "I see you're building a Rust CLI. Let's learn argument parsing with Clap!"
- Prioritize learning topics relevant to current work
- Offer to review code from projects as learning material

### 2. Content Topics (from Jack)

**What Sensie Receives:**
```json
{
  "agent": "jack",
  "contextType": "content_topics",
  "data": {
    "recentPosts": [
      {
        "topic": "Building with Next.js 15",
        "performedWell": true,
        "publishedAt": "2026-01-02T10:00:00Z"
      }
    ],
    "upcomingIdeas": [
      {
        "topic": "Learning Rust as a TypeScript developer",
        "status": "outlined"
      }
    ]
  }
}
```

**How Sensie Uses It:**
- Connect learning to content creation
  - "You're writing about Rust! Let me help you understand it deeply."
- Suggest learning topics that align with content strategy
- Offer to quiz user before they publish (ensure accuracy)

### 3. Personal Preferences (from Overseer)

**What Sensie Receives:**
```json
{
  "agent": "overseer",
  "contextType": "personal_preferences",
  "data": {
    "workSchedule": {
      "focusHours": ["09:00-12:00", "14:00-17:00"],
      "timezone": "America/Los_Angeles"
    },
    "learningStyle": {
      "preferredDifficulty": "challenging",
      "pacePreference": "fast",
      "reviewFrequency": "daily"
    },
    "goals": [
      {
        "type": "learn",
        "description": "Master Rust by Q2 2026",
        "deadline": "2026-06-30"
      }
    ]
  }
}
```

**How Sensie Uses It:**
- Schedule reviews during focus hours
- Adjust difficulty based on preference
- Align learning pace with goals
- Reminder timing based on timezone

---

## API Contract (Overseer Integration)

### Sensie → Overseer (Push Context)

**Endpoint:** `POST {OVERSEER_URL}/api/context/push`

**Request:**
```typescript
{
  headers: {
    "Authorization": `Bearer ${OVERSEER_JWT_SECRET}`,
    "X-Agent-ID": "sensie",
    "X-User-ID": userId
  },
  body: {
    contextType: "learning_progress" | "skill_proficiency" | "knowledge_gaps",
    timestamp: string, // ISO 8601
    data: object, // Context payload
    ttl: number, // Time-to-live in seconds (optional)
  }
}
```

**Response:**
```typescript
{
  success: boolean,
  contextId: string,
  storedAt: string
}
```

**When to Push:**
- After completing a subtopic (learning_progress)
- After mastering a concept (skill_proficiency)
- After detecting a knowledge gap (knowledge_gaps)
- Maximum: Once per hour (avoid spam)

### Overseer → Sensie (Pull Context)

**Endpoint:** `GET {OVERSEER_URL}/api/context/pull?agentId=sensie&userId={userId}`

**Request:**
```typescript
{
  headers: {
    "Authorization": `Bearer ${OVERSEER_JWT_SECRET}`,
    "X-Agent-ID": "sensie"
  }
}
```

**Response:**
```typescript
{
  success: boolean,
  contexts: [
    {
      fromAgent: "jack" | "code-review" | "overseer",
      contextType: string,
      timestamp: string,
      data: object
    }
  ],
  lastUpdated: string
}
```

**When to Pull:**
- On user session start (cache for duration of session)
- Every 30 minutes during active session
- On-demand when user triggers cross-agent feature

---

## Graceful Degradation (No Overseer)

**Detection:**
```typescript
const overseerEnabled = !!process.env.OVERSEER_URL && !!process.env.OVERSEER_JWT_SECRET;
```

**Behavior:**
- If `overseerEnabled === false`:
  - All cross-agent features hidden (no broken UI)
  - Sensie works fully standalone
  - No error messages about missing Overseer
  - Clean user experience

**Example:**
```typescript
// Don't show project-based learning suggestions if no Overseer
{overseerEnabled && <ProjectSuggestions />}

// Internal check before API call
async function pushContext(context: Context) {
  if (!overseerEnabled) {
    return; // Silently skip
  }

  await fetch(`${OVERSEER_URL}/api/context/push`, {
    // ...
  });
}
```

---

## Cross-Agent Feature Examples

### 1. Project-Based Learning (Sensie + Code Review)

**User Flow:**
1. User is learning Rust in Sensie
2. User has active Rust project in Code Review agent
3. Sensie receives project context from Overseer
4. Sensie suggests: "Let's apply what you learned to your Rust CLI project!"
5. User agrees
6. Sensie analyzes code (via Code Review agent context)
7. Sensie asks questions about the code
8. User answers, demonstrating understanding
9. Mastery percentage increases

**UI:**
```
┌──────────────────────────────────────────────────────┐
│  🎴 Sensie                                           │
│                                                      │
│  I see you have an active Rust project: rust-cli!   │
│                                                      │
│  Want to apply what you learned about ownership     │
│  by reviewing your project code?                    │
│                                                      │
│  [Yes, Let's Do It!] [Not Now]                       │
└──────────────────────────────────────────────────────┘
```

### 2. Content-Driven Learning (Sensie + Jack)

**User Flow:**
1. Jack generates content idea: "My journey learning Rust"
2. Jack pushes topic to Overseer
3. Sensie receives context
4. Sensie suggests: "Planning to write about Rust? Let me ensure you understand it deeply!"
5. User agrees
6. Sensie quizzes user on Rust concepts
7. If gaps detected → Fill gaps before user publishes content
8. User writes post with confidence (no misinformation)

**UI:**
```
┌──────────────────────────────────────────────────────┐
│  🎴 Sensie                                           │
│                                                      │
│  Jack is working on a Rust content idea!            │
│                                                      │
│  Before you publish, let me quiz you to ensure      │
│  accuracy. Ready?                                    │
│                                                      │
│  [Quiz Me] [I'm Confident]                           │
└──────────────────────────────────────────────────────┘
```

### 3. Unified Learning Dashboard (Sensie + Overseer)

**User Flow:**
1. User opens Overseer dashboard
2. Overseer pulls learning context from Sensie
3. Dashboard shows:
   - Topics learning this week
   - Skills acquired
   - Reviews due
   - Learning streaks
4. User clicks "Continue Learning" → Deep link to Sensie

**Overseer Dashboard:**
```
┌──────────────────────────────────────────────────────┐
│  📚 Learning Progress (Sensie)                       │
│                                                      │
│  Active Topics:                                      │
│  • Rust (75%) - Last studied: Today                  │
│  • System Design (30%) - Last studied: Yesterday     │
│                                                      │
│  This Week:                                          │
│  • 3 concepts mastered                               │
│  • 12 reviews completed                              │
│  • 5-day learning streak 🔥                          │
│                                                      │
│  [Continue Learning in Sensie →]                     │
└──────────────────────────────────────────────────────┘
```

---

## Implementation Checklist

### Phase 1: Preparation (Pre-Overseer)
- [x] Design context schema
- [x] Document API contract
- [x] Add Overseer env vars to .env.example
- [ ] Build context serialization utils
- [ ] Add feature flag: `CROSS_AGENT_INTEGRATION`
- [ ] Graceful degradation logic

### Phase 2: Overseer Integration (When Overseer Exists)
- [ ] Implement push context endpoint calls
- [ ] Implement pull context endpoint calls
- [ ] Cache pulled context (Redis or in-memory)
- [ ] Error handling for Overseer unavailable
- [ ] Retry logic for failed pushes

### Phase 3: Cross-Agent Features
- [ ] Project-based learning (with Code Review)
- [ ] Content-driven learning (with Jack)
- [ ] Unified dashboard data export
- [ ] SSO support (via Overseer)

### Phase 4: Testing
- [ ] Unit tests for context serialization
- [ ] Integration tests with mock Overseer
- [ ] Test graceful degradation
- [ ] Test with real Overseer (when available)

---

## Security Considerations

### Authentication
- **JWT-based auth:** Overseer signs JWTs, Sensie validates
- **Shared secret:** `OVERSEER_JWT_SECRET` environment variable
- **Token expiration:** Short-lived tokens (5 min)

### Data Privacy
- **No PII in context:** Only learning topics, skills, gaps (no personal details)
- **User consent:** User must opt-in to cross-agent features
- **Data retention:** Context in Overseer expires after 30 days

### Rate Limiting
- **Push limit:** Max 1 context push per minute per context type
- **Pull limit:** Max 2 context pulls per minute
- **Overseer enforces:** 429 errors if exceeded

---

## Monitoring & Observability

### Metrics to Track
- Context push success rate
- Context pull latency
- Overseer availability
- Cross-agent feature usage

### Logs
- All context pushes/pulls logged
- Failed requests logged with reason
- Context payload size tracked

### Alerts
- Overseer unavailable for >10 minutes
- Context push failures >10% in 1 hour
- JWT validation failures

---

## Future Enhancements

### Phase 1 (Basic Integration)
- ✅ Push/pull context via REST API
- ✅ Cached context in Sensie
- ✅ Graceful degradation

### Phase 2 (Real-Time Sync)
- [ ] WebSocket connection to Overseer
- [ ] Real-time context updates
- [ ] Optimistic UI updates

### Phase 3 (Advanced Orchestration)
- [ ] Overseer triggers Sensie actions
  - "Start learning X because Jack needs content"
  - "Review Y because Code Review flagged it"
- [ ] Multi-agent workflows
  - Learn → Apply → Publish pipeline

### Phase 4 (AI-Powered Context Routing)
- [ ] LLM decides what context is relevant
- [ ] Smart filtering (not all context goes everywhere)
- [ ] Context summarization for efficiency

---

**Current Status:** Specification complete, awaiting Overseer development

**Next Steps:**
1. Build Overseer (separate project)
2. Implement Overseer API endpoints
3. Return to Sensie, implement integration
4. Test cross-agent features
5. Launch connected ecosystem

**Last Updated:** 2026-01-04
