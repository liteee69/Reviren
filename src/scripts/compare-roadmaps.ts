import { db } from '../lib/db';
import { roadmaps, roadmapPhases, sections, topics } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

const NEW_ID = 'a4a5d635-7c30-4275-905a-db17079d5032';
const OLD_ID = '19b95fa6-64b9-4f89-a1e1-faac86b2dd5e';

async function getRoadmap(id: string) {
  const { inArray } = await import('drizzle-orm');
  const [roadmap] = await db.select().from(roadmaps).where(eq(roadmaps.id, id));
  const phases = await db.select().from(roadmapPhases).where(eq(roadmapPhases.roadmapId, id)).orderBy(roadmapPhases.order);
  const phaseIds = phases.map(p => p.id);
  const sects = phaseIds.length ? await db.select().from(sections).where(inArray(sections.phaseId, phaseIds)).orderBy(sections.order) : [];
  const sectionIds = sects.map(s => s.id);
  const tops = sectionIds.length ? await db.select().from(topics).where(inArray(topics.sectionId, sectionIds)).orderBy(topics.order) : [];
  return { roadmap, phases, sections: sects, topics: tops };
}

async function main() {
  const [newR, oldR] = await Promise.all([getRoadmap(NEW_ID), getRoadmap(OLD_ID)]);

  type Resource = { title: string; url: string; type: string; purpose: string }

  function analyzeResources(r: typeof newR) {
    const allResources: Resource[] = r.topics.flatMap(t => (t.resources as Resource[] ?? []))
    const withResources = r.topics.filter(t => (t.resources as Resource[] ?? []).length > 0)
    const noResources = r.topics.filter(t => (t.resources as Resource[] ?? []).length === 0)
    const urls = allResources.map(r => r.url)
    const uniqueUrls = [...new Set(urls)]
    const duplicateUrls = urls.filter((u, i) => urls.indexOf(u) !== i)
    const uniqueDupes = [...new Set(duplicateUrls)]
    return { allResources, withResources, noResources, uniqueUrls, uniqueDupes }
  }

  const newStats = analyzeResources(newR)
  const oldStats = analyzeResources(oldR)

  console.log('=== RESOURCE SUMMARY ===')
  console.log('\nNEW roadmap:')
  console.log(`  Topics: ${newR.topics.length} | With resources: ${newStats.withResources.length} | Without: ${newStats.noResources.length}`)
  console.log(`  Total resource entries: ${newStats.allResources.length}`)
  console.log(`  Unique URLs: ${newStats.uniqueUrls.length}`)
  console.log(`  Duplicate URLs (reused across topics): ${newStats.uniqueDupes.length}`)

  console.log('\nOLD roadmap:')
  console.log(`  Topics: ${oldR.topics.length} | With resources: ${oldStats.withResources.length} | Without: ${oldStats.noResources.length}`)
  console.log(`  Total resource entries: ${oldStats.allResources.length}`)
  console.log(`  Unique URLs: ${oldStats.uniqueUrls.length}`)
  console.log(`  Duplicate URLs (reused across topics): ${oldStats.uniqueDupes.length}`)

  console.log('\n\n=== NEW ROADMAP — ALL RESOURCES ===')
  newR.topics.forEach(t => {
    const res = t.resources as Resource[] ?? []
    console.log(`\n  [${t.title}]`)
    if (res.length === 0) {
      console.log('    (no resources)')
    } else {
      res.forEach(r => console.log(`    ${r.purpose}/${r.type}: ${r.title} — ${r.url}`))
    }
  })

  console.log('\n\n=== OLD ROADMAP — ALL RESOURCES ===')
  oldR.topics.forEach(t => {
    const res = t.resources as Resource[] ?? []
    console.log(`\n  [${t.title}]`)
    if (res.length === 0) {
      console.log('    (no resources)')
    } else {
      res.forEach(r => console.log(`    ${r.purpose}/${r.type}: ${r.title} — ${r.url}`))
    }
  })

  process.exit(0);
}

main();
