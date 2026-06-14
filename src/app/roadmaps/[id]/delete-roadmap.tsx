'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { deleteRoadmap } from '@/app/actions/roadmap'

export function DeleteRoadmapButton({ id, title }: { id: string; title: string }) {
  const router = useRouter()

  async function handleDelete() {
    if (!confirm(`Delete "${title}" and all its topics?`)) return
    await deleteRoadmap(id)
    router.push('/roadmaps')
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleDelete} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">
      Delete roadmap
    </Button>
  )
}
