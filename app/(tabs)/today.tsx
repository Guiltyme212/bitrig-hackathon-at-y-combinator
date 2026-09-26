import { useEffect } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/Text';
import { useToast } from '@/ui/Toast';
import { PrimaryButton } from '@/ui/Buttons';
import { Glass } from '@/ui/Glass';
import { Icon, type IconName } from '@/ui/Icon';
import { KokoroOrb, MiniOrb } from '@/ui/Orbs';
import { kokoro, partOfDay, useKokoro, type Session } from '@/store';
import { voiceById } from '@/voices/voices';
import { k, r } from '@/theme';
import { Region, useRegions } from '@/layout/Duo';

const dateLabel = () => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

function Tile({ icon, title, sub, onPress }: { icon: IconName; title: string; sub: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${sub}`} onPress={onPress} style={({ pressed }) => [{ flex: 1 }, pressed && { transform: [{ scale: 0.97 }] }]}>
    <Glass style={{ height: 96, borderRadius: r.card, padding: 14, justifyContent: 'space-between' }}>
      <Icon name={icon} size={22} color={k.mint} />
      <View style={{ gap: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: k.ink }}>{title}</Text>
        <Text style={{ fontSize: 12, color: k.secondary }}>{sub}</Text>
      </View>
    </Glass>
  </Pressable>;
}

function Ready({ session }: { session: Session }) {
  const play = () => router.push({ pathname: '/player', params: { id: session.id } });
  return <Pressable accessibilityRole="button" accessibilityLabel={`Play ${session.title}`} onPress={play}
    style={({ pressed }) => [{ borderRadius: r.card, borderCurve: 'continuous', backgroundColor: pressed ? '#18181B' : k.surface, borderWidth: 1, borderColor: k.line, padding: 14, flexDirection: 'row', gap: 14, alignItems: 'center' }]}>
    <MiniOrb size={56} voiceId={session.voiceId} />
    <View style={{ flex: 1, gap: 3 }}>
      <Text style={{ fontSize: 16, fontWeight: '600', color: k.ink }}>{session.title}</Text>
      <Text style={{ fontSize: 13, color: k.secondary }}>{session.minutes} min · {voiceById(session.voiceId).name} · Made for you</Text>
    </View>
    <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: k.mint, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="play.fill" size={20} color={k.mintInk} />
    </View>
  </Pressable>;
}

export default function Today() {
  const name = useKokoro(s => s.name), sessions = useKokoro(s => s.sessions), meditation = useKokoro(s => s.meditation);
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const R = useRegions();
  // The first time in, say once where the first meditation went.
  useEffect(() => {
    if (!kokoro.get().arrived) return;
    kokoro.set({ arrived: false });
    const t = setTimeout(() => toast.show('Your first meditation is in your Library', 'books.vertical'), 700);
    return () => clearTimeout(t);
  }, [toast.show]);
  const part = partOfDay();
  const ready = sessions[0];
  const remembered = meditation ? `Last time: “${meditation.title}”. Want to pick that up, or start fresh?` : 'Want to pick up where we left off?';
  const byKind = (kind: Session['kind']) => sessions.find(s => s.kind === kind);
  const open = (kind: Session['kind']) => { const s = byKind(kind); if (s) router.push({ pathname: '/player', params: { id: s.id } }); else router.push('/chat'); };

  function Tiles() {
    return <View style={{ flexDirection: 'row', gap: 10 }}>
      <Tile icon="moon" title="Sleep" sub="Wind down" onPress={() => open('sleep')} />
      <Tile icon="arrow.triangle.2.circlepath" title="Reset" sub="2 minutes" onPress={() => open('reset')} />
      <Tile icon="scope" title="Focus" sub="Clear your head" onPress={() => open('focus')} />
    </View>;
  }
  function MemoryCard() {
    return <Pressable accessibilityRole="button" onPress={() => router.push('/chat')} style={({ pressed }) => [pressed && { opacity: 0.8 }]}>
      <Glass style={{ borderRadius: r.card, paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Icon name="heart" size={20} color={k.mint} />
        <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: k.body }}>{remembered}</Text>
        <Icon name="chevron.right" size={16} color={k.secondary} />
      </Glass>
    </Pressable>;
  }
  function LibraryRow() {
    return <Pressable accessibilityRole="button" accessibilityLabel={`Your library, ${sessions.length} ${sessions.length === 1 ? 'meditation' : 'meditations'}`} onPress={() => router.navigate('/library')}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 4 }, pressed && { opacity: 0.6 }]}>
      <Icon name="books.vertical" size={18} color={k.secondary} />
      <Text style={{ flex: 1, fontSize: 14, color: k.body }}>Your library <Text style={{ color: k.quiet }}>· {sessions.length} {sessions.length === 1 ? 'meditation' : 'meditations'}</Text></Text>
      <Icon name="chevron.right" size={14} color={k.quiet} />
    </Pressable>;
  }

  function phone(orbSize: number) {
    return <View style={{ flex: 1, backgroundColor: k.bg }}><ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: k.bg }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 14 }}>
      <View style={{ gap: 3, paddingHorizontal: 4, paddingTop: 8 }}>
        <Text style={{ fontSize: 13, color: k.secondary }}>{dateLabel()}</Text>
        <Text accessibilityRole="header" style={{ fontSize: 30, lineHeight: 36, letterSpacing: -1, fontWeight: '500', color: k.ink }}>Good {part}{name ? `, ${name}` : ''}</Text>
      </View>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Talk to Kokoro" onPress={() => router.push('/chat')}><KokoroOrb size={orbSize} breathing /></Pressable>
        <PrimaryButton compact icon="mic.fill" label="Talk to Kokoro" onPress={() => router.push('/chat')} />
      </View>
      {ready && <View style={{ gap: 10, marginTop: 8 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', letterSpacing: 0.6, color: k.secondary }}>{part === 'evening' || part === 'night' ? 'READY FOR TONIGHT' : 'READY WHEN YOU ARE'}</Text>
        <Ready session={ready} />
        <LibraryRow />
      </View>}
      <Tiles />
      <MemoryCard />
    </ScrollView>
    {/* Just above the tab bar, beside the Library it points to. */}
    <View pointerEvents="none" style={{ position: 'absolute', bottom: insets.bottom + 64, left: 0, right: 0 }}>{toast.node}</View>
    </View>;
  }

  if (!R.L.duo) return phone(190);
  if (!R.split) return <Region rect={R.orb.rect} insets={R.orb.insets}>{phone(260)}</Region>;

  // Canvas B1: the greeting, the big orb and the Talk pill live on the orb
  // page with the memory card at its foot; the ready-for-tonight card, the
  // library row and the tiles live on the words page.
  return <View style={{ flex: 1, backgroundColor: k.bg }}>
    <Region rect={R.orb.rect} insets={R.orb.insets}>
      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 20, justifyContent: 'space-between' }}>
        <View style={{ gap: 3 }}>
          <Text style={{ fontSize: 13, color: k.secondary }}>{dateLabel()}</Text>
          <Text accessibilityRole="header" style={{ fontSize: 30, lineHeight: 36, letterSpacing: -1, fontWeight: '500', color: k.ink }}>Good {part}{name ? `, ${name}` : ''}</Text>
        </View>
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Talk to Kokoro" onPress={() => router.push('/chat')}><KokoroOrb size={400} breathing /></Pressable>
          <PrimaryButton compact icon="mic.fill" label="Talk to Kokoro" onPress={() => router.push('/chat')} />
        </View>
        <View />
      </View>
    </Region>
    <Region rect={R.words.rect} insets={R.words.insets}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32, gap: 14 }}>
        {ready && <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', letterSpacing: 0.6, color: k.secondary }}>{part === 'evening' || part === 'night' ? 'READY FOR TONIGHT' : 'READY WHEN YOU ARE'}</Text>
          <Ready session={ready} />
          <LibraryRow />
        </View>}
        <Tiles />
        {/* The memory sits at the foot of the words page, so both pages carry weight. */}
        <View style={{ marginTop: 12 }}><MemoryCard /></View>
      </ScrollView>
      <View pointerEvents="none" style={{ position: 'absolute', top: 8, left: 0, right: 0 }}>{toast.node}</View>
    </Region>
  </View>;
}
