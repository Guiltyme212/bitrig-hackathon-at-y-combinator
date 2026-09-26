import { Alert, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Text } from '@/Text';
import { Icon, type IconName } from '@/ui/Icon';
import { MiniOrb } from '@/ui/Orbs';
import LiquidOrb from '@/orb/LiquidOrb';
import { voiceById } from '@/voices/voices';
import { kokoro, useKokoro } from '@/store';
import { k, r } from '@/theme';
import { Region, useRegions } from '@/layout/Duo';
import { useBilling } from '@/billing/revenuecat';

function Month({ played }: { played: string[] }) {
  const now = new Date();
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const offset = (new Date(now.getFullYear(), now.getMonth(), 1).getDay() + 6) % 7;
  const cells = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 }}>
    {cells.map((d, i) => {
      if (d === null) return <View key={`e${i}`} style={{ width: `${100 / 7}%`, height: 24 }} />;
      const key = `${now.getFullYear()}-${now.getMonth() + 1}-${d}`;
      const on = played.includes(key), today = d === now.getDate();
      return <View key={key} style={{ width: `${100 / 7}%`, alignItems: 'center' }}>
        <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? k.selectedFill : 'transparent', borderWidth: today ? 1.5 : 0, borderColor: k.mint }}>
          <Text style={{ fontSize: 10, color: on ? k.mint : '#5E5E65', fontVariant: ['tabular-nums'] }}>{d}</Text>
        </View>
      </View>;
    })}
  </View>;
}

function Row({ icon, label, value, onPress, last = false }: { icon: IconName; label: string; value?: string; onPress?: () => void; last?: boolean }) {
  const body = <>
    <Icon name={icon} size={19} color={k.secondary} />
    <Text style={{ flex: 1, fontSize: 15, color: k.ink }}>{label}</Text>
    {!!value && <Text style={{ fontSize: 14, color: k.secondary }}>{value}</Text>}
    {onPress && <Icon name="chevron.right" size={16} color="#5E5E65" />}
  </>;
  const style = { flexDirection: 'row' as const, gap: 12, alignItems: 'center' as const, minHeight: 50, paddingHorizontal: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: '#222226' };
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [style, pressed && { backgroundColor: '#18181B' }]}>{body}</Pressable> : <View style={style}>{body}</View>;
}

