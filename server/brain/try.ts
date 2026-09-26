import { BrainSession } from '../../src/brain/session';
import { signedUrl } from './signed';

// Talks to the Kokoro Orb agent from the terminal, to check its manner and timing:
//   npm run brain:try                      the founder story, then "yes, that's it"
//   npm run brain:try -- "first" "second"  your own lines, in order
const lines = process.argv.slice(2).length ? process.argv.slice(2) : [
  "I'm a founder, I just moved to SF, my money is running out, nobody wants to invest in me and I really want to get into Y Combinator. But I'm going to events for free food. Am I even doing it right?",
  'Honestly the thing stuck in my head is that maybe I am just not good enough.',
];

async function main() {
  const url = await signedUrl();
  if (!url) throw new Error('No signed url: is KOKORO_ORB_AGENT_ID in .env.local?');
  const brain = new BrainSession(url, { name: 'Dan' });
  let t = Date.now();
  await brain.opened();
  console.log(`connected in ${Date.now() - t}ms`);
  for (const line of lines) {
    console.log(`\nYOU: ${line}`);
    t = Date.now();
    const turn = await brain.send(line);
    console.log(`KOKORO (${Date.now() - t}ms): ${turn.reply}`);
    if (turn.proposal) { console.log('PROPOSAL:', JSON.stringify(turn.proposal, null, 1)); break; }
  }
  brain.close();
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
