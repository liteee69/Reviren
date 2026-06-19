'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const PRESETS = {
  '25/5': { work: 25 * 60, break: 5 * 60 },
  '50/10': { work: 50 * 60, break: 10 * 60 },
}

type Preset = keyof typeof PRESETS

function fmt(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export function PomodoroTimer() {
  const [preset, setPreset] = useState<Preset>('25/5')
  const [phase, setPhase] = useState<'work' | 'break'>('work')
  const [timeLeft, setTimeLeft] = useState(PRESETS['25/5'].work)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            const next = phase === 'work' ? 'break' : 'work'
            setPhase(next)
            setRunning(false)
            return PRESETS[preset][next]
          }
          return t - 1
        })
      }, 1000)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running, phase, preset])

  function changePreset(p: Preset) {
    setPreset(p)
    setPhase('work')
    setTimeLeft(PRESETS[p].work)
    setRunning(false)
  }

  function reset() {
    setTimeLeft(PRESETS[preset][phase])
    setRunning(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Pomodoro</span>
          <span className="text-xs font-normal text-muted-foreground capitalize">{phase}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-5xl font-mono tabular-nums">{fmt(timeLeft)}</div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => setRunning((r) => !r)}>
            {running ? 'Pause' : 'Start'}
          </Button>
          <Button variant="outline" onClick={reset}>Reset</Button>
          {(['25/5', '50/10'] as Preset[]).map((p) => (
            <Button
              key={p}
              variant={preset === p ? 'secondary' : 'outline'}
              onClick={() => changePreset(p)}
              className="text-xs"
            >
              {p}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
