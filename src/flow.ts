export type Answers={name:string;age:string;gender:string;burdens:string[];frequency:string;cost:string;future:string;sound:string};
export const initialAnswers:Answers={name:'',age:'',gender:'',burdens:[],frequency:'',cost:'',future:'',sound:''};
export const ages=['18–24','25–34','35–44','45–54','55+','Prefer not to say'];
export const genders=['Woman','Man','Non-binary','Prefer not to say'];
export const burdens=['An overthinking mind','Pressure to keep up','Trouble switching off','Feeling disconnected','A little of everything'];
export const frequencies=['As soon as I wake up','In the middle of a busy day','When everything goes quiet','It follows me everywhere'];
export const costs=['Being present with people I love','Feeling rested','Trusting myself','Enjoying the little things'];
export const futures=['A quieter mind','More ease in my days','Feeling like myself again','Space to just be'];
// What plays under the voice; it becomes the music Kokoro composes.
export const sounds=[
  {label:'Soft rain',icon:'rain'},{label:'Ocean at night',icon:'wave'},{label:'Slow piano',icon:'piano'},
  {label:'Cosmic drift',icon:'spark'},{label:'Forest morning',icon:'leaf'},{label:'Just my voice',icon:'voice'},
] as const;
// 0 arrival · 1–2 story · 3–9 questions · 10 sound · 11 reflection · 12 plan · 13 microphone.
export const lastStep=13;
export function canContinue(step:number,a:Answers){
  if(step===6)return a.burdens.length>0;
  if(step===7)return !!a.frequency;
  if(step===8)return !!a.cost;
  if(step===9)return !!a.future;
  if(step===10)return !!a.sound;
  return true;
}
export function burdenLine(a:Answers){
  if(a.burdens.includes('A little of everything')||a.burdens.length>2)return 'You’ve been carrying a lot.';
  if(a.burdens.includes('An overthinking mind'))return 'Even quiet moments can feel loud.';
  if(a.burdens.includes('Pressure to keep up'))return 'Always keeping up can leave little room for you.';
  if(a.burdens.includes('Trouble switching off'))return 'The day ends. Your mind keeps going.';
  return 'It’s easy to lose touch with yourself.';
}
export function futureLine(a:Answers){
  const prefix=a.name.trim()?`${a.name.trim()}, let’s`:'Let’s';
  return `${prefix} make room for ${a.future==='A quieter mind'?'a quieter mind':a.future==='More ease in my days'?'more ease':a.future==='Feeling like myself again'?'you to feel like yourself':'a little space to just be'}.`;
}
export function restoredSpace(a:Answers){
  return a.cost==='Being present with people I love'?'the people you love':a.cost==='Feeling rested'?'rest':a.cost==='Trusting myself'?'trust in yourself':a.cost==='Enjoying the little things'?'the little things':'what matters to you';
}

export function tonightLine(a:Answers){
  return a.sound==='Just my voice'||!a.sound?'A meditation made from what you share. About 10 minutes, just the voice.':`A meditation made from what you share. About 10 minutes, ${a.sound.toLowerCase()} underneath.`;
}
