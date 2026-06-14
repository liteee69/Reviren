import { ChatAnthropic } from '@langchain/anthropic'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'

// Roadmap agent — near-frontier reasoning, accuracy is critical
export const roadmapModel = new ChatGoogleGenerativeAI({
  model: 'gemini-3.1-pro-preview',
  apiKey: process.env.GOOGLE_GENAI_API_KEY,
})

// Session planning + Feynman scoring — honest judgment
export const sessionModel = new ChatAnthropic({
  model: 'claude-sonnet-4-6',
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Flashcard generation — simple structured transform, cheap + fast
export const flashcardModel = new ChatGoogleGenerativeAI({
  model: 'gemini-3.5-flash',
  apiKey: process.env.GOOGLE_GENAI_API_KEY,
})
