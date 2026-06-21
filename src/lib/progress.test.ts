import { describe, it, expect } from 'vitest'
import { clampDelta, calcSectionProgress } from './progress'

describe('clampDelta', () => {
  it('adds delta to current progress', () => {
    expect(clampDelta(30, 20)).toBe(50)
  })
  it('clamps at 100', () => {
    expect(clampDelta(90, 20)).toBe(100)
  })
  it('never goes below current', () => {
    expect(clampDelta(50, 0)).toBe(50)
  })
  it('handles zero current', () => {
    expect(clampDelta(0, 40)).toBe(40)
  })
})

describe('calcSectionProgress', () => {
  it('averages topic progresses', () => {
    expect(calcSectionProgress([0, 50, 100])).toBe(50)
  })
  it('returns 0 for empty array', () => {
    expect(calcSectionProgress([])).toBe(0)
  })
  it('rounds to nearest integer', () => {
    expect(calcSectionProgress([33, 66])).toBe(50)
  })
})
