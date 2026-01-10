# Sensie - Your AI Learning Sensei

## Vision

Sensie is a hyper-personalized AI learning agent that teaches you deeply through Socratic questioning, identifies knowledge gaps, and adapts to your learning pace. Unlike generic AI tutors, Sensie maintains a persistent understanding of your learning journey, employs proven pedagogical techniques (spaced repetition, Feynman technique), and can teach from any source: documentation, codebases, articles, or user-provided materials.

**Core Philosophy:** "True mastery comes not from being told, but from discovering through guided questioning."

## Tagline

"Your training begins now, young apprentice"

## Core Value Proposition

Traditional learning tools give you answers. Sensie makes you earn understanding.

**The Sensie Difference:**
- **Deep Questioning:** Won't let you move forward until you can answer probing questions about the concept
- **Gap Detection:** Identifies weak foundations and teaches prerequisites before advanced topics
- **Socratic Method:** Guides you to answers through questions, not explanations
- **Multi-Source Learning:** Learn from docs, code, articles, or your own materials
- **Persistent Memory:** Remembers your entire learning journey, adapts difficulty as you grow
- **Spaced Repetition:** Automatically reminds you to review topics before you forget
- **Master Roshi Personality:** Learning is serious, but the journey should be fun

## Target User

**Primary:** Software engineers who want to deeply understand new technologies, not just copy-paste solutions

**Characteristics:**
- Committed to genuine mastery, not surface-level knowledge
- Willing to be challenged and questioned
- Prefers understanding "why" over memorizing "what"
- Learning complex technical topics (Rust, system design, distributed systems, etc.)
- Uses ChatGPT/Claude but frustrated by shallow explanations
- Wants structured learning without rigid course formats

## Topic Scope

**Supported Topics:** Technical Skills + Human Skills

Sensie is designed for holistic professional growth. Most of your time is spent working with people, not just code.

### Technical Skills
- **Programming:** Languages (Rust, Go, TypeScript), frameworks, algorithms, data structures
- **System Design:** Architecture patterns, distributed systems, databases, scalability
- **DevOps & Infrastructure:** Cloud architecture, CI/CD, security, observability
- **Engineering Practices:** Code review, debugging, testing strategies, technical writing

### Human & Soft Skills
- **Communication:** Giving/receiving feedback, explaining technical concepts to non-technical people, written communication, public speaking, active listening
- **Teamwork:** Collaboration, conflict resolution, working across time zones, pair programming dynamics, building trust with teammates
- **Relationships:** Managing up (working with your manager), peer relationships, mentoring others, building professional networks
- **Emotional Intelligence:** Self-awareness, empathy, handling stress, dealing with difficult conversations, receiving criticism gracefully
- **Leadership:** Influencing without authority, decision-making, running effective meetings, delegation, creating psychological safety

### Career & Professional Growth
- **Technical Interviewing:** System design interviews, coding interviews, behavioral questions
- **Career Development:** Building a portfolio, open source contribution, personal branding, negotiation
- **Productivity:** Time management, focus, prioritization, learning how to learn

### Why Soft Skills Belong in Sensie

The Socratic method originated in philosophy, not programming. It excels at:
- Questioning assumptions about interpersonal dynamics
- Exploring "why did that conversation go wrong?"
- Testing understanding of human behavior
- Building frameworks for complex social situations

Soft skills are **skills** - they can be learned, practiced, and mastered just like programming.

## Key Differentiators

### 1. Socratic Teaching Method
Other AI tools: "Here's the answer to your question."
Sensie: "What do you think happens here? Why? What if we change X?"

### 2. Depth-First Learning
Other AI tools: Surface coverage of many topics
Sensie: Won't let you proceed until you master current concept

### 3. Codebase-Aware Learning
Other AI tools: Generic code examples
Sensie: "Let's learn Rust by exploring the Tokio runtime codebase"

### 4. Persistent Progress Tracking
Other AI tools: Every conversation starts fresh
Sensie: Knows what you learned 3 weeks ago and tests retention

### 5. Adaptive Difficulty
Other AI tools: Same explanation depth for everyone
Sensie: Adjusts complexity based on your answers and progress

## Primary User Flows

### Flow 1: Starting a New Learning Topic

