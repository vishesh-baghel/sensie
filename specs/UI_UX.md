# Sensie UI/UX Design

## Design Philosophy

**Visual Direction:** Clean Sci-Fi minimalism inspired by Vercel, Linear, and Cursor.

**Core Principle:** The UI disappears. Sensie's personality lives entirely in the *words*, not the visuals. The interface is a tool, not a decoration.

**Target Audience:** Software engineers who value clarity, efficiency, and information density.

**Key Differentiators:**
1. **Learning-First Layout:** Not a pure chat interface, but a guided learning environment
2. **Persistent Context:** Current learning topic always visible, no thread switching
3. **Progress-Driven:** Visual progress indicators - subtle and functional
4. **Command-Friendly:** Keyboard shortcuts and slash commands for power users
5. **Distraction-Free:** Minimal chrome, maximum focus
6. **No Visual Gimmicks:** No avatars, no emojis in UI, no decorative elements

## Visual Design System

### Color Palette

**Light Mode (Primary):**
```
Background:     #FFFFFF (pure white)
Surface:        #FAFAFA (cards, elevated surfaces)
Border:         #E5E5E5 (subtle dividers)
Border Hover:   #D4D4D4

Text Primary:   #0A0A0A (near black)
Text Secondary: #737373 (muted)
Text Tertiary:  #A3A3A3 (disabled, hints)

Accent:         #F97316 (warm orange - Sensie's subtle signature)
Accent Muted:   #FED7AA (very light orange for backgrounds)
Accent Hover:   #EA580C (darker orange)

Success:        #22C55E
Warning:        #EAB308
Error:          #EF4444
```

**Dark Mode (Optional, respects system preference):**
```
Background:     #0A0A0A
Surface:        #171717
Border:         #262626
Border Hover:   #404040

Text Primary:   #FAFAFA
Text Secondary: #A3A3A3
Text Tertiary:  #737373

Accent:         #FB923C (slightly lighter for dark bg)
```

### Typography

**Font Stack:**
```
Sans:  Geist Sans, system-ui, -apple-system, sans-serif
Mono:  Geist Mono, ui-monospace, 'SF Mono', monospace
```

**Scale:**
```
xs:    12px / 1.5
sm:    14px / 1.5
base:  16px / 1.6
lg:    18px / 1.5
xl:    20px / 1.4
2xl:   24px / 1.3
3xl:   30px / 1.2
```

**Usage:**
- Body text: Geist Sans, base size
- Code, technical content: Geist Mono
- Headings: Geist Sans, medium weight
- Numbers, stats: Geist Mono (for alignment)

### Spacing & Layout

**Spacing Scale (4px base):**
```
1:  4px
2:  8px
3:  12px
4:  16px
5:  20px
6:  24px
8:  32px
10: 40px
12: 48px
16: 64px
```

**Border Radius:**
```
none: 0
sm:   2px
md:   4px
lg:   6px
xl:   8px (max for most elements)
```

**Shadows:**
Minimal to none. Use borders for separation.
```
sm: 0 1px 2px rgba(0,0,0,0.04)
md: 0 2px 4px rgba(0,0,0,0.04)
```

### Interaction States

**Buttons:**
```
Default:  bg-white, border-gray-200
Hover:    bg-gray-50, border-gray-300
Active:   bg-gray-100
Disabled: opacity-50, cursor-not-allowed

Primary:  bg-gray-900, text-white
P-Hover:  bg-gray-800
P-Active: bg-gray-950
```

**Inputs:**
```
Default:  bg-white, border-gray-200
Focus:    border-gray-400, ring-1 ring-gray-200
Error:    border-red-500, ring-1 ring-red-200
```

## Core Layout Structure

### Main Layout

