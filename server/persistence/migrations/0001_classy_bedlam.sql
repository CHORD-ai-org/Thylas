CREATE TABLE "files" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"folder_id" text,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "files_workspace_folder_idx" ON "files" USING btree ("workspace_id","folder_id");