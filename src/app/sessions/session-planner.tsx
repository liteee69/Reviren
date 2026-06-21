'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createSession } from '@/app/actions/session'

type Subtask = {
  description: string
  resourceTitle: string | null
  resourceUrl: string | null
  order: number
}

type AiTopic = {
  topicId: string
  title: string
  sectionTitle: string
  allocatedMinutes: number
  subtasks: Subtask[]
}

type ManualTopic = { id: string; title: string; sectionTitle: string; isCompleted: boolean }
type Roadmap = { id: string; title: string }

export function SessionPlanner({ roadmaps }: { roadmaps: Roadmap[] }) {
  const router = useRouter()
  const [roadmapId, setRoadmapId] = useState(roadmaps[0]?.id ?? '')
  const [hours, setHours] = useState(2)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'ai' | 'manual' | null>(null)
  const [aiTopics, setAiTopics] = useState<AiTopic[]>([])
  const [manualTopics, setManualTopics] = useState<ManualTopic[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const minutes = Math.round(hours * 60)

  async function planWithAI() {
    setLoading(true)
    setMode('ai')
    setError(null)
    setSelectedIds(new Set())
    try {
      const res = await fetch('/api/sessions/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roadmapId, hours }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAiTopics(data.topics)
      setSelectedIds(new Set(data.topics.map((t: AiTopic) => t.topicId)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to plan session')
      setMode(null)
    } finally {
      setLoading(false)
    }
  }

  async function pickManually() {
    setLoading(true)
    setMode('manual')
    setError(null)
    setSelectedIds(new Set())
    try {
      const res = await fetch(`/api/sessions/topics?roadmapId=${roadmapId}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setManualTopics(data.topics)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load topics')
      setMode(null)
    } finally {
      setLoading(false)
    }
  }

  function toggleTopic(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function startSession() {
    setStarting(true)
    try {
      if (mode === 'ai') {
        const selected = aiTopics.filter((t) => selectedIds.has(t.topicId))
        const id = await createSession(
          roadmapId,
          minutes,
          selected.map((t) => ({
            topicId: t.topicId,
            allocatedMinutes: t.allocatedMinutes,
            subtasks: t.subtasks,
          }))
        )
        router.push(`/sessions/${id}`)
      } else {
        const id = await createSession(
          roadmapId,
          minutes,
          [...selectedIds].map((topicId) => ({ topicId, allocatedMinutes: 60, subtasks: [] }))
        )
        router.push(`/sessions/${id}`)
      }
    } catch {
      setStarting(false)
    }
  }

  if (roadmaps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No roadmaps yet. <a href="/roadmaps" className="underline">Create one first.</a>
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Plan your session</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Roadmap</label>
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={roadmapId}
                onChange={(e) => { setRoadmapId(e.target.value); setMode(null) }}
                disabled={loading}
              >
                {roadmaps.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Hours</label>
              <Input
                type="number" min={1} max={8} step={0.5}
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                className="w-24"
                disabled={loading}
              />
            </div>
            <Button onClick={planWithAI} disabled={loading || !roadmapId}>
              {loading && mode === 'ai' ? 'Planning…' : 'Plan with AI'}
            </Button>
            <Button variant="outline" onClick={pickManually} disabled={loading || !roadmapId}>
              {loading && mode === 'manual' ? 'Loading…' : 'Pick manually'}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {mode === 'ai' && !loading && aiTopics.length > 0 && (
        <div className="space-y-3">
          {aiTopics.map((t) => (
            <Card key={t.topicId}>
              <CardContent className="p-4 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={selectedIds.has(t.topicId)}
                    onChange={() => toggleTopic(t.topicId)}
                  />
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{t.sectionTitle} · {Math.round(t.allocatedMinutes / 60 * 10) / 10}h</p>
                  </div>
                </label>
                <ul className="space-y-2 pl-6">
                  {t.subtasks.map((s, i) => (
                    <li key={i} className="text-xs text-muted-foreground space-y-0.5">
                      <p>{s.description}</p>
                      {s.resourceUrl && (
                        <a href={s.resourceUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs underline text-foreground/70 hover:text-foreground">
                          {s.resourceTitle ?? s.resourceUrl}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {mode === 'manual' && !loading && (
        <Card>
          <CardHeader><CardTitle>Select topics</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {manualTopics.map((t) => (
              <label key={t.id} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.has(t.id)}
                  onChange={() => toggleTopic(t.id)}
                />
                <span className={`text-sm ${t.isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                  {t.sectionTitle} / {t.title}
                </span>
              </label>
            ))}
          </CardContent>
        </Card>
      )}

      {mode && !loading && selectedIds.size > 0 && (
        <Button onClick={startSession} disabled={starting}>
          {starting ? 'Starting…' : `Start session (${selectedIds.size} topic${selectedIds.size > 1 ? 's' : ''})`}
        </Button>
      )}
    </div>
  )
}
