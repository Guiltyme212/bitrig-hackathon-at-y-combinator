import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Host, Picker, Slider, Switch } from '@expo/ui';
import { Text } from '@/Text';
import { Icon } from '@/ui/Icon';
import { kokoro, useKokoro, type SleepTimer } from '@/store';
import { k } from '@/theme';
import { Region, useRegions } from '@/layout/Duo';

// SwiftUI tint so the native controls wear Kokoro's one accent (iOS only; the
// swift-ui modifiers never load on other platforms). Expo Go's bundled native
// module reads a plain colour; builds matching this JS version read a ShapeStyle.
const accent = process.env.EXPO_OS !== 'ios' ? undefined
  : Constants.executionEnvironment === ExecutionEnvironment.StoreClient ? [{ $type: 'tint', tint: k.mint }]
  : [require('@expo/ui/swift-ui/modifiers').tint(k.mint)];

// Grouped sound controls on the system's glass sheet, with native SwiftUI controls.
// Music drives the player's volume; the timer ends the session; voice and the
// binaural layer are kept for when the real voice track is connected.
export default function Sound() {
  const voice = useKokoro(s => s.voice), music = useKokoro(s => s.music), binaural = useKokoro(s => s.binaural), timer = useKokoro(s => s.timer);
  const row = { paddingVertical: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' };
  const R = useRegions();
  const panel = <View style={R.L.duo ? { paddingHorizontal: 26, paddingTop: 26, paddingBottom: 18 } : { flex: 1, paddingHorizontal: 26, paddingTop: 28 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text accessibilityRole="header" style={{ fontSize: 27, fontWeight: '500', letterSpacing: -0.8, color: k.ink }}>Make it yours.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} onPress={() => router.back()}><Icon name="xmark" size={20} color={k.secondary} /></Pressable>
    </View>
    <Text style={{ fontSize: 14, color: k.secondary, marginTop: 4, marginBottom: 16 }}>The voice, the music, and the space between.</Text>
    {([['Voice', voice, 'voice'], ['Music', music, 'music']] as const).map(([label, value, key]) =>
      <View key={key} style={[row, { gap: 6 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 16, color: k.ink }}>{label}</Text>
          <Text style={{ fontSize: 13, color: k.secondary, fontVariant: ['tabular-nums'] }}>{value}%</Text>
        </View>
        <Host style={{ height: 34 }}>
          <Slider value={value} min={0} max={100} modifiers={accent} onValueChange={v => kokoro.set({ [key]: Math.round(v) })} />
        </Host>
      </View>)}
    <View style={[row, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 }]}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontSize: 16, color: k.ink }}>Binaural layer</Text>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Icon name="headphones" size={14} color={k.secondary} />
          <Text style={{ fontSize: 12, lineHeight: 17, color: k.secondary }}>A slow 6 Hz layer. Best with headphones.</Text>
        </View>
      </View>
      <Host matchContents><Switch value={binaural} modifiers={accent} onValueChange={v => kokoro.set({ binaural: v })} /></Host>
    </View>
    <View style={[row, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
      <Text style={{ fontSize: 16, color: k.ink }}>Sleep timer</Text>
      <Host matchContents>
        <Picker selectedValue={timer} onValueChange={v => kokoro.set({ timer: v as SleepTimer })} appearance="menu">
          <Picker.Item label="Off" value="off" />
          <Picker.Item label="10 minutes" value="10" />
          <Picker.Item label="20 minutes" value="20" />
          <Picker.Item label="At the end" value="end" />
        </Picker>
      </Host>
    </View>
  </View>;
  if (!R.L.duo) return panel;
  // iPhone Duo: a see-through overlay (app/_layout.tsx): the player and its orb stay in
  // view, dimmed; the mix rises as a panel at the foot of the words page, off the fold.
  return <View style={StyleSheet.absoluteFill}>
    <Pressable accessible={false} onPress={() => router.back()} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
    <Region rect={R.words.rect} insets={R.words.insets}>
      <View style={{ position: 'absolute', left: 12, right: 12, bottom: R.words.insets.bottom + 12, backgroundColor: k.sheet, borderRadius: 30, borderCurve: 'continuous', borderWidth: 1, borderColor: '#2A2A2E' }}>
        {panel}
      </View>
    </Region>
  </View>;
}
