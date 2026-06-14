'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { createCard, saveGeneratedCards, toggleKnown, deleteCard } from '@/app/actions/flashcard'

type Flashcard = {
  id: string
  front: string
  back: string
  isKnown: boolean
  topicTitle: string | null
}
type Topic = { id: string; title: string; description: string | null; roadmapId: string }
type Roadmap = { id: string; title: string }

export function FlashcardsView({
  initialCards,
  topics,
  roadmaps,
}: {
  initialCards: Flashcard[]
  topics: Topic[]
  roadmaps: Roadmap[]
}) {
  const [cards, setCards] = useState(initialCards)
  const [flipped, setFlipped] = useState<Set<string>>(new Set())
  const [panel, setPanel] = useState<'create' | 'generate' | null>(null)

  // Create form
  const [createFront, setCreateFront] = useState('')
  const [createBack, setCreateBack] = useState('')
  const [createTopicId, setCreateTopicId] = useState('')
  const [creating, setCreating] = useState(false)

  // Generate form
  const [genRoadmapId, setGenRoadmapId] = useState(roadmaps[0]?.id ?? '')
  const [genTopicId, setGenTopicId] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatedCards, setGeneratedCards] = useState<{ front: string; back: string }[]>([])
  const [selectedGen, setSelectedGen] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)

  // Filter
  const [showUnknownOnly, setShowUnknownOnly] = useState(false)

  const genTopics = topics.filter((t) => t.roadmapId === genRoadmapId)
  const visibleCards = showUnknownOnly ? cards.filter((c) => !c.isKnown) : cards

  function flip(id: string) {
    setFlipped((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleCreate() {
    if (!createFront.trim() || !createBack.trim()) return
    setCreating(true)
    await createCard(createFront.trim(), createBack.trim(), createTopicId || undefined)
    setCards((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        front: createFront.trim(),
        back: createBack.trim(),
        isKnown: false,
        topicTitle: topics.find((t) => t.id === createTopicId)?.title ?? null,
      },
    ])
    setCreateFront('')
    setCreateBack('')
    setCreateTopicId('')
    setCreating(false)
    setPanel(null)
  }

  async function handleGenerate() {
    const topic = topics.find((t) => t.id === genTopicId)
    if (!topic) return
    setGenerating(true)
    setGeneratedCards([])
    setSelectedGen(new Set())
    try {
      const res = await fetch('/api/flashcards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicTitle: topic.title, topicDescription: topic.description }),
      })
      const data = await res.json()
      setGeneratedCards(data.cards ?? [])
      setSelectedGen(new Set(data.cards.map((_: unknown, i: number) => i)))
    } catch {
      // silently fail — user sees empty preview
    } finally {
      setGenerating(false)
    }
  }

  async function handleSaveGenerated() {
    const topic = topics.find((t) => t.id === genTopicId)
    const toSave = generatedCards.filter((_, i) => selectedGen.has(i))
    setSaving(true)
    await saveGeneratedCards(toSave, genTopicId || undefined)
    setCards((prev) => [
      ...prev,
      ...toSave.map((c) => ({
        id: crypto.randomUUID(),
        front: c.front,
        back: c.back,
        isKnown: false,
        topicTitle: topic?.title ?? null,
      })),
    ])
    setGeneratedCards([])
    setSelectedGen(new Set())
    setSaving(false)
    setPanel(null)
  }

  async function handleToggleKnown(id: string, isKnown: boolean) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, isKnown: !isKnown } : c)))
    await toggleKnown(id, !isKnown)
  }

  async function handleDelete(id: string) {
    setCards((prev) => prev.filter((c) => c.id !== id))
    await deleteCard(id)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setPanel(panel === 'create' ? null : 'create')} variant={panel === 'create' ? 'secondary' : 'default'}>
          Create card
        </Button>
        <Button variant="outline" onClick={() => setPanel(panel === 'generate' ? null : 'generate')}>
          Generate from topic
        </Button>
        <Button
          variant={showUnknownOnly ? 'secondary' : 'outline'}
          onClick={() => setShowUnknownOnly((v) => !v)}
        >
          {showUnknownOnly ? 'Showing unknown' : 'Show unknown only'}
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">
          {cards.filter((c) => !c.isKnown).length} unknown / {cards.length} total
        </span>
      </div>

      {panel === 'create' && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <Input
              placeholder="Front (question)"
              value={createFront}
              onChange={(e) => setCreateFront(e.target.value)}
            />
            <Input
              placeholder="Back (answer)"
              value={createBack}
              onChange={(e) => setCreateBack(e.target.value)}
            />
            <div className="flex gap-3">
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm flex-1"
                value={createTopicId}
                onChange={(e) => setCreateTopicId(e.target.value)}
              >
                <option value="">No topic</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
              <Button onClick={handleCreate} disabled={creating || !createFront.trim() || !createBack.trim()}>
                {creating ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {panel === 'generate' && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-wrap gap-3">
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Roadmap</label>
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={genRoadmapId}
                  onChange={(e) => { setGenRoadmapId(e.target.value); setGenTopicId(''); setGeneratedCards([]) }}
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
                  value={genTopicId}
                  onChange={(e) => { setGenTopicId(e.target.value); setGeneratedCards([]) }}
                >
                  <option value="">Select a topic…</option>
                  {genTopics.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button onClick={handleGenerate} disabled={generating || !genTopicId}>
                  {generating ? 'Generating…' : 'Generate'}
                </Button>
              </div>
            </div>

            {generatedCards.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Preview — select cards to save</p>
                {generatedCards.map((c, i) => (
                  <label key={i} className="flex items-start gap-3 cursor-pointer p-2 rounded-md hover:bg-muted">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={selectedGen.has(i)}
                      onChange={() => {
                        setSelectedGen((prev) => {
                          const next = new Set(prev)
                          if (next.has(i)) next.delete(i)
                          else next.add(i)
                          return next
                        })
                      }}
                    />
                    <div>
                      <p className="text-sm font-medium">{c.front}</p>
                      <p className="text-sm text-muted-foreground">{c.back}</p>
                    </div>
                  </label>
                ))}
                <Button onClick={handleSaveGenerated} disabled={saving || selectedGen.size === 0}>
                  {saving ? 'Saving…' : `Save ${selectedGen.size} card${selectedGen.size > 1 ? 's' : ''}`}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {visibleCards.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {showUnknownOnly ? 'No unknown cards.' : 'No flashcards yet. Create or generate some.'}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleCards.map((c) => (
            <div
              key={c.id}
              onClick={() => flip(c.id)}
              className="cursor-pointer rounded-lg border bg-card p-5 space-y-3 hover:bg-muted/50 transition-colors select-none"
            >
              <p className="text-sm font-medium leading-snug">
                {flipped.has(c.id) ? c.back : c.front}
              </p>
              {flipped.has(c.id) && (
                <p className="text-xs text-muted-foreground">{c.front}</p>
              )}
              <div className="flex items-center justify-between pt-1" onClick={(e) => e.stopPropagation()}>
                <div className="flex gap-1">
                  {c.topicTitle && (
                    <Badge variant="secondary" className="text-xs">{c.topicTitle}</Badge>
                  )}
                  {c.isKnown && (
                    <Badge className="text-xs bg-green-100 text-green-800 hover:bg-green-100">Known</Badge>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => handleToggleKnown(c.id, c.isKnown)}
                  >
                    {c.isKnown ? 'Mark unknown' : 'Mark known'}
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                    onClick={() => handleDelete(c.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
