import { NextRequest } from 'next/server';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { getSession } from '@/lib/auth/session';
import { requireAuth } from '@/lib/auth/auth';
import { getActiveSession, createSession, addMessage, updateSessionState } from '@/lib/db/sessions';
import { getTopicById } from '@/lib/db/topics';
import { createQuestion, getQuestionById } from '@/lib/db/questions';
import { createAnswer } from '@/lib/db/answers';
import { sensieAgent } from '@/lib/mastra/agents/sensie';
import { SENSIE_SYSTEM_PROMPT } from '@/lib/mastra/prompts';
import { isSlashCommand, parseCommand, executeCommand, SUPPORTED_COMMANDS } from '@/lib/chat/commands';
import { updateMastery } from '@/lib/learning/progress-tracker';
import { updateTodayAnalytics } from '@/lib/db/progress';
import { awardXP, updateStreak } from '@/lib/learning/analytics-engine';
import { prisma } from '@/lib/db/client';
import type { AnswerDepth, QuestionType } from '.prisma/client-sensie';

// XP constants for chat-based answers
const XP_CORRECT_DEEP = 15;
const XP_CORRECT_MODERATE = 10;
const XP_CORRECT_SHALLOW = 5;
const XP_ATTEMPT = 2; // Encouragement XP for trying

// Minimum answer length to be considered for evaluation
const MIN_ANSWER_LENGTH = 10;

/**
 * POST /api/chat/message
 * Send a message to Sensie and get a response
 * Uses Mastra's sensieAgent with streaming
 *
 * BUG #6 FIX: Now tracks progress, creates Answer records, awards XP
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const authResult = requireAuth(session);
    if (!authResult.authorized || !session) {
      return new Response(JSON.stringify({ error: authResult.error }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { messages, topicId } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Extract the last user message content
    const lastUserMessage = messages[messages.length - 1];
    const messageContent = lastUserMessage?.role === 'user'
      ? extractMessageContent(lastUserMessage)
      : null;

    // Check if the message looks like a command (starts with /)
    // This catches both valid and invalid commands for proper error messages
    if (messageContent && isSlashCommand(messageContent)) {
      return handleCommandMessage(session, messageContent, topicId);
    }

    // Get or create learning session if topicId provided
    let learningSession = null;
    let topic = null;

    if (topicId) {
      topic = await getTopicById(topicId);
      if (!topic || topic.userId !== session.userId) {
        return new Response(JSON.stringify({ error: 'Topic not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      learningSession = await getActiveSession(topicId);
      if (!learningSession) {
        learningSession = await createSession({
          userId: session.userId,
          topicId,
        });
      }

      // Store user message
      if (lastUserMessage?.role === 'user') {
        const userMessageContent = extractMessageContent(lastUserMessage);
        if (userMessageContent) {
          await addMessage({
            sessionId: learningSession.id,
            role: 'USER',
            content: userMessageContent,
          });

          // BUG #6 FIX: Evaluate user message and track progress
          // Only evaluate if the message is substantive (not just a short greeting)
          if (userMessageContent.trim().length >= MIN_ANSWER_LENGTH) {
            await evaluateAndTrackProgress(
              session.userId,
              learningSession.id,
              topicId,
              topic.name,
              userMessageContent,
              messages
            );
          }
        }
      }
    }

    // Build context for Sensie
    const instructions = buildInstructions(topic?.name, topic?.masteryPercentage);

    // Capture sessionId for onFinish callback
    const sessionId = learningSession?.id;

    // Use Mastra's sensieAgent for streaming with AI SDK v6 compatible format
    // Use onFinish callback to save assistant response after streaming completes
    const stream = await sensieAgent.stream(messages, {
      instructions,
      format: 'aisdk',
      onFinish: async ({ text }) => {
        if (sessionId && text?.trim()) {
          try {
            console.log('[chat] Saving Sensie response:', text.substring(0, 100) + '...');
            await addMessage({
              sessionId,
              role: 'SENSIE',
              content: text.trim(),
            });
            console.log('[chat] Sensie response saved successfully');
          } catch (error) {
            console.error('[chat] Failed to save Sensie response:', error);
          }
        }
      },
    });

    // Return AI SDK v6 compatible streaming response
    return stream.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Chat error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * BUG #6 FIX: Evaluate user response and track progress
 *
 * This function:
 * 1. Gets or creates a question context for the topic
 * 2. Uses AI to evaluate if the response shows understanding
 * 3. Creates an Answer record
 * 4. Awards XP and updates streak
 * 5. Updates topic mastery
 */
