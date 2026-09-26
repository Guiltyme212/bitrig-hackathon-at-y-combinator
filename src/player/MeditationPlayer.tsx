import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { Text } from '../Text';
import { touch } from '../haptics';
import { Glass, GlassCircle } from '../ui/Glass';
import { Icon, type IconName } from '../ui/Icon';
import { useToast } from '../ui/Toast';
import { useOrbControls } from '../orb/palette';
import LiquidOrb from '../orb/LiquidOrb';
import { useOrbTouch } from '../orb/useOrbTouch';
import { captions, duckAt, ENVELOPE_RATE, type Voice } from '../voices/voices';
import { bedUri, narrationUri } from '../meditation/api';
import { GENERATED_DUCK_FLOOR, speechRegions } from '../meditation/mix';
import type { MadeSession } from '../meditation/types';
import { useEnvelope } from '../voices/useEnvelope';
import { KEEP_SESSION } from '../audioSession';
import { ROOM_TINT } from '../voices/VoiceRoom';
import { k, withAlpha } from '../theme';
import { rise } from '../ui/motion';
import { Region, useDuo, useFrameSize, useRegions } from '../layout/Duo';

const THIN = Platform.select({ ios: 'AvenirNext-UltraLight', default: undefined });
const MASTER = 0.8;
const BED = 180;                 // the approved beds are three minutes long; longer sessions loop them
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

type Props = {
  voice: Voice;
  session?: MadeSession | null;  // the meditation made for them; without it, the voice's stand-in track
  title: string;
  label: string;                 // small caps above the title
  limit?: number;                // seconds; the preview stops here
  initialSoundOn?: boolean;      // start with the music, or with the voice alone
  voiceLevel?: number;           // the person's own balance, 0..100 on top of Dan's saved mix
  musicLevel?: number;
  saved?: boolean;               // it's in the library
  onSave?: () => void;           // toggles that; the bookmark shows only when given
  onMix?: () => void;            // the full mix sheet, where there is one
  onEnd: () => void;             // reached the limit or the end
  onClose: () => void;
  onChangeVoice: () => void;
  ended?: (again: () => void) => React.ReactNode;  // what shows once a preview has finished
};

