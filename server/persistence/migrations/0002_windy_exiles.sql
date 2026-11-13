ALTER TABLE "conversations" ADD COLUMN "context" jsonb;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "sync_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "at_ms" bigint;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "meta" jsonb;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "error" jsonb;