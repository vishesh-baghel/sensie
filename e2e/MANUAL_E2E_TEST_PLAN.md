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
| 11. Session Edge Cases | 3 | | | |
| 12. Data Integrity | 4 | | | |
| 13. Command Edge Cases | 5 | | | |
| 14. Subtopic Unlock | 3 | | | |
| 15. UI State Edge Cases | 4 | | | |
| 16. Accessibility | 2 | | | |
| 17. Learning Algorithm | 3 | | | |
| 18. Security | 3 | | | |
| 19. Performance | 3 | | | |
| 20. Integration | 3 | | | |
| 21. Quiz Functionality | 3 | | | |
| 22. Progress Tracking | 4 | | | |
| 23. Bug Regression Tests | 5 | | | |
| **TOTAL** | **83** | | | |

---

## Test Suite 11: Session Edge Cases

### Test 11.1: Session Expiry Handling
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Login as owner, note session | Session active | [ ] |
| 2 | Wait for session to expire (or manually clear cookie) | Session invalid | [ ] |
| 3 | Try to navigate to `/chat` | Redirects to `/login` with message | [ ] |
| 4 | Try to send a message in chat | API returns 401, redirects to login | [ ] |

### Test 11.2: Multiple Browser Tabs
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Login in Tab 1 | Session created | [ ] |
| 2 | Open Tab 2 to same app | Session shared, both logged in | [ ] |
| 3 | Start learning Topic A in Tab 1 | Session starts | [ ] |
| 4 | Start learning Topic B in Tab 2 | Should handle gracefully (same or different session) | [ ] |
| 5 | Send message in Tab 1 | Message saved | [ ] |
| 6 | Check Tab 2 (refresh) | Messages should sync | [ ] |

### Test 11.3: Visitor Session Limits
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Login as visitor | Visitor session created | [ ] |
| 2 | Check session expiry note | Should mention 24-hour expiry | [ ] |
| 3 | Create 1 topic | Topic created | [ ] |
| 4 | Try to create 2nd topic | Should show limit warning (1 topic max for visitors) | [ ] |
| 5 | Archive the topic | Topic archived | [ ] |
| 6 | Try to create new topic | Should allow (since no active topics) | [ ] |

---

## Test Suite 12: Data Integrity & Persistence

### Test 12.1: Message Persistence
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Start chat session with topic | Session created | [ ] |
| 2 | Send 3 messages, receive 3 responses | 6 total messages in conversation | [ ] |
| 3 | Navigate away to `/topics` | Leave chat | [ ] |
| 4 | Return to same topic chat | All 6 messages still visible | [ ] |
| 5 | Refresh page (F5) | Messages persist | [ ] |
| 6 | Logout, login again, return to topic | Messages persist across sessions | [ ] |

### Test 12.2: XP Tracking Accuracy
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Note current XP on `/progress` | Record XP value | [ ] |
| 2 | Answer a question correctly | XP should increase | [ ] |
| 3 | Check `/progress` immediately | XP increased by expected amount | [ ] |
| 4 | Use `/hint` and then answer | XP gain should be reduced (hint penalty) | [ ] |
| 5 | Answer incorrectly | No XP gain (or minimal) | [ ] |

### Test 12.3: Mastery Calculation
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Start new topic at 0% mastery | Mastery is 0% | [ ] |
| 2 | Answer 5 questions correctly in first subtopic | Mastery increases | [ ] |
| 3 | Check topic card on `/topics` | Mastery % reflects progress | [ ] |
| 4 | Check subtopic in topic detail | First subtopic shows higher mastery | [ ] |
| 5 | Complete first subtopic (100%) | Second subtopic unlocks | [ ] |

### Test 12.4: Streak Tracking
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Check current streak on `/progress` | Note streak value | [ ] |
| 2 | Answer at least 1 question today | Activity recorded | [ ] |
| 3 | Check streak | Streak maintained or +1 if new day | [ ] |
| 4 | Simulate day gap (if possible) | Streak should reset | [ ] |

---

## Test Suite 13: Command Edge Cases