```
┌─────────────────────────────────────────────────────────────┐
│  sensie          [Current Topic]              [cmd] [user]  │ ← Header (48px)
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────┐  ┌──────────────────────────────────────┐  │
│  │            │  │                                      │  │
│  │  Topics    │  │        Chat / Learning Area          │  │
│  │  Sidebar   │  │                                      │  │
│  │            │  │                                      │  │
│  │  240px     │  │                                      │  │
│  │  (collapse │  │                                      │  │
│  │  to 0)     │  │                                      │  │
│  │            │  │                                      │  │
│  └────────────┘  │                                      │  │
│                  │                                      │  │
│                  └──────────────────────────────────────┘  │
│                  ┌──────────────────────────────────────┐  │
│                  │  Input                               │  │
│                  └──────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Header

```
┌─────────────────────────────────────────────────────────────┐
│  sensie         Rust Ownership · 75%           ⌘K    ●      │
└─────────────────────────────────────────────────────────────┘
   ↑               ↑                              ↑     ↑
   Logo           Topic + Progress             Cmd    User
   (home link)    (click for details)          palette menu
```

**Components:**
- **Logo:** Text "sensie" in lowercase, medium weight. Links to home.
- **Current Topic:** Topic name + mastery percentage. Click opens topic details.
- **Command Palette:** `⌘K` button or keyboard shortcut
- **User Menu:** Simple circle indicator, click for settings/logout

### Topic Sidebar

```
┌────────────────────────────┐
│  Topics              [−]   │ ← Collapse button
├────────────────────────────┤
│                            │
│  ACTIVE                    │
│  ──────────────────────── │
│  Rust Programming    75%   │
│    Ownership         ✓     │
│    Borrowing         ○     │
│    Lifetimes         ·     │
│                            │
│  System Design       30%   │
│    Caching           ✓     │
│    Load Balancing    ○     │
│    CAP Theorem       ·     │
│                            │
│  COMPLETED                 │
│  ──────────────────────── │
│  TypeScript          92%   │
│                            │
│  QUEUED                    │
│  ──────────────────────── │
│  Distributed Systems       │
│                            │
│  ──────────────────────── │
│  + New topic               │
│                            │
└────────────────────────────┘

Legend:
✓  Completed subtopic
○  In progress (current)
·  Locked (prerequisites not met)
```

**Behavior:**
- Click topic → Switch context
- Click subtopic → Jump to that subtopic
- Collapse → Sidebar hidden, more space for chat
- New topic → Opens inline input or modal

### Chat Area

**Message Types:**

**Sensie Message:**
```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  Ah, an excellent question, apprentice!                  │
│                                                          │
│  Ownership in Rust means each value has exactly one      │
│  owner at any given time. When the owner goes out of     │
│  scope, the value is dropped.                            │
│                                                          │
│  ```rust                                                 │
│  let s1 = String::from("hello");                         │
│  let s2 = s1; // s1 is now invalid                      │
│  ```                                                     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**User Message:**
```
                    ┌──────────────────────────────────────┐
                    │                                      │
                    │  So the original variable can't be   │
                    │  used after the move?                │
                    │                                      │
                    └──────────────────────────────────────┘
```

**Question Card:**
```
┌──────────────────────────────────────────────────────────┐
│  Question 2 of 5                              Difficulty 3│
├──────────────────────────────────────────────────────────┤
│                                                          │
│  What happens when you try to use a variable after       │
│  its ownership has been moved to another variable?       │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  Hint (1/3)                                        Skip  │
└──────────────────────────────────────────────────────────┘
```

