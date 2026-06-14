import { z } from 'zod'

export const ResourceSchema = z.object({
  title: z.string(),
  url: z.string(),
  type: z.enum(['video', 'article', 'course', 'book', 'documentation']),
})

export const TopicSchema = z.object({
  title: z.string(),
  description: z.string(),
  resources: z.array(ResourceSchema),
})

export const PhaseSchema = z.object({
  title: z.string(), // e.g. "Phase 1: Fundamentals"
  topics: z.array(TopicSchema),
})

export const RoadmapOutputSchema = z.object({
  title: z.string(),
  description: z.string(),
  phases: z.array(PhaseSchema),
})

export type RoadmapOutput = z.infer<typeof RoadmapOutputSchema>
