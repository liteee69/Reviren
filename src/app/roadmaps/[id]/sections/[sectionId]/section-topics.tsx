'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { AddTopic } from '@/app/roadmaps/[id]/add-topic'
import { deleteTopic } from '@/app/actions/topic'

type Topic = {
  id: string
  title: string
  description: string | null
  progress: number
  resources: unknown
  isCompleted: boolean
}

export function SectionTopics({
  topics,
  sectionId,
}: {
  topics: Topic[]
  sectionId: string
}) {
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      await deleteTopic(id)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-3">
      {topics.length === 0 && (
        <p className="text-sm text-muted-foreground">No topics in this section yet.</p>
      )}
      {topics.map((topic) => (
        <Card key={topic.id}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <p className={`text-sm font-medium ${topic.isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                  {topic.title}
                </p>
                {topic.description && (
                  <p className="text-xs text-muted-foreground">{topic.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">{topic.progress}%</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                  disabled={deleting === topic.id}
                  onClick={() => handleDelete(topic.id)}
                >
                  {deleting === topic.id ? '…' : 'Delete'}
                </Button>
              </div>
            </div>
            <Progress value={topic.progress} />
          </CardContent>
        </Card>
      ))}
      <AddTopic sectionId={sectionId} />
    </div>
  )
}
