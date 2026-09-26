import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/Text';
import { feel } from '@/haptics';
import { PrimaryButton, Selectable, TextButton } from '@/ui/Buttons';
import { GlassCircle } from '@/ui/Glass';
import { LiveOrb } from '@/ui/Orbs';
import { firstMeditation, kokoro, useKokoro } from '@/store';
import { k } from '@/theme';
import { Region, useDuo, useRegions } from '@/layout/Duo';

const moods = ['Lighter', 'Calmer', 'About the same', 'Still heavy'];

export default function Complete() {
  const sysInsets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const sessions = useKokoro(s => s.sessions), mood = useKokoro(s => s.mood);
  const session = sessions.find(s => s.id === id) ?? sessions[0] ?? firstMeditation(kokoro.get());
  const talk = () => { router.back(); setTimeout(() => router.push('/chat'), 350); };

  // Closed, both pages are the column: same fix as the player (the column's own
  // insets, cleared of the strip, in place of the raw system ones).
  const L = useDuo();
  const R = useRegions();
  const duoSplit = L.duo && R.split;
  const insets = L.duo && !duoSplit ? R.orb.insets : sysInsets;
  const meta = `${session.minutes} MINUTES · ${session.title.toUpperCase()}`;
  // A phone-shaped column can be narrower on the Duo (382, closed, or 371.5, the
  // words page) than any real phone this 48.5% was tuned against: at 382 it's 0.2px
  // over two-per-row and silently drops to one, so the Duo pages compute an exact
  // pixel width instead (phone keeps the untouched percentage).
  const moodGrid = (wide: boolean, columnWidth: number) => <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
    {moods.map(m => <Selectable key={m} selected={mood === m} onPress={() => { if (mood !== m) { void feel('select'); kokoro.set({ mood: m }); } }}
      style={{ width: L.duo ? (columnWidth - 56 - 10) / 2 : wide ? '48%' : '48.5%', minHeight: wide ? 64 : 56, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 15, color: '#DFDFE3' }}>{m}</Text>
    </Selectable>)}
  </View>;

  // `R.orb` is one Region mounted in both poses: closed, it's the whole 382 column
  // (today's exact composition, just width-clipped clear of the strip); open, it
  // shrinks to the orb's own page and the words move to a second Region beside it.
  if (!duoSplit) return <Region rect={R.orb.rect} insets={R.orb.insets}>
    <View style={{ flex: 1, backgroundColor: k.bg }}>
      <View style={{ position: 'absolute', top: insets.top + 4, left: 16, zIndex: 2 }}>
        <GlassCircle icon="xmark" label="Close" color={k.secondary} onPress={() => router.back()} />
      </View>
      <View style={{ alignItems: 'center', marginTop: insets.top + 70 }}><LiveOrb size={200} /></View>
      <View style={{ paddingHorizontal: 28, marginTop: 30, gap: 16 }}>
        <Text style={{ fontSize: 10, fontWeight: '500', letterSpacing: 1.7, color: k.secondary, textAlign: 'center' }}>{meta}</Text>
        <Text accessibilityRole="header" style={{ fontSize: 30, lineHeight: 36, letterSpacing: -1, fontWeight: '500', color: k.ink, textAlign: 'center', marginBottom: 8 }}>How do you feel now?</Text>
        {moodGrid(false, R.orb.rect.w)}
      </View>
      <View style={{ position: 'absolute', left: 28, right: 28, bottom: Math.max(insets.bottom, 18) }}>
        <PrimaryButton label="Done" onPress={() => router.back()} />
        <TextButton label="Talk it through with Kokoro" color={k.mint} size={14} onPress={talk} />
      </View>
    </View>
  </Region>;

  // Open: the orb's afterglow keeps its own page; the question, moods and Done move
  // to the words page. `Region` stays mounted in both places as the hinge moves.
  return <>
    <Region rect={R.orb.rect} insets={R.orb.insets}>
      <View style={{ flex: 1, backgroundColor: k.bg }}>
        <View style={{ position: 'absolute', top: R.orb.insets.top + 4, left: 16, zIndex: 2 }}>
          <GlassCircle icon="xmark" label="Close" color={k.secondary} onPress={() => router.back()} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, paddingBottom: R.orb.insets.bottom }}>
          <LiveOrb size={220} />
          <Text style={{ fontSize: 10, fontWeight: '500', letterSpacing: 1.7, color: k.secondary, textAlign: 'center' }}>{meta}</Text>
        </View>
      </View>
    </Region>
    <Region rect={R.words.rect} insets={R.words.insets}>
      <View style={{ flex: 1, paddingHorizontal: 28, justifyContent: 'center', gap: 20, paddingBottom: R.words.insets.bottom + 24 }}>
        <Text accessibilityRole="header" style={{ fontSize: 30, lineHeight: 36, letterSpacing: -1, fontWeight: '500', color: k.ink }}>How do you feel now?</Text>
        {moodGrid(true, R.words.rect.w)}
        <View style={{ marginTop: 20 }}>
          <PrimaryButton label="Done" onPress={() => router.back()} />
          <TextButton label="Talk it through with Kokoro" color={k.mint} size={14} onPress={talk} />
        </View>
      </View>
    </Region>
  </>;
}