export default function You() {
  const subscription = useBilling();
  const name = useKokoro(s => s.name), played = useKokoro(s => s.played), voiceId = useKokoro(s => s.voiceId), plan = useKokoro(s => s.plan), sessions = useKokoro(s => s.sessions);
  const month = new Date().toLocaleDateString('en-GB', { month: 'long' });
  const minutes = played.length * 10;
  const R = useRegions();
  function startOver() {
    Alert.alert('Start over?', 'This clears what you shared and takes you back to the beginning.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Start over', style: 'destructive', onPress: () => { kokoro.reset(); setTimeout(() => router.replace('/'), 0); } },
    ]);
  }

  function Stats() {
    return <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#222226', paddingTop: 12 }}>
      {[[`${played.length}`, played.length === 1 ? 'day' : 'days'], [`${minutes} m`, 'of calm'], [`${sessions.length}`, sessions.length === 1 ? 'meditation' : 'meditations']].map(([v, l]) =>
        <View key={l} style={{ flex: 1, gap: 2 }}>
          <Text selectable style={{ fontSize: 20, fontWeight: '600', color: k.ink, fontVariant: ['tabular-nums'] }}>{v}</Text>
          <Text style={{ fontSize: 12, color: k.secondary }}>{l}</Text>
        </View>)}
    </View>;
  }
  function Settings() {
    return <View style={{ borderRadius: r.card, borderCurve: 'continuous', backgroundColor: k.surface, borderWidth: 1, borderColor: k.line, overflow: 'hidden' }}>
      <Row icon="person.wave.2" label="Your voice" value={voiceById(voiceId).name} onPress={() => router.push('/voice')} />
      <Row icon="bell" label="Reminder" value="Evenings" />
      <Row icon="lock.shield" label="Subscription" value={subscription.hasPro ? (subscription.isSandbox ? 'Pro · Test' : 'Pro') : 'Free'} onPress={() => router.push('/paywall')} last />
    </View>;
  }
  function StartOver() {
    return <Pressable accessibilityRole="button" onPress={startOver} style={({ pressed }) => [{ alignItems: 'center', minHeight: 44, justifyContent: 'center' }, pressed && { opacity: 0.6 }]}>
      <Text style={{ fontSize: 14, color: '#EDC6C6' }}>Start over</Text>
    </Pressable>;
  }

  // Today's exact layout, reused as-is on a phone and (via a Region) in the closed column.
  function phone() {
    return <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: k.bg }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40, gap: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginHorizontal: 4, marginBottom: 4 }}>
        <View>
          <Text accessibilityRole="header" style={{ fontSize: 34, lineHeight: 40, letterSpacing: -1, fontWeight: '600', color: k.ink }}>{name || 'You'}</Text>
          <Text style={{ fontSize: 13, color: k.secondary }}>With Kokoro since {month}</Text>
        </View>
        <MiniOrb size={44} />
      </View>
      <View style={{ borderRadius: r.card, borderCurve: 'continuous', backgroundColor: k.surface, borderWidth: 1, borderColor: k.line, padding: 16, gap: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: k.ink }}>{month}</Text>
          <Text style={{ fontSize: 12, color: k.secondary }}>Days you made room</Text>
        </View>
        <Month played={played} />
        <Stats />
      </View>
      <Settings />
      <StartOver />
    </ScrollView>;
  }

  if (!R.L.duo) return phone();
  if (!R.split) return <Region rect={R.orb.rect} insets={R.orb.insets}>{phone()}</Region>;

  const wide = R.L.geometry === 'openPortrait';
  // Identity, a large orb and the month card on the orb page; stats, settings
  // and Start over on the words page.
  return <View style={{ flex: 1, backgroundColor: k.bg }}>
    <Region rect={R.orb.rect} insets={R.orb.insets}>
      {/* Portrait's top half is short: identity and orb sit beside the month, not above it. */}
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={wide
        ? { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 20, gap: 24, flexDirection: 'row', alignItems: 'center', flexGrow: 1 }
        : { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32, gap: 18, alignItems: 'center' }}>
        <View style={wide ? { flex: 1, gap: 18, alignItems: 'center' } : { alignSelf: 'stretch', gap: 18, alignItems: 'center' }}>
          <View style={{ alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text accessibilityRole="header" style={{ fontSize: 30, lineHeight: 36, letterSpacing: -1, fontWeight: '600', color: k.ink }}>{name || 'You'}</Text>
              <Text style={{ fontSize: 13, color: k.secondary }}>With Kokoro since {month}</Text>
            </View>
          </View>
          <LiquidOrb size={168} radius={168 * 0.36} look={voiceById(voiceId).look} />
        </View>
        <View style={{ alignSelf: wide ? 'center' : 'stretch', width: wide ? 330 : undefined, maxWidth: 368, borderRadius: r.card, borderCurve: 'continuous', backgroundColor: k.surface, borderWidth: 1, borderColor: k.line, padding: 16, gap: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: k.ink }}>{month}</Text>
            <Text style={{ fontSize: 12, color: k.secondary }}>Days you made room</Text>
          </View>
          <Month played={played} />
        </View>
      </ScrollView>
    </Region>
    <Region rect={R.words.rect} insets={R.words.insets}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32, gap: 18, justifyContent: 'center', flexGrow: 1 }}>
        <View style={{ borderRadius: r.card, borderCurve: 'continuous', backgroundColor: k.surface, borderWidth: 1, borderColor: k.line, padding: 16 }}><Stats /></View>
        <Settings />
        <StartOver />
      </ScrollView>
    </Region>
  </View>;
}
