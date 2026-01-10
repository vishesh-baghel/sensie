# Sensie Learning Engine

This document details the pedagogical algorithms, learning methodologies, and intelligent systems that power Sensie's teaching capabilities.

## Core Learning Philosophy

**Principle:** "Test, don't tell. Guide, don't give."

Traditional teaching: Explain → Example → Test
Sensie's approach: Test → Detect gaps → Teach prerequisites → Guide through questions → Test again

## Learning Engine Components

### 0. Learning Path Generator

**Purpose:** Create a structured learning path when user starts a new topic

**Principle:** "Trust the Sensei" - Sensie controls the path, user trusts the guidance

**Rationale:** Users can't judge what to skip because they don't yet understand the topic. A student learning Rust doesn't know whether "borrowing" is skippable - that's exactly why they need a teacher. The Dunning-Kruger effect means beginners overestimate their ability to judge importance.

#### Algorithm Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. ANALYZE TOPIC                                           │
│  Parse topic name, identify domain:                         │
│  • Technical (programming, system design, DevOps)           │
│  • Soft skills (communication, leadership, teamwork)        │
│  • Career (interviewing, negotiation)                       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  2. GENERATE SUBTOPIC STRUCTURE                             │
│  Use LLM to create hierarchical breakdown:                  │
│  • Foundation concepts (prerequisites - cannot skip)        │
│  • Core concepts (main learning material)                   │
│  • Advanced concepts (deeper understanding)                 │
│                                                             │
│  SUBTOPIC LIMIT: 8-12 subtopics (soft limit)               │
│  • If LLM generates more, suggest breaking into topics     │
│  • "This is a broad topic. Consider learning X and Y       │
│    as separate topics for better focus."                   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  3. ORDER BY DEPENDENCIES                                    │
│  • Topologically sort by prerequisites                      │
│  • Foundations before core, core before advanced            │
│  • Mark each with order number                              │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  4. CAPTURE USER GOAL (Optional)                             │
│  • User can share their learning goal                       │
│  • "I want to learn this for CLI tools"                     │
│  • Sensie adapts EXAMPLES, not the path structure           │
│  • All prerequisites remain mandatory                       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  5. FINALIZE & START                                         │
│  • Create Topic and Subtopic records                        │
│  • User sees path (view-only) and starts learning           │
│  • No editing/skipping - trust the sensei                   │
└──────────────────────────────────────────────────────────────┘
```

#### Implementation

**File:** `lib/learning/learning-path-generator.ts`

```typescript
interface Subtopic {
  name: string;
  description: string;
  order: number;
  isFoundation: boolean;
  estimatedQuestions: number;
}

interface LearningPath {
  topic: string;
  subtopics: Subtopic[];
  estimatedTotalTime: string; // "2-3 hours"
  domain: "technical" | "soft-skills" | "career";
}

class LearningPathGenerator {
  async generatePath(
    topicName: string,
    userGoal?: string // Optional context for tailoring examples
  ): Promise<LearningPath> {
    // 1. Identify domain
    const domain = await this.identifyDomain(topicName);

    // 2. Generate structured subtopic breakdown
    const subtopics = await this.generateSubtopics(topicName, domain);

    // 3. Order by dependencies (foundations first)
    const ordered = this.topologicalSort(subtopics);

    // 4. Store user goal for example tailoring (doesn't affect path)
    if (userGoal) {
      await this.storeUserGoal(topicName, userGoal);
    }

    return {
      topic: topicName,
      subtopics: ordered,
      estimatedTotalTime: this.estimateTotalTime(ordered),
      domain
    };
  }

  async createTopicFromPath(path: LearningPath, userId: string): Promise<Topic> {
    // Create Topic and Subtopic records in database
    // Path is finalized - no user modifications
    return await prisma.topic.create({
      data: {
        userId,
        name: path.topic,
        status: "ACTIVE",
        subtopics: {
          create: path.subtopics.map(s => ({
            name: s.name,
            order: s.order,
            isLocked: s.order > 1, // Only first subtopic unlocked
          }))
        }
      }
    });
  }
}
```

### 1. Socratic Questioning Engine

**Purpose:** Guide learners to discover answers through targeted questions, not direct explanations

#### Algorithm Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. INITIAL ASSESSMENT                                       │
│  Ask foundational question to gauge current understanding   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  2. EVALUATE ANSWER                                          │
│  • Correct + Deep? → Proceed to next concept                │
│  • Correct + Shallow? → Ask "why" questions                 │
│  • Incorrect? → Detect gap, ask guiding question            │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  3. GUIDING QUESTIONS (if incorrect/shallow)                 │
│  • Break down concept into smaller parts                    │
│  • Ask about related concepts                               │
│  • Provide analogies, then ask again                        │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  4. PROGRESSIVE HINTS (if still struggling)                  │
│  • Hint 1: Reminder of related concept                      │
│  • Hint 2: Partial answer with blank                        │
│  • Hint 3: Multiple choice with explanation                 │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  5. EXPLANATION (after 3 failed attempts)                    │
│  • After 3 failed attempts, provide full explanation        │
│  • Then ask VARIATION to verify understanding               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  6. VERIFY UNDERSTANDING (post-explanation)                  │
│  • Ask variation of original question                       │
│  • If correct → progress to next concept                   │
│  • If still wrong → try one more variation                 │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  7. MOVE ON AFTER MAX ATTEMPTS (5 total)                     │
│  • After 5 total attempts, mark question for later review   │
│  • Move on to next question to avoid blocking               │
│  • Goal: Never block user from continuing their journey     │
│  • Marked questions appear in spaced repetition reviews     │
└──────────────────────────────────────────────────────────────┘

**Stuck User Flow (Detailed):**

```typescript
const MAX_ATTEMPTS_BEFORE_EXPLAIN = 3;
const MAX_TOTAL_ATTEMPTS = 5;

