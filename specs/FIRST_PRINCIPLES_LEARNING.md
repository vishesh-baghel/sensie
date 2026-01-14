# First Principles Learning for Sensie

## Executive Summary

This specification describes the implementation of **First Principles Learning** - a teaching method that forces learners to derive understanding from fundamental truths rather than memorizing patterns. This feature enhances Sensie's existing Socratic method with deeper cognitive demands: decomposition, derivation, and assumption challenging.

**Core Philosophy:** "Don't tell me what you know - derive it from basics as if inventing it for the first time."

**Last Updated:** 2026-01-14

---

## Table of Contents

1. [What is First Principles Thinking?](#what-is-first-principles-thinking)
2. [Why First Principles for Sensie?](#why-first-principles-for-sensie)
3. [How It Differs from Current Teaching](#how-it-differs-from-current-teaching)
4. [Core Components](#core-components)
5. [First Principles Engine](#first-principles-engine)
6. [Question Types](#question-types)
7. [Teaching Flow](#teaching-flow)
8. [Database Schema](#database-schema)
9. [API Design](#api-design)
10. [User Experience](#user-experience)
11. [Integration with Existing Features](#integration-with-existing-features)
12. [Master Roshi Personality](#master-roshi-personality)
13. [Implementation Phases](#implementation-phases)
14. [Risk Mitigation](#risk-mitigation)

---

## What is First Principles Thinking?

First principles thinking is a reasoning approach that involves:

### Definition

**First Principles Thinking** = Breaking down problems to their most fundamental truths (axioms) and reasoning up from there, rather than reasoning by analogy or accepting existing patterns.

### The Three Pillars

```
┌────────────────────────────────────────────────────────────────────┐
│                    FIRST PRINCIPLES THINKING                        │
├────────────────┬────────────────────┬──────────────────────────────┤
│  DECOMPOSE     │      DERIVE        │        CHALLENGE             │
│                │                    │                              │
│  Break into    │  Build up from     │  Question every              │
│  atomic parts  │  fundamentals      │  assumption                  │
│                │                    │                              │
│  "What are the │  "Starting from X, │  "Why do you assume          │
│  basic pieces  │  how do you get    │  that to be true?"           │
│  of this?"     │  to Y?"            │                              │
└────────────────┴────────────────────┴──────────────────────────────┘
```

### Real-World Example

**Topic: Why are rockets so expensive?**

**Reasoning by Analogy (what most do):**
"Rockets have always been expensive. SpaceX made them cheaper by 10x. That's impressive."

**First Principles Reasoning:**
1. What is a rocket made of? (Decompose)
   - Aluminum, titanium, copper, carbon fiber, etc.
2. What do these materials cost? (Identify axioms)
   - ~2% of the rocket's price
3. Why the 50x markup? (Challenge assumptions)
   - Because "that's how aerospace works"
4. Derive: If materials are 2%, where does 98% go?
   - Labor, inefficiency, single-use design
5. Solution: What if we questioned single-use? (Reconstruct)
   - Reusable rockets → 10x cost reduction

---

## Why First Principles for Sensie?

### The Problem with "Knowing"

Most learners think they understand something when they can:
- Recall the definition ✗
- Recognize patterns ✗
- Apply to similar problems ✗

But true understanding means:
- Derive from fundamentals ✓
- Explain why it must be this way ✓
- Invent it yourself if it didn't exist ✓

### The Sensie Opportunity

Sensie already uses Socratic questioning to probe understanding. First principles takes this deeper:

| Current Capability | First Principles Enhancement |
|-------------------|------------------------------|
| "What is a closure?" | "What problem would require closures to exist?" |
| "Explain borrowing" | "Derive borrowing from the axiom: memory must be managed" |
| "Why does this error?" | "What fundamental rule is being violated?" |
| Feynman: Explain simply | FP: Derive as if inventing |

### Alignment with Sensie Philosophy

From OVERVIEW.md:
> "True mastery comes not from being told, but from discovering through guided questioning."

First principles is the ultimate expression of this: **You haven't truly learned until you can derive it from scratch.**

---

## How It Differs from Current Teaching

### Teaching Method Comparison

```
TRADITIONAL TEACHING
────────────────────
Explain → Example → Test → Repeat
Result: Memorization and pattern matching

SOCRATIC METHOD (Current Sensie)
────────────────────────────────
Test → Detect Gap → Guide with Questions → Test Again
Result: Active understanding, catches shallow knowledge

FIRST PRINCIPLES (New)
──────────────────────
Decompose → Identify Axioms → Derive → Challenge Assumptions → Reconstruct
Result: Deep understanding, ability to derive from scratch
```

### Concrete Example: Teaching "Ownership in Rust"

**Socratic (Current):**
```
Sensie: "What happens when you assign x to y in Rust?"
User: "The value moves to y and x becomes invalid"
Sensie: "Good! Why do you think Rust does this?"
User: "To prevent double-free bugs"
Sensie: "Excellent understanding!"
```

**First Principles (New):**
```
Sensie: "Let's derive ownership from scratch. What fundamental
        problem exists with memory management?"

User: "We need to know when to free memory"

Sensie: "Good. Now, what are the possible approaches? List
        them from first principles - don't tell me what you
        know about garbage collectors or ownership. Derive
        the possibilities."

User: "Either: 1) track all references and free when none remain,
      2) have one owner and free when they're done, or 3) let
      the programmer manage it manually"

Sensie: "You've derived the three major approaches! Now, what
        axiom must be true for approach #2 to prevent bugs?"

User: "There can only be one owner at a time?"

Sensie: "You're assuming 'owner' is well-defined. Challenge that.
        What does ownership actually mean at the fundamental level?"

User: "The... responsibility to free memory? So ownership means
      whoever frees it?"

Sensie: "Hohoho! You just derived Rust's ownership model from
        first principles! You didn't recall it - you invented it."
```

---

## Core Components

### 1. First Principles Engine

The core engine that powers first principles teaching:

```typescript
interface FirstPrinciplesEngine {
  // Decompose a concept into atomic parts
  decomposeConcept(conceptId: string): Promise<AtomicPart[]>;

  // Identify fundamental axioms a concept depends on
  identifyAxioms(conceptId: string): Promise<Axiom[]>;

  // Generate a derivation challenge
  generateDerivationChallenge(
    concept: Concept,
    axioms: Axiom[]
  ): Promise<DerivationChallenge>;

  // Challenge an assumption in user's response
  challengeAssumption(
    userResponse: string,
    concept: Concept
  ): Promise<AssumptionChallenge>;

  // Evaluate if explanation derives from first principles
  evaluateDerivation(
    derivation: string,
    concept: Concept,
    axioms: Axiom[]
  ): Promise<DerivationEvaluation>;
}
```

### 2. Atomic Parts

Breaking concepts into their smallest components:

```typescript
interface AtomicPart {
  id: string;
  name: string;
  description: string;
  order: number;        // Dependency order (what must come first)
  dependencies: string[]; // IDs of atomic parts this depends on
  relatedAxioms: Axiom[];
}
```

**Example - Closure Atomic Parts:**
```
1. Function (can exist independently)
2. Variable (can exist independently)
3. Scope (depends on: function, variable)
4. Lexical Environment (depends on: scope)
5. Function Reference (depends on: function)
6. Environment Capture (depends on: lexical environment, function reference)
7. Closure (depends on: all above)
```

### 3. Axioms (Fundamental Truths)

Self-evident truths that concepts are built upon:

```typescript
interface Axiom {
  id: string;
  name: string;
  statement: string;     // The fundamental truth
  domain: string;        // "memory", "concurrency", "types", etc.
  isUniversal: boolean;  // True for axioms that apply across languages
}
```

**Example Axioms:**
```
MEMORY_FINITE: "Computer memory is a finite resource"
MEMORY_CLEANUP: "Allocated memory must eventually be freed"
SCOPE_HIERARCHY: "Code exists within nested scopes"
ONE_OWNER: "A resource can have only one owner at a time"
PURE_FUNCTION: "A pure function's output depends only on its inputs"
```

### 4. Derivation Challenges

Questions that require deriving from first principles:

```typescript
interface DerivationChallenge {
  id: string;
  conceptId: string;
  prompt: string;           // The derivation question
  givenAxioms: Axiom[];     // What they start with
  expectedDerivation: string[]; // Steps to derive (for evaluation)
  forbiddenTerms: string[]; // Terms that indicate recall vs derivation
  difficulty: 1 | 2 | 3 | 4 | 5;
}
```

### 5. Assumption Challenges

Probing questions that challenge unstated assumptions:

```typescript
interface AssumptionChallenge {
  id: string;
  quotedText: string;     // The part of their answer being challenged
  assumption: string;     // The implicit assumption
  challenge: string;      // The question challenging it
  resolution: string;     // How to resolve (for evaluation)
}
```

---

## Question Types

### New First Principles Question Types

```typescript
type FirstPrinciplesQuestionType =
  | 'DECOMPOSITION'       // Break into atomic parts
  | 'AXIOM_IDENTIFICATION' // What fundamental truths apply?
  | 'DERIVATION'          // Derive from basics
  | 'ASSUMPTION_CHALLENGE' // Challenge an assumption
  | 'RECONSTRUCTION'      // Rebuild from scratch
  | 'COUNTER_FACTUAL'     // What if this axiom were false?
  | 'INVENTION'           // If this didn't exist, how would you create it?
```

### Question Type Examples

#### DECOMPOSITION
```
"What are the most basic parts that make up a 'Promise' in JavaScript?
 List them in order of dependencies - what must exist first?"
```

#### AXIOM_IDENTIFICATION
```
"What fundamental truths about computation must be true for
 async/await to work? List the axioms."
```

#### DERIVATION
```
"Given these axioms:
 1. Code can be paused and resumed
 2. Results may arrive in the future
 3. Errors can occur asynchronously

 Derive how a Promise must work. Don't tell me what you know -
 derive it from these principles."
```

#### ASSUMPTION_CHALLENGE
```
User said: "Promises chain because each .then() returns a new Promise"

Sensie: "You're assuming that returning a new Promise is the ONLY
        way to enable chaining. Challenge that assumption - could
        chaining work differently? Why or why not?"
```

#### RECONSTRUCTION
```
"Forget everything you know about state management in React.
 Starting from the problem 'UI must reflect data changes',
 derive a state management solution from first principles."
```

#### COUNTER_FACTUAL
```
"What if the axiom 'memory is finite' were false? How would
 Rust's ownership model change? Would it even exist?"
```

#### INVENTION
```
"Pretend TypeScript doesn't exist. You have JavaScript and
 the problem 'catch type errors before runtime'. Invent a
 solution from first principles."
```

---

## Teaching Flow

### Complete First Principles Learning Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FIRST PRINCIPLES LEARNING FLOW                    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 1: DECOMPOSITION                                              │
│                                                                      │
│  Sensie: "Let's break [CONCEPT] into its atomic parts.              │
│          What are the most basic components?"                        │
│                                                                      │
│  User attempts decomposition                                         │
│                                                                      │
│  Sensie evaluates:                                                   │
│  ├─ Missing parts? → Guide to discover them                         │
│  ├─ Wrong order? → Challenge dependencies                           │
│  └─ Complete? → Proceed to Phase 2                                  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 2: AXIOM IDENTIFICATION                                       │
│                                                                      │
│  Sensie: "What fundamental truths must be true for these            │
│          parts to exist? List the axioms."                          │
│                                                                      │
│  User identifies axioms                                              │
│                                                                      │
│  Sensie evaluates:                                                   │
│  ├─ Too high-level? → Push for more fundamental truths              │
│  ├─ Missing key axiom? → Guide toward it                            │
│  └─ Good axioms? → Proceed to Phase 3                               │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 3: DERIVATION                                                 │
│                                                                      │
│  Sensie: "Starting ONLY from these axioms, derive how               │
│          [CONCEPT] must work. Don't recall - derive."               │
│                                                                      │
│  User attempts derivation                                            │
│                                                                      │
│  Sensie evaluates:                                                   │
│  ├─ Used recall instead of derivation? → Challenge                  │
│  ├─ Skipped steps? → Ask for missing reasoning                      │
│  ├─ Logical gap? → Point out and ask for fix                        │
│  └─ Valid derivation? → Proceed to Phase 4                          │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 4: ASSUMPTION CHALLENGING                                     │
│                                                                      │
│  Sensie: "You said [QUOTE]. What are you assuming there?            │
│          Can you justify that from first principles?"               │
│                                                                      │
│  User defends or revises assumption                                  │
│                                                                      │
│  Sensie evaluates:                                                   │
│  ├─ Weak justification? → Push deeper                               │
│  ├─ Invalid assumption? → Help correct                              │
│  └─ Strong justification? → Proceed to Phase 5                      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 5: RECONSTRUCTION                                             │
│                                                                      │
│  Sensie: "Excellent! Now, starting from scratch, rebuild            │
│          your complete understanding of [CONCEPT]."                 │
│                                                                      │
│  User provides full first-principles explanation                     │
│                                                                      │
│  Sensie evaluates:                                                   │
│  ├─ Incomplete? → Point out gaps, loop back                         │
│  ├─ Uses recall language? → Challenge to rephrase                   │
│  └─ Complete derivation? → MASTERY ACHIEVED                         │
└─────────────────────────────────────────────────────────────────────┘

                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  COMPLETION: FIRST PRINCIPLES MASTERY                                │
│                                                                      │
│  Sensie: "Hohoho! You didn't just learn [CONCEPT] - you             │
│          invented it from first principles! THAT is true mastery."  │
│                                                                      │
│  Rewards:                                                            │
│  ├─ +500 XP for First Principles completion                         │
│  ├─ Mastery boost (higher weight than regular questions)            │
│  └─ First Principles badge progress                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### Intensity Levels

Not every concept needs full first principles treatment:

```typescript
type FirstPrinciplesIntensity = 1 | 2 | 3 | 4;

// Level 1 - Light
// Regular Socratic with occasional "why" probes
// Phases: 1 (simple decomposition)
// Time: 5-10 minutes

// Level 2 - Moderate
// Require decomposition and basic derivation
// Phases: 1, 3 (decomposition + derivation)
// Time: 15-20 minutes

// Level 3 - Deep
// Full first principles treatment
// Phases: 1, 2, 3, 4, 5 (all phases)
// Time: 30-45 minutes

// Level 4 - Extreme ("Invent Mode")
// Derive as if concept didn't exist
// Phases: All + invention challenge
// Time: 45-60 minutes
```

### Triggering First Principles

```typescript
interface FirstPrinciplesTrigger {
  // Automatic triggers
  onMasteryThreshold: number;      // e.g., 70% - higher than Feynman

  // Manual triggers
  command: '/firstprinciples';

  // Smart triggers (LLM determines need)
  onShallowPatternMatching: boolean; // When user shows recall, not understanding
  onRepeatedMisconceptions: boolean; // Same error pattern

  // User preference
  alwaysUse: boolean;               // For hardcore learners
  neverUse: boolean;                // Opt-out
}
```

---

## Database Schema

### New Models

```prisma
// Atomic building blocks of concepts
model AtomicPart {
  id          String   @id @default(cuid())
  conceptId   String
  concept     Concept  @relation(fields: [conceptId], references: [id], onDelete: Cascade)

  name        String                // e.g., "Function Reference"
  description String   @db.Text     // What this atomic part is
  order       Int                   // Dependency order

  // Dependencies on other atomic parts
  dependencies  AtomicPartDependency[] @relation("dependent")
  dependents    AtomicPartDependency[] @relation("dependency")

  // Related axioms
  axioms        AtomicPartAxiom[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([conceptId, order])
}

model AtomicPartDependency {
  id            String     @id @default(cuid())
  dependentId   String
  dependencyId  String

  dependent     AtomicPart @relation("dependent", fields: [dependentId], references: [id], onDelete: Cascade)
  dependency    AtomicPart @relation("dependency", fields: [dependencyId], references: [id], onDelete: Cascade)

  @@unique([dependentId, dependencyId])
}

// Fundamental truths
model Axiom {
  id          String   @id @default(cuid())
  name        String   @unique       // e.g., "MEMORY_FINITE"
  statement   String   @db.Text      // "Computer memory is a finite resource"
  domain      String                 // "memory", "concurrency", "types", etc.
  isUniversal Boolean  @default(false) // Applies across all languages?

  // Relationships
  atomicParts AtomicPartAxiom[]
  exercises   FirstPrinciplesExerciseAxiom[]

  createdAt   DateTime @default(now())

  @@index([domain])
}

model AtomicPartAxiom {
  id           String     @id @default(cuid())
  atomicPartId String
  axiomId      String

  atomicPart   AtomicPart @relation(fields: [atomicPartId], references: [id], onDelete: Cascade)
  axiom        Axiom      @relation(fields: [axiomId], references: [id], onDelete: Cascade)

  @@unique([atomicPartId, axiomId])
}

// First principles exercises
model FirstPrinciplesExercise {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Can be for a concept, subtopic, or topic
  conceptId       String?
  concept         Concept? @relation(fields: [conceptId], references: [id])
  subtopicId      String?
  subtopic        Subtopic? @relation(fields: [subtopicId], references: [id])
  topicId         String
  topic           Topic    @relation(fields: [topicId], references: [id], onDelete: Cascade)

  // Exercise configuration
  intensity       Int      @default(3)  // 1-4
  targetName      String                // Name of what's being derived

  // Progress tracking
  status          FirstPrinciplesStatus @default(DECOMPOSING)
  currentPhase    Int      @default(1)  // Which phase (1-5)

  // User responses by phase
  decomposition        Json?     // User's atomic breakdown
  axiomIdentification  Json?     // User's identified axioms
  derivation           String?   @db.Text  // User's derivation
  assumptionChallenges Json?     // Challenges asked and responses
  reconstruction       String?   @db.Text  // Final reconstruction

  // Evaluation
  evaluation      Json?         // Overall evaluation
  score           Int?          // 0-100

  // Attempts and timing
  attempts        Int      @default(0)
  totalTimeSpent  Int      @default(0)  // Minutes

  // Axioms used in this exercise
  axioms          FirstPrinciplesExerciseAxiom[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  completedAt     DateTime?

  @@index([userId, status])
  @@index([topicId, status])
}

model FirstPrinciplesExerciseAxiom {
  id         String                    @id @default(cuid())
  exerciseId String
  axiomId    String

  exercise   FirstPrinciplesExercise   @relation(fields: [exerciseId], references: [id], onDelete: Cascade)
  axiom      Axiom                     @relation(fields: [axiomId], references: [id])

  @@unique([exerciseId, axiomId])
}

enum FirstPrinciplesStatus {
  DECOMPOSING           // Phase 1
  IDENTIFYING_AXIOMS    // Phase 2
  DERIVING              // Phase 3
  ASSUMPTION_CHALLENGE  // Phase 4
  RECONSTRUCTING        // Phase 5
  COMPLETED
  ABANDONED
}
```

### User Preferences Extension

```prisma
model UserPreferences {
  // ... existing fields ...

  // First Principles Settings
  firstPrinciplesEnabled    Boolean @default(true)
  firstPrinciplesIntensity  Int     @default(3)       // 1-4
  fpTriggerMastery          Int     @default(70)      // % to auto-trigger
  fpChallengePersistence    String  @default("moderate") // gentle|moderate|aggressive
  fpAutoTrigger             Boolean @default(true)    // Auto or manual only
}
```

### Indexes for Performance

```prisma
// Add to existing schema
model Concept {
  // ... existing fields ...

  atomicParts           AtomicPart[]
  firstPrinciplesExercises FirstPrinciplesExercise[]
}

model Subtopic {
  // ... existing fields ...

  firstPrinciplesExercises FirstPrinciplesExercise[]
}

model Topic {
  // ... existing fields ...

  firstPrinciplesExercises FirstPrinciplesExercise[]
}
```

---

## API Design

### Endpoints

```typescript
// Start a first principles exercise
POST /api/first-principles
Body: {
  topicId: string;
  conceptId?: string;
  subtopicId?: string;
  intensity?: 1 | 2 | 3 | 4;
}
Response: {
  exercise: FirstPrinciplesExercise;
  initialPrompt: string;
  phase: number;
}

// Get active first principles exercise
GET /api/first-principles?topicId={topicId}
Response: {
  exercise: FirstPrinciplesExercise | null;
  hasActive: boolean;
}

// Submit response for current phase
POST /api/first-principles/{exerciseId}/respond
Body: {
  response: string;
  phase: number;
}
Response: {
  evaluation: PhaseEvaluation;
  nextPrompt?: string;
  nextPhase?: number;
  isComplete: boolean;
  challenges?: AssumptionChallenge[];
}

// Get decomposition help
POST /api/first-principles/{exerciseId}/hint
Body: {
  phase: number;
  hintLevel: 1 | 2 | 3;
}
Response: {
  hint: string;
  remainingHints: number;
}

// Abandon exercise
POST /api/first-principles/{exerciseId}/abandon
Response: {
  success: boolean;
}

// Get axioms library
GET /api/axioms?domain={domain}
Response: {
  axioms: Axiom[];
}

// Get atomic parts for a concept
GET /api/concepts/{conceptId}/atomic-parts
Response: {
  atomicParts: AtomicPart[];
  dependencies: DependencyGraph;
}
```

### Chat Integration

```typescript
// Command handler for /firstprinciples
POST /api/chat/command
Body: {
  command: 'firstprinciples';
  args?: string; // Optional: concept name or intensity
}
Response: {
  message: string;
  exercise?: FirstPrinciplesExercise;
  action: 'started' | 'resumed' | 'none_available';
}
```

---

## User Experience

### Command: `/firstprinciples`

```
User: /firstprinciples

Sensie: "Ah, you want to test your true understanding!
        Let me check your progress...

        You have 3 concepts ready for first principles:

        1. Closures (85% mastery) - Recommended
        2. Ownership (78% mastery)
        3. Async/Await (72% mastery)

        Which would you like to derive from scratch?
        Or type '/firstprinciples closures' to start directly."
```

### Exercise Start

```
User: /firstprinciples closures

Sensie: "Excellent choice, apprentice! Let's see if you TRULY
        understand closures - not what you've memorized, but
        what you can derive.

        We'll work through 5 phases:
        1. Decompose closures into atomic parts
        2. Identify the fundamental axioms
        3. Derive how closures must work
        4. Challenge your assumptions
        5. Reconstruct your understanding

        Ready? Let's begin with decomposition.

        **Phase 1: Decomposition**

        What are the most basic, atomic parts that make up a closure?
        List them in order - what must exist first?

        (Don't rush. Think from basics, not memory.)"
```

### Phase Progression Example

```
User: "Functions, variables, and scope"

Sensie: "Good start! But those are high-level. Let's go deeper.

        You said 'scope'. What atomic parts make up scope itself?

        Remember: we're building from the ground up."

User: "Hmm... scope needs a way to look up names, a parent reference
      for outer scopes, and... storage for variables?"

Sensie: "Now you're thinking atomically!

        So far you have:
        1. Variable (can store a value)
        2. Name binding (connects a name to a variable)
        3. Scope (collection of bindings with parent reference)
        4. Name lookup (searching scopes for a binding)
        5. Function (sequence of code that can execute)

        What's still missing? What does a closure have that a
        regular function doesn't?"

User: "The closure keeps a reference to variables from outside itself..."

Sensie: "Yes! But be precise. WHAT keeps that reference?

        Here's a challenge: explain what must physically exist
        (in computer terms) for a function to 'remember' outer
        variables after the outer function is gone."

User: "There has to be some object or structure that holds
      both the function code AND the variables it captured.
      So... an environment object that's attached to the function?"

Sensie: "Hohoho! You just derived the lexical environment concept!

        Your atomic parts:
        1. Variable
        2. Name binding
        3. Scope (with parent chain)
        4. Name lookup
        5. Function definition
        6. Lexical environment (snapshot of scope)
        7. Function + Environment bundle = Closure

        Well done. Phase 1 complete! Let's move to axioms.

        **Phase 2: Axiom Identification**

        For closures to exist, what fundamental truths must be true?
        What axioms is this entire system built upon?"
```

### Settings UI

```
First Principles Settings
─────────────────────────

[x] Enable First Principles exercises

Intensity Level
[ ] Light (quick decomposition only)
[x] Moderate (decomposition + derivation)
[ ] Deep (all 5 phases)
[ ] Extreme (invention mode)

Auto-trigger at mastery: [70]%

Challenge Persistence
[ ] Gentle (accept reasonable answers)
[x] Moderate (push for depth on key points)
[ ] Aggressive (challenge everything)

[ ] Auto-trigger first principles
    (When unchecked, use /firstprinciples manually)
```

---

## Integration with Existing Features

### Socratic Engine Integration

First principles extends the Socratic engine:

```typescript
// In socratic-engine.ts

// Extend question types
type QuestionType =
  | 'RECALL'
  | 'UNDERSTANDING'
  | 'APPLICATION'
  | 'ANALYSIS'
  | 'SYNTHESIS'
  // NEW: First Principles types
  | 'FP_DECOMPOSITION'
  | 'FP_AXIOM_ID'
  | 'FP_DERIVATION'
  | 'FP_CHALLENGE'
  | 'FP_RECONSTRUCTION';

// Extend answer evaluation
async function evaluateAnswer(
  answer: string,
  question: SocraticQuestion,
  context: SocraticContext
): Promise<AnswerEvaluation> {
  // If first principles question, use FP evaluation
  if (question.type.startsWith('FP_')) {
    return evaluateFirstPrinciplesResponse(answer, question, context);
  }

  // Existing evaluation logic...
}
```

### Feynman Technique Integration

First principles becomes a Feynman variant:

```typescript
// In feynman-engine.ts

type FeynmanVariant =
  | 'child'      // Explain to a 10-year-old
  | 'beginner'   // Explain to a beginner
  | 'peer'       // Explain to a fellow dev
  | 'first_principles'; // Derive from scratch

// New prompt for first principles Feynman
export function getFeynmanFirstPrinciplesPrompt(conceptName: string): string {
  return `**Feynman Challenge: First Principles Edition**

You've mastered ${conceptName}. But can you INVENT it?

Pretend ${conceptName} doesn't exist. Starting from basic
truths about programming:

1. What problem would require this concept?
2. What are the possible solutions?
3. Why is the actual solution optimal?

Derive ${conceptName} as if you're inventing it for the first time.
Don't recall - CREATE.`;
}
```

### Gap Detection Enhancement

First principles reveals deeper gaps:

```typescript
// In gap-detector.ts

interface KnowledgeGap {
  // Existing fields...

  // NEW: First principles specific
  atomicGap?: string;     // Missing atomic understanding
  axiomGap?: string;      // Missing fundamental truth
  derivationGap?: string; // Can't derive, only recall
}

async function detectFirstPrinciplesGaps(
  exerciseId: string
): Promise<KnowledgeGap[]> {
  const exercise = await getExercise(exerciseId);

  // Analyze where they struggled
  const gaps: KnowledgeGap[] = [];

  if (exercise.decomposition?.incomplete) {
    gaps.push({
      concept: exercise.targetName,
      severity: 'moderate',
      atomicGap: 'Cannot break concept into atomic parts'
    });
  }

  if (exercise.derivation?.usedRecall) {
    gaps.push({
      concept: exercise.targetName,
      severity: 'critical',
      derivationGap: 'Relies on recall instead of derivation'
    });
  }

  return gaps;
}
```

### Mastery Calculation Enhancement

First principles completion weighs more heavily:

```typescript
// In progress-tracker.ts

function calculateMastery(topicId: string, userId: string): number {
  // Existing factors...
  const questionAccuracy = /* ... */ * 0.5;   // Reduced from 0.6
  const conceptCompletion = /* ... */ * 0.15; // Reduced from 0.2
  const reviewPerformance = /* ... */ * 0.1;
  const recency = /* ... */ * 0.1;

  // NEW: First principles completion (15% weight)
  const fpCompletion = await getFirstPrinciplesCompletion(topicId, userId);
  const fpFactor = fpCompletion * 0.15;

  return (questionAccuracy + conceptCompletion + reviewPerformance +
          recency + fpFactor) * 100;
}
```

### Badge System Extension

New badges for first principles:

```typescript
const FIRST_PRINCIPLES_BADGES = [
  {
    type: 'FP_FIRST_DERIVATION',
    name: 'First Principles Initiate',
    description: 'Complete your first derivation from first principles',
    icon: '🔬'
  },
  {
    type: 'FP_AXIOM_HUNTER',
    name: 'Axiom Hunter',
    description: 'Identify axioms for 10 different concepts',
    icon: '⚛️'
  },
  {
    type: 'FP_MASTER',
    name: 'First Principles Master',
    description: 'Complete 25 first principles exercises',
    icon: '🧠'
  },
  {
    type: 'FP_INVENTOR',
    name: 'The Inventor',
    description: 'Complete a Level 4 (Extreme) first principles exercise',
    icon: '💡'
  },
  {
    type: 'FP_PERFECT_DERIVATION',
    name: 'Flawless Derivation',
    description: 'Complete a first principles exercise with 100% score',
    icon: '⭐'
  }
];
```

---

## Master Roshi Personality

### First Principles Dialogue Style

```typescript
const FP_PERSONALITY_PROMPTS = {
  // Starting a first principles exercise
  START: `Hohoho! You think you understand {concept}?
          Let's find out if you TRULY know it - or if you've
          just memorized it like a parrot.

          In my day, we didn't have textbooks. We had to
          INVENT our understanding from scratch!`,

  // User gives recall instead of derivation
  RECALL_DETECTED: `Tsk tsk! You're telling me what the textbook says.
                    I asked you to DERIVE it. Big difference!

                    A true master doesn't recall - they recreate.
                    Try again. From basics.`,

  // User struggling with decomposition
  DECOMPOSITION_HELP: `Breaking things down is hard, eh?
                       Here's a hint: pretend you're explaining
                       to someone who knows NOTHING. What would
                       you need to explain first?`,

  // User identifies axioms correctly
  AXIOM_SUCCESS: `Now you're getting it! Those ARE the
                  fundamental truths this concept rests upon.

                  Once you see the axioms, everything else
                  is just logical consequence. Hohoho!`,

  // Challenging an assumption
  ASSUMPTION_CHALLENGE: `Ah, but you're assuming {assumption}.
                         Why? Says who? Challenge it!

                         A master questions EVERYTHING -
                         especially their own beliefs.`,

  // User completes first principles exercise
  COMPLETION: `HOHOHO! MAGNIFICENT!

              You didn't just learn {concept} - you INVENTED it!
              That's the difference between a student and a master.

              Students memorize. Masters derive.
              You're becoming a master, apprentice.

              +{xp} XP earned for first principles mastery!`,

  // User abandons exercise
  ABANDON: `Giving up? That's alright - first principles is
            hard. Even Goku failed many times before mastering
            the Kamehameha.

            Come back when you're ready. The path to mastery
            is always here.`
};
```

---

## Implementation Phases

### Phase 1: Core Engine (Weeks 1-2)

**Goal:** Build the FirstPrinciplesEngine with core functionality

**Tasks:**
- [ ] Create database migrations for new models
- [ ] Implement `decomposeConcept()` with LLM
- [ ] Implement `identifyAxioms()` with LLM
- [ ] Implement `generateDerivationChallenge()`
- [ ] Implement `challengeAssumption()`
- [ ] Implement `evaluateDerivation()`
- [ ] Unit tests for all engine functions

**Files:**
- `lib/learning/first-principles-engine.ts`
- `lib/types/first-principles.ts`
- `prisma/migrations/xxx_first_principles.sql`

### Phase 2: API & Command (Week 3)

**Goal:** Expose first principles through API and chat

**Tasks:**
- [ ] Create API routes (POST, GET, respond, hint, abandon)
- [ ] Add `/firstprinciples` command handler
- [ ] Integrate with chat message flow
- [ ] Add FP questions to question types
- [ ] Integration tests for API

**Files:**
- `app/api/first-principles/route.ts`
- `app/api/first-principles/[id]/respond/route.ts`
- `lib/chat/commands.ts` (extend)

### Phase 3: Deep Integration (Week 4)

**Goal:** Integrate with existing Sensie features

**Tasks:**
- [ ] Extend Socratic engine for FP questions
- [ ] Add FP variant to Feynman technique
- [ ] Enhance gap detection for FP
- [ ] Update mastery calculation
- [ ] Add FP badges to badge system
- [ ] Update analytics to track FP

**Files:**
- `lib/learning/socratic-engine.ts` (extend)
- `lib/learning/feynman-engine.ts` (extend)
- `lib/learning/gap-detector.ts` (extend)
- `lib/learning/progress-tracker.ts` (extend)
- `lib/learning/analytics-engine.ts` (extend)

### Phase 4: User Experience (Week 5)

**Goal:** Polish UX and add settings

**Tasks:**
- [ ] Add FP settings to UserPreferences
- [ ] Create settings UI for FP
- [ ] Build FP exercise visualization
- [ ] Add progress indicators for phases
- [ ] Create axiom library browser (optional)
- [ ] E2E tests for full FP flow

**Files:**
- `components/first-principles/` (new directory)
- `app/(main)/settings/page.tsx` (extend)
- `e2e/first-principles.test.ts`

### Phase 5: Polish & Launch (Week 6)

**Goal:** Documentation, testing, and launch

**Tasks:**
- [ ] Update spec documentation
- [ ] Add FP to feature flags
- [ ] Performance testing
- [ ] Edge case handling
- [ ] Master Roshi prompt refinement
- [ ] Launch to production

---

## Risk Mitigation

### Risk 1: Too Difficult for Users

**Problem:** First principles is cognitively demanding. Users may give up.

**Mitigations:**
- Progressive intensity levels (1-4)
- Escape hatch: "I'm stuck, help me decompose"
- Celebration at each phase completion
- Option to pause and resume
- Master Roshi encouragement throughout

### Risk 2: LLM Hallucination in Axioms

**Problem:** LLM might generate incorrect fundamental truths.

**Mitigations:**
- Pre-defined axiom library for common domains
- Human-verified axioms for core concepts
- Allow user to challenge generated axioms
- Quality check: axioms must be truly fundamental

### Risk 3: Sessions Too Long

**Problem:** Full first principles can take 45+ minutes.

**Mitigations:**
- Save progress at each phase
- Auto-resume from last phase
- Time tracking and gentle reminders
- "Quick mode" at intensity level 2

### Risk 4: Frustrating Assumption Challenges

**Problem:** Users may feel attacked when assumptions are challenged.

**Mitigations:**
- Challenge persistence setting (gentle/moderate/aggressive)
- Frame challenges as "exploration, not criticism"
- Master Roshi personality: demanding but supportive
- Option to skip individual challenges

### Risk 5: Not Enough Content Value

**Problem:** Users may not see value compared to regular Socratic.

**Mitigations:**
- Clear differentiation in messaging
- Higher XP rewards (500 vs 100)
- Exclusive badges
- Mastery boost (higher weight)
- "First Principles Master" achievement

---

## Success Metrics

### User Engagement
- **FP Exercise Completion Rate:** 50%+ of started exercises completed
- **FP Return Rate:** 40%+ of users who try FP, try it again
- **Average Session Time:** 25-35 minutes for Level 3

### Learning Effectiveness
- **Post-FP Quiz Performance:** 20%+ improvement vs non-FP
- **Retention at 30 days:** 85%+ accuracy on FP concepts
- **Derivation Quality:** Average score 70/100

### Feature Adoption
- **FP Usage Rate:** 30%+ of active users try FP within 30 days
- **Settings Engagement:** 60%+ of users customize FP settings
- **Badge Collection:** 20%+ earn at least one FP badge

---

## Appendix: Axiom Library (Starter)

### Memory Domain
```
MEMORY_FINITE: "Computer memory is a finite resource"
MEMORY_ADDRESSED: "Every byte in memory has an address"
MEMORY_STACK_HEAP: "Memory is divided into stack (LIFO) and heap (dynamic)"
MEMORY_OWNERSHIP: "Allocated memory must have exactly one responsible party"
MEMORY_CLEANUP: "All allocated memory must eventually be freed"
```

### Execution Domain
```
EXECUTION_SEQUENTIAL: "Code executes one instruction at a time (per thread)"
EXECUTION_STACK: "Function calls create stack frames in LIFO order"
EXECUTION_SCOPE: "Variables exist within defined scopes"
EXECUTION_ASYNC: "Operations can complete at a later time"
```

### Type Domain
```
TYPE_CLASSIFICATION: "Values can be classified into types"
TYPE_OPERATIONS: "Types define valid operations on values"
TYPE_CHECKING: "Type mismatches can be detected (at compile or runtime)"
TYPE_INFERENCE: "Types can sometimes be deduced from context"
```

### Concurrency Domain
```
CONCURRENCY_SHARED: "Multiple threads can access the same memory"
CONCURRENCY_RACE: "Unsynchronized access can cause race conditions"
CONCURRENCY_LOCK: "Locks provide exclusive access to resources"
CONCURRENCY_DEADLOCK: "Circular lock dependencies can cause deadlock"
```

---

## Conclusion

First Principles Learning transforms Sensie from a Socratic tutor into a **derivation engine**. Users don't just learn - they **reinvent** concepts from fundamental truths.

This aligns perfectly with Sensie's philosophy: "True mastery comes not from being told, but from discovering."

First principles is the ultimate expression of that philosophy: **You haven't truly learned until you can derive it from scratch.**

---

**Author:** Claude (assisted by user requirements)
**Status:** Specification Complete, Ready for Implementation
**Next Steps:** Review with user, then begin Phase 1 implementation