async function evaluateAndTrackProgress(
  userId: string,
  sessionId: string,
  topicId: string,
  topicName: string,
  userMessage: string,
  conversationHistory: Array<{ role: string; content?: string; parts?: Array<{ type: string; text?: string }> }>
): Promise<void> {
  try {
    console.log('[chat] Evaluating response for progress tracking...');

    // Get or create a question for this learning context
    // First, try to get an existing question or create one for the topic
    let questionId = await getOrCreateSessionQuestion(topicId, topicName);
    if (!questionId) {
      console.log('[chat] Could not get/create question - skipping progress tracking');
      return;
    }

    // Get the previous assistant message (Sensie's question/prompt)
    const previousMessages = conversationHistory.slice(-4); // Last few messages for context
    const previousAssistantMessage = previousMessages
      .filter(m => m.role === 'assistant')
      .map(m => extractMessageContent(m as { content?: string; parts?: Array<{ type: string; text?: string }> }))
      .filter(Boolean)
      .pop();

    // Use AI to evaluate the response
    const evaluation = await evaluateResponseWithAI(
      userMessage,
      previousAssistantMessage || `Learning about ${topicName}`,
      topicName
    );

    console.log('[chat] Evaluation result:', evaluation);

    // Create the Answer record
    const answer = await createAnswer({
      questionId,
      userId,
      sessionId,
      text: userMessage,
      isCorrect: evaluation.isCorrect,
      depth: evaluation.depth as AnswerDepth,
      hintsUsed: 0,
      attemptNumber: 1,
    });

    console.log('[chat] Answer record created:', answer.id);

    // Update daily analytics
    await updateTodayAnalytics(userId, {
      questionsAnswered: 1,
      questionsCorrect: evaluation.isCorrect ? 1 : 0,
    });

    // Award XP based on evaluation
    let xpAmount = XP_ATTEMPT;
    if (evaluation.isCorrect) {
      if (evaluation.depth === 'DEEP') {
        xpAmount = XP_CORRECT_DEEP;
      } else if (evaluation.depth === 'MODERATE') {
        xpAmount = XP_CORRECT_MODERATE;
      } else {
        xpAmount = XP_CORRECT_SHALLOW;
      }
    }
    await awardXP(userId, xpAmount, 'chat_answer');
    console.log(`[chat] Awarded ${xpAmount} XP for ${evaluation.depth} ${evaluation.isCorrect ? 'correct' : 'incorrect'} answer`);

    // Update streak
    await updateStreak(userId);
    console.log('[chat] Streak updated');

    // Update topic mastery
    await updateMastery(topicId, userId);
    console.log('[chat] Mastery updated');

  } catch (error) {
    // Log error but don't fail the request - chat should still work
    console.error('[chat] Error tracking progress (non-fatal):', error);
  }
}

/**
 * Get or create a question for the learning session
 * This creates a generic "session question" that represents learning about the topic
 */
