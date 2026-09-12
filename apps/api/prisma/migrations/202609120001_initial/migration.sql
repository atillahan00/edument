-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'MENTOR', 'VERIFIER', 'ADMIN');

-- CreateEnum
CREATE TYPE "JobState" AS ENUM ('PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "AchievementState" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ConnectionState" AS ENUM ('PENDING', 'MENTOR_ACCEPTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "minor" BOOLEAN NOT NULL DEFAULT true,
    "demoSeedBatchId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Institution" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInstitution" (
    "userId" UUID NOT NULL,
    "institutionId" UUID NOT NULL,

    CONSTRAINT "UserInstitution_pkey" PRIMARY KEY ("userId","institutionId")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "actorId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivacyPreference" (
    "userId" UUID NOT NULL,
    "settings" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivacyPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorProfile" (
    "userId" UUID NOT NULL,
    "data" JSONB NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" UUID,
    "verifiedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "status" "AchievementState" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordVersion" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "profileId" UUID,
    "achievementId" UUID,
    "type" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "previousId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecordVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AchievementEvidence" (
    "id" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AchievementEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationDecision" (
    "id" UUID NOT NULL,
    "achievementId" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "decision" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockchainAnchor" (
    "id" UUID NOT NULL,
    "versionId" UUID NOT NULL,
    "recordId" TEXT NOT NULL,
    "subjectRef" TEXT NOT NULL,
    "previousRecordId" TEXT NOT NULL,
    "chainVersion" INTEGER NOT NULL,
    "chainId" INTEGER NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "status" "JobState" NOT NULL DEFAULT 'PENDING',
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockchainAnchor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockchainOutbox" (
    "id" UUID NOT NULL,
    "anchorId" UUID NOT NULL,
    "operation" TEXT NOT NULL DEFAULT 'ANCHOR',
    "status" "JobState" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockchainOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockchainTransaction" (
    "id" UUID NOT NULL,
    "anchorId" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "hash" TEXT NOT NULL,
    "rawTransaction" TEXT NOT NULL,
    "nonce" INTEGER NOT NULL,
    "blockNumber" INTEGER,
    "receipt" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockchainTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockchainNodeHealth" (
    "url" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlockchainNodeHealth_pkey" PRIMARY KEY ("url")
);

-- CreateTable
CREATE TABLE "MentorRecommendation" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "mentorId" UUID NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MentorRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorConnectionRequest" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "mentorId" UUID NOT NULL,
    "state" "ConnectionState" NOT NULL DEFAULT 'PENDING',
    "note" TEXT NOT NULL,
    "institutionApprovedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MentorConnectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationReport" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentoringFeedback" (
    "id" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "progress" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MentoringFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationAuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "objectId" TEXT,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experiment" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentSample" (
    "id" UUID NOT NULL,
    "experimentId" UUID NOT NULL,
    "content" JSONB NOT NULL,

    CONSTRAINT "ExperimentSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "ApplicationSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "DemoSeedBatch" (
    "id" UUID NOT NULL,
    "seed" INTEGER NOT NULL,
    "withChain" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemoSeedBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_active_idx" ON "User"("role", "active");

-- CreateIndex
CREATE INDEX "UserInstitution_institutionId_idx" ON "UserInstitution"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "ConsentRecord_userId_type_createdAt_idx" ON "ConsentRecord"("userId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE INDEX "MentorProfile_verified_idx" ON "MentorProfile"("verified");

-- CreateIndex
CREATE INDEX "Achievement_status_institutionId_createdAt_idx" ON "Achievement"("status", "institutionId", "createdAt");

-- CreateIndex
CREATE INDEX "Achievement_userId_createdAt_idx" ON "Achievement"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RecordVersion_ownerId_createdAt_idx" ON "RecordVersion"("ownerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecordVersion_profileId_version_key" ON "RecordVersion"("profileId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "RecordVersion_achievementId_version_key" ON "RecordVersion"("achievementId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AchievementEvidence_versionId_key" ON "AchievementEvidence"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "AchievementEvidence_objectKey_key" ON "AchievementEvidence"("objectKey");

-- CreateIndex
CREATE INDEX "VerificationDecision_achievementId_createdAt_idx" ON "VerificationDecision"("achievementId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BlockchainAnchor_versionId_key" ON "BlockchainAnchor"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "BlockchainAnchor_recordId_key" ON "BlockchainAnchor"("recordId");

-- CreateIndex
CREATE UNIQUE INDEX "BlockchainAnchor_publicToken_key" ON "BlockchainAnchor"("publicToken");

-- CreateIndex
CREATE INDEX "BlockchainAnchor_status_idx" ON "BlockchainAnchor"("status");

-- CreateIndex
CREATE INDEX "BlockchainOutbox_status_nextAttemptAt_idx" ON "BlockchainOutbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "BlockchainOutbox_anchorId_operation_key" ON "BlockchainOutbox"("anchorId", "operation");

-- CreateIndex
CREATE UNIQUE INDEX "BlockchainTransaction_hash_key" ON "BlockchainTransaction"("hash");

-- CreateIndex
CREATE INDEX "MentorRecommendation_studentId_createdAt_idx" ON "MentorRecommendation"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "MentorConnectionRequest_mentorId_state_idx" ON "MentorConnectionRequest"("mentorId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "MentorConnectionRequest_studentId_mentorId_key" ON "MentorConnectionRequest"("studentId", "mentorId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_connectionId_key" ON "Conversation"("connectionId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MentoringFeedback_connectionId_actorId_key" ON "MentoringFeedback"("connectionId", "actorId");

-- CreateIndex
CREATE INDEX "ApplicationAuditLog_createdAt_idx" ON "ApplicationAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "ExperimentSample_experimentId_idx" ON "ExperimentSample"("experimentId");

-- AddForeignKey
ALTER TABLE "UserInstitution" ADD CONSTRAINT "UserInstitution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInstitution" ADD CONSTRAINT "UserInstitution_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivacyPreference" ADD CONSTRAINT "PrivacyPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorProfile" ADD CONSTRAINT "MentorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordVersion" ADD CONSTRAINT "RecordVersion_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordVersion" ADD CONSTRAINT "RecordVersion_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementEvidence" ADD CONSTRAINT "AchievementEvidence_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "RecordVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationDecision" ADD CONSTRAINT "VerificationDecision_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationDecision" ADD CONSTRAINT "VerificationDecision_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "RecordVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockchainAnchor" ADD CONSTRAINT "BlockchainAnchor_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "RecordVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockchainOutbox" ADD CONSTRAINT "BlockchainOutbox_anchorId_fkey" FOREIGN KEY ("anchorId") REFERENCES "BlockchainAnchor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockchainTransaction" ADD CONSTRAINT "BlockchainTransaction_anchorId_fkey" FOREIGN KEY ("anchorId") REFERENCES "BlockchainAnchor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockchainTransaction" ADD CONSTRAINT "BlockchainTransaction_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "BlockchainOutbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "MentorConnectionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationReport" ADD CONSTRAINT "ConversationReport_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringFeedback" ADD CONSTRAINT "MentoringFeedback_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "MentorConnectionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