**Feedback (Correct):**
```
┌──────────────────────────────────────────────────────────┐
│  ✓ Correct                                               │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Precisely! The compiler will throw an error. This is    │
│  Rust's way of preventing use-after-move bugs at         │
│  compile time rather than runtime.                       │
│                                                          │
│  Let's dig deeper...                                     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Feedback (Incorrect):**
```
┌──────────────────────────────────────────────────────────┐
│  Not quite                                               │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  You're on the right track, but consider: what does      │
│  "ownership" mean for memory safety?                     │
│                                                          │
│  Think about what would happen if both variables         │
│  could access the same memory...                         │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  Try again                                    Get hint   │
└──────────────────────────────────────────────────────────┘
```

### Input Area

```
┌──────────────────────────────────────────────────────────┐
│  Type your answer...                              ↵ Send │
├──────────────────────────────────────────────────────────┤
│  /hint · /skip · /progress · /review                     │
└──────────────────────────────────────────────────────────┘
```

**Features:**
- Auto-expanding textarea
- `/` triggers command autocomplete
- `Enter` sends, `Shift+Enter` for newline
- Subtle command hints below input

**Command Palette (triggered by `/`):**
```
┌──────────────────────────────────────────────────────────┐
│  / commands                                              │
├──────────────────────────────────────────────────────────┤
│  /hint        Get a hint for the current question        │
│  /skip        Skip this question (3 remaining)           │
│  /progress    Show detailed progress                     │
│  /topics      Manage learning topics                     │
│  /review      Start spaced repetition review             │
│  /quiz        Quick quiz on current topic                │
│  /break       Save progress and take a break             │
└──────────────────────────────────────────────────────────┘
```

## Pages

### Home / Dashboard

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  Welcome back.                                           │
│                                                          │
│  CONTINUE                                                │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Rust Programming                             75%  │ │
│  │  ████████████████████░░░░░░                       │ │
│  │  Next: Borrowing · Mutable references             │ │
│  │                                       Continue →  │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  REVIEWS DUE                                             │
│  ┌────────────────────────────────────────────────────┐ │
│  │  3 items due today                                │ │
│  │  Ownership basics · JS closures · SQL indexes     │ │
│  │                                    Start review → │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  THIS WEEK                                               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│  │  5           │ │  3           │ │  12          │    │
│  │  concepts    │ │  topics      │ │  reviews     │    │
│  │  mastered    │ │  active      │ │  completed   │    │
│  └──────────────┘ └──────────────┘ └──────────────┘    │
│                                                          │
│  + Start new topic                                       │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Topics Page

```
┌──────────────────────────────────────────────────────────┐
│  Topics                                      + New topic │
│                                                          │
│  All    Active    Completed    Queued                    │
│  ───    ──────    ─────────    ──────                   │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Rust Programming                                  │ │
│  │  ████████████████████░░░░░░                   75%  │ │
│  │  2/5 subtopics · Last active 2h ago               │ │
│  │                                          Continue  │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  System Design                                     │ │
│  │  ██████░░░░░░░░░░░░░░░░░░░░                   30%  │ │
│  │  1/8 subtopics · Last active 1d ago               │ │
│  │                                          Continue  │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  TypeScript                                        │ │
│  │  ████████████████████████████████████████████ 92%  │ │
│  │  Completed · Review in 5 days                     │ │
│  │                                   Review   Archive │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Progress Page

```
┌──────────────────────────────────────────────────────────┐
│  Rust Programming                                        │
│                                                          │
│  75%  ████████████████████████████████░░░░░░░░░░        │
│       Proficient                                         │
│                                                          │
│  SUBTOPICS                                               │
│  ├─ Ownership Basics          ████████████████████ 100% │
│  │  └─ 5/5 questions · 0 hints                         │
│  ├─ Borrowing                 ████████████░░░░░░░░  60% │
│  │  └─ 3/5 questions · in progress                     │
│  └─ Lifetimes                 ░░░░░░░░░░░░░░░░░░░░   0% │
│     └─ Locked · requires Borrowing                      │
│                                                          │
│  STATISTICS                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│  │  45          │ │  84%         │ │  7           │    │
│  │  questions   │ │  accuracy    │ │  hints used  │    │
│  └──────────────┘ └──────────────┘ └──────────────┘    │
│                                                          │
│  REVIEW SCHEDULE                                         │
│  Next review: Tomorrow                                   │
│  Reviews completed: 3                                    │
│  Success rate: 100%                                      │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Review Session

```
┌──────────────────────────────────────────────────────────┐
│  Review · 2/5                                            │
│  ██████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Rust · Ownership Basics                           │ │
│  │  Last reviewed: 7 days ago                         │ │
│  ├────────────────────────────────────────────────────┤ │
│  │                                                    │ │
│  │  What happens to the original variable when        │ │
│  │  ownership is transferred to another variable?     │ │
│  │                                                    │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Type your answer...                               │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│                                              Show answer │
│                                                          │
└──────────────────────────────────────────────────────────┘

After revealing answer:

┌──────────────────────────────────────────────────────────┐
│  How well did you recall this?                           │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │  Again   │ │  Hard    │ │  Good    │ │  Easy    │   │
│  │  <1min   │ │  ~10min  │ │  ~1day   │ │  ~4days  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Login Page

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│                        sensie                            │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │                                                    │ │
│  │  Owner                            Visitor          │ │
│  │  ─────                            ───────          │ │
│  │                                                    │ │
│  │  ┌──────────────────────────────────────────────┐ │ │
│  │  │  Passphrase                                  │ │ │
│  │  └──────────────────────────────────────────────┘ │ │
│  │                                                    │ │
│  │                                       Enter →      │ │
│  │                                                    │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  Or continue as visitor (limited features)               │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Settings Page

