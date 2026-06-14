'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { markTopicCovered, endSession } from '@/app/actions/session'

type SessionTopic = {
  id: string
  topicId: string
  title: string
  phase: string
  isCovered: boolean
}

export function SessionTopics({
  sessionId,
  topics,
  ended,
}: {
  sessionId: string
  topics: SessionTopic[]
  ended: boolean
}) {
  const router = useRouter()
  const [covered, setCovered] = useState<Record<string, boolean>>(
    Object.fromEntries(topics.map((t) => [t.id, t.isCovered]))
  )
  const [ending, setEnding] = useState(false)

  async function toggle(id: string) {
    const next = !covered[id]
    setCovered((prev) => ({ ...prev, [id]: next }))
    await markTopicCovered(id, next)
  }

  async function handleEnd() {
    setEnding(true)
    await endSession(sessionId)
    router.push('/sessions')
  }

  const phases = topics.reduce<Record<string, SessionTopic[]>>((acc, t) => {
    if (!acc[t.phase]) acc[t.phase] = []
    acc[t.phase].push(t)
    return acc
  }, {})

  const coveredCount = Object.values(covered).filter(Boolean).length

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Topics</span>
            <span className="text-sm font-normal text-muted-foreground">
              {coveredCount}/{topics.length} covered
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(phases).map(([phase, pts]) => (
            <div key={phase} className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{phase}</p>
              {pts.map((t) => (
                <label key={t.id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={covered[t.id] ?? false}
                    onChange={() => toggle(t.id)}
                    disabled={ended}
                  />
                  <span className={`text-sm ${covered[t.id] ? 'line-through text-muted-foreground' : ''}`}>
                    {t.title}
                  </span>
                </label>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>

      {!ended && (
        <Button variant="outline" onClick={handleEnd} disabled={ending}>
          {ending ? 'Ending…' : 'End session'}
        </Button>
      )}
    </div>
  )
}