### Test 13.1: Commands Without Active Topic/Session
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Navigate to `/chat` without topic param | Should show topic selection or error | [ ] |
| 2 | Type `/hint` without active conversation | Should show helpful error | [ ] |
| 3 | Type `/skip` without active question | Should show "No active question" | [ ] |
| 4 | Type `/break` without active session | Should handle gracefully | [ ] |

### Test 13.2: Rapid Command Execution
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Type `/hint` and immediately `/hint` again | Should not double-increment hint count | [ ] |
| 2 | Rapidly type `/skip` 5 times | Should respect rate limiting or skip count | [ ] |
| 3 | Type `/progress` during streaming response | Should queue or handle gracefully | [ ] |

### Test 13.3: Invalid Command Arguments
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Type `/feynman invalid_audience` | Should show valid options or use default | [ ] |
| 2 | Type `/analytics invalid_period` | Should show valid options or use default | [ ] |
| 3 | Type `/unknowncommand` | Should show "Unknown command" message | [ ] |

### Test 13.4: Command Case Sensitivity
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Type `/HINT` (uppercase) | Should work same as `/hint` | [ ] |
| 2 | Type `/Progress` (mixed case) | Should work same as `/progress` | [ ] |
| 3 | Type `/FEYNMAN child` | Should work | [ ] |

### Test 13.5: Commands with Extra Whitespace
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Type `  /hint  ` (leading/trailing spaces) | Should execute command | [ ] |
| 2 | Type `/analytics   daily` (multiple spaces) | Should parse argument correctly | [ ] |

---

## Test Suite 14: Subtopic Unlock Logic

### Test 14.1: Sequential Unlock
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Create new topic with 5+ subtopics | First subtopic unlocked, rest locked | [ ] |
| 2 | Click on locked subtopic | Cannot start, shows lock message | [ ] |
| 3 | Complete first subtopic to 80%+ mastery | Check second subtopic | [ ] |
| 4 | Second subtopic status | Should be unlocked | [ ] |

### Test 14.2: Unlock Threshold (70%)
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Get first subtopic to 60% mastery | Check next subtopic | [ ] |
| 2 | Next subtopic status | Should still be locked (threshold is 70%) | [ ] |
| 3 | Get to 70% mastery | Next subtopic unlocks automatically | [ ] |
| 4 | Check unlock indicator | Lock icon removed, shows empty circle at 0% | [ ] |

### Test 14.3: Topic Completion
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Complete all subtopics to 80%+ | Check topic status | [ ] |
| 2 | Topic status | Should show as "Completed" or near 100% | [ ] |
| 3 | Check Completed tab on `/topics` | Topic appears in Completed | [ ] |

---

## Test Suite 15: UI State Edge Cases

### Test 15.1: Empty States
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Fresh account, navigate to `/topics` | Shows "No topics yet" with CTA | [ ] |
| 2 | Navigate to `/review` with 0 reviews | Shows "No reviews due" | [ ] |
| 3 | Navigate to `/progress` with no activity | Shows zero state gracefully | [ ] |
| 4 | Type `/topics` with no topics | Shows helpful message | [ ] |

### Test 15.2: Loading States
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Click "New Topic" and create | Shows loading spinner during generation | [ ] |
| 2 | Send message in chat | Shows typing indicator while streaming | [ ] |
| 3 | Navigate to `/progress` | Shows skeleton/loading before data | [ ] |
| 4 | Start review session | Shows loading before first card | [ ] |

### Test 15.3: Error Recovery
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Trigger API error (disable network briefly) | Error message shown | [ ] |
| 2 | Re-enable network | App recovers, can retry | [ ] |
| 3 | Check no data loss | Previous state preserved | [ ] |

### Test 15.4: Long Content Handling
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Send very long message (1000+ chars) | Message displays with scroll or truncation | [ ] |
| 2 | Receive long Sensie response | Streams smoothly, no UI jank | [ ] |
| 3 | Check message in conversation history | Full content preserved | [ ] |

---

## Test Suite 16: Accessibility

### Test 16.1: Keyboard Navigation
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Tab through login page | All interactive elements focusable | [ ] |
| 2 | Tab through chat interface | Input, send button accessible | [ ] |
| 3 | Use arrow keys in command palette | Selection moves correctly | [ ] |
| 4 | Press Enter to select command | Command executes | [ ] |
| 5 | Press Escape to close palette | Palette closes, focus returns | [ ] |

