import { describe, it, expect } from 'vitest'
import { formatContext } from './roadmap-context'

describe('formatContext', () => {
  it('formats questions and answers into a context block', () => {
    const result = formatContext(
      ["What's your goal?", "Rate your knowledge 0–3.", "How much time do you have?"],
      "Career switch. About 1/10. 2 hours/day for 3 months.",
    )
    expect(result).toContain("What's your goal?")
    expect(result).toContain("Career switch.")
    expect(result).toContain("Rate your knowledge")
    expect(result).not.toContain("Follow-up")
  })

  it('includes follow-up exchange when provided', () => {
    const result = formatContext(
      ["What's your goal?"],
      "Exam prep.",
      "Which specific exam are you preparing for?",
      "GATE 2026",
    )
    expect(result).toContain("Which specific exam")
    expect(result).toContain("GATE 2026")
  })

  it('omits follow-up block when followUp is null', () => {
    const result = formatContext(["What's your goal?"], "Hobby project.", null)
    expect(result).not.toContain("Follow-up")
  })
})