1. **Initiate Learning**
   - User: "Teach me Rust ownership"
   - Sensie analyzes the topic and creates a structured learning path

2. **Learning Path Preview (Sensie Controls the Path)**
   - Sensie: "Excellent choice, young apprentice! I've mapped out your training journey:"
   - Presents the learning path (view-only, not editable):
     - Memory Addresses (foundation)
     - Stack vs Heap (foundation)
     - Ownership Basics
     - Move Semantics
     - Borrowing
     - Lifetimes
   - User can optionally share their goal: "I want to learn this for building CLI tools"
   - Sensie may adapt emphasis based on goals, but controls all prerequisites
   - **User trusts the sensei** - they can't skip/edit what they don't yet understand

3. **Foundation Assessment**
   - Sensie: "Before we dive into ownership, answer this: What is a memory address?"
   - If user struggles → Sensie teaches prerequisites first
   - If user answers well → Sensie proceeds to ownership

4. **Deep Concept Teaching**
   - Sensie explains concept (core explanations cached, examples/analogies fresh per session)
   - Immediately asks 3-5 questions of increasing difficulty
   - User must answer correctly before moving to next concept

5. **Subtopic Progression**
   - Follows Sensie's learning path
   - Each subtopic unlocked only after mastering previous one
   - User cannot skip - Sensie knows what foundations are needed

6. **Progress Tracking**
   - User can `/progress` to see mastery level
   - Sensie schedules spaced repetition reviews

### Flow 2: Learning from a Codebase

1. **User Shares Repository**
   - User: "Teach me async Rust by analyzing Tokio"
   - Sensie: "A challenging quest! I shall explore this codebase..."

2. **Codebase Analysis**
   - Sensie explores key files (using Task tool with Explore agent)
   - Identifies core patterns and architecture

3. **Guided Tour**
   - Sensie: "Let's start with `runtime/mod.rs`. What do you think this `Runtime` struct is responsible for?"
   - User attempts answer
   - Sensie asks follow-up questions to guide understanding

4. **Progressive Complexity**
   - Starts with high-level architecture
   - Drills into implementation details
   - Tests understanding at each level

### Flow 3: Spaced Repetition Review

1. **Review Prompt**
   - User: `/review` (or Sensie reminds via notification)
   - Sensie: "Time to test your memory, apprentice! Let's review ownership from 2 weeks ago."

2. **Quick Quiz**
   - 3-5 questions on previously learned topic
   - Tests core concepts, not trivia

3. **Gap Identification**
   - If user forgot → Re-teach concept, schedule earlier review
   - If user remembers → Increase review interval, celebrate progress

4. **Progress Update**
   - Update mastery level for topic
   - Show retention curve

### Flow 4: Feynman Technique Exercise

1. **Challenge Prompt**
   - Sensie: "You've learned closures. Now, explain them to me like I'm a 10-year-old."

2. **User Explanation**
   - User attempts to explain in simple terms

3. **Socratic Probing**
   - Sensie asks clarifying questions based on gaps in explanation
   - "You said closures 'remember variables.' How do they remember?"

4. **Refinement Loop**
   - User refines explanation based on questions
   - Sensie approves when explanation is clear and accurate

### Flow 5: Command-Based Interaction

```
User: /topics
Sensie: "Your learning journey, young one:

🔥 Active Learning:
  • Rust (65% mastery) - Currently: Lifetimes
  • System Design (30% mastery) - Currently: Caching strategies

✅ Mastered:
  • JavaScript Closures (90% mastery) - Last review: 3 days ago
  • SQL Indexes (85% mastery) - Due for review: Tomorrow

📚 Queued:
  • Distributed Systems
  • Advanced TypeScript"

User: /progress
Sensie: "Rust Ownership - Your Progress:

Mastery: 65% ██████████░░░░░

Subtopics:
  ✅ Memory addresses (100%) - Mastered 2 weeks ago
  ✅ Stack vs Heap (95%) - Last review: 1 week ago
  ✅ Ownership basics (90%) - Last review: 3 days ago
  🔄 Borrowing (60%) - Currently learning (2/5 questions correct)
  🔒 Lifetimes (locked) - Unlock after mastering Borrowing
  🔒 References (locked)

Next review: Ownership basics (in 4 days)"

User: /quiz
Sensie: "Quiz time! Let's test your understanding of Borrowing.

Question 1/5: What happens when you pass a value to a function in Rust without using a reference?"
```

