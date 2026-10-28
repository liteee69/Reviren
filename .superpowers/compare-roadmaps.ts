import { db } from './src/lib/db/index';
import { roadmaps, roadmapPhases, sections, topics } from './src/lib/db/schema';
import { eq } from 'drizzle-orm';

const NEW_ID = 'a4a5d635-7c30-4275-905a-db17079d5032';
const OLD_ID = '19b95fa6-64b9-4f89-a1e1-faac86b2dd5e';

async function getRoadmap(id: string) {
  const [roadmap] = await db.select().from(roadmaps).where(eq(roadmaps.id, id));
  const phases = await db.select().from(roadmapPhases).where(eq(roadmapPhases.roadmapId, id)).orderBy(roadmapPhases.order);
  const sects = await db.select().from(sections).where(eq(sections.roadmapId, id)).orderBy(sections.order);
  const tops = await db.select().from(topics).where(eq(topics.roadmapId, id)).orderBy(topics.order);
  return { roadmap, phases, sections: sects, topics: tops };
}

async function main() {
  const [newR, oldR] = await Promise.all([getRoadmap(NEW_ID), getRoadmap(OLD_ID)]);

  console.log('=== NEW ROADMAP ===');
  console.log('Title:', newR.roadmap?.title);
  console.log('Description:', newR.roadmap?.description);
  console.log('Total topics:', newR.topics.length);
  newR.phases.forEach(p => {
    const pSections = newR.sections.filter(s => s.phaseId === p.id);
    const pTopics = newR.topics.filter(t => pSections.some(s => s.id === t.sectionId));
    console.log(`\n  ${p.title} (${pSections.length} sections, ${pTopics.length} topics)`);
    pSections.forEach(s => {
      const sTopics = newR.topics.filter(t => t.sectionId === s.id);
      console.log(`    [${s.title}]: ${sTopics.map(t => t.title).join(' | ')}`);
    });
  });

  console.log('\n\n=== OLD ROADMAP ===');
  console.log('Title:', oldR.roadmap?.title);
  console.log('Description:', oldR.roadmap?.description);
  console.log('Total topics:', oldR.topics.length);
  oldR.phases.forEach(p => {
    const pSections = oldR.sections.filter(s => s.phaseId === p.id);
    const pTopics = oldR.topics.filter(t => pSections.some(s => s.id === t.sectionId));
    console.log(`\n  ${p.title} (${pSections.length} sections, ${pTopics.length} topics)`);
    pSections.forEach(s => {
      const sTopics = oldR.topics.filter(t => t.sectionId === s.id);
      console.log(`    [${s.title}]: ${sTopics.map(t => t.title).join(' | ')}`);
    });
  });

  process.exit(0);
}

main();
