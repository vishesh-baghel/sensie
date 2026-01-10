import { z } from 'zod';

/**
 * Zod schemas for structured AI outputs
 *
 * These schemas ensure type-safe responses from LLM calls
 */

/**
 * Schema for answer evaluation response
 */
export const AnswerEvaluationSchema = z.object({
  isCorrect: z.boolean().describe('Whether the answer is correct'),
  depth: z.enum(['NONE', 'SHALLOW', 'DEEP']).describe('Depth of understanding shown: NONE (wrong), SHALLOW (correct but lacks depth), DEEP (correct with understanding)'),
  missingElements: z
    .array(z.string())
    .describe('Key elements missing from the answer'),
  misconceptions: z
    .array(z.string())
    .describe('Any misconceptions in the answer'),
  feedback: z.string().describe('Feedback in Sensie voice'),
  confidence: z.number().min(0).max(1).describe('Confidence in evaluation'),
});

export type AnswerEvaluationResponse = z.infer<typeof AnswerEvaluationSchema>;

/**
 * Schema for generated Socratic question
 */
export const SocraticQuestionSchema = z.object({
  text: z.string().describe('The question text'),
  type: z
    .enum(['UNDERSTANDING', 'APPLICATION', 'ANALYSIS', 'SYNTHESIS', 'EVALUATION'])
    .describe('Type of question'),
  difficulty: z.number().min(1).max(5).describe('Difficulty level 1-5'),
  expectedElements: z
    .array(z.string())
    .describe('Elements expected in a good answer'),
  hints: z
    .array(z.string())
    .max(3)
    .describe('Progressive hints (max 3)'),
  followUpPrompts: z
    .array(z.string())
    .describe('Potential follow-up questions'),
});

export type SocraticQuestionResponse = z.infer<typeof SocraticQuestionSchema>;

/**
 * Schema for learning path generation
 */
export const LearningPathSchema = z.object({
  topicName: z.string().describe('Name of the topic'),
  domain: z
    .enum(['technical', 'soft-skills', 'career'])
    .describe('Domain classification'),
  subtopics: z
    .array(
      z.object({
        name: z.string().describe('Subtopic name'),
        order: z.number().describe('Order in learning sequence'),
        concepts: z.array(z.string()).describe('Concept names'),
        estimatedMinutes: z.number().optional().describe('Estimated time'),
      })
    )
    .describe('Ordered subtopics'),
  estimatedHours: z.number().describe('Total estimated hours'),
  prerequisites: z.array(z.string()).describe('Prerequisite topics'),
});

export type LearningPathResponse = z.infer<typeof LearningPathSchema>;

/**
 * Schema for concept explanation
 */
export const ConceptExplanationSchema = z.object({
  introduction: z.string().describe('Brief hook/context setter'),
  keyPoints: z.array(z.string()).describe('Key points to understand'),
  realWorldExample: z.string().describe('Practical example'),
  commonMistakes: z.array(z.string()).describe('Common misconceptions'),
  relatedConcepts: z.array(z.string()).describe('Related concepts'),
});

export type ConceptExplanationResponse = z.infer<typeof ConceptExplanationSchema>;

/**
 * Schema for quiz question
 */
export const QuizQuestionSchema = z.object({
  question: z.string().describe('Question text'),
  type: z.enum(['UNDERSTANDING', 'APPLICATION', 'ANALYSIS']).describe('Question type'),
  difficulty: z.number().min(1).max(5).describe('Difficulty 1-5'),
  expectedAnswer: z.string().describe('Expected answer elements'),
  scoringCriteria: z.array(z.string()).describe('What to look for in answer'),
});

export type QuizQuestionResponse = z.infer<typeof QuizQuestionSchema>;

/**
 * Schema for quiz generation
 */
export const QuizSchema = z.object({
  title: z.string().describe('Quiz title'),
  description: z.string().describe('Brief description'),
  questions: z.array(QuizQuestionSchema).describe('Quiz questions'),
  totalPoints: z.number().describe('Maximum possible points'),
  passingScore: z.number().describe('Points needed to pass'),
  timeLimit: z.number().optional().describe('Time limit in minutes'),
});

export type QuizResponse = z.infer<typeof QuizSchema>;

/**
 * Schema for knowledge gap detection
 */
export const KnowledgeGapSchema = z.object({
  gap: z.string().describe('Description of the gap'),
  severity: z.enum(['minor', 'moderate', 'critical']).describe('How serious'),
  relatedConcepts: z.array(z.string()).describe('Concepts to revisit'),
  suggestedAction: z.string().describe('What to do about it'),
});

export type KnowledgeGapResponse = z.infer<typeof KnowledgeGapSchema>;

/**
 * Schema for encouragement generation
 */
export const EncouragementSchema = z.object({
  message: z.string().describe('Encouragement message in Sensie voice'),
  animeReference: z.string().optional().describe('Optional anime reference'),
  nextStep: z.string().optional().describe('Suggestion for what to do next'),
});

export type EncouragementResponse = z.infer<typeof EncouragementSchema>;

/**
 * Schema for progress summary
 */
export const ProgressSummarySchema = z.object({
  overview: z.string().describe('Brief progress overview'),
  strengths: z.array(z.string()).describe('Areas of strength'),
  areasToImprove: z.array(z.string()).describe('Areas needing work'),
  recommendation: z.string().describe('What to focus on next'),
  motivation: z.string().describe('Motivational message'),
});

export type ProgressSummaryResponse = z.infer<typeof ProgressSummarySchema>;

/**
 * Schema for domain classification
 */
export const DomainClassificationSchema = z.object({
  domain: z.enum(['technical', 'soft-skills', 'career']).describe('Classified domain'),
  confidence: z.number().min(0).max(1).describe('Classification confidence'),
  reasoning: z.string().describe('Why this classification'),
});

export type DomainClassificationResponse = z.infer<typeof DomainClassificationSchema>;
