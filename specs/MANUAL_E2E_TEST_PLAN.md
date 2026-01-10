# Manual E2E Test Plan for Sensie Learning Agent

**Purpose:** Step-by-step manual testing guide for all Sensie features using the Claude Code browser extension.

**Test Environment:** Production deployment at the Vercel URL
**Tester:** Manual testing via browser
**Date:** 2026-01-10

---

## Pre-Test Setup

### Prerequisites
- [ ] Sensie is deployed and accessible via browser
- [ ] Database is migrated with latest schema
- [ ] Environment variables are configured (API keys, DB URL, SESSION_SECRET)
- [ ] No existing test data (fresh database OR known test user)

### Browser Setup
- [ ] Use Chrome/Firefox/Safari (latest version)
- [ ] Clear cookies and local storage before testing
- [ ] Open browser dev tools (Network tab) to monitor API calls

---

## Test Suite 1: Authentication & User Management

### Test 1.1: First-Time Owner Setup
**Route:** `/login`

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Navigate to app root URL | Redirects to `/login` | [ ] |
| 2 | Observe login page | Shows "Create your account" form (first-time setup) | [ ] |
| 3 | Enter username: `TestOwner` | Username field accepts input | [ ] |
| 4 | Enter passphrase: `test` (< 8 chars) | Shows validation error "Minimum 8 characters" | [ ] |
| 5 | Enter passphrase: `testpassword123` | Passphrase accepted | [ ] |
| 6 | Enter confirm: `wrongpassword` | Shows "Passphrases don't match" error | [ ] |
| 7 | Enter confirm: `testpassword123` | Confirmation matches | [ ] |
| 8 | Click "Create Account" | Loading state, then redirects to `/topics` | [ ] |
| 9 | Check URL | URL is `/topics` | [ ] |

### Test 1.2: Owner Login (Existing Account)
**Route:** `/login`

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Log out (if logged in) via Settings | Redirects to `/login` | [ ] |
| 2 | Observe login page | Shows "Welcome back" with passphrase input | [ ] |
| 3 | Enter wrong passphrase | Shows "Invalid passphrase" error | [ ] |
| 4 | Enter correct passphrase: `testpassword123` | Redirects to `/topics` | [ ] |

### Test 1.3: Visitor Mode
**Route:** `/login`

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Log out if logged in | Returns to `/login` | [ ] |
| 2 | Click "Continue as Visitor" button | Creates visitor session | [ ] |
| 3 | Observe redirect | Redirects to `/topics` | [ ] |
| 4 | Create a topic | Topic created successfully | [ ] |
| 5 | Try to create a second active topic | Should show limit warning (visitors: 1 active topic max) | [ ] |

### Test 1.4: Session Persistence
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Login as owner | Session created | [ ] |
| 2 | Refresh page (F5) | Still logged in, no redirect to login | [ ] |
| 3 | Close browser tab, reopen app | Still logged in (session persists) | [ ] |
| 4 | Navigate to `/topics` directly | Access granted, no login redirect | [ ] |

---

## Test Suite 2: Topic Management

### Test 2.1: Create Topic
**Route:** `/topics`

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Navigate to `/topics` | Topics page loads with tabs (Active, Queued, Completed, Archived) | [ ] |
| 2 | Click "New Topic" button | Modal/form opens for topic creation | [ ] |
| 3 | Enter topic name: `JavaScript Promises` | Input accepted | [ ] |
| 4 | Leave goal empty (optional) | Allowed | [ ] |
| 5 | Click "Create" | Shows loading spinner (20-30 sec for LLM generation) | [ ] |
| 6 | Wait for completion | Topic appears in Active tab with subtopics | [ ] |
| 7 | Verify subtopics generated | 3-7 subtopics visible with lock icons | [ ] |
| 8 | Verify first subtopic unlocked | First subtopic shows "in progress" or unlocked state | [ ] |

### Test 2.2: Topic Limit Enforcement (Owner: 3 max)
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Create topic 1: `React Hooks` | Created, Active tab shows 1 topic | [ ] |
| 2 | Create topic 2: `TypeScript Generics` | Created, Active tab shows 2 topics | [ ] |
| 3 | Create topic 3: `Node.js Streams` | Created, Active tab shows 3 topics | [ ] |
| 4 | Try to create topic 4 | Should show error OR topic goes to Queued tab | [ ] |
| 5 | Check Queued tab | If limit enforced, 4th topic is queued | [ ] |

### Test 2.3: Topic Status Transitions
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | On Active topic, click dropdown menu | Menu shows: Mark Complete, Archive | [ ] |
| 2 | Click "Archive" | Topic moves to Archived tab | [ ] |
| 3 | Go to Archived tab | Topic visible with "Unarchive" option | [ ] |
| 4 | Click "Unarchive" | Topic moves to Queued tab (if 3 active) or Active | [ ] |
| 5 | On Active topic, click "Mark Complete" | Topic moves to Completed tab | [ ] |

