CREATE TABLE "coworker_employments" (
	"coworker_id" text NOT NULL,
	"ws_id" text NOT NULL,
	"role" text DEFAULT '' NOT NULL,
	"grants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"employed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coworker_employments_coworker_id_ws_id_pk" PRIMARY KEY("coworker_id","ws_id")
);
--> statement-breakpoint
ALTER TABLE "coworkers" ADD COLUMN "toolsets" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "coworker_employments" ADD CONSTRAINT "coworker_employments_coworker_id_coworkers_id_fk" FOREIGN KEY ("coworker_id") REFERENCES "public"."coworkers"("id") ON DELETE cascade ON UPDATE no action;