import { roadmapModel } from '../lib/ai';
import { HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';

async function main() {
  const TestSchema = z.object({
    title: z.string(),
    phases: z.array(z.object({
      name: z.string(),
      topics: z.array(z.string()),
    })),
  });

  const structured = roadmapModel.withStructuredOutput(TestSchema);
  const start = Date.now();
  console.log('Calling Sonnet withStructuredOutput...');
  try {
    const result = await structured.invoke([new HumanMessage(
      'Create a tiny 2-phase robotics learning roadmap. Phase 1: Foundations with 2 topics. Phase 2: Hardware with 2 topics.'
    )]);
    console.log(`Took ${Date.now() - start}ms`);
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(`Failed after ${Date.now() - start}ms:`, e);
  }
  process.exit(0);
}
main();
