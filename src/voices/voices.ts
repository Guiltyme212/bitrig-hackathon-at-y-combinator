import provenance from '../../assets/voices/provenance.json';
import envelopes from './envelopes.json';
import { hexPalette, type Palette } from '../orb/palette';
import type { LookId } from '../orb/liquid';
import type { Segment } from './mix';

// The approved roster from docs/v5/AUDIO_GUIDE.md. Descriptions are proposed copy
// (research/onboarding-2026-09-24/FLOW-v2.md), to be checked against final auditions.
// Auditions and sessions are cut from approved demo tracks; they are
// stand-ins until the backend generates the person's own meditation.
export type VoiceId = 'brittney' | 'natasha' | 'brad' | 'jerry';
export type { Segment };

export type Voice = {
  id: VoiceId;
  name: string;
  line: string;
  bed: string;          // what plays under the voice, in plain words
  look: LookId;         // the orb from Dan's Orb Lab that this voice lives in
  palette: Palette;     // the same colours as a ramp, for anything still drawn from the Prism
  accent: string;       // the look's colour, for type and glows
  audition: number;
  voiceStem: number;
  musicStem: number;
  mix: { voice: number; music: number };   // Dan's saved balance for this pairing
  duckFloor: number;
  timeline: Segment[];
  duration: number;
  envelope: { audition: number[]; voice: number[]; music: number[] };
};

const session = (name: string) => {
  const entry = provenance.voices.find(v => v.voice === name)!.session;
  return { mix: { voice: entry.savedMix?.voice ?? 100, music: entry.savedMix?.music ?? 100 }, duckFloor: entry.duckFloor, timeline: entry.timeline as Segment[], duration: entry.duration };
};

// The dial runs from cold to warm : Natasha's moonlight,
// Brad's candle, Jerry's amber, Brittney's embers.
export const voices: Voice[] = [
  {
    id: 'natasha', name: 'Natasha', line: 'Soft, gentle', bed: 'Soft ocean textures',
    look: 'night', palette: hexPalette('#050B1E', '#4F78D8', '#DCE8FF'), accent: '#8FB0F0',
    audition: require('../../assets/voices/natasha/audition.mp3'),
    voiceStem: require('../../assets/voices/natasha/voice.mp3'), musicStem: require('../../assets/voices/natasha/music.mp3'),
    ...session('Natasha'), envelope: envelopes.natasha,
  },  {
    id: 'brad', name: 'Brad', line: 'Low, relaxed', bed: 'Nocturnal ambient',
    look: 'candle', palette: hexPalette('#1E0E04', '#D98A3A', '#FFE7C2'), accent: '#F3C27E',
    audition: require('../../assets/voices/brad/audition.mp3'),
    voiceStem: require('../../assets/voices/brad/voice.mp3'), musicStem: require('../../assets/voices/brad/music.mp3'),
    ...session('Brad'), envelope: envelopes.brad,
  },  {
    id: 'jerry', name: 'Jerry', line: 'Steady, reassuring', bed: 'Warm felt piano',
    look: 'amber', palette: hexPalette('#231404', '#D39A3A', '#FFEBC6'), accent: '#EBB560',
    audition: require('../../assets/voices/jerry/audition.mp3'),
    voiceStem: require('../../assets/voices/jerry/voice.mp3'), musicStem: require('../../assets/voices/jerry/music.mp3'),
    ...session('Jerry'), envelope: envelopes.jerry,
  },  {
    id: 'brittney', name: 'Brittney', line: 'Warm, conversational', bed: 'Quiet ambient jazz',
    look: 'ember', palette: hexPalette('#2A0A04', '#E0602E', '#FFD7B8'), accent: '#F08A55',
    audition: require('../../assets/voices/brittney/audition.mp3'),
    voiceStem: require('../../assets/voices/brittney/voice.mp3'), musicStem: require('../../assets/voices/brittney/music.mp3'),
    ...session('Brittney'), envelope: envelopes.brittney,
  },];

export const ENVELOPE_RATE = envelopes.rate;
// Unknown or unset: Brittney, the voice Kokoro itself speaks in.
export const voiceById = (id: string | null | undefined) => voices.find(v => v.id === id) ?? voices.find(v => v.id === 'brittney')!;

export { captions, duckAt } from './mix';
