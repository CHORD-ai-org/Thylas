CREATE TABLE "coworker_events" (
	"id" text PRIMARY KEY NOT NULL,
	"coworker_id" text NOT NULL,
	"project_id" text,
	"actor_kind" text DEFAULT 'user' NOT NULL,
	"verb" text NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coworkers" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"responsibilities" jsonb DEFAULT '{"forWork":"","notFor":"","output":""}'::jsonb NOT NULL,
	"memberships" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pinned_artifact_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mind" jsonb,
	"created_at_ms" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "coworker_events" ADD CONSTRAINT "coworker_events_coworker_id_coworkers_id_fk" FOREIGN KEY ("coworker_id") REFERENCES "public"."coworkers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coworker_events_coworker_idx" ON "coworker_events" USING btree ("coworker_id","created_at");--> statement-breakpoint
CREATE INDEX "coworkers_owner_idx" ON "coworkers" USING btree ("owner_id");