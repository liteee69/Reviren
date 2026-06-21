'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { saveSessionProgress } from '@/app/actions/session'

type Delta = {
  sessionTopicId: string
  topicId: string
  topicTitle: string
  currentProgress: number
  suggestedDelta: number
}

export default function EndSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = use(params)
  const router = useRouter()
  const [deltas, setDeltas] = useState<Delta[]>([])
  const [overrides, setOverrides] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/sessions/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setDeltas(data.deltas)
        setOverrides(
          Object.fromEntries(data.deltas.map((d: Delta) => [d.sessionTopicId, d.suggestedDelta]))
        )
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [sessionId])

  async function handleConfirm() {
    setSaving(true)
    try {
      await saveSessionProgress(
        sessionId,
        deltas.map((d) => ({
          sessionTopicId: d.sessionTopicId,
          topicId: d.topicId,
          delta: overrides[d.sessionTopicId] ?? d.suggestedDelta,
        }))
      )
      router.push('/sessions')
    } catch {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Calculating progress…</p>
  if (error) return <p className="text-sm text-destructive">{error}</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Session summary</h1>
        <p className="text-muted-foreground">Review and adjust progress before saving.</p>
      </div>

      <div className="space-y-3">
        {deltas.map((d) => {
          const override = overrides[d.sessionTopicId] ?? d.suggestedDelta
          const newProgress = Math.min(100, d.currentProgress + override)
          return (
            <Card key={d.sessionTopicId}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-medium">{d.topicTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.currentProgress}% → {newProgress}%
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs text-muted-foreground shrink-0">Progress gained</label>
                  <Input
                    type="number"
                    min={0}
                    max={100 - d.currentProgress}
                    value={override}
                    onChange={(e) =>
                      setOverrides((prev) => ({
                        ...prev,
                        [d.sessionTopicId]: Math.max(0, Math.min(100 - d.currentProgress, Number(e.target.value))),
                      }))
                    }
                    className="w-20 h-7 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-foreground transition-all"
                    style={{ width: `${newProgress}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Button onClick={handleConfirm} disabled={saving}>
        {saving ? 'Saving…' : 'Confirm & save progress'}
      </Button>
    </div>
  )
}
