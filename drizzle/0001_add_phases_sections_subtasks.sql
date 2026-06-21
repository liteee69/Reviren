-- Custom SQL migration file, put your code below! --

-- Step 1: Create new tables
CREATE TABLE "roadmap_phases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"roadmap_id" uuid NOT NULL,
	"title" text NOT NULL,
	"order" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phase_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"order" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subtasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_topic_id" uuid NOT NULL,
	"description" text NOT NULL,
	"is_done" boolean DEFAULT false NOT NULL,
	"resource_title" text,
	"resource_url" text,
	"order" integer NOT NULL
);
--> statement-breakpoint

-- Step 2: Add new columns to topics (nullable first to avoid FK violation on existing rows)
ALTER TABLE "topics" ADD COLUMN "section_id" uuid;
--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "progress" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint

-- Step 3: Add new columns to session_topics
ALTER TABLE "session_topics" ADD COLUMN "allocated_minutes" integer DEFAULT 60 NOT NULL;
--> statement-breakpoint
ALTER TABLE "session_topics" ADD COLUMN "progress_delta" integer;
--> statement-breakpoint

-- Step 4: Add FK constraints for new tables
ALTER TABLE "roadmap_phases" ADD CONSTRAINT "roadmap_phases_roadmap_id_roadmaps_id_fk" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmaps"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_phase_id_roadmap_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."roadmap_phases"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_session_topic_id_session_topics_id_fk" FOREIGN KEY ("session_topic_id") REFERENCES "public"."session_topics"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- Step 5: Drop old FK and old columns from topics
ALTER TABLE "topics" DROP CONSTRAINT IF EXISTS "topics_roadmap_id_roadmaps_id_fk";
--> statement-breakpoint
ALTER TABLE "topics" DROP COLUMN IF EXISTS "roadmap_id";
--> statement-breakpoint
ALTER TABLE "topics" DROP COLUMN IF EXISTS "phase";