### Test 16.2: Focus Management
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Send message in chat | Focus returns to input after send | [ ] |
| 2 | Open command palette | Focus moves to palette | [ ] |
| 3 | Select command | Focus returns to input | [ ] |
| 4 | Navigate between pages | Focus moves to main content | [ ] |

---

## Test Suite 17: Learning Algorithm Edge Cases

### Test 17.1: Difficulty Adjustment
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Answer 5 questions correctly in a row | Questions should increase in depth | [ ] |
| 2 | Answer 3 questions incorrectly in a row | Questions should become simpler | [ ] |
| 3 | Use hints frequently | Should affect difficulty assessment | [ ] |

### Test 17.2: Spaced Repetition Scheduling
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Complete a concept (create review) | Check when review is due | [ ] |
| 2 | Rate review as "Easy" | Next review should be further out | [ ] |
| 3 | Rate review as "Again" | Next review should be sooner | [ ] |
| 4 | Check review intervals | Should follow FSRS algorithm | [ ] |

### Test 17.3: Gap Detection Accuracy
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Answer incorrectly on specific concept 3+ times | Gap should be detected | [ ] |
| 2 | Type `/gaps` | Should list that concept as gap | [ ] |
| 3 | Study and answer correctly | Gap should resolve over time | [ ] |

---

## Test Suite 18: Security & Authorization

### Test 18.1: Route Protection
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Without login, navigate to `/chat` | Redirects to `/login` | [ ] |
| 2 | Without login, navigate to `/topics` | Redirects to `/login` | [ ] |
| 3 | Without login, call API directly | Returns 401 Unauthorized | [ ] |

### Test 18.2: Data Isolation
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Login as User A, create topic | Topic created for User A | [ ] |
| 2 | Logout, login as User B (visitor) | Fresh session | [ ] |
| 3 | Check User B's topics | Should NOT see User A's topics | [ ] |
| 4 | Try to access User A's topic via URL | Should be denied | [ ] |

### Test 18.3: Session Manipulation
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Modify session cookie in DevTools | Try to escalate visitor to owner | [ ] |
| 2 | Attempt action | Should fail validation | [ ] |
| 3 | Check for error handling | No sensitive data exposed | [ ] |

---

## Test Suite 19: Performance Edge Cases

### Test 19.1: Long Conversation
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Have 50+ message conversation | Chat loads without significant lag | [ ] |
| 2 | Scroll through messages | Smooth scrolling | [ ] |
| 3 | New messages appear correctly | Auto-scroll to bottom works | [ ] |

### Test 19.2: Rapid Interactions
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Rapidly click Send button | Only one message sent | [ ] |
| 2 | Rapidly navigate between pages | No crashes, proper loading | [ ] |
| 3 | Rapidly type in input | Input keeps up, no dropped chars | [ ] |

### Test 19.3: Large Topic List
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Create maximum topics (3 active + queued) | Topics page loads quickly | [ ] |
| 2 | Check `/topics` command | Lists all topics correctly | [ ] |

---

## Test Suite 20: Integration Edge Cases

### Test 20.1: Streaming Interruption
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Send message to Sensie | Stream starts | [ ] |
| 2 | Navigate away during stream | Stream cancelled, no crash | [ ] |
| 3 | Return to chat | Partial message may be saved or discarded cleanly | [ ] |

### Test 20.2: API Timeout Handling
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Trigger slow API response (throttle network) | Loading indicator persists | [ ] |
| 2 | Wait for timeout | Appropriate error message | [ ] |
| 3 | Retry action | Should work when network recovers | [ ] |

### Test 20.3: Concurrent API Calls
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Send message while `/progress` is loading | Both complete correctly | [ ] |
| 2 | Create topic while viewing another | Both operations succeed | [ ] |

---

## Test Suite 21: Quiz Functionality

