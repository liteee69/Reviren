import { db } from '../lib/db'
import { roadmapPhases, sections } from '../lib/db/schema'

type OldTopic = { id: string; roadmap_id: string; phase: string; is_completed: boolean }

// Run AFTER adding new columns (section_id, progress) but BEFORE the migration
// removes roadmap_id/phase from topics.
// Uses raw SQL since Drizzle schema no longer has those old columns.
async function backfill() {
  const client = db.$client as import('postgres').Sql

  let oldTopics: OldTopic[]
  try {
    const rows = await client`
      SELECT id, roadmap_id, phase, is_completed
      FROM topics
      WHERE section_id IS NULL
    `
    oldTopics = rows as unknown as OldTopic[]
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('column') && (msg.includes('roadmap_id') || msg.includes('phase'))) {
      console.log('Old columns already removed — nothing to backfill')
      return
    }
    throw e
  }

  if (oldTopics.length === 0) {
    console.log('No topics to backfill')
    return
  }

  // Group by roadmap_id then phase
  const byRoadmap = new Map<string, Map<string, OldTopic[]>>()
  for (const t of oldTopics) {
    if (!byRoadmap.has(t.roadmap_id)) byRoadmap.set(t.roadmap_id, new Map())
    const byPhase = byRoadmap.get(t.roadmap_id)!
    if (!byPhase.has(t.phase)) byPhase.set(t.phase, [])
    byPhase.get(t.phase)!.push(t)
  }

  for (const [roadmapId, phaseMap] of byRoadmap) {
    // Sort phases by the number in "Phase N: ..."
    const sortedPhases = [...phaseMap.keys()].sort((a, b) => {
      const numA = parseInt(a.match(/Phase (\d+)/i)?.[1] ?? '0')
      const numB = parseInt(b.match(/Phase (\d+)/i)?.[1] ?? '0')
      return numA - numB
    })

    for (let phaseIndex = 0; phaseIndex < sortedPhases.length; phaseIndex++) {
      const phaseTitle = sortedPhases[phaseIndex]
      const [phase] = await db
        .insert(roadmapPhases)
        .values({ roadmapId, title: phaseTitle, order: phaseIndex })
        .returning({ id: roadmapPhases.id })

      // One default section per phase
      const [section] = await db
        .insert(sections)
        .values({ phaseId: phase.id, title: 'General', order: 0 })
        .returning({ id: sections.id })

      const phaseTopics = phaseMap.get(phaseTitle)!
      for (const t of phaseTopics) {
        await client`
          UPDATE topics
          SET section_id = ${section.id},
              progress = ${t.is_completed ? 100 : 0}
          WHERE id = ${t.id}
        `
      }
    }
  }

  console.log('Backfill complete')
}

backfill().catch(console.error).finally(() => process.exit())
