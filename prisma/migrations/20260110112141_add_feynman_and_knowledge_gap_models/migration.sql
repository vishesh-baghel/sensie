-- CreateEnum
CREATE TYPE "FeynmanStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'NEEDS_REFINEMENT', 'COMPLETED');

-- CreateTable
CREATE TABLE "FeynmanExercise" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "subtopicId" TEXT,
    "conceptId" TEXT,
    "conceptName" TEXT NOT NULL,
    "status" "FeynmanStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "targetAudience" TEXT NOT NULL DEFAULT 'child',
    "explanation" TEXT NOT NULL,
    "previousAttempts" TEXT[],
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "evaluation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "FeynmanExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeGapRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "conceptId" TEXT,
    "subtopicId" TEXT,
    "gapType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "lastOccurrence" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "relatedMisconceptions" TEXT[],
    "suggestedResources" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeGapRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeynmanExercise_userId_status_idx" ON "FeynmanExercise"("userId", "status");

-- CreateIndex
CREATE INDEX "FeynmanExercise_userId_topicId_idx" ON "FeynmanExercise"("userId", "topicId");

-- CreateIndex
CREATE INDEX "KnowledgeGapRecord_userId_topicId_idx" ON "KnowledgeGapRecord"("userId", "topicId");

-- CreateIndex
CREATE INDEX "KnowledgeGapRecord_userId_isResolved_idx" ON "KnowledgeGapRecord"("userId", "isResolved");