async function getOrCreateSessionQuestion(topicId: string, topicName: string): Promise<string | null> {
  try {
    // Get the first concept for this topic (to have a valid conceptId for the question)
    const firstConcept = await prisma.concept.findFirst({
      where: {
        subtopic: {
          topicId,
        },
      },
      orderBy: {
        subtopic: {
          order: 'asc',
        },
      },
    });

    if (!firstConcept) {
      console.log('[chat] No concept found for topic - creating fallback');
      // Create a minimal concept for tracking
      const subtopic = await prisma.subtopic.findFirst({
        where: { topicId },
        orderBy: { order: 'asc' },
      });

      if (!subtopic) {
        console.log('[chat] No subtopic found - cannot track progress');
        return null;
      }

      const newConcept = await prisma.concept.create({
        data: {
          subtopicId: subtopic.id,
          name: `${topicName} - General Learning`,
          explanation: `Learning about ${topicName} through Socratic dialogue`,
        },
      });

      // Create a session question for this concept
      const question = await createQuestion({
        conceptId: newConcept.id,
        text: `Demonstrate your understanding of ${topicName}`,
        type: 'UNDERSTANDING' as QuestionType,
        difficulty: 3,
        expectedElements: ['Shows understanding', 'Demonstrates knowledge', 'Applies concepts'],
        hints: ['Think about the key concepts', 'Consider real-world applications', 'Explain in your own words'],
        followUpPrompts: ['Can you elaborate?', 'How does this apply?', 'What else?'],
      });

      return question.id;
    }

    // Check if there's already a question for this concept
    const existingQuestion = await prisma.question.findFirst({
      where: {
        conceptId: firstConcept.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (existingQuestion) {
      return existingQuestion.id;
    }

    // Create a new question for tracking
    const question = await createQuestion({
      conceptId: firstConcept.id,
      text: `Demonstrate your understanding of ${firstConcept.name}`,
      type: 'UNDERSTANDING' as QuestionType,
      difficulty: 3,
      expectedElements: ['Shows understanding', 'Demonstrates knowledge', 'Applies concepts'],
      hints: ['Think about the key concepts', 'Consider real-world applications', 'Explain in your own words'],
      followUpPrompts: ['Can you elaborate?', 'How does this apply?', 'What else?'],
    });

    return question.id;
  } catch (error) {
    console.error('[chat] Error getting/creating session question:', error);
    return null;
  }
}

/**
 * Use AI to evaluate if the user's response demonstrates understanding
 */
async function evaluateResponseWithAI(
  userResponse: string,
  context: string,
  topicName: string
): Promise<{ isCorrect: boolean; depth: 'NONE' | 'SHALLOW' | 'MODERATE' | 'DEEP' }> {
  try {
    const evaluationPrompt = `You are evaluating a student's response in a Socratic learning conversation about "${topicName}".

Context/Previous message: "${context.substring(0, 500)}"

Student's response: "${userResponse}"

Evaluate if this response demonstrates learning and understanding. Consider:
1. Does the response show engagement with the topic?
2. Does it demonstrate knowledge or thinking about the subject?
3. Is it a meaningful attempt to answer or discuss the topic?

IMPORTANT: Be generous in evaluation. Any thoughtful response that engages with the topic should be considered "correct" as it shows learning effort.

Respond with JSON only:
{
  "isCorrect": true/false,  // true if shows any engagement/understanding
  "depth": "NONE" | "SHALLOW" | "MODERATE" | "DEEP"
}

Where:
- NONE: Off-topic, gibberish, or no effort
- SHALLOW: Brief but on-topic, shows basic awareness
- MODERATE: Thoughtful response, shows understanding
- DEEP: Comprehensive, demonstrates deep understanding`;

    const result = await sensieAgent.generate(evaluationPrompt);
    const responseText = result.text || '';

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        isCorrect: parsed.isCorrect ?? true, // Default to true to encourage learning
        depth: (['NONE', 'SHALLOW', 'MODERATE', 'DEEP'].includes(parsed.depth) ? parsed.depth : 'SHALLOW') as 'NONE' | 'SHALLOW' | 'MODERATE' | 'DEEP',
      };
    }

    // Default: assume it's a valid learning response
    return { isCorrect: true, depth: 'SHALLOW' };
  } catch (error) {
    console.error('[chat] Error evaluating response with AI:', error);
    // Default: count as valid attempt
    return { isCorrect: true, depth: 'SHALLOW' };
  }
}

function buildInstructions(topicName?: string, mastery?: number): string {
  let prompt = SENSIE_SYSTEM_PROMPT;

  if (topicName) {
    prompt += `\n\nCurrent topic: ${topicName}`;
    if (typeof mastery === 'number') {
      prompt += `\nStudent's current mastery: ${mastery}%`;
    }
  }

  return prompt;
}

/**
 * Extract text content from message (supports both AI SDK v4 and v6 formats)
 * v4: { content: string }
 * v6: { parts: [{ type: 'text', text: string }, ...] }
 */
function extractMessageContent(message: {
  content?: string;
  parts?: Array<{ type: string; text?: string }>;
}): string | null {
  // AI SDK v6 format: parts array
  if (message.parts && Array.isArray(message.parts)) {
    const textParts = message.parts
      .filter((part) => part.type === 'text' && part.text)
      .map((part) => part.text)
      .join('');
    if (textParts) return textParts;
  }

  // AI SDK v4 format: content string
  if (typeof message.content === 'string') {
    return message.content;
  }

  return null;
}

/**
 * Handle command messages
 * Returns a streaming response that mimics the AI SDK format
 */
async function handleCommandMessage(
  session: { userId: string },
  messageContent: string,
  topicId?: string
): Promise<Response> {
  const { command, args } = parseCommand(messageContent);

  if (!command) {
    return createCommandResponse(`I didn't recognize that command. Available commands: ${SUPPORTED_COMMANDS.join(', ')}`);
  }

  // Get learning session if we have a topicId
  let learningSessionId: string | undefined;
  if (topicId) {
    const learningSession = await getActiveSession(topicId);
    learningSessionId = learningSession?.id;
  }

  // Execute the command
  const result = await executeCommand(command, {
    userId: session.userId,
    topicId,
    sessionId: learningSessionId,
  }, args);

  return createCommandResponse(result.message, result.data, result.action, result.navigateTo);
}

/**
 * Create a streaming response for command results
 * Uses AI SDK's createUIMessageStream and createUIMessageStreamResponse for proper formatting
 */
function createCommandResponse(
  message: string,
  _data?: unknown,
  _action?: string,
  _navigateTo?: string
): Response {
  // Generate unique IDs
  const messageId = `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const textId = 'txt-0';

  // Create the stream with our command response - following the full protocol
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      // Start the message
      writer.write({ type: 'start', messageId });

      // Start a step
      writer.write({ type: 'start-step' });

      // Start text part
      writer.write({ type: 'text-start', id: textId });

      // Write the text delta
      writer.write({ type: 'text-delta', delta: message, id: textId });

      // End text part
      writer.write({ type: 'text-end', id: textId });

      // Finish step
      writer.write({ type: 'finish-step' });

      // Finish message
      writer.write({ type: 'finish', finishReason: 'stop' });
    },
    onError: (error: unknown) => {
      console.error('[command] Error in stream:', error);
      return 'An error occurred processing the command.';
    },
  });

  // Return the response with the stream
  return createUIMessageStreamResponse({
    status: 200,
    stream,
  });
}