### Test 2.4: Topic Card Display
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | View any topic card | Shows topic name prominently | [ ] |
| 2 | Check mastery display | Shows mastery % (e.g., "0%" for new) | [ ] |
| 3 | Check progress bar | Bar fills proportionally to mastery | [ ] |
| 4 | Check subtopics list | Shows first 5 subtopics with status icons | [ ] |
| 5 | Check "last activity" | Shows time delta (e.g., "Just now", "2h ago") | [ ] |

---

## Test Suite 3: Learning Chat Interface

### Test 3.1: Start Learning Session
**Route:** `/chat?topic=[id]`

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | From Topics page, click "Start Learning" on a topic | Navigates to `/chat?topic=[id]` | [ ] |
| 2 | Observe chat loading | Shows loading spinner briefly | [ ] |
| 3 | Check header | Shows topic name and current subtopic | [ ] |
| 4 | Check mastery bar in header | Shows current mastery % | [ ] |
| 5 | Observe initial message | Sensie sends a greeting with Master Roshi personality | [ ] |
| 6 | Observe first question | Sensie asks a Socratic question about the first concept | [ ] |

### Test 3.2: Answer Flow (Correct Answer)
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Read Sensie's question | Question displayed clearly | [ ] |
| 2 | Type a correct, detailed answer | Text appears in input area | [ ] |
| 3 | Press Enter (or click Send) | Message sends, shows user bubble | [ ] |
| 4 | Observe streaming response | Sensie's response streams in real-time | [ ] |
| 5 | Check feedback | Sensie acknowledges correct answer with encouragement | [ ] |
| 6 | Check progression | Sensie may ask follow-up or move to next concept | [ ] |

### Test 3.3: Answer Flow (Incorrect/Shallow Answer)
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Answer with vague response: "I don't know" or "maybe promises?" | Message sends | [ ] |
| 2 | Observe response | Sensie provides guiding question, doesn't give answer directly | [ ] |
| 3 | Answer with another shallow attempt | Sensie continues to guide with probing questions | [ ] |
| 4 | Use `/hint` command | Hint provided, hints remaining shown (e.g., "2/3 remaining") | [ ] |

### Test 3.4: Message Input Behavior
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Type multi-line message (Shift+Enter) | Creates new line, doesn't send | [ ] |
| 2 | Press Enter without Shift | Message sends | [ ] |
| 3 | Type very long message (500+ chars) | Input area expands (up to 200px max) | [ ] |
| 4 | Try to send empty message | Button disabled, nothing happens | [ ] |
| 5 | Try to send whitespace only | Message doesn't send | [ ] |

---

## Test Suite 4: Command Palette & Slash Commands

### Test 4.1: Command Palette UI
**Route:** `/chat` (during active session)

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Type `/` in input | Command palette appears above input | [ ] |
| 2 | Observe palette | Shows all 11 commands with descriptions | [ ] |
| 3 | Type `/pro` | Palette filters to show `/progress` only | [ ] |
| 4 | Press ArrowDown | Selection moves to next command | [ ] |
| 5 | Press ArrowUp | Selection moves to previous command | [ ] |
| 6 | Press Escape | Palette closes | [ ] |
| 7 | Type `/`, then click on a command | Command auto-sends | [ ] |
| 8 | Type `/hint`, press Enter | Command sends and executes | [ ] |

### Test 4.2: `/hint` Command
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | During active question, type `/hint` | Hint provided for current question | [ ] |
| 2 | Check hint message | Shows hint # (e.g., "Hint 1/3") | [ ] |
| 3 | Use `/hint` again | Second hint, different/more specific | [ ] |
| 4 | Use `/hint` third time | Third hint (most specific) | [ ] |
| 5 | Use `/hint` fourth time | Error: "You've used all 3 hints" | [ ] |

### Test 4.3: `/skip` Command
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Type `/skip` | Question skipped, shows remaining skips | [ ] |
| 2 | Check message | Shows "Skipped. X skips remaining" | [ ] |
| 3 | Use `/skip` 3 times total | Third skip works | [ ] |
| 4 | Try 4th `/skip` | Error: "No skips remaining" | [ ] |

### Test 4.4: `/progress` Command
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Type `/progress` | Progress summary displayed | [ ] |
| 2 | Check content - Level | Shows current level and XP | [ ] |
| 3 | Check content - Streak | Shows current streak and longest streak | [ ] |
| 4 | Check content - Topics | Shows active/completed topic counts | [ ] |
| 5 | Check content - Today | Shows today's questions answered, accuracy, XP | [ ] |
| 6 | Check content - Reviews | Shows reviews due count | [ ] |

