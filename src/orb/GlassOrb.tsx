import { useEffect, useState } from 'react';
import { AppState, Image, StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

export type OrbProps = { size: number; touching: boolean; reduced: boolean; mood: number; source?: number; poster?: number; hold?: boolean };

// The generated material is bundled locally. Touch motion is applied by the
// surrounding Reanimated view, independently of video decoding.
export default function GlassOrb({ size, reduced, hold=false, source=require('../../assets/video/orb-loop.mp4'), poster=require('../../assets/video/orb-poster.jpg') }: OrbProps) {
  const [ready, setReady] = useState(false);
  const player = useVideoPlayer(source, video => {
    video.loop = true;
    video.muted = true;
    video.audioMixingMode = 'mixWithOthers';
    video.staysActiveInBackground = false;
    video.showNowPlayingNotification = false;
    video.playbackRate = 0.8;
  });

  useEffect(() => { setReady(false); }, [player]);

  useEffect(() => {
    // While held (behind the welcome glass) the loop waits on its first frame,
    // the same frame the glass settles into, and starts moving once revealed.
    const update = (active: boolean) => {
      if (hold) { player.pause(); player.currentTime = 0; }
      else if (active && !reduced) player.play();
      else player.pause();
    };
    update(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', state => update(state === 'active'));
    return () => subscription.remove();
  }, [player, reduced, hold]);

  return <View style={{ width: size, height: size, pointerEvents: 'none' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <VideoView player={player} style={[StyleSheet.absoluteFill, { width: size, height: size }]} nativeControls={false}
      contentFit="contain" playsInline allowsPictureInPicture={false}
      fullscreenOptions={{ enable: false }} allowsVideoFrameAnalysis={false}
      surfaceType="textureView" onFirstFrameRender={() => setReady(true)} />
    {(!ready || reduced) && <Image source={poster}
      style={[StyleSheet.absoluteFill, { width: size, height: size }]} resizeMode="contain" />}
  </View>;
}
