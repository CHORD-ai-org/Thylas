CREATE TABLE "collaboration_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"state" text DEFAULT 'proposed' NOT NULL,
	"participants" jsonb DEFAULT '{"a":{"coworkerId":"","name":""}}'::jsonb NOT NULL,
	"budget" jsonb DEFAULT '{"maxSteps":8,"maxSeconds":600}'::jsonb NOT NULL,
	"current_step" bigint DEFAULT 0 NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collaboration_sessions" ADD CONSTRAINT "collaboration_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collaboration_sessions_project_idx" ON "collaboration_sessions" USING btree ("project_id","created_at");