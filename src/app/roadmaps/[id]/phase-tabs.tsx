'use client'

import { useState } from 'react'

type Phase = {
  id: string
  title: string
  progress: number
  sections: Array<{
    id: string
    title: string
    progress: number
    topicCount: number
    completedCount: number
  }>
}

export function PhaseTabs({ phases, roadmapId }: { phases: Phase[]; roadmapId: string }) {
  const [activeId, setActiveId] = useState(phases[0]?.id ?? '')
  const active = phases.find((p) => p.id === activeId)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {phases.map((phase) => (
          <button
            key={phase.id}
            onClick={() => setActiveId(phase.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              phase.id === activeId
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {phase.title}
            <span className="ml-2 opacity-60">{phase.progress}%</span>
          </button>
        ))}
      </div>

      {active && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.sections.map((section) => (
            <a key={section.id} href={`/roadmaps/${roadmapId}/sections/${section.id}`}>
              <SectionCard section={section} />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function SectionCard({
  section,
}: {
  section: { title: string; progress: number; topicCount: number; completedCount: number }
}) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 hover:border-foreground/20 transition-colors cursor-pointer">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-sm">{section.title}</h3>
        <span className="text-xs text-muted-foreground shrink-0">{section.progress}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-foreground transition-all"
          style={{ width: `${section.progress}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {section.completedCount}/{section.topicCount} topics done
      </p>
    </div>
  )
}