## Success Metrics

### User Engagement
- **Daily Active Usage:** Users return to learn at least 3x/week
- **Session Duration:** Average 20-30 minutes (deep learning, not quick Q&A)
- **Topic Completion:** 60%+ of started topics reach 80% mastery
- **Review Participation:** 70%+ of scheduled reviews completed

### Learning Effectiveness
- **Quiz Performance:** Average improvement from 50% → 80%+ after deep teaching
- **Retention Rate:** 75%+ accuracy on spaced repetition reviews
- **Gap Detection Accuracy:** Sensie correctly identifies prerequisites 80%+ of time

### Portfolio Goals (from strategy doc)
- **Visitor Mode Engagement:** 500+ views/month
- **GitHub Stars:** Contribute to 500+ year 1 goal
- **Testimonials:** "Best learning tool I've ever used" type feedback
- **Showcases Real Usage:** Visitor mode shows genuine learning journey

### Adoption (Ecosystem Goals)
- **Free Deployments:** 50+ users deploy their own Sensie
- **Overseer Integration:** Once Overseer launches, 20%+ of Sensie users upgrade
- **Cross-Agent Value:** Sensie → Jack content ideas, Sensie → Code Review skill assessment

## Topic Management Rules

### Active Topics Limit: 3 Maximum (Hard Limit)

**Rationale:** Focus leads to mastery. Too many active topics = shallow learning.

**Behavior:**
- User can have maximum 3 topics in "Active" status simultaneously
- When trying to add a 4th active topic, Sensie enforces the limit:

```
Sensie: "I see you want to learn Distributed Systems, apprentice.
However, you currently have 3 active topics:
  • Rust (65%) - 2 subtopics remaining
  • Giving Feedback (40%) - 3 subtopics remaining
  • System Design (30%) - 5 subtopics remaining

You must complete or archive one topic before starting another.
Focus leads to mastery!

[Complete Rust First] [Archive a Topic] [Add to Queue]"
```

- **Hard limit enforced** - no "Start Anyway" option
- User must complete (reach mastery threshold) or archive an existing topic
- Topics can be moved to Queue without penalty

### Topic States

| Status | Description | Count Limit |
|--------|-------------|-------------|
| Active | Currently learning | 2-3 max |
| Queued | Saved for later | Unlimited |
| Mastered | Hit mastery threshold | Unlimited |
| Archived | Hidden from view | Unlimited |

### Revisiting Mastered Topics

Once a topic reaches mastery threshold, user can:
1. **Continue Learning** - Access remaining advanced subtopics
2. **Review Mode** - Quick spaced repetition quizzes
3. **Request Reteach** - If concepts were forgotten, Sensie reteaches from scratch

```
User: "/topics"
Sensie shows mastered topic with options:

✅ JavaScript Closures (92%)
   [Continue to Advanced] [Quick Review] [Reteach from Start]
```

## Gamification System

**Philosophy:** Full gamification to make learning addictive (in a good way).

### XP Points

| Action | XP Earned |
|--------|-----------|
| Answer question correctly (no hints) | +20 XP |
| Answer question correctly (with hints) | +10 XP |
| Complete a subtopic | +100 XP |
| Complete a topic | +500 XP |
| Pass a review session | +50 XP |
| Complete Feynman exercise | +200 XP |
| Maintain daily streak | +25 XP × streak days |

### Levels

| Level | Title | XP Required |
|-------|-------|-------------|
| 1 | Novice | 0 |
| 2 | Apprentice | 500 |
| 3 | Student | 1,500 |
| 4 | Practitioner | 4,000 |
| 5 | Journeyman | 8,000 |
| 6 | Expert | 15,000 |
| 7 | Master | 30,000 |
| 8 | Grandmaster | 50,000 |
| 9 | Sensei | 100,000 |
| 10 | Legendary Sensei | 200,000 |

### Badges (Achievements)

**Learning Milestones:**
- 🎯 First Blood - Answer your first question correctly
- 📚 Bookworm - Complete your first topic
- 🔥 On Fire - 7-day learning streak
- ⚡ Lightning - 30-day learning streak
- 🏆 Centurion - 100-day learning streak

