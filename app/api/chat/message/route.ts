import { NextRequest } from 'next/server';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { getSession } from '@/lib/auth/session';
import { requireAuth } from '@/lib/auth/auth';
import { getActiveSession, createSession, addMessage } from '@/lib/db/sessions';
import { getTopicById } from '@/lib/db/topics';
import { sensieAgent } from '@/lib/mastra/agents/sensie';
import { SENSIE_SYSTEM_PROMPT } from '@/lib/mastra/prompts';
import { isSlashCommand, parseCommand, executeCommand, SUPPORTED_COMMANDS } from '@/lib/chat/commands';

/**
 * POST /api/chat/message
 * Send a message to Sensie and get a response
 * Uses Mastra's sensieAgent with streaming
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
      const lastUserMessage = messages[messages.length - 1];
      if (lastUserMessage?.role === 'user') {
        // AI SDK v6 uses 'parts' array, v4 uses 'content' string
        const messageContent = extractMessageContent(lastUserMessage);
        if (messageContent) {
          await addMessage({
            sessionId: learningSession.id,
            role: 'USER',
            content: messageContent,
          });
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