### Test 4.5: `/topics` Command
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Type `/topics` | Topic list displayed | [ ] |
| 2 | Check active topics | Shows active topics with mastery % | [ ] |
| 3 | Check completed topics | Shows count of completed | [ ] |
| 4 | Check current indicator | Shows which subtopic is in-progress | [ ] |

### Test 4.6: `/review` Command
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Type `/review` | Review status displayed | [ ] |
| 2 | If reviews due | Shows count and preview of next 5 | [ ] |
| 3 | If no reviews | Shows "No reviews due" message | [ ] |
| 4 | Check CTA | Suggests navigating to Review page | [ ] |

### Test 4.7: `/quiz` Command
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Type `/quiz` | Quiz ready message displayed | [ ] |
| 2 | Check topic name | Shows current topic for quiz | [ ] |
| 3 | Check CTA | Suggests navigating to quiz | [ ] |

### Test 4.8: `/break` Command
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Type `/break` | Break message displayed | [ ] |
| 2 | Check encouragement | Random encouraging message (Master Roshi style) | [ ] |
| 3 | Check session stats | Shows duration and questions answered | [ ] |
| 4 | Check save confirmation | Confirms progress is saved | [ ] |

### Test 4.9: `/continue` Command
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Start a session, use `/break`, then come back | Session saved | [ ] |
| 2 | Type `/continue` | Resumes previous topic | [ ] |
| 3 | Check message | Shows "Resuming: [Topic Name]" with mastery % | [ ] |
| 4 | Check navigation | Returns to chat with that topic | [ ] |

### Test 4.10: `/feynman` Command (Phase 2)
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Type `/feynman` | Starts Feynman exercise | [ ] |
| 2 | Check prompt | Shows concept name and target audience | [ ] |
| 3 | Type `/feynman child` | Targets 10-year-old audience | [ ] |
| 4 | Type `/feynman peer` | Targets fellow developer audience | [ ] |
| 5 | Type `/feynman status` | Shows Feynman stats (completed, attempts, avg score) | [ ] |
| 6 | Submit an explanation | Receives evaluation with scores | [ ] |

### Test 4.11: `/analytics` Command (Phase 2)
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Type `/analytics` | Shows weekly summary (default) | [ ] |
| 2 | Type `/analytics daily` | Shows today's stats | [ ] |
| 3 | Type `/analytics monthly` | Shows this month's stats | [ ] |
| 4 | Type `/analytics all` | Shows all-time stats | [ ] |
| 5 | Check metrics | Study time, sessions, accuracy, XP, streak | [ ] |

### Test 4.12: `/gaps` Command (Phase 2)
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Answer several questions incorrectly first | Creates gap data | [ ] |
| 2 | Type `/gaps` | Shows gap analysis | [ ] |
| 3 | Check strength score | Shows overall strength % | [ ] |
| 4 | Check critical gaps | Lists critical gaps with evidence | [ ] |
| 5 | Check recommendations | Shows prioritized actions with time estimates | [ ] |
| 6 | If no gaps | Shows "No significant gaps detected" | [ ] |

---

## Test Suite 5: Spaced Repetition Review System

### Test 5.1: Review Page Idle State
**Route:** `/review`

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Navigate to `/review` | Review page loads | [ ] |
| 2 | If no reviews due | Shows "No reviews due. Great job!" | [ ] |
| 3 | If reviews due | Shows count of reviews due | [ ] |
| 4 | Check "Start Review" button | Enabled if reviews > 0, disabled if 0 | [ ] |

### Test 5.2: Review Session Flow
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Click "Start Review" | First review card loads | [ ] |
| 2 | Check progress bar | Shows "1/N" progress | [ ] |
| 3 | Check card header | Shows topic/subtopic context | [ ] |
| 4 | Check "Last reviewed" | Shows date or "Never" | [ ] |
| 5 | Click "Show Answer" | Answer reveals, rating buttons appear | [ ] |
| 6 | Check rating buttons | Shows Again (red), Hard (orange), Good (green), Easy (blue) | [ ] |

### Test 5.3: Review Rating
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Click "Again" (rating 1) | Submits rating, loads next card | [ ] |
| 2 | Click "Hard" (rating 2) | Submits rating, loads next card | [ ] |
| 3 | Click "Good" (rating 3) | Submits rating, loads next card | [ ] |
| 4 | Click "Easy" (rating 4) | Submits rating, loads next card | [ ] |
| 5 | Complete all reviews | Shows completion message | [ ] |

