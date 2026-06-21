import { pgTable, uuid, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core'

export const roadmaps = pgTable('roadmaps', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const roadmapPhases = pgTable('roadmap_phases', {
  id: uuid('id').primaryKey().defaultRandom(),
  roadmapId: uuid('roadmap_id').notNull().references(() => roadmaps.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  order: integer('order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const sections = pgTable('sections', {
  id: uuid('id').primaryKey().defaultRandom(),
  phaseId: uuid('phase_id').notNull().references(() => roadmapPhases.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  order: integer('order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const topics = pgTable('topics', {
  id: uuid('id').primaryKey().defaultRandom(),
  sectionId: uuid('section_id').notNull().references(() => sections.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  resources: jsonb('resources'),
  order: integer('order').notNull(),
  progress: integer('progress').notNull().default(0),
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
  allocatedMinutes: integer('allocated_minutes').notNull().default(60),
  isCovered: boolean('is_covered').notNull().default(false),
  progressDelta: integer('progress_delta'),
})

export const subtasks = pgTable('subtasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionTopicId: uuid('session_topic_id').notNull().references(() => sessionTopics.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  isDone: boolean('is_done').notNull().default(false),
  resourceTitle: text('resource_title'),
  resourceUrl: text('resource_url'),
  order: integer('order').notNull(),
})

export const feynmanReviews = pgTable('feynman_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  topicId: uuid('topic_id').notNull().references(() => topics.id, { onDelete: 'cascade' }),
  explanation: text('explanation').notNull(),
  score: integer('score'),
  feedbackSolid: text('feedback_solid'),
  feedbackMissing: text('feedback_missing'),
  topicsToFlag: jsonb('topics_to_flag'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const flashcards = pgTable('flashcards', {
  id: uuid('id').primaryKey().defaultRandom(),
  topicId: uuid('topic_id').references(() => topics.id, { onDelete: 'set null' }),
  front: text('front').notNull(),
  back: text('back').notNull(),
  isKnown: boolean('is_known').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