async function handleStuckUser(
  question: Question,
  failedAttempts: number,
  context: SocraticContext
): Promise<NextAction> {
  // After 5 attempts, mark for review and move on
  if (failedAttempts >= MAX_TOTAL_ATTEMPTS) {
    await markQuestionForReview(question, context.user);
    return {
      action: "move_on",
      response: `
        This one's tricky, apprentice. I've marked it for your review sessions.
        Let's continue with the next concept - we'll circle back to this!
      `
    };
  }

  if (failedAttempts < MAX_ATTEMPTS_BEFORE_EXPLAIN) {
    // Still under threshold - give hints and guide
    return {
      action: "guide",
      response: await generateGuidingQuestion(question, context)
    };
  }

  if (failedAttempts === MAX_ATTEMPTS_BEFORE_EXPLAIN) {
    // Hit threshold - fully explain, then ask variation
    return {
      action: "explain_then_verify",
      response: `
        ${await generateFullExplanation(question.concept)}

        Now, let me verify your understanding with a different angle:
        ${await generateVariationQuestion(question)}
      `
    };
  }

  // Attempts 4-5: ask simpler variations
  return {
    action: "variation",
    response: await generateSimplerVariation(question, failedAttempts)
  };
}
```

**Key Principle:** Don't block the user. After 5 attempts, mark for review and let them continue. The spaced repetition system will bring it back later.

#### Question Types in Socratic Method

**Level 1: Recall**
- "What is X?"
- "Define Y"
- "List the types of Z"

**Level 2: Understanding**
- "Why does X work this way?"
- "Explain Y in your own words"
- "What's the difference between A and B?"

**Level 3: Application**
- "How would you use X in this scenario?"
- "What would happen if we changed Y?"
- "Give an example of Z in real code"

**Level 4: Analysis**
- "Compare X and Y. Which is better for this use case?"
- "What are the trade-offs of Z?"
- "Why did the language designers choose X over Y?"

**Level 5: Synthesis**
- "How would you combine X and Y to solve this problem?"
- "Design a system that uses Z"
- "Teach me X as if I'm 10 years old"

#### Soft Skills Teaching Approaches

For non-technical topics (communication, teamwork, leadership), Sensie uses three specialized methods:

**1. Scenario-Based Questions**
Present realistic workplace situations and ask how the user would handle them.

```
Topic: Giving Feedback

Sensie: "Your teammate submitted a PR with significant code quality issues.
They're new to the team and seem stressed about an upcoming deadline.
How would you approach giving them feedback?"

User: [responds with their approach]

Sensie evaluates:
- Did they consider timing? (not during high stress)
- Did they focus on the code, not the person?
- Did they offer to help vs just criticize?
- Did they balance honesty with empathy?
```

**2. Role-Play Exercises**
Sensie plays the other person in a conversation, letting the user practice in a safe environment.

```
Topic: Conflict Resolution

Sensie: "Let's practice. I'll be your teammate who disagrees with your
technical approach. Try to navigate this conversation."

Sensie (as teammate): "I don't think we should use microservices for this.
It's overengineering and will slow us down."

User: [responds]

Sensie (as teammate): [responds based on how user handled it]

After role-play, Sensie provides feedback:
- "You acknowledged my concern before presenting your view - good."
- "You jumped to defending your position. Try asking why I feel that way first."
```

**3. Reflection Questions**
Deep questions that help users examine their own patterns and assumptions.

```
Topic: Emotional Intelligence

Sensie: "Think about the last time you received critical feedback that
upset you. What was your first reaction? Why do you think you reacted
that way?"

User: [reflects and responds]

