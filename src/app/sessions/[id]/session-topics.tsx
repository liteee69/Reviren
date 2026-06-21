'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { markTopicCovered, markSubtaskDone } from '@/app/actions/session'

type Subtask = {
  id: string
  description: string
  isDone: boolean
  resourceTitle: string | null
  resourceUrl: string | null
  order: number
}

type SessionTopic = {
  id: string
  topicId: string
  title: string
  sectionTitle: string
  isCovered: boolean
  allocatedMinutes: number
  subtasks: Subtask[]
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
  const [done, setDone] = useState<Record<string, boolean>>(
    Object.fromEntries(topics.flatMap((t) => t.subtasks.map((s) => [s.id, s.isDone])))
  )
  const [ending, setEnding] = useState(false)

  async function toggleCovered(id: string) {
    const next = !covered[id]
    setCovered((prev) => ({ ...prev, [id]: next }))
    await markTopicCovered(id, next)
  }

  async function toggleSubtask(id: string) {
    const next = !done[id]
    setDone((prev) => ({ ...prev, [id]: next }))
    await markSubtaskDone(id, next)
  }

  function handleEnd() {
    setEnding(true)
    router.push(`/sessions/${sessionId}/end`)
  }

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
          {topics.map((t) => {
            const doneCount = t.subtasks.filter((s) => done[s.id]).length
            return (
              <div key={t.id} className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={covered[t.id] ?? false}
                    onChange={() => toggleCovered(t.id)}
                    disabled={ended}
                  />
                  <div className="space-y-0.5">
                    <p className={`text-sm font-medium ${covered[t.id] ? 'line-through text-muted-foreground' : ''}`}>
                      {t.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.sectionTitle} · {Math.round(t.allocatedMinutes / 60 * 10) / 10}h
                      {t.subtasks.length > 0 && ` · ${doneCount}/${t.subtasks.length} subtasks`}
                    </p>
                  </div>
                </label>

                {t.subtasks.length > 0 && (
                  <ul className="space-y-2 pl-6">
                    {t.subtasks
                      .sort((a, b) => a.order - b.order)
                      .map((s) => (
                        <li key={s.id} className="space-y-0.5">
                          <label className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              className="mt-0.5 shrink-0"
                              checked={done[s.id] ?? false}
                              onChange={() => toggleSubtask(s.id)}
                              disabled={ended}
                            />
                            <p className={`text-xs ${done[s.id] ? 'line-through text-muted-foreground' : 'text-muted-foreground'}`}>
                              {s.description}
                            </p>
                          </label>
                          {s.resourceUrl && (
                            <a
                              href={s.resourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="pl-5 text-xs underline text-foreground/60 hover:text-foreground"
                            >
                              {s.resourceTitle ?? s.resourceUrl}
                            </a>
                          )}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {!ended && (
        <Button variant="outline" onClick={handleEnd} disabled={ending}>
          {ending ? 'Going to summary…' : 'End session'}
        </Button>
      )}
    </div>
  )
}
