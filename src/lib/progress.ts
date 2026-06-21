export function clampDelta(current: number, delta: number): number {
  return Math.min(100, current + Math.max(0, delta))
}

export function calcSectionProgress(progresses: number[]): number {
  if (progresses.length === 0) return 0
  return Math.round(progresses.reduce((sum, p) => sum + p, 0) / progresses.length)
}