Sensie probes deeper:
- "What would have been an ideal response?"
- "What's one thing you could do differently next time?"
- "How might the person giving feedback have perceived your reaction?"
```

**Evaluating Soft Skills Answers**

Unlike technical topics with right/wrong answers, soft skills use a rubric:

```typescript
interface SoftSkillEvaluation {
  demonstrates: string[];    // What the user did well
  missing: string[];         // Important elements not addressed
  perspective: string[];     // Alternative viewpoints to consider
  nextQuestion: string;      // Probe deeper or move on
}

// Example rubric for "Giving Feedback"
const feedbackRubric = {
  excellent: [
    "Considers timing and setting",
    "Focuses on behavior, not person",
    "Offers specific examples",
    "Invites dialogue, not monologue",
    "Shows empathy for recipient's situation"
  ],
  acceptable: [
    "Generally constructive tone",
    "Some specific points",
    "Basic awareness of recipient's feelings"
  ],
  needsWork: [
    "Vague or general criticism",
    "Focuses on person, not behavior",
    "No consideration for timing/setting"
  ]
};
```

**Rubric → Mastery Percentage Mapping:**

| Rubric Level | Mastery % | Interpretation |
|--------------|-----------|----------------|
| **Excellent** | 100% | Hit all rubric points with insight, nuanced understanding |
| **Acceptable** | 70% | Covered basics correctly, missed nuances |
| **NeedsWork** | 30% | Missed key points, needs guidance |

```typescript
function mapRubricToMastery(level: 'excellent' | 'acceptable' | 'needsWork'): number {
  const mapping = { excellent: 100, acceptable: 70, needsWork: 30 };
  return mapping[level];
}
```

#### Implementation

**File:** `lib/learning/socratic-engine.ts`

**Key Parameters:**
```typescript
const QUESTIONS_PER_SUBTOPIC = 10;
const MAX_HINTS_PER_QUESTION = 3;
const MAX_ATTEMPTS_BEFORE_MOVE_ON = 5;
const MIN_ANSWER_LENGTH = 10; // Characters - below this is considered gibberish
```

```typescript
interface SocraticContext {
  concept: Concept;
  user: User;
  previousAnswers: Answer[];
  currentDifficulty: number;
}

interface SocraticQuestion {
  id: string;
  text: string;
  type: "recall" | "understanding" | "application" | "analysis" | "synthesis";
  expectedElements: string[]; // Key points that should be in answer
  hints: string[];
  followUpPrompts: string[]; // If answer is shallow
}

class SocraticEngine {
  async generateQuestion(context: SocraticContext): Promise<SocraticQuestion> {
    // Use LLM to generate question based on:
    // - Concept being taught
    // - User's previous answers (adapt difficulty)
    // - Type of question needed (based on progress)
    // - Socratic prompts template
    // - Prefer open-ended questions for depth
  }

  async evaluateAnswer(
    answer: string,
    question: SocraticQuestion
  ): Promise<{
    isCorrect: boolean;
    depth: "none" | "shallow" | "deep";
    feedback: string;
    terminologyCorrection?: string; // If correct but wrong terminology
    nextAction: "proceed" | "probe_deeper" | "guide" | "explain" | "move_on";
    detectedGap?: string;
  }> {
    // SEMANTIC EVALUATION (not keyword matching)
    // Use fast LLM (Haiku) to:
    // 1. Semantically evaluate if answer captures the concept
    // 2. Assess depth of understanding
    // 3. Correct terminology if answer is right but uses wrong terms
    // 4. Detect misconceptions or gaps
    // 5. Decide next action
  }

  async generateGuidingQuestion(
    incorrectAnswer: string,
    originalQuestion: SocraticQuestion,
    gap: string
  ): Promise<SocraticQuestion> {
    // Generate a question that guides toward correct answer
    // Without revealing the answer directly
  }

  async provideHint(
    question: SocraticQuestion,
    hintNumber: number // 1, 2, or 3
  ): Promise<string> {
    // 3 Progressive hints:
    // Hint 1: Related concept reminder / thinking direction
    // Hint 2: Partial answer structure with blanks
    // Hint 3: Narrow down to key insight, still requires user input
    // After 3 hints: Nudge user to attempt anyway (no more hints given)
  }

