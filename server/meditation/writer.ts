import type { Brief, Outcome } from '../../src/meditation/types';
import { pauseBudget, sanitizePhrases, wordBudget, type Phrase } from './plan';
import { postJson } from '../http';
import { narrators } from './narrators';

// Writes the meditation as short phrases, each followed by the silence the listener
// needs. The live backend writes with OpenAI (Railway: LLM_PROVIDER=openai), and
// its Claude proxy's login has expired, so the same key and model are used here.

export type Script = { title: string; description: string; phrases: Phrase[] };

const PRACTICES: Record<Outcome, string> = {
  settle: `SETTLE. Arrive (how to sit, eyes can close or soften). Acknowledge what's going on in one or two lines, using their words. Then long-exhale breathing, done for real: three rounds of "breathe in through the nose, one more short sip of air on top, then a long slow breath out through the mouth" (cyclic sighing), with the pause after each instruction long enough to actually do it. Then the body as an anchor: the weight of it, feet, hands. End with one kind, realistic sentence and let them come back gently.`,
  clarity: `CLARITY. Arrive. Acknowledge the situation in their words. One slow breath together. Then name the thought that keeps looping and step back from it: they can say to themselves "I'm having the thought that…" (defusion from ACT). Then gently sort: what is actually in their hands today, and what isn't. Finish with one small, concrete next step for today or tomorrow that fits what they told you, said plainly, and a steady close.`,
  support: `SUPPORT. Arrive. Acknowledge what's hard, in their words, without fixing it. Then a self-compassion break (Kristin Neff): notice "this is hard right now"; remember other people in this exact spot feel this too; a hand on the chest or wherever feels right; ask what they would say to a friend in their place, pause, then offer it back to themselves. Close warm, with a little lightness if it fits.`,
  lift: `LIFT. For a dream, ambition, a big chance or a room full of impressive people, and the pressure or comparing that comes with it: they need belief and perspective more than a plan. Open with their name if you have it, warmly: an invitation to take a minute just for themselves. Two slow breaths to arrive, done for real. Then a proud, honest "look at you" moment: how far they have come, concretely, from what they told you (where they are now, what it took to get here); they did that, and it is allowed to feel good. Invite them to look around and take in where they are right now (the light, the air, the sounds, the people), always as an invitation, never as a fact you can't know; the impressive people around them are good company and a sign they are in the right room, not a scoreboard. Then be kind about the pressure: they don't have to be so hard on themselves, nobody has to be ahead of anyone today, the dream matters and they are bigger than any one yes or no. Close with calm, grounded belief in them: so much of what matters is in their hands, today and after it. One last slow breath. Warm and sincere throughout: at most ONE light touch in the whole session, within the first three phrases, and none after the breathing starts. Never promise the result they want.`,
  sleep: `SLEEP. They are lying down in the dark. Acknowledge the day in one line, then put it down for tonight: it will still be there, they don't have to hold it now. Slower, longer breaths out. Let the body go heavy from the face down to the feet. Thoughts can pass like cars outside. No tasks, no "tomorrow you will", no waking up: the final phrases get shorter and quieter and simply let them drift. Longer pauses than any other session.`,
};

// The approved reference performance (listening room r2-09, Dan's "all good" track),
// shown for tone only.
const REFERENCE = `[warmly] Okay. You're in San Francisco, you're trying to build something, and some of your networking strategy involves pizza. / [smiling] That's a fairly understandable response to being hungry. / Take a seat. / Let your shoulders drop if they want to. / For a minute, you don't have to turn this moment into a story about whether you belong here. / [gently] Notice what you feel when you stop defending yourself. / Maybe relief. / Maybe the same worry. / Maybe you're still hungry. / Let it be ordinary. / You can take your situation seriously without reviewing your entire character over a paper plate.`;

