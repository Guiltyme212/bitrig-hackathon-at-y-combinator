import { View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useReducedMotion } from 'react-native-reanimated';
import MakingPhase from '@/making/MakingPhase';
import { useOrbControls } from '@/orb/palette';
import { ROOM_TINT } from '@/voices/VoiceRoom';
import { voiceById } from '@/voices/voices';
import { keepMeditation } from '@/firstRun';
import { useKokoro } from '@/store';
import { k } from '@/theme';
import { Region, useRegions } from '@/layout/Duo';
import PageOrb from '@/layout/PageOrb';

// Making, outside the first conversation: after "Talk to Kokoro", or after the
// words of a preview were changed. Same orb, same reveal.
export default function Making() {
  const reduced = useReducedMotion();
  const meditation = useKokoro(s => s.meditation), onboarded = useKokoro(s => s.onboarded), startedAt = useKokoro(s => s.makingStartedAt);
  const voice = voiceById(meditation?.voiceId);
  const orb = useOrbControls(voice.palette, ROOM_TINT, voice.look);
  const R = useRegions();
  if (!meditation) return <Redirect href="/" />;
  return <View style={{ flex: 1, backgroundColor: k.bg }}>
    {R.split && <Region rect={R.orb.rect} insets={R.orb.insets}><PageOrb orb={orb} /></Region>}
    <Region rect={R.words.rect} insets={R.words.insets}>
    <MakingPhase key={String(startedAt)} orb={orb} renderOrb={!R.split} aside={R.split} meditation={meditation} voice={voice} firstRun={!onboarded} reduced={!!reduced}
      onReady={() => { if (onboarded) keepMeditation(); }}
      onPlay={() => router.replace(onboarded ? { pathname: '/player', params: { id: 'latest' } } : '/preview')} />
    </Region>
  </View>;
}
