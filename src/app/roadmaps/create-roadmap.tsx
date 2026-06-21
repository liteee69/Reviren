'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { saveRoadmap } from '@/app/actions/roadmap'
import type { RoadmapOutput } from '@/lib/agent/roadmap-schema'

const STEPS = [
  { node: 'searchTopics', label: 'Searching for curriculum structure...' },
  { node: 'structureAndEnrich', label: 'Finding resources...' },
  { node: 'formatOutput', label: 'Building your roadmap...' },
]

type Status = 'idle' | 'generating' | 'importing' | 'done' | 'error'
type Mode = 'generate' | 'import'

export function CreateRoadmap() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('generate')
  const [topic, setTopic] = useState('')
  const [importText, setImportText] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [completedSteps, setCompletedSteps] = useState<string[]>([])
  const [currentLabel, setCurrentLabel] = useState('')
  const [roadmap, setRoadmap] = useState<RoadmapOutput | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function switchMode(next: Mode) {
    setMode(next)
    setStatus('idle')
    setRoadmap(null)
    setError('')
  }

  async function generate() {
    if (!topic.trim()) return
    setStatus('generating')
    setCompletedSteps([])
    setRoadmap(null)
    setError('')
    setCurrentLabel(STEPS[0].label)

    try {
      const res = await fetch('/api/roadmap/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      })

      if (!res.ok || !res.body) throw new Error('Request failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const event = JSON.parse(line.slice(6))

          if (event.node === 'error') {
            setError(event.error)
            setStatus('error')
            return
          }

          if (event.node === 'done') {
            setRoadmap(event.roadmap)
            setStatus('done')
          } else {
            setCompletedSteps(prev => [...prev, event.node])
            const nextStep = STEPS.find(s => !completedSteps.includes(s.node) && s.node !== event.node)
            if (nextStep) setCurrentLabel(nextStep.label)
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStatus('error')
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setStatus('importing')
    setRoadmap(null)

    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/roadmap/parse-file', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to read file')
      setImportText(data.text)
      setStatus('idle')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file')
      setStatus('error')
    } finally {
      e.target.value = ''
    }
  }

  async function importRoadmap() {
    if (!importText.trim()) return
    setStatus('importing')
    setRoadmap(null)
    setError('')

    try {
      const res = await fetch('/api/roadmap/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: importText }),
      })

      const data = await res.json()

      if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to parse')

      setRoadmap(data.roadmap)
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStatus('error')
    }
  }

  async function save() {
    if (!roadmap) return
    setSaving(true)
    try {
      const id = await saveRoadmap(roadmap)
      router.push(`/roadmaps/${id}`)
    } catch {
      setSaving(false)
    }
  }

  const busy = status === 'generating' || status === 'importing'

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Create a roadmap</CardTitle>
            <div className="flex rounded-md border border-border overflow-hidden text-sm">
              <button
                onClick={() => switchMode('generate')}
                className={`px-3 py-1 transition-colors ${mode === 'generate' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50'}`}
              >
                Generate
              </button>
              <button
                onClick={() => switchMode('import')}
                className={`px-3 py-1 border-l border-border transition-colors ${mode === 'import' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50'}`}
              >
                Import
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {mode === 'generate' ? (
            <div className="flex gap-2">
              <Input
                placeholder="e.g. robotics, distributed systems…"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !busy && generate()}
                disabled={busy}
              />
              <Button onClick={generate} disabled={busy || !topic.trim()}>
                {status === 'generating' ? 'Generating…' : 'Generate'}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className={`inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm cursor-pointer hover:bg-accent/50 transition-colors ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
                  <span>Upload file</span>
                  <span className="text-xs text-muted-foreground">.pdf · .md · .txt</span>
                  <input
                    type="file"
                    accept=".pdf,.md,.txt"
                    className="sr-only"
                    onChange={handleFile}
                    disabled={busy}
                  />
                </label>
                <span className="text-xs text-muted-foreground">or paste below</span>
              </div>
              <textarea
                placeholder="Paste your roadmap here — markdown, plain text, bullet points, anything…"
                value={importText}
                onChange={e => setImportText(e.target.value)}
                disabled={busy}
                rows={8}
                className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground resize-none disabled:opacity-50"
              />
              <Button onClick={importRoadmap} disabled={busy || !importText.trim()}>
                {status === 'importing' ? 'Parsing…' : 'Parse & Preview'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {status === 'generating' && (
        <div className="space-y-2 px-1">
          {STEPS.map(step => {
            const done = completedSteps.includes(step.node)
            const active = !done && currentLabel === step.label
            return (
              <div key={step.node} className="flex items-center gap-3 text-sm">
                <span className={done ? 'text-green-500' : active ? 'text-foreground' : 'text-muted-foreground'}>
                  {done ? '✓' : active ? '◌' : '○'}
                </span>
                <span className={done ? 'text-muted-foreground line-through' : active ? 'text-foreground' : 'text-muted-foreground'}>
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {status === 'importing' && (
        <p className="text-sm text-muted-foreground px-1">Parsing your roadmap…</p>
      )}

      {status === 'error' && (
        <p className="text-sm text-destructive px-1">{error}</p>
      )}

      {status === 'done' && roadmap && (
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">{roadmap.title}</h2>
              <p className="text-sm text-muted-foreground mt-1">{roadmap.description}</p>
            </div>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save to Library'}
            </Button>
          </div>

          {roadmap.phases.map((phase) => (
            <div key={phase.title} className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                {phase.title}
              </h3>
              {phase.sections.map((section) => (
                <div key={section.title} className="space-y-2">
                  <p className="text-sm font-medium">{section.title}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {section.topics.map((topic) => (
                      <Card key={topic.title}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">{topic.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-sm text-muted-foreground">{topic.description}</p>
                          {topic.resources.length > 0 && (
                            <div className="space-y-1">
                              {topic.resources.map((r, i) => (
                                <a
                                  key={`${r.url}-${i}`}
                                  href={r.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-sm hover:underline"
                                >
                                  <Badge variant="secondary" className="text-xs shrink-0">{r.type}</Badge>
                                  <span className="truncate">{r.title}</span>
                                </a>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
