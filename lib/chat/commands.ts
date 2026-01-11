/**
 * Chat Command Handler
 *
 * Processes slash commands from the chat interface.
 * Commands provide quick actions without interrupting the learning flow.
 */

import type { SessionCommand } from '@/lib/types/session';
import { getTopicsByUser, getActiveTopics, getTopicById } from '@/lib/db/topics';
import { getSessionById, endSession, getActiveSessionsByUser, getSessionMessages } from '@/lib/db/sessions';
import { countReviewsDue, getReviewsDue } from '@/lib/db/reviews';
import { getUserProgress, getTodayAnalytics } from '@/lib/db/progress';
import { generateProgressReport, generateQuiz, handleCommand as agentHandleCommand } from '@/lib/mastra/agents/sensie';
import { prisma } from '@/lib/db/client';
import type { SocraticContext } from '@/lib/types';
import {
  shouldTriggerFeynman,
  startFeynmanExercise,
  getActiveFeynmanExercise,
  getFeynmanPrompt,
  getFeynmanStats,
  FEYNMAN_TRIGGER_MASTERY,
} from '@/lib/learning/feynman-engine';
import { getLearningAnalytics } from '@/lib/learning/analytics-engine';
import { analyzeKnowledgeGaps } from '@/lib/learning/gap-detector';

// All supported commands
export const SUPPORTED_COMMANDS = [
  '/hint',
  '/skip',
  '/progress',
  '/topics',
  '/review',
  '/quiz',
  '/break',
  '/continue',
  '/feynman',
  '/analytics',
  '/gaps',
] as const;

export type SupportedCommand = (typeof SUPPORTED_COMMANDS)[number];

export interface CommandContext {
  userId: string;
  topicId?: string;
  sessionId?: string;
}

export interface CommandResult {
  success: boolean;
  message: string;
  data?: unknown;
  action?: 'navigate' | 'display' | 'stream';
  navigateTo?: string;
}

/**
 * Check if a message is a known/supported command
 * Returns true only for messages starting with a SUPPORTED_COMMANDS prefix
 */
export function isCommand(message: string): boolean {
  const trimmed = message.trim().toLowerCase();
  return SUPPORTED_COMMANDS.some((cmd) => trimmed.startsWith(cmd));
}

/**
 * Check if a message looks like a slash command (starts with /)
 * This catches both valid and invalid commands so they can be routed
 * through the command handler for proper error messages.
 *
 * Use this in the route handler to intercept all /-prefixed messages.
 * Then use parseCommand() to determine if it's a known command.
 */
export function isSlashCommand(message: string): boolean {
  const trimmed = message.trim();
  // Must start with / and have at least one character after it
  if (!trimmed.startsWith('/') || trimmed.length < 2) {
    return false;
  }
  // Check that there's at least one non-whitespace character after /
  const afterSlash = trimmed.slice(1).trim();
  return afterSlash.length > 0;
}

/**
 * Parse command from message
 */
export function parseCommand(message: string): {
  command: SupportedCommand | null;
  args: string;
} {
  const trimmed = message.trim().toLowerCase();

  for (const cmd of SUPPORTED_COMMANDS) {
    if (trimmed.startsWith(cmd)) {
      return {
        command: cmd as SupportedCommand,
        args: message.slice(cmd.length).trim(),
      };
    }
  }

  return { command: null, args: '' };
}

/**
 * Execute a command and return the result
 */
export async function executeCommand(
  command: SupportedCommand,
  context: CommandContext,
  args: string = ''
): Promise<CommandResult> {
  switch (command) {
    case '/hint':
      return handleHintCommand(context);

    case '/skip':
      return handleSkipCommand(context);

    case '/progress':
      return handleProgressCommand(context);

    case '/topics':
      return handleTopicsCommand(context);

    case '/review':
      return handleReviewCommand(context);

    case '/quiz':
      return handleQuizCommand(context);

    case '/break':
      return handleBreakCommand(context);

    case '/continue':
      return handleContinueCommand(context);

    case '/feynman':
      return handleFeynmanCommand(context, args);

    case '/analytics':
      return handleAnalyticsCommand(context, args);

    case '/gaps':
      return handleGapsCommand(context);

    default:
      return {
        success: false,
        message: `Unknown command. Try: ${SUPPORTED_COMMANDS.join(', ')}`,
      };
  }
}