  isGibberishAnswer(answer: string): boolean {
    // Detect low-effort answers:
    // - Too short (< 10 characters)
    // - No real words (keyboard mash)
    // - "idk", "I don't know", etc.
    // Returns true if gibberish - don't count toward attempt limit
  }
}
```

**Answer Evaluation - Semantic Matching:**

```typescript
async function evaluateAnswerSemantically(
  userAnswer: string,
  question: SocraticQuestion,
  concept: Concept
): Promise<AnswerEvaluation> {
  // Use fast model (Haiku) for quick evaluation
  const prompt = `
    Evaluate this answer semantically. The student may use different
    terminology but still demonstrate understanding.

    Question: ${question.text}
    Expected concepts: ${question.expectedElements.join(', ')}
    Student answer: ${userAnswer}

    Respond with:
    1. Is the answer correct? (semantically, not keyword matching)
    2. Depth: none/shallow/deep
    3. If correct but wrong terminology, provide correction
    4. Feedback for the student
  `;

  // If answer is correct but uses wrong terms:
  // "You've got the concept! Just a terminology note: we call this
  //  'ownership transfer' rather than 'passing the value'. But your
  //  understanding is correct!"
}
```

### 2. Spaced Repetition System (SRS)

**Purpose:** Optimize long-term retention by scheduling reviews at optimal intervals

#### Algorithm: FSRS (Free Spaced Repetition Scheduler)

**Library:** `ts-fsrs` (npm package) - Modern algorithm used by Anki

**Why FSRS over SM-2:**
- More accurate retention predictions based on research
- Better handling of varying difficulty levels
- Actively maintained and used by Anki
- Simpler API, less manual parameter tuning

**Rating Scale:**
```typescript
import { Rating } from 'ts-fsrs';

// Rating.Again (1) - Complete failure, couldn't recall
// Rating.Hard (2)  - Recalled with significant difficulty
// Rating.Good (3)  - Recalled correctly with some effort
// Rating.Easy (4)  - Recalled instantly, felt easy
```

#### Scheduling Strategy

**Initial Learning:**
```
New concept → First question
User rates response → FSRS calculates next review
Typical progression:
  - Again → Review in minutes/hours
  - Hard → Review in 1-2 days
  - Good → Review in 1-4 days
  - Easy → Review in 4+ days
```

**Review Prioritization:**
- Oldest due first (items overdue longest get priority)
- Maximum 20 items per review session to prevent fatigue

#### Implementation

**File:** `lib/learning/spaced-repetition.ts`

```typescript
import { fsrs, createEmptyCard, Rating, Card } from 'ts-fsrs';

interface ReviewItem {
  id: string;
  topicId: string;
  subtopicId?: string;
  conceptId?: string;
  type: "topic" | "subtopic" | "concept";

  // FSRS card state (stored in DB, maps to ts-fsrs Card)
  card: Card;

  lastReviewed: Date;
  nextReview: Date;
  status: "new" | "learning" | "review" | "relearning";
}

class SpacedRepetitionScheduler {
  private f = fsrs(); // Initialize FSRS with default parameters

  scheduleNextReview(card: Card, rating: Rating): Card {
    const schedulingCards = this.f.repeat(card, new Date());
    return schedulingCards[rating].card;
  }

  async getReviewsDue(userId: string): Promise<ReviewItem[]> {
    // Fetch all items where nextReview <= now
    // Order by: oldest due first (overdue items prioritized)
    return await prisma.review.findMany({
      where: {
        userId,
        nextReview: { lte: new Date() }
      },
      orderBy: { nextReview: 'asc' }, // Oldest due first
      take: 20 // Limit per session
    });
  }

  async createReviewItem(
    userId: string,
    itemId: string,
    itemType: "topic" | "subtopic" | "concept"
  ): Promise<ReviewItem> {
    const card = createEmptyCard();
    return await prisma.review.create({
      data: {
        userId,
        [`${itemType}Id`]: itemId,
        type: itemType,
        nextReview: card.due,
        // Store FSRS card fields
        stability: card.stability,
        difficulty: card.difficulty,
        state: card.state,
      }
    });
  }

  async recordReview(
    reviewId: string,
    rating: Rating
  ): Promise<ReviewItem> {
    const review = await prisma.review.findUnique({ where: { id: reviewId } });
    const card = this.reconstructCard(review);
    const nextCard = this.scheduleNextReview(card, rating);

    return await prisma.review.update({
      where: { id: reviewId },
      data: {
        lastReviewed: new Date(),
        nextReview: nextCard.due,
        lastRating: rating,
        stability: nextCard.stability,
        difficulty: nextCard.difficulty,
        reps: nextCard.reps,
        lapses: nextCard.lapses,
        state: nextCard.state,
      }
    });
  }
}
```

#### Review Session Flow

```typescript
const MAX_REVIEWS_PER_SESSION = 20;

