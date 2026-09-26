// What Kokoro says in the first conversation, and how it reads what you share.
// Local, authored logic for the front-end prototype: the backend will write the
// real meditation. It must accept ambition as well as distress, and never turn
// every answer into stress.

export type FeelingId = 'calmer' | 'confident' | 'motivated' | 'sleep' | 'unsure';
export type Feeling = { id: FeelingId; label: string; color: string; reply: string };

export const feelings: Feeling[] = [
  { id: 'motivated', label: 'Motivated', color: '#F2A08E', reply: 'Motivated. Let’s bring some energy to it.' },
  { id: 'confident', label: 'More confident', color: '#F0C27E', reply: 'Confident. We’ll rehearse that feeling.' },
  { id: 'calmer', label: 'Calmer', color: '#9CC4E6', reply: 'Calmer it is.' },
  { id: 'sleep', label: 'Ready for sleep', color: '#A5ADF2', reply: 'Sleep, then. We’ll keep it slow.' },
  { id: 'unsure', label: 'I’m not sure', color: '#CFCFD6', reply: 'That’s fine. We’ll keep it gentle and open.' },
];
// The wheel opens on Calmer, in the middle, with a choice either side of it.
export const defaultFeeling = 2;
export const feelingById = (id: string | null | undefined) => feelings.find(f => f.id === id) ?? null;

export const shortcuts: { label: string; feel: FeelingId }[] = [
  { label: 'I need a break', feel: 'calmer' },
  { label: 'I want to feel confident', feel: 'confident' },
  { label: 'I want to get motivated', feel: 'motivated' },
  { label: 'I want to sleep', feel: 'sleep' },
];

export const minuteChoices = [1, 3, 5, 10] as const;

// Kokoro opens with a bold promise to guide, not a description of the product .
export const intro = ['I will guide you to the life you want.', 'Trust me.', 'What should I call you?'];
export const greet = (name: string) => name ? [`Hi, ${name}.`, 'A few quick questions, then I’ll make you something.'] : ['That’s fine.', 'A few quick questions, then I’ll make you something.'];
export const askMind = (name: string) => name ? `${name}, what’s on your mind?` : 'What’s on your mind?';
export const askFeel = 'How do you want to feel afterwards?';
// Dan, 26 September: "How much time have you got?" sounded odd; the options stay 1/3/5/10.
export const askTime = 'Do you have 5 or 10 minutes?';
export const askVoice = 'Last thing. Whose voice would you like to hear?';
export const voiceNote = ['I heard you. This preview can’t turn speech into words yet.', 'Could you type a few of them?'];
// The microphone, asked for only when someone chooses to talk, and in the orb's own words.
export const deniedLine = ['That’s okay.', 'Type it to me instead.'];
export const unheardLine = ['I couldn’t quite catch that.', 'Say it again, or type it.'];
export const lostLine = ['My ears aren’t working here.', 'Could you type it instead?'];

const timeReplies: Record<number, string> = {
  1: 'One minute. Short, and complete.',
  3: 'Three minutes. Enough to feel the difference.',
  5: 'Five minutes. Room to settle.',
  10: 'Ten minutes. Time to go deeper.',
};
export const timeReply = (minutes: number) => timeReplies[minutes] ?? `${minutes} minutes.`;

export type Topic = { title: string; reply: string[]; kind: string };

