'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { saveRoadmap } from '@/app/actions/roadmap'
import type { RoadmapOutput } from '@/lib/agent/roadmap-schema'
import { formatContext } from '@/lib/agent/roadmap-context'

const STEPS = [
  { node: 'searchTopics', label: 'Searching for curriculum structure...' },
  { node: 'findTheoryResources', label: 'Finding theory resources...' },
  { node: 'findPracticeResources', label: 'Finding practice resources...' },
  { node: 'verifyResources', label: 'Verifying resource quality...' },
  { node: 'formatOutput', label: 'Building your roadmap...' },
]

type Status = 'idle' | 'questioning' | 'followup' | 'generating' | 'importing' | 'done' | 'error'
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
  const [questions, setQuestions] = useState<string[]>([])
  const [answers, setAnswers] = useState('')
  const [followUp, setFollowUp] = useState<string | null>(null)
  const [followUpAnswer, setFollowUpAnswer] = useState('')
  const [fetchingQuestions, setFetchingQuestions] = useState(false)

  function switchMode(next: Mode) {
    setMode(next)
    setStatus('idle')
    setRoadmap(null)
    setError('')
    setQuestions([])
    setAnswers('')
    setFollowUp(null)
    setFollowUpAnswer('')
  }

  async function startQuestioning() {
    if (!topic.trim()) return
    setFetchingQuestions(true)
    setStatus('idle')
    setError('')
    try {
      const res = await fetch('/api/roadmap/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to load questions')
      setQuestions(data.questions)
      setAnswers('')
      setStatus('questioning')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setFetchingQuestions(false)
    }
  }

  async function submitAnswers() {
    if (!answers.trim()) return
    setFetchingQuestions(true)
    try {
      const res = await fetch('/api/roadmap/questions/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, questions, answers }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Failed')
      if (data.followUp) {
        setFollowUp(data.followUp)
        setFollowUpAnswer('')
        setStatus('followup')
      } else {
        setFollowUp(null)
        setStatus('followup') // no follow-up, but advance to show Generate button
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setFetchingQuestions(false)
    }
  }

  async function generate() {
    if (!topic.trim()) return
    setStatus('generating')
    setCompletedSteps([])
    setRoadmap(null)
    setError('')
    setCurrentLabel(STEPS[0].label)

    const context = questions.length > 0
      ? formatContext(questions, answers, followUp, followUpAnswer || undefined)
      : ''

    try {
      const res = await fetch('/api/roadmap/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, context }),
      })

      if (!res.ok || !res.body) throw new Error('Request failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      const completed: string[] = []

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
            completed.push(event.node)
            setCompletedSteps([...completed])
            const nextStep = STEPS.find(s => !completed.includes(s.node) && s.node !== event.node)
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

  const busy = status === 'generating' || status === 'importing' || fetchingQuestions

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
                onKeyDown={e => e.key === 'Enter' && !busy && status === 'idle' && startQuestioning()}
                disabled={busy || status !== 'idle'}
              />
              <Button
                onClick={startQuestioning}
                disabled={busy || !topic.trim() || status !== 'idle'}
              >
                {fetchingQuestions ? 'Loading…' : 'Generate'}
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

      {(status === 'questioning' || status === 'followup') && (
        <div className="space-y-4">
          {/* AI message bubble */}
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm space-y-2">
            <p className="text-muted-foreground font-medium text-xs uppercase tracking-wide">Before generating</p>
            <ol className="space-y-1 list-decimal list-inside">
              {questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ol>
          </div>

          {/* User answer — only editable in questioning state */}
          <textarea
            placeholder="Type your answers here…"
            value={answers}
            onChange={e => setAnswers(e.target.value)}
            disabled={status !== 'questioning' || fetchingQuestions}
            rows={4}
            className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground resize-none disabled:opacity-50"
          />

          {status === 'questioning' && (
            <Button
              onClick={submitAnswers}
              disabled={!answers.trim() || fetchingQuestions}
            >
              {fetchingQuestions ? 'Checking…' : 'Next →'}
            </Button>
          )}

          {/* Follow-up exchange */}
          {status === 'followup' && followUp && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
                <p className="text-muted-foreground font-medium text-xs uppercase tracking-wide mb-2">One more thing</p>
                <p>{followUp}</p>
              </div>
              <textarea
                placeholder="Your answer…"
                value={followUpAnswer}
                onChange={e => setFollowUpAnswer(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground resize-none"
              />
              <Button onClick={generate} disabled={!followUpAnswer.trim()}>
                Generate Roadmap
              </Button>
            </div>
          )}

          {status === 'followup' && !followUp && (
            <Button onClick={generate}>Generate Roadmap</Button>
          )}
        </div>
      )}

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