async function conductReviewSession(userId: string): Promise<ReviewSession> {
  // 1. Get all due reviews (oldest first, max 20)
  const dueReviews = await srs.getReviewsDue(userId);

  if (dueReviews.length === 0) {
    return { status: 'no_reviews_due' };
  }

  // 2. For each review, ask 2-3 questions
  const questions = await generateReviewQuestions(dueReviews);

  // 3. User answers, map to FSRS rating:
  //    - All correct easily → Rating.Easy
  //    - All correct with effort → Rating.Good
  //    - Some struggle → Rating.Hard
  //    - Failed → Rating.Again

  // 4. Update review schedule using FSRS

  // 5. Show summary:
  // - Items reviewed
  // - Items that need relearning (Rating.Again)
  // - Next review date
}
```

### 3. Adaptive Difficulty System

**Purpose:** Adjust question difficulty dynamically based on user performance

#### Difficulty Levels

**Level 1: Beginner**
- Recall questions
- Simple examples
- Heavy scaffolding
- Multiple hints available

**Level 2: Intermediate**
- Understanding questions
- Moderate examples
- Some scaffolding
- Hints on request

**Level 3: Advanced**
- Application questions
- Real-world examples
- Minimal scaffolding
- Hints only if stuck

**Level 4: Expert**
- Analysis questions
- Complex scenarios
- No scaffolding
- Self-guided

**Level 5: Master**
- Synthesis questions
- Novel problems
- Teaching others
- Creating examples

#### Adaptation Algorithm

**File:** `lib/learning/difficulty-adjuster.ts`

```typescript
interface PerformanceMetrics {
  recentAnswers: Answer[]; // Last 10-20 answers
  averageAccuracy: number; // 0-100
  averageTimeToAnswer: number; // Seconds
  hintsUsed: number;
  questionsSkipped: number;
}

class DifficultyAdjuster {
  calculateDifficulty(metrics: PerformanceMetrics): number {
    // Factors:
    // 1. Accuracy rate (primary)
    const accuracyScore = this.scoreAccuracy(metrics.averageAccuracy);

    // 2. Speed (secondary)
    const speedScore = this.scoreSpeed(metrics.averageTimeToAnswer);

    // 3. Hints used (penalty)
    const hintPenalty = metrics.hintsUsed * 0.1;

    // 4. Skips (penalty)
    const skipPenalty = metrics.questionsSkipped * 0.2;

    // Weighted formula
    const score = (accuracyScore * 0.7) + (speedScore * 0.3) - hintPenalty - skipPenalty;

    return this.mapScoreToDifficulty(score);
  }

  private scoreAccuracy(accuracy: number): number {
    // 90%+ → increase difficulty
    // 70-90% → maintain difficulty
    // 50-70% → slight decrease
    // <50% → significant decrease
  }

  private mapScoreToDifficulty(score: number): number {
    // Map 0-100 score to 1-5 difficulty level
    if (score >= 90) return 5;
    if (score >= 75) return 4;
    if (score >= 60) return 3;
    if (score >= 40) return 2;
    return 1;
  }

  shouldAdjust(currentDifficulty: number, performance: PerformanceMetrics): boolean {
    // Only adjust after minimum sample size (10 questions)
    // Only adjust if consistent pattern (not one-off)
    // Don't adjust too frequently (wait at least 5 questions)
  }
}
```

#### Difficulty Transitions

```
User starts at Level 2 (Intermediate)
  ↓
After 10 questions, assess:
  - 80%+ accuracy → Level 3
  - 50-80% accuracy → Stay at Level 2
  - <50% accuracy → Level 1
  ↓
Every 10 questions, reassess
  ↓
Can move up/down one level at a time
  ↓
Difficulty is per-subtopic (not global)
```

### 4. Gap Detection & Prerequisite Teaching

**Purpose:** Identify foundational knowledge gaps and teach prerequisites before advancing

#### Gap Detection Algorithm

**File:** `lib/learning/gap-detector.ts`

```typescript
interface KnowledgeGap {
  conceptId: string;
  conceptName: string;
  severity: "minor" | "moderate" | "critical";
  evidence: string[]; // User's incorrect answers that revealed gap
  prerequisiteConcepts: Concept[];
}

class GapDetector {
  async detectGaps(
    incorrectAnswers: Answer[],
    currentConcept: Concept
  ): Promise<KnowledgeGap[]> {
    // 1. Analyze incorrect answers with LLM
    const analysis = await this.analyzeWithLLM(incorrectAnswers);

    // 2. Identify misconceptions
    const misconceptions = this.extractMisconceptions(analysis);

    // 3. Map misconceptions to missing prerequisite concepts
    const gaps = await this.mapToPrerequisites(misconceptions, currentConcept);

    // 4. Rank by severity
    return this.rankBySeverity(gaps);
  }

  private async analyzeWithLLM(answers: Answer[]): Promise<string> {
    // Prompt LLM:
    // "User is learning [concept]. They gave these incorrect answers:
    //  [answers]. What foundational concepts are they missing?"
  }

  private async mapToPrerequisites(
    misconceptions: string[],
    currentConcept: Concept
  ): Promise<KnowledgeGap[]> {
    // Query database for prerequisite relationships
    // E.g., Concept "Borrowing" requires "Ownership" and "References"
  }

