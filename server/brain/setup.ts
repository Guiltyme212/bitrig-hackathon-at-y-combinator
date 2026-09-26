import { appendFile, readFile } from 'node:fs/promises';
import { config } from 'dotenv';
import { FIRST_MESSAGE, PROMPT, TOOL } from './prompt';

// Creates or updates the "Kokoro Orb" ElevenLabs agent from ./prompt.ts:
//   npm run brain:setup                  create (first time) or update both
//   npm run brain:setup -- --llm claude-haiku-4-5 --effort none
// The ids land in .env.local (KOKORO_ORB_AGENT_ID, KOKORO_ORB_TOOL_ID). The live
// "Kokoro" agent (App Store app) is never touched.
config({ path: '.env.local', quiet: true });

const KEY = process.env.ELEVENLABS_API_KEY ?? '';
const LIVE_AGENT = 'agent_3101krqbh19mezt9t835q2f7s5ds';
// Text mode: the app speaks the replies in Brittney's voice (app/api/speak). Brittney
// can't be an agent voice (ElevenLabs live moderation), so the agent keeps the live
// agent's voice for a future real-time mode.
const AGENT_VOICE = 'OSwaPSNdfituxkWcjlkR';
const arg = (name: string, fallback: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };

async function api(method: string, path: string, body?: unknown) {
  const response = await fetch(`https://api.elevenlabs.io${path}`, {
    method, headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status} ${text.slice(0, 600)}`);
  return text ? JSON.parse(text) : {};
}

async function remember(name: string, value: string) {
  const env = await readFile('.env.local', 'utf8');
  if (!new RegExp(`^${name}=`, 'm').test(env)) await appendFile('.env.local', `${env.endsWith('\n') ? '' : '\n'}${name}=${value}\n`);
}

async function main() {
  if (!KEY) throw new Error('ELEVENLABS_API_KEY is missing from .env.local');
  let toolId = process.env.KOKORO_ORB_TOOL_ID;
  if (toolId) await api('PATCH', `/v1/convai/tools/${toolId}`, { tool_config: TOOL });
  else { toolId = (await api('POST', '/v1/convai/tools', { tool_config: TOOL })).id as string; await remember('KOKORO_ORB_TOOL_ID', toolId); }
  console.log('tool', toolId);

  const conversation_config = {
    agent: {
      first_message: FIRST_MESSAGE,
      language: 'en',
      dynamic_variables: { dynamic_variable_placeholders: { name: '' } },
      // Some models (e.g. claude-haiku-4-5) take no reasoning effort: pass --effort omit.
      prompt: { prompt: PROMPT, llm: arg('llm', 'claude-sonnet-5'), reasoning_effort: arg('effort', 'low') === 'omit' ? null : arg('effort', 'low'), temperature: 0.5, tool_ids: [toolId] },
    },
    tts: { model_id: 'eleven_v3_conversational', voice_id: AGENT_VOICE },
    conversation: { text_only: true, max_duration_seconds: 900 },
  };
  const platform_settings = { auth: { enable_auth: true }, overrides: { conversation_config_override: { conversation: { text_only: true } } } };

  let agentId = process.env.KOKORO_ORB_AGENT_ID;
  if (agentId === LIVE_AGENT) throw new Error('Refusing to touch the live Kokoro agent.');
  if (agentId) await api('PATCH', `/v1/convai/agents/${agentId}`, { name: 'Kokoro Orb (v5)', conversation_config, platform_settings });
  else { agentId = (await api('POST', '/v1/convai/agents/create', { name: 'Kokoro Orb (v5)', conversation_config, platform_settings })).agent_id as string; await remember('KOKORO_ORB_AGENT_ID', agentId); }
  console.log('agent', agentId, '·', conversation_config.agent.prompt.llm, conversation_config.agent.prompt.reasoning_effort);
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
