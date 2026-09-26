import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import MeditationPlayer from '@/player/MeditationPlayer';
import { voiceById } from '@/voices/voices';
import { firstMeditation, kokoro, todayKey, useKokoro } from '@/store';
import { k } from '@/theme';

// A meditation from the library, whole. The sound sheet's sliders move the
// voice and the music live; when it ends, a gentle check-in.
export default function Player() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const sessions = useKokoro(s => s.sessions), voiceLevel = useKokoro(s => s.voice), musicLevel = useKokoro(s => s.music), name = useKokoro(s => s.name);
  const voiceId = useKokoro(s => s.voiceId);
  // Held from the start, so taking it out of the library doesn't change what's playing.
  const [session] = useState(() => sessions.find(s => s.id === id) ?? sessions[0] ?? firstMeditation(kokoro.get()));
  const saved = sessions.some(s => s.id === session.id);
  // A voice chosen from here plays from here on, and the library remembers it.
  const [startVoice] = useState(voiceId);
  const voice = voiceById(voiceId !== startVoice ? voiceId : session.voiceId ?? voiceId);
  const made = useKokoro(s => (session.narrationId ? s.made[session.narrationId] ?? null : null));
  useEffect(() => {
    if (voiceId === startVoice) return;
    kokoro.set({ sessions: kokoro.get().sessions.map(s => (s.id === session.id ? { ...s, voiceId } : s)) });
  }, [voiceId, startVoice, session.id]);
  const toggleSaved = () => {
    const now = kokoro.get().sessions;
    kokoro.set({ sessions: now.some(s => s.id === session.id) ? now.filter(s => s.id !== session.id) : [session, ...now] });
  };
  useEffect(() => {
    const key = todayKey(), played = kokoro.get().played;
    if (!played.includes(key)) kokoro.set({ played: [...played, key] });
  }, []);
  return <View style={{ flex: 1, backgroundColor: k.bg }}>
    <MeditationPlayer key={voice.id} voice={voice} session={made?.voiceId === voice.id ? made : null} title={made?.title ?? session.title} label={name ? `MADE FOR ${name.toUpperCase()}` : 'MADE FOR YOU'}
      voiceLevel={voiceLevel} musicLevel={musicLevel}
      onEnd={() => router.replace({ pathname: '/complete', params: { id: session.id } })} onClose={() => router.back()}
      onChangeVoice={() => router.push('/voice')} saved={saved} onSave={toggleSaved} onMix={() => router.push('/sound')} />
  </View>;
}