  shouldTeachPrerequisite(gap: KnowledgeGap): boolean {
    // Critical gaps → Immediately teach prerequisite
    // Moderate gaps → Offer quick refresher
    // Minor gaps → Provide hint and continue
  }
}
```

#### Prerequisite Teaching Flow

```
User struggling with "Lifetimes"
  ↓
Detect gap: Doesn't understand "Borrowing"
  ↓
Sensie: "Young one, I see you're confused about lifetimes.
        But this confusion stems from a gap in borrowing.
        Let's revisit borrowing first, then lifetimes will be clearer."
  ↓
Quick assessment on Borrowing (3-5 questions)
  ↓
If still gaps → Full re-teach of Borrowing
If minor gaps → Refresher + continue to Lifetimes
  ↓
Return to Lifetimes with stronger foundation
```

### 5. Feynman Technique Implementation

**Purpose:** Test deep understanding by requiring simple explanations

#### The Feynman Technique Steps

1. **Choose Concept:** User has "mastered" a concept (80%+ questions correct)
2. **Explain Simply:** "Explain X to me like I'm 10 years old"
3. **Identify Gaps:** Sensie asks probing questions about the explanation
4. **Simplify & Refine:** User refines explanation based on questions
5. **Use Analogies:** User must create analogies for complex parts

#### Implementation

**File:** `lib/learning/feynman-technique.ts`

```typescript
interface FeynmanExercise {
  conceptId: string;
  prompt: string; // "Explain X like I'm 10"
  userExplanation: string;
  feedback: {
    clearParts: string[];
    unclearParts: string[];
    missingParts: string[];
    probingQuestions: string[];
  };
  iterations: number;
  completed: boolean;
}

class FeynmanTechniqueEngine {
  async initiateExercise(conceptId: string): Promise<FeynmanExercise> {
    return {
      conceptId,
      prompt: `Excellent progress on [concept]! Now, the ultimate test:

      Explain [concept] to me like I'm 10 years old. Use simple words, no jargon.

      Remember: If you can't explain it simply, you don't understand it well enough.`,
      // ...
    };
  }

  async evaluateExplanation(
    exercise: FeynmanExercise,
    explanation: string
  ): Promise<{
    feedback: FeynmanExercise["feedback"];
    shouldContinue: boolean;
  }> {
    // Use LLM to evaluate:
    // 1. Is explanation simple enough for a child?
    // 2. Is it accurate?
    // 3. What's missing?
    // 4. What needs clarification?

    // Generate probing questions for unclear parts
  }

  async generateProbingQuestion(unclearPart: string): Promise<string> {
    // Example:
    // User: "Closures remember things"
    // Sensie: "What do you mean by 'remember'? Where do they store what they remember?"
  }
}
```

#### Exercise Flow

```
User completes "Closures" subtopic (85% mastery)
  ↓
Sensie: "Time for the Feynman challenge! Explain closures like I'm 10."
  ↓
User attempts explanation
  ↓
Sensie asks 3-5 probing questions about unclear parts
  ↓
User refines explanation
  ↓
Repeat until explanation is clear, accurate, and simple
  ↓
Success: Boost mastery to 95%, unlock badge
```

### 6. Project-Based Learning Suggestions

**Purpose:** Apply learned concepts in real projects for deeper retention

#### Project Suggestion Algorithm

**File:** `lib/learning/project-suggester.ts`

```typescript
interface ProjectSuggestion {
  title: string;
  description: string;
  difficulty: number;
  concepts: Concept[]; // Concepts this project reinforces
  estimatedTime: string;
  learningObjectives: string[];
  hints: string[];
}

class ProjectSuggester {
  async suggestProject(
    userId: string,
    recentlyLearnedConcepts: Concept[]
  ): Promise<ProjectSuggestion> {
    // 1. Get user's current projects (from DB)
    const userProjects = await db.projects.findMany({ where: { userId } });

    // 2. Suggest project that:
    //    - Uses recently learned concepts
    //    - Fits user's existing project context
    //    - Appropriate difficulty
    //    - Builds on previous projects

    // 3. Use LLM to generate creative project idea
  }

  async checkProjectProgress(
    projectId: string,
    codeSubmitted: string
  ): Promise<{
    conceptsApplied: string[];
    feedback: string;
    nextSteps: string[];
  }> {
    // User can submit code, Sensie reviews:
    // - Did they apply the concepts correctly?
    // - Any misconceptions in code?
    // - Suggestions for improvement
  }
}
```

#### Example Project Suggestions

**After learning Rust Ownership:**
```
Project: "Build a Simple Text Editor Buffer"

Description:
Create a text buffer that handles insertions, deletions, and undo/redo.
This will test your understanding of ownership, borrowing, and lifetimes.

Learning Objectives:
- Understand ownership transfer in data structures
- Practice borrowing rules in mutable contexts
- Implement lifetimes for string slices

