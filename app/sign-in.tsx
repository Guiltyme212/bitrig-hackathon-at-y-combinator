import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Text } from '@/Text';
import { finishFirstRun } from '@/firstRun';
import { TextButton } from '@/ui/Buttons';
import { Icon } from '@/ui/Icon';
import { useKokoro } from '@/store';
import { k } from '@/theme';
import { Region, useRegions } from '@/layout/Duo';

// After purchase, never before. A form sheet with the system's glass background
// on a phone. On the Duo this route is a stopgap: see the note at the bottom —
// the lead's presentation change in app/_layout.tsx decides how it's shown there.
export default function SignIn() {
  const plan = useKokoro(s => s.plan);
  const done = () => finishFirstRun(plan === 'none' ? 'free' : plan);
  const R = useRegions();

  const body = <View style={[{ paddingHorizontal: 26, paddingTop: 30, gap: 10 }, R.L.duo ? { paddingBottom: 18 } : { flex: 1 }]}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text accessibilityRole="header" style={{ fontSize: 27, fontWeight: '500', letterSpacing: -0.8, color: k.ink }}>Keep your space safe.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} onPress={() => router.back()}><Icon name="xmark" size={20} color={k.secondary} /></Pressable>
    </View>
    <Text style={{ fontSize: 14, lineHeight: 21, color: k.secondary, marginBottom: 14 }}>Sign in so your meditations are backed up and follow you to a new phone.</Text>
    <Pressable accessibilityRole="button" onPress={done} style={({ pressed }) => [{ minHeight: 56, borderRadius: 28, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, pressed && { opacity: 0.85 }]}>
      <Text style={{ fontSize: 18, color: '#000' }}></Text>
      <Text style={{ fontSize: 16, fontWeight: '600', color: '#000' }}>Continue with Apple</Text>
    </Pressable>
    <Pressable accessibilityRole="button" onPress={done} style={({ pressed }) => [{ minHeight: 56, borderRadius: 28, backgroundColor: '#1E1E21', borderWidth: 1, borderColor: '#333337', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }, pressed && { opacity: 0.85 }]}>
      <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: k.secondary, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 11, fontWeight: '700', color: k.secondary }}>G</Text></View>
      <Text style={{ fontSize: 16, fontWeight: '600', color: k.ink }}>Continue with Google</Text>
    </Pressable>
    <TextButton label="Not now" size={14} onPress={done} />
  </View>;

  if (!R.L.duo) return body;
  // iPhone Duo: a see-through overlay (app/_layout.tsx). The paywall and its orb stay in
  // view, dimmed; the card rises at the foot of the words page, never across the fold.
  const bottom = R.words.insets.bottom + 12;
  return <View style={StyleSheet.absoluteFill}>
    <Pressable accessible={false} onPress={() => router.back()} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]} />
    <Region rect={R.words.rect} insets={R.words.insets}>
      <View style={{ position: 'absolute', left: 12, right: 12, bottom, maxWidth: 460, alignSelf: 'center', backgroundColor: k.sheet, borderRadius: 30, borderCurve: 'continuous', borderWidth: 1, borderColor: '#2A2A2E' }}>
        {body}
      </View>
    </Region>
  </View>;
}