```
┌──────────────────────────────────────────────────────────┐
│  Settings                                                │
│                                                          │
│  LEARNING                                                │
│  ─────────────────────────────────────────────────────  │
│                                                          │
│  Mastery threshold                                       │
│  When is a topic considered complete?                    │
│  ○ 50%   ○ 70%   ● 80%   ○ 90%   ○ 100%                │
│                                                          │
│  Difficulty starting level                               │
│  ○ 1 (Beginner)  ○ 2  ● 3 (Default)  ○ 4  ○ 5 (Expert) │
│                                                          │
│  PERSONALITY                                             │
│  ─────────────────────────────────────────────────────  │
│                                                          │
│  Sensie's teaching style                                 │
│  ● Full personality (default)                           │
│  ○ Balanced (occasional character)                      │
│  ○ Minimal (direct, professional)                       │
│                                                          │
│  MODEL                                                   │
│  ─────────────────────────────────────────────────────  │
│                                                          │
│  Provider                                                │
│  [Anthropic ▾]                                          │
│                                                          │
│  Model                                                   │
│  ● Auto (Sonnet for teaching, Haiku for hints)          │
│  ○ Claude Sonnet                                        │
│  ○ Claude Haiku                                         │
│  ○ Claude Opus                                          │
│                                                          │
│  APPEARANCE                                              │
│  ─────────────────────────────────────────────────────  │
│                                                          │
│  Theme                                                   │
│  ● System   ○ Light   ○ Dark                            │
│                                                          │
│                                            Save changes  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## First-Time Experience

**Empty state - Sensie initiates:**

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  Welcome, apprentice.                                    │
│                                                          │
│  I'm Sensie, your personal learning guide. I don't      │
│  give you answers - I help you discover them through     │
│  questions. True mastery comes from understanding,       │
│  not memorization.                                       │
│                                                          │
│  What would you like to learn?                           │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  e.g., "Rust ownership", "system design",          │ │
│  │  "giving feedback to teammates"                     │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## Error States

**Design principle:** Stay in character, but provide technical debug info.

**Network Error:**
```
┌──────────────────────────────────────────────────────────┐
│  Connection lost                                         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  The connection has been interrupted. Your progress      │
│  is saved.                                               │
│                                                          │
│                                                  Retry   │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Debug: NetworkError · Last success: 2m ago        │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

**API Error:**
```
┌──────────────────────────────────────────────────────────┐
│  Something went wrong                                    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Even this old sensei makes mistakes sometimes.          │
│  Let me try again...                                     │
│                                                          │
│                                        Retry   Report    │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Debug: API 500 · /api/chat · req_abc123          │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

## Keyboard Shortcuts

```
⌘K       Command palette
⌘P       View progress
⌘/       Focus input
Enter    Send message
⇧Enter   New line in input
Esc      Close modals
```

## Responsive Design

**Breakpoints:**
```
sm:  640px   Mobile landscape
md:  768px   Tablet
lg:  1024px  Desktop
xl:  1280px  Large desktop
```

**Mobile (<768px):**
- Sidebar collapses to bottom sheet
- Single column layout
- Swipe gestures for navigation
- Simplified progress indicators

## Accessibility

**Requirements:**
- WCAG AA contrast ratios
- Full keyboard navigation
- Screen reader support
- Focus indicators on all interactive elements
- Respect `prefers-reduced-motion`
- Respect `prefers-color-scheme`

## Animations

**Principles:**
- Subtle, functional animations only
- 150-200ms duration for micro-interactions
- Ease-out for entrances, ease-in for exits
- Respect reduced motion preferences

**Allowed animations:**
- Progress bar fills
- Card hover states (subtle scale or border change)
- Message appearance (fade-in, 150ms)
- Page transitions (fade, 200ms)

**Not allowed:**
- Confetti
- Bouncing elements
- Decorative particles
- Excessive spring animations

---

**Last Updated:** 2025-01-06
