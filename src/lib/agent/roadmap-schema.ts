import { z } from 'zod'

export const ResourceSchema = z.object({
  title: z.string(),
  url: z.string(),
  type: z.enum(['video', 'article', 'course', 'book', 'documentation']),
  purpose: z.enum(['theory', 'practice']),
})

export const TopicSchema = z.object({
  title: z.string(),
  description: z.string(),
  resources: z.array(ResourceSchema).max(2),
})

export const SectionSchema = z.object({
  title: z.string(),
  topics: z.array(TopicSchema),
})

export const PhaseSchema = z.object({
  title: z.string(), // "Phase N: <Name>"
  sections: z.array(SectionSchema),
})

export const RoadmapOutputSchema = z.object({
  title: z.string(),
  description: z.string(),
  phases: z.array(PhaseSchema),
})

export type RoadmapOutput = z.infer<typeof RoadmapOutputSchema>
