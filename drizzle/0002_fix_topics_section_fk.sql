-- Migration: add FK constraint on topics.section_id and set NOT NULL
-- The section_id column was added in 0001 without a FK constraint; backfill has run.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'topics_section_id_sections_id_fk'
    AND table_name = 'topics'
  ) THEN
    ALTER TABLE "topics" ADD CONSTRAINT "topics_section_id_sections_id_fk"
      FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "topics" ALTER COLUMN "section_id" SET NOT NULL;