### Test 5.4: Review Completion
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Complete review session | "Review complete!" message | [ ] |
| 2 | Check summary | Shows items reviewed count | [ ] |
| 3 | Check breakdown | Shows count by rating (Again: X, Hard: Y, etc.) | [ ] |
| 4 | Check "Review more" button | Available if more reviews exist | [ ] |
| 5 | Check "Continue learning" button | Available, links to topics or chat | [ ] |

---

## Test Suite 6: Progress & Statistics Page

### Test 6.1: Overall Progress View
**Route:** `/progress`

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Navigate to `/progress` | Progress page loads | [ ] |
| 2 | Check level display | Shows current level with XP | [ ] |
| 3 | Check streak display | Shows current and longest streak | [ ] |
| 4 | Check topic counts | Shows active (X/3) and completed | [ ] |
| 5 | Check average mastery | Shows average % across topics | [ ] |
| 6 | Check today's activity | Questions answered, accuracy, XP earned | [ ] |
| 7 | Check badges section | Shows earned badges (if any) | [ ] |

### Test 6.2: Topic-Specific Progress
**Route:** `/progress/[topicId]`

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Click on a specific topic | Topic progress page loads | [ ] |
| 2 | Check mastery gauge | Large % display with status label | [ ] |
| 3 | Check subtopics list | Each subtopic with status icon and mastery % | [ ] |
| 4 | Check locked subtopics | Shows "Complete previous to unlock" | [ ] |
| 5 | Check statistics grid | Questions answered, accuracy, concepts | [ ] |
| 6 | Check review schedule | Due count, completed, retention % | [ ] |

---

## Test Suite 7: Settings Page

### Test 7.1: Settings Access
**Route:** `/settings`

| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Navigate to `/settings` | Settings page loads | [ ] |
| 2 | Check logout button | Logout button visible and functional | [ ] |
| 3 | Click logout | Session cleared, redirects to `/login` | [ ] |

---

## Test Suite 8: Error Handling & Edge Cases

### Test 8.1: Network Errors
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Disable network (DevTools), try to send message | Error message displayed | [ ] |
| 2 | Re-enable network | App recovers, can continue | [ ] |

### Test 8.2: Invalid Routes
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Navigate to `/chat?topic=invalid-id` | 404 error or redirect | [ ] |
| 2 | Navigate to `/nonexistent-page` | 404 page displayed | [ ] |

### Test 8.3: Concurrent Operations
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Rapidly click Send button multiple times | Only one message sent, no duplicates | [ ] |
| 2 | Type command while streaming | Command queued or handled gracefully | [ ] |

---

## Test Suite 9: Responsive Design

### Test 9.1: Mobile View (< 768px)
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Resize browser to mobile width | Layout adapts | [ ] |
| 2 | Check sidebar | Collapses to hamburger menu | [ ] |
| 3 | Check chat input | Full width, touch-friendly | [ ] |
| 4 | Check topic cards | Stack vertically | [ ] |
| 5 | Check command palette | Readable on mobile | [ ] |

### Test 9.2: Tablet View (768px - 1024px)
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Resize to tablet width | Layout adapts | [ ] |
| 2 | Check two-column layouts | May collapse to single | [ ] |

---

## Test Suite 10: LLM Integration Verification

### Test 10.1: Socratic Method Quality
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Start learning a new concept | Initial question is thought-provoking | [ ] |
| 2 | Answer incorrectly | Sensie guides with question, NOT answer | [ ] |
| 3 | Give shallow answer | Sensie asks for deeper understanding | [ ] |
| 4 | Give deep, correct answer | Sensie celebrates and moves on | [ ] |

### Test 10.2: Master Roshi Personality
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Read Sensie's messages | Contains martial arts/training metaphors | [ ] |
| 2 | Check encouragement | Uses anime-style encouragement | [ ] |
| 3 | Check correction style | Tough but encouraging | [ ] |

---

## Test Execution Summary

| Suite | Tests | Passed | Failed | Blocked |
|-------|-------|--------|--------|---------|
| 1. Authentication | 4 | | | |
| 2. Topic Management | 4 | | | |
| 3. Learning Chat | 4 | | | |
| 4. Commands | 12 | | | |
| 5. Spaced Repetition | 4 | | | |
| 6. Progress Page | 2 | | | |
| 7. Settings | 1 | | | |
| 8. Error Handling | 3 | | | |
| 9. Responsive Design | 2 | | | |
| 10. LLM Integration | 2 | | | |
| **TOTAL** | **38** | | | |

---

## Notes & Observations

_Record any bugs, unexpected behavior, or improvement suggestions here:_

1.
2.
3.

---

## Sign-Off

**Tester:** _______________
**Date:** _______________
**Overall Result:** [ ] PASS  [ ] FAIL
**Blocking Issues:** _______________