// Reads the person's own words for a title they recognise, keeping the subject
// they chose (a Lambo stays a Lambo) and never inventing a diagnosis.
export function readMind(raw: string): Topic {
  const text = raw.trim().replace(/\s+/g, ' ');
  const lower = text.toLowerCase();
  const shortcut = shortcuts.find(s => s.label.toLowerCase() === lower);
  if (shortcut) {
    const bySelf: Record<FeelingId, Topic> = {
      calmer: { kind: 'break', title: 'A few minutes off', reply: ['A break it is.', 'Let’s give you a few minutes off.'] },
      confident: { kind: 'confidence', title: 'Feeling steady in yourself', reply: ['Confidence.', 'Let’s build it from the inside.'] },
      motivated: { kind: 'motivation', title: 'Getting going', reply: ['Let’s get you moving.'] },
      sleep: { kind: 'sleep', title: 'Letting the day go', reply: ['Sleep.', 'Let’s slow everything down.'] },
      unsure: { kind: 'open', title: 'A little space', reply: ['Let’s make a little space.'] },
    };
    return bySelf[shortcut.feel];
  }
  const event = lower.match(/\b(presentation|pitch|interview|exam|speech|talk|demo|meeting|date|audition|race|match|game)\b/);
  if (event) {
    const when = /\btomorrow\b/.test(lower) ? 'Tomorrow’s' : /\btonight\b/.test(lower) ? 'Tonight’s' : /\btoday\b/.test(lower) ? 'Today’s' : 'Before your';
    const title = `${when} ${event[1]}`;
    return { kind: 'event', title, reply: [`${title}.`, 'Let’s make you something for that.'] };
  }
  const yc = /\b(yc|y combinator)\b/.test(lower), lambo = /\blambo(rghini)?\b/.test(lower);
  if (yc && lambo) return { kind: 'ambition', title: 'YC and the Lambo', reply: ['YC and the Lambo.', 'Big goals. Let’s make something for them.'] };
  if (yc) return { kind: 'ambition', title: 'The road to YC', reply: ['YC.', 'Big goal. Let’s make something for it.'] };
  if (/\b(broke up|break ?up|my ex|split up|dumped)\b/.test(lower)) return { kind: 'breakup', title: 'A break from thinking about them', reply: ['That’s a lot to carry.', 'Let’s give you a break from it.'] };
  if (/\b(everyone needs me|needing me|needs me|exhausted|burn(ed|t)? out|so tired|drained)\b/.test(lower)) return { kind: 'tired', title: 'A minute to yourself', reply: ['Then this one is just for you.'] };
  if (/\b(sleep|insomnia|awake|can’t sleep|can't sleep)\b/.test(lower)) return { kind: 'sleep', title: 'Letting the day go', reply: ['Let’s help you rest.'] };
  if (/\b(anxious|anxiety|nervous|worried|worry|stressed|stress|overwhelmed|panic)\b/.test(lower)) return { kind: 'worry', title: 'Setting it down', reply: ['That sounds heavy.', 'Let’s set some of it down.'] };
  if (/\b(work|job|boss|deadline|deadlines|office)\b/.test(lower)) return { kind: 'work', title: 'Leaving work at work', reply: ['Work, then.', 'Let’s make some room from it.'] };
  // Their own words become the title when they're short enough to hold one.
  const words = text.replace(/[.!?]+$/, '').split(' ');
  if (words.length <= 5) {
    const title = words.join(' ').replace(/^./, c => c.toUpperCase());
    return { kind: 'own', title, reply: [`${title}.`, 'I can work with that.'] };
  }
  return { kind: 'own', title: 'What’s on your mind', reply: ['Thank you for telling me.', 'I can work with that.'] };
}

// One sentence on what the recording will do. No personality analysis.
export function describe(topic: Topic, feel: FeelingId | null, minutes: number) {
  if (topic.kind === 'event' && (feel === 'confident' || feel === null)) return 'Rehearse walking in, taking your time, and saying your first sentence.';
  if (topic.kind === 'ambition' && (feel === 'motivated' || feel === null)) return 'Picture what you’re working toward, then bring that energy to your next step.';
  if (topic.kind === 'breakup' && feel !== 'sleep') return 'A few minutes with your attention on something else.';
  if (topic.kind === 'tired' && minutes <= 1) return 'No advice to work through. Just a short pause.';
  switch (feel) {
    case 'confident': return 'Settle your body, then rehearse the moment you’re walking into.';
    case 'motivated': return 'Picture what you’re working toward, then choose your first step.';
    case 'sleep': return 'Slow the breath, soften the body, and let the day go.';
    case 'unsure': return 'A gentle, open pause. Nothing to get right.';
    default: return 'A few quiet minutes to set down what you’re carrying.';
  }
}

// A stated outcome in the first answer answers the next question too.
export function impliedFeeling(text: string): FeelingId | null {
  const shortcut = shortcuts.find(s => s.label.toLowerCase() === text.trim().toLowerCase());
  return shortcut?.feel ?? null;
}

export const makingLines = (topic: Topic, voice: string, bed: string) => [
  topic.title === 'What’s on your mind' ? 'Writing it around what you shared' : `Writing “${topic.title}”`,
  `Recording ${voice}’s voice`,
  `Adding ${bed.toLowerCase()}`,
  'Finding the pauses',
];