### Test 21.1: Quiz Command Initiation
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Type `/quiz` in active session | Quiz starts with first question | [ ] |
| 2 | Check question format | Shows code snippet or concept question | [ ] |
| 3 | Check answer format | Multiple choice (A-D) or open-ended | [ ] |
| 4 | Check Master Roshi phrases | Personality present (e.g., "*adjusts sunglasses*") | [ ] |

### Test 21.2: Quiz Answer Evaluation
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Answer question correctly | Sensie acknowledges and moves to next | [ ] |
| 2 | Answer question incorrectly | Sensie provides guidance without answer | [ ] |
| 3 | Give partial/shallow answer | Sensie asks for deeper understanding | [ ] |
| 4 | Complete all quiz questions | Shows completion message with score | [ ] |

### Test 21.3: Quiz Scoring
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Complete quiz with all correct | Shows "Perfect Score: X/X" | [ ] |
| 2 | Check score display | Trophy/celebration emoji shown | [ ] |
| 3 | Complete quiz with some wrong | Shows partial score (e.g., "2/3") | [ ] |

---

## Test Suite 22: Progress Tracking Verification

### Test 22.1: XP Award System
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Give DEEP technical answer | +15 XP awarded | [ ] |
| 2 | Give MODERATE answer | +10 XP awarded | [ ] |
| 3 | Give SHALLOW answer | +5 XP awarded | [ ] |
| 4 | Give incorrect but attempt | +2 XP awarded | [ ] |
| 5 | Check XP via `/progress` | XP total matches sum of awards | [ ] |

### Test 22.2: Level Progression
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Check starting level (new user) | Level 1, 0 XP | [ ] |
| 2 | Earn 100+ XP | Level increases to 2 | [ ] |
| 3 | Check level display | Shows correct level and XP to next | [ ] |

### Test 22.3: Mastery Calculation
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Check mastery at 0% | New subtopic shows 0% | [ ] |
| 2 | Answer questions correctly | Mastery % increases | [ ] |
| 3 | Check topic mastery | Aggregate of subtopic masteries | [ ] |
| 4 | Complete subtopic to 100% | Shows checkmark indicator | [ ] |

### Test 22.4: Answer Tracking
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Answer a question | `/progress` shows questions +1 | [ ] |
| 2 | Check accuracy tracking | Correct/total ratio displayed | [ ] |
| 3 | Check today's activity | Shows today's questions and XP | [ ] |

---

## Test Suite 23: Bug Regression Tests

### Test 23.1: Unknown Command Handling (Bug #1)
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Type `/unknowncommand` | Shows "I didn't recognize that command" | [ ] |
| 2 | Check available commands list | Lists all 11 valid commands | [ ] |
| 3 | Verify NOT sent to LLM | No AI response, just command handler message | [ ] |

### Test 23.2: Visitor Topic Limit (Bug #2)
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Login as visitor | Visitor session created | [ ] |
| 2 | Create first topic | Goes to Active tab | [ ] |
| 3 | Create second topic | Goes to QUEUED tab (not Active) | [ ] |
| 4 | Check Active tab | Shows only 1 topic | [ ] |

### Test 23.3: Owner Topic Limit (Bug #7)
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Login as owner with 3 active topics | 3 topics in Active tab | [ ] |
| 2 | Create 4th topic | Goes to QUEUED tab | [ ] |
| 3 | Try to start QUEUED topic | Shows "Topic limit reached" error | [ ] |
| 4 | Topic stays in Queued | Does not move to Active | [ ] |

### Test 23.4: Progress Tracking (Bug #6)
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Answer Socratic question | Response evaluated by AI | [ ] |
| 2 | Check `/progress` immediately | Questions answered incremented | [ ] |
| 3 | Check XP | XP awarded based on answer depth | [ ] |
| 4 | Check mastery % | Mastery increases on correct answers | [ ] |

### Test 23.5: Subtopic Unlock (Bug #8)
| Step | Action | Expected Result | Pass |
|------|--------|-----------------|------|
| 1 | Complete subtopic to 70%+ mastery | Mastery threshold reached | [ ] |
| 2 | Check next subtopic | Lock icon removed automatically | [ ] |
| 3 | Next subtopic status | Shows 0% with empty circle (clickable) | [ ] |
| 4 | Click to start | Can navigate to newly unlocked subtopic | [ ] |

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