Hints:
- Start with a Vec<String> for lines
- Implement methods that borrow vs take ownership
- Use lifetimes for cursor positions

Estimated Time: 2-3 hours
```

### 7. Mastery Calculation

**Purpose:** Accurately represent user's understanding as a percentage

#### Mastery Formula

```typescript
function calculateMastery(
  topicId: string,
  userId: string
): number {
  // Factor 1: Questions answered correctly (60% weight)
  const questionAccuracy =
    (correctAnswers / totalQuestions) * 0.6;

  // Factor 2: Concepts completed (20% weight)
  const conceptCompletion =
    (completedConcepts / totalConcepts) * 0.2;

  // Factor 3: Review performance (10% weight)
  const reviewPerformance =
    (successfulReviews / totalReviews) * 0.1;

  // Factor 4: Recency (10% weight, decay factor)
  const daysSinceLastActivity = getDaysSince(lastActivity);
  const recencyFactor = Math.max(0, 1 - (daysSinceLastActivity / 90)) * 0.1;

  // Total mastery (0-100)
  return (questionAccuracy + conceptCompletion + reviewPerformance + recencyFactor) * 100;
}
```

#### Mastery Levels

- **0-20%:** Just Started
- **20-40%:** Learning
- **40-60%:** Understanding
- **60-80%:** Proficient
- **80-95%:** Mastered
- **95-100%:** Expert

#### User-Configurable Mastery Threshold

**Purpose:** Let users define when a topic is considered "complete"

```typescript
interface UserPreferences {
  masteryThreshold: number; // 50, 70, 80 (default), 90, or 100
}

function isTopicMastered(mastery: number, userPrefs: UserPreferences): boolean {
  return mastery >= userPrefs.masteryThreshold;
}

// Threshold affects:
// 1. When Feynman technique is triggered
// 2. When topic moves to "Completed" status
// 3. Review scheduling (higher threshold = more intense reviews)
// 4. Achievement unlocks ("Topic Mastered" badge)
```

**UI:** Slider in Settings (50% → 100%, default 80%)

#### Decay Over Time

```
Mastery decays if not reviewed:
- No decay for first 14 days
- -1% per week after 14 days
- -2% per week after 60 days
- Stops at 40% (understanding level)
- Review brings mastery back up
```

### 8. Content Caching Strategy

**Purpose:** Balance consistency with freshness in teaching content

**Principle:** "Core content cached, examples/analogies fresh per session"

#### What Gets Cached (Stable Content)

```typescript
interface CachedContent {
  conceptId: string;

  // Cached (stable explanations)
  coreExplanation: string;     // Main concept explanation
  keyPoints: string[];          // Essential facts
  commonMisconceptions: string[]; // What learners often get wrong
  prerequisites: string[];      // Required prior knowledge

  // Cached metadata
  cachedAt: Date;
  cacheVersion: number;        // Invalidate on curriculum updates
}
```

**Why Cache:**
- Core explanations for fundamental concepts rarely change
- Ensures consistency across sessions
- Reduces LLM costs significantly
- Faster response times

#### What Gets Generated Fresh (Dynamic Content)

```typescript
interface FreshContent {
  // Generated per session
  codeExamples: CodeExample[];  // Fresh examples using user's context
  analogies: string[];          // Varied analogies to avoid repetition
  realWorldApplications: string[]; // Current, relevant applications

  // Personalized to user
  difficultyLevel: number;      // Based on user's current performance
  questionStyle: string;        // Adapted to user's learning patterns
  encouragementStyle: string;   // Based on personality settings
}
```

**Why Fresh:**
- Examples benefit from variety (avoid memorization without understanding)
- Analogies should connect to user's current context
- Questions should test understanding, not memory of specific examples
- Keeps learning engaging across repeated sessions

#### Implementation

**File:** `lib/learning/content-cache.ts`

```typescript
class ContentCache {
  // Check cache first for core explanations
  async getConceptExplanation(conceptId: string): Promise<CachedContent | null> {
    const cached = await prisma.conceptCache.findUnique({
      where: { conceptId }
    });

    // Invalidate if too old (30 days) or version mismatch
    if (cached && this.isValid(cached)) {
      return cached;
    }

    return null;
  }

  // Always generate fresh examples
  async generateFreshExamples(
    concept: Concept,
    userContext: UserContext
  ): Promise<CodeExample[]> {
    return await llm.generate({
      prompt: buildExamplePrompt(concept, userContext),
      // No caching - always fresh
    });
  }

