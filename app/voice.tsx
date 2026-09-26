import { View } from 'react-native';
import { router } from 'expo-router';
import { useReducedMotion } from 'react-native-reanimated';
import VoiceRoom, { ROOM_TINT } from '@/voices/VoiceRoom';
import { useOrbControls } from '@/orb/palette';
import { voiceById } from '@/voices/voices';
import { kokoro, useKokoro } from '@/store';
import { k } from '@/theme';
import { Region, useRegions } from '@/layout/Duo';
import PageOrb from '@/layout/PageOrb';

// Change voice, from the preview or the player: the same room, starting on the
// voice they have now. Choosing one updates the meditation and returns to it.
export default function Voice() {
  const reduced = useReducedMotion();
  const voiceId = useKokoro(s => s.voiceId);
  const current = voiceById(voiceId);
  const orb = useOrbControls(current.palette, ROOM_TINT, current.look);
  // iPhone Duo: closed, the room fills the column; open, its orb takes the orb page.
  const R = useRegions();
  return <View style={{ flex: 1, backgroundColor: k.bg }}>
    {R.split && <Region rect={R.orb.rect} insets={R.orb.insets}><PageOrb orb={orb} /></Region>}
    <Region rect={R.words.rect} insets={R.words.insets}>
    <VoiceRoom orb={orb} renderOrb={!R.split} aside={R.split} initial={current.id} reduced={!!reduced} onClose={() => router.back()}
      chooseLabel={voice => voice.id === current.id ? `Keep ${voice.name}` : `Use ${voice.name}`}
      onChoose={voice => {
        const meditation = kokoro.get().meditation;
        kokoro.set({ voiceId: voice.id, meditation: meditation ? { ...meditation, voiceId: voice.id } : null });
        router.back();
      }} />
    </Region>
  </View>;
}
