import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Text } from '@/Text';
import { feel } from '@/haptics';
import { PrimaryButton } from '@/ui/Buttons';
import { GlassButton } from '@/ui/Glass';
import { TextButton } from '@/ui/Buttons';
import { MiniOrb } from '@/ui/Orbs';
import LiquidOrb from '@/orb/LiquidOrb';
import { useKokoro, type Session } from '@/store';
import { voiceById } from '@/voices/voices';
import { k, r } from '@/theme';
import { Region, useRegions } from '@/layout/Duo';

const filters: { label: string; kind: Session['kind'] | null }[] = [
  { label: 'All', kind: null }, { label: 'Sleep', kind: 'sleep' }, { label: 'Calm', kind: 'calm' }, { label: 'Focus', kind: 'focus' }, { label: 'Resets', kind: 'reset' },
];

export default function Library() {
  const sessions = useKokoro(s => s.sessions);
  const [kind, setKind] = useState<Session['kind'] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const shown = kind ? sessions.filter(s => s.kind === kind) : sessions;
  const selected = useMemo(() => shown.find(s => s.id === selectedId) ?? shown[0] ?? null, [shown, selectedId]);
  const R = useRegions();

  function Filters() {
    return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 20 }}>
      {filters.map(f => {
        const on = f.kind === kind;
        return <Pressable key={f.label} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { if (!on) { void feel('select'); setKind(f.kind); } }}
          style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: r.chip, backgroundColor: on ? k.pill : '#17171A', borderWidth: on ? 0 : 1, borderColor: '#2B2B30' }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: on ? k.pillInk : '#D8D8DC' }}>{f.label}</Text>
        </Pressable>;
      })}
    </ScrollView>;
  }

  function EmptyState() {
    return <View style={{ alignItems: 'center', gap: 14, paddingTop: 40, paddingHorizontal: 20 }}>
      <Text style={{ fontSize: 17, fontWeight: '600', color: k.ink, textAlign: 'center' }}>{kind ? 'Nothing here yet' : 'Your library is empty'}</Text>
      <Text style={{ fontSize: 14, lineHeight: 21, color: k.secondary, textAlign: 'center' }}>Each time you talk to Kokoro, what you make together lands here.</Text>
      <PrimaryButton compact icon="mic.fill" label="Talk to Kokoro" onPress={() => router.push('/chat')} />
    </View>;
  }

  // Today's exact list, reused as-is on a phone and (via a Region) in the closed column.
  function phone() {
    return <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: k.bg }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 }}>
      <Text accessibilityRole="header" style={{ fontSize: 34, lineHeight: 40, letterSpacing: -1, fontWeight: '600', color: k.ink, marginLeft: 4, marginBottom: 16 }}>Library</Text>
      <Filters />
      {shown.length > 0 && <Text style={{ fontSize: 12, fontWeight: '600', letterSpacing: 0.6, color: k.secondary, marginLeft: 4, marginBottom: 4 }}>MADE FOR YOU</Text>}
      {shown.map(s => <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={`${s.title}, ${s.minutes} minutes`} onPress={() => router.push({ pathname: '/player', params: { id: s.id } })}
        style={({ pressed }) => [{ flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: k.hairline }, pressed && { backgroundColor: '#0E0E10' }]}>
        <MiniOrb size={48} voiceId={s.voiceId} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontSize: 16, color: k.ink }}>{s.title}</Text>
          <Text style={{ fontSize: 13, color: k.secondary }}>{s.minutes} min · {voiceById(s.voiceId).name}</Text>
        </View>
        <Text style={{ fontSize: 12, color: k.quiet }}>{s.when}</Text>
      </Pressable>)}
      {shown.length === 0 && <EmptyState />}
      {shown.length === 1 && !kind && <Text style={{ fontSize: 13, lineHeight: 20, color: k.quiet, textAlign: 'center', marginTop: 24, paddingHorizontal: 24 }}>Each time you talk to Kokoro, what you make together lands here.</Text>}
    </ScrollView>;
  }

  if (!R.L.duo) return phone();
  if (!R.split) return <Region rect={R.orb.rect} insets={R.orb.insets}>{phone()}</Region>;

  // Canvas B7: the list lives on the orb page (chips wrap), the selected
  // meditation's detail lives on the words page — swapped in portrait, where
  // the detail (what you look at) takes the top page and the list (what you
  // touch) takes the bottom.
  const isPortrait = R.fold?.axis === 'y';

  function List() {
    return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 }}>
      <Text accessibilityRole="header" style={{ fontSize: 30, lineHeight: 36, letterSpacing: -1, fontWeight: '600', color: k.ink, marginBottom: 14 }}>Library</Text>
      <Filters />
      {shown.length > 0 && <Text style={{ fontSize: 12, fontWeight: '600', letterSpacing: 0.6, color: k.secondary, marginBottom: 4 }}>MADE FOR YOU</Text>}
      {shown.map(s => <Pressable key={s.id} accessibilityRole="button" accessibilityState={{ selected: selected?.id === s.id }} accessibilityLabel={`${s.title}, ${s.minutes} minutes`} onPress={() => { void feel('select'); setSelectedId(s.id); }}
        style={({ pressed }) => [{ flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderRadius: r.row, backgroundColor: selected?.id === s.id ? k.selectedFill : pressed ? '#0E0E10' : 'transparent' }]}>
        <MiniOrb size={48} voiceId={s.voiceId} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontSize: 16, color: k.ink }}>{s.title}</Text>
          <Text style={{ fontSize: 13, color: k.secondary }}>{s.minutes} min · {voiceById(s.voiceId).name}</Text>
        </View>
        <Text style={{ fontSize: 12, color: k.quiet }}>{s.when}</Text>
      </Pressable>)}
      {shown.length === 0 && <EmptyState />}
    </ScrollView>;
  }

  function Detail() {
    if (!selected) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}><EmptyState /></View>;
    const voice = voiceById(selected.voiceId);
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 16 }}>
      <LiquidOrb key={selected.id} size={205} radius={205 * 0.36} look={voice.look} />
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: '600', color: k.ink, textAlign: 'center' }}>{selected.title}</Text>
        <Text style={{ fontSize: 13, color: k.secondary }}>{selected.minutes} min · {voice.name} · {selected.when}</Text>
      </View>
      <View style={{ alignSelf: 'stretch', gap: 8, marginTop: 8 }}>
        <GlassButton label="Play" icon="play.fill" tint={k.pill} onPress={() => router.push({ pathname: '/player', params: { id: selected.id } })} />
        <TextButton label="Talk about it" onPress={() => router.push('/chat')} />
      </View>
    </View>;
  }

  return <View style={{ flex: 1, backgroundColor: k.bg }}>
    <Region rect={R.orb.rect} insets={R.orb.insets}>{isPortrait ? <Detail /> : <List />}</Region>
    <Region rect={R.words.rect} insets={R.words.insets}>{isPortrait ? <List /> : <Detail />}</Region>
  </View>;
}