  // Hybrid approach for teaching
  async getTeachingContent(
    conceptId: string,
    userContext: UserContext
  ): Promise<TeachingContent> {
    // 1. Get cached core explanation
    const cached = await this.getConceptExplanation(conceptId);
    const coreExplanation = cached?.coreExplanation
      ?? await this.generateAndCacheExplanation(conceptId);

    // 2. Generate fresh examples and analogies
    const freshExamples = await this.generateFreshExamples(concept, userContext);
    const freshAnalogies = await this.generateFreshAnalogies(concept, userContext);

    return {
      explanation: coreExplanation,
      examples: freshExamples,
      analogies: freshAnalogies,
      keyPoints: cached?.keyPoints ?? [],
    };
  }
}
```

#### Cache Invalidation

```typescript
// Invalidate when:
// 1. Curriculum updates (concept.updatedAt > cache.cachedAt)
// 2. Manual refresh requested by user
// 3. Poor teaching outcomes detected (low accuracy on questions)
// 4. Cache age > 30 days

async function shouldInvalidateCache(cached: CachedContent): boolean {
  const concept = await prisma.concept.findUnique({ where: { id: cached.conceptId } });

  return (
    concept.updatedAt > cached.cachedAt ||
    daysSince(cached.cachedAt) > 30 ||
    (await hasLowTeachingAccuracy(cached.conceptId))
  );
}
```

#### Cost Savings

**Without caching (all fresh):**
- ~500 tokens per concept explanation
- At $0.01/1K tokens (GPT-4o), costs add up

**With caching:**
- Core explanations: Cached (0 tokens after first generation)
- Examples/analogies: ~200 tokens per session
- **~60% reduction in LLM costs**

## Integration: How Components Work Together

### Complete Learning Flow Example

**Scenario:** User wants to learn Rust Ownership

```
1. START LEARNING
   User: "Teach me Rust ownership"
   ↓
   Sensie: "Excellent choice! Before we begin, let me assess your foundation."
   ↓
   Socratic Engine generates foundational question
   ↓

2. INITIAL ASSESSMENT
   Sensie: "What is a memory address?"
   User: [attempts answer]
   ↓
   Gap Detector analyzes answer
   ↓
   IF gap detected → Teach prerequisite (memory concepts)
   IF no gap → Proceed to ownership
   ↓

3. CONCEPT TEACHING
   Sensie explains ownership with examples
   ↓
   Immediately asks application question
   ↓
   Difficulty Adjuster sets initial difficulty based on answer
   ↓

4. SOCRATIC DIALOGUE
   Loop:
   - Sensie asks question (difficulty-appropriate)
   - User answers
   - Sensie evaluates (correct? shallow? wrong?)
   - If wrong → Guiding question
   - If shallow → "Why?" question
   - If correct → Deeper question
   ↓
   Continue until 3 correct deep answers in a row
   ↓

5. SUBTOPIC COMPLETION
   Mark "Ownership Basics" as complete
   Update mastery: 30% → 50%
   ↓
   Schedule first review (1 day from now)
   ↓

6. UNLOCK NEXT SUBTOPIC
   "Borrowing" unlocked
   User can proceed or take break
   ↓

7. SPACED REPETITION (1 day later)
   Sensie: "Review time! Let's test your memory on ownership."
   ↓
   Ask 3-5 ownership questions
   ↓
   User answers, SRS records quality
   ↓
   IF quality >= 3 → Next review in 6 days
   IF quality < 3 → Re-teach, review in 1 day
   ↓

8. CONTINUE LEARNING
   User progresses through Borrowing, Lifetimes, References
   ↓
   Difficulty increases as performance improves
   ↓

9. TOPIC COMPLETION (80% mastery)
   Sensie: "You've reached 80% mastery! Time for the Feynman challenge."
   ↓
   Feynman Exercise: Explain ownership simply
   ↓
   Success → Mastery: 95%
   ↓

10. PROJECT SUGGESTION
    Sensie: "Ready to apply your knowledge? Try this project..."
    ↓
    User builds project, Sensie reviews code
    ↓
    Project completion → Mastery: 100%, Topic "Mastered"
```

## Observability & Analytics

### Track Learning Effectiveness

**Metrics to Track:**
- Average time to mastery per topic
- Question accuracy over time
- Concepts requiring re-teaching (gap frequency)
- Review adherence rate
- Difficulty progression
- Feynman exercise completion rate

**Implementation:** Use Langfuse to trace each learning session

```typescript
const trace = langfuse.trace({
  name: "learning-session",
  userId: user.id,
  metadata: {
    topicId,
    subtopicId,
    initialMastery,
    finalMastery,
    questionsAsked: 10,
    questionsCorrect: 7,
    gapsDetected: 1,
    hintsUsed: 2,
  }
});
```

---

**Next Steps:**
1. Implement Socratic Engine with Mastra
2. Build SRS scheduler
3. Create difficulty adjuster
4. Test gap detection accuracy
5. Build Feynman exercise flow

**Last Updated:** 2026-01-05