/**
 * /hint - Get a hint for the current question
 *
 * Works with either:
 * 1. A formally tracked question (currentQuestionId in session)
 * 2. The most recent question from conversation history
 */
async function handleHintCommand(context: CommandContext): Promise<CommandResult> {
  if (!context.sessionId) {
    return {
      success: false,
      message: "Hohoho! You need to be in a learning session to get hints. Start learning a topic first!",
    };
  }

  const session = await getSessionById(context.sessionId);
  if (!session) {
    return {
      success: false,
      message: "Session not found. Start a new learning session!",
    };
  }

  const MAX_HINTS = 3;
  if (session.hintsUsed >= MAX_HINTS) {
    return {
      success: false,
      message: "Hohoho! You've used all 3 hints for this question. Trust your training, young one!",
      data: { hintsUsed: session.hintsUsed, maxHints: MAX_HINTS },
    };
  }

  // Try to get hint from formally tracked question first
  if (session.currentQuestionId) {
    const question = await prisma.question.findUnique({
      where: { id: session.currentQuestionId },
      include: { concept: true },
    });

    if (question) {
      const hints = question.hints || [];
      const hintIndex = session.hintsUsed;
      const currentHint = hints[hintIndex] || hints[hints.length - 1] || "Think about the core principle here...";

      await prisma.learningSession.update({
        where: { id: context.sessionId },
        data: { hintsUsed: session.hintsUsed + 1 },
      });

      return {
        success: true,
        message: `**Hint ${hintIndex + 1}/${MAX_HINTS}:** ${currentHint}`,
        data: {
          hint: currentHint,
          hintNumber: hintIndex + 1,
          hintsRemaining: MAX_HINTS - (hintIndex + 1),
        },
      };
    }
  }

  // Fallback: Generate hint from conversation context
  const messages = await prisma.message.findMany({
    where: { sessionId: context.sessionId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  // Find the most recent Sensie message that contains a question
  const sensieMessages = messages.filter(m => m.role === 'SENSIE');
  const questionMessage = sensieMessages.find(m =>
    m.content.includes('?') &&
    !m.content.startsWith('**Hint') &&
    !m.content.startsWith('**Your Training Progress')
  );

  if (!questionMessage) {
    return {
      success: false,
      message: "No active question to give hints for. Continue the conversation with Sensie first!",
    };
  }

  // Generate a contextual hint based on the question
  const hintIndex = session.hintsUsed;
  const progressiveHints = generateProgressiveHint(questionMessage.content, hintIndex);

  // Update hints used
  await prisma.learningSession.update({
    where: { id: context.sessionId },
    data: { hintsUsed: session.hintsUsed + 1 },
  });

  return {
    success: true,
    message: `**Hint ${hintIndex + 1}/${MAX_HINTS}:** ${progressiveHints}`,
    data: {
      hint: progressiveHints,
      hintNumber: hintIndex + 1,
      hintsRemaining: MAX_HINTS - (hintIndex + 1),
    },
  };
}

/**
 * Generate progressive hints based on the question context
 */
function generateProgressiveHint(questionContent: string, hintIndex: number): string {
  // Extract key concepts from the question to create relevant hints
  const hints = [
    "Think about the fundamental concept being asked. What do you already know about this topic?",
    "Break down the question into smaller parts. What's the core principle at play here?",
    "Consider a real-world analogy. How would you explain this to a friend who's never programmed before?",
  ];

  return hints[Math.min(hintIndex, hints.length - 1)];
}

/**
 * /skip - Skip the current question
 */
async function handleSkipCommand(context: CommandContext): Promise<CommandResult> {
  if (!context.sessionId) {
    return {
      success: false,
      message: "You need to be in a learning session to skip questions!",
    };
  }

  const session = await getSessionById(context.sessionId);
  if (!session) {
    return {
      success: false,
      message: "Session not found!",
    };
  }

  const MAX_SKIPS = 3;
  if (session.skipsUsed >= MAX_SKIPS) {
    return {
      success: false,
      message: "Hohoho! No skips remaining. A true master faces every challenge!",
      data: { skipsUsed: session.skipsUsed, maxSkips: MAX_SKIPS },
    };
  }

  if (!session.currentQuestionId) {
    return {
      success: false,
      message: "No active question to skip!",
    };
  }

  // Update session with skip
  await prisma.learningSession.update({
    where: { id: context.sessionId },
    data: {
      skipsUsed: session.skipsUsed + 1,
      skippedQuestionIds: [...session.skippedQuestionIds, session.currentQuestionId],
      currentQuestionId: null,
    },
  });

  return {
    success: true,
    message: `Question skipped. You have ${MAX_SKIPS - session.skipsUsed - 1} skip(s) remaining. Remember, this concept will return later!`,
    data: {
      skipsUsed: session.skipsUsed + 1,
      skipsRemaining: MAX_SKIPS - session.skipsUsed - 1,
    },
  };
}

/**
 * /progress - Show detailed progress
 */
async function handleProgressCommand(context: CommandContext): Promise<CommandResult> {
  const [userProgress, todayAnalytics, topics, reviewsDue] = await Promise.all([
    getUserProgress(context.userId),
    getTodayAnalytics(context.userId),
    getTopicsByUser(context.userId),
    countReviewsDue(context.userId),
  ]);

  const activeTopics = topics.filter((t) => t.status === 'ACTIVE');
  const completedTopics = topics.filter((t) => t.status === 'COMPLETED');
  const totalMastery = topics.length > 0
    ? Math.round(topics.reduce((sum, t) => sum + t.masteryPercentage, 0) / topics.length)
    : 0;

  let message = `**Your Training Progress**\n\n`;
  message += `**Level ${userProgress.currentLevel}** | ${userProgress.totalXP} XP\n`;
  message += `Current streak: ${userProgress.currentStreak} days | Longest: ${userProgress.longestStreak} days\n\n`;

  message += `**Topics**\n`;
  message += `- Active: ${activeTopics.length}/3\n`;
  message += `- Completed: ${completedTopics.length}\n`;
  message += `- Average mastery: ${totalMastery}%\n\n`;

  if (activeTopics.length > 0) {
    message += `**Active Topics:**\n`;
    for (const topic of activeTopics) {
      message += `- ${topic.name}: ${topic.masteryPercentage}%\n`;
    }
    message += '\n';
  }

  message += `**Today:**\n`;
  message += `- Questions answered: ${todayAnalytics.questionsAnswered}\n`;
  message += `- Correct: ${todayAnalytics.questionsCorrect}\n`;
  message += `- XP earned: ${todayAnalytics.xpEarned}\n\n`;

  if (reviewsDue > 0) {
    message += `**${reviewsDue} review${reviewsDue === 1 ? '' : 's'} due** - Use \`/review\` to start!\n`;
  }

  return {
    success: true,
    message,
    data: {
      userProgress,
      todayAnalytics,
      topics: topics.map((t) => ({ name: t.name, status: t.status, mastery: t.masteryPercentage })),
      reviewsDue,
    },
  };
}

/**
 * /topics - List all learning topics
 */
async function handleTopicsCommand(context: CommandContext): Promise<CommandResult> {
  const topics = await getTopicsByUser(context.userId);

  const active = topics.filter((t) => t.status === 'ACTIVE');
  const completed = topics.filter((t) => t.status === 'COMPLETED');
  const queued = topics.filter((t) => t.status === 'QUEUED');

  let message = `**Your Learning Topics**\n\n`;

  if (active.length > 0) {
    message += `**Active (${active.length}/3):**\n`;
    for (const topic of active) {
      message += `- ${topic.name} (${topic.masteryPercentage}%)\n`;
      if (topic.subtopics && topic.subtopics.length > 0) {
        const inProgress = topic.subtopics.find((st) => !st.isLocked && st.masteryPercentage < 100);
        if (inProgress) {
          message += `  ↳ Current: ${inProgress.name}\n`;
        }
      }
    }
    message += '\n';
  }

  if (completed.length > 0) {
    message += `**Completed (${completed.length}):**\n`;
    for (const topic of completed) {
      message += `- ${topic.name} ✓\n`;
    }
    message += '\n';
  }

  if (queued.length > 0) {
    message += `**Queued (${queued.length}):**\n`;
    for (const topic of queued) {
      message += `- ${topic.name}\n`;
    }
    message += '\n';
  }

  if (topics.length === 0) {
    message = "No topics yet! What would you like to learn?";
  } else {
    message += `\nUse \`/continue\` to resume your last topic, or navigate to Topics page to manage them.`;
  }

  return {
    success: true,
    message,
    data: { topics: topics.map((t) => ({ id: t.id, name: t.name, status: t.status, mastery: t.masteryPercentage })) },
    action: 'display',
  };
}

/**
 * /review - Start spaced repetition review
 */
async function handleReviewCommand(context: CommandContext): Promise<CommandResult> {
  const reviewsDue = await countReviewsDue(context.userId);

  if (reviewsDue === 0) {
    return {
      success: true,
      message: "Hohoho! No reviews due right now. Great work keeping up with your training!",
      data: { reviewsDue: 0 },
    };
  }

  const reviews = await getReviewsDue(context.userId, 5);

  let message = `**${reviewsDue} Review${reviewsDue === 1 ? '' : 's'} Due**\n\n`;
  message += `Ready to strengthen your knowledge?\n\n`;
  message += `Preview of due items:\n`;

  for (const review of reviews.slice(0, 5)) {
    const concept = review.conceptId
      ? await prisma.concept.findUnique({
          where: { id: review.conceptId },
          select: { name: true },
        })
      : null;
    if (concept) {
      message += `- ${concept.name}\n`;
    }
  }

  if (reviewsDue > 5) {
    message += `...and ${reviewsDue - 5} more\n`;
  }

  message += `\nNavigate to the Review page to start your session!`;

  return {
    success: true,
    message,
    data: { reviewsDue, reviews: reviews.slice(0, 5) },
    action: 'navigate',
    navigateTo: '/review',
  };
}

/**
 * /quiz - Start a quiz on current topic
 */
async function handleQuizCommand(context: CommandContext): Promise<CommandResult> {
  if (!context.topicId) {
    // Get most recent active topic
    const activeTopics = await getActiveTopics(context.userId);
    if (activeTopics.length === 0) {
      return {
        success: false,
        message: "No active topics for a quiz! Start learning a topic first.",
      };
    }

    const topic = activeTopics[0];
    return {
      success: true,
      message: `**Quiz Time!**\n\nA quiz on "${topic.name}" is ready. Navigate to the quiz page or I can ask you questions here!\n\nReady to test your knowledge?`,
      data: { topicId: topic.id, topicName: topic.name },
      action: 'display',
    };
  }

  const topic = await getTopicById(context.topicId);
  if (!topic) {
    return {
      success: false,
      message: "Topic not found!",
    };
  }

  return {
    success: true,
    message: `**Quiz Time!**\n\nA quiz on "${topic.name}" is ready. Navigate to the quiz page or I can ask you questions here!\n\nReady to test your knowledge?`,
    data: { topicId: topic.id, topicName: topic.name },
    action: 'display',
  };
}

/**
 * /break - Save progress and take a break
 */
async function handleBreakCommand(context: CommandContext): Promise<CommandResult> {
  let sessionDuration = 0;
  let questionsAnswered = 0;

  if (context.sessionId) {
    const session = await getSessionById(context.sessionId, true);
    if (session) {
      // Calculate session duration in minutes (using createdAt as session start)
      sessionDuration = Math.round(
        (Date.now() - new Date(session.createdAt).getTime()) / (1000 * 60)
      );

      // Count user messages as proxy for questions answered
      const messages = await prisma.message.findMany({
        where: { sessionId: context.sessionId, role: 'USER' },
      });
      questionsAnswered = messages.length;

      // Mark session as inactive but don't end it (can be resumed)
      await prisma.learningSession.update({
        where: { id: context.sessionId },
        data: { lastActivity: new Date() },
      });
    }
  }

  const breakMessages = [
    "Rest well, young one. Even the mightiest warriors need time to recover!",
    "Hohoho! Good work today. Your brain needs time to consolidate what you've learned.",
    "Time for a break! Remember, true mastery is built one session at a time.",
    "Taking a rest is wisdom, not weakness. See you soon, apprentice!",
    "Your progress has been saved. Go stretch those legs!",
  ];

  const message = breakMessages[Math.floor(Math.random() * breakMessages.length)];

  let summary = `**${message}**\n\n`;
  if (sessionDuration > 0 || questionsAnswered > 0) {
    summary += `This session:\n`;
    summary += `- Duration: ${sessionDuration} minutes\n`;
    summary += `- Questions tackled: ${questionsAnswered}\n\n`;
  }
  summary += `Your progress is saved. Use \`/continue\` when you're ready to resume!`;

  return {
    success: true,
    message: summary,
    data: { sessionDuration, questionsAnswered },
  };
}

/**
 * /continue - Continue the last studied topic
 *
 * This command finds the user's most recent learning session or active topic
 * and provides a response that triggers navigation to the topic chat.
 * The navigation is handled by the frontend which detects the "Resuming:" or
 * "Ready to continue:" pattern in the response.
 */
async function handleContinueCommand(context: CommandContext): Promise<CommandResult> {
  // First, check for active sessions
  const activeSessions = await getActiveSessionsByUser(context.userId);

  if (activeSessions.length > 0) {
    // Get the most recent session
    const latestSession = activeSessions[0];
    const topic = await getTopicById(latestSession.topicId, true);

    if (topic) {
      let message = `**Resuming: ${topic.name}**\n\n`;
      message += `Mastery: ${topic.masteryPercentage}%\n`;

      // Find current subtopic if available
      if (latestSession.currentSubtopicId) {
        const subtopic = await prisma.subtopic.findUnique({
          where: { id: latestSession.currentSubtopicId },
        });
        if (subtopic) {
          message += `Current subtopic: ${subtopic.name}\n`;
        }
      }

      // Get message count to show in summary
      const dbMessages = await getSessionMessages(latestSession.id);
      if (dbMessages.length > 0) {
        message += `Conversation history: ${dbMessages.length} messages\n`;
      }

      message += `\nWelcome back, apprentice! Let's continue your training. Navigating now...`;

      return {
        success: true,
        message,
        data: {
          topicId: topic.id,
          topicName: topic.name,
          sessionId: latestSession.id,
          mastery: topic.masteryPercentage,
        },
        action: 'navigate',
        navigateTo: `/chat?topic=${topic.id}`,
      };
    }
  }

  // No active sessions, check for active topics
  const activeTopics = await getActiveTopics(context.userId);

  if (activeTopics.length > 0) {
    const topic = activeTopics[0];
    let message = `**Ready to continue: ${topic.name}**\n\n`;
    message += `Mastery: ${topic.masteryPercentage}%\n`;
    message += `\nWelcome back! Let's pick up where you left off. Navigating now...`;

    return {
      success: true,
      message,
      data: {
        topicId: topic.id,
        topicName: topic.name,
        mastery: topic.masteryPercentage,
      },
      action: 'navigate',
      navigateTo: `/chat?topic=${topic.id}`,
    };
  }

  // No active topics at all
  return {
    success: false,
    message: "No active topics to continue! What would you like to learn? Go to Topics to start something new.",
    action: 'navigate',
    navigateTo: '/topics',
  };
}

/**
 * /feynman - Start or continue a Feynman Technique exercise
 *
 * The Feynman Technique helps solidify learning by explaining concepts
 * in simple terms as if teaching to a child/beginner.
 *
 * Usage:
 * - /feynman - Start Feynman exercise for current topic
 * - /feynman child - Explain to a 10-year-old
 * - /feynman beginner - Explain to a programming beginner
 * - /feynman peer - Explain to a fellow developer
 * - /feynman status - Show Feynman exercise stats
 */
async function handleFeynmanCommand(
  context: CommandContext,
  args?: string
): Promise<CommandResult> {
  // Parse arguments
  const arg = args?.trim().toLowerCase();

  // Handle status subcommand
  if (arg === 'status' || arg === 'stats') {
    const stats = await getFeynmanStats(context.userId);
    let message = `**Your Feynman Stats**\n\n`;
    message += `Total exercises completed: ${stats.totalCompleted}\n`;
    message += `Total attempts: ${stats.totalAttempts}\n`;
    message += `Average score: ${stats.averageScore}/100\n`;
    message += `Topics with Feynman exercises: ${stats.topicsWithFeynman}\n`;

    return {
      success: true,
      message,
      data: stats,
    };
  }

  // Determine target audience
  let targetAudience: 'child' | 'beginner' | 'peer' = 'child';
  if (arg === 'beginner') {
    targetAudience = 'beginner';
  } else if (arg === 'peer') {
    targetAudience = 'peer';
  }

  // Check if there's already an active Feynman exercise
  const activeExercise = await getActiveFeynmanExercise(context.userId, context.topicId);
  if (activeExercise) {
    const audienceDesc = {
      child: 'a 10-year-old',
      beginner: 'a programming beginner',
      peer: 'a fellow developer',
    };

    let message = `**Feynman Exercise in Progress**\n\n`;
    message += `Concept: ${activeExercise.conceptName}\n`;
    message += `Target audience: ${audienceDesc[activeExercise.targetAudience]}\n`;
    message += `Attempts: ${activeExercise.attempts}\n\n`;

    if (activeExercise.status === 'NEEDS_REFINEMENT' && activeExercise.evaluation) {
      message += `Your last explanation scored ${activeExercise.evaluation.score}/100.\n`;
      message += `Please refine your explanation and submit again.\n\n`;
    }

    message += getFeynmanPrompt(activeExercise.conceptName, activeExercise.targetAudience);

    return {
      success: true,
      message,
      data: { exerciseId: activeExercise.id },
    };
  }

  // Need a topic to start Feynman
  if (!context.topicId) {
    return {
      success: false,
      message: "You need to be learning a topic to start a Feynman exercise. Use `/topics` to see your topics.",
    };
  }

  // Check if topic has enough mastery
  const topic = await getTopicById(context.topicId, true);
  if (!topic) {
    return {
      success: false,
      message: "Topic not found. Please select a valid topic first.",
    };
  }

  // Allow manual trigger even if mastery is below threshold
  const triggerResult = await shouldTriggerFeynman(context.userId, context.topicId);

  // If mastery is too low and no manual concept provided
  if (topic.masteryPercentage < FEYNMAN_TRIGGER_MASTERY && !triggerResult.conceptName) {
    return {
      success: false,
      message: `**Not Ready Yet**\n\nFeynman exercises work best after reaching ${FEYNMAN_TRIGGER_MASTERY}% mastery.\n\nCurrent mastery: ${topic.masteryPercentage}%\n\nKeep learning! You're almost there.`,
    };
  }

  // Find a concept to explain
  let conceptName = triggerResult.conceptName;
  let conceptId = triggerResult.conceptId;

  // Get topic with subtopics if needed
  const topicWithSubtopics = await prisma.topic.findUnique({
    where: { id: context.topicId },
    include: {
      subtopics: {
        include: { concepts: true },
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!conceptName && topicWithSubtopics?.subtopics && topicWithSubtopics.subtopics.length > 0) {
    // Get first unlocked subtopic's first concept
    for (const subtopic of topicWithSubtopics.subtopics) {
      if (!subtopic.isLocked && subtopic.concepts && subtopic.concepts.length > 0) {
        conceptName = subtopic.concepts[0].name;
        conceptId = subtopic.concepts[0].id;
        break;
      }
    }
  }

  if (!conceptName) {
    conceptName = topic.name; // Fall back to topic name
  }

  // Start new exercise
  const exercise = await startFeynmanExercise({
    userId: context.userId,
    topicId: context.topicId,
    conceptId,
    conceptName,
    targetAudience,
    previousAttempts: [],
  });

  const prompt = getFeynmanPrompt(conceptName, targetAudience);

  return {
    success: true,
    message: prompt,
    data: { exerciseId: exercise.id },
  };
}

/**
 * /analytics - Show learning analytics summary
 *
 * Usage:
 * - /analytics - Show weekly summary
 * - /analytics daily - Show today's stats
 * - /analytics weekly - Show this week's stats
 * - /analytics monthly - Show this month's stats
 * - /analytics all - Show all-time stats
 */
async function handleAnalyticsCommand(
  context: CommandContext,
  args?: string
): Promise<CommandResult> {
  const arg = args?.trim().toLowerCase();

  // Determine period
  let period: 'daily' | 'weekly' | 'monthly' | 'all-time' = 'weekly';
  if (arg === 'daily' || arg === 'today') {
    period = 'daily';
  } else if (arg === 'monthly' || arg === 'month') {
    period = 'monthly';
  } else if (arg === 'all' || arg === 'all-time') {
    period = 'all-time';
  }

  try {
    const analytics = await getLearningAnalytics(context.userId, period);

    let message = `**Learning Analytics - ${period.charAt(0).toUpperCase() + period.slice(1)}**\n\n`;

    // Activity metrics
    message += `**Activity**\n`;
    message += `Study time: ${analytics.totalStudyTime} minutes\n`;
    message += `Sessions: ${analytics.sessionsCount}\n`;
    message += `Questions answered: ${analytics.questionsAnswered}\n`;
    message += `Accuracy: ${analytics.accuracy}%\n\n`;

    // Progress metrics
    message += `**Progress**\n`;
    message += `Topics mastered: ${analytics.topicsMastered}\n`;
    message += `Concepts learned: ${analytics.conceptsLearned}\n`;
    message += `Reviews completed: ${analytics.reviewsCompleted}\n`;
    message += `Feynman exercises: ${analytics.feynmanExercisesCompleted}\n\n`;

    // Gamification
    message += `**Achievements**\n`;
    message += `XP earned: ${analytics.xpEarned}\n`;
    message += `Current streak: ${analytics.currentStreak} days\n`;
    message += `Longest streak: ${analytics.longestStreak} days\n`;

    if (analytics.badgesEarned.length > 0) {
      message += `Badges: ${analytics.badgesEarned.join(', ')}\n`;
    }

    return {
      success: true,
      message,
      data: analytics,
    };
  } catch (error) {
    console.error('[analytics] Error fetching analytics:', error);
    return {
      success: false,
      message: "Unable to fetch analytics. Please try again.",
    };
  }
}

/**
 * /gaps - Analyze knowledge gaps and get recommendations
 *
 * Provides detailed analysis of areas where understanding is weak
 * and actionable recommendations for improvement.
 */
async function handleGapsCommand(context: CommandContext): Promise<CommandResult> {
  if (!context.topicId) {
    return {
      success: false,
      message: "You need to be learning a topic to analyze gaps. Use `/topics` to see your topics.",
    };
  }

  try {
    const analysis = await analyzeKnowledgeGaps(context.userId, context.topicId);

    if (analysis.gaps.length === 0) {
      return {
        success: true,
        message: `**Knowledge Gap Analysis**\n\nExcellent work! No significant knowledge gaps detected.\n\nOverall strength: ${analysis.overallStrength}%\n\nKeep up the great learning!`,
        data: analysis,
      };
    }

    let message = `**Knowledge Gap Analysis**\n\n`;
    message += `Overall strength: ${analysis.overallStrength}%\n`;
    message += `Critical gaps: ${analysis.criticalGapsCount}\n\n`;

    // Show gaps by severity
    const criticalGaps = analysis.gaps.filter(g => g.severity === 'critical');
    const moderateGaps = analysis.gaps.filter(g => g.severity === 'moderate');
    const minorGaps = analysis.gaps.filter(g => g.severity === 'minor');

    if (criticalGaps.length > 0) {
      message += `**Critical Gaps**\n`;
      for (const gap of criticalGaps.slice(0, 3)) {
        message += `- ${gap.concept}\n`;
        message += `  Evidence: ${gap.evidence}\n`;
        if (gap.relatedMisconceptions.length > 0) {
          message += `  Misconceptions: ${gap.relatedMisconceptions.join(', ')}\n`;
        }
      }
      message += '\n';
    }

    if (moderateGaps.length > 0) {
      message += `**Moderate Gaps** (${moderateGaps.length})\n`;
      for (const gap of moderateGaps.slice(0, 3)) {
        message += `- ${gap.concept}\n`;
      }
      message += '\n';
    }

    if (minorGaps.length > 0) {
      message += `**Minor Gaps** (${minorGaps.length})\n`;
      for (const gap of minorGaps.slice(0, 2)) {
        message += `- ${gap.concept}\n`;
      }
      message += '\n';
    }

    // Recommendations
    if (analysis.recommendedActions.length > 0) {
      message += `**Recommendations**\n`;
      const highPriority = analysis.recommendedActions.filter(r => r.priority === 'high');
      for (const rec of highPriority.slice(0, 3)) {
        const actionLabel = {
          reteach: 'Review',
          practice: 'Practice',
          review: 'Quick review',
          prerequisite: 'Learn prerequisite',
        };
        message += `- ${actionLabel[rec.type]}: ${rec.targetConceptName}\n`;
        message += `  ${rec.reason} (~${rec.estimatedTime} min)\n`;
      }
    }

    return {
      success: true,
      message,
      data: analysis,
    };
  } catch (error) {
    console.error('[gaps] Error analyzing gaps:', error);
    return {
      success: false,
      message: "Unable to analyze knowledge gaps. Please try again.",
    };
  }
}
