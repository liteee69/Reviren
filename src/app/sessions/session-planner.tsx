'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createSession } from '@/app/actions/session'

type Roadmap = { id: string; title: string }
type AiTopic = { topicId: string; title: string; phase: string; estimatedMinutes: number; reason: string }
type ManualTopic = { id: string; title: string; phase: string; isCompleted: boolean }

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
        body: JSON.stringify({ roadmapId, minutes }),
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
      const id = await createSession(roadmapId, minutes, [...selectedIds])
      router.push(`/sessions/${id}`)
    } catch {
      setStarting(false)
    }
  }

  const phases = manualTopics.reduce<Record<string, ManualTopic[]>>((acc, t) => {
    if (!acc[t.phase]) acc[t.phase] = []
    acc[t.phase].push(t)
    return acc
  }, {})

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
        <CardHeader>
          <CardTitle>Available time</CardTitle>
        </CardHeader>
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
                {roadmaps.map((r) => (
                  <option key={r.id} value={r.id}>{r.title}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Hours</label>
              <Input
                type="number"
                min={0.5}
                max={8}
                step={0.5}
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
        <Card>
          <CardHeader>
            <CardTitle>AI plan — {minutes} min</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {aiTopics.map((t) => (
              <label key={t.topicId} className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={selectedIds.has(t.topicId)}
                  onChange={() => toggleTopic(t.topicId)}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{t.title}</span>
                    <span className="text-xs text-muted-foreground">{t.estimatedMinutes} min</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{t.reason}</p>
                </div>
              </label>
            ))}
          </CardContent>
        </Card>
      )}

      {mode === 'manual' && !loading && (
        <Card>
          <CardHeader>
            <CardTitle>Select topics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(phases).map(([phase, pts]) => (
              <div key={phase} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{phase}</p>
                {pts.map((t) => (
                  <label key={t.id} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(t.id)}
                      onChange={() => toggleTopic(t.id)}
                    />
                    <span className={`text-sm ${t.isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                      {t.title}
                    </span>
                  </label>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {mode && !loading && selectedIds.size > 0 && (
        <Button onClick={startSession} disabled={starting}>
          {starting
            ? 'Starting…'
            : `Start session (${selectedIds.size} topic${selectedIds.size > 1 ? 's' : ''})`}
        </Button>
      )}
    </div>
  )
}
