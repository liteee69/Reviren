'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateTopic, deleteTopic, updateTopicResources } from '@/app/actions/topic'

type Resource = { title: string; url: string; type: string }

type Topic = {
  id: string
  title: string
  description: string | null
  resources: unknown
  isCompleted: boolean
}

const RESOURCE_TYPES = ['article', 'video', 'book', 'course', 'documentation'] as const

export function TopicCard({ topic }: { topic: Topic }) {
  const [title, setTitle] = useState(topic.title)
  const [description, setDescription] = useState(topic.description ?? '')
  const [editingTitle, setEditingTitle] = useState(false)
  const [editingDesc, setEditingDesc] = useState(false)
  const [resources, setResources] = useState<Resource[]>((topic.resources as Resource[]) ?? [])
  const [addingResource, setAddingResource] = useState(false)
  const [newResource, setNewResource] = useState({ title: '', url: '', type: 'article' })
  const titleRef = useRef<HTMLInputElement>(null)

  async function saveTitle() {
    setEditingTitle(false)
    if (title.trim() && title !== topic.title) {
      await updateTopic(topic.id, { title: title.trim() })
    }
  }

  async function saveDesc() {
    setEditingDesc(false)
    if (description !== (topic.description ?? '')) {
      await updateTopic(topic.id, { description: description.trim() || undefined })
    }
  }

  async function removeResource(index: number) {
    const updated = resources.filter((_, i) => i !== index)
    setResources(updated)
    await updateTopicResources(topic.id, updated)
  }

  async function saveNewResource() {
    if (!newResource.title.trim() || !newResource.url.trim()) return
    const updated = [...resources, { ...newResource, title: newResource.title.trim(), url: newResource.url.trim() }]
    setResources(updated)
    await updateTopicResources(topic.id, updated)
    setNewResource({ title: '', url: '', type: 'article' })
    setAddingResource(false)
  }

  async function handleDelete() {
    if (confirm(`Delete "${title}"?`)) {
      await deleteTopic(topic.id)
    }
  }

  return (
    <Card className="group relative">
      <button
        onClick={handleDelete}
        className="absolute top-3 right-3 hidden group-hover:flex size-5 items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs transition-colors"
        aria-label="Delete topic"
      >
        ✕
      </button>

      <CardHeader className="pb-2 pr-8">
        <div className="flex items-start gap-2">
          {topic.isCompleted && (
            <Badge variant="secondary" className="shrink-0 text-green-600 mt-0.5">Done</Badge>
          )}
          {editingTitle ? (
            <input
              ref={titleRef}
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={e => { if (e.key === 'Enter') titleRef.current?.blur() }}
              className="text-base font-semibold w-full bg-transparent border-b border-border focus:outline-none focus:border-foreground"
              autoFocus
            />
          ) : (
            <h3
              className="text-base font-semibold cursor-text hover:text-muted-foreground transition-colors"
              onClick={() => setEditingTitle(true)}
              title="Click to edit"
            >
              {title}
            </h3>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {editingDesc ? (
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            onBlur={saveDesc}
            className="text-sm text-muted-foreground w-full bg-transparent border border-border rounded p-1 focus:outline-none focus:border-foreground resize-none min-h-[60px]"
            autoFocus
          />
        ) : (
          <p
            className="text-sm text-muted-foreground cursor-text hover:text-foreground/70 transition-colors min-h-[20px]"
            onClick={() => setEditingDesc(true)}
            title="Click to edit"
          >
            {description || <span className="italic opacity-50">Add description…</span>}
          </p>
        )}

        {/* Resources */}
        <div className="space-y-1">
          {resources.map((r, i) => (
            <div key={`${r.url}-${i}`} className="flex items-center gap-2 group/resource">
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm hover:underline flex-1 min-w-0"
              >
                <Badge variant="secondary" className="text-xs shrink-0">{r.type}</Badge>
                <span className="truncate">{r.title}</span>
              </a>
              <button
                onClick={() => removeResource(i)}
                className="hidden group-hover/resource:flex shrink-0 size-4 items-center justify-center text-muted-foreground hover:text-destructive text-xs transition-colors"
                aria-label="Remove resource"
              >
                ✕
              </button>
            </div>
          ))}

          {addingResource ? (
            <div className="space-y-2 pt-1">
              <Input
                placeholder="Title"
                value={newResource.title}
                onChange={e => setNewResource(p => ({ ...p, title: e.target.value }))}
                className="h-7 text-sm"
                autoFocus
              />
              <Input
                placeholder="URL"
                value={newResource.url}
                onChange={e => setNewResource(p => ({ ...p, url: e.target.value }))}
                className="h-7 text-sm"
              />
              <select
                value={newResource.type}
                onChange={e => setNewResource(p => ({ ...p, type: e.target.value }))}
                className="w-full h-7 text-sm rounded border border-border bg-transparent px-2 focus:outline-none focus:border-foreground"
              >
                {RESOURCE_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <Button size="sm" className="h-6 text-xs" onClick={saveNewResource}>Add</Button>
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setAddingResource(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingResource(true)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 pt-1"
            >
              + Add source
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
