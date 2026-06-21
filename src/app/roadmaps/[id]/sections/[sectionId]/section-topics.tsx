'use client'

import { Card, CardContent } from '@/components/ui/card'

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
}: {
  topics: Topic[]
}) {
  if (topics.length === 0) {
    return <p className="text-sm text-muted-foreground">No topics in this section yet.</p>
  }

  return (
    <div className="space-y-3">
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
              <span className="text-xs text-muted-foreground shrink-0">{topic.progress}%</span>
            </div>
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-foreground transition-all"
                style={{ width: `${topic.progress}%` }}
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