**Mastery Badges:**
- 🥋 White Belt - Master 1 topic
- 🥋 Yellow Belt - Master 5 topics
- 🥋 Green Belt - Master 10 topics
- 🥋 Black Belt - Master 25 topics

**Skill-Specific:**
- 🦀 Rustacean - Master a Rust topic
- 💬 Communicator - Master a soft skills topic
- 🏗️ Architect - Master System Design

**Challenge Badges:**
- 🧠 No Hints Needed - Complete a subtopic without hints
- ⚔️ Perfectionist - 100% accuracy on a topic
- 🎓 Feynman Master - Complete 10 Feynman exercises

### Streak System

- Daily streak: Learn at least one concept per day
- Streak displayed prominently in header
- Milestone celebrations: 7, 30, 100, 365 days
- **Streak freeze: Deferred to post-MVP** (initially, missing a day breaks the streak)

```
┌──────────────────────────────┐
│  🔥 15-day streak!           │
│  Keep going, apprentice!     │
│  Next milestone: 30 days     │
└──────────────────────────────┘
```

### Future: Leaderboards (Multi-User)

When Sensie supports multiple users:
- Weekly XP leaderboard
- Topic-specific leaderboards
- Opt-in (privacy respected)

## User Experience Principles

### 1. Challenging, Not Frustrating
- Questions should be hard but fair
- Sensie provides 3 progressive hints before revealing answer
- Maximum 5 attempts per question, then mark for review and move on
- Celebrates progress frequently

### Question & Skip Rules

**Questions Per Subtopic:** 10 questions (open-ended for depth)

**Skip Rules:**
- 3 skips maximum per learning session
- Skipped questions are marked and must be answered before unlocking next subtopic
- If user fails skipped questions during revisit → loop on those questions only (not full reteach)
- Skip count resets when session ends or topic changes

**Stuck User Flow:**
- After 5 failed attempts on any question, Sensie marks it for review and moves on
- Goal: Never block the user from continuing their learning journey
- Marked questions appear in spaced repetition reviews

### 2. Transparent Progress
- Always know where you are in the learning journey
- Clear mastery percentages
- Visual progress bars and trees

### 3. Respect User Time
- Deep learning requires focus, but Sensie adapts to session length
- Can pause mid-topic and resume later
- Quick commands for status checks

### 4. Personality Enhances, Not Distracts
- Master Roshi energy in UI copy and encouragement
- Teaching content stays clear and precise
- Humor in right moments (errors, celebrations, empty states)

### 5. Multi-Modal Learning
- Text explanations
- Code examples (display only - user runs locally)
- Visual diagrams (future: generated with code)
- Links to authoritative sources

**Note:** No embedded code execution. Code examples are for reading and understanding. User copies and runs locally if they want to experiment. This keeps Sensie focused on teaching, not becoming an IDE.

## Visitor Mode Experience

**Philosophy:** Complete authenticity. No fake demos, no curated showcases.

The goal of visitor mode across all agents (Sensie, Jack, etc.) is the same: **show real usage, not marketing material**. Visitors see exactly what I'm learning, where I'm struggling, and how I'm progressing.

