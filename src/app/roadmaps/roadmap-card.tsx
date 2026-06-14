'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { deleteRoadmap } from '@/app/actions/roadmap'

type Props = {
  id: string
  title: string
  description: string | null
  topicCount: number
}

export function RoadmapCard({ id, title, description, topicCount }: Props) {
  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    if (!confirm(`Delete "${title}" and all its topics?`)) return
    await deleteRoadmap(id)
  }

  return (
    <div className="relative group">
      <Link href={`/roadmaps/${id}`}>
        <Card className="hover:bg-accent transition-colors cursor-pointer">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-base">{title}</CardTitle>
              <Badge variant="secondary" className="shrink-0">{topicCount} topics</Badge>
            </div>
          </CardHeader>
          {description && (
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
            </CardContent>
          )}
        </Card>
      </Link>
      <button
        onClick={handleDelete}
        className="absolute top-3 right-3 hidden group-hover:flex size-5 items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs transition-colors"
        aria-label="Delete roadmap"
      >
        ✕
      </button>
    </div>
  )
}
