import { ChatAnthropic } from '@langchain/anthropic'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'

// Roadmap agent — switched to Sonnet for testing (was Gemini Pro)
export const roadmapModel = new ChatAnthropic({
  model: 'claude-sonnet-4-6',
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxTokens: 16000,
})

// Session planning + Feynman scoring — honest judgment
export const sessionModel = new ChatAnthropic({
  model: 'claude-sonnet-4-6',
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Pre-generation questions + follow-up — switched to Haiku for testing (was Gemini Flash)
export const haiku = new ChatAnthropic({
  model: 'claude-haiku-4-5-20251001',
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Flashcard generation — simple structured transform, cheap + fast
export const flashcardModel = new ChatGoogleGenerativeAI({
  model: 'gemini-3.5-flash',
  apiKey: process.env.GOOGLE_GENAI_API_KEY,
})