**Why Authenticity:**
- Builds genuine credibility (can't fake a 75% mastery over months)
- Shows the tool is actually useful (I use it daily)
- More compelling than polished demos
- Aligns with personal brand of transparency

**What Visitors See (Everything Real):**
- Actual topics I'm learning (Rust, Giving Feedback, System Design)
- Real progress percentages and mastery levels
- Real learning path and subtopics
- Real questions I've been asked
- Real answers I've given (unless marked private)
- Real struggle points (where I needed hints)
- Full UI/UX including commands
- Master Roshi personality in action
- XP, streaks, and badges

**Privacy Control:**
- Owner can manually mark specific answers as private (won't be shown to visitors)
- No automatic anonymization - authenticity is the goal
- Private marking is per-answer, not per-topic

**Implementation:**
```typescript
const isVisitor = session?.role === "visitor";

// Visitors see REAL data, just read-only
// Only answers marked as private are filtered out
const answers = isVisitor
  ? allAnswers.filter(a => !a.isPrivate)
  : allAnswers;
```

## Integration with Ecosystem

### Jack (Content Agent)
**Context Shared:** Current learning topics
**Value:** Jack suggests content ideas based on what you're learning
**Example:** Learning Rust → Jack suggests "Thread: What I learned building a CLI in Rust"

### Code Review Agent (Future)
**Context Shared:** Skill proficiency levels
**Value:** Code review knows your expertise, provides appropriate feedback
**Example:** Beginner in Rust → More explanatory reviews vs Expert → Nitpicky reviews

### Overseer (Orchestration)
**Context Shared:** Learning schedule, topics, mastery levels
**Value:** Unified view of personal growth across all agents
**Example:** Overseer dashboard shows "30 hours learning this month, 3 topics mastered"

## Technical Foundation (High-Level)

**Framework:** Next.js 15 (App Router)
**AI Agent:** Mastra framework (similar to Jack)
**Database:** PostgreSQL + Prisma (Neon)
**LLM Gateway:** Vercel AI Gateway
**Observability:** Langfuse (track teaching effectiveness)
**Authentication:** Passphrase-based (owner) + visitor mode
**Deployment:** Vercel (free tier compatible)

## Risks & Mitigations

### Risk 1: Socratic Method Too Frustrating
**Mitigation:**
- Progressive hint system before revealing answer
- Sensie adapts question difficulty based on struggle
- Option to request direct explanation (but encourages questioning first)

### Risk 2: Progress Tracking Too Complex
**Mitigation:**
- Start simple: Topic → Subtopics → Questions
- Avoid over-engineering skill trees initially
- Focus on "% mastery" as primary metric

### Risk 3: Codebase Analysis Too Slow
**Mitigation:**
- Use Task tool with Explore agent for efficient codebase analysis
- Cache analyzed codebases
- Focus on key files, not exhaustive analysis

### Risk 4: Spaced Repetition Scheduling Feels Nagging
**Mitigation:**
- User controls review frequency
- Reviews are quick (5-10 min)
- Can snooze reviews if busy

### Risk 5: Low Differentiation from ChatGPT + Custom Instructions
**Mitigation:**
- Persistent progress tracking (ChatGPT can't do this)
- Structured learning paths with unlockable content
- Spaced repetition automation
- Socratic questioning that adapts to your answers
- Codebase-integrated learning

## Future Vision (Post-MVP)

### Phase 1: MVP (Months 1-3)
- Core Socratic teaching
- Topics + Subtopics progress tracking
- Basic spaced repetition
- Codebase learning capability
- Commands: /progress, /topics, /quiz, /review
- Master Roshi personality
- Visitor mode

### Phase 2: Enhanced Learning (Months 4-6)
- Feynman technique exercises
- Project-based learning suggestions
- Visual progress trees
- Learning analytics dashboard
- Integration with Jack agent

### Phase 3: Advanced Features (Months 7-12)
- Multi-modal learning (diagrams, interactive code)
- Collaborative learning (learn with friends)
- Learning paths marketplace (share your learning journey)
- Integration with all ecosystem agents via Overseer

### Phase 4: Ecosystem Expansion (Year 2+)
- Sensie for teams (companies can deploy for onboarding)
- Custom learning path creation
- AI-generated exercises and projects
- Integration with external learning platforms

## Why Sensie Will Succeed

1. **Solves Real Pain:** Learning deeply is hard. Most tools optimize for quick answers, not mastery.
2. **Proven Pedagogy:** Socratic method + spaced repetition are research-backed techniques
3. **Unique Personality:** Master Roshi makes learning memorable and fun
4. **Portfolio Gold:** Demonstrates AI agent design, pedagogical understanding, product thinking
5. **Ecosystem Fit:** Natural complement to Jack (create content) and Code Review (apply skills)
6. **Open Source:** Developers will fork and customize for their learning needs
7. **Visitor Mode:** Shows real learning journey, builds credibility

---

**Next Steps:**
1. Review this overview with user for alignment
2. Design database schema (topics, subtopics, questions, progress)
3. Define Master Roshi personality guide
4. Architect learning engine (Socratic questioning, spaced repetition)
5. Design UI/UX for hybrid chat interface
6. Build MVP

**Last Updated:** 2026-01-04
