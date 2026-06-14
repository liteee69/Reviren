import { pgTable, uuid, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core'

export const roadmaps = pgTable('roadmaps', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('active'), // active | archived
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const topics = pgTable('topics', {
  id: uuid('id').primaryKey().defaultRandom(),
  roadmapId: uuid('roadmap_id').notNull().references(() => roadmaps.id, { onDelete: 'cascade' }),
  phase: text('phase').notNull(),       // e.g. "Phase 1: Fundamentals"
  title: text('title').notNull(),
  description: text('description'),
  resources: jsonb('resources'),        // [{ title, url, type }]
  order: integer('order').notNull(),
  isCompleted: boolean('is_completed').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  roadmapId: uuid('roadmap_id').notNull().references(() => roadmaps.id, { onDelete: 'cascade' }),
  plannedMinutes: integer('planned_minutes').notNull(),
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const sessionTopics = pgTable('session_topics', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  topicId: uuid('topic_id').notNull().references(() => topics.id, { onDelete: 'cascade' }),
  isCovered: boolean('is_covered').notNull().default(false),
})

export const feynmanReviews = pgTable('feynman_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  topicId: uuid('topic_id').notNull().references(() => topics.id, { onDelete: 'cascade' }),
  explanation: text('explanation').notNull(),
  score: integer('score'),              // 1–10, null until scored
  feedbackSolid: text('feedback_solid'),
  feedbackMissing: text('feedback_missing'),
  topicsToFlag: jsonb('topics_to_flag'), // string[]
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const flashcards = pgTable('flashcards', {
  id: uuid('id').primaryKey().defaultRandom(),
  topicId: uuid('topic_id').references(() => topics.id, { onDelete: 'set null' }), // nullable
  front: text('front').notNull(),
  back: text('back').notNull(),
  isKnown: boolean('is_known').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