// The meditation plays as two stems, voice and music, mixed live: approved
// balance for this pairing, the listening room's ducking under speech, and the
// person's own adjustments on top. The orb breathes with the voice; the words
// can be read along. Sound off leaves only the voice.
export default function MeditationPlayer({ voice, session, title, label, limit, initialSoundOn = true, voiceLevel = 100, musicLevel = 100, saved = false, onSave, onMix, onEnd, onClose, onChangeVoice, ended }: Props) {
  // On a phone every Duo value below is inert (L.duo is false): `insets`/`width`/`height`
  // resolve exactly as useSafeAreaInsets()/useWindowDimensions() always did, so the
  // phone composition further down is untouched. Closed, both pages are the column, so
  // the column's own insets (top cleared of any status bar, no strip) replace the raw
  // system ones — useFrameSize() already reads the column for its width/height. Open,
  // the split branch below reads R.orb/R.words directly instead of these.
  const sysInsets = useSafeAreaInsets();
  const { width, height } = useFrameSize();
  const L = useDuo();
  const R = useRegions();
  const duoSplit = L.duo && R.split;
  const insets = L.duo && !duoSplit ? R.orb.insets : sysInsets;
  // The orb takes what the controls leave: header, title, three lines of words,
  // progress, transport and the toolbar all have their room first.
  const chrome = insets.top + insets.bottom + 56 + 96 + 84 + 40 + 88 + 72;
  // Open, the orb has its own page: a fixed, generous radius per canvas (B5 landscape,
  // C1 portrait) rather than the phone's chrome-subtraction formula.
  const size = duoSplit ? (L.geometry === 'openPortrait' ? 110 : 150) / 0.3
    : Math.max(210, Math.min(width * 0.94, 390, (height - chrome) / 0.92));
  const toast = useToast();
  const orb = useOrbControls(voice.palette, ROOM_TINT, voice.look);
  // What plays: the narration made for them (with the music ducked under whole
  // stretches of speech, never phrase by phrase), or the voice's stand-in track.
  const uri = session ? narrationUri(session) : null;
  const longBed = session ? bedUri(session) : null;
  const bedLength = longBed ? Number.POSITIVE_INFINITY : BED;
  const track = useMemo(() => (session && uri
    ? { stem: { uri }, duration: session.duration, timeline: session.timeline, duck: speechRegions(session.timeline), floor: GENERATED_DUCK_FLOOR, envelope: session.envelope, rate: session.envelopeRate }
    : { stem: voice.voiceStem, duration: voice.duration, timeline: voice.timeline, duck: voice.timeline, floor: voice.duckFloor, envelope: voice.envelope.voice, rate: ENVELOPE_RATE }), [session, uri, voice]);
  const envelope = useEnvelope([track.envelope], track.rate, orb);
  const speech = useAudioPlayer(track.stem, { updateInterval: 250, downloadFirst: !!uri, ...KEEP_SESSION });
  const music = useAudioPlayer(longBed ? { uri: longBed } : voice.musicStem, { downloadFirst: !!longBed, ...KEEP_SESSION });
  const length = Math.min(limit ?? track.duration, track.duration);
  const lines = useMemo(() => captions(track.timeline), [track]);
  const [playing, setPlaying] = useState(true);
  const [time, setTime] = useState(0);
  const [soundOn, setSoundOn] = useState(initialSoundOn);
  const [words, setWords] = useState(true);
  const [finished, setFinished] = useState(false);
  const fade = useRef(1);
  const end = useRef(onEnd); end.current = onEnd;
  const state = useRef({ soundOn, voiceLevel, musicLevel, playing });
  state.current = { soundOn, voiceLevel, musicLevel, playing };

  // Start together, and keep the mix moving with the voice.
  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
    speech.volume = 0; music.volume = 0;
    music.loop = !longBed;
    speech.play(); music.play();
    envelope.start(0, 0);
    touch.soft();
    let lastSync = 0;
    const tick = setInterval(() => {
      const t = speech.currentTime || 0;
      const s = state.current;
      if (t >= length - 1.6 && fade.current === 1 && s.playing) fade.current = 0.999;
      if (fade.current < 1) fade.current = Math.max(0, fade.current - 0.1 / 1.5);
      const v = (voice.mix.voice / 100) * (s.voiceLevel / 100) * MASTER * fade.current;
      const m = s.soundOn ? (voice.mix.music / 100) * (s.musicLevel / 100) * duckAt(t, track.duck, track.floor) * MASTER * fade.current : 0;
      speech.volume = Math.min(1, v);
      music.volume = Math.min(1, m);
      // The music follows the voice: it starts once its own download is done (a play
      // before that was lost, so long sessions had no music at all), restarts if it
      // stops on its own, and is pulled back if it drifts from the voice's time.
      if (s.playing && speech.playing && music.isLoaded) {
        const want = t % bedLength;
        if (!music.playing) { void music.seekTo(want); music.play(); }
        else if (Math.abs(music.currentTime - want) > 1.2 && want > 1 && want < (music.duration || Infinity) - 2) void music.seekTo(want);
      }
      if (s.playing && Math.abs(t - lastSync) > 1) { envelope.start(0, t); lastSync = t; }
      setTime(t);
      if ((fade.current === 0 || t >= length) && s.playing) {
        speech.pause(); music.pause(); envelope.stop();
        setPlaying(false); setFinished(true);
        touch.heartbeat();
        end.current();
      }
    }, 100);
    const sub = AppState.addEventListener('change', app => { if (app !== 'active') { speech.pause(); music.pause(); setPlaying(false); envelope.stop(); } });
    // A made narration is downloaded before it can play: start the voice the moment
    // it has loaded, if the listener still wants it playing.
    let voiceStarted = false;
    const loaded = speech.addListener('playbackStatusUpdate', status => {
      if (voiceStarted || !status.isLoaded) return;
      voiceStarted = true;
      if (state.current.playing && !status.playing) { try { speech.play(); } catch {} }
    });
    return () => { clearInterval(tick); sub.remove(); loaded.remove(); envelope.stop(); };
  }, []);

  const toggle = () => {
    touch.light();
    if (finished) { restart(); return; }
    if (playing) { speech.pause(); music.pause(); envelope.stop(false); setPlaying(false); }
    else {
      void music.seekTo(speech.currentTime % bedLength);
      speech.play(); music.play(); envelope.start(0, speech.currentTime); setPlaying(true);
    }
  };
  const restart = () => {
    fade.current = 1;
    void speech.seekTo(0); void music.seekTo(0);
    speech.play(); music.play(); envelope.start(0, 0);
    setFinished(false); setPlaying(true);
  };
  const seekTo = (to: number) => {
    const t = Math.max(0, Math.min(length - 2, to));
    fade.current = 1;
    if (finished) { setFinished(false); }
    void speech.seekTo(t); void music.seekTo(t % bedLength);
    envelope.start(0, t);
    setTime(t);
  };
  const seek = (delta: number) => { touch.tick(); seekTo(speech.currentTime + delta); };

  // The orb is felt, not a button (Dan: tapping it paused the music): the Orb Lab's
  // touch with its haptics. Play and pause live on the button below.
  const sphere = size * 0.3;
  const { gesture: orbGesture, finger } = useOrbTouch(orb.touch, sphere);

  // The progress line can be dragged with a finger; the time follows it, and the
  // voice and music jump there when it's let go.
  const [track_, setTrackWidth] = useState(1);
  const scrub = useSharedValue(-1);           // 0..1 while dragging, -1 otherwise
  const [scrubAt, setScrubAt] = useState<number | null>(null);
  const endScrub = (p: number) => { setScrubAt(null); touch.soft(); seekTo(p * length); };
  const scrubGesture = Gesture.Pan().minDistance(0).hitSlop({ top: 18, bottom: 18 })
    .onBegin(e => { const p = Math.max(0, Math.min(1, e.x / track_)); scrub.set(p); scheduleOnRN(setScrubAt, p * length); scheduleOnRN(touch.tick); })
    .onUpdate(e => { const p = Math.max(0, Math.min(1, e.x / track_)); scrub.set(p); scheduleOnRN(setScrubAt, p * length); })
    .onFinalize(() => { const p = scrub.get(); scrub.set(-1); if (p >= 0) scheduleOnRN(endScrub, p); });

  // Development-only QA hook: jump within the track while touch can't be injected.
  useEffect(() => {
    if (!__DEV__) return;
    (globalThis as Record<string, unknown>).__player = { seek: (t: number) => { void speech.seekTo(t); void music.seekTo(t % bedLength); envelope.start(0, t); }, toggle, time: () => speech.currentTime, state: () => ({ made: !!session, length, playing, loaded: speech.isLoaded, duration: speech.duration, caption: caption?.text ?? null, speech: { t: speech.currentTime, vol: speech.volume, playing: speech.playing }, music: { t: music.currentTime, vol: music.volume, playing: music.playing, loaded: music.isLoaded, duration: music.duration, loop: music.loop } }), save: () => save(), sound: () => sound(), words: () => read(), toast: (t: string) => toast.show(t) };
  });

  // The words: the phrase being said, which stays through the pause after it, dimmed,
  // until the next one arrives. Slow fades and a soft grey, so reading along calms
  // rather than hurries ; nothing at all before the first phrase.
  let current = -1;
  for (let i = 0; i < lines.length && lines[i].start <= time; i++) current = i;
  const caption = current >= 0 ? lines[current] : null;
  const saying = !!caption && time < caption.end + 0.3;
  const glow = useSharedValue(1);
  useEffect(() => { glow.set(withTiming(saying ? 1 : 0.42, { duration: saying ? 500 : 1600, easing: Easing.inOut(Easing.quad) })); }, [saying, glow]);
  const dim = useAnimatedStyle(() => ({ opacity: glow.get() }));
  const bar = useSharedValue(0);
  useEffect(() => { bar.set(withTiming(Math.min(1, time / length), { duration: 120, easing: Easing.linear })); }, [time, length, bar]);
  const fill = useAnimatedStyle(() => ({ width: `${(scrub.get() >= 0 ? scrub.get() : bar.get()) * 100}%` }));
  const knob = useAnimatedStyle(() => ({ opacity: withTiming(scrub.get() >= 0 ? 1 : 0, { duration: 160 }), transform: [{ translateX: (scrub.get() >= 0 ? scrub.get() : bar.get()) * track_ - 6 }] }));
  // When a preview ends, the controls make way for what comes next.
  const done = useSharedValue(0);
  useEffect(() => { done.set(withTiming(finished ? 1 : 0, { duration: 420 })); }, [finished, done]);
  const quiet = useAnimatedStyle(() => ({ opacity: 1 - done.get() }));

  const save = () => {
    if (!onSave) return;
    const next = !saved;
    onSave();
    if (next) touch.success(); else touch.light();
    toast.show(next ? 'Saved to your library' : 'Removed from your library', next ? 'bookmark.fill' : 'bookmark');
  };
  const sound = () => {
    touch.tick();
    const next = !soundOn;
    setSoundOn(next);
    toast.show(next ? 'Music on' : 'Voice only', next ? 'music.note' : 'speaker.slash');
  };
  const read = () => {
    touch.tick();
    const next = !words;
    setWords(next);
    toast.show(next ? 'Words on' : 'Words off', next ? 'quote.bubble' : 'text.quote');
  };

  const remaining = Math.max(0, length - (scrubAt ?? time));

  // One tree, always: `R.orb` is a single Region that's the whole 382 column when
  // closed and just the orb's page when open — never conditionally mounted, so the
  // header and the orb (with its touch gesture) never unmount as the hinge moves,
  // and the voice and music already playing never restart. Only the trailing content
  // (title, words, transport, toolbar) moves to a second Region, `R.words`, once the
  // hinge actually opens; closed, it stays part of the same page, right after the orb
  // — today's exact phone composition. Canvas B5 (landscape) / C1 (portrait).
  const portrait = L.geometry === 'openPortrait';
  const back = portrait ? 60 : 48, play = portrait ? 88 : 72, gap = portrait ? 40 : 30;
  // The open landscape words page sits beside the fold with nothing above y 70; the
  // portrait words page is the whole lower half, already clear of the fold band.
  const wordsTop = !duoSplit ? 0 : portrait ? R.words.insets.top + 16 : Math.max(70, R.words.insets.top + 8);

  const trailing = <>
    {!portrait && duoSplit && <>
      <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '600', letterSpacing: 2, color: k.quiet, textTransform: 'uppercase' }}>{label}</Text>
      <Text accessibilityRole="header" numberOfLines={2} style={{ marginTop: 8, fontFamily: THIN, fontSize: 30, lineHeight: 36, letterSpacing: -0.4, color: k.ink, textShadowColor: withAlpha(voice.accent, 0.5), textShadowRadius: 18 }}>{title}</Text>
      <Text style={{ fontSize: 14, color: k.secondary, marginTop: 6 }}>{voice.name} · {soundOn ? voice.bed : 'Voice only'}</Text>
    </>}
    {!duoSplit && <View style={{ alignItems: 'center', paddingHorizontal: 28, marginTop: -size * 0.08 }}>
      <Text accessibilityRole="header" numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}
        style={{ fontFamily: THIN, fontSize: 32, lineHeight: 38, letterSpacing: -0.3, color: k.ink, textAlign: 'center', textShadowColor: withAlpha(voice.accent, 0.55), textShadowRadius: 20 }}>{title}</Text>
      <Text style={{ fontSize: 13, color: k.secondary, marginTop: 6 }}>{voice.name} · {soundOn ? voice.bed : 'Voice only'}</Text>
    </View>}

    {/* The words have a room of their own: it takes the space that's left and never
        reaches the progress line. A long sentence shrinks a little instead. */}
    <Animated.View style={[{ flex: 1, minHeight: duoSplit ? 60 : 84, justifyContent: 'center', paddingHorizontal: duoSplit ? 0 : 30, overflow: 'hidden', marginTop: duoSplit && !portrait ? 16 : 0 }, quiet]}>
      {words && !finished && caption && <Animated.View key={`${current}:${caption.text}`} entering={FadeIn.delay(120).duration(1100).easing(Easing.out(Easing.quad))} exiting={FadeOut.duration(900).easing(Easing.in(Easing.quad))}
        style={[StyleSheet.absoluteFill, { justifyContent: 'center', paddingHorizontal: duoSplit ? 0 : 30 }]}>
        <Animated.View style={dim}>
          <Text numberOfLines={duoSplit && portrait ? 4 : 3} adjustsFontSizeToFit minimumFontScale={0.78}
            style={{ fontSize: duoSplit ? (portrait ? 27 : 23) : 20, lineHeight: duoSplit ? (portrait ? 34 : 30) : 28, fontWeight: duoSplit ? '500' : undefined, letterSpacing: duoSplit ? -0.3 : -0.15,
              textAlign: duoSplit && !portrait ? 'left' : 'center', color: duoSplit ? (portrait ? k.ink : '#DADADD') : '#B9B8BF' }}>{caption.text}</Text>
        </Animated.View>
      </Animated.View>}
    </Animated.View>

    {duoSplit && portrait && <View style={{ alignItems: 'center', marginBottom: 14 }}>
      <Text numberOfLines={1} style={{ fontSize: 13, color: k.secondary }}>{title} · {clock(remaining)} left</Text>
    </View>}

    <Animated.View style={[{ paddingHorizontal: duoSplit ? 0 : 30, gap: 7, marginTop: duoSplit && portrait ? 0 : 6 }, quiet]}>
      <GestureDetector gesture={scrubGesture}>
        <View accessibilityRole="adjustable" accessibilityLabel="Position" accessibilityValue={{ text: clock(time) }}
          onLayout={e => setTrackWidth(Math.max(1, e.nativeEvent.layout.width))} style={{ height: 14, justifyContent: 'center' }}>
          <View style={{ height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' }}>
            <Animated.View style={[{ position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.88)' }, fill]} />
          </View>
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: k.ink }, knob]} />
        </View>
      </GestureDetector>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={styles.time}>{clock(scrubAt ?? time)}</Text>
        <Text style={styles.time}>-{clock(remaining)}</Text>
      </View>
    </Animated.View>

    <Animated.View pointerEvents={finished ? 'none' : 'box-none'} style={[{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: duoSplit ? gap : 46, marginTop: duoSplit && portrait ? 14 : duoSplit ? 10 : 6 }, quiet]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back 15 seconds" onPress={() => seek(-15)} hitSlop={12} style={({ pressed }) => pressed && styles.pressed}>
        <Icon name="gobackward.15" size={duoSplit ? back * 0.36 : 27} color={k.body} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Pause' : 'Play'} onPress={toggle} hitSlop={8}
        style={({ pressed }) => [duoSplit
          ? { width: play, height: play, borderRadius: play / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: k.mint }
          : { width: 76, height: 76, alignItems: 'center', justifyContent: 'center' }, pressed && styles.pressed]}>
        <Icon name={playing ? 'pause.fill' : 'play.fill'} size={duoSplit ? play * 0.42 : 38} color={duoSplit ? k.mintInk : k.ink} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Forward 15 seconds" onPress={() => seek(15)} hitSlop={12} style={({ pressed }) => pressed && styles.pressed}>
        <Icon name="goforward.15" size={duoSplit ? back * 0.36 : 27} color={k.body} />
      </Pressable>
    </Animated.View>

    {/* One glass toolbar, like the system's own: icons only, each confirms itself. */}
    <View pointerEvents={finished ? 'none' : 'box-none'} style={{ alignItems: 'center', marginTop: duoSplit && portrait ? 16 : duoSplit ? 12 : 10, marginBottom: (duoSplit ? R.words.insets.bottom : insets.bottom) + 10 }}>
      <Animated.View entering={rise(300)}>
        <Glass interactive appear={300} hidden={finished} tint="rgba(255,255,255,0.04)" style={{ height: 52, borderRadius: 26, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center' }}>
          <Tool icon="person.wave.2" label="Change voice" onPress={() => { speech.pause(); music.pause(); setPlaying(false); envelope.stop(); onChangeVoice(); }} />
          <Tool icon={soundOn ? 'music.note' : 'speaker.slash'} label={soundOn ? 'Music on' : 'Voice only'} on={soundOn} onPress={sound} />
          <Tool icon={words ? 'quote.bubble' : 'text.quote'} label={words ? 'Hide the words' : 'Show the words'} on={words} onPress={read} />
          {onMix && <Tool icon="slider.horizontal.3" label="Mix" onPress={onMix} />}
        </Glass>
      </Animated.View>
    </View>

    <View pointerEvents="none" style={{ position: 'absolute', top: (duoSplit ? R.words.insets.top : insets.top) + 6 + (duoSplit ? 0 : 54), left: 0, right: 0 }}>{toast.node}</View>
    {finished && ended?.(restart)}
  </>;

  return <>
    <Region rect={R.orb.rect} insets={R.orb.insets}>
      <View style={styles.page}>
        <View style={{ paddingTop: (duoSplit ? R.orb.insets.top : insets.top) + 6, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <GlassCircle icon="chevron.down" label="Close" color={k.secondary} onPress={() => { speech.pause(); music.pause(); onClose(); }} />
          {!duoSplit && <Text numberOfLines={1} style={{ flex: 1, textAlign: 'center', fontSize: 11, letterSpacing: 2.4, color: k.quiet, marginHorizontal: 8 }}>{label}</Text>}
          {onSave ? <GlassCircle icon={saved ? 'bookmark.fill' : 'bookmark'} label={saved ? 'Remove from library' : 'Save to library'} color={saved ? k.ink : k.secondary} onPress={save} />
            : <View style={{ width: 44 }} />}
        </View>

        <View style={duoSplit ? { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingBottom: R.orb.insets.bottom } : { alignItems: 'center', marginTop: 2 }}>
          <View style={{ width: size, height: size }}>
            <LiquidOrb size={size} radius={sphere} look={voice.look} level={orb.level} touch={orb.touch} finger={finger} />
            <GestureDetector gesture={orbGesture}>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
                style={{ position: 'absolute', left: size / 2 - sphere, top: size / 2 - sphere, width: sphere * 2, height: sphere * 2, borderRadius: sphere }} />
            </GestureDetector>
          </View>
          {duoSplit && !portrait && <Animated.View style={quiet}>
            <Text style={{ fontSize: 13, color: k.secondary, fontVariant: ['tabular-nums'] }}>{clock(remaining)} left</Text>
          </Animated.View>}
        </View>

        {!duoSplit && trailing}
      </View>
    </Region>

    {duoSplit && <Region rect={R.words.rect} insets={R.words.insets}>
      <View style={{ flex: 1, backgroundColor: k.bg, paddingHorizontal: 28, paddingTop: wordsTop }}>
        {trailing}
      </View>
    </Region>}
  </>;
}

function Tool({ icon, label, on = true, onPress }: { icon: IconName; label: string; on?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }} onPress={onPress}
    style={({ pressed }) => [{ width: 58, height: 52, alignItems: 'center', justifyContent: 'center' }, pressed && styles.pressed]}>
    <Icon name={icon} size={20} color={on ? k.ink : k.faint} />
  </Pressable>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: k.bg },
  time: { fontSize: 12, color: k.faint, fontVariant: ['tabular-nums'] },
  pressed: { opacity: 0.55, transform: [{ scale: 0.94 }] },
});
