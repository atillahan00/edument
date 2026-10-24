CREATE TABLE "TelemetryEvent" (
  "id" UUID NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "environment" TEXT NOT NULL,
  "runId" UUID NOT NULL,
  "chainId" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  CONSTRAINT "TelemetryEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TelemetryEvent_environment_observedAt_id_idx" ON "TelemetryEvent"("environment", "observedAt", "id");
CREATE INDEX "TelemetryEvent_kind_observedAt_idx" ON "TelemetryEvent"("kind", "observedAt");
