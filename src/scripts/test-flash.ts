import { flashcardModel } from '../lib/ai';
import { HumanMessage } from '@langchain/core/messages';
import { z } from 'zod';
async function main() {
  const schema = z.object({ questions: z.array(z.string()).min(3).max(5) });
  const structured = flashcardModel.withStructuredOutput(schema);
  const start = Date.now();
  console.log('Calling Flash...');
  const result = await structured.invoke([new HumanMessage('Ask 3 short questions about robotics learning goals.')]);
  console.log(`Took ${Date.now() - start}ms`);
  console.log(JSON.stringify(result));
  process.exit(0);
}
main();
