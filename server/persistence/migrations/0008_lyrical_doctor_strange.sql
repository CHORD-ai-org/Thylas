CREATE TABLE "handoff_packages" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"from_coworker_id" text NOT NULL,
	"from_name" text DEFAULT '' NOT NULL,
	"to_coworker_id" text NOT NULL,
	"to_name" text DEFAULT '' NOT NULL,
	"task" text NOT NULL,
	"inputs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"output_schema" text DEFAULT '' NOT NULL,
	"max_steps" bigint DEFAULT 3 NOT NULL,
	"done" text DEFAULT '' NOT NULL,
	"open_notes" text DEFAULT '' NOT NULL,
	"next_step" text DEFAULT '' NOT NULL,
	"grants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"stuck_note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "handoff_packages" ADD CONSTRAINT "handoff_packages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "handoff_packages_project_idx" ON "handoff_packages" USING btree ("project_id","created_at");