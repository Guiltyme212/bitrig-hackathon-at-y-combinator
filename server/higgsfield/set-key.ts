import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { readFile, writeFile } from 'node:fs/promises';

// Stores a Higgsfield key in ignored .env.local without echoing, printing or logging it.
// The key it replaces is kept once as HF_CREDENTIALS_PREVIOUS.
let muted = false;
const output = new Writable({ write(chunk, _encoding, done) { if (!muted) process.stdout.write(chunk); done(); } });
const prompt = createInterface({ input: process.stdin, output, terminal: true });
prompt.on('SIGINT', () => { prompt.close(); process.stdout.write('\nCanceled. Nothing was changed.\n'); process.exit(1); });

async function main() {
  process.stdout.write('Paste your Higgsfield key (key-id:key-secret) and press Enter. It will not be shown: ');
  muted = true;
  const value = (await new Promise<string>(resolve => prompt.question('', resolve))).trim();
  prompt.close();
  process.stdout.write('\n');
  if (!/^[^\s:]+:[^\s:]+$/.test(value)) throw new Error('That is not in key-id:key-secret format. Nothing was changed.');
  let lines: string[] = [];
  try { lines = (await readFile('.env.local', 'utf8')).split('\n'); } catch {}
  const next = `HF_CREDENTIALS=${value}`;
  const index = lines.findIndex(line => line.startsWith('HF_CREDENTIALS='));
  if (index === -1) lines.unshift(next);
  else if (lines[index] !== next) {
    const previous = lines[index].replace('HF_CREDENTIALS=', 'HF_CREDENTIALS_PREVIOUS=');
    lines = lines.filter(line => !line.startsWith('HF_CREDENTIALS_PREVIOUS='));
    lines.splice(lines.findIndex(line => line.startsWith('HF_CREDENTIALS=')), 1, next, previous);
  }
  await writeFile('.env.local', lines.join('\n'), { mode: 0o600 });
  console.log('Saved HF_CREDENTIALS in .env.local.');
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Could not save the key.'); process.exitCode = 1; });