export function systemPrompt() {
  return `You write personal guided meditations for Kokoro. One narrator speaks them over quiet music.

TONE
- Close and conversational, like a calm friend who is very good at this. No internet slang or memes ("chose violence", "main character"). Warm, plain words, second person. At most two light touches of dry wit, early in the session, never during the breathing and never at the expense of their pain; after that stay warm and plain.
- Specific to this person: build it around their situation, told back in your own words, in the second person, the way a friend who really listened would ("You picked up your whole life for this."). Don't recite them: no "You said…", no sentences of theirs in quotation marks, never their first-person words inside your sentence ("everyone here is ahead of me" becomes "the feeling that everyone's ahead of you"). Their name once or twice (the opening is a good place), or not at all.
- Faithful to what they told you: never upgrade their story (being at a place, or applying, is not being accepted; a hope is not a result), and never add facts they didn't give: not where they came from or how far, not what they own, not the place or the weather. Invite them to notice instead.
- Spoken, not written: use contractions the way people talk (you're, don't, it's).
- Calm but alive: vary sentence length, some sentences only two or three words. No generic wellness filler ("embrace the journey", "you are enough", "the universe", "sacred space"), no jargon, no descriptions of the music.
- Never diagnose, never promise an outcome ("this will fix", "you will succeed"), no medical, legal or financial advice. Supportive, never clinical.

STRUCTURE
${'{{PRACTICE}}'}

PACING (this matters most)
- Write short phrases: one or two sentences each, usually 5 to 20 words. Every phrase has "pause": the seconds of silence after it.
- Put the silence where the listener needs it: after a breath instruction, as long as the breath really takes (5 to 8 s); to notice something, 3 to 5 s; to imagine, 6 to 10 s; after a sentence that should land, 3 to 4 s; ordinary connecting phrases 1 to 2 s; between parts of the session 9 to 14 s.
- LENGTH IS A HARD LIMIT: between {{WORDS_LO}} and {{WORDS}} spoken words in total (count them before answering), in about {{PHRASES}} phrases, with pauses adding up to about {{PAUSES}} seconds. The narrator speaks about 135 words a minute, so every extra sentence steals silence from the listener.
- Numbers as words ("three breaths"). No lists, headings, emoji or stage directions.
- Optional delivery tags, sparingly, only at the very start of a phrase, only these: [warmly] [gently] [softly] [calmly] [smiling] [exhales] [whispers]. At most one tag every three phrases. Never any other brackets.

ALSO WRITE
- "title": two to five words, their subject in their own terms ("Free pizza", "Tomorrow's pitch", "Letting the day go"). Never "Meditation for…".
- "description": one plain sentence saying what these minutes do, spoken to them ("you"), never their name ("Three minutes to get some distance from the funding spiral, then one useful next step.").

SAFETY
If they mention wanting to die or hurting themselves, write a grounding, stay-here session: just this hour, they are not alone, reach one real person now, in the US they can call or text 988. Never methods, never romanticising.

REFERENCE FOR TONE ONLY (a different person's session; phrases separated by /):
${REFERENCE}`;
}

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'description', 'phrases'],
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    phrases: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['text', 'pause'], properties: { text: { type: 'string' }, pause: { type: 'number' } } } },
  },
};

// A narrator slowed to 0.92× needs 8% fewer words for the same minutes.
const budgetFor = (brief: Brief) => wordBudget(brief.minutes) * (brief.voiceId ? narrators[brief.voiceId].tempo : 1);

export function writerMessages(brief: Brief) {
  const system = systemPrompt()
    .replace('{{PRACTICE}}', PRACTICES[brief.outcome])
    // The writer runs long by about a tenth, so it's asked for a little less.
    .replace('{{WORDS_LO}}', String(Math.round(budgetFor(brief) * 0.75)))
    .replace('{{WORDS}}', String(Math.round(budgetFor(brief) * 0.9)))
    .replace('{{PHRASES}}', String(Math.max(8, Math.round(budgetFor(brief) / 9.5))))
    .replace('{{PAUSES}}', String(pauseBudget(brief.minutes)));
  const person = {
    name: brief.name || undefined,
    situation: brief.situation,
    their_words: brief.words.slice(0, 3),
    loudest_feeling: brief.feeling || undefined,
    what_comes_next: brief.next || undefined,
    minutes: brief.minutes,
    working_title: brief.title || undefined,
  };
  return [
    { role: 'system', content: system },
    { role: 'user', content: `Write this ${brief.minutes}-minute ${brief.outcome} session.\n${JSON.stringify(person, null, 2)}` },
  ];
}

const countWords = (phrases: Phrase[]) => phrases.reduce((n, p) => n + p.text.replace(/\[[^\]]*\]/g, ' ').split(/\s+/).filter(Boolean).length, 0);

export async function writeScript(brief: Brief, key: string, model: string): Promise<Script> {
  const limit = budgetFor(brief);
  const messages: { role: string; content: string }[] = writerMessages(brief);
  let lastError: unknown, draft: Script | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await postJson<{ choices?: { message?: { content?: string; refusal?: string } }[] }>('https://api.openai.com/v1/chat/completions',
        { Authorization: `Bearer ${key}` },
        { model, reasoning_effort: process.env.KOKORO_WRITER_EFFORT || 'low', messages, response_format: { type: 'json_schema', json_schema: { name: 'meditation', strict: true, schema } } },
        90_000);
      if (response.status < 200 || response.status >= 300) throw new Error(`The writer answered ${response.status}.`);
      const body = response.json;
      const message = body.choices?.[0]?.message;
      if (!message?.content) throw new Error(message?.refusal ? 'The writer declined.' : 'The writer sent nothing back.');
      const raw = JSON.parse(message.content) as Script;
      const phrases = sanitizePhrases(raw.phrases ?? []);
      if (phrases.length < 3) throw new Error('The script came back too short.');
      draft = { title: String(raw.title || brief.title || 'For you').slice(0, 60), description: String(raw.description || '').slice(0, 200), phrases };
      const words = countWords(phrases);
      // One chance to cut a draft that would steal the listener's silence.
      if (words <= limit * 1.3 || attempt > 0) return draft;
      messages.push({ role: 'assistant', content: message.content },
        { role: 'user', content: `That draft has ${words} spoken words; the hard limit is ${limit}. Cut it to between ${Math.round(limit * 0.85)} and ${limit} words: keep the structure, the practice and their words, lose the extra sentences and jokes. Keep the pauses.` });
    } catch (error) { lastError = error; if (draft) return draft; }
  }
  if (draft) return draft;
  throw lastError instanceof Error ? lastError : new Error('The writer failed.');
}
