'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { saveReview } from '@/app/actions/feynman'

type Topic = { id: string; title: string; description: string | null; roadmapId: string }
type Roadmap = { id: string; title: string }

type ScoreResult = {
  score: number
  feedbackSolid: string
  feedbackMissing: string
  topicsToFlag: string[]
}

export function FeynmanReview({ roadmaps, topics }: { roadmaps: Roadmap[]; topics: Topic[] }) {
  const [roadmapId, setRoadmapId] = useState(roadmaps[0]?.id ?? '')
  const [topicId, setTopicId] = useState('')
  const [explanation, setExplanation] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScoreResult | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filteredTopics = topics.filter((t) => t.roadmapId === roadmapId)
  const selectedTopic = topics.find((t) => t.id === topicId)

  function onRoadmapChange(id: string) {
    setRoadmapId(id)
    setTopicId('')
    setResult(null)
    setSaved(false)
  }

  async function score() {
    if (!topicId || !explanation.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    setSaved(false)
    try {
      const res = await fetch('/api/feynman/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicTitle: selectedTopic?.title,
          topicDescription: selectedTopic?.description,
          explanation: explanation.trim(),
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to score')
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    if (!result || !topicId) return
    await saveReview(
      topicId,
      explanation,
      result.score,
      result.feedbackSolid,
      result.feedbackMissing,
      result.topicsToFlag
    )
    setSaved(true)
  }

  function reset() {
    setExplanation('')
    setResult(null)
    setSaved(false)
    setError(null)
  }

  function scoreColor(s: number) {
    if (s >= 8) return 'bg-green-100 text-green-800'
    if (s >= 5) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
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
        <CardHeader>
          <CardTitle>Your explanation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Roadmap</label>
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={roadmapId}
                onChange={(e) => onRoadmapChange(e.target.value)}
                disabled={loading}
              >
                {roadmaps.map((r) => (
                  <option key={r.id} value={r.id}>{r.title}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Topic</label>
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={topicId}
                onChange={(e) => { setTopicId(e.target.value); setResult(null); setSaved(false) }}
                disabled={loading}
              >
                <option value="">Select a topic…</option>
                {filteredTopics.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
          </div>

          <textarea
            className="w-full min-h-40 rounded-md border bg-transparent p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
            placeholder="Explain the topic as if teaching a beginner…"
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            disabled={loading}
          />

          <div className="flex gap-2">
            <Button onClick={score} disabled={loading || !topicId || !explanation.trim()}>
              {loading ? 'Scoring…' : 'Score my understanding'}
            </Button>
            {result && <Button variant="outline" onClick={reset}>New review</Button>}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              Score
              <span className={`text-sm font-semibold px-2 py-0.5 rounded ${scoreColor(result.score)}`}>
                {result.score}/10
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">What you got right</p>
              <p className="text-sm">{result.feedbackSolid}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">What was missing</p>
              <p className="text-sm">{result.feedbackMissing}</p>
            </div>
            {result.topicsToFlag.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Study next</p>
                <div className="flex flex-wrap gap-2">
                  {result.topicsToFlag.map((t) => (
                    <Badge key={t} variant="secondary">{t}</Badge>
                  ))}
                </div>
              </div>
            )}
            {!saved ? (
              <Button onClick={save}>Save review</Button>
            ) : (
              <p className="text-sm text-muted-foreground">Review saved.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
