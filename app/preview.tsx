import { useEffect, useState } from 'react';
import { Keyboard, TextInput, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { rise } from '@/ui/motion';
import { Text } from '@/Text';
import { touch } from '@/haptics';
import MeditationPlayer from '@/player/MeditationPlayer';
import { describe, readMind } from '@/stage/script';
import { Glass, GlassButton, GlassPill } from '@/ui/Glass';
import { TextButton } from '@/ui/Buttons';
import { voiceById } from '@/voices/voices';
import { kokoro, useKokoro } from '@/store';
import { isKept, keepMeditation, toggleKept } from '@/firstRun';
import { k } from '@/theme';

// Their first meditation, in the voice they chose. One made for them by the engine
// plays whole; the stand-in tracks play a 45-second preview (a one-minute one is
// given whole). When it ends, one gentle question about fit, then the offer.
export default function Preview() {
  const insets = useSafeAreaInsets();
  const meditation = useKokoro(s => s.meditation), voiceId = useKokoro(s => s.voiceId), soundOn = useKokoro(s => s.soundOn);
  const kept = useKokoro(isKept);
  // The meditation made for them, in the voice it was made in.
  const made = useKokoro(s => (s.meditation?.narrationId ? s.made[s.meditation.narrationId] ?? null : null));
  const [ended, setEnded] = useState(false);
  // A new voice or a change of sound plays the preview again from the start.
  useEffect(() => { setEnded(false); }, [voiceId, soundOn]);
  const [editing, setEditing] = useState(false);
  // The sheet rides above the keyboard while its words are being edited.
  const keyboard = useAnimatedKeyboard();
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: -Math.max(0, keyboard.height.get() - insets.bottom) }] }));
  const [words, setWords] = useState(meditation?.mind ?? '');
  // Development-only QA hook: open the words editor while touch can't be injected.
  useEffect(() => {
    if (!__DEV__) return;
    (globalThis as Record<string, unknown>).__preview = { edit: () => setEditing(true) };
  });
  if (!meditation) return <Redirect href="/" />;
  const voice = voiceById(voiceId);
  const whole = meditation.minutes <= 1;
  // A meditation made for them, in this voice, plays whole: it's theirs. The
  // stand-in tracks stay a preview.
  const own = made?.voiceId === voice.id ? made : null;

  const remake = () => {
    const text = words.trim();
    if (!text) return;
    Keyboard.dismiss();
    const topic = readMind(text);
    // New words make a new meditation: the old brief and narration are let go.
    kokoro.set({ meditation: { ...meditation, mind: text, title: topic.title, kind: topic.kind, description: describe(topic, meditation.feel, meditation.minutes), brief: undefined, makingId: undefined, narrationId: undefined }, makingStartedAt: Date.now() });
    touch.medium();
    router.replace('/making');
  };

  // After the preview: one gentle question about fit, then the offer.
  const sheet = (again: () => void) => <Animated.View style={[{ position: 'absolute', left: 14, right: 14, bottom: insets.bottom + 8 }, lift]}><Animated.View entering={rise(0, 40, 700)}>
    {/* A static panel: glass inside it can materialise without a fading parent. */}
    <Glass tint="rgba(30,30,34,0.5)" style={{ borderRadius: 34, padding: 22, gap: 16 }}>
      {!editing ? <>
        <Text accessibilityRole="header" style={{ fontSize: 22, lineHeight: 28, letterSpacing: -0.4, color: k.ink, textAlign: 'center' }}>Want to change anything?</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
          <GlassPill icon="person.wave.2" label="Voice" appear={150} onPress={() => router.push('/voice')} />
          <GlassPill icon="pencil" label="Words" appear={210} onPress={() => { touch.tick(); setEditing(true); }} />
          <GlassPill icon={soundOn ? 'music.note' : 'speaker.slash'} label={soundOn ? 'Background sound' : 'Voice only'} selected={!soundOn} appear={270}
            onPress={() => { touch.tick(); kokoro.set({ soundOn: !soundOn }); }} />
        </View>
        <GlassButton label="Keep this" appear={330} onPress={() => { touch.medium(); keepMeditation(); router.push('/paywall'); }} />
        <TextButton label="Listen again" onPress={() => { touch.light(); again(); setEnded(false); }} />
      </> : <>
        <Text accessibilityRole="header" style={{ fontSize: 22, lineHeight: 28, letterSpacing: -0.4, color: k.ink, textAlign: 'center' }}>What should it be about?</Text>
        <Glass interactive appear={0} style={{ borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12 }}>
          <TextInput value={words} onChangeText={setWords} multiline autoFocus maxLength={280} keyboardAppearance="dark" selectionColor={k.mint}
            accessibilityLabel="What your meditation is about" style={{ color: k.ink, fontSize: 17, lineHeight: 23, minHeight: 46, maxHeight: 110 }} />
        </Glass>
        <GlassButton label="Make it again" appear={80} onPress={remake} disabled={!words.trim()} />
        <TextButton label="Never mind" onPress={() => { Keyboard.dismiss(); setEditing(false); }} />
      </>}
    </Glass>
  </Animated.View></Animated.View>;

  return <View style={{ flex: 1, backgroundColor: k.bg }}>
    <MeditationPlayer key={`${voice.id}-${soundOn}`} voice={voice} session={own} initialSoundOn={soundOn} title={made?.title ?? meditation.title} label={whole || own ? 'YOUR FIRST MEDITATION' : 'FREE PREVIEW'}
      limit={own ? undefined : whole ? 60 : 45} voiceLevel={100} musicLevel={100} saved={kept} onSave={toggleKept}
      onEnd={() => setEnded(true)} onClose={() => router.back()} onChangeVoice={() => router.push('/voice')}
      ended={again => (ended ? sheet(again) : null)} />
  </View>;
}
