-- Fix topics.section_id FK: was SET NULL (from 0001), should be CASCADE.
-- The 0002 migration skipped the fix because the constraint already existed.

ALTER TABLE "topics" DROP CONSTRAINT IF EXISTS "topics_section_id_sections_id_fk";

ALTER TABLE "topics"
  ADD CONSTRAINT "topics_section_id_sections_id_fk"
  FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
